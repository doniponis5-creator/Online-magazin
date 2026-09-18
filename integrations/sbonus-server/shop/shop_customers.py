"""
Интернет-магазин Smart Centr — вход покупателя на сайт и бонусы SBonus.

Вход: телефон → пароль (если покупатель его задал) или 4-значный код.
Код идёт сначала в Telegram (дешевле, мгновенно, без риска блокировки номера),
и только если Telegram на этом номере нет — в WhatsApp.
Пароль необязателен и хранится отдельно (таблица shop_passwords); ключ клиента — телефон.
Новый номер → сайт спрашивает имя → клиент создаётся в SBonus + приветственный бонус сайта
(только тем, кого ещё не было в SBonus; один раз на телефон — уникальный receipt_number).

Эндпоинты (все под /api/v1, подпись HMAC сайта — секрет SHOP_SITE_SECRET):
  POST /webhook/site/customer/start        {phone, ip}          есть ли у номера пароль
  POST /webhook/site/customer/login        {phone, password, ip} вход по паролю → профиль
  POST /webhook/site/customer/send-code    {phone, ip}          отправить код → channel
  POST /webhook/site/customer/verify       {phone, code, ip}    проверить код → профиль или needName+ticket
  POST /webhook/site/customer/register     {ticket, name}       создать клиента + приветственный бонус
  POST /webhook/site/customer/set-password {pwTicket, password} задать или сменить пароль
  POST /webhook/site/customer/drop-password {pwTicket}          убрать пароль (вернуться к входу по коду)
  GET  /webhook/site/customer/{996XXXXXXXXX}?amount=&full=1    профиль, баланс, максимум списания, история

Настройки (таблица settings SBonus, меняются без перезапуска):
  SITE_WELCOME_BONUS_AMOUNT  — приветственный бонус сайта, сом (по умолчанию 1000)
  SITE_BONUS_MAX_PCT         — какую часть заказа на сайте можно оплатить бонусами, % (по умолчанию 10)
"""
from __future__ import annotations

import asyncio
import hashlib
import hmac
import logging
import re
import secrets
import uuid
from decimal import Decimal, ROUND_FLOOR

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.redis import check_rate_limit, redis_client
from app.core.security import hash_password, verify_password
from app.models import BonusAccount, Customer, Setting, Tier, Transaction, TransactionType
from app.payments import payments_greenapi as wa  # type: ignore

from . import shop_telegram as tg
from .shop_models import ShopOrder, ShopPassword
from .shop_router import _money, _site_secret, _verify_site_body, _verify_site_path

logger = logging.getLogger("sbonus.shop.customer")

router_site_customer = APIRouter(prefix="/webhook/site/customer", tags=["Сайт: покупатель и бонусы"])

CODE_TTL = 300          # код действует 5 минут
TICKET_TTL = 900        # 15 минут, чтобы ввести имя
MAX_ATTEMPTS = 5
PW_TICKET_TTL = 900     # 15 минут, чтобы задать пароль после входа по коду
MIN_PASSWORD = 6
MAX_PASSWORD = 72       # предел bcrypt: всё, что длиннее, молча обрезается
DEFAULT_WELCOME = Decimal("1000")
DEFAULT_MAX_PCT = Decimal("10")
PHONE_RE = re.compile(r"\+996\d{9}")


# ── Настройки ────────────────────────────────────────────────────────────────

async def _setting(db: AsyncSession, key: str, default: Decimal) -> Decimal:
    row = (await db.execute(select(Setting).where(Setting.key == key))).scalar_one_or_none()
    try:
        return Decimal(str(row.value).strip()) if row and row.value not in (None, "") else default
    except Exception:
        return default


async def welcome_amount(db: AsyncSession) -> Decimal:
    return max(Decimal("0"), await _setting(db, "SITE_WELCOME_BONUS_AMOUNT", DEFAULT_WELCOME))


async def max_spend_pct(db: AsyncSession) -> Decimal:
    return min(Decimal("100"), max(Decimal("0"), await _setting(db, "SITE_BONUS_MAX_PCT", DEFAULT_MAX_PCT)))


