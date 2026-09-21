"""
Интернет-магазин Smart Centr — продавец в WhatsApp.

Покупатели пишут на номер магазина (+996 557 100 505, он же подключён к
Green API). Отвечают там живые люди. Робот вступает, только если человек не
ответил:

  • пришло сообщение — ждём SITE_WA_DELAY_MIN минут (по умолчанию 5);
  • за это время сотрудник написал в этот чат с телефона — робот молчит в
    этом чате 12 часов (сотрудник ведёт разговор сам);
  • не написал — робот отвечает как продавец на сайте: цена, фото, ссылка,
    заказ с оплатой O!Деньги прямо в переписке;
  • больше 30 ответов робота одному человеку за день — дальше отвечает
    сотрудник (робот предупреждает и замолкает);
  • покупатель попросил живого человека — робот передаёт и замолкает на 12 часов.

Робот не отвечает в группах, на голосовые и стикеры, самому магазину.
Выключается в 1С: «Панель сайта» → «WhatsApp-консультант».

Мозг — тот же, что у чата на сайте: сервер спрашивает сайт
(POST {SHOP_SITE_BASE_URL}/api/channel/whatsapp, подпись SHOP_SITE_SECRET) и
отправляет ответ через Green API. Разговор хранится в Redis три дня.

Запуск: cron на сервере раз в минуту вызывает poll_once() (см. deploy_shop.sh).
Webhook Green API не используется — см. «Опрос журнала» ниже.
"""
from __future__ import annotations

import asyncio
import hashlib
import hmac
import json
import logging
import time
from datetime import datetime, timedelta, timezone

import httpx
from fastapi import APIRouter

from app.core.redis import redis_client

logger = logging.getLogger("sbonus.shop.wa_bot")

# Маршрутов нет: робот работает по cron. Роутер оставлен, чтобы main.py не менять.
router_wa_bot = APIRouter(prefix="/webhook/greenapi", tags=["WhatsApp: продавец"])

HUMAN_QUIET = 12 * 3600          # сотрудник ответил — робот молчит в чате столько
TURNS_TTL = 3 * 24 * 3600        # сколько помним разговор
MAX_TURNS = 12                   # сколько реплик отдаём мозгу
DAILY_LIMIT = 30                 # ответов робота одному человеку за сутки
MAX_PHOTOS = 3


def _today() -> str:
    return (datetime.now(timezone.utc) + timedelta(hours=6)).strftime("%Y%m%d")


async def _turns(digits: str) -> list[dict]:
    raw = await redis_client.get(f"wa:turns:{digits}")
    try:
        return json.loads(raw) if raw else []
    except Exception:
        return []


async def _remember(digits: str, role: str, text: str) -> None:
    turns = (await _turns(digits)) + [{"role": role, "text": text[:800]}]
    await redis_client.set(f"wa:turns:{digits}", json.dumps(turns[-MAX_TURNS:], ensure_ascii=False), ex=TURNS_TTL)


async def _settings() -> tuple[bool, int]:
    """Включён ли робот и сколько минут ждать сотрудника (настройки «Панели сайта»)."""
    from app.core.database import async_session
    from .shop_admin import _values
    try:
        async with async_session() as db:
            values = await _values(db)
        return values.get("SITE_WA_BOT", "1") == "1", int(values.get("SITE_WA_DELAY_MIN", "5") or 5)
    except Exception as error:
        logger.warning(f"wa bot settings: {error}")
        return True, 5


# ── Опрос журнала Green API ──────────────────────────────────────────────────
# Webhook не подключаем: у Green API уведомления идут либо на webhook, либо в
# очередь, которую читает WhatsApp-чат в 1С («СистемаВзаимодействия»). Журналы
# lastIncomingMessages / lastOutgoingMessages очередь не трогают — 1С работает
# как работала. poll_once() раз в минуту запускает cron на сервере.

JOURNAL_MINUTES = 15


