"""
Интернет-магазин Smart Centr — заказы с сайта: оплата O!Деньги → 1С.

Использует уже работающие модули SBonus: app.payments.obank_service (подпись и запросы O!Деньги)
и app.payments.payments_greenapi (WhatsApp). Рассрочку и её колбэк не трогает:
у заказов сайта свой колбэк /webhook/obank/shop-callback.

Эндпоинты (все под /api/v1):
  POST /webhook/site/orders                  (HMAC сайта)  сайт создаёт заказ → ссылка на оплату
  GET  /webhook/site/orders/{order_id}       (HMAC сайта)  статус для страницы заказа (нужен token)
  POST /webhook/obank/shop-callback          (O!Деньги)    оплата → перепроверка statusPayment → paid
  GET  /webhook/1c/shop/pending              (X-Api-Key)   1С забирает оплаченные заказы
  POST /webhook/1c/shop/{order_id}/mark-done   (HMAC 1С)   1С создала документы
  POST /webhook/1c/shop/{order_id}/mark-failed (HMAC 1С)   ошибка 1С (5 попыток → failed)

Секреты:
  SHOP_SITE_SECRET  — общий секрет сайта и сервера (в .env сервера и в .env сайта как SHOP_API_SECRET)
  webhook_1c_secret — существующий секрет 1С (тот же, что у SBonus)
"""
from __future__ import annotations

import hashlib
import hmac
import logging
import os
import re
import secrets
import string
from datetime import datetime, timedelta
from decimal import Decimal
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy import and_, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import get_db
from app.payments import obank_service as obank  # type: ignore
from app.payments import payments_greenapi as wa  # type: ignore

from .shop_models import ShopOrder, ShopOrderEvent
from . import shop_deposit_rules as deposit_rules

logger = logging.getLogger("sbonus.shop")
settings = get_settings()

router_site = APIRouter(prefix="/webhook/site/orders", tags=["Сайт: заказы"])
router_obank_shop = APIRouter(prefix="/webhook/obank", tags=["O!Деньги: заказы сайта"])
router_1c_shop = APIRouter(prefix="/webhook/1c/shop", tags=["1С: заказы сайта"])

INVOICE_TTL_HOURS = 24
MAX_SYNC_ATTEMPTS = 5


def _cfg(name: str, default: str = "") -> str:
    return str(getattr(settings, name.lower(), "") or os.environ.get(name.upper(), "") or default)


def _site_secret() -> str:
    return _cfg("shop_site_secret")


def _admin_phone() -> str:
    return _cfg("admin_notify_phone", "996557100505")


def _shop_callback_url() -> str:
    base = _cfg("shop_public_api_base", "https://api.smartcentr.store")
    return f"{base.rstrip('/')}/api/v1/webhook/obank/shop-callback"


def _site_base_url() -> str:
    return _cfg("shop_site_base_url", "https://shop.smartcentr.store").rstrip("/")


def _money(value) -> str:
    return f"{Decimal(str(value)):,.0f}".replace(",", " ") + " сом"


def _client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for", "")
    return fwd.split(",")[0].strip() if fwd else (request.client.host if request.client else "")


async def _log(db: AsyncSession, order: ShopOrder, event: str, data: dict | None = None, ip: str | None = None):
    db.add(ShopOrderEvent(order_uuid=order.id, event_type=event, event_data=data, ip_address=ip))
    await db.commit()


# ── Подписи ──────────────────────────────────────────────────────────────────

def _check_signature(secret: str, message: bytes, signature: str) -> None:
    if not secret:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "секрет не настроен")
    expected = hmac.new(secret.encode("utf-8"), message, hashlib.sha256).hexdigest()
    if not signature or not hmac.compare_digest(signature, expected):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "подпись неверна")


async def _verify_site_body(request: Request) -> bytes:
    body = await request.body()
    _check_signature(_site_secret(), body, request.headers.get("X-Signature", ""))
    return body


def _verify_site_path(request: Request) -> None:
    path = request.url.path + (f"?{request.url.query}" if request.url.query else "")
    _check_signature(_site_secret(), path.encode("utf-8"), request.headers.get("X-Signature", ""))


async def _verify_1c_body(request: Request) -> bytes:
    body = await request.body()
    _check_signature(getattr(settings, "webhook_1c_secret", ""), body, request.headers.get("X-Signature", ""))
    return body


def _verify_1c_key(x_api_key: str = Header(default="")) -> None:
    secret = getattr(settings, "webhook_1c_secret", "")
    if not secret or not hmac.compare_digest(x_api_key, secret):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "X-Api-Key invalid")


# ── Модели запросов ─────────────────────────────────────────────────────────

# Модели без validator/regex/min_items: код одинаково работает на pydantic 1 и 2.
class SiteCustomer(BaseModel):
    name: str
    phone: str


class SiteDelivery(BaseModel):
    method: Literal["pickup", "delivery"]
    city: str = ""
    address: str = ""
    price: float = 0


class SiteLine(BaseModel):
    productId: str
    oneCId: str = ""
    code: str = ""
    name: str
    price: float
    qty: int
    sum: float


class SiteOrderCreate(BaseModel):
    customer: SiteCustomer
    delivery: SiteDelivery
    comment: str = ""
    lines: List[SiteLine]
    goodsTotal: float
    total: float
    bonus: int = 0          # сколько бонусов SBonus клиент списывает (целые сомы)
    lang: str = "ru"
    deposit: int = 0        # заклад: сколько платит сразу (≥ 1 000); 0 — всё сразу (shop_deposit_rules)


