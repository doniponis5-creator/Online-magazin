"""
Интернет-магазин Smart Centr — посты и истории в Instagram «Скидка» / «Новинка» из 1С.

Владелец в 1С («Панель сайта» → «Уведомления» → «Пост в Instagram») выбирает товар и шаблон,
правит текст и нажимает «Опубликовать в Instagram» (лента) или «В историю».
Сам робот выпускает только истории — и только если в 1С включена «Авто-история в Instagram»:
четыре в день по меткам товара из 1С (AUTO_SLOTS: 10:00 «Товар дня», 13:00 «Хит», 16:00 «Новинка»,
19:00 «Специально для вас» или «Скидка»). Посты в ленту — только по кнопке: пост остаётся навсегда,
ошибку цены в нём увидят все.

Путь картинки:
  1С → /promo/ig-preview → prepare(): данные товара из каталога сервера → Redis ig:post:req:<v>
  1С и Meta → GET /api/v1/shop/photos/ig/<v>.jpg (shop_catalog.py) → image(): готовая из Redis
       или сайт рисует её заново (POST {SHOP_SITE_BASE_URL}/api/instagram/post-image, подпись сайта)
  1С → /promo/ig-post → start() + publish() в фоне: контейнер Instagram → ждём FINISHED →
       media_publish → ссылка в истории (ig:post:entry:<id>, список id — ig:posts).

Картинку Meta забирает с нашего сервера (api.smartcentr.store), а не с smarket.kg:
smarket.kg за Cloudflare, и его защита от ботов закрывает дорогу проверке ссылок Meta.

Ключ Instagram — тот же, что у продавца в Direct (shop_ig_bot._load_token). Нужно право
instagram_business_content_publish; ключ, выданный до того, как право включили, его не несёт —
Instagram ответит 403, и владелец увидит это в «Последних рассылках».

История ведёт в Direct: на ответ на неё робот знает товар (ig:story:<id> → describe_story),
ссылок в истории Instagram через API не даёт.
"""
from __future__ import annotations

import asyncio
import base64
import hashlib
import hmac
import json
import logging
import time
from datetime import datetime, timedelta, timezone

import httpx

from app.core.redis import redis_client

from . import shop_ig_rules as rules

logger = logging.getLogger("sbonus.shop.ig_post")

FORMATS = ("post", "story")
REQ_TTL = 3 * 24 * 3600          # данные картинки: 1С показала превью — Meta заберёт позже
IMG_TTL = 3 * 24 * 3600          # готовая картинка (Meta берёт её один раз, а превью 1С — много)
ENTRY_TTL = 30 * 24 * 3600       # запись истории публикаций
HISTORY_KEY = "ig:posts"         # список id, новые сверху; сами записи — ig:post:entry:<id>
HISTORY_MAX = 20
PUBLISH_WAIT = 60                # сколько ждём, пока Instagram обработает картинку
SAME_ITEM_QUIET = 24 * 3600      # один и тот же товар тем же шаблоном и видом — не чаще раза в сутки
STUCK_AFTER = 300                # «публикуется» дольше — сервер перезапускали посреди публикации
STORY_TTL = 2 * 24 * 3600        # история живёт сутки; ответы на неё приходят и позже
# Авто-истории: (час по Бишкеку, метки по порядку). Сервер лежал — слот ещё можно выпустить
# в течение AUTO_LATE часов, позже — пропускаем: «Товар дня» вечером уже не новость.
AUTO_SLOTS = ((10, ("deal",)), (13, ("hit",)), (16, ("new",)), (19, ("foryou", "sale")))
AUTO_LATE = 2
AUTO_REPEAT_DAYS = 3             # тот же товар с той же меткой — не чаще раза в три дня («Товар дня» — каждый день)
PATH = "/api/v1/shop/photos/ig/{v}.jpg"

WORD = {"post": "Пост", "story": "История"}


def _public_base() -> str:
    from .shop_router import _cfg
    return _cfg("shop_public_api_base", "https://api.smartcentr.store").rstrip("/")


def image_url(v: str) -> str:
    return _public_base() + PATH.format(v=v)


def _version(req: dict) -> str:
    """Отпечаток данных картинки: цена или фото поменялись — другая картинка, другой адрес."""
    raw = json.dumps(req, ensure_ascii=False, sort_keys=True)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:16]