async def _journal(method: str) -> list[dict]:
    from .shop_whatsapp import _url
    host, instance, token = _url()
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.get(f"{host}/waInstance{instance}/{method}/{token}", params={"minutes": JOURNAL_MINUTES})
    if response.status_code != 200:
        logger.warning(f"wa bot {method}: {response.status_code}")
        return []
    data = response.json()
    return data if isinstance(data, list) else []


def _journal_text(message: dict) -> str:
    if message.get("typeMessage") == "textMessage":
        return str(message.get("textMessage") or "")
    if message.get("typeMessage") in ("extendedTextMessage", "quotedMessage"):
        return str((message.get("extendedTextMessage") or {}).get("text") or message.get("textMessage") or "")
    return ""


async def _first_time(message_id: str) -> bool:
    """Каждое сообщение журнала обрабатываем один раз."""
    return bool(await redis_client.set(f"wa:seen:{message_id}", "1", ex=2 * 24 * 3600, nx=True))


async def poll_once() -> dict:
    enabled, delay = await _settings()
    if not enabled:
        return {"enabled": False}
    from .shop_whatsapp import _url
    own = ""
    try:
        host, instance, token = _url()
        async with httpx.AsyncClient(timeout=20) as client:
            own = str((await client.get(f"{host}/waInstance{instance}/getSettings/{token}")).json().get("wid") or "")
    except Exception:
        pass

    # Сначала ответы людей: написал сотрудник — робот в этом чате молчит.
    for message in await _journal("lastOutgoingMessages"):
        chat = str(message.get("chatId") or "")
        if message.get("sendByApi") or not chat.endswith("@c.us") or chat == own:
            continue
        if not await _first_time(str(message.get("idMessage"))):
            continue
        digits = chat.removesuffix("@c.us")
        await redis_client.set(f"wa:human:{digits}", "1", ex=HUMAN_QUIET)
        await redis_client.hdel("wa:pending", digits)
        text = _journal_text(message).strip()
        if text:
            await _remember(digits, "assistant", text)

    # Новые сообщения покупателей — в разговор и в очередь ожидания.
    for message in sorted(await _journal("lastIncomingMessages"), key=lambda m: m.get("timestamp") or 0):
        chat = str(message.get("chatId") or "")
        if not chat.endswith("@c.us") or chat == own:
            continue
        text = _journal_text(message).strip()
        if not text or not await _first_time(str(message.get("idMessage"))):
            continue
        digits = chat.removesuffix("@c.us")
        await _remember(digits, "user", text)
        await redis_client.hset("wa:pending", digits, json.dumps({
            "ts": int(message.get("timestamp") or time.time()),
            "name": str(message.get("senderName") or "")[:60],
        }, ensure_ascii=False))

    # Кто ждёт дольше, чем договорились, и кому не ответил человек — отвечаем.
    answered = 0
    now = time.time()
    for digits, raw in (await redis_client.hgetall("wa:pending")).items():
        try:
            pending = json.loads(raw)
        except Exception:
            await redis_client.hdel("wa:pending", digits)
            continue
        if await redis_client.get(f"wa:human:{digits}"):
            await redis_client.hdel("wa:pending", digits)
            continue
        if now - float(pending.get("ts") or now) < delay * 60:
            continue
        await redis_client.hdel("wa:pending", digits)
        if await _answer(digits, str(pending.get("name") or "")):
            answered += 1
    return {"enabled": True, "answered": answered}


