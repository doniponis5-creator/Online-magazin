"""
Интернет-магазин Smart Centr — настройки сайта и сводка для 1С.

Владелец управляет сайтом из 1С, а не из консоли сервера: обработка
«Онлайн магазин» → «Панель сайта» показывает сводку и правит настройки.

Эндпоинты (под /api/v1):
  GET  /webhook/1c/shop/settings    ключ 1С          список настроек с текущими значениями
  POST /webhook/1c/shop/settings    подпись 1С       сохранить значения
  GET  /webhook/1c/shop/dashboard   ключ 1С          сводка по заказам, каталогу, каналам
  GET  /webhook/site/settings       подпись сайта    настройки, нужные самому сайту
  POST /webhook/site/visit          подпись сайта    отметка о посещении страницы

Настройки лежат в таблице settings SBonus и действуют сразу, без перезапуска.
Значения проверяются здесь: из 1С может прийти что угодно, а в базе должно
остаться только осмысленное.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

import hashlib
import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.redis import redis_client
from app.models import Setting

from . import shop_telegram as tg
from .shop_models import ShopVisit
from .shop_router import _cfg, _site_secret, _verify_1c_body, _verify_1c_key, _verify_site_body, _verify_site_path

logger = logging.getLogger("sbonus.shop.admin")

router_1c_admin = APIRouter(prefix="/webhook/1c/shop", tags=["1С: панель сайта"])
router_site_admin = APIRouter(prefix="/webhook/site", tags=["Сайт: настройки"])


# ── Что владелец может менять из 1С ──────────────────────────────────────────
# Порядок здесь = порядок на форме в 1С.

SETTINGS: list[dict] = [
    {
        "key": "SITE_WELCOME_BONUS_AMOUNT",
        "title": "Приветственный бонус новому покупателю, сом",
        "hint": "Начисляется один раз тому, кого ещё не было в SBonus. 0 — не начислять.",
        "type": "number",
        "min": 0,
        "max": 100000,
        "default": "1000",
    },
    {
        "key": "SITE_BONUS_MAX_PCT",
        "title": "Какую часть заказа можно оплатить бонусами, %",
        "hint": "Например, 10 — бонусами можно закрыть десятую часть суммы заказа.",
        "type": "number",
        "min": 0,
        "max": 100,
        "default": "10",
    },
    {
        "key": "SITE_GUEST_CHECKOUT",
        "title": "Разрешить заказ без входа",
        "hint": "Включено — покупатель заказывает, указав имя и телефон, и не ждёт код. "
                "Бонусами при этом платить нельзя: для них нужен вход.",
        "type": "bool",
        "default": "1",
    },
]

BY_KEY = {s["key"]: s for s in SETTINGS}


def _clean(spec: dict, raw) -> str:
    """Привести значение к тому, что можно положить в базу. Мусор — ошибка, а не тихая замена."""
    value = str(raw).strip()
    if spec["type"] == "bool":
        if value.lower() in ("1", "true", "да", "истина", "yes", "on"):
            return "1"
        if value.lower() in ("0", "false", "нет", "ложь", "no", "off", ""):
            return "0"
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"{spec['title']}: нужно да или нет")
    try:
        number = int(float(value.replace(",", ".")))
    except (TypeError, ValueError):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"{spec['title']}: нужно число")
    if not (spec["min"] <= number <= spec["max"]):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"{spec['title']}: допустимо от {spec['min']} до {spec['max']}",
        )
    return str(number)


async def _values(db: AsyncSession) -> dict[str, str]:
    rows = (await db.execute(select(Setting).where(Setting.key.in_(list(BY_KEY))))).scalars().all()
    stored = {r.key: (r.value or "").strip() for r in rows}
    return {s["key"]: stored.get(s["key"]) or s["default"] for s in SETTINGS}


async def _as_list(db: AsyncSession) -> list[dict]:
    current = await _values(db)
    return [{**s, "value": current[s["key"]]} for s in SETTINGS]


async def guest_checkout_allowed(db: AsyncSession) -> bool:
    return (await _values(db))["SITE_GUEST_CHECKOUT"] == "1"


# ── Настройки: чтение и запись из 1С ─────────────────────────────────────────

class SaveSettings(BaseModel):
    values: dict[str, str] = {}


@router_1c_admin.get("/settings")
async def read_settings(_=Depends(_verify_1c_key), db: AsyncSession = Depends(get_db)):
    return {"ok": True, "settings": await _as_list(db)}


@router_1c_admin.post("/settings")
async def save_settings(request: Request, db: AsyncSession = Depends(get_db)):
    payload = SaveSettings.parse_raw(await _verify_1c_body(request))
    unknown = [k for k in payload.values if k not in BY_KEY]
    if unknown:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"неизвестные настройки: {', '.join(unknown)}")

    for key, raw in payload.values.items():
        value = _clean(BY_KEY[key], raw)
        row = (await db.execute(select(Setting).where(Setting.key == key))).scalar_one_or_none()
        if row:
            row.value = value
        else:
            db.add(Setting(key=key, value=value))
        logger.info(f"site setting {key} = {value}")
    await db.commit()
    return {"ok": True, "settings": await _as_list(db)}


@router_site_admin.get("/settings")
async def site_settings(request: Request, db: AsyncSession = Depends(get_db)):
    """То, что нужно самому сайту, чтобы решить, показывать ли заказ без входа."""
    _verify_site_path(request)
    current = await _values(db)
    return {
        "ok": True,
        "guestCheckout": current["SITE_GUEST_CHECKOUT"] == "1",
        "bonusMaxPct": int(current["SITE_BONUS_MAX_PCT"]),
        "welcomeBonus": int(current["SITE_WELCOME_BONUS_AMOUNT"]),
    }


# ── Посещения сайта ──────────────────────────────────────────────────────────

class Visit(BaseModel):
    visitor: str = ""
    path: str = "/"


@router_site_admin.post("/visit")
async def visit(request: Request, db: AsyncSession = Depends(get_db)):
    """
    Отметка о том, что человек открыл страницу.

    Идентификатор из браузера сразу превращается в необратимый отпечаток:
    считать людей нужно, узнавать человека — нет. Одна и та же страница у
    одного посетителя записывается не чаще раза в 10 минут, иначе таблица
    распухнет от перелистываний.
    """
    payload = Visit.parse_raw(await _verify_site_body(request))
    if not payload.visitor:
        return {"ok": True, "counted": False}

    fingerprint = hashlib.sha256(f"{_site_secret()}:{payload.visitor}".encode()).hexdigest()[:32]
    path = (payload.path or "/")[:200]
    try:
        if not await redis_client.set(f"shop_visit:{fingerprint}:{path}", "1", ex=600, nx=True):
            return {"ok": True, "counted": False}
        db.add(ShopVisit(visitor=fingerprint, path=path))
        await db.commit()
    except Exception as error:
        logger.warning(f"visit не записан: {error}")
        return {"ok": True, "counted": False}
    return {"ok": True, "counted": True}


# ── Сводка ───────────────────────────────────────────────────────────────────

ORDERS_SQL = text("""
SELECT
  count(*) FILTER (WHERE created_at >= :today)                      AS orders_today,
  count(*) FILTER (WHERE created_at >= :week)                       AS orders_week,
  count(*)                                                          AS orders_total,
  coalesce(sum(pay_amount) FILTER (WHERE paid AND created_at >= :today), 0) AS paid_today,
  coalesce(sum(pay_amount) FILTER (WHERE paid AND created_at >= :week), 0)  AS paid_week,
  coalesce(sum(pay_amount) FILTER (WHERE paid), 0)                   AS paid_total,
  count(*) FILTER (WHERE status = 'awaiting_payment')                AS awaiting,
  count(*) FILTER (WHERE status = 'paid')                            AS paid_wait_1c,
  count(*) FILTER (WHERE status = 'in_1c')                           AS in_1c,
  count(*) FILTER (WHERE status = 'failed')                          AS failed,
  count(*) FILTER (WHERE status = 'cancelled')                       AS cancelled,
  coalesce(sum(bonus_spent), 0)                                      AS bonus_spent