def marks(item: dict) -> set[str]:
    """Метки товара из 1С: «Товар дня», «Скидка» (есть старая цена), «Хит», «Специально для вас», «Новинка»."""
    from . import shop_promo_rules as promo
    found = {"sale"} if promo.on_sale(item) else set()
    for mark, field in (("deal", "dealOfDay"), ("hit", "hit"), ("foryou", "forYou"), ("new", "isNew")):
        if item.get(field):
            found.add(mark)
    return found


def request_for(kind: str, item: dict, fmt: str = "post") -> dict:
    """Что рисовать — только из каталога 1С на сервере: название, цены, первое фото."""
    from . import shop_promo_rules as promo
    photos = [p for p in (item.get("photos") or []) if isinstance(p, str) and p.startswith("https://")]
    return {
        "format": fmt if fmt in FORMATS else "post",
        "kind": rules.image_kind(kind, marks(item)),
        "name": promo.clean_text(item.get("name"))[:200],
        "price": promo.price(item),
        "oldPrice": promo.old_price(item),
        "photo": photos[0] if photos else "",
    }


async def prepare(kind: str, item: dict, fmt: str = "post") -> str:
    """Запомнить, что рисовать, и вернуть отпечаток (картинка рисуется при первом запросе)."""
    req = request_for(kind, item, fmt)
    v = _version(req)
    await redis_client.set(f"ig:post:req:{v}", json.dumps(req, ensure_ascii=False), ex=REQ_TTL)
    return v


async def _render(req: dict) -> bytes | None:
    from .shop_router import _site_base_url, _site_secret
    payload = json.dumps(req, ensure_ascii=False)
    signature = hmac.new(_site_secret().encode(), payload.encode("utf-8"), hashlib.sha256).hexdigest()
    try:
        async with httpx.AsyncClient(timeout=40) as client:
            response = await client.post(
                f"{_site_base_url()}/api/instagram/post-image",
                content=payload.encode("utf-8"),
                headers={"Content-Type": "application/json", "X-Signature": signature},
            )
    except Exception as error:
        logger.warning(f"ig post: сайт не нарисовал картинку ({type(error).__name__})")
        return None
    body = response.content
    if response.status_code != 200 or body[:3] != b"\xff\xd8\xff":
        logger.warning(f"ig post: сайт ответил {response.status_code} вместо картинки")
        return None
    # Фото просили, а на картинке заглушка (старый сайт не отвечает 502) — такую не берём и не храним.
    if req.get("photo") and response.headers.get("X-Photo") != "1":
        logger.warning("ig post: сайт нарисовал картинку без фото товара")
        return None
    return body


# Одновременные запросы одной картинки (превью 1С и Meta) рисуются один раз.
_rendering: dict[str, asyncio.Future] = {}


async def image(v: str) -> bytes | None:
    """Картинка по отпечатку: из Redis или нарисовать заново. None — такой не готовили или не нарисовалась."""
    cached = await redis_client.get(f"ig:post:img:{v}")
    if cached:
        try:
            return base64.b64decode(cached)
        except Exception:
            pass
    raw = await redis_client.get(f"ig:post:req:{v}")
    if not raw:
        return None
    if v in _rendering:
        return await _rendering[v]
    future = asyncio.get_running_loop().create_future()
    _rendering[v] = future
    try:
        body = await _render(json.loads(raw))
        if body:
            await redis_client.set(f"ig:post:img:{v}", base64.b64encode(body).decode("ascii"), ex=IMG_TTL)
        future.set_result(body)
        return body
    except Exception as error:
        future.set_result(None)
        logger.warning(f"ig post: картинка {v} не готова ({type(error).__name__})")
        return None
    finally:
        _rendering.pop(v, None)


# ── Можно ли публиковать ─────────────────────────────────────────────────────

def _today() -> str:
    """День по Бишкеку — как «сегодня» у владельца и у рассылок (shop_promo_rules.shop_day)."""
    from . import shop_promo_rules as promo
    return promo.shop_day(datetime.now(timezone.utc)).isoformat()


def _limit(fmt: str) -> int:
    return rules.STORIES_PER_DAY if fmt == "story" else rules.POSTS_PER_DAY


def _item_key(fmt: str, kind: str, code: str) -> str:
    return f"ig:posts:item:{fmt}:{kind}:{code}"


def _day_key(fmt: str) -> str:
    return f"ig:posts:day:{fmt}:{_today()}"