async def branch_id(db: AsyncSession):
    """Филиал для операций сайта: SHOP_BRANCH_ID из settings, иначе первый активный («Смарт Центр»)."""
    from app.models import Branch
    row = (await db.execute(select(Setting).where(Setting.key == "SHOP_BRANCH_ID"))).scalar_one_or_none()
    if row and row.value:
        try:
            return uuid.UUID(row.value.strip())
        except ValueError:
            pass
    br = (await db.execute(select(Branch).where(Branch.is_active == True).limit(1))).scalar_one_or_none()  # noqa: E712
    return br.id if br else None


def max_spend(balance: Decimal, amount: Decimal, pct: Decimal) -> int:
    """Сколько бонусов можно списать: не больше баланса и не больше pct% суммы, целые сомы."""
    if balance <= 0 or amount <= 0 or pct <= 0:
        return 0
    limit = min(balance, amount * pct / Decimal("100"))
    return int(limit.to_integral_value(rounding=ROUND_FLOOR))


# ── Вспомогательное ─────────────────────────────────────────────────────────

def _code_hash(phone: str, code: str) -> str:
    return hmac.new(_site_secret().encode(), f"{phone}:{code}".encode(), hashlib.sha256).hexdigest()


def _phone(value: str) -> str:
    value = (value or "").strip()
    if not PHONE_RE.fullmatch(value):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "телефон должен быть +996XXXXXXXXX")
    return value


def _password(value: str) -> str:
    value = (value or "").strip()
    if not (MIN_PASSWORD <= len(value.encode()) <= MAX_PASSWORD):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"Пароль — от {MIN_PASSWORD} до {MAX_PASSWORD} символов",
        )
    return value


async def _pw_row(db: AsyncSession, phone: str) -> ShopPassword | None:
    return (await db.execute(select(ShopPassword).where(ShopPassword.phone == phone))).scalar_one_or_none()


async def _pw_ticket(phone: str) -> str:
    """Короткий пропуск: номер только что подтверждён кодом, можно задать или убрать пароль."""
    ticket = secrets.token_urlsafe(24)
    await redis_client.setex(f"shop_pwt:{ticket}", PW_TICKET_TTL, phone)
    return ticket


async def _phone_by_ticket(ticket: str) -> str:
    phone = await redis_client.get(f"shop_pwt:{(ticket or '')[:120]}")
    if isinstance(phone, bytes):
        phone = phone.decode()
    if not phone:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Время вышло. Войдите заново.")
    await redis_client.delete(f"shop_pwt:{ticket}")
    return phone


async def _send_wa(phone: str, text: str) -> bool:
    """True — WhatsApp принял сообщение. Ошибку не поднимаем: решает вызывающий."""
    try:
        await asyncio.to_thread(wa.send_text, phone, text)
        return True
    except Exception as error:
        logger.error(f"site customer WhatsApp failed ...{phone[-4:]}: {error}")
        return False


async def _customer(db: AsyncSession, phone: str) -> Customer | None:
    return (await db.execute(select(Customer).where(Customer.phone == phone))).scalar_one_or_none()


async def _account(db: AsyncSession, customer: Customer, lock: bool = False) -> BonusAccount:
    query = select(BonusAccount).where(BonusAccount.customer_id == customer.id)
    if lock:
        query = query.with_for_update()
    account = (await db.execute(query)).scalar_one_or_none()
    if not account:
        account = BonusAccount(customer_id=customer.id)
        db.add(account)
        await db.flush()
    return account


async def profile(db: AsyncSession, customer: Customer, amount: Decimal = Decimal("0"), full: bool = False) -> dict:
    account = await _account(db, customer)
    tier = (await db.execute(select(Tier).where(Tier.id == customer.tier_id))).scalar_one_or_none() if customer.tier_id else None
    pct = await max_spend_pct(db)
    balance = Decimal(str(account.balance or 0))
    data = {
        "hasPassword": bool(await _pw_row(db, customer.phone)),
        "phone": customer.phone,
        "name": customer.full_name,
        "balance": float(balance),
        "tier": tier.name if tier else "Bronze",
        "tierPercent": float(tier.bonus_percent) if tier else 1.0,
        "maxSpendPct": float(pct),
        "maxSpend": max_spend(balance, amount, pct),
    }
    if full:
        txns = (await db.execute(
            select(Transaction).where(Transaction.customer_id == customer.id)
            .order_by(desc(Transaction.created_at)).limit(30)
        )).scalars().all()
        data["history"] = [{
            "type": t.type.value if hasattr(t.type, "value") else str(t.type),
            "amount": float(t.amount),
            "note": t.note or "",
            "date": t.created_at.isoformat() if t.created_at else None,
        } for t in txns]
        orders = (await db.execute(
            select(ShopOrder).where(ShopOrder.customer_phone == customer.phone)
            .order_by(desc(ShopOrder.created_at)).limit(30)
        )).scalars().all()
        data["orders"] = [{
            "orderId": o.order_id,
            "token": o.token,
            "status": o.status,
            "total": float(o.total),
            "payAmount": float(o.pay_amount if o.pay_amount is not None else o.total),
            "bonusSpent": float(o.bonus_spent or o.bonus_spend or 0),
            "createdAt": o.created_at.isoformat() if o.created_at else None,
        } for o in orders]
    return data


