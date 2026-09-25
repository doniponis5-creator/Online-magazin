"""
Интернет-магазин Smart Centr — настройки сайта и сводка для 1С.

Владелец управляет сайтом из 1С, а не из консоли сервера: обработка
«Онлайн магазин» → «Панель сайта» показывает сводку и правит настройки.

Эндпоинты (под /api/v1):
  GET  /webhook/1c/shop/settings    ключ 1С          список настроек с текущими значениями
  POST /webhook/1c/shop/settings    подпись 1С       сохранить значения
  GET  /webhook/1c/shop/dashboard   ключ 1С          сводка: период с/по и сравнение, ряды по дням, заказы, каналы
  GET  /webhook/site/settings       подпись сайта    настройки, нужные самому сайту
  GET  /webhook/1c/shop/notes       ключ 1С          «Знания для чата» — текст владельца
  POST /webhook/1c/shop/notes       подпись 1С       сохранить этот текст
  GET  /webhook/site/notes          подпись сайта    тот же текст для чата на сайте
  POST /webhook/site/lead           подпись сайта    «перезвоните мне» из чата → WhatsApp владельцу
  POST /webhook/site/visit          подпись сайта    отметка о посещении страницы

Настройки лежат в таблице settings SBonus и действуют сразу, без перезапуска.
Значения проверяются здесь: из 1С может прийти что угодно, а в базе должно
остаться только осмысленное.
"""
from __future__ import annotations

import logging
import re
from datetime import date, datetime, timedelta, timezone

import hashlib
import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.redis import redis_client
from app.models import Setting

from . import shop_telegram as tg
from .shop_models import ShopVisit
from .shop_router import (
    INVOICE_TTL_HOURS, _cfg, _site_secret, _verify_1c_body, _verify_1c_key, _verify_site_body, _verify_site_path,
)

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
        "key": "SITE_BONUS_MAX_ORDER_SOM",
        "title": "Бонусами за один заказ — не больше, сом",
        "hint": "Например, 334 — приветственные 1 000 сом уйдут на три покупки. 0 — без предела, действует только %.",
        "type": "number",
        "min": 0,
        "max": 100000,
        "default": "0",
    },
    # Товар со склада, которого нет на сайте, чат продаёт по цене: себестоимость +
    # наценка (есть цена сайта — по ней). Крупная и мелкая техника — разные наценки;
    # какая техника крупная, решает 1С по группе и названию. 0 — такой товар чат не продаёт.
    {
        "key": "SITE_CHAT_MARKUP_LARGE_PCT",
        "title": "Наценка для чата: крупная техника, %",
        "hint": "Стиральные машины, холодильники, плиты, духовки, вытяжки, кондиционеры, телевизоры и т. п. 0 — не продавать.",
        "type": "number",
        "min": 0,
        "max": 300,
        "default": "15",
    },
    {
        "key": "SITE_CHAT_MARKUP_SMALL_PCT",
        "title": "Наценка для чата: мелкая техника, %",
        "hint": "Всё остальное: пылесосы, блендеры, чайники, утюги, микроволновки и т. п. 0 — не продавать.",
        "type": "number",
        "min": 0,
        "max": 300,
        "default": "20",
    },
    {
        "key": "SITE_WA_BOT",
        "title": "WhatsApp-консультант (робот отвечает, если сотрудник молчит)",
        "hint": "Включено — на WhatsApp магазина отвечает робот, когда никто не ответил за указанное время.",
        "type": "bool",
        "default": "1",
    },
    {
        "key": "SITE_WA_DELAY_MIN",
        "title": "WhatsApp: сколько минут ждать сотрудника",
        "hint": "Сотрудник не ответил за это время — отвечает робот. 0 — сразу.",
        "type": "number",
        "min": 0,
        "max": 120,
        "default": "5",
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
        "bonusMaxOrder": int(current["SITE_BONUS_MAX_ORDER_SOM"]),
        "welcomeBonus": int(current["SITE_WELCOME_BONUS_AMOUNT"]),
    }


# ── Знания для чата ──────────────────────────────────────────────────────────
# Владелец пишет в 1С обычными словами то, чего нет в каталоге: часы работы,
# гарантия, возврат, акции. Чат отвечает по этому тексту и ничего сверх него
# не придумывает. Отдельная таблица, а не settings: текст длинный.

MAX_NOTES = 8000


class SaveNotes(BaseModel):
    text: str = ""


async def _notes(db: AsyncSession) -> dict:
    row = (await db.execute(text("SELECT text, updated_at FROM shop_assistant_notes WHERE id = 1"))).first()
    if not row:
        return {"text": "", "updatedAt": None}
    return {"text": row[0] or "", "updatedAt": row[1].isoformat() if isinstance(row[1], datetime) else None}


@router_1c_admin.get("/notes")
async def read_notes(_=Depends(_verify_1c_key), db: AsyncSession = Depends(get_db)):
    return {"ok": True, **await _notes(db)}