async def blocked_reason(kind: str, code: str, item: dict | None, fmt: str = "post") -> str | None:
    """Почему нельзя — фразой для 1С. Проверки текста — rules.caption_problem, отдельно."""
    from . import shop_promo_rules as promo
    from .shop_ig_bot import _load_token
    if not await _load_token():
        return "На сервере нет ключа Instagram (IG_ACCESS_TOKEN) — публиковать нельзя."
    if item is None:
        return "Выберите товар." if not code else "Товара нет в каталоге сайта — обновите список."
    if not promo.sellable(item):
        return "Этот товар сейчас нельзя заказать на сайте: нет цены или остатка."
    if kind == "sale" and not promo.on_sale(item):
        return "У товара нет старой цены — шаблон «Скидка» не подходит."
    if not request_for(kind, item, fmt)["photo"]:
        return "У товара нет фото — без фото не публикуем. Добавьте фото в карточке товара."
    count = int(await redis_client.get(_day_key(fmt)) or 0)
    if count >= _limit(fmt):
        what = "историй" if fmt == "story" else "постов"
        return f"Сегодня уже {count} {what} — больше {_limit(fmt)} в день не публикуем."
    if await redis_client.get(_item_key(fmt, kind, code)):
        what = "в историю" if fmt == "story" else "в ленту"
        return f"Этот товар с этим шаблоном уже публиковали {what} за последние сутки (или ещё публикуется)."
    return None


# ── Публикация ───────────────────────────────────────────────────────────────

async def _graph(client: httpx.AsyncClient, method: str, path: str, token: str, **params) -> dict:
    # POST — полями формы: подпись поста до 2200 знаков в адрес запроса не кладём.
    response = await client.request(
        method, f"{rules.GRAPH}/{path}", headers={"Authorization": f"Bearer {token}"},
        **({"data": params} if method == "POST" else {"params": params or None}),
    )
    try:
        data = response.json()
    except Exception:
        data = {}
    if response.status_code != 200:
        error = (data.get("error") or {}) if isinstance(data, dict) else {}
        message = str(error.get("message") or response.text[:200])
        raise RuntimeError(f"Instagram {response.status_code}: {message}")
    return data if isinstance(data, dict) else {}


def explain(error: str) -> str:
    """Ошибку Instagram — словами для владельца."""
    low = error.lower()
    if "403" in low or "permission" in low or "(#10)" in low or "(#200)" in low:
        return ("Instagram не дал права публиковать. Включите instagram_business_content_publish и "
                "создайте новый ключ (IG_ACCESS_TOKEN) — старый выдан без этого права.")
    if "401" in low or "token" in low:
        return "Ключ Instagram устарел — создайте новый (IG_ACCESS_TOKEN)."
    if "image" in low or "media" in low or "9004" in low:
        return "Instagram не смог забрать картинку. Попробуйте ещё раз через минуту."
    return error[:200]


async def publish(entry_id: str, v: str, caption: str, fmt: str = "post", story_of: dict | None = None) -> dict:
    """
    Картинка → контейнер → ждём, пока Instagram её обработает → публикация.
    После media_publish ошибка не значит «не вышло»: ответ мог потеряться, а пост — выйти.
    Тогда спрашиваем контейнер; не ясно — замок товара не снимаем, чтобы не выпустить второй такой же.
    """
    from .shop_ig_bot import _load_token
    status, link, note, release = "failed", "", "", True
    creation, sent = "", False
    token = ""
    try:
        if not await image(v):
            raise RuntimeError("сайт не нарисовал картинку — нет фото товара или сайт недоступен")
        token = await _load_token()
        async with httpx.AsyncClient(timeout=30) as client:
            me = await _graph(client, "GET", "me", token, fields="user_id,username")
            account = str(me.get("user_id") or me.get("id") or "")
            if not account:
                raise RuntimeError("Instagram не назвал аккаунт магазина")
            fields = {"image_url": image_url(v)}
            if fmt == "story":
                fields["media_type"] = "STORIES"   # у истории подписи нет: всё на картинке
            else:
                fields["caption"] = caption
            creation = str((await _graph(client, "POST", f"{account}/media", token, **fields)).get("id") or "")
            if not creation:
                raise RuntimeError("Instagram не принял картинку")
            deadline = time.monotonic() + PUBLISH_WAIT
            while True:
                code = str((await _graph(client, "GET", creation, token, fields="status_code")).get("status_code") or "")
                if code == "FINISHED":
                    break
                if code in ("ERROR", "EXPIRED") or time.monotonic() > deadline:
                    raise RuntimeError(f"Instagram не обработал картинку ({code or 'нет ответа'})")
                await asyncio.sleep(3)
            sent = True
            await _set_entry(entry_id, stage="publishing")
            media_id = str((await _graph(client, "POST", f"{account}/media_publish", token, creation_id=creation)).get("id") or "")
            link = await _permalink(client, media_id, token)
            if fmt == "story" and media_id and story_of:
                await redis_client.set(f"ig:story:{media_id}", json.dumps(story_of, ensure_ascii=False), ex=STORY_TTL)
        status = "done"
    except Exception as error:
        if sent and await _published(creation, token):
            status, note = "done", ""
        elif sent:
            status, release = "unclear", False
            note = "Неизвестно, вышел ли он — проверьте в Instagram, прежде чем публиковать снова."
        else:
            note = explain(str(error))
        if status != "done":
            logger.warning(f"ig {fmt} {entry_id}: не опубликован: {error}")
    await _finish(entry_id, status, link, note, release)
    if status == "done":
        logger.info(f"ig {fmt} {entry_id}: опубликован {link}")
    return {"status": status, "link": link, "note": note}


