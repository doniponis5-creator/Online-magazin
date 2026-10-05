"""
Интернет-магазин Smart Centr — продавец в Instagram (Direct).

Покупатели пишут в Direct аккаунта магазина. Отвечают там живые люди. Робот
вступает так же, как в WhatsApp (shop_wa_bot.py), — только если человек не ответил:

  • пришло сообщение — ждём SITE_WA_DELAY_MIN минут (та же настройка, что у WhatsApp);
  • за это время сотрудник ответил из Instagram — робот молчит в этом чате 12 часов;
  • не ответил — робот отвечает как продавец на сайте: цена, фото, ссылка;
  • больше 30 ответов одному человеку за день — дальше отвечает сотрудник;
  • покупатель посмотрел товар и замолчал на 2 часа — робот один раз спрашивает
    «ещё актуально?», но только пока открыто окно Meta (23 часа после сообщения покупателя).

Отличия от WhatsApp:
  • сообщения приходят webhook'ом Meta (POST /api/v1/webhook/instagram), а не опросом;
    webhook только кладёт событие в очередь Redis, всё остальное делает cron раз в минуту;
  • номера телефона нет — сайт не называет бонусов и заказов, для заказа спросит номер;
  • ответ сотрудника узнаём по «эху»: Instagram присылает копию каждого исходящего
    сообщения. Свои ответы робот помечает (id и отпечаток текста) и не путает с людьми.

Мозг — тот же, что у чата на сайте: POST {SHOP_SITE_BASE_URL}/api/channel/instagram,
подпись SHOP_SITE_SECRET.

Настройки в .env.production:
  IG_ACCESS_TOKEN  — ключ Instagram (из кабинета разработчика Meta), без него робот выключен;
                     живёт 60 дней, робот сам продлевает его раз в сутки (новый — в Redis, ig:token);
  IG_APP_SECRET    — секрет приложения Instagram: им Meta подписывает webhook;
  IG_VERIFY_TOKEN  — любое слово; то же самое вводится в кабинете Meta при подключении webhook.
"""
from __future__ import annotations

import asyncio
import hashlib
import hmac
import json
import logging
import time

import httpx
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import PlainTextResponse

from app.core.redis import redis_client

from . import shop_ig_rules as rules
from .shop_router import _cfg

logger = logging.getLogger("sbonus.shop.ig_bot")

router_ig_bot = APIRouter(prefix="/webhook/instagram", tags=["Instagram: продавец"])

HUMAN_QUIET = 12 * 3600          # сотрудник ответил — робот молчит в чате столько
HANDOFF_QUIET = 3600             # робот сам передал руководству — молчит час
TURNS_TTL = 3 * 24 * 3600        # сколько помним разговор
MAX_TURNS = 12                   # сколько реплик отдаём мозгу
DAILY_LIMIT = 30                 # ответов робота одному человеку за сутки
MAX_PHOTOS = 1
NUDGE_AFTER = 2 * 3600           # покупатель молчит столько после показа товара — напоминаем
NUDGE_QUIET = 3 * 24 * 3600      # не чаще раза в столько на один чат
INBOX_MAX = 2000                 # очередь webhook'а: больше не держим
STALE_AFTER = 3 * 3600           # сообщение старше — робот на него уже не отвечает


# Ключ Instagram живёт 60 дней. Раз в сутки продлеваем его, новый храним в Redis
# (ig:token) вместе с отпечатком ключа из .env.production. Владелец вписал в .env
# новый ключ — отпечаток не совпал, продлённый старый больше не берём.
TOKEN_TTL = 60 * 24 * 3600
_fresh = {"token": ""}


def _base_token() -> str:
    return _cfg("ig_access_token")


def _base_mark() -> str:
    return hashlib.sha256(_base_token().encode("utf-8")).hexdigest()[:16]


def _token() -> str:
    return _fresh["token"] or _base_token()


async def _load_token() -> str:
    """Продлённый ключ из Redis, если он от того же ключа, что в .env. Без ключа в .env робот выключен."""
    if not _base_token():
        _fresh["token"] = ""
        return ""
    try:
        stored = json.loads(await redis_client.get("ig:token") or "{}")
    except Exception:
        stored = {}
    # Одним присваиванием после чтения: пока ждём Redis, ответ в Direct не должен уйти со старым ключом из .env
    # (ревью 04.10 — посты из 1С зовут эту функцию часто).
    fresh = str(stored.get("token") or "") if isinstance(stored, dict) and stored.get("base") == _base_mark() else ""
    _fresh["token"] = fresh
    return _token()


async def _refresh_token() -> None:
    """Раз в сутки: продлить ключ ещё на 60 дней (Meta разрешает, если ключу больше суток)."""
    if not await redis_client.set(f"ig:refreshed:{_today()}", "1", ex=2 * 24 * 3600, nx=True):
        return
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.get(
                f"{rules.GRAPH.rsplit('/', 1)[0]}/refresh_access_token",
                params={"grant_type": "ig_refresh_token", "access_token": _token()},
            )
        token = str(response.json().get("access_token") or "") if response.status_code == 200 else ""
        if token:
            await redis_client.set("ig:token", json.dumps({"token": token, "base": _base_mark()}), ex=TOKEN_TTL)
            _fresh["token"] = token
            logger.info("ig bot: ключ Instagram продлён на 60 дней")
        else:
            logger.warning(f"ig bot: ключ не продлён ({response.status_code}): {response.text[:200]}")
    except Exception as error:
        logger.warning(f"ig bot: ключ не продлён: {error}")