async def _answer(digits: str, name: str) -> bool:
    try:
        count_key = f"wa:count:{digits}:{_today()}"
        count = int(await redis_client.get(count_key) or 0)
        if count >= DAILY_LIMIT:
            return False

        reply = await _ask_site(digits, name)
        if not reply or not reply.get("text"):
            return False
        # Модель недоступна (кончился лимит Gemini) — шаблонный ответ в WhatsApp не шлём:
        # человек написал живым людям, пусть ответит сотрудник.
        if reply.get("source") == "local":
            logger.warning("wa bot: модель недоступна — отвечать оставляю сотруднику")
            return False
        text = str(reply["text"])
        if count + 1 >= DAILY_LIMIT:
            text += "\n\nДальше вам ответит сотрудник магазина."
        await _send_text(digits, text)
        await _send_photos(digits, reply.get("products") or [])
        await _remember(digits, "assistant", text)
        await redis_client.set(count_key, str(count + 1), ex=2 * 24 * 3600)
        ids = [p.get("id") for p in reply.get("products") or [] if p.get("id")]
        if ids:
            await redis_client.set(f"wa:shown:{digits}", json.dumps(ids), ex=TURNS_TTL)
        if reply.get("handoff") or count + 1 >= DAILY_LIMIT:
            await redis_client.set(f"wa:human:{digits}", "1", ex=HUMAN_QUIET)
        return True
    except Exception as error:
        logger.error(f"wa bot {digits[-4:]}: {error}")
        return False


async def _ask_site(digits: str, name: str) -> dict | None:
    from .shop_router import _site_base_url, _site_secret
    shown_raw = await redis_client.get(f"wa:shown:{digits}")
    payload = json.dumps({
        "phone": "+" + digits,
        "name": name,
        "messages": await _turns(digits),
        "shown": json.loads(shown_raw) if shown_raw else [],
    }, ensure_ascii=False)
    signature = hmac.new(_site_secret().encode(), payload.encode("utf-8"), hashlib.sha256).hexdigest()
    async with httpx.AsyncClient(timeout=40) as client:
        response = await client.post(
            f"{_site_base_url()}/api/channel/whatsapp",
            content=payload.encode("utf-8"),
            headers={"Content-Type": "application/json", "X-Signature": signature},
        )
    if response.status_code != 200:
        logger.error(f"wa bot: сайт ответил {response.status_code}")
        return None
    data = response.json()
    return data if data.get("ok") else None


async def _send_text(digits: str, text: str) -> None:
    from app.payments import payments_greenapi as wa  # type: ignore
    await asyncio.to_thread(wa.send_text, digits, text)


async def _send_photos(digits: str, products: list[dict]) -> None:
    """Фото товара с подписью: название, цена, ссылка. Без фото — ничего не шлём."""
    from .shop_router import _site_base_url
    from .shop_whatsapp import _url
    host, instance, token = _url()
    async with httpx.AsyncClient(timeout=30) as client:
        for product in [p for p in products if str(p.get("image") or "").startswith("http")][:MAX_PHOTOS]:
            href = str(product.get("href") or "")
            caption = f"{product.get('name')} — {product.get('priceLabel')}" + (f"\n{_site_base_url()}{href}" if href else "")
            try:
                await client.post(f"{host}/waInstance{instance}/sendFileByUrl/{token}", json={
                    "chatId": f"{digits}@c.us",
                    "urlFile": product["image"],
                    "fileName": "photo.jpg",
                    "caption": caption[:1000],
                })
            except Exception as error:
                logger.warning(f"wa bot photo: {error}")


def run_cron() -> None:
    """Запуск из cron: один опрос, в журнал — только ответы и ошибки."""
    async def once() -> dict:
        try:
            return await poll_once()
        finally:
            # Закрываем соединения с Redis сами: иначе при выходе Python сыпал
            # «Event loop is closed» в журнал каждую минуту.
            closer = getattr(redis_client, "aclose", None) or redis_client.close
            await closer()
            await redis_client.connection_pool.disconnect(inuse_connections=True)

    try:
        result = asyncio.run(once())
        if result.get("answered"):
            print(f"{datetime.now():%Y-%m-%d %H:%M} ответил: {result['answered']}")
    except Exception as error:
        print(f"{datetime.now():%Y-%m-%d %H:%M} ошибка: {error}")