# ── Модели запросов ─────────────────────────────────────────────────────────

class SendCode(BaseModel):
    phone: str
    ip: str = ""


class VerifyCode(BaseModel):
    phone: str
    code: str
    ip: str = ""


class Register(BaseModel):
    ticket: str
    name: str


class Start(BaseModel):
    phone: str
    ip: str = ""


class LoginPassword(BaseModel):
    phone: str
    password: str
    ip: str = ""


class SetPassword(BaseModel):
    pwTicket: str
    password: str


class DropPassword(BaseModel):
    pwTicket: str


# ── Эндпоинты ───────────────────────────────────────────────────────────────

@router_site_customer.post("/send-code")
async def send_code(request: Request, db: AsyncSession = Depends(get_db)):
    payload = SendCode.parse_raw(await _verify_site_body(request))
    phone = _phone(payload.phone)
    ip = (payload.ip or "")[:45]
    if not await check_rate_limit(f"shop_code:{phone}", max_attempts=3, window_seconds=600):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Слишком много запросов. Подождите 10 минут.")
    if ip and not await check_rate_limit(f"shop_code_ip:{ip}", max_attempts=15, window_seconds=3600):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Слишком много запросов. Попробуйте позже.")

    code = f"{secrets.randbelow(9000) + 1000}"
    await redis_client.setex(f"shop_otp:{phone}", CODE_TTL, _code_hash(phone, code))
    await redis_client.delete(f"shop_otp_attempts:{phone}")

    # Сначала Telegram (дешевле и без риска блокировки), иначе WhatsApp
    if await tg.send_code(phone, code, CODE_TTL):
        return {"ok": True, "channel": "telegram"}
    sent = await _send_wa(phone, (
        f"*{code}* — код для входа на сайт Smart Centr\n\n"
        f"⏱ Код действует 5 минут.\n⚠️ Никому не сообщайте код."
    ))
    if not sent:
        # Раньше сайт писал «код отправлен», даже когда он никуда не ушёл,
        # и покупатель ждал впустую. Теперь говорим правду.
        await redis_client.delete(f"shop_otp:{phone}")
        logger.error(f"site code not delivered ...{phone[-4:]}")
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Не удалось отправить код. Попробуйте через минуту.")
    return {"ok": True, "channel": "whatsapp"}


@router_site_customer.post("/verify")
async def verify_code(request: Request, db: AsyncSession = Depends(get_db)):
    payload = VerifyCode.parse_raw(await _verify_site_body(request))
    phone = _phone(payload.phone)
    code = (payload.code or "").strip()
    if not re.fullmatch(r"\d{4}", code):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Код — 4 цифры")

    attempts_key = f"shop_otp_attempts:{phone}"
    attempts = await redis_client.incr(attempts_key)
    if attempts == 1:
        await redis_client.expire(attempts_key, CODE_TTL)
    if attempts > MAX_ATTEMPTS:
        await redis_client.delete(f"shop_otp:{phone}")
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Слишком много попыток. Запросите новый код.")

    stored = await redis_client.get(f"shop_otp:{phone}")
    if isinstance(stored, bytes):
        stored = stored.decode()
    if not stored:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Код истёк. Запросите новый.")
    if not hmac.compare_digest(stored, _code_hash(phone, code)):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, f"Неверный код. Осталось попыток: {MAX_ATTEMPTS - attempts}")

    await redis_client.delete(f"shop_otp:{phone}")
    await redis_client.delete(attempts_key)

    customer = await _customer(db, phone)
    if customer:
        if not customer.is_active:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Номер заблокирован. Обратитесь в магазин.")
        # pwTicket: сайт сразу предложит задать пароль, чтобы в следующий раз обойтись без кода
        return {
            "ok": True,
            "needName": False,
            "customer": await profile(db, customer),
            "pwTicket": await _pw_ticket(phone),
        }

    ticket = secrets.token_urlsafe(24)
    await redis_client.setex(f"shop_reg:{ticket}", TICKET_TTL, phone)
    return {"ok": True, "needName": True, "ticket": ticket, "welcomeBonus": float(await welcome_amount(db))}