@router_1c_admin.post("/notes")
async def save_notes(request: Request, db: AsyncSession = Depends(get_db)):
    payload = SaveNotes.parse_raw(await _verify_1c_body(request))
    # Переводы строк 1С (CR LF) приводим к одному LF; прочие управляющие символы выкидываем.
    value = payload.text.replace("\r\n", "\n").replace("\r", "\n")
    value = "".join(ch for ch in value if ch in "\n\t" or ord(ch) >= 32).strip()
    if len(value) > MAX_NOTES:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"Текст для чата длиннее {MAX_NOTES} знаков ({len(value)}). Сократите его.",
        )
    await db.execute(
        text(
            "INSERT INTO shop_assistant_notes (id, text, updated_at) VALUES (1, :t, NOW()) "
            "ON CONFLICT (id) DO UPDATE SET text = :t, updated_at = NOW()"
        ),
        {"t": value},
    )
    await db.commit()
    logger.info(f"assistant notes saved: {len(value)} chars")
    return {"ok": True, **await _notes(db)}


@router_site_admin.get("/notes")
async def site_notes(request: Request, db: AsyncSession = Depends(get_db)):
    _verify_site_path(request)
    return {"ok": True, **await _notes(db)}


# ── «Перезвоните мне» из чата ────────────────────────────────────────────────
# Покупатель не купил, но оставил номер, или попросил живого человека. Такой
# человек почти готов купить — терять его нельзя. Номер и пересказ разговора
# уходят владельцу в WhatsApp, туда же, куда приходят оплаченные заказы.

class SiteLead(BaseModel):
    name: str = ""
    phone: str
    text: str = ""
    channel: str = "site"


@router_site_admin.post("/lead")
async def site_lead(request: Request):
    import re
    from app.payments import payments_greenapi as wa  # type: ignore
    from .shop_router import _admin_phone

    payload = SiteLead.parse_raw(await _verify_site_body(request))
    digits = re.sub(r"\D", "", payload.phone)
    if not 9 <= len(digits) <= 12:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "телефон")
    # Один номер — одна заявка в 10 минут: «перезвоните» два раза подряд не
    # должно звонить владельцу два раза.
    if not await redis_client.set(f"shop_lead:{digits}", "1", ex=600, nx=True):
        return {"ok": True, "duplicate": True}
    where = {"telegram": "Telegram-бот", "whatsapp": "WhatsApp (ответил робот)"}.get(payload.channel, "чат на сайте")
    try:
        wa.send_text(_admin_phone(), (
            f"📞 ПЕРЕЗВОНИТЬ — {where}\n━━━━━━━━━━━━━━━━━━━\n"
            f"👤 {payload.name.strip()[:80] or 'имя не сказал'}\n📱 {payload.phone.strip()[:30]}\n\n"
            f"{payload.text.strip()[:1200]}"
        ))
    except Exception as error:
        logger.error(f"lead notify failed: {error}")
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "WhatsApp недоступен")
    logger.info(f"lead from {where}")
    return {"ok": True}


# ── Посещения сайта ──────────────────────────────────────────────────────────

class Visit(BaseModel):
    visitor: str = ""
    path: str = "/"

class PushDevice(BaseModel):
    token: str
    platform: str = "ios"
    phone: str | None = None



@router_site_admin.post("/push-device")
async def push_device(request: Request, db: AsyncSession = Depends(get_db)):
    """
    Приложение прислало «адрес» телефона для уведомлений о заказах.

    Адрес выдаёт Apple, он ничего не говорит о человеке. Телефон покупателя
    пишем рядом, если он вошёл: иначе некому будет отправить «заказ готов».
    """
    payload = PushDevice.parse_raw(await _verify_site_body(request))
    token = (payload.token or "").strip()
    if not token or len(token) > 200:
        return {"ok": True, "saved": False}
    try:
        from .shop_push import save_device
        await save_device(db, token, payload.platform or "ios", payload.phone)
    except Exception as error:
        # Уведомления — не повод ломать сайт.
        logger.warning(f"push-device не записан: {error}")
        return {"ok": True, "saved": False}
    return {"ok": True, "saved": True}


class AccountDelete(BaseModel):
    phone: str


