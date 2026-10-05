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
  • номер записан в телефоне магазина (знакомые, постоянные клиенты) — робот
    не отвечает вовсе, только новым незаписанным номерам (владелец, 29.09.2026);
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

from .shop_customers import WA_LOGIN_RE, wa_login_message
from .shop_ig_rules import place_answer

logger = logging.getLogger("sbonus.shop.wa_bot")

# Маршрутов нет: робот работает по cron. Роутер оставлен, чтобы main.py не менять.
router_wa_bot = APIRouter(prefix="/webhook/greenapi", tags=["WhatsApp: продавец"])

HUMAN_QUIET = 12 * 3600          # сотрудник ответил — робот молчит в чате столько
# Робот сам передал чат руководству (заявка на звонок, жалоба) — молчит только час. Дальше
# покупатель спрашивает «чоңу барбы?», «Бишкекте би?» и ждать ответа до утра не должен
# (аудит 01.10: Умар 13 часов писал в пустоту). Написал владелец сам — снова 12 часов.
HANDOFF_QUIET = 3600
TURNS_TTL = 3 * 24 * 3600        # сколько помним разговор
WEEK_TTL = 8 * 24 * 3600         # копия разговора для недельной оценки качества
MAX_TURNS = 12                   # сколько реплик отдаём мозгу
DAILY_LIMIT = 30                 # ответов робота одному человеку за сутки
MAX_PHOTOS = 1                   # одно фото, как пришлёт продавец; три подряд — это рассылка
SAVED_TTL = 30 * 24 * 3600      # «номер записан в телефоне» помним месяц (обновляется с каждым сообщением)
NUDGE_AFTER = 2 * 3600           # покупатель молчит столько после показа товара — напоминаем
NUDGE_QUIET = 3 * 24 * 3600      # не чаще раза в столько на один чат
WORK_HOURS = range(9, 18)        # напоминаем только в рабочее время (Бишкек)
ALERT_QUIET = 3 * 3600           # о сбое консультанта владельцу пишем не чаще раза в столько


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


async def _remember(digits: str, role: str, text: str, asked: list[dict] | None = None) -> None:
    current = await _turns(digits)
    turns = place_answer(current, asked, text) if role == "assistant" else current + [{"role": role, "text": text[:800]}]
    await redis_client.set(f"wa:turns:{digits}", json.dumps(turns[-MAX_TURNS:], ensure_ascii=False), ex=TURNS_TTL)
    # Копия на неделю — для понедельничной оценки качества: сам разговор бот помнит 3 дня.
    await redis_client.set(f"wa:week:{digits}", json.dumps(turns[-MAX_TURNS:], ensure_ascii=False), ex=WEEK_TTL)


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


def _saved_contact(message: dict) -> bool:
    """
    Номер записан в телефоне магазина: Green API кладёт имя из записной книжки
    в senderContactName. Нет записи — поле пустое (senderName — имя профиля).
    """
    return bool(str(message.get("senderContactName") or "").strip())


def _journal_text(message: dict) -> str:
    kind = message.get("typeMessage")
    if kind == "textMessage":
        return str(message.get("textMessage") or "")
    if kind in ("extendedTextMessage", "quotedMessage"):
        return str((message.get("extendedTextMessage") or {}).get("text") or message.get("textMessage") or "")
    # Напоминания о рассрочке идут с кнопкой «Оплатить онлайн» — текст лежит внутри.
    if kind in ("interactiveButtons", "buttonsMessage", "templateMessage", "listMessage"):
        body = message.get(kind) or {}
        if isinstance(body, dict):
            return str(body.get("contentText") or body.get("text") or body.get("title") or "")
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