async def _permalink(client: httpx.AsyncClient, media_id: str, token: str) -> str:
    if not media_id:
        return ""
    try:
        return str((await _graph(client, "GET", media_id, token, fields="permalink")).get("permalink") or "")
    except Exception:
        return ""


async def _published(creation: str, token: str) -> bool:
    """Контейнер уже опубликован? Ответ media_publish мог потеряться по дороге."""
    if not creation:
        return False
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            state = await _graph(client, "GET", creation, token, fields="status_code")
        return state.get("status_code") == "PUBLISHED"
    except Exception:
        return False


# ── История публикаций для 1С ────────────────────────────────────────────────
# Каждая запись — свой ключ: две публикации подряд не затирают друг друга в общем списке.

async def _get_entry(entry_id: str) -> dict | None:
    raw = await redis_client.get(f"ig:post:entry:{entry_id}")
    try:
        return json.loads(raw) if raw else None
    except Exception:
        return None


async def _set_entry(entry_id: str, **changes) -> dict | None:
    entry = await _get_entry(entry_id)
    if entry is None:
        return None
    entry.update(changes)
    await redis_client.set(f"ig:post:entry:{entry_id}", json.dumps(entry, ensure_ascii=False), ex=ENTRY_TTL)
    return entry


async def start(kind: str, code: str, name: str, v: str, fmt: str = "post", auto: bool = False) -> tuple[str | None, str]:
    """
    Записать публикацию до отправки. Замок «тот же товар за сутки» и счётчик дня берутся здесь
    атомарно: двойное нажатие в 1С или две кнопки разом не выпустят лишнего.
    Возвращает (id записи, "") или (None, причина).
    """
    lock = _item_key(fmt, kind, code)
    if not await redis_client.set(lock, "1", ex=SAME_ITEM_QUIET, nx=True):
        return None, "Этот товар с этим шаблоном уже публикуется или публиковался за последние сутки."
    day = _day_key(fmt)
    count = await redis_client.incr(day)
    await redis_client.expire(day, 2 * 24 * 3600)
    if count > _limit(fmt):
        await redis_client.decr(day)
        await redis_client.delete(lock)
        return None, f"Сегодня уже {_limit(fmt)} — больше в день не публикуем."
    entry_id = hashlib.sha256(f"{v}:{time.time()}:{fmt}".encode()).hexdigest()[:12]
    entry = {"id": entry_id, "at": datetime.now(timezone.utc).replace(tzinfo=None).isoformat(),
             "format": fmt, "kind": kind, "code": code, "name": name, "auto": auto,
             "status": "sending", "stage": "", "link": "", "note": "", "lock": lock, "day": day}
    await redis_client.set(f"ig:post:entry:{entry_id}", json.dumps(entry, ensure_ascii=False), ex=ENTRY_TTL)
    await redis_client.lpush(HISTORY_KEY, entry_id)
    await redis_client.ltrim(HISTORY_KEY, 0, HISTORY_MAX - 1)
    return entry_id, ""