def _check_site_order(order: SiteOrderCreate) -> None:
    """Повторная проверка заказа на сервере: формат телефона, количества и сходимость суммы."""
    problems = []
    if not (2 <= len(order.customer.name.strip()) <= 160):
        problems.append("имя")
    if not re.fullmatch(r"\+(?:996\d{9}|7\d{10})", order.customer.phone):
        problems.append("телефон")
    if order.delivery.price < 0:
        problems.append("доставка")
    if not (1 <= len(order.lines) <= 50):
        problems.append("состав")
    goods = Decimal("0")
    for line in order.lines:
        if line.price <= 0 or not (1 <= line.qty <= 99):
            problems.append(f"строка {line.name}")
        goods += Decimal(str(line.price)) * line.qty
    if abs(goods - Decimal(str(order.goodsTotal))) > Decimal("0.01"):
        problems.append("сумма товаров")
    if abs(goods + Decimal(str(order.delivery.price)) - Decimal(str(order.total))) > Decimal("0.01"):
        problems.append("итог")
    if order.bonus < 0 or order.bonus >= order.total:
        problems.append("бонусы")
    if problems:
        raise ValueError(", ".join(problems))


class MarkDone(BaseModel):
    order_number_1c: str = ""
    pko_number_1c: str = ""
    rtu_number_1c: str = ""
    realized: bool = False
    bonus_earned: float = 0
    note: str = ""


class MarkFailed(BaseModel):
    note: str = ""


# ── Сайт ─────────────────────────────────────────────────────────────────────

async def taken_now(db: AsyncSession) -> dict[str, int]:
    """Сколько штук каждого товара уже занято заказами, о которых 1С ещё не знает (shop_stock.py)."""
    from .shop_stock import HOLD_UNPAID, SYNC_GRACE, reserved_by
    now = datetime.utcnow()
    res = await db.execute(
        select(ShopOrder.lines).where(or_(
            and_(ShopOrder.paid == True, ShopOrder.status.in_(("paid", "failed"))),  # noqa: E712
            and_(ShopOrder.paid == True, ShopOrder.status == "in_1c", ShopOrder.synced_at > now - SYNC_GRACE),  # noqa: E712
            and_(ShopOrder.paid == False, ShopOrder.status == "awaiting_payment",  # noqa: E712
                 ShopOrder.created_at > now - HOLD_UNPAID),
        ))
    )
    return reserved_by([{"lines": lines} for (lines,) in res.all()])


async def catalog_items(db: AsyncSession) -> list[dict]:
    row = (await db.execute(text("SELECT data FROM shop_catalog WHERE id = 1"))).first()
    if not row:
        return []
    data = row[0]
    if isinstance(data, str):
        import json
        data = json.loads(data)
    return list((data or {}).get("items") or [])


def _new_order_id() -> str:
    alphabet = string.ascii_uppercase + string.digits
    return f"SC-{datetime.utcnow():%y%m%d}-" + "".join(secrets.choice(alphabet) for _ in range(5))


@router_site.post("")
async def site_create_order(request: Request, db: AsyncSession = Depends(get_db)):
    body = await _verify_site_body(request)
    try:
        payload = SiteOrderCreate.parse_raw(body)
        _check_site_order(payload)
    except Exception as error:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"заказ не прошёл проверку: {error}")

    # Последнюю штуку не продаём второй раз: остаток 1С минус то, что уже занято
    # оплаченными и ждущими оплаты заказами, о которых 1С ещё не знает.
    from .shop_stock import shortages
    from .shop_catalog import chat_extra_items
    # Товары «только для чата» — первыми: у одинакового id каталог сайта перекроет их.
    stock_items = await chat_extra_items(db) + await catalog_items(db)
    short = shortages([l.dict() for l in payload.lines], stock_items, await taken_now(db))
    if short:
        raise HTTPException(status.HTTP_409_CONFLICT, {"code": "out-of-stock", "items": short})

    bonus = Decimal(payload.bonus)
    if bonus > 0:
        from .shop_customers import _customer, _account, max_spend, max_spend_pct, max_spend_cap
        customer = await _customer(db, payload.customer.phone)
        if not customer or not customer.is_active:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "бонусы: клиент не найден в SBonus")
        account = await _account(db, customer)
        allowed = max_spend(Decimal(str(account.balance or 0)), Decimal(str(payload.total)), await max_spend_pct(db),
                            await max_spend_cap(db))
        if bonus > allowed:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"бонусы: можно списать не больше {allowed} сом")

    order = ShopOrder(
        order_id=_new_order_id(),
        token=secrets.token_hex(16),
        customer_name=payload.customer.name.strip(),
        customer_phone=payload.customer.phone,
        delivery=payload.delivery.dict(),
        comment=payload.comment[:500],
        lines=[l.dict() for l in payload.lines],
        goods_total=Decimal(str(payload.goodsTotal)),
        total=Decimal(str(payload.total)),
        bonus_spend=bonus,
        pay_amount=Decimal(str(payload.total)) - bonus,
        lang="ky" if payload.lang == "ky" else "ru",
    )
    try:
        order.deposit = deposit_rules.check_deposit(payload.deposit, order.pay_amount)
    except ValueError as error:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"заказ не прошёл проверку: {error}")
    db.add(order)
    await db.commit()
    await _log(db, order, "created", {"total": payload.total, "bonus": payload.bonus,
                                      "deposit": float(order.deposit) if order.deposit else None}, _client_ip(request))

    try:
        data = {
            "order_id": order.order_id,
            "desc": f"Заказ {order.order_id} — Smart Centr"[:1000],
            "amount": obank._to_kopecks(order.money_amount()),  # КОПЕЙКИ (тыйын); бонусы уже вычтены
            "currency": "KGS",
            "test": int(_cfg("obank_test", "0") or "0"),
            "long_term": 0,
            "send_push": 0,
            "send_sms": 0,
            "date_life": (datetime.now() + timedelta(hours=INVOICE_TTL_HOURS)).strftime("%Y-%m-%d %H:%M:%S"),
            "result_url": _shop_callback_url(),
        }
        answer = obank._request("createInvoice", data)
        order.obank_invoice_id = str(answer.get("invoice_id") or "")
        field = _cfg("obank_link_field", "paylink_url")
        order.pay_url = answer.get(field) or answer.get("paylink_url") or answer.get("site_pay") or answer.get("qr") or ""
        if not order.pay_url:
            raise ValueError(f"createInvoice без ссылки: {answer}")
        await db.commit()
        await _log(db, order, "invoice", {"invoice_id": order.obank_invoice_id})
    except Exception as error:
        logger.error(f"shop createInvoice failed {order.order_id}: {error}")
        order.status = "failed"
        order.note = f"Счёт O!Деньги не создан: {error}"[:1000]
        await db.commit()
        await _log(db, order, "invoice_failed", {"error": str(error)})
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "O!Деньги недоступны")

    answer = {"order_id": order.order_id, "token": order.token, "pay_url": order.pay_url,
              # бот пишет покупателю заклад только если сервер его принял (старый сервер поле не знал)
              "deposit": float(order.deposit) if order.deposit else None, "amount": float(order.money_amount())}
    # Заказ оформлен — напоминать о корзине этого номера больше не о чем.
    # Ответ собран заранее: откат ниже сбрасывает загруженные поля заказа.
    # Сбой здесь заказу не мешает: задача напоминаний и так пропускает тех,
    # у кого после изменения корзины есть заказ.
    try:
        from .shop_cart_remind import clear_after_order
        await clear_after_order(db, payload.customer.phone)
    except Exception as error:
        await db.rollback()
        logger.info(f"корзина не обнулена {answer['order_id']}: {type(error).__name__}")
    return answer