def _app_secret() -> str:
    return _cfg("ig_app_secret")


def _verify_token() -> str:
    return _cfg("ig_verify_token")


# ── Webhook Meta ─────────────────────────────────────────────────────────────

@router_ig_bot.get("")
async def verify(request: Request):
    """Meta проверяет адрес при подключении: вернуть hub.challenge, если слово совпало."""
    params = request.query_params
    word = _verify_token()
    if params.get("hub.mode") == "subscribe" and word and hmac.compare_digest(params.get("hub.verify_token", ""), word):
        return PlainTextResponse(params.get("hub.challenge", ""))
    raise HTTPException(403, "forbidden")


@router_ig_bot.post("")
async def incoming(request: Request):
    """Только проверить подпись и положить события в очередь: Meta ждёт ответа быстро."""
    body = await request.body()
    if not rules.signature_ok(_app_secret(), body, request.headers.get("x-hub-signature-256", "")):
        # Видно в docker logs sbonus_api: так узнаём, что Meta подписывает другим секретом.
        logger.warning("ig webhook: подпись не сошлась — проверьте IG_APP_SECRET")
        raise HTTPException(403, "forbidden")
    try:
        payload = json.loads(body)
    except Exception:
        return {"ok": True}
    found = rules.events(payload)
    for event in found:
        await redis_client.rpush("ig:inbox", json.dumps(event, ensure_ascii=False))
    if found:
        await redis_client.ltrim("ig:inbox", -INBOX_MAX, -1)
    # Комментарии под постами — своя очередь: им отвечает не разговор Direct, а шаблон (04.10).
    comments = rules.comment_events(payload)
    for event in comments:
        await redis_client.rpush("ig:comments", json.dumps(event, ensure_ascii=False))
    if comments:
        await redis_client.ltrim("ig:comments", -INBOX_MAX, -1)
    return {"ok": True}


# ── Разговор ─────────────────────────────────────────────────────────────────

def _today() -> str:
    from .shop_wa_bot import _today as today
    return today()


async def _turns(user: str) -> list[dict]:
    raw = await redis_client.get(f"ig:turns:{user}")
    try:
        return json.loads(raw) if raw else []
    except Exception:
        return []


async def _remember(user: str, role: str, text: str, asked: list[dict] | None = None) -> None:
    current = await _turns(user)
    # Ответ — сразу после реплик, на которые он отвечал (shop_ig_rules.place_answer).
    turns = rules.place_answer(current, asked, text) if role == "assistant" else current + [{"role": role, "text": text[:800]}]
    await redis_client.set(f"ig:turns:{user}", json.dumps(turns[-MAX_TURNS:], ensure_ascii=False), ex=TURNS_TTL)


async def _first_time(mid: str) -> bool:
    return bool(await redis_client.set(f"ig:seen:{mid}", "1", ex=2 * 24 * 3600, nx=True))


async def _profile(user: str, fetch: bool = True) -> dict:
    """
    Имя и @ник покупателя. Instagram отдаёт их тем, кто сам написал магазину. Помним месяц.
    fetch=False — только то, что уже знаем (сводке владельцу некогда ждать Instagram).
    """
    key = f"ig:profile:{user}"
    raw = await redis_client.get(key)
    if raw:
        try:
            return json.loads(raw)
        except Exception:
            pass
    profile = {}
    if not fetch:
        return profile
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.get(
                f"{rules.GRAPH}/{user}",
                params={"fields": "name,username"},
                headers={"Authorization": f"Bearer {_token()}"},
            )
        if response.status_code == 200:
            data = response.json()
            profile = {"name": str(data.get("name") or "")[:60], "username": str(data.get("username") or "")[:60]}
    except Exception as error:
        logger.warning(f"ig profile: {error}")
    await redis_client.set(key, json.dumps(profile, ensure_ascii=False), ex=30 * 24 * 3600 if profile else 3600)
    return profile


async def _ours(event: dict) -> bool:
    """Эхо нашего же ответа: по id сообщения или по отпечатку текста (id мог не успеть записаться)."""
    user = event["user"]
    if await redis_client.sismember(f"ig:mine:{user}", event["mid"]):
        return True
    text = event.get("text") or ""
    if text:
        return bool(await redis_client.get(f"ig:mytext:{user}:{rules.text_key(text)}"))
    return bool(event.get("media")) and bool(await redis_client.get(f"ig:myphoto:{user}"))


async def _auto_reply(user: str, text: str) -> bool:
    """
    Мгновенный ответ Instagram («Спасибо за сообщение…»), а не живой сотрудник.
    Как в WhatsApp: по типичным словам или по повтору одного текста в двух чатах.
    Повторы считаем отдельно от WhatsApp: условия доставки, вставленные сотрудником
    в WhatsApp и в Instagram, — это человек, а не шаблон.
    """
    from .shop_wa_bot import AUTO_REPLY_RE
    text = text.strip()
    if not text:
        return False
    if AUTO_REPLY_RE.search(text):
        return True
    if len(text) < 40:
        return False
    key = "ig:outtext:" + hashlib.sha1(text.encode("utf-8")).hexdigest()
    await redis_client.sadd(key, user)
    await redis_client.expire(key, 7 * 24 * 3600)
    return await redis_client.scard(key) >= 2