@router_site_admin.post("/account-delete")
async def account_delete(request: Request, db: AsyncSession = Depends(get_db)):
    """
    Покупатель удалил учётную запись прямо в приложении.

    Apple требует, чтобы это можно было сделать внутри приложения, а не
    письмом в магазин (правило 5.1.1). Поэтому точка есть и работает сразу.

    Что здесь стираем: адреса телефона для уведомлений. Больше сайту о человеке
    хранить нечего — вход у нас без пароля, а телефон и имя живут в SBonus.

    Чего НЕ трогаем: саму запись в SBonus. Это бонусный счёт магазина, он общий
    с кассой: тот же человек ходит в магазин ногами, и стереть ему бонусы
    молча — неправильно. Заказы тоже остаются: их обязан хранить бухгалтерский
    учёт. Об этом приложение честно пишет человеку и даёт телефон магазина.

    Запрос записываем в журнал, но номер — только последними четырьмя цифрами,
    как везде в этом проекте. Человек просит убрать свои данные; оставить его
    телефон целиком в журнале именно в этот момент было бы издевательством.
    """
    payload = AccountDelete.parse_raw(await _verify_site_body(request))
    phone = (payload.phone or "").strip()
    if not phone:
        return {"ok": False, "error": "phone обязателен"}
    try:
        from .shop_push import forget_phone
        removed = await forget_phone(db, phone)
    except Exception as error:
        logger.error(f"account-delete: адреса телефона не стёрлись ...{phone[-4:]}: {error}")
        return {"ok": False, "error": "не удалось"}
    logger.info(f"account-delete: покупатель ...{phone[-4:]} удалил учётную запись, адресов стёрто: {removed}")
    return {"ok": True, "pushRemoved": removed}


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
#
# Время. В базе оно по UTC (created_at = datetime.utcnow), магазин живёт по
# Бишкеку: UTC+6 круглый год, летнего времени в Кыргызстане нет. «Сегодня»,
# «вчера» и дни на графиках считаются по Бишкеку. Раньше «сегодня» начиналось
# в 06:00 утра, а ночной заказ попадал во вчерашний столбик.
#
# Деньги. «Оплачено» считается по дню ОПЛАТЫ (paid_at), а не по дню заказа:
# заказали вчера, заплатили сегодня — деньги пришли сегодня. Раньше такой день
# показывал ноль.

SHOP_TZ_HOURS = 6
SHOP_OFFSET = timedelta(hours=SHOP_TZ_HOURS)

# Период из 1С: не длиннее года; график — от двух недель до трёх месяцев.
MAX_PERIOD_DAYS = 366
CHART_MIN_DAYS = 14
CHART_MAX_DAYS = 92

# Счёт O!Деньги живёт сутки. Кто не заплатил за сутки — уже не заплатит:
# такой заказ показываем «не оплатили», а не «ждёт оплаты».
UNPAID_AFTER = timedelta(hours=INVOICE_TTL_HOURS)

PAID_AT = "coalesce(paid_at, created_at)"
# Деньгами через O!Деньги; у заказов до бонусов pay_amount пустой — там весь total.
MONEY = "coalesce(pay_amount, total)"
IN_PERIOD = "created_at >= :start AND created_at < :end"
SOLD_IN_PERIOD = f"paid IS TRUE AND {PAID_AT} >= :start AND {PAID_AT} < :end"


def _local_day(column: str) -> str:
    return f"to_char(({column} + interval '{SHOP_TZ_HOURS} hours')::date, 'YYYY-MM-DD')"


def shop_today(now: datetime) -> date:
    """Сегодняшняя дата в Бишкеке. now — время UTC."""
    return (now.replace(tzinfo=None) + SHOP_OFFSET).date()


def day_start_utc(day: date) -> datetime:
    """Начало бишкекских суток в UTC без зоны — так время лежит в базе."""
    return datetime(day.year, day.month, day.day) - SHOP_OFFSET


def _parse_day(raw: str | None) -> date | None:
    try:
        return date.fromisoformat((raw or "").strip()[:10])
    except ValueError:
        return None


def resolve_period(raw_from: str | None, raw_to: str | None, now: datetime) -> dict:
    """
    Период из 1С («с» и «по» — бишкекские даты, обе включительно) → границы в UTC.

    Кривая дата — не ошибка, а «сегодня»: панель должна открыться всегда.
    Будущее обрезается сегодняшним днём; «с» позже «по» — один день «по».

    С чем сравнивать. Период до недели — с тем же отрезком неделю назад:
    пятница с пятницей, а не с четвергом, у магазина свой ритм по дням недели.
    Длиннее недели — с предыдущим отрезком той же длины. Если период ещё идёт,
    прошлый обрезается тем же часом: «сегодня к 15:00» честно сравнивать только
    с «неделю назад к 15:00», а не с целым днём.
    """
    now = now.replace(tzinfo=None)
    today = shop_today(now)
    to = min(_parse_day(raw_to) or today, today)
    frm = _parse_day(raw_from) or to
    if frm > to:
        frm = to
    if (to - frm).days + 1 > MAX_PERIOD_DAYS:
        frm = to - timedelta(days=MAX_PERIOD_DAYS - 1)
    days = (to - frm).days + 1

    start = day_start_utc(frm)
    end = day_start_utc(to + timedelta(days=1))
    live = end > now
    shift = timedelta(days=7 if days <= 7 else days)
    label = "неделю назад" if days <= 7 else f"предыдущие {days} дн."
    if live:
        label += " к этому часу"

    chart_from = min(frm, to - timedelta(days=CHART_MIN_DAYS - 1))
    if (to - chart_from).days + 1 > CHART_MAX_DAYS:
        chart_from = to - timedelta(days=CHART_MAX_DAYS - 1)

    return {
        "from": frm, "to": to, "days": days, "live": live, "today": today,
        "start": start, "end": end,
        "compare": {
            "from": frm - shift, "to": to - shift, "label": label,
            "start": start - shift, "end": (now if live else end) - shift,
        },
        "chartFrom": chart_from,
    }