@router_site.get("/{order_id}")
async def site_order_status(order_id: str, request: Request, token: str = "", db: AsyncSession = Depends(get_db)):
    _verify_site_path(request)
    res = await db.execute(select(ShopOrder).where(ShopOrder.order_id == order_id))
    order = res.scalar_one_or_none()
    if not order or not token or not hmac.compare_digest(order.token, token):
        raise HTTPException(404, "заказ не найден")

    # Покупатель вернулся со страницы оплаты раньше колбэка — перепроверим сами.
    if order.status == "awaiting_payment" and obank.is_api_mode():
        await _check_and_confirm(db, order, by="status_poll")
    if order.deposit and order.rest_ref and not order.rest_paid and obank.is_api_mode():
        await _check_rest(db, order, by="status_poll")
    return order.to_site_dict()


class SiteOrderCancel(BaseModel):
    token: str


@router_site.post("/{order_id}/cancel")
async def site_order_cancel(order_id: str, request: Request, db: AsyncSession = Depends(get_db)):
    """
    Покупатель сам отменяет НЕоплаченный заказ (страница заказа, кабинет).

    Оплаченный так не отменить: там возврат денег, это решает магазин. Перед
    отменой спрашиваем O!Деньги — вдруг оплата уже прошла, а колбэк ещё в пути.
    Если оплата всё же придёт позже по старой ссылке (она живёт 24 часа), заказ
    станет оплаченным обычным путём (_check_and_confirm): деньги получены —
    заказ выполняем, а в заметке сотруднику будет пометка «после отмены».
    Товар, придержанный под заказ, освобождается сам: taken_now считает только
    awaiting_payment.
    """
    body = await _verify_site_body(request)
    try:
        payload = SiteOrderCancel.parse_raw(body)
    except Exception:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "неверный запрос")
    res = await db.execute(select(ShopOrder).where(ShopOrder.order_id == order_id).with_for_update())
    order = res.scalar_one_or_none()
    if not order or not payload.token or not hmac.compare_digest(order.token, payload.token):
        raise HTTPException(404, "заказ не найден")
    # Второе нажатие (или две вкладки) — уже отменён, это не ошибка.
    if order.status == "cancelled" and not order.paid:
        return order.to_site_dict()
    if order.status == "awaiting_payment" and not order.paid and obank.is_api_mode():
        await _check_and_confirm(db, order, by="cancel_check")
    if order.paid or order.status != "awaiting_payment":
        raise HTTPException(status.HTTP_409_CONFLICT, "заказ уже оплачен или в работе")
    order.status = "cancelled"
    await db.commit()
    await _log(db, order, "cancelled_by_customer", ip=request.client.host if request.client else None)
    return order.to_site_dict()


# ── Подтверждение оплаты ────────────────────────────────────────────────────

async def _check_and_confirm(db: AsyncSession, order: ShopOrder, by: str, raw: dict | None = None) -> bool:
    """Перепроверка у O!Деньги (statusPayment) и подтверждение. Идемпотентно."""
    if order.paid:
        return False
    st = obank.check_status(order_id=order.order_id, invoice_id=order.obank_invoice_id or "")
    if not st.get("approved"):
        return False
    paid_amount = Decimal(str(st.get("amount") or 0))
    if paid_amount and paid_amount + Decimal("1") < Decimal(str(order.money_amount())):
        order.note = f"⚠ оплачено {paid_amount} меньше суммы к оплате {order.money_amount()}"
        await db.commit()
        await _log(db, order, "amount_mismatch", {"paid": float(paid_amount)})
        return False

    # Покупатель отменил заказ, а потом всё же оплатил по старой ссылке.
    after_cancel = order.status == "cancelled"
    order.paid = True
    order.paid_at = datetime.utcnow()
    order.status = "paid"
    if after_cancel:
        order.note = "⚠ оплачен после отмены покупателем — уточните, нужен ли ещё заказ"
    order.obank_trans_id = st.get("trans_id") or order.obank_trans_id
    if raw is not None:
        order.obank_raw = raw
    await db.commit()
    await _log(db, order, "paid", {"by": by, "trans_id": order.obank_trans_id, "after_cancel": after_cancel})

    if Decimal(str(order.bonus_spend or 0)) > 0:
        try:
            from .shop_customers import spend_for_order
            spent = await spend_for_order(db, order)
            order.bonus_spent = spent
            if spent < Decimal(str(order.bonus_spend)):
                order.note = f"⚠ бонусов списано {spent} из {order.bonus_spend} — баланс уменьшился после оформления"
            await db.commit()
            await _log(db, order, "bonus_spent", {"planned": float(order.bonus_spend), "spent": float(spent)})
        except Exception as error:
            await db.rollback()
            logger.error(f"shop bonus spend failed {order.order_id}: {error}")
            order.note = f"⚠ бонусы не списаны: {error}"[:1000]
            await db.commit()
            await _log(db, order, "bonus_failed", {"error": str(error)})
    if order.deposit:
        await _push(db, order, "Заклад получен",
                    f"Заклад по заказу {order.order_id} получен. Остаток — когда товар погрузим в машину.")
    else:
        await _push(db, order, "Заказ оплачен",
                    f"Заказ {order.order_id} оплачен. Мы свяжемся с вами.")
    _notify_paid(order)
    return True