async def check_spend() -> None:
    """
    Расход Gemini за сегодня перевалил за предел (ASSISTANT_DAILY_USD на сайте, по умолчанию $3) —
    один раз за день пишем владельцу (владелец 04.10: «пул тугаб коляпти», узнал по графику Google).
    Спрашиваем сайт не чаще раза в 15 минут; любая ошибка — молча, робот работает дальше.
    """
    try:
        if not await redis_client.set("bot:spendcheck", "1", ex=15 * 60, nx=True):
            return
        from .shop_router import _admin_phone, _site_base_url, _site_secret
        payload = "{}"
        signature = hmac.new(_site_secret().encode(), payload.encode("utf-8"), hashlib.sha256).hexdigest()
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.post(
                f"{_site_base_url()}/api/assistant/usage",
                content=payload.encode("utf-8"),
                headers={"Content-Type": "application/json", "X-Signature": signature},
            )
        data = response.json() if response.status_code == 200 else {}
        if not data.get("over"):
            return
        flag = f"bot:spend:{data.get('day')}"
        if not await redis_client.set(flag, "1", ex=2 * 24 * 3600, nx=True):
            return
        try:
            await _send_text(_admin_phone(), (
                f"⚠️ Консультант сегодня потратил на Gemini больше предела: ≈ ${data.get('usd')} (предел ${data.get('limit')}).\n"
                f"{data.get('line') or ''}\n"
                "Если это не наплыв покупателей — посмотрите «Ждут ответа» и журнал. Предел меняется в .env.production сайта: ASSISTANT_DAILY_USD."
            ))
        except Exception:
            # Не дошло — флаг снимаем: через 15 минут попробуем снова, а не молчим до завтра.
            await redis_client.delete(flag)
            raise
    except Exception as error:
        logger.warning(f"spend check: {type(error).__name__}")


async def poll_once() -> dict:
    await check_spend()
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
        if not chat.endswith("@c.us") or chat == own:
            continue
        if not await _first_time(str(message.get("idMessage"))):
            continue
        digits = chat.removesuffix("@c.us")
        if message.get("sendByApi"):
            # Напоминание о рассрочке, ссылка на оплату, welcome — их шлёт сервер, не человек.
            # Кладём в память разговора, иначе на «Ок» после напоминания робот спрашивал
            # «какую технику ищете?». Свои ответы робот уже запомнил — не дублируем.
            text = _journal_text(message).strip()
            if text:
                recent = [t.get("text") for t in (await _turns(digits))[-3:] if t.get("role") == "assistant"]
                if text[:800] not in recent:
                    await _remember(digits, "assistant", text)
            continue
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
        # «Код входа: 482913» — это вход на сайт (shop_customers), а не вопрос продавцу:
        # отмечаем вход и отвечаем один раз «вы вошли / код просрочен» (04.10).
        if text and WA_LOGIN_RE.search(text):
            await wa_login_message(chat.removesuffix("@c.us"), text)
            continue
        digits = chat.removesuffix("@c.us")
        # Номер записан в телефоне магазина — это знакомый: робот ему не пишет
        # (решение владельца 29.09.2026). Отвечает только новым, незаписанным номерам.
        if _saved_contact(message):
            await redis_client.set(f"wa:saved:{digits}", "1", ex=SAVED_TTL)
            await redis_client.hdel("wa:pending", digits)
            await redis_client.delete(f"wa:nudge:{digits}")
            continue
        voice = False
        if kind:
            # Голосовое → текст, фото → описание. Не вышло с голосовым — попросим написать.
            heard = await _read_media(message, kind)
            if heard:
                text = heard
            elif kind == "audio":
                voice = True
        # Ответ на статус магазина или на наше фото: «Нима бу?», «шулар нечпул?» без
        # картинки непонятны — берём подпись или маленькую картинку из цитаты.
        if text and message.get("typeMessage") == "quotedMessage":
            context = await _read_quote(message)
            if context:
                text = f"{context}\n{text}"
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
        if await redis_client.get(f"wa:saved:{digits}"):
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