# Всё время — для строки «всего» и для старой панели 1С (она шлёт запрос без периода).
ORDERS_SQL = text(f"""
SELECT
  count(*) FILTER (WHERE created_at >= :today)                                    AS orders_today,
  count(*) FILTER (WHERE created_at >= :week)                                     AS orders_week,
  count(*)                                                                        AS orders_total,
  coalesce(sum({MONEY}) FILTER (WHERE paid IS TRUE AND {PAID_AT} >= :today), 0)   AS paid_today,
  coalesce(sum({MONEY}) FILTER (WHERE paid IS TRUE AND {PAID_AT} >= :week), 0)    AS paid_week,
  coalesce(sum({MONEY}) FILTER (WHERE paid IS TRUE), 0)                           AS paid_total,
  count(*) FILTER (WHERE status = 'awaiting_payment')                             AS awaiting,
  count(*) FILTER (WHERE status = 'awaiting_payment' AND created_at < :unpaid_before) AS abandoned,
  count(*) FILTER (WHERE status = 'paid')                                         AS paid_wait_1c,
  count(*) FILTER (WHERE status = 'in_1c')                                        AS in_1c,
  -- Оплачен, документы в 1С есть, но реализации нет: товара не было на складе.
  -- Такой заказ надо привезти и отгрузить, иначе покупатель заберёт деньги обратно.
  count(*) FILTER (WHERE status = 'in_1c' AND realized IS TRUE)                   AS shipped,
  count(*) FILTER (WHERE status = 'in_1c' AND realized IS NOT TRUE)               AS awaiting_shipment,
  count(*) FILTER (WHERE status = 'failed')                                       AS failed,
  count(*) FILTER (WHERE status = 'cancelled')                                    AS cancelled,
  coalesce(sum(bonus_spent), 0)                                                   AS bonus_spent
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


# ── Цифры за период ──────────────────────────────────────────────────────────

PERIOD_ORDERS_SQL = text(f"""
SELECT
  count(*) FILTER (WHERE {IN_PERIOD})                                    AS orders,
  count(*) FILTER (WHERE {SOLD_IN_PERIOD})                               AS sales,
  coalesce(sum({MONEY}) FILTER (WHERE {SOLD_IN_PERIOD}), 0)              AS money,
  coalesce(sum(total) FILTER (WHERE {SOLD_IN_PERIOD}), 0)                AS sales_total,
  coalesce(sum(bonus_spent) FILTER (WHERE {SOLD_IN_PERIOD}), 0)          AS bonus
FROM shop_orders
""")

# Путь покупателя: сколько разных людей дошло до товара, корзины и оформления.
PERIOD_VISITS_SQL = text("""
SELECT
  count(DISTINCT visitor)                                               AS people,
  count(*)                                                              AS views,
  count(DISTINCT visitor) FILTER (WHERE path ~ '^/(ru|ky)/product/')    AS product_people,
  count(DISTINCT visitor) FILTER (WHERE path ~ '^/(ru|ky)/cart')        AS cart_people,
  count(DISTINCT visitor) FILTER (WHERE path ~ '^/(ru|ky)/checkout')    AS checkout_people
FROM shop_visits
WHERE created_at >= :start AND created_at < :end
""")

PERIOD_EVENTS_SQL = text("""
SELECT
  count(*) FILTER (WHERE kind = 'register') AS new_customers,
  count(*) FILTER (WHERE kind = 'login')    AS logins
FROM shop_events
WHERE created_at >= :start AND created_at < :end
""")

# Что стало с заказами, сделанными за период.
PERIOD_STATUS_SQL = text(f"""
SELECT
  count(*) FILTER (WHERE status = 'awaiting_payment' AND created_at >= :unpaid_before) AS awaiting,
  count(*) FILTER (WHERE status = 'awaiting_payment' AND created_at <  :unpaid_before) AS abandoned,
  count(*) FILTER (WHERE status = 'paid')                                             AS paid_wait_1c,
  count(*) FILTER (WHERE status = 'in_1c' AND realized IS TRUE)                       AS shipped,
  count(*) FILTER (WHERE status = 'in_1c' AND realized IS NOT TRUE)                   AS awaiting_shipment,
  count(*) FILTER (WHERE status = 'failed')                                           AS failed,
  count(*) FILTER (WHERE status = 'cancelled')                                        AS cancelled
FROM shop_orders
WHERE {IN_PERIOD}
""")

TOP_LIMIT = 7

# Что купили: строки оплаченных за период заказов, по сумме.
TOP_PRODUCTS_SQL = text(f"""
SELECT coalesce(nullif(trim(l->>'name'), ''), '—')   AS name,
       sum(coalesce((l->>'qty')::numeric, 0))         AS qty,
       sum(coalesce((l->>'sum')::numeric, 0))         AS amount,
       count(DISTINCT o.id)                           AS orders
FROM shop_orders o
CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(o.lines) = 'array' THEN o.lines ELSE '[]'::jsonb END) AS l
WHERE o.paid IS TRUE AND coalesce(o.paid_at, o.created_at) >= :start AND coalesce(o.paid_at, o.created_at) < :end
GROUP BY 1
ORDER BY amount DESC, qty DESC
LIMIT :limit
""")

# Что смотрят: страницы товаров по числу разных людей.
TOP_VIEWED_SQL = text("""
SELECT split_part(path, '/', 4)                   AS product,   -- /ru/product/<адрес>
       count(DISTINCT visitor)                             AS people