async def _push(db: AsyncSession, order: ShopOrder, title: str, body: str) -> None:
    """
    Уведомление в приложении на телефоне. Если приложения нет или ключ Apple
    не задан — просто ничего не произойдёт. Заказ от этого не страдает.
    """
    try:
        from .shop_push import send
        await send(db, order.customer_phone, title, body,
                   {"orderId": order.order_id, "token": order.token})
    except Exception as error:
        logger.info(f"push не отправлен {order.order_id}: {error}")


def _notify_paid(order: ShopOrder) -> None:
    delivery = order.delivery or {}
    lines = "\n".join(f"• {l.get('name')} × {l.get('qty')} — {_money(l.get('sum'))}" for l in order.lines or [])
    planned = Decimal(str(order.bonus_spend or 0))
    spent = Decimal(str(order.bonus_spent or 0))
    money = f"{_money(order.money_amount())} (O!Деньги)" + (f" + {_money(spent)} бонусами" if spent > 0 else "")
    bonus_warn = (f"\n⚠ Бонусов списано {_money(spent)} вместо {_money(planned)} — проверьте скидку" if spent < planned else "")
    how = (f"🚚 Доставка: {delivery.get('city', '')}, {delivery.get('address', '')}"
           if delivery.get("method") == "delivery" else "🏬 Самовывоз из магазина")
    # Ссылку на заказ показываем кнопкой: длинный адрес с токеном читать
    # неудобно. Кнопка не прошла — уйдёт обычным текстом, как раньше.
    order_url = f"{_site_base_url()}/{order.lang}/order/{order.order_id}?token={order.token}"
    if order.deposit:
        # Заклад: покупателю — про остаток и такси; владельцу — что грузить и где нажать (ниже)
        client_text = (deposit_rules.deposit_paid_text(order.lang, order.customer_name, order.order_id,
                                                       order.deposit, order.rest_amount()) + f"\n\n{lines}\n{how}")
        money = (f"ЗАКЛАД {_money(order.deposit)} из {_money(order.full_amount())} (O!Деньги)"
                 + (f" + {_money(spent)} бонусами" if spent > 0 else "")
                 + f"\n⏳ Остаток {_money(order.rest_amount())} — после погрузки: 1С → Панель сайта → «Заклад» → "
                   f"впишите машину и телефон водителя → «Таксига юкландим», "
                 + deposit_rules.taxi_hint(order.order_id))
    else:
        client_text = (
            f"Здравствуйте, {order.customer_name.split()[0]}!\n"
            f"Оплата заказа {order.order_id} получена ✅\n💵 {money}\n\n"
            f"{lines}\n{how}\n\n"
            f"С вами свяжется руководство Smart Centr."
        )
    try:
        from .shop_whatsapp import send_with_button
        send_with_button(order.customer_phone, client_text, "Статус заказа", order_url)
    except Exception as error:
        logger.error(f"shop client notify failed {order.order_id}: {error}")
    try:
        wa.send_text(_admin_phone(), (
            f"🛒 НОВЫЙ ОПЛАЧЕННЫЙ ЗАКАЗ С САЙТА\n━━━━━━━━━━━━━━━━━━━\n"
            f"№ {order.order_id}\n💵 {money}{bonus_warn}\n"
            f"👤 {order.customer_name}\n📱 {order.customer_phone}\n{how}\n"
            f"{('💬 ' + order.comment) if order.comment else ''}\n━━━━━━━━━━━━━━━━━━━\n{lines}\n\n"
            f"Заказ клиента и ПКО 1С создаст автоматически в течение 5 минут."
        ))
    except Exception as error:
        logger.error(f"shop admin notify failed {order.order_id}: {error}")


async def _collect_params(request: Request) -> dict:
    params = dict(request.query_params)
    try:
        if "application/json" in request.headers.get("content-type", ""):
            data = await request.json()
            if isinstance(data, dict):
                params.update(data)
        else:
            form = await request.form()
            params.update({k: str(v) for k, v in form.items()})
    except Exception:
        pass
    return params


@router_obank_shop.api_route("/shop-callback", methods=["POST", "GET"])
async def obank_shop_callback(request: Request, db: AsyncSession = Depends(get_db)):
    raw = await request.body()
    params = await _collect_params(request)
    if not obank.verify_callback(raw, params, dict(request.headers)):
        return JSONResponse(obank.callback_ack(False), status_code=400)
    info = obank.parse_callback(params)
    res = await db.execute(select(ShopOrder).where(ShopOrder.order_id == str(info.get("ref") or "")))
    order = res.scalar_one_or_none()
    is_rest = False
    if not order:
        base_id, is_rest = deposit_rules.parse_ref(info.get("ref"))
        if is_rest:
            res = await db.execute(select(ShopOrder).where(ShopOrder.order_id == base_id))
            order = res.scalar_one_or_none()
    if not order:
        logger.warning(f"shop callback: заказ {info.get('ref')} не найден")
        return JSONResponse(obank.callback_ack(False), status_code=404)

    if is_rest:
        await _log(db, order, "rest_callback", {"info": info}, _client_ip(request))
        if info.get("success"):
            await _check_rest(db, order, by="obank_callback", ref=info.get("ref"))
        return JSONResponse(obank.callback_ack(True))

    order.obank_status = info.get("status")
    await db.commit()
    await _log(db, order, "callback", {"info": info}, _client_ip(request))

    if info.get("status") == "2" and not order.paid:
        order.status = "cancelled"
        await db.commit()
    elif info.get("success"):
        # не верим телу колбэка вслепую — статус перепроверяется в O!Деньги
        await _check_and_confirm(db, order, by="obank_callback", raw=params)
    return JSONResponse(obank.callback_ack(True))