async def _on_echo(event: dict) -> None:
    """Магазин написал покупателю. Не робот и не автоответ — значит, сотрудник: робот молчит."""
    if await _ours(event):
        return
    user = event["user"]
    text = event.get("text") or ""
    # Мгновенный ответ Instagram уходит «от магазина», но это не человек.
    if text and await _auto_reply(user, text):
        return
    await redis_client.set(f"ig:human:{user}", "1", ex=HUMAN_QUIET)
    await redis_client.delete(f"ig:botactive:{user}")
    await redis_client.hdel("ig:pending", user)
    if text:
        await _remember(user, "assistant", text)


async def _on_message(event: dict) -> None:
    """Покупатель написал: в разговор и в очередь ожидания."""
    from .shop_wa_bot import _read_media
    if rules.mention_only(event):
        return
    user = event["user"]
    await _stat("dm", user)
    if event.get("story"):
        # Ответ на нашу историю — подставляем товар с неё: «Канча?» без него не понять.
        from .shop_ig_post import describe_story
        note = await describe_story(str(event["story"]))
        if not note:
            # Историю выложили вручную, товара о ней мы не знаем — смотрим, что на картинке (один раз на историю).
            seen = await _seen_story(str(event["story"]), str(event.get("story_url") or ""))
            if seen:
                event = {**event, "context": [seen if c == rules.STORY_NOTE else c for c in event.get("context") or []]}
        if note:
            event = {**event, "context": [note if c == rules.STORY_NOTE else c for c in event.get("context") or []]}
            await _show_story_product(user, event["story"])
            await _stat("storyreply")
            # Короткое «Канча?», «+» на нашу историю — ответим шаблоном с фото и ссылкой, без Gemini (_story_reply).
            if len(str(event.get("text") or "")) <= rules.STORY_QUICK_MAX and not event.get("media"):
                await redis_client.set(f"ig:storyreply:{user}", json.dumps({"story": str(event["story"]), "text": str(event.get("text") or "")}, ensure_ascii=False), ex=3600)
    text = rules.describe(event)
    voice = False
    for media in (event.get("media") or [])[:1]:
        # Голосовое → текст, фото → описание. Читает сайт, как в WhatsApp.
        heard = await _read_media({"downloadUrl": media["url"], "mimeType": "", "caption": ""}, media["kind"])
        if heard:
            text = f"{text}\n{heard}".strip()
        elif media["kind"] == "audio" and not text:
            voice = True
    if not text and not voice:
        return
    if text:
        await _remember(user, "user", text)
    await redis_client.set(f"ig:lastin:{user}", str(event.get("ts") or time.time()), ex=2 * 24 * 3600)
    await redis_client.delete(f"ig:nudge:{user}")
    await redis_client.hset("ig:pending", user, json.dumps({"ts": event.get("ts") or time.time(), "voice": voice}))


async def _seen_story(story_id: str, url: str) -> str:
    """
    Что на истории, выложенной вручную: картинку (из webhook или по id) читает сайт, как фото покупателя.
    Помним сутки на историю — двадцать ответов на одну историю не читают её двадцать раз.
    """
    if not story_id:
        return ""
    key = f"ig:storyseen:{story_id}"
    cached = await redis_client.get(key)
    if cached is not None:
        return str(cached)
    from .shop_wa_bot import _read_media
    note = ""
    try:
        if not url:
            async with httpx.AsyncClient(timeout=15) as client:
                response = await client.get(f"{rules.GRAPH}/{story_id}", params={"fields": "media_type,media_url,thumbnail_url"},
                                            headers={"Authorization": f"Bearer {_token()}"})
            if response.status_code == 200:
                data = response.json()
                url = str(data.get("thumbnail_url") or data.get("media_url") or "")
        if url.startswith("https://"):
            note = rules.seen_story_note(await _read_media({"downloadUrl": url, "mimeType": "", "caption": ""}, "image"))
    except Exception as error:
        logger.info(f"ig story seen ...{story_id[-4:]}: {type(error).__name__}")
    # Не вышло — попробуем снова через час, а не на каждый ответ.
    await redis_client.set(key, note, ex=24 * 3600 if note else 3600)
    return note


async def _show_story_product(user: str, story_id: str) -> None:
    """Товар истории — в «показанные»: на «оформляем» робот возьмёт его, а не спросит «какой?»."""
    raw = await redis_client.get(f"ig:story:{story_id}")
    try:
        code = str(json.loads(raw).get("code") or "") if raw else ""
    except Exception:
        code = ""
    if code and not await redis_client.get(f"ig:shown:{user}"):
        from .shop_promo_rules import slug_from_code
        await redis_client.set(f"ig:shown:{user}", json.dumps([slug_from_code(code)]), ex=TURNS_TTL)