@router_site_customer.post("/register")
async def register(request: Request, db: AsyncSession = Depends(get_db)):
    payload = Register.parse_raw(await _verify_site_body(request))
    name = " ".join((payload.name or "").split())
    if not (2 <= len(name) <= 100):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Укажите имя (от 2 до 100 букв)")
    key = f"shop_reg:{payload.ticket}"
    phone = await redis_client.get(key)
    if isinstance(phone, bytes):
        phone = phone.decode()
    if not phone:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Время вышло. Войдите заново.")
    await redis_client.delete(key)

    customer = await _customer(db, phone)
    if customer:  # успел зарегистрироваться в магазине — приветственный бонус сайта не положен
        return {"ok": True, "customer": await profile(db, customer), "welcomeBonus": 0,
                "pwTicket": await _pw_ticket(phone)}

    tier = (await db.execute(select(Tier).order_by(Tier.sort_order.asc()).limit(1))).scalar_one_or_none()
    customer = Customer(
        phone=phone,
        full_name=name,
        qr_code=f"SB-{uuid.uuid4().hex[:10].upper()}",
        tier_id=tier.id if tier else None,
        referral_code=f"REF-{uuid.uuid4().hex[:8].upper()}",
    )
    db.add(customer)
    await db.flush()
    account = BonusAccount(customer_id=customer.id)
    db.add(account)
    await db.flush()

    bonus = await welcome_amount(db)
    if bonus > 0:
        account.balance += bonus
        account.total_earned += bonus
        db.add(Transaction(
            customer_id=customer.id,
            type=TransactionType.PROMO,
            amount=bonus,
            branch_id=await branch_id(db),
            receipt_number=f"WELCOME-SITE-{phone}",   # уникальный индекс: второй раз не начислится
            note="🎁 Приветственный бонус за регистрацию на сайте",
        ))
    await db.commit()
    logger.info(f"site register ...{phone[-4:]} welcome={bonus}")

    await _send_wa(phone, (
        f"Добро пожаловать в Smart Centr, {name.split()[0]}! 🎉\n\n"
        + (f"🎁 Вам начислено *{_money(bonus)}* приветственных бонусов.\n"
           f"Оплачивайте ими часть покупки на сайте.\n" if bonus > 0 else "")
    ))
    return {"ok": True, "customer": await profile(db, customer), "welcomeBonus": float(bonus),
            "pwTicket": await _pw_ticket(phone)}


@router_site_customer.post("/start")
async def start(request: Request, db: AsyncSession = Depends(get_db)):
    """
    Первый шаг входа: задан ли у номера пароль.

    Есть пароль → сайт покажет поле пароля и код в WhatsApp НЕ отправляется.
    Нет пароля → сайт отправит код, как раньше.
    """
    payload = Start.parse_raw(await _verify_site_body(request))
    phone = _phone(payload.phone)
    ip = (payload.ip or "")[:45]
    if ip and not await check_rate_limit(f"shop_start_ip:{ip}", max_attempts=60, window_seconds=3600):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Слишком много запросов. Попробуйте позже.")
    customer = await _customer(db, phone)
    has_password = bool(customer and customer.is_active and await _pw_row(db, phone))
    return {"ok": True, "hasPassword": has_password}