async def _read_quote(message: dict) -> str:
    """
    На что ответил покупатель: «[Ответ на фото: …]» (подпись или описание маленькой
    картинки из цитаты) или «[Ответ на сообщение: …]». Не вышло — пустая строка.
    """
    quoted = message.get("quotedMessage") or {}
    if not isinstance(quoted, dict):
        return ""
    kind = quoted.get("typeMessage")
    if kind in ("imageMessage", "videoMessage"):
        caption = str(quoted.get("caption") or "").strip()
        if caption:
            return f"[Ответ на фото: {caption[:200]}]"
        thumb = str(quoted.get("jpegThumbnail") or "")
        if not thumb:
            return ""
        from .shop_router import _site_base_url, _site_secret
        payload = json.dumps({"data": thumb, "mime": "image/jpeg", "kind": "image"}, ensure_ascii=False)
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
            logger.error(f"wa bot quote: {error}")
            return ""
        seen = str(data.get("text") or "").strip() if data.get("ok") else ""
        return f"[Ответ на фото: {seen[:300]}]" if seen else ""
    text = str(quoted.get("textMessage") or quoted.get("caption") or "").strip()
    return f"[Ответ на сообщение: {text[:200]}]" if text else ""


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
        if response.status_code != 200:
            # Раньше молча: в Instagram «голосовое не получилось разобрать», а в журнале пусто (03.10).
            logger.warning(f"media {kind}: сайт ответил {response.status_code} {response.text[:120]}")
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

# Только по-русски — так решил владелец. Голосовые робот обычно расшифровывает; эта фраза — когда
# не разобрал (WhatsApp) или когда расшифровки нет вовсе (Instagram). «Не слушаю» было неправдой.
ASK_FOR_TEXT = "Извините, голосовое не получилось разобрать — напишите, пожалуйста, текстом 🙏"


# Почему консультант не ответил — поле `why` ответа сайта (05.10: таймаут Google приходил владельцу как
# «кончилась дневная норма», и было непонятно, что делать).
BRAIN_WHY = {
    "timeout": "Google Gemini не ответил за 12 секунд дважды подряд — обычно это сбой у Google на несколько минут",
    "busy": "Google Gemini перегружен или кончилась норма запросов у ключа",
    "limit": "кончилась дневная норма ответов сайта (ASSISTANT_DAILY_LIMIT)",
    "key": "ключ Gemini не принят или не вписан",
}


def brain_why(why) -> str:
    return BRAIN_WHY.get(str(why or ""), "не отвечает Gemini — ошибка связи")