FROM shop_visits
WHERE created_at >= :start AND created_at < :end AND path ~ '^/(ru|ky)/product/[^/?#]'
GROUP BY 1
ORDER BY people DESC, product
LIMIT :limit
""")

# Адрес товара на сайте — код 1С латиницей: «ЦБ-00001234» → «cb-00001234».
# Точная копия slugFromCode из src/data/1c/adapter.ts: иначе адрес не узнать.
_TRANSLIT = {
    "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ё": "e", "ж": "zh", "з": "z", "и": "i",
    "й": "y", "к": "k", "л": "l", "м": "m", "н": "n", "о": "o", "п": "p", "р": "r", "с": "s", "т": "t",
    "у": "u", "ф": "f", "х": "h", "ц": "c", "ч": "ch", "ш": "sh", "щ": "sch", "ъ": "", "ы": "y", "ь": "",
    "э": "e", "ю": "yu", "я": "ya", "ң": "n", "ө": "o", "ү": "u",
}


def slug_from_code(code: str) -> str:
    value = "".join(_TRANSLIT.get(ch, ch) for ch in str(code or "").lower())
    return re.sub(r"[^a-z0-9]+", "-", value).strip("-")


def _product_names(items: list[dict]) -> dict[str, str]:
    """Адрес товара на сайте → название из каталога 1С."""
    names: dict[str, str] = {}
    for item in items:
        name = str(item.get("name") or "").strip()
        if not name:
            continue
        slug = slug_from_code(item.get("code") or "")
        for key in (slug, str(item.get("id") or "")):
            if key:
                names.setdefault(key, name)
    return names


async def _row(db: AsyncSession, sql, params: dict) -> dict:
    """Одна строка ответа. Сломался запрос — нули, а не упавшая панель."""
    try:
        row = (await db.execute(sql, params)).mappings().one_or_none()
        return dict(row) if row else {}
    except Exception as error:
        logger.warning(f"сводка: запрос не выполнен: {error}")
        # После ошибки PostgreSQL не выполнит в этой транзакции ничего — начинаем заново.
        await db.rollback()
        return {}


async def _rows(db: AsyncSession, sql, params: dict) -> list[dict]:
    try:
        return [dict(r) for r in (await db.execute(sql, params)).mappings().all()]
    except Exception as error:
        logger.warning(f"сводка: запрос не выполнен: {error}")
        await db.rollback()
        return []


def _int(row: dict, key: str) -> int:
    return int(row.get(key) or 0)


def _money(row: dict, key: str) -> float:
    return float(row.get(key) or 0)


async def _period_stats(db: AsyncSession, start: datetime, end: datetime) -> dict:
    """Всё, что владелец сравнивает: люди, заказы, продажи, деньги."""
    params = {"start": start, "end": end}
    o = await _row(db, PERIOD_ORDERS_SQL, params)
    v = await _row(db, PERIOD_VISITS_SQL, params)
    e = await _row(db, PERIOD_EVENTS_SQL, params)
    people, sales = _int(v, "people"), _int(o, "sales")
    sales_total = _money(o, "sales_total")
    return {
        "people": people,
        "views": _int(v, "views"),
        "productPeople": _int(v, "product_people"),
        "cartPeople": _int(v, "cart_people"),
        "checkoutPeople": _int(v, "checkout_people"),
        "orders": _int(o, "orders"),
        "sales": sales,
        "money": _money(o, "money"),
        "salesTotal": sales_total,
        "bonus": _money(o, "bonus"),
        "avgCheck": round(sales_total / sales) if sales else 0,
        # Сколько из зашедших купили, в процентах.
        "conversion": round(sales * 100 / people, 1) if people else 0.0,
        "newCustomers": _int(e, "new_customers"),
        "logins": _int(e, "logins"),
    }


# Ряды по дням для графиков. Пустые дни тоже нужны — иначе график врёт:
# провал выглядит как отсутствие столбика, а не как ноль.
DAILY_ORDERS_SQL = text(f"""
SELECT {_local_day('created_at')} AS day, count(*) AS orders
FROM shop_orders
WHERE {IN_PERIOD}
GROUP BY 1
""")

DAILY_SALES_SQL = text(f"""
SELECT {_local_day(PAID_AT)} AS day, count(*) AS sales, coalesce(sum({MONEY}), 0) AS paid
FROM shop_orders
WHERE {SOLD_IN_PERIOD}
GROUP BY 1
""")

DAILY_VISITS_SQL = text(f"""
SELECT {_local_day('created_at')} AS day, count(DISTINCT visitor) AS people, count(*) AS views
FROM shop_visits
WHERE {IN_PERIOD}
GROUP BY 1
""")

DAILY_EVENTS_SQL = text(f"""
SELECT {_local_day('created_at')} AS day,
       count(*) FILTER (WHERE kind = 'register') AS new_customers,
       count(*) FILTER (WHERE kind = 'login')    AS logins