# ── 1С ───────────────────────────────────────────────────────────────────────

@router_1c_shop.get("/pending")
async def pending_for_1c(_=Depends(_verify_1c_key), limit: int = 20, db: AsyncSession = Depends(get_db)):
    """Оплаченные заказы, по которым 1С ещё не создала документы."""
    res = await db.execute(
        select(ShopOrder)
        .where(and_(ShopOrder.paid == True, ShopOrder.status == "paid"))  # noqa: E712
        .order_by(ShopOrder.paid_at.asc())
        .limit(min(limit, 100))
    )
    orders = res.scalars().all()
    return {"ok": True, "count": len(orders), "orders": [o.to_1c_dict() for o in orders]}


async def _get_order(db: AsyncSession, order_id: str) -> ShopOrder:
    res = await db.execute(select(ShopOrder).where(ShopOrder.order_id == order_id))
    order = res.scalar_one_or_none()
    if not order:
        raise HTTPException(404, "заказ не найден")
    return order


def _create_rest_invoice(order: ShopOrder) -> None:
    """Ссылка O!Деньги на остаток после заклада («-R», перевыпуск — «-R2»…). Номер order.rest_ref уже выбран."""
    data = {
        "order_id": order.rest_ref,
        "desc": f"Остаток по заказу {order.order_id} — Smart Centr"[:1000],
        "amount": obank._to_kopecks(order.rest_amount()),
        "currency": "KGS",
        "test": int(_cfg("obank_test", "0") or "0"),
        "long_term": 0,
        "send_push": 0,
        "send_sms": 0,
        # товар уже в дороге: ссылка живёт неделю (повторное «Таксига юкландим» шлёт её же, новую не делает)
        "date_life": (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d %H:%M:%S"),
        "result_url": _shop_callback_url(),
    }
    answer = obank._request("createInvoice", data)
    url = answer.get(_cfg("obank_link_field", "paylink_url")) or answer.get("paylink_url") or answer.get("site_pay") or answer.get("qr") or ""
    if not url:
        raise ValueError(f"createInvoice без ссылки: {answer}")
    order.rest_invoice_id = str(answer.get("invoice_id") or "")
    order.rest_pay_url = url
    order.rest_link_at = datetime.utcnow()


async def _check_rest(db: AsyncSession, order: ShopOrder, by: str, ref: str | None = None) -> bool:
    """Перепроверка оплаты остатка у O!Деньги. Идемпотентно: строка заказа заблокирована, колбэк и опрос
    страницы одновременно не отметят оплату дважды. ref — какая ссылка оплачена (из колбэка); нет — текущая."""
    await db.refresh(order, with_for_update=True)
    if order.rest_paid and ref:
        await _rest_paid_twice(db, order, ref)
        return False
    if order.rest_paid or not order.rest_ref:
        await db.commit()
        return False
    ref = ref or order.rest_ref
    st = obank.check_status(order_id=ref, invoice_id=order.rest_invoice_id if ref == order.rest_ref else "")
    if not st.get("approved"):
        await db.commit()
        return False
    paid_amount = Decimal(str(st.get("amount") or 0))
    if paid_amount and paid_amount + Decimal("1") < Decimal(str(order.rest_amount())):
        told = (order.note or "").startswith("⚠ остаток: оплачено")
        order.note = f"⚠ остаток: оплачено {paid_amount} меньше {order.rest_amount()}"
        await db.commit()
        await _log(db, order, "rest_amount_mismatch", {"paid": float(paid_amount)})
        if told:  # страницу заказа открывают много раз — владельцу пишем один раз
            return False
        try:
            wa.send_text(_admin_phone(), f"⚠ Заказ {order.order_id}: по ссылке на остаток пришло {_money(paid_amount)} "
                                         f"вместо {_money(order.rest_amount())}. Проверьте в O!Деньги.")
        except Exception as error:
            logger.warning(f"shop: тревога о недоплате не ушла {order.order_id}: {error}")
        return False
    order.rest_paid = True
    order.rest_paid_at = datetime.utcnow()
    order.rest_trans_id = str(st.get("trans_id") or ref)[:64]
    cancelled = order.status == "cancelled"
    if cancelled:
        order.note = "⚠ остаток оплачен по ОТМЕНЁННОМУ заказу — верните деньги или восстановите заказ"
    await db.commit()
    if cancelled:
        try:
            wa.send_text(_admin_phone(), f"⚠ Заказ {order.order_id} отменён, а покупатель оплатил остаток "
                                         f"{_money(order.rest_amount())}. Верните деньги или восстановите заказ.")
        except Exception as error:
            logger.warning(f"shop: тревога об оплате после отмены не ушла {order.order_id}: {error}")
    await _log(db, order, "rest_paid", {"by": by, "trans_id": order.rest_trans_id})
    await _push(db, order, "Заказ оплачен", deposit_rules.rest_paid_text("ru", order.order_id))
    try:
        wa.send_text(order.customer_phone, deposit_rules.rest_paid_text(order.lang, order.order_id))
        wa.send_text(_admin_phone(), f"💵 Остаток {_money(order.rest_amount())} по заказу {order.order_id} "
                                     f"({order.customer_name}) оплачен. 1С проведёт второй ПКО сама.")
    except Exception as error:
        logger.warning(f"shop: сообщение об остатке не ушло {order.order_id}: {error}")
    return True


async def _rest_paid_twice(db: AsyncSession, order: ShopOrder, ref: str) -> None:
    """Остаток уже засчитан (по ссылке или наличными), а пришла ещё оплата: старая ссылка, наличные водителю
    и ссылка из WhatsApp. Владельцу — вернуть деньги, один раз на платёж. Строка заказа уже заблокирована."""
    st = obank.check_status(order_id=ref, invoice_id=order.rest_invoice_id if ref == order.rest_ref else "")
    key = str(st.get("trans_id") or ref)[:64]
    if not st.get("approved") or key == order.rest_trans_id or key in (order.note or ""):
        await db.commit()
        return
    amount = Decimal(str(st.get("amount") or order.rest_amount()))
    order.note = f"⚠ остаток оплачен ВТОРОЙ раз ({key}) — верните {amount}"
    await db.commit()
    await _log(db, order, "rest_paid_twice", {"ref": ref, "key": key, "amount": float(amount)})
    try:
        wa.send_text(_admin_phone(), f"⚠ Заказ {order.order_id}: остаток уже был оплачен, а пришла ещё оплата "
                                     f"{_money(amount)} ({ref}). Верните покупателю {order.customer_phone}.")
    except Exception as error:
        logger.warning(f"shop: тревога о двойной оплате не ушла {order.order_id}: {error}")


class TaxiInfo(BaseModel):
    car: str = ""
    driver_phone: str = ""


class RestDone(BaseModel):
    pko_number_1c: str = ""


def _deposit_row(o: ShopOrder) -> dict:
    return {
        "order_id": o.order_id,
        "order_number_1c": o.order_number_1c or "",
        "customer_name": o.customer_name,
        "customer_phone": o.customer_phone,
        "city": (o.delivery or {}).get("city", ""),
        "goods": "; ".join(f"{l.get('name')} × {l.get('qty')}" for l in (o.lines or []))[:300],
        "full_amount": float(o.full_amount()),
        "deposit": float(o.deposit or 0),
        "rest_amount": float(o.rest_amount()),
        "paid_at": o.paid_at.isoformat() if o.paid_at else None,
        "taxi": o.taxi or None,
        "shipped_at": o.shipped_at.isoformat() if o.shipped_at else None,
        "rest_paid": bool(o.rest_paid),
        "rest_paid_at": o.rest_paid_at.isoformat() if o.rest_paid_at else None,
        "rest_trans_id": o.rest_trans_id or "",
    }


@router_1c_shop.get("/deposits")
async def deposits_for_1c(_=Depends(_verify_1c_key), db: AsyncSession = Depends(get_db)):
    """Заказы с закладом, остаток по которым ещё не оплачен: их грузят в такси (кнопка в 1С)."""
    res = await db.execute(
        select(ShopOrder)
        .where(and_(ShopOrder.deposit.isnot(None), ShopOrder.paid == True,  # noqa: E712
                    ShopOrder.rest_paid != True, ShopOrder.status != "cancelled"))  # noqa: E712
        .order_by(ShopOrder.paid_at.desc())
        .limit(100)
    )
    return {"ok": True, "orders": [_deposit_row(o) for o in res.scalars().all()]}


@router_1c_shop.get("/rest-pending")
async def rest_pending_for_1c(_=Depends(_verify_1c_key), db: AsyncSession = Depends(get_db)):
    """Остаток оплачен, а второго ПКО в 1С ещё нет."""
    res = await db.execute(
        select(ShopOrder)
        .where(and_(ShopOrder.rest_paid == True, ShopOrder.rest_pko_1c.is_(None),  # noqa: E712
                    ShopOrder.order_number_1c.isnot(None), ShopOrder.order_number_1c != "",
                    ShopOrder.status.in_(("in_1c", "cancelled"))))
        .order_by(ShopOrder.rest_paid_at.asc())
        .limit(100)
    )
    return {"ok": True, "orders": [_deposit_row(o) for o in res.scalars().all()]}


@router_1c_shop.post("/{order_id}/taxi")
async def order_taxi(order_id: str, request: Request, db: AsyncSession = Depends(get_db)):
    """Сотрудник погрузил товар в такси: вторая ссылка на остаток и сообщение покупателю с машиной и водителем."""
    body = await _verify_1c_body(request)
    payload = TaxiInfo.parse_raw(body)
    return await ship_by_taxi(db, order_id, payload.car, payload.driver_phone)


async def find_deposit_order(db: AsyncSession, code: str) -> str | None:
    """Конец номера заказа (5 знаков, из WhatsApp-команды владельца) → номер заказа с закладом."""
    res = await db.execute(
        select(ShopOrder.order_id)
        .where(and_(ShopOrder.order_id.like(f"SC-%-{code.upper()}"), ShopOrder.deposit.isnot(None)))
        .order_by(ShopOrder.created_at.desc()).limit(2)
    )
    found = [row[0] for row in res.all()]
    return found[0] if len(found) == 1 else None


async def taxi_waiting(db: AsyncSession) -> list[ShopOrder]:
    """
    К кому может относиться «такси …» без номера заказа: заклад оплачен, остаток нет, не отменён, и такси ещё не
    отправляли или отправили за последние сутки (владелец поправляет машину). Один такой — он; больше — спросить.
    """
    res = await db.execute(
        select(ShopOrder)
        .where(and_(ShopOrder.deposit.isnot(None), ShopOrder.paid == True,  # noqa: E712
                    ShopOrder.rest_paid != True, ShopOrder.status != "cancelled",  # noqa: E712
                    or_(ShopOrder.shipped_at.is_(None), ShopOrder.shipped_at > datetime.utcnow() - timedelta(days=1))))
        .order_by(ShopOrder.paid_at)
    )
    return list(res.scalars().all())


async def ship_by_taxi(db: AsyncSession, order_id: str, car: str, driver_phone: str) -> dict:
    """Одна логика для кнопки 1С и для команды «такси …» владельца в WhatsApp (shop_wa_bot)."""
    res = await db.execute(select(ShopOrder).where(ShopOrder.order_id == order_id).with_for_update())
    order = res.scalar_one_or_none()
    if not order:
        raise HTTPException(404, "заказ не найден")
    if not order.deposit or not order.paid:
        raise HTTPException(status.HTTP_409_CONFLICT, "у заказа нет оплаченного заклада")
    if order.status == "cancelled":
        raise HTTPException(status.HTTP_409_CONFLICT, "заказ отменён")
    if order.rest_paid:
        raise HTTPException(status.HTTP_409_CONFLICT, "остаток уже оплачен")
    try:
        taxi = deposit_rules.clean_taxi(car, driver_phone)
    except ValueError as error:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(error))
    # ссылка живёт 7 дней: нет или вот-вот истечёт — новая, с новым номером (-R2…)
    stale = order.rest_link_at is None or datetime.utcnow() - order.rest_link_at > timedelta(days=6, hours=23)
    if order.rest_ref and order.rest_pay_url and stale:
        # Старую ссылку могли оплатить, а колбэк потеряться: тогда новая — вторая оплата. Сначала спрашиваем.
        old = obank.check_status(order_id=order.rest_ref, invoice_id=order.rest_invoice_id or "")
        if old.get("approved"):
            await db.commit()
            await _check_rest(db, order, "taxi")
            raise HTTPException(status.HTTP_409_CONFLICT, "по прежней ссылке остаток уже оплачен — новую не выпускаем, "
                                                          "проверьте заказ")
    if not order.rest_pay_url or stale:
        # Новый номер ссылки. Строка заказа заблокирована до конца запроса: второе нажатие (двойной щелчок, два
        # сотрудника) ждёт и шлёт ту же ссылку, а не выпускает вторую — иначе покупатель мог оплатить обе.
        order.rest_ref = deposit_rules.next_rest_ref(order.order_id, order.rest_ref)
        try:
            _create_rest_invoice(order)
        except Exception as error:
            logger.error(f"shop rest invoice failed {order.order_id}: {error}")
            # номер сохраняем и при ошибке: запрос оборвался, а счёт у O!Деньги мог создаться — повтор возьмёт следующий
            await db.commit()
            raise HTTPException(status.HTTP_502_BAD_GATEWAY, "O!Деньги недоступны — ссылка на остаток не создана, нажмите ещё раз")
    # «отгружен» — только когда ссылка есть: иначе повтор команды «такси» без номера заказа его уже не найдёт
    order.taxi = taxi
    order.shipped_at = datetime.utcnow()
    await db.commit()
    await _log(db, order, "taxi", {"taxi": taxi, "rest_invoice_id": order.rest_invoice_id})
    sent = True
    try:
        wa.send_text(order.customer_phone, deposit_rules.taxi_text(order.lang, order.order_id, taxi,
                                                                  order.rest_amount(), order.rest_pay_url))
    except Exception as error:
        sent = False
        logger.warning(f"shop: сообщение о такси не ушло {order.order_id}: {error}")
    await _push(db, order, "Товар в пути", f"Заказ {order.order_id} погружен в машину {taxi['car']}.")
    return {"ok": True, "sent": sent, "rest_amount": float(order.rest_amount()), "rest_pay_url": order.rest_pay_url,
            "customer": f"{order.customer_name}, {(order.delivery or {}).get('city', '')}".strip(", ")}