async def alert_brain_down(channel: str, why: str) -> None:
    """
    Консультант не может ответить (Gemini молчит, сайт лежит) — покупатели в WhatsApp и
    Instagram ждут, пока напишет сотрудник. Владелец узнаёт сразу, а не из утренней сводки
    (аудит 03.10). Cron повторяет попытку каждую минуту — пишем не чаще раза в 3 часа.
    Текст ошибки не пересылаем: в нём бывает адрес Green API с ключом.
    """
    from .shop_router import _admin_phone
    try:
        if not await redis_client.set("bot:alerted", "1", ex=ALERT_QUIET, nx=True):
            return
        await _send_text(_admin_phone(), (
            f"⚠️ Онлайн-консультант сейчас не отвечает покупателям ({channel}): {why}.\n"
            f"Пока не заработает, отвечайте в {channel} сами. Следующее такое сообщение — не раньше чем через 3 часа."
        ))
    except Exception as error:
        # Не дошло — следующая попытка через минуту, а не через 3 часа. Redis лежит — тоже не падаем.
        logger.error(f"wa bot alert: {type(error).__name__}")
        try:
            await redis_client.delete("bot:alerted")
        except Exception:
            pass


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
    # Сайт ответил — дальше ошибки уже про отправку покупателю (Green API), «консультант
    # не отвечает» владельцу тогда не пишем: консультант как раз ответил.
    answered_by_site = False
    try:
        count_key = f"wa:count:{digits}:{_today()}"
        count = int(await redis_client.get(count_key) or 0)
        if count >= DAILY_LIMIT:
            return False

        asked = await _turns(digits)
        reply = await _ask_site(digits, name, asked)
        answered_by_site = bool(reply)
        if reply and reply.get("silent"):
            # Не покупатель (рабочие, родные, чужой бот) — робот в этом чате молчит 12 часов.
            # «Ок» и «{{SWE001}}» чат не глушат: следом идёт настоящий вопрос.
            if reply.get("mute"):
                await redis_client.set(f"wa:human:{digits}", "1", ex=HUMAN_QUIET)
                logger.info(f"wa bot: не для магазина, молчу ...{digits[-4:]}")
            return False
        if not reply:
            await alert_brain_down("WhatsApp", "сайт не ответил")
            return False
        if not reply.get("text"):
            return False
        # Модель недоступна (кончился лимит Gemini) — шаблонный ответ в WhatsApp не шлём:
        # человек написал живым людям, пусть ответит сотрудник.
        if reply.get("source") == "local":
            logger.warning("wa bot: модель недоступна — отвечать оставляю сотруднику")
            await alert_brain_down("WhatsApp", brain_why(reply.get("why")))
            return False
        text = str(reply["text"])
        if count + 1 >= DAILY_LIMIT:
            text += "\n\nДальше вам ответит руководство магазина."
        await _send_text(digits, text)
        await _send_photos(digits, await _new_photos(digits, reply.get("products") or []))
        await _remember(digits, "assistant", text, asked)
        await redis_client.set(count_key, str(count + 1), ex=2 * 24 * 3600)
        await redis_client.set(f"wa:botactive:{digits}", "1", ex=30 * 60)
        ids = [p.get("id") for p in reply.get("products") or [] if p.get("id")]
        if ids:
            await redis_client.set(f"wa:shown:{digits}", json.dumps(ids), ex=TURNS_TTL)
            # Показали товар — если покупатель замолчит, через 2 часа спросим «ещё актуально?».
            await redis_client.set(f"wa:nudge:{digits}", json.dumps({"ts": time.time(), "name": name}), ex=24 * 3600)
        # «Оыликдан кейин оламан», «эртең» — сайт (Jev) сказал, когда спросить снова:
        # напоминание «ещё актуально?» придёт тогда, а не через 2 часа. Разговор и
        # показанные товары помним до того дня.
        later = int(reply.get("followAfter") or 0)
        if later > 0:
            keep = later + 2 * 24 * 3600
            await redis_client.set(f"wa:nudge:{digits}", json.dumps({"ts": time.time() + later - NUDGE_AFTER, "name": name}), ex=keep)
            await redis_client.expire(f"wa:turns:{digits}", max(keep, TURNS_TTL))
            await redis_client.expire(f"wa:shown:{digits}", max(keep, TURNS_TTL))
        if count + 1 >= DAILY_LIMIT:
            await redis_client.set(f"wa:human:{digits}", "1", ex=HUMAN_QUIET)
        elif reply.get("handoff"):
            await redis_client.set(f"wa:human:{digits}", "1", ex=HANDOFF_QUIET)
        return True
    except Exception as error:
        logger.error(f"wa bot {digits[-4:]}: {error}")
        if not answered_by_site:
            await alert_brain_down("WhatsApp", "сайт не ответил вовремя, подробности в журнале сервера")
        return False