FROM shop_orders
""")

CATALOG_SQL = text("""
SELECT
  c.items_count,
  c.updated_at,
  count(*) FILTER (WHERE (i->>'price')::numeric > 0)                                   AS with_price,
  count(*) FILTER (WHERE (i->>'price')::numeric > 0 AND (i->>'stock')::numeric > 0)     AS ready_to_sell
FROM shop_catalog c, jsonb_array_elements(c.data->'items') AS i
WHERE c.id = 1
GROUP BY c.items_count, c.updated_at
""")

PEOPLE_SQL = text("""
SELECT
  count(*) FILTER (WHERE kind = 'login'     AND created_at >= :today) AS logins_today,
  count(*) FILTER (WHERE kind = 'login'     AND created_at >= :week)  AS logins_week,
  count(*) FILTER (WHERE kind = 'register'  AND created_at >= :today) AS new_today,
  count(*) FILTER (WHERE kind = 'register'  AND created_at >= :week)  AS new_week,
  count(*) FILTER (WHERE kind = 'code_sent' AND channel = 'telegram' AND created_at >= :today) AS tg_today,
  count(*) FILTER (WHERE kind = 'code_sent' AND channel = 'telegram' AND created_at >= :week)  AS tg_week,
  count(*) FILTER (WHERE kind = 'code_sent' AND channel = 'whatsapp' AND created_at >= :today) AS wa_today,
  count(*) FILTER (WHERE kind = 'code_sent' AND channel = 'whatsapp' AND created_at >= :week)  AS wa_week