FROM shop_events
WHERE {IN_PERIOD}
GROUP BY 1
""")


async def _daily(db: AsyncSession, first: date, last: date, period: dict | None = None) -> list[dict]:
    """Дни с first по last (бишкекские, включительно) подряд, без пропусков."""
    params = {"start": day_start_utc(first), "end": day_start_utc(last + timedelta(days=1))}
    rows: dict[str, dict] = {}
    for sql in (DAILY_ORDERS_SQL, DAILY_SALES_SQL, DAILY_VISITS_SQL, DAILY_EVENTS_SQL):
        for row in await _rows(db, sql, params):
            rows.setdefault(row["day"], {}).update(row)

    series = []
    for shift in range((last - first).days + 1):
        day = first + timedelta(days=shift)
        got = rows.get(day.isoformat(), {})
        series.append({
            "day": day.isoformat(),
            "orders": _int(got, "orders"),
            "sales": _int(got, "sales"),
            "paid": _money(got, "paid"),
            "people": _int(got, "people"),
            "views": _int(got, "views"),
            "newCustomers": _int(got, "new_customers"),
            "logins": _int(got, "logins"),
            # Дни вне выбранного периода 1С рисует бледными — для фона.
            "inPeriod": period is None or period["from"] <= day <= period["to"],
        })
    return series


RECENT_LIMIT = 10
PERIOD_ORDERS_LIMIT = 200

# Имя и телефон нужны владельцу, чтобы позвонить по неотгруженному заказу,
# не открывая каждый документ. Панель видят только сотрудники с доступом в 1С.
RECENT_ITEMS = 3
ORDER_COLUMNS = ("order_id, created_at, paid_at, total, pay_amount, bonus_spent, status, paid, realized, "
                 "order_number_1c, customer_name, customer_phone, lines")

RECENT_SQL = text(f"""
SELECT {ORDER_COLUMNS}
FROM shop_orders
ORDER BY created_at DESC
LIMIT :limit
""")

# Список заказов за период. Ключ приходит из 1С; условия только отсюда —
# в SQL не попадает ни одной буквы из запроса.
ORDER_FILTERS: dict[str, tuple[str, str]] = {
    "all": (IN_PERIOD, "created_at"),
    "sales": (SOLD_IN_PERIOD, PAID_AT),
    "awaiting": (f"{IN_PERIOD} AND status = 'awaiting_payment' AND created_at >= :unpaid_before", "created_at"),
    "abandoned": (f"{IN_PERIOD} AND status = 'awaiting_payment' AND created_at < :unpaid_before", "created_at"),
    "unshipped": (f"{IN_PERIOD} AND paid IS TRUE AND (status IN ('paid', 'failed') "
                  "OR (status = 'in_1c' AND realized IS NOT TRUE))", PAID_AT),
    "cancelled": (f"{IN_PERIOD} AND status = 'cancelled'", "created_at"),
}
ORDER_LIST_SQL = {
    key: (
        text(f"SELECT {ORDER_COLUMNS} FROM shop_orders WHERE {where} ORDER BY {order_by} DESC LIMIT :limit"),
        text(f"SELECT count(*) AS found, coalesce(sum(total), 0) AS amount FROM shop_orders WHERE {where}"),
    )
    for key, (where, order_by) in ORDER_FILTERS.items()
}


def _items(lines) -> list[dict]:
    """Первые строки заказа: название и количество. Остальные считаются отдельно."""
    out = []
    for line in (lines or [])[:RECENT_ITEMS]:
        if not isinstance(line, dict):
            continue
        name = str(line.get("name") or "").strip()
        if not name:
            continue
        try:
            qty = float(line.get("qty") or 0)
        except (TypeError, ValueError):
            qty = 0
        out.append({"name": name[:120], "qty": qty})
    return out


def _iso(value) -> str | None:
    return value.isoformat() if isinstance(value, datetime) else None


def _order(r: dict) -> dict:
    lines = r.get("lines") if isinstance(r.get("lines"), list) else []
    return {
        "orderId": r["order_id"],
        "createdAt": _iso(r.get("created_at")),
        "paidAt": _iso(r.get("paid_at")),
        "total": float(r.get("total") or 0),
        "payAmount": float(r["pay_amount"] if r.get("pay_amount") is not None else r.get("total") or 0),
        "bonusSpent": float(r.get("bonus_spent") or 0),
        "status": r.get("status") or "",
        "paid": bool(r.get("paid")),
        "realized": bool(r.get("realized")),
        "customerName": r.get("customer_name") or "",
        "customerPhone": r.get("customer_phone") or "",
        "items": _items(lines),
        "itemsTotal": len(lines),
        "number1C": r.get("order_number_1c") or "",
    }


async def _recent(db: AsyncSession) -> list[dict]:
    return [_order(r) for r in await _rows(db, RECENT_SQL, {"limit": RECENT_LIMIT})]


# Оплаченные заказы, по которым владелец должен что-то сделать. Покупатель про
# нехватку товара не знает (ему пишут «принят магазином»), поэтому знать должен
# владелец: привезти товар, вернуть деньги или предложить другой.
ATTENTION_SQL = text("""
SELECT order_id, paid_at, total, status, realized, order_number_1c, note,
       customer_name, customer_phone, lines