async def _ensure_ice_breakers() -> None:
    """
    Готовые вопросы в Direct (rules.ICE_BREAKERS): ставим один раз и заново — только если список поменяли.
    Не вышло — попробуем через сутки, ответам в Direct это не мешает.
    """
    payload = rules.ice_breakers_payload()
    mark = hashlib.sha256(json.dumps(payload, ensure_ascii=False, sort_keys=True).encode()).hexdigest()[:12]
    if await redis_client.get(f"ig:icebreakers:{mark}") or not await redis_client.set("ig:icebreakers:try", "1", ex=24 * 3600, nx=True):
        return
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.post(f"{rules.GRAPH}/me/messenger_profile", headers={"Authorization": f"Bearer {_token()}"}, json=payload)
        if response.status_code == 200:
            await redis_client.set(f"ig:icebreakers:{mark}", "1")
            logger.info("ig bot: готовые вопросы в Direct поставлены")
        else:
            logger.warning(f"ig bot: готовые вопросы не поставлены ({response.status_code}): {response.text[:200]}")
    except Exception as error:
        logger.warning(f"ig bot: готовые вопросы не поставлены: {error}")


async def _story_reply(user: str) -> bool:
    """
    Ответ на нашу историю коротким «Канча?» / «+» / «Баасы»: товар истории известен — сразу фото,
    цена и ссылка на сайт (ссылку-стикер на историю Instagram через программу не даёт). Без Gemini.
    Дальше разговор ведёт обычный робот: товар уже в «показанных».
    """
    raw = await redis_client.get(f"ig:storyreply:{user}")
    if not raw:
        return False
    await redis_client.delete(f"ig:storyreply:{user}")
    try:
        ask = json.loads(raw)
        story = json.loads(await redis_client.get(f"ig:story:{ask.get('story')}") or "null")
    except Exception:
        story = None
    if not story or not story.get("slug"):
        return False
    # Пока ждали сотрудника, покупатель дописал вопрос — пусть отвечает Gemini, шаблон его не покроет.
    last = next((t.get("text") or "" for t in reversed(await _turns(user)) if t.get("role") == "user"), "")
    if not last.strip().endswith(str(ask.get("text") or "").strip()):
        return False
    from .shop_router import _site_base_url
    lang = rules.talk_lang(str(ask.get("text") or ""))
    link = rules.product_link(_site_base_url(), str(story["slug"]), lang)
    text = rules.story_answer(lang, str(story.get("name") or ""), int(story.get("price") or 0), int(story.get("oldPrice") or 0), link)
    try:
        # В тексте — ссылка на товар: Instagram сам покажет карточку с его фото; отдельное фото было бы вторым.
        await _send_text(user, text)
    except Exception as error:
        logger.warning(f"ig story reply: {error}")
        return False
    await _remember(user, "assistant", text)
    await redis_client.set(f"ig:botactive:{user}", "1", ex=30 * 60)
    return True


async def _stat_media(media: str, caption: str) -> None:
    """Под каким постом спрашивают (shop_ig_stats.count_media); ошибка ответу не мешает."""
    try:
        from .shop_ig_stats import count_media
        await count_media(media, caption)
    except Exception as error:
        logger.info(f"ig stats media: {type(error).__name__}")


async def _stat(kind: str, user: str = "") -> None:
    """Счётчики для недельного отчёта (shop_ig_stats): ошибка счётчика ответу покупателю не мешает."""
    try:
        from .shop_ig_stats import count, count_dm
        if kind == "dm":
            await count_dm(user)
        else:
            await count(kind)
    except Exception as error:
        logger.info(f"ig stats {kind}: {type(error).__name__}")


async def _switched_on() -> bool:
    """Галочка «Instagram-консультант» в 1С («Панель сайта»). Нет связи с базой — считаем включённым."""
    from app.core.database import async_session
    from .shop_admin import _values
    try:
        async with async_session() as db:
            values = await _values(db)
        return values.get("SITE_IG_BOT", "1") == "1"
    except Exception as error:
        logger.warning(f"ig bot settings: {error}")
        return True


async def poll_once() -> dict:
    if not await _load_token():
        # Робот выключен — webhook всё равно копит сообщения. Выбрасываем их, иначе после
        # включения робот ответил бы на всё накопленное разом и с опозданием.
        await redis_client.delete("ig:inbox", "ig:pending", "ig:comments")
        return {"enabled": False}
    await _refresh_token()
    await _ensure_ice_breakers()
    # Авто-история (галочка в 1С) — сама решает, пора ли; ошибка её не мешает ответам в Direct.
    try:
        from .shop_ig_post import auto_story
        await auto_story()
    except Exception as error:
        logger.warning(f"ig auto story: {type(error).__name__}: {error}")
    # Цифры живых историй — раз в час: через сутки Instagram их не отдаст, а отчёт — в понедельник.
    try:
        from .shop_ig_stats import collect_stories
        await collect_stories()
    except Exception as error:
        logger.info(f"ig stats: {type(error).__name__}: {error}")
    from .shop_wa_bot import _settings
    _, delay = await _settings()
    on = await _switched_on()

    # Сначала всё, что принёс webhook, — по порядку.
    while True:
        raw = await redis_client.lpop("ig:inbox")
        if raw is None:
            break
        try:
            event = json.loads(raw)
        except Exception:
            continue
        if not await _first_time(str(event.get("mid"))):
            continue
        if event.get("kind") == "echo":
            await _on_echo(event)
        elif on:
            await _on_message(event)
        elif not rules.mention_only(event) and rules.describe(event):
            # Выключен в 1С: разговор и ответы сотрудников всё равно записываем (без платной
            # расшифровки голоса) — после включения робот не спорит с тем, что сказал человек.
            await _remember(event["user"], "user", rules.describe(event))
    if not on:
        # На накопленное не отвечаем: после включения робот не ответит на старое разом.
        await redis_client.delete("ig:pending", "ig:comments")
        return {"enabled": False}

    answered = 0
    now = time.time()
    for user, raw in (await redis_client.hgetall("ig:pending")).items():
        try:
            pending = json.loads(raw)
        except Exception:
            await redis_client.hdel("ig:pending", user)
            continue
        if await redis_client.get(f"ig:human:{user}"):
            await redis_client.hdel("ig:pending", user)
            continue
        # Сервер лежал несколько часов — на старое не отвечаем: «Есть!» через полдня
        # выглядит хуже молчания, а такие чаты сотрудник увидит в сводке «Ждут ответа».
        if now - float(pending.get("ts") or now) > STALE_AFTER:
            await redis_client.hdel("ig:pending", user)
            continue
        wait = 0 if await redis_client.get(f"ig:botactive:{user}") else delay * 60
        if now - float(pending.get("ts") or now) < wait:
            continue
        await redis_client.hdel("ig:pending", user)
        if pending.get("voice"):
            if await _ask_for_text(user):
                answered += 1
        elif await _story_reply(user):
            answered += 1
        elif await _answer(user, pending):
            answered += 1
    nudged = await _nudge_silent()
    # Комментарии — последними: сначала люди, которые уже пишут в Direct.
    commented = await _handle_comments()
    return {"enabled": True, "answered": answered, "nudged": nudged, "comments": commented}


