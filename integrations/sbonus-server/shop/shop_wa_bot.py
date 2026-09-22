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
  • покупатель посмотрел товар и замолчал на 2 часа — робот один раз спрашивает
    «ещё актуально?» (в рабочее время, не чаще раза в 3 дня на чат);
  • каждое утро в 9:05 владелец получает сводку за вчера: где робот сдался и
    чего не нашёл (текст готовит сайт, /api/assistant/digest).

Голосовое робот расшифровывает, фото — описывает (сайт спрашивает модель:
POST /api/channel/media), и дальше это обычная реплика покупателя. Не разобрал —
на голосовое просит написать текстом. В группах, на стикеры и самому магазину
не отвечает.
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
import re
import time
from datetime import datetime, timedelta, timezone

import httpx
from fastapi import APIRouter

from app.core.redis import redis_client

from .shop_customers import WA_LOGIN_RE

logger = logging.getLogger("sbonus.shop.wa_bot")

# Маршрутов нет: робот работает по cron. Роутер оставлен, чтобы main.py не менять.
router_wa_bot = APIRouter(prefix="/webhook/greenapi", tags=["WhatsApp: продавец"])

HUMAN_QUIET = 12 * 3600          # сотрудник ответил — робот молчит в чате столько
TURNS_TTL = 3 * 24 * 3600        # сколько помним разговор
MAX_TURNS = 12                   # сколько реплик отдаём мозгу
DAILY_LIMIT = 30                 # ответов робота одному человеку за сутки
MAX_PHOTOS = 3
NUDGE_AFTER = 2 * 3600           # покупатель молчит столько после показа товара — напоминаем
NUDGE_QUIET = 3 * 24 * 3600      # не чаще раза в столько на один чат
WORK_HOURS = range(9, 18)        # напоминаем только в рабочее время (Бишкек)


def _bishkek_now() -> datetime:
    return datetime.now(timezone.utc) + timedelta(hours=6)


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


async def _journal(method: str, minutes: int = JOURNAL_MINUTES) -> list[dict]:
    from .shop_whatsapp import _url
    host, instance, token = _url()
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.get(f"{host}/waInstance{instance}/{method}/{token}", params={"minutes": minutes})
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


AUTO_REPLY_RE = re.compile(
    r"(не на связи|в рабочее время|благодарим за (ваше )?(сообщение|обращение)|спасибо за (ваше )?(сообщение|обращение)"
    r"|обращение принято|скоро ответим|we are (currently )?away|thanks for (contacting|your message)"
    r"|иш убагында|ish vaqtida|javob beramiz|жооп беребиз)",
    re.I,
)