FROM shop_orders
WHERE paid IS TRUE AND (
      (status = 'in_1c' AND realized IS NOT TRUE)
   OR status = 'failed'
   OR (status = 'paid' AND paid_at < :stale)
)
ORDER BY paid_at ASC
LIMIT 50
""")


async def _attention(db: AsyncSession, now: datetime) -> list[dict]:
    stale = (now - timedelta(minutes=30)).replace(tzinfo=None)
    out = []
    for r in await _rows(db, ATTENTION_SQL, {"stale": stale}):
        if r["status"] == "failed":
            kind = "failed"          # оплачен, 1С не смогла создать документы
        elif r["status"] == "paid":
            kind = "waiting_1c"      # оплачен, 1С его не забирает (компьютер выключен?)
        else:
            kind = "no_stock"        # в 1С, но товара на складе не было
        lines = r["lines"] if isinstance(r["lines"], list) else []
        out.append({
            "orderId": r["order_id"],
            "kind": kind,
            "paidAt": _iso(r["paid_at"]),
            "total": float(r["total"] or 0),
            "customerName": r["customer_name"] or "",
            "customerPhone": r["customer_phone"] or "",
            "items": _items(lines),
            "itemsTotal": len(lines),
            "number1C": r["order_number_1c"] or "",
            "note": (r["note"] or "")[:300],
        })
    return out


async def _period(db: AsyncSession, period: dict, orders_filter: str, now: datetime, items: list[dict]) -> dict:
    """Блок «period»: цифры за выбранные даты, сравнение, топы и список заказов."""
    params = {"start": period["start"], "end": period["end"],
              "unpaid_before": (now - UNPAID_AFTER).replace(tzinfo=None)}
    compare = period["compare"]

    s = await _row(db, PERIOD_STATUS_SQL, params)
    top_products = [{
        "name": str(r["name"])[:120],
        "qty": float(r["qty"] or 0),
        "amount": float(r["amount"] or 0),
        "orders": int(r["orders"] or 0),
    } for r in await _rows(db, TOP_PRODUCTS_SQL, {**params, "limit": TOP_LIMIT})]

    viewed = await _rows(db, TOP_VIEWED_SQL, {**params, "limit": TOP_LIMIT})
    names = _product_names(items) if viewed else {}
    top_viewed = [{
        "product": r["product"],
        "name": names.get(r["product"]) or r["product"],
        "people": int(r["people"] or 0),
    } for r in viewed if r["product"]]

    key = orders_filter if orders_filter in ORDER_FILTERS else "all"
    list_sql, count_sql = ORDER_LIST_SQL[key]
    found = await _row(db, count_sql, params)
    orders = [_order(r) for r in await _rows(db, list_sql, {**params, "limit": PERIOD_ORDERS_LIMIT})]

    return {
        "from": period["from"].isoformat(),
        "to": period["to"].isoformat(),
        "days": period["days"],
        "live": period["live"],
        "stats": await _period_stats(db, period["start"], period["end"]),
        "compare": {
            "from": compare["from"].isoformat(),
            "to": compare["to"].isoformat(),
            "label": compare["label"],
            "stats": await _period_stats(db, compare["start"], compare["end"]),
        },
        "statuses": {
            "awaitingPayment": _int(s, "awaiting"),
            "abandoned": _int(s, "abandoned"),
            "paidWaiting1C": _int(s, "paid_wait_1c"),
            "shipped": _int(s, "shipped"),
            "awaitingShipment": _int(s, "awaiting_shipment"),
            "failed": _int(s, "failed"),
            "cancelled": _int(s, "cancelled"),
        },
        "topProducts": top_products,
        "topViewed": top_viewed,
        "ordersFilter": key,
        "orders": orders,
        "ordersFound": _int(found, "found"),
        "ordersAmount": _money(found, "amount"),
    }


# ── Склад и сайт не совпадают ────────────────────────────────────────────────
# Каталог приходит из 1С раз в 10 минут: остаток по всем складам, цена сайта и
# «Наличие» из карточки. Владелец иногда ставит «В наличии», чтобы продавать без
# склада, — тогда покупатель платит, а товар ещё надо привезти. Об этом лучше
# знать заранее, а не после оплаты. Скрытые товары в каталог не попадают.

STOCK_ALERT_LIMIT = 15


def _number(value) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


def stock_alerts(items: list[dict]) -> dict:
    """Три расхождения склада и сайта: списки (первые STOCK_ALERT_LIMIT) и сколько всего."""
    from .shop_stock import FORCED_IN_STOCK, FORCED_OUT

    groups: dict[str, list[dict]] = {"soldWithoutStock": [], "stockNoPrice": [], "stockMarkedOut": []}
    for item in items:
        stock, price = _number(item.get("stock")), _number(item.get("price"))
        availability = str(item.get("availability") or "")
        row = {
            "name": (str(item.get("name") or "").strip() or str(item.get("code") or ""))[:120],
            "code": str(item.get("code") or ""),
            "stock": stock,
            "price": price,
        }
        if availability == FORCED_IN_STOCK and stock <= 0 and price > 0:
            groups["soldWithoutStock"].append(row)     # сайт продаёт, на складе пусто
        elif stock > 0 and price <= 0 and availability != FORCED_OUT:
            groups["stockNoPrice"].append(row)         # лежит на складе, купить нельзя — нет цены
        elif stock > 0 and availability == FORCED_OUT:
            groups["stockMarkedOut"].append(row)       # лежит на складе, а на сайте «нет в наличии»

    groups["soldWithoutStock"].sort(key=lambda r: -r["price"])
    groups["stockNoPrice"].sort(key=lambda r: -r["stock"])
    groups["stockMarkedOut"].sort(key=lambda r: -r["stock"])
    return {key: {"count": len(rows), "items": rows[:STOCK_ALERT_LIMIT]} for key, rows in groups.items()}


async def _catalog(db: AsyncSession) -> list[dict]:
    from .shop_router import catalog_items

    try:
        return await catalog_items(db)
    except Exception as error:
        logger.warning(f"сводка: каталог не прочитан: {error}")
        await db.rollback()
        return []


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
async def dashboard(
    _=Depends(_verify_1c_key),
    db: AsyncSession = Depends(get_db),
    date_from: str = Query("", alias="from"),
    date_to: str = Query("", alias="to"),
    orders: str = Query("all"),
):
    """
    Сводка для «Панели сайта». Без параметров — как раньше: сегодня и 14 дней.

    from / to — бишкекские даты периода (ГГГГ-ММ-ДД, включительно), orders —
    какие заказы перечислить: all, sales, awaiting, abandoned, unshipped, cancelled.
    Блок «period» новый; старые блоки остались ради старой панели 1С.
    """
    checked = datetime.now(timezone.utc)
    now = checked.replace(tzinfo=None)
    period = resolve_period(date_from, date_to, now)
    today = day_start_utc(period["today"])
    week = day_start_utc(period["today"] - timedelta(days=6))

    params = {"today": today, "week": week, "unpaid_before": now - UNPAID_AFTER}
    o = await _row(db, ORDERS_SQL, params)
    c = await _row(db, CATALOG_SQL, {})
    u = await _row(db, CUSTOMERS_SQL, {})
    p = await _row(db, PEOPLE_SQL, params)
    v = await _row(db, VISITS_SQL, params)
    daily = await _daily(db, period["chartFrom"], period["to"], period)
    recent = await _recent(db)
    attention = await _attention(db, now)
    items = await _catalog(db)
    period_block = await _period(db, period, orders, now, items)

    return {
        "ok": True,
        "checkedAt": checked.isoformat(),
        "daily": daily,
        "recentOrders": recent,
        "attention": attention,
        "period": period_block,
        "stockAlerts": stock_alerts(items),
        "orders": {
            "today": _int(o, "orders_today"),
            "week": _int(o, "orders_week"),
            "total": _int(o, "orders_total"),
            "paidToday": _money(o, "paid_today"),
            "paidWeek": _money(o, "paid_week"),
            "paidTotal": _money(o, "paid_total"),
            "awaitingPayment": _int(o, "awaiting"),
            "abandoned": _int(o, "abandoned"),
            "paidWaiting1C": _int(o, "paid_wait_1c"),
            "in1C": _int(o, "in_1c"),
            "shipped": _int(o, "shipped"),
            "awaitingShipment": _int(o, "awaiting_shipment"),
            "failed": _int(o, "failed"),
            "cancelled": _int(o, "cancelled"),
            "bonusSpent": _money(o, "bonus_spent"),
        },
        "catalog": {
            "items": _int(c, "items_count"),
            "withPrice": _int(c, "with_price"),
            "readyToSell": _int(c, "ready_to_sell"),
            "updatedAt": _iso(c.get("updated_at")),
        },
        "customers": {
            "active": _int(u, "active"),
            "fromSite": _int(u, "from_site"),
            "loginsToday": _int(p, "logins_today"),
            "loginsWeek": _int(p, "logins_week"),
            "newToday": _int(p, "new_today"),
            "newWeek": _int(p, "new_week"),
        },
        "visits": {
            "peopleToday": _int(v, "people_today"),
            "peopleWeek": _int(v, "people_week"),
            "viewsToday": _int(v, "views_today"),
            "viewsWeek": _int(v, "views_week"),
        },
        "codes": {
            "telegramToday": _int(p, "tg_today"),
            "telegramWeek": _int(p, "tg_week"),
            "whatsappToday": _int(p, "wa_today"),
            "whatsappWeek": _int(p, "wa_week"),
        },
        "channels": {
            "telegram": "работает" if tg.enabled() else "выключен — нет токена",
            "whatsapp": await _whatsapp_state(),
        },
    }