# ── Комментарии под постами (04.10) ──────────────────────────────────────────
# Что делать — решает сайт (/api/channel/instagram-comment: Jev + шаблон, без Gemini); здесь только
# выполняем: ответ под комментарием, личный ответ в Direct (Instagram разрешает один на комментарий,
# в течение 7 дней), скрыть спам. Ответ человека в Direct дальше ведёт обычный робот — у него уже
# записаны наш первый ответ и товар поста.

COMMENTS_PER_RUN = 30            # за один запуск cron: под рекламой их бывает сотни
COMMENTS_PER_USER = 3            # одному человеку в день: «+», «+», «+» — один ответ, не десять
COMMENT_STALE = 24 * 3600        # старше суток не отвечаем: «Директке жаздык» через два дня — странно


async def _caption(media: str) -> str:
    """Подпись поста — по ней сайт узнаёт товар. Помним сутки."""
    if not media:
        return ""
    key = f"ig:caption:{media}"
    cached = await redis_client.get(key)
    if cached is not None:
        return str(cached)
    caption = ""
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.get(f"{rules.GRAPH}/{media}", params={"fields": "caption"}, headers={"Authorization": f"Bearer {_token()}"})
        if response.status_code == 200:
            caption = str(response.json().get("caption") or "")[:1000]
    except Exception as error:
        logger.warning(f"ig caption: {type(error).__name__}")
    await redis_client.set(key, caption, ex=24 * 3600 if caption else 600)
    return caption


async def _graph_post(path: str, **kwargs) -> dict:
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.post(f"{rules.GRAPH}/{path}", headers={"Authorization": f"Bearer {_token()}"}, **kwargs)
    if response.status_code != 200:
        raise RuntimeError(f"Instagram {response.status_code}: {response.text[:200]}")
    try:
        return response.json()
    except Exception:
        return {}


async def _plan_comment(event: dict, caption: str) -> dict:
    from .shop_router import _site_base_url, _site_secret
    payload = json.dumps({"id": event["id"], "text": event["text"], "caption": caption, "username": event.get("username") or ""}, ensure_ascii=False)
    signature = hmac.new(_site_secret().encode(), payload.encode("utf-8"), hashlib.sha256).hexdigest()
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            f"{_site_base_url()}/api/channel/instagram-comment",
            content=payload.encode("utf-8"),
            headers={"Content-Type": "application/json", "X-Signature": signature},
        )
    data = response.json() if response.status_code == 200 else {}
    return data if data.get("ok") else {}


async def _own_username() -> str:
    """Ник аккаунта магазина: его комментарии — ответы сотрудников, им робот не отвечает. Помним сутки."""
    cached = await redis_client.get("ig:own_username")
    if cached is not None:
        return str(cached)
    name = ""
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.get(f"{rules.GRAPH}/me", params={"fields": "username"}, headers={"Authorization": f"Bearer {_token()}"})
        if response.status_code == 200:
            name = str(response.json().get("username") or "")
    except Exception as error:
        logger.warning(f"ig own username: {type(error).__name__}")
    await redis_client.set("ig:own_username", name, ex=24 * 3600 if name else 600)
    return name


async def _alert_complaint(event: dict, caption: str) -> None:
    """Жалоба в комментарии → владельцу в WhatsApp — уже после того, как ответ в Direct ушёл. Раз в день на человека."""
    user = str(event.get("user") or "")
    key = f"ig:calert:{user}:{_today()}"
    if not await redis_client.set(key, "1", ex=2 * 24 * 3600, nx=True):
        return
    from .shop_router import _admin_phone
    from .shop_wa_bot import _send_text as send_whatsapp
    who = f"@{event.get('username')}" if event.get("username") else f"id {user}"
    post = f"\nПод постом: {' '.join(caption.split())[:200]}" if caption else ""
    try:
        await send_whatsapp(_admin_phone(), (
            f"🚨 ЖАЛОБА — Instagram, комментарий\n━━━━━━━━━━━━━━━━━━━\n👤 Instagram {who}\n\n"
            f"Написал под постом:\n{str(event.get('text') or '')[:500]}{post}\n\n"
            "Робот извинился и написал ему в Direct — продолжите разговор там."
        ))
    except Exception as error:
        await redis_client.delete(key)
        logger.error(f"ig comment alert: {type(error).__name__}")