@router_site_customer.post("/login")
async def login_password(request: Request, db: AsyncSession = Depends(get_db)):
    """Вход по телефону и паролю — без кода в WhatsApp."""
    payload = LoginPassword.parse_raw(await _verify_site_body(request))
    phone = _phone(payload.phone)
    ip = (payload.ip or "")[:45]
    if not await check_rate_limit(f"shop_pw_try:{phone}", max_attempts=10, window_seconds=900):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS,
                            "Слишком много попыток. Войдите по коду из WhatsApp.")
    if ip and not await check_rate_limit(f"shop_pw_ip:{ip}", max_attempts=30, window_seconds=3600):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Слишком много попыток. Попробуйте позже.")

    customer = await _customer(db, phone)
    row = await _pw_row(db, phone) if customer else None
    # Один и тот же текст на «нет такого номера» и «пароль не тот»: номера не перебрать.
    if not customer or not customer.is_active or not row:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Неверный номер или пароль")
    if not await asyncio.to_thread(verify_password, payload.password or "", row.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Неверный номер или пароль")

    logger.info(f"site login by password ...{phone[-4:]}")
    return {"ok": True, "needName": False, "customer": await profile(db, customer)}


@router_site_customer.post("/set-password")
async def set_password(request: Request, db: AsyncSession = Depends(get_db)):
    """Задать или сменить пароль. pwTicket выдаётся после входа по коду — он и есть подтверждение номера."""
    payload = SetPassword.parse_raw(await _verify_site_body(request))
    password = _password(payload.password)
    phone = await _phone_by_ticket(payload.pwTicket)
    customer = await _customer(db, phone)
    if not customer:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "клиент не найден")

    hashed = await asyncio.to_thread(hash_password, password)
    row = await _pw_row(db, phone)
    if row:
        row.password_hash = hashed
    else:
        db.add(ShopPassword(phone=phone, password_hash=hashed))
    await db.commit()
    await redis_client.delete(f"rate:shop_pw_try:{phone}")   # снять счётчик неудачных попыток
    logger.info(f"site password set ...{phone[-4:]}")
    return {"ok": True, "hasPassword": True}


@router_site_customer.post("/drop-password")
async def drop_password(request: Request, db: AsyncSession = Depends(get_db)):
    """Убрать пароль — покупатель снова входит по коду из WhatsApp."""
    payload = DropPassword.parse_raw(await _verify_site_body(request))
    phone = await _phone_by_ticket(payload.pwTicket)
    row = await _pw_row(db, phone)
    if row:
        await db.delete(row)
        await db.commit()
    logger.info(f"site password dropped ...{phone[-4:]}")
    return {"ok": True, "hasPassword": False}


@router_site_customer.get("/{digits}")
async def get_profile(digits: str, request: Request, amount: float = 0, full: int = 0, db: AsyncSession = Depends(get_db)):
    _verify_site_path(request)
    customer = await _customer(db, _phone("+" + digits))
    if not customer or not customer.is_active:
        raise HTTPException(404, "клиент не найден")
    return await profile(db, customer, Decimal(str(max(amount, 0))), full=bool(full))


# ── Списание бонусов за заказ сайта (вызывается после подтверждения оплаты) ──

async def spend_for_order(db: AsyncSession, order: ShopOrder) -> Decimal:
    """
    Списать бонусы за оплаченный заказ. Идемпотентно (receipt СП-<order_id>).
    Если баланс уменьшился после оформления — списывает сколько есть и возвращает фактическую сумму.
    """
    planned = Decimal(str(order.bonus_spend or 0))
    if planned <= 0:
        return Decimal("0")
    receipt = f"СП-{order.order_id}"
    existing = (await db.execute(select(Transaction).where(Transaction.receipt_number == receipt))).scalar_one_or_none()
    if existing:
        return Decimal(str(existing.amount))

    customer = await _customer(db, order.customer_phone)
    if not customer:
        return Decimal("0")
    account = await _account(db, customer, lock=True)
    amount = min(planned, Decimal(str(account.balance or 0)))
    if amount <= 0:
        await db.commit()
        return Decimal("0")
    account.balance -= amount
    account.total_spent += amount
    db.add(Transaction(
        customer_id=customer.id,
        type=TransactionType.SPEND,
        amount=amount,
        purchase_amount=Decimal(str(order.total)),
        branch_id=await branch_id(db),
        receipt_number=receipt,
        note=f"Сайт: оплата бонусами, заказ {order.order_id}",
    ))
    await db.commit()
    return amount