class RestManual(BaseModel):
    note: str = ""


@router_1c_shop.post("/{order_id}/rest-manual")
async def order_rest_manual(order_id: str, request: Request, db: AsyncSession = Depends(get_db)):
    """Остаток получили не по ссылке (наличными) — ПКО сотрудник делает сам; ссылка больше не нужна."""
    body = await _verify_1c_body(request)
    payload = RestManual.parse_raw(body)
    res = await db.execute(select(ShopOrder).where(ShopOrder.order_id == order_id).with_for_update())
    order = res.scalar_one_or_none()
    if not order:
        raise HTTPException(404, "заказ не найден")
    if not order.deposit:
        raise HTTPException(status.HTTP_409_CONFLICT, "у заказа нет заклада")
    if order.rest_paid:
        raise HTTPException(status.HTTP_409_CONFLICT, "остаток уже отмечен оплаченным")
    order.rest_paid = True
    order.rest_paid_at = datetime.utcnow()
    order.rest_trans_id = "вручную"
    order.rest_pko_1c = "вручную"
    order.rest_pay_url = None
    await db.commit()
    await _log(db, order, "rest_manual", {"note": payload.note[:300]})
    return {"ok": True}


@router_1c_shop.post("/{order_id}/rest-done")
async def order_rest_done(order_id: str, request: Request, db: AsyncSession = Depends(get_db)):
    """1С провела второй ПКО (остаток)."""
    body = await _verify_1c_body(request)
    payload = RestDone.parse_raw(body)
    order = await _get_order(db, order_id)
    order.rest_pko_1c = (payload.pko_number_1c or "-")[:32]
    await db.commit()
    await _log(db, order, "rest_in_1c", {"pko": order.rest_pko_1c})
    return {"ok": True}