async def _auto_reply(digits: str, text: str) -> bool:
    """
    Автоответ или приветствие WhatsApp Business, а не живой сотрудник.

    Узнаём двумя способами: по типичным словам и по повтору — один и тот же
    текст «с телефона» ушёл в два разных чата, значит, это шаблон.
    """
    text = text.strip()
    if not text:
        return False
    if AUTO_REPLY_RE.search(text):
        return True
    # Короткое «Да», «Спасибо», «Есть» сотрудник пишет многим — это живой ответ.
    if len(text) < 40:
        return False
    key ="wa:outtext:" + hashlib.sha1(text.encode("utf-8")).hexdigest()
    await redis_client.sadd(key, digits)
    await redis_client.expire(key, 7 * 24 * 3600)
    return await redis_client.scard(key) >= 2


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
        # Автоответ WhatsApp Business («Сейчас мы не на связи…») уходит «с телефона»,
        # но это не человек. Без этой проверки он глушил робота в каждом чате.
        if await _auto_reply(digits, _journal_text(message)):
            continue
        await redis_client.set(f"wa:human:{digits}", "1", ex=HUMAN_QUIET)
        await redis_client.delete(f"wa:botactive:{digits}")
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
        kind = _media_kind(message)
        if (not text and not kind) or not await _first_time(str(message.get("idMessage"))):
            continue
        # «Код входа: 482913» — это вход на сайт (shop_customers), а не вопрос продавцу.
        if text and WA_LOGIN_RE.search(text):
            continue
        digits = chat.removesuffix("@c.us")
        voice = False
        if kind:
            # Голосовое → текст, фото → описание. Не вышло с голосовым — попросим написать.
            heard = await _read_media(message, kind)
            if heard:
                text = heard
            elif kind == "audio":
                voice = True
        if text:
            await _remember(digits, "user", text)
        # Покупатель написал сам — напоминать не о чем.
        await redis_client.delete(f"wa:nudge:{digits}")
        await redis_client.hset("wa:pending", digits, json.dumps({
            "ts": int(message.get("timestamp") or time.time()),
            # Имя из телефона владельца (senderContactName) важнее имени профиля WhatsApp:
            # так покупателя зовут в магазине, и робот не переспрашивает.
            "name": str(message.get("senderContactName") or message.get("senderName") or "")[:60],
            "voice": voice,
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
        # Робот уже ведёт этот разговор (сотрудник не вмешался) — следующий ответ
        # сразу, на ближайшем запуске: ждать 5 минут на каждое «а доставка есть?» — долго.
        wait = 0 if await redis_client.get(f"wa:botactive:{digits}") else delay * 60
        if now - float(pending.get("ts") or now) < wait:
            continue
        await redis_client.hdel("wa:pending", digits)
        if pending.get("voice"):
            if await _ask_for_text(digits):
                answered += 1
        elif await _answer(digits, str(pending.get("name") or "")):
            answered += 1
    nudged = await _nudge_silent()
    return {"enabled": True, "answered": answered, "nudged": nudged}


VOICE_TYPES = ("audioMessage", "voiceMessage", "pttMessage")
IMAGE_TYPES = ("imageMessage",)


def _media_kind(message: dict) -> str | None:
    kind = message.get("typeMessage")
    if kind in VOICE_TYPES:
        return "audio"
    if kind in IMAGE_TYPES:
        return "image"
    return None


async def _read_media(message: dict, kind: str) -> str:
    """
    Голосовое → «[Голосовое] …», фото → «[Фото] …» (подпись покупателя + что на фото).
    Расшифровывает сайт (модель). Не вышло — пустая строка, робот не гадает.
    """
    from .shop_router import _site_base_url, _site_secret
    url = str(message.get("downloadUrl") or "")
    if not url.startswith("https://"):
        return ""
    payload = json.dumps({"url": url, "mime": str(message.get("mimeType") or ""), "kind": kind}, ensure_ascii=False)
    signature = hmac.new(_site_secret().encode(), payload.encode("utf-8"), hashlib.sha256).hexdigest()
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.post(
                f"{_site_base_url()}/api/channel/media",
                content=payload.encode("utf-8"),
                headers={"Content-Type": "application/json", "X-Signature": signature},
            )
        data = response.json() if response.status_code == 200 else {}
    except Exception as error:
        logger.error(f"wa bot media {kind}: {error}")
        return ""
    heard = str(data.get("text") or "").strip() if data.get("ok") else ""
    if not heard:
        return ""
    if kind == "audio":
        return f"[Голосовое] {heard}"
    caption = str(message.get("caption") or "").strip()
    return f"[Фото] {heard}" + (f"\nПодпись покупателя: {caption}" if caption else "")

# Только по-русски — так решил владелец.
ASK_FOR_TEXT = "Извините, голосовые сообщения я не слушаю — напишите, пожалуйста, текстом 🙏"


async def _ask_for_text(digits: str) -> bool:
    """Ответ на голосовое. Не чаще раза в полчаса: пять голосовых — одна просьба."""
    if not await redis_client.set(f"wa:askedtext:{digits}", "1", ex=30 * 60, nx=True):
        return False
    try:
        await _send_text(digits, ASK_FOR_TEXT)
        await _remember(digits, "assistant", ASK_FOR_TEXT)
        await redis_client.set(f"wa:botactive:{digits}", "1", ex=30 * 60)
        return True
    except Exception as error:
        logger.error(f"wa bot voice {digits[-4:]}: {error}")
        return False


async def _answer(digits: str, name: str) -> bool:
    try:
        count_key = f"wa:count:{digits}:{_today()}"
        count = int(await redis_client.get(count_key) or 0)
        if count >= DAILY_LIMIT:
            return False

        reply = await _ask_site(digits, name)
        if reply and reply.get("silent"):
            # Не покупатель (рабочие, поставщики, родные) — робот в этом чате молчит 12 часов.
            await redis_client.set(f"wa:human:{digits}", "1", ex=HUMAN_QUIET)
            logger.info(f"wa bot: не для магазина, молчу ...{digits[-4:]}")
            return False
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
        await redis_client.set(f"wa:botactive:{digits}", "1", ex=30 * 60)
        ids = [p.get("id") for p in reply.get("products") or [] if p.get("id")]
        if ids:
            await redis_client.set(f"wa:shown:{digits}", json.dumps(ids), ex=TURNS_TTL)
            # Показали товар — если покупатель замолчит, через 2 часа спросим «ещё актуально?».
            await redis_client.set(f"wa:nudge:{digits}", json.dumps({"ts": time.time(), "name": name}), ex=24 * 3600)
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


async def _nudge_silent() -> int:
    """
    «Ещё актуально?» тем, кто посмотрел товар и замолчал.

    Условия все сразу: прошло NUDGE_AFTER, рабочее время, сотрудник в чат не
    вмешивался, за 3 дня не напоминали, заказа нет (это проверяет сайт).
    """
    if _bishkek_now().hour not in WORK_HOURS:
        return 0
    from .shop_router import _site_base_url, _site_secret
    sent = 0
    async for key in redis_client.scan_iter(match="wa:nudge:*", count=200):
        digits = str(key).removeprefix("wa:nudge:")
        try:
            pending = json.loads(await redis_client.get(key) or "{}")
        except Exception:
            pending = {}
        if time.time() - float(pending.get("ts") or 0) < NUDGE_AFTER:
            continue
        await redis_client.delete(key)
        if await redis_client.get(f"wa:human:{digits}"):
            continue
        if not await redis_client.set(f"wa:nudged:{digits}", "1", ex=NUDGE_QUIET, nx=True):
            continue
        shown_raw = await redis_client.get(f"wa:shown:{digits}")
        payload = json.dumps({
            "name": str(pending.get("name") or ""),
            "messages": await _turns(digits),
            "shown": json.loads(shown_raw) if shown_raw else [],
        }, ensure_ascii=False)
        signature = hmac.new(_site_secret().encode(), payload.encode("utf-8"), hashlib.sha256).hexdigest()
        try:
            async with httpx.AsyncClient(timeout=40) as client:
                response = await client.post(
                    f"{_site_base_url()}/api/channel/followup",
                    content=payload.encode("utf-8"),
                    headers={"Content-Type": "application/json", "X-Signature": signature},
                )
            data = response.json() if response.status_code == 200 else {}
            text = str(data.get("text") or "") if data.get("ok") else ""
            if not text:
                continue
            await _send_text(digits, text)
            await _remember(digits, "assistant", text)
            await redis_client.set(f"wa:botactive:{digits}", "1", ex=30 * 60)
            sent += 1
        except Exception as error:
            logger.error(f"wa bot nudge {digits[-4:]}: {error}")
    return sent


async def send_digest(day: str = "") -> bool:
    """Утренняя сводка владельцу: текст готовит сайт, шлём в WhatsApp владельца."""
    from .shop_router import _admin_phone, _site_base_url, _site_secret
    payload = json.dumps({"day": day} if day else {}, ensure_ascii=False)
    signature = hmac.new(_site_secret().encode(), payload.encode("utf-8"), hashlib.sha256).hexdigest()
    async with httpx.AsyncClient(timeout=40) as client:
        response = await client.post(
            f"{_site_base_url()}/api/assistant/digest",
            content=payload.encode("utf-8"),
            headers={"Content-Type": "application/json", "X-Signature": signature},
        )
    if response.status_code != 200:
        logger.error(f"wa digest: сайт ответил {response.status_code}")
        return False
    data = response.json()
    text = str(data.get("text") or "")
    if not data.get("ok") or not text:
        return False
    await _send_text(_admin_phone(), text)
    logger.info(f"wa digest: отправлена за {data.get('day')} ({data.get('count')} вопросов)")
    return True


DIGEST_HOUR = 9


def run_digest() -> None:
    """Запуск из cron раз в час; шлём только в 9 утра по Бишкеку, один раз в день."""
    if _bishkek_now().hour != DIGEST_HOUR:
        return
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")

    async def once() -> None:
        try:
            day = _bishkek_now().strftime("%Y%m%d")
            if not await redis_client.set(f"wa:digest:{day}", "1", ex=2 * 24 * 3600, nx=True):
                return
            await send_digest()
        finally:
            await _close_redis()

    try:
        asyncio.run(once())
    except Exception as error:
        logger.error(f"wa digest: {error}")


async def _close_redis() -> None:
    """Закрываем соединения с Redis сами: иначе при выходе Python сыпал
    «Event loop is closed» в журнал каждую минуту."""
    closer = getattr(redis_client, "aclose", None) or redis_client.close
    await closer()
    await redis_client.connection_pool.disconnect(inuse_connections=True)


def run_cron() -> None:
    """Запуск из cron: один опрос, в журнал — только ответы и ошибки."""
    async def once() -> dict:
        try:
            return await poll_once()
        finally:
            await _close_redis()

    try:
        result = asyncio.run(once())
        if result.get("answered") or result.get("nudged"):
            print(f"{datetime.now():%Y-%m-%d %H:%M} ответил: {result.get('answered', 0)}, напомнил: {result.get('nudged', 0)}")
    except Exception as error:
        print(f"{datetime.now():%Y-%m-%d %H:%M} ошибка: {error}")