async def _handle_comments(budget: float = 20.0) -> int:
    """
    Очередь комментариев: решение сайта → ответ, Direct, скрыть. Ошибка одного не мешает другим.
    Идёт после ответов в Direct и не дольше budget секунд: под рекламой их сотни, а покупатель в
    Direct ждать не должен (ревью 04.10). Что не успели — разберём в следующую минуту.
    """
    done, started = 0, time.monotonic()
    own = await _own_username()
    for _ in range(COMMENTS_PER_RUN):
        if time.monotonic() - started > budget:
            break
        raw = await redis_client.lpop("ig:comments")
        if raw is None:
            break
        try:
            event = json.loads(raw)
        except Exception:
            continue
        cid, user, media = str(event.get("id") or ""), str(event.get("user") or ""), str(event.get("media") or "")
        # Наш же ответ под комментарием вернулся webhook'ом, или пишет сам магазин (сотрудник) — не отвечаем.
        if not cid or not user or await redis_client.get(f"ig:myreply:{cid}"):
            continue
        if own and str(event.get("username") or "").lower() == own.lower():
            continue
        if not await _first_time(str(event.get("mid"))):
            continue
        if time.time() - float(event.get("ts") or time.time()) > COMMENT_STALE:
            continue
        # С этим человеком уже говорит сотрудник в Direct — робот туда не лезет.
        if await redis_client.get(f"ig:human:{user}"):
            continue
        try:
            caption = await _caption(media)
            plan = await _plan_comment(event, caption)
            if not plan:
                from .shop_wa_bot import alert_brain_down
                await alert_brain_down("Instagram", "сайт не ответил на комментарий")
                continue
            action = plan.get("action")
            if action == "hide":
                await _graph_post(cid, params={"hide": "true"})
                logger.warning(f"ig comment: скрыт спам ...{cid[-4:]}")
                await _stat("comments")
                done += 1
                continue
            if action not in ("answer", "alert"):
                continue
            # Один ответ человеку на пост: «+», «+», «+» под одним рилсом — один Direct, не три.
            # И не больше трёх постов в день на человека.
            if await redis_client.get(f"ig:cpost:{user}:{media}"):
                continue
            count_key = f"ig:ccount:{user}:{_today()}"
            if int(await redis_client.get(count_key) or 0) >= COMMENTS_PER_USER:
                continue
            private = str(plan.get("private") or "").strip()
            if private:
                # Не ушло в Direct — исключение: «Директке жаздык» при всех тогда не пишем.
                await _private_reply(cid, user, private, plan.get("productId"), str(event.get("text") or ""), caption)
            await redis_client.set(f"ig:cpost:{user}:{media}", "1", ex=7 * 24 * 3600)
            await redis_client.incr(count_key)
            await redis_client.expire(count_key, 2 * 24 * 3600)
            if action == "alert":
                await _alert_complaint(event, caption)
            public = str(plan.get("public") or "").strip()
            if public:
                reply = await _graph_post(f"{cid}/replies", json={"message": public})
                if reply.get("id"):
                    await redis_client.set(f"ig:myreply:{reply['id']}", "1", ex=7 * 24 * 3600)
            await _stat("comments")
            await _stat_media(media, caption)
            done += 1
            logger.warning(f"ig comment: {action} ...{cid[-4:]}")
        except Exception as error:
            logger.error(f"ig comment ...{cid[-4:]}: {error}")
    return done


async def _private_reply(cid: str, user: str, text: str, product_id, comment: str = "", caption: str = "") -> None:
    """
    Личный ответ на комментарий: первое сообщение в Direct. Instagram сам открывает разговор с
    автором комментария; recipient_id в ответе — id этого разговора (может отличаться от id в
    комментарии), по нему и записываем: когда человек ответит, робот увидит свой первый ответ и товар.
    """
    # Отпечаток — до отправки: эхо нашего сообщения не должно показаться ответом сотрудника.
    await redis_client.set(f"ig:mytext:{user}:{rules.text_key(text)}", "1", ex=2 * 24 * 3600)
    sent = await _graph_post("me/messages", json={"recipient": {"comment_id": cid}, "message": {"text": text}})
    chat = str(sent.get("recipient_id") or user)
    mid = str(sent.get("message_id") or "")
    await redis_client.set(f"ig:mytext:{chat}:{rules.text_key(text)}", "1", ex=2 * 24 * 3600)
    if mid:
        await redis_client.sadd(f"ig:mine:{chat}", mid)
        await redis_client.expire(f"ig:mine:{chat}", 2 * 24 * 3600)
    # Сначала — что человек написал и под каким постом: иначе на «вот эту» в Direct модель не знала,
    # о каком товаре речь, и снова спрашивала «какой товар?» (05.10, рилс «Мини посудомойка»).
    if comment:
        await _remember(chat, "user", rules.comment_turn(comment, caption))
    await _remember(chat, "assistant", text)
    # Товар поста — в «показанные», только если разговор о другом ещё не шёл: не затирать то, что смотрел.
    if product_id and not await redis_client.get(f"ig:shown:{chat}"):
        await redis_client.set(f"ig:shown:{chat}", json.dumps([str(product_id)]), ex=TURNS_TTL)