@router_1c_shop.post("/{order_id}/mark-done")
async def mark_done(order_id: str, request: Request, db: AsyncSession = Depends(get_db)):
    body = await _verify_1c_body(request)
    payload = MarkDone.parse_raw(body)
    order = await _get_order(db, order_id)
    first_time = order.status != "in_1c"
    # Товар приехал позже, и 1С дооформила отгрузку: заказ уже был «в 1С»,
    # но теперь он собран. Покупателю это надо сказать — первый раз ему писали
    # «заказ принят, товар везём», и с тех пор он ничего не слышал.
    became_shipped = bool(payload.realized) and not bool(order.realized)
    order.status = "in_1c"
    order.order_number_1c = payload.order_number_1c[:32]
    order.pko_number_1c = payload.pko_number_1c[:32]
    order.rtu_number_1c = payload.rtu_number_1c[:32]
    order.realized = payload.realized
    if payload.bonus_earned:
        order.bonus_earned = Decimal(str(payload.bonus_earned))
    order.synced_at = datetime.utcnow()
    order.note = payload.note[:1000] or order.note
    await db.commit()
    await _log(db, order, "synced", payload.dict())

    if order.deposit and (first_time or became_shipped):
        # заклад: реализация — только после оплаты остатка; товар уже уехал на такси, «ждём в магазине» — неправда
        earned = Decimal(str(order.bonus_earned or 0))
        if became_shipped:
            await _push(db, order, "Заказ оформлен", f"Заказ {order.order_id} оформлен полностью. Спасибо за покупку!"
                        + (f" Начислено бонусов: {earned:.0f}" if earned > 0 else ""))
        try:
            state = ("✅ Остаток оплачен — реализация проведена" if payload.realized else
                     f"⏳ Заклад: реализация — после оплаты остатка {_money(order.rest_amount())} "
                     f"(Панель сайта → «Заклад» → «Таксига юкландим»)")
            wa.send_text(_admin_phone(), (
                f"📦 Заказ {order.order_id} создан в 1С\n"
                f"Заказ клиента: {payload.order_number_1c}\nПКО заклада: {payload.pko_number_1c}\n"
                f"{('Реализация: ' + payload.rtu_number_1c) if payload.rtu_number_1c else ''}\n{state}"
            ))
        except Exception as error:
            logger.error(f"shop 1c notify failed {order.order_id}: {error}")
        return {"ok": True}
    if first_time or became_shipped:
        earned = Decimal(str(order.bonus_earned or 0))
        await _push(db, order,
                    "Заказ готов" if payload.realized else "Заказ принят",
                    (f"Заказ {order.order_id} собран, ждём вас в магазине."
                     if payload.realized else
                     # Покупателю — без «товара нет»: владелец привезёт или
                     # свяжется сам (см. «Оплачено — нужно действие» в Панели сайта).
                     f"Заказ {order.order_id} принят. Сотрудник свяжется с вами.")
                    + (f" Начислено бонусов: {earned:.0f}" if earned > 0 else ""))
        try:
            state = ("✅ Реализация проведена — товар списан со склада"
                     if payload.realized else "⚠ Товара нет в наличии — заказ ждёт поступления, нужно привезти")
            wa.send_text(_admin_phone(), (
                f"📦 Заказ {order.order_id} создан в 1С\n"
                f"Заказ клиента: {payload.order_number_1c}\nПКО: {payload.pko_number_1c}\n"
                f"{('Реализация: ' + payload.rtu_number_1c) if payload.rtu_number_1c else ''}\n{state}"
            ))
        except Exception as error:
            logger.error(f"shop 1c notify failed {order.order_id}: {error}")
    return {"ok": True}