async def _release(entry: dict) -> None:
    """Не вышло — не занимаем ни день, ни товар: владелец может нажать ещё раз."""
    await redis_client.delete(entry.get("lock") or "")
    if int(await redis_client.get(entry.get("day") or "") or 0) > 0:
        await redis_client.decr(entry["day"])


async def _finish(entry_id: str, status: str, link: str, note: str, release: bool) -> None:
    entry = await _set_entry(entry_id, status=status, link=link, note=note)
    if entry is not None and status != "done" and release:
        await _release(entry)


async def history() -> list[dict]:
    """
    Последние публикации, новые сверху. «Публикуется» дольше пяти минут — сервер перезапускали:
    до media_publish не дошли — замок снимаем (можно повторить); дошли — «неизвестно» и замок держим.
    """
    rows = []
    for raw_id in await redis_client.lrange(HISTORY_KEY, 0, HISTORY_MAX - 1):
        entry_id = raw_id.decode() if isinstance(raw_id, bytes) else str(raw_id)
        entry = await _get_entry(entry_id)
        if entry is None:
            continue
        if entry.get("status") == "sending":
            try:
                started = datetime.fromisoformat(entry["at"]).replace(tzinfo=timezone.utc)
                stuck = (datetime.now(timezone.utc) - started).total_seconds() > STUCK_AFTER
            except Exception:
                stuck = False
            if stuck and entry.get("stage") == "publishing":
                entry = await _set_entry(entry_id, status="unclear",
                                         note="Сервер перезапускался посреди публикации — проверьте в Instagram.") or entry
            elif stuck:
                entry = await _set_entry(entry_id, status="interrupted", note="Сервер перезапускался — можно повторить.") or entry
                await _release(entry)
        rows.append({key: entry.get(key) for key in ("id", "at", "format", "kind", "code", "name", "auto", "status", "link", "note")})
    return rows


# ── Ответ на историю → товар для робота в Direct ─────────────────────────────

async def describe_story(story_id: str) -> str:
    """«[Ответ на историю магазина: …]» с товаром и ценой — по id истории, которую выпустили мы."""
    if not story_id:
        return ""
    raw = await redis_client.get(f"ig:story:{story_id}")
    try:
        story = json.loads(raw) if raw else None
    except Exception:
        story = None
    if not story:
        return ""
    return rules.story_note(str(story.get("name") or ""), int(story.get("price") or 0), int(story.get("oldPrice") or 0))


# ── Авто-истории (галочка «Авто-история в Instagram» в 1С) ──────────────────

SLOT_WORD = {"deal": "Товар дня", "hit": "Хит", "new": "Новинка", "foryou": "Специально для вас", "sale": "Скидка"}


def pick_story(items: list[dict], wanted: tuple[str, ...], shown: dict[str, str], taken: set[str], today: str) -> tuple[dict, str] | None:
    """
    Товар для слота: с нужной меткой из 1С, можно заказать, есть фото, сегодня ещё не показан
    (taken) и не показан с этой меткой последние AUTO_REPEAT_DAYS дней (shown: «метка|код» → день).
    «Товар дня» владелец меняет сам — его показываем каждый день. Из подходящих — дольше всех
    не показанный, при равенстве — с большей скидкой. Возвращает (товар, метка) или None.
    """
    from datetime import date
    from . import shop_promo_rules as promo

    def days_ago(mark: str, code: str) -> int:
        last = shown.get(f"{mark}|{code}")
        try:
            return (date.fromisoformat(today) - date.fromisoformat(last)).days if last else 10_000
        except ValueError:
            return 10_000

    for mark in wanted:
        fits = [
            i for i in items or []
            if mark in marks(i) and promo.sellable(i) and str(i.get("code") or "") not in taken
            and request_for(mark, i)["photo"]
            and (mark == "deal" or days_ago(mark, str(i.get("code") or "")) >= AUTO_REPEAT_DAYS)
        ]
        if fits:
            best = max(fits, key=lambda i: (days_ago(mark, str(i.get("code") or "")),
                                            rules.discount_pct(promo.price(i), promo.old_price(i))))
            return best, mark
    return None


def due_slot(here: datetime) -> tuple[int, tuple[str, ...]] | None:
    """Какой слот сейчас пора выпускать (по часам Бишкека); None — ни один."""
    for hour, wanted in AUTO_SLOTS:
        if hour <= here.hour < hour + AUTO_LATE:
            return hour, wanted
    return None