async def _ask_site(digits: str, name: str, asked: list[dict]) -> dict | None:
    from .shop_router import _site_base_url, _site_secret
    shown_raw = await redis_client.get(f"wa:shown:{digits}")
    payload = json.dumps({
        "phone": "+" + digits,
        "name": name,
        "messages": asked,
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


async def _new_photos(digits: str, products: list[dict]) -> list[dict]:
    """
    Товары, чьё фото в этом чате ещё не отправляли. Модель прикладывает тот же товар к
    каждому ответу — и покупатель (…8989, 01.10) получил одно фото со ссылкой шесть раз.
    """
    key = f"wa:photos:{digits}"
    try:
        sent = set(json.loads(await redis_client.get(key) or "[]"))
    except Exception:
        sent = set()
    fresh = [p for p in products if p.get("id") and p.get("id") not in sent]
    if fresh:
        sent.update(p["id"] for p in fresh[:MAX_PHOTOS])
        await redis_client.set(key, json.dumps(sorted(sent)), ex=TURNS_TTL)
    return fresh


async def _send_photos(digits: str, products: list[dict]) -> None:
    """Фото товара с подписью: название, цена, ссылка. Без фото — ничего не шлём."""
    from .shop_router import _site_base_url
    from .shop_whatsapp import _url
    host, instance, token = _url()
    async with httpx.AsyncClient(timeout=30) as client:
        for product in [p for p in products if str(p.get("image") or "").startswith("http")][:MAX_PHOTOS]:
            # Фото одно (MAX_PHOTOS) — и ссылка одна: так шлёт товар и сам владелец
            # («smarket.kg/ru/product/…»), покупатель открывает и смотрит размеры и фото.
            caption = f"{product.get('name')} — {product.get('priceLabel')}"
            href = str(product.get("href") or "")
            if href.startswith("/"):
                caption += f"\n{_site_base_url()}{href}"
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
        if await redis_client.get(f"wa:human:{digits}") or await redis_client.get(f"wa:saved:{digits}"):
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
    waiting = await _waiting_chats()
    if waiting:
        text += "\n\n" + "\n".join(waiting)
    hot = await _hot_leads()
    if hot:
        text += "\n\n" + "\n".join(hot)
    await _send_text(_admin_phone(), text)
    logger.info(f"wa digest: отправлена за {data.get('day')} ({data.get('count')} вопросов, ждут ответа: {max(len(waiting) - 1, 0)})")
    return True


# Бот сказал «уточню у руководства» / «позвоним» — дальше ход за владельцем.
PROMISED = re.compile(r"(руководств\w*\s+(тактап|аниклаб|етказ|айт|уточн|передам|свяж|чал|позвон)|уточню у руководства|чалабыз|позвоним|кунгирок киламиз)", re.I)


# «Ок», «рахмат», «хоп» в конце — покупатель закончил разговор (если бот ничего не обещал).
THANKS = re.compile(r"((^|\W)(ок|ok|окей|хоп|хуп|макул|жарайт|майли|болду|xop|mayli)\W*$|(рахмат|рахмет|рахмад|раҳмат|rahmat|спасибо|благодарю)\W*$)", re.I)


def waiting_lines(chats: list[tuple[str, list[dict]]], limit: int = 12) -> list[str]:
    """
    «Ждут ответа» для утренней сводки: последнее слово в чате за покупателем, или бот
    пообещал ответ руководства, а владелец так и не написал. 01.10 так молча ждали
    стиралка под гарантию, Умар с эндуро, мама со скутером — никто не видел.
    """
    rows = []
    for digits, turns in chats:
        if not turns:
            continue
        last = turns[-1]
        asked = [t["text"] for t in turns if t.get("role") == "user"]
        if not asked:
            continue
        bot_said = next((str(t.get("text") or "") for t in reversed(turns) if t.get("role") != "user"), "")
        if last.get("role") == "user" and THANKS.search(str(last.get("text") or "")) and not PROMISED.search(bot_said):
            continue  # «А ок рахмат», «Хоп рахмад» — разговор закончен, никто не ждёт
        if last.get("role") == "user" or PROMISED.search(str(last.get("text") or "")):
            said = re.sub(r"^\[[^\]]*\]\s*", "", asked[-1]).replace("\n", " ").strip()
            said = said[:80] + ("…" if len(said) > 80 else "")
            # WhatsApp — номер, Instagram — уже готовая подпись («Instagram @ник»).
            who = f"+{digits}" if digits.isdigit() else digits
            rows.append(f"• {who} — «{said}»")
    if not rows:
        return []
    more = f"\n…и ещё {len(rows) - limit}" if len(rows) > limit else ""
    return [f"⏳ Ждут ответа — {len(rows)} (бот не смог ответить или обещал руководство):"] + rows[:limit] + ([more] if more else [])


async def _waiting_chats() -> list[str]:
    """Чаты вчера и сегодня (по Бишкеку), где покупатель ждёт человека: WhatsApp и Instagram. Записанные в телефоне — не наши."""
    days = {_today(), (_bishkek_now() - timedelta(days=1)).strftime("%Y%m%d")}
    chats = []
    try:
        seen = set()
        async for key in redis_client.scan_iter(match="wa:count:*", count=500):
            parts = str(key).split(":")
            if len(parts) != 4 or parts[3] not in days or parts[2] in seen:
                continue
            digits = parts[2]
            seen.add(digits)
            if await redis_client.get(f"wa:saved:{digits}"):
                continue
            chats.append((digits, await _turns(digits)))
    except Exception as error:
        logger.warning(f"wa digest: список ждущих не собран: {error}")
        return []
    try:
        from .shop_ig_bot import waiting_chats as instagram_chats
        chats += await instagram_chats(days)
    except Exception as error:
        logger.warning(f"wa digest: Instagram не добавлен: {error}")
    return waiting_lines(chats)


async def _hot_leads() -> list[str]:
    """
    «Кому позвонить сегодня» для сводки (Jev, 04.10): вчерашние разговоры WhatsApp и Instagram →
    сайт (/api/assistant/hot) → Jev оценивает, кто почти купил и что его остановило. Номер в Jev не
    уходит: сайт шлёт ему только текст, а номер возвращается только в сводку владельцу. Записанные в
    телефоне (знакомые) — не наши. Любая ошибка — сводка уходит без этого блока.
    """
    try:
        from .shop_router import _site_base_url, _site_secret
        day = (_bishkek_now() - timedelta(days=1)).strftime("%Y%m%d")
        chats, seen = [], set()
        async for key in redis_client.scan_iter(match="wa:count:*", count=500):
            parts = str(key).split(":")
            if len(parts) != 4 or parts[3] != day or parts[2] in seen:
                continue
            digits = parts[2]
            seen.add(digits)
            if await redis_client.get(f"wa:saved:{digits}"):
                continue
            # Один испорченный разговор не должен убрать из сводки весь блок.
            try:
                raw = await redis_client.get(f"wa:week:{digits}") or await redis_client.get(f"wa:turns:{digits}")
                turns = json.loads(raw) if raw else []
                shown_raw = await redis_client.get(f"wa:shown:{digits}")
                shown = json.loads(shown_raw) if shown_raw else []
            except Exception:
                continue
            if turns:
                chats.append({"who": f"+{digits}", "messages": turns, "shown": shown})
        try:
            from .shop_ig_bot import waiting_chats as instagram_chats
            for label, turns in await instagram_chats({day}):
                if turns:
                    chats.append({"who": label, "messages": turns, "shown": []})
        except Exception as error:
            logger.warning(f"hot leads: Instagram не добавлен: {type(error).__name__}")
        if not chats:
            return []
        payload = json.dumps({"chats": chats}, ensure_ascii=False)
        signature = hmac.new(_site_secret().encode(), payload.encode("utf-8"), hashlib.sha256).hexdigest()
        async with httpx.AsyncClient(timeout=150) as client:
            response = await client.post(
                f"{_site_base_url()}/api/assistant/hot",
                content=payload.encode("utf-8"),
                headers={"Content-Type": "application/json", "X-Signature": signature},
            )
        data = response.json() if response.status_code == 200 else {}
        lines = [str(x) for x in (data.get("lines") or [])]
        logger.info(f"hot leads: {len(chats)} разговоров, в сводку {len(lines)} строк")
        return lines
    except Exception as error:
        logger.warning(f"hot leads: {type(error).__name__}: {error}")
        return []


DIGEST_HOUR = 9


WAITING_HOURS = (13, 17)


async def send_quality() -> bool:
    """
    Понедельник: разговоры WhatsApp за 7 дней → сайт (Jev оценивает каждый) → итог владельцу.
    Записанные в телефоне (знакомые) не отправляем. Номера в Jev не уходят: сайт шлёт только текст.
    """
    from .shop_router import _admin_phone, _site_base_url, _site_secret
    now = _bishkek_now()
    days = {(now - timedelta(days=i)).strftime("%Y%m%d") for i in range(1, 8)}
    chats, seen = [], set()
    async for key in redis_client.scan_iter(match="wa:count:*", count=500):
        parts = str(key).split(":")
        if len(parts) != 4 or parts[3] not in days or parts[2] in seen:
            continue
        digits = parts[2]
        seen.add(digits)
        if await redis_client.get(f"wa:saved:{digits}"):
            continue
        raw = await redis_client.get(f"wa:week:{digits}") or await redis_client.get(f"wa:turns:{digits}")
        try:
            turns = json.loads(raw) if raw else []
        except Exception:
            turns = []
        if turns:
            chats.append({"phone": digits, "messages": turns})
    if not chats:
        return False
    payload = json.dumps({
        "from": (now - timedelta(days=7)).strftime("%d.%m"),
        "to": (now - timedelta(days=1)).strftime("%d.%m"),
        "chats": chats,
    }, ensure_ascii=False)
    signature = hmac.new(_site_secret().encode(), payload.encode("utf-8"), hashlib.sha256).hexdigest()
    async with httpx.AsyncClient(timeout=180) as client:
        response = await client.post(
            f"{_site_base_url()}/api/assistant/quality",
            content=payload.encode("utf-8"),
            headers={"Content-Type": "application/json", "X-Signature": signature},
        )
    data = response.json() if response.status_code == 200 else {}
    text = str(data.get("text") or "")
    if not text:
        logger.info(f"wa quality: отчёта нет ({response.status_code}, {data.get('skip') or data.get('error')})")
        return False
    await _send_text(_admin_phone(), text)
    logger.info(f"wa quality: отправлен ({data.get('count')} разговоров)")
    return True


async def send_waiting() -> bool:
    """
    Днём — только «Ждут ответа», без сводки: как в колл-центре, покупатель не должен ждать
    до утра. Пусто — ничего не шлём.
    """
    from .shop_router import _admin_phone
    waiting = await _waiting_chats()
    if not waiting:
        return False
    await _send_text(_admin_phone(), "\n".join(waiting))
    logger.info(f"wa waiting: отправлен список ({len(waiting) - 1})")
    return True


def run_digest() -> None:
    """Запуск из cron раз в час: в 9 утра сводка, в 13 и 17 — кто ждёт ответа. Каждое — раз в день."""
    hour = _bishkek_now().hour
    if hour in WAITING_HOURS:
        logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")

        async def waiting_once() -> None:
            try:
                key = f"wa:waiting:{_bishkek_now().strftime('%Y%m%d')}:{hour}"
                if await redis_client.set(key, "1", ex=2 * 24 * 3600, nx=True):
                    await send_waiting()
            finally:
                await _close_redis()

        try:
            asyncio.run(waiting_once())
        except Exception as error:
            logger.error(f"wa waiting: {error}")
        return
    if hour != DIGEST_HOUR:
        return
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")

    async def once() -> None:
        try:
            day = _bishkek_now().strftime("%Y%m%d")
            if not await redis_client.set(f"wa:digest:{day}", "1", ex=2 * 24 * 3600, nx=True):
                return
            await send_digest()
            # Понедельник — ещё и оценка качества за неделю (отдельно: сводка не должна от неё зависеть).
            if _bishkek_now().weekday() == 0:
                try:
                    await send_quality()
                except Exception as error:
                    logger.error(f"wa quality: {error}")
                # И Instagram за неделю (04.10): охват, подписчики, лучшие посты и истории, Direct.
                try:
                    from .shop_ig_stats import send_week_report
                    await send_week_report()
                except Exception as error:
                    logger.error(f"ig week report: {error}")
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
        # У ConnectError текст пустой — без имени класса в журнале было «ошибка: ».
        print(f"{datetime.now():%Y-%m-%d %H:%M} ошибка: {type(error).__name__}: {error}")