@router_1c_shop.get("/awaiting-shipment")
async def awaiting_shipment(_=Depends(_verify_1c_key), db: AsyncSession = Depends(get_db)):
    """
    Оплаченные заказы, которые уже в 1С, но ещё не отгружены (товара не было).

    1С проверяет каждый: товар пришёл — делает реализацию; реализацию сделали
    руками — сообщает об этом; заказ закрыли (вернули деньги) — отменяет.
    Список берётся отсюда, а не из комментариев в 1С: иначе старые заказы
    заслоняли новые, и новые не отгружались никогда.
    """
    res = await db.execute(
        select(ShopOrder)
        .where(and_(ShopOrder.paid == True, ShopOrder.status == "in_1c", ShopOrder.realized != True))  # noqa: E712
        .order_by(ShopOrder.paid_at.asc())
        .limit(100)
    )
    orders = res.scalars().all()
    return {"ok": True, "count": len(orders), "orders": [
        {"order_id": o.order_id, "customer_phone": o.customer_phone,
         # заклад без оплаченного остатка: реализацию и бонус не делать, только следить, не закрыли ли заказ
         # реализация — когда остаток оплачен И второй ПКО уже в 1С (иначе реализация раньше ПКО)
         "deposit_waiting": bool(o.deposit) and not (bool(o.rest_paid) and bool(o.rest_pko_1c))} for o in orders
    ]}


@router_1c_shop.post("/{order_id}/mark-cancelled")
async def mark_cancelled(order_id: str, request: Request, db: AsyncSession = Depends(get_db)):
    """Заказ закрыли в 1С без отгрузки — деньги вернули или заказ отменили."""
    body = await _verify_1c_body(request)
    payload = MarkFailed.parse_raw(body)
    order = await _get_order(db, order_id)
    if order.status == "cancelled":
        return {"ok": True, "already": True}
    if order.realized:
        raise HTTPException(status.HTTP_409_CONFLICT, "заказ уже отгружен — отменять нечего")
    order.status = "cancelled"
    order.note = (payload.note or "Закрыт в 1С без отгрузки")[:1000]
    await db.commit()
    await _log(db, order, "cancelled_in_1c", {"note": order.note})
    return {"ok": True}


@router_1c_shop.post("/{order_id}/mark-failed")
async def mark_failed(order_id: str, request: Request, db: AsyncSession = Depends(get_db)):
    body = await _verify_1c_body(request)
    payload = MarkFailed.parse_raw(body)
    order = await _get_order(db, order_id)
    order.sync_attempts = (order.sync_attempts or 0) + 1
    order.note = payload.note[:1000]
    if order.sync_attempts >= MAX_SYNC_ATTEMPTS:
        order.status = "failed"
        try:
            wa.send_text(_admin_phone(), (
                f"❗ Заказ {order.order_id} ОПЛАЧЕН, но 1С не смогла создать документы.\n"
                f"Ошибка: {payload.note[:500]}\nСоздайте заказ вручную."
            ))
        except Exception as error:
            logger.error(f"shop fail notify failed {order.order_id}: {error}")
    await db.commit()
    await _log(db, order, "sync_failed", {"note": payload.note, "attempts": order.sync_attempts})
    return {"ok": True, "attempts": order.sync_attempts}