async def _ask_for_text(user: str) -> bool:
    from .shop_wa_bot import ASK_FOR_TEXT
    if not await redis_client.set(f"ig:askedtext:{user}", "1", ex=30 * 60, nx=True):
        return False
    try:
        await _send_text(user, ASK_FOR_TEXT)
        await _remember(user, "assistant", ASK_FOR_TEXT)
        await redis_client.set(f"ig:botactive:{user}", "1", ex=30 * 60)
        return True
    except Exception as error:
        logger.error(f"ig bot voice ...{user[-4:]}: {error}")
        return False


async def _answer(user: str, pending: dict | None = None) -> bool:
    # Как в WhatsApp: ошибка после ответа сайта — это отправка в Instagram (окно 24 часа, ключ), не консультант.
    answered_by_site = False
    try:
        count_key = f"ig:count:{user}:{_today()}"
        count = int(await redis_client.get(count_key) or 0)
        if count >= DAILY_LIMIT:
            return False
        asked = await _turns(user)
        reply = await _ask_site(user, asked)
        answered_by_site = bool(reply)
        if reply and reply.get("silent"):
            if reply.get("mute"):
                await redis_client.set(f"ig:human:{user}", "1", ex=HUMAN_QUIET)
            return False
        from .shop_wa_bot import alert_brain_down
        if not reply:
            await alert_brain_down("Instagram", "сайт не ответил")
            return False
        if not reply.get("text"):
            return False
        # Модель недоступна — шаблон в Instagram не шлём, пусть ответит сотрудник.
        if reply.get("source") == "local":
            from .shop_wa_bot import brain_why, retry_later
            if await retry_later("ig:pending", user, pending, reply.get("why")):
                logger.warning(f"ig bot: Google занят — спрошу снова через минуту ...{user[-4:]}")
                return False
            logger.warning("ig bot: модель недоступна — отвечать оставляю сотруднику")
            await alert_brain_down("Instagram", brain_why(reply.get("why")))
            return False
        text = str(reply["text"])
        if count + 1 >= DAILY_LIMIT:
            text += "\n\nДальше вам ответит руководство магазина."
        await _send_text(user, text)
        await _send_photos(user, await _new_photos(user, reply.get("products") or []))
        await _remember(user, "assistant", text, asked)
        await redis_client.set(count_key, str(count + 1), ex=2 * 24 * 3600)
        await redis_client.set(f"ig:botactive:{user}", "1", ex=30 * 60)
        ids = [p.get("id") for p in reply.get("products") or [] if p.get("id")]
        if ids:
            await redis_client.set(f"ig:shown:{user}", json.dumps(ids), ex=TURNS_TTL)
            await redis_client.set(f"ig:nudge:{user}", json.dumps({"ts": time.time()}), ex=24 * 3600)
        # «Возьму после зарплаты» — в Instagram напомнить через дни нельзя (окно Meta 24 часа).
        # Успеваем до закрытия окна — напомним тогда, иначе не напоминаем вовсе.
        later = int(reply.get("followAfter") or 0)
        if later > 0:
            last_in = float(await redis_client.get(f"ig:lastin:{user}") or 0)
            if rules.window_open(last_in, time.time() + later):
                await redis_client.set(f"ig:nudge:{user}", json.dumps({"ts": time.time() + later - NUDGE_AFTER}), ex=24 * 3600)
            else:
                await redis_client.delete(f"ig:nudge:{user}")
        if count + 1 >= DAILY_LIMIT:
            await redis_client.set(f"ig:human:{user}", "1", ex=HUMAN_QUIET)
        elif reply.get("handoff"):
            await redis_client.set(f"ig:human:{user}", "1", ex=HANDOFF_QUIET)
        return True
    except Exception as error:
        logger.error(f"ig bot ...{user[-4:]}: {error}")
        if not answered_by_site:
            from .shop_wa_bot import alert_brain_down
            await alert_brain_down("Instagram", "сайт не ответил вовремя, подробности в журнале сервера")
        return False


async def _ask_site(user: str, asked: list[dict]) -> dict | None:
    from .shop_router import _site_base_url, _site_secret
    profile = await _profile(user)
    shown_raw = await redis_client.get(f"ig:shown:{user}")
    payload = json.dumps({
        "id": user,
        "name": profile.get("name") or "",
        # Ник — подпись для владельца в 🚨 жалобе и 💳 чеке: по нему он найдёт чат.
        "username": profile.get("username") or "",
        "messages": asked,
        "shown": json.loads(shown_raw) if shown_raw else [],
    }, ensure_ascii=False)
    signature = hmac.new(_site_secret().encode(), payload.encode("utf-8"), hashlib.sha256).hexdigest()
    async with httpx.AsyncClient(timeout=40) as client:
        response = await client.post(
            f"{_site_base_url()}/api/channel/instagram",
            content=payload.encode("utf-8"),
            headers={"Content-Type": "application/json", "X-Signature": signature},
        )
    if response.status_code != 200:
        logger.error(f"ig bot: сайт ответил {response.status_code}")
        return None
    data = response.json()
    return data if data.get("ok") else None


# ── Отправка ─────────────────────────────────────────────────────────────────