FROM shop_events
""")

VISITS_SQL = text("""
SELECT
  count(DISTINCT visitor) FILTER (WHERE created_at >= :today) AS people_today,
  count(DISTINCT visitor) FILTER (WHERE created_at >= :week)  AS people_week,
  count(*)                FILTER (WHERE created_at >= :today) AS views_today,
  count(*)                FILTER (WHERE created_at >= :week)  AS views_week
FROM shop_visits
""")

CUSTOMERS_SQL = text("""
SELECT
  (SELECT count(*) FROM customers WHERE is_active)                                       AS active,
  (SELECT count(*) FROM transactions WHERE receipt_number LIKE 'WELCOME-SITE-%')          AS from_site
""")


async def _whatsapp_state() -> str:
    """Живой ответ Green API. Молчаливо сломанный WhatsApp — худшее, что может быть."""
    instance = _cfg("greenapi_instance_id")
    token_ = _cfg("greenapi_api_token")
    if not instance or not token_:
        return "не настроен"
    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            r = await client.get(f"https://api.green-api.com/waInstance{instance}/getStateInstance/{token_}")
        if r.status_code == 200:
            state = (r.json() or {}).get("stateInstance", "")
            return "работает" if state == "authorized" else f"не готов: {state or 'неизвестно'}"
        if "expired" in r.text.lower():
            return "подписка закончилась — продлите на green-api.com"
        return f"ошибка {r.status_code}"
    except Exception as error:
        logger.warning(f"green api state: {error}")
        return "нет ответа"


@router_1c_admin.get("/dashboard")
async def dashboard(_=Depends(_verify_1c_key), db: AsyncSession = Depends(get_db)):
    now = datetime.now(timezone.utc)
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week = now - timedelta(days=7)

    period = {"today": today.replace(tzinfo=None), "week": week.replace(tzinfo=None)}
    o = (await db.execute(ORDERS_SQL, period)).mappings().one_or_none()
    c = (await db.execute(CATALOG_SQL)).mappings().one_or_none()
    u = (await db.execute(CUSTOMERS_SQL)).mappings().one_or_none()
    p = (await db.execute(PEOPLE_SQL, period)).mappings().one_or_none()
    v = (await db.execute(VISITS_SQL, period)).mappings().one_or_none()

    return {
        "ok": True,
        "checkedAt": now.isoformat(),
        "orders": {
            "today": int(o["orders_today"]) if o else 0,
            "week": int(o["orders_week"]) if o else 0,
            "total": int(o["orders_total"]) if o else 0,
            "paidToday": float(o["paid_today"]) if o else 0.0,
            "paidWeek": float(o["paid_week"]) if o else 0.0,
            "paidTotal": float(o["paid_total"]) if o else 0.0,
            "awaitingPayment": int(o["awaiting"]) if o else 0,
            "paidWaiting1C": int(o["paid_wait_1c"]) if o else 0,
            "in1C": int(o["in_1c"]) if o else 0,
            "failed": int(o["failed"]) if o else 0,
            "cancelled": int(o["cancelled"]) if o else 0,
            "bonusSpent": float(o["bonus_spent"]) if o else 0.0,
        },
        "catalog": {
            "items": int(c["items_count"]) if c else 0,
            "withPrice": int(c["with_price"]) if c else 0,
            "readyToSell": int(c["ready_to_sell"]) if c else 0,
            "updatedAt": c["updated_at"].isoformat() if c and c["updated_at"] else None,
        },
        "customers": {
            "active": int(u["active"]) if u else 0,
            "fromSite": int(u["from_site"]) if u else 0,
            "loginsToday": int(p["logins_today"]) if p else 0,
            "loginsWeek": int(p["logins_week"]) if p else 0,
            "newToday": int(p["new_today"]) if p else 0,
            "newWeek": int(p["new_week"]) if p else 0,
        },
        "visits": {
            "peopleToday": int(v["people_today"]) if v else 0,
            "peopleWeek": int(v["people_week"]) if v else 0,
            "viewsToday": int(v["views_today"]) if v else 0,
            "viewsWeek": int(v["views_week"]) if v else 0,
        },
        "codes": {
            "telegramToday": int(p["tg_today"]) if p else 0,
            "telegramWeek": int(p["tg_week"]) if p else 0,
            "whatsappToday": int(p["wa_today"]) if p else 0,
            "whatsappWeek": int(p["wa_week"]) if p else 0,
        },
        "channels": {
            "telegram": "работает" if tg.enabled() else "выключен — нет токена",
            "whatsapp": await _whatsapp_state(),
        },
    }
