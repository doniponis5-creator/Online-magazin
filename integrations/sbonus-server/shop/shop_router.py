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
    short = shortages([l.dict() for l in payload.lines], await catalog_items(db), await taken_now(db))
    if short:
        raise HTTPException(status.HTTP_409_CONFLICT, {"code": "out-of-stock", "items": short})

    bonus = Decimal(payload.bonus)
    if bonus > 0:
        from .shop_customers import _customer, _account, max_spend, max_spend_pct
        customer = await _customer(db, payload.customer.phone)
        if not customer or not customer.is_active:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "бонусы: клиент не найден в SBonus")
        account = await _account(db, customer)
        allowed = max_spend(Decimal(str(account.balance or 0)), Decimal(str(payload.total)), await max_spend_pct(db))
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
    db.add(order)
    await db.commit()
    await _log(db, order, "created", {"total": payload.total, "bonus": payload.bonus}, _client_ip(request))

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

    return {"order_id": order.order_id, "token": order.token, "pay_url": order.pay_url}


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

    order.paid = True
    order.paid_at = datetime.utcnow()
    order.status = "paid"
    order.obank_trans_id = st.get("trans_id") or order.obank_trans_id
    if raw is not None:
        order.obank_raw = raw
    await db.commit()
    await _log(db, order, "paid", {"by": by, "trans_id": order.obank_trans_id})

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
    try:
        from .shop_whatsapp import send_with_button
        send_with_button(
            order.customer_phone,
            (
                f"Здравствуйте, {order.customer_name.split()[0]}!\n"
                f"Оплата заказа {order.order_id} получена ✅\n💵 {money}\n\n"
                f"{lines}\n{how}\n\n"
                f"Сотрудник Smart Centr свяжется с вами."
            ),
            "Статус заказа",
            order_url,
        )
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
    res = await db.execute(select(ShopOrder).where(ShopOrder.order_id == info.get("ref")))
    order = res.scalar_one_or_none()
    if not order:
        logger.warning(f"shop callback: заказ {info.get('ref')} не найден")
        return JSONResponse(obank.callback_ack(False), status_code=404)

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

    if first_time or became_shipped:
        earned = Decimal(str(order.bonus_earned or 0))
        await _push(db, order,
                    "Заказ готов" if payload.realized else "Заказ принят",
                    (f"Заказ {order.order_id} собран, ждём вас в магазине."
                     if payload.realized else
                     f"Заказ {order.order_id} принят, товар везём на склад.")
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