async def _send(user: str, message: dict) -> None:
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            f"{rules.GRAPH}/me/messages",
            headers={"Authorization": f"Bearer {_token()}"},
            json={"recipient": {"id": user}, "message": message},
        )
    if response.status_code != 200:
        raise RuntimeError(f"Instagram {response.status_code}: {response.text[:200]}")
    mid = str(response.json().get("message_id") or "")
    if mid:
        await redis_client.sadd(f"ig:mine:{user}", mid)
        await redis_client.expire(f"ig:mine:{user}", 2 * 24 * 3600)


async def _send_text(user: str, text: str) -> None:
    for part in rules.split_text(text):
        # Отпечаток — до отправки: эхо может прийти раньше, чем Instagram вернёт id.
        await redis_client.set(f"ig:mytext:{user}:{rules.text_key(part)}", "1", ex=2 * 24 * 3600)
        await _send(user, {"text": part})


async def _new_photos(user: str, products: list[dict]) -> list[dict]:
    """Товары, чьё фото в этом чате ещё не отправляли."""
    key = f"ig:photos:{user}"
    try:
        sent = set(json.loads(await redis_client.get(key) or "[]"))
    except Exception:
        sent = set()
    fresh = [p for p in products if p.get("id") and p.get("id") not in sent]
    if fresh:
        sent.update(p["id"] for p in fresh[:MAX_PHOTOS])
        await redis_client.set(key, json.dumps(sorted(sent)), ex=TURNS_TTL)
    return fresh


async def _send_photos(user: str, products: list[dict]) -> None:
    """
    Карточка товара: название, цена и ссылка на сайт. Instagram сам делает из ссылки карточку с фото товара
    (og:image страницы — то же фото) — отдельное фото не шлём: покупатель видел одну картинку дважды (04.10).
    Ссылки нет — тогда фото и текст, как раньше.
    """
    from .shop_router import _site_base_url
    for product in [p for p in products if str(p.get("image") or "").startswith("https://")][:MAX_PHOTOS]:
        caption = f"{product.get('name')} — {product.get('priceLabel')}"
        href = str(product.get("href") or "")
        try:
            if href.startswith("/"):
                await _send_text(user, f"{caption}\n{_site_base_url()}{href}")
                continue
            await redis_client.set(f"ig:myphoto:{user}", "1", ex=10 * 60)
            await _send(user, {"attachment": {"type": "image", "payload": {"url": product["image"]}}})
            await _send_text(user, caption)
        except Exception as error:
            logger.warning(f"ig bot photo: {error}")


async def _nudge_silent() -> int:
    """«Ещё актуально?» — как в WhatsApp, но только пока открыто окно Meta."""
    from .shop_router import _site_base_url, _site_secret
    from .shop_wa_bot import WORK_HOURS, _bishkek_now
    if _bishkek_now().hour not in WORK_HOURS:
        return 0
    sent = 0
    async for key in redis_client.scan_iter(match="ig:nudge:*", count=200):
        user = str(key).removeprefix("ig:nudge:")
        try:
            pending = json.loads(await redis_client.get(key) or "{}")
        except Exception:
            pending = {}
        if time.time() - float(pending.get("ts") or 0) < NUDGE_AFTER:
            continue
        await redis_client.delete(key)
        if await redis_client.get(f"ig:human:{user}"):
            continue
        if not rules.window_open(float(await redis_client.get(f"ig:lastin:{user}") or 0), time.time()):
            continue
        if not await redis_client.set(f"ig:nudged:{user}", "1", ex=NUDGE_QUIET, nx=True):
            continue
        profile = await _profile(user)
        shown_raw = await redis_client.get(f"ig:shown:{user}")
        payload = json.dumps({
            "name": profile.get("name") or "",
            "messages": await _turns(user),
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
            await _send_text(user, text)
            await _remember(user, "assistant", text)
            await redis_client.set(f"ig:botactive:{user}", "1", ex=30 * 60)
            sent += 1
        except Exception as error:
            logger.error(f"ig bot nudge ...{user[-4:]}: {error}")
    return sent


async def waiting_chats(days: set[str]) -> list[tuple[str, list[dict]]]:
    """Разговоры Instagram за эти дни — для «Ждут ответа» в сводке владельцу."""
    if not await _load_token():
        return []
    chats, seen = [], set()
    async for key in redis_client.scan_iter(match="ig:count:*", count=500):
        parts = str(key).split(":")
        if len(parts) != 4 or parts[3] not in days or parts[2] in seen:
            continue
        user = parts[2]
        seen.add(user)
        username = (await _profile(user, fetch=False)).get("username")
        chats.append((f"Instagram @{username}" if username else f"Instagram id {user}", await _turns(user)))
    return chats


def run_cron() -> None:
    """Запуск из cron раз в минуту: очередь webhook'а и ответы. В журнал — только ответы и ошибки."""
    from datetime import datetime
    from .shop_wa_bot import _close_redis

    async def once() -> dict:
        try:
            return await poll_once()
        finally:
            await _close_redis()

    try:
        result = asyncio.run(once())
        if result.get("answered") or result.get("nudged") or result.get("comments"):
            print(f"{datetime.now():%Y-%m-%d %H:%M} instagram ответил: {result.get('answered', 0)}, напомнил: {result.get('nudged', 0)}, комментариев: {result.get('comments', 0)}")
    except Exception as error:
        print(f"{datetime.now():%Y-%m-%d %H:%M} instagram ошибка: {type(error).__name__}: {error}")