async def auto_story(now: datetime | None = None) -> dict | None:
    """
    Зовёт cron робота Instagram (shop_ig_bot.poll_once) раз в минуту. Пора слота (AUTO_SLOTS) и он
    сегодня ещё не выходил — одна история с товаром нужной метки. Галочка в 1С — SITE_IG_AUTO_STORY.
    Сделал — владельцу в WhatsApp, что вышло. Нечего показать — слот молча пропускается.
    """
    from . import shop_promo_rules as promo
    from app.core.database import async_session
    from .shop_admin import _values
    from .shop_router import catalog_items

    now = now or datetime.now(timezone.utc)
    here = promo.local(now)
    slot = due_slot(here)
    if slot is None:
        return None
    hour, wanted = slot
    day = here.date().isoformat()
    slot_key = f"ig:autostory:{day}:{hour}"
    if await redis_client.get(slot_key):
        return None
    async with async_session() as db:
        if (await _values(db)).get("SITE_IG_AUTO_STORY", "0") != "1":
            return None
        items = await catalog_items(db)
    # Слот занимаем до публикации: следующая минута cron не выпустит вторую такую же.
    if not await redis_client.set(slot_key, "1", ex=2 * 24 * 3600, nx=True):
        return None
    shown_raw = await redis_client.get("ig:autostory:shown")
    try:
        shown = json.loads(shown_raw) if shown_raw else {}
    except Exception:
        shown = {}
    taken = set(await redis_client.smembers(f"ig:autostory:{day}:codes") or [])
    picked = pick_story(items, wanted, shown, taken, day)
    if picked is None:
        logger.info(f"ig auto story {hour}:00: нечего показать ({', '.join(SLOT_WORD[m] for m in wanted)})")
        return {"status": "skipped"}
    item, mark = picked
    code = str(item.get("code") or "")
    name = promo.clean_text(item.get("name"))
    if await blocked_reason(mark, code, item, "story"):
        return {"status": "skipped"}
    v = await prepare(mark, item, "story")
    entry_id, reason = await start(mark, code, name, v, "story", auto=True)
    if entry_id is None:
        return {"status": "skipped", "note": reason}
    story_of = {"code": code, "name": name, "price": promo.price(item), "oldPrice": promo.old_price(item)}
    result = await publish(entry_id, v, "", "story", story_of)
    if result["status"] == "done":
        await redis_client.sadd(f"ig:autostory:{day}:codes", code)
        await redis_client.expire(f"ig:autostory:{day}:codes", 2 * 24 * 3600)
        shown[f"{mark}|{code}"] = day
        # Старше месяца не нужны: правило — «раз в три дня».
        month_ago = (here.date() - timedelta(days=30)).isoformat()
        shown = {k: d for k, d in shown.items() if isinstance(d, str) and d >= month_ago}
        await redis_client.set("ig:autostory:shown", json.dumps(shown, ensure_ascii=False), ex=60 * 24 * 3600)
    await _tell_owner(name, item, result, SLOT_WORD[mark])
    return {**result, "mark": mark}


async def _tell_owner(name: str, item: dict, result: dict, label: str = "") -> None:
    from . import shop_promo_rules as promo
    from .shop_router import _admin_phone
    from .shop_wa_bot import _send_text as send_whatsapp
    price = f"{promo.money(promo.price(item))} сом"
    if result["status"] == "done":
        text = (f"📸 Авто-история в Instagram{f' · {label}' if label else ''}\n━━━━━━━━━━━━━━━━━━━\n{name}\n{price}"
                + (f" (было {promo.money(promo.old_price(item))} сом)" if promo.old_price(item) else "")
                + "\n\nИстория висит сутки. Ответы на неё придут в Direct — робот знает этот товар."
                + "\nВыключить: 1С → «Панель сайта» → «Настройки сайта» → «Авто-история в Instagram».")
    else:
        text = (f"⚠️ Авто-история в Instagram не вышла{f' · {label}' if label else ''}\n━━━━━━━━━━━━━━━━━━━\n{name}\n\n{result.get('note') or ''}"
                "\n\nПовторить можно кнопкой «В историю» в 1С («Панель сайта» → «Уведомления»).")
    try:
        await send_whatsapp(_admin_phone(), text)
    except Exception as error:
        logger.warning(f"ig auto story: владельцу не отправлено ({type(error).__name__})")
