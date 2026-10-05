"""
Проверки постов и историй Instagram (shop_ig_post.py) — без сервера, без Redis и без интернета.

Redis — словарь в памяти, сеть (сайт и Instagram) — httpx.MockTransport: тест видит
каждый запрос к Instagram и отвечает за него сам. База, настройки 1С и WhatsApp — пустышки.

Запуск из папки проекта:
  python -m unittest integrations/sbonus-server/shop/test_shop_ig_post.py

На сервер этот файл не попадает: deploy_shop.sh копирует только список FILES.
"""
from __future__ import annotations

import asyncio
import importlib.util
import json
import pathlib
import sys
import types
import unittest
from datetime import datetime, timedelta, timezone
from urllib.parse import parse_qs

import httpx

_HERE = pathlib.Path(__file__).resolve().parent
_PKG = "_shop_ig_post_test"
JPEG = b"\xff\xd8\xff\xe0fake-jpeg"


class FakeRedis:
    """Только то, чем пользуется shop_ig_post: строки, счётчики, список, множество."""

    def __init__(self):
        self.data: dict[str, object] = {}

    async def get(self, key):
        value = self.data.get(key)
        return value if isinstance(value, str) else None

    async def set(self, key, value, ex=None, nx=False):
        if nx and key in self.data:
            return None
        self.data[key] = str(value)
        return True

    async def delete(self, *keys):
        for key in keys:
            self.data.pop(key, None)

    async def incr(self, key):
        self.data[key] = str(int(self.data.get(key) or 0) + 1)
        return int(self.data[key])

    async def decr(self, key):
        self.data[key] = str(int(self.data.get(key) or 0) - 1)
        return int(self.data[key])

    async def expire(self, key, seconds):
        return True

    async def lpush(self, key, value):
        self.data.setdefault(key, []).insert(0, value)

    async def ltrim(self, key, start, end):
        self.data[key] = self.data.get(key, [])[start:end + 1]

    async def lrange(self, key, start, end):
        return list(self.data.get(key, [])[start:end + 1])

    async def sadd(self, key, value):
        self.data.setdefault(key, set()).add(value)

    async def smembers(self, key):
        return set(self.data.get(key, set()))

    async def hset(self, key, field, value):
        self.data.setdefault(key, {})[field] = value

    async def hgetall(self, key):
        return dict(self.data.get(key, {}))

    async def hincrby(self, key, field, amount):
        bucket = self.data.setdefault(key, {})
        bucket[field] = int(bucket.get(field, 0)) + amount
        return bucket[field]


redis = FakeRedis()
TOKEN = {"value": "ig-token"}
SETTINGS = {"SITE_IG_AUTO_STORY": "1"}
CATALOG: list[dict] = []
SENT: list[str] = []


async def _token():
    return TOKEN["value"]


async def _values(db):
    return dict(SETTINGS)


async def _catalog_items(db):
    return list(CATALOG)


async def _send_whatsapp(phone, text):
    SENT.append(text)


class _Session:
    async def __aenter__(self):
        return object()

    async def __aexit__(self, *exc):
        return False


def _load():
    package = types.ModuleType(_PKG)
    package.__path__ = [str(_HERE)]
    sys.modules[_PKG] = package
    for name, attrs in {
        "app": {}, "app.core": {}, "app.core.redis": {"redis_client": redis},
        "app.core.database": {"async_session": _Session},
        f"{_PKG}.shop_router": {
            "_cfg": lambda name, default="": default,
            "_site_secret": lambda: "secret",
            "_site_base_url": lambda: "https://site.test",
            "_admin_phone": lambda: "+996000000000",
            "catalog_items": _catalog_items,
        },
        f"{_PKG}.shop_ig_bot": {"_load_token": _token},
        f"{_PKG}.shop_admin": {"_values": _values},
        f"{_PKG}.shop_wa_bot": {"_send_text": _send_whatsapp},
        f"{_PKG}.shop_whatsapp": {"_url": lambda: ("https://green.test", "111", "tok")},
    }.items():
        module = types.ModuleType(name)
        module.__dict__.update(attrs)
        sys.modules[name] = module
    for name in ("shop_ig_rules", "shop_promo_rules", "shop_ig_post", "shop_ig_stats"):
        spec = importlib.util.spec_from_file_location(f"{_PKG}.{name}", _HERE / f"{name}.py")
        module = importlib.util.module_from_spec(spec)
        sys.modules[f"{_PKG}.{name}"] = module
        spec.loader.exec_module(module)
    return sys.modules[f"{_PKG}.shop_ig_post"]


post = _load()
stats = sys.modules[f"{_PKG}.shop_ig_stats"]

ITEM = {
    "code": "ЦБ-00001234", "name": "Электро Эндуро WN-A10", "price": 15900, "oldPrice": 18900,
    "availability": "В наличии", "photos": ["https://api.smartcentr.store/api/v1/shop/photos/a.jpg"],
}


class Meta:
    """Сайт и Instagram за одним MockTransport."""

    def __init__(self, statuses=("IN_PROGRESS", "FINISHED"), media_error=None, publish_drops=False,
                 after_drop="PUBLISHED", photo_ok=True, wa_ok=True):
        self.calls: list[tuple[str, str, dict]] = []
        self.statuses = list(statuses)
        self.media_error = media_error
        self.publish_drops = publish_drops
        self.after_drop = after_drop
        self.photo_ok = photo_ok
        self.wa_ok = wa_ok
        self.published = False

    def __call__(self, request: httpx.Request) -> httpx.Response:
        site = request.url.host == "site.test"
        if request.url.host == "green.test":
            self.calls.append(("POST", request.url.path, json.loads(request.content)))
            return httpx.Response(200 if self.wa_ok else 466, json={"idMessage": "W1"} if self.wa_ok else {"message": "status beta off"})
        body = parse_qs(request.content.decode()) if request.method == "POST" and not site else {}
        self.calls.append((request.method, request.url.path, {k: v[0] for k, v in body.items()}))
        path = request.url.path
        if site:
            return httpx.Response(200, content=JPEG, headers={"X-Photo": "1" if self.photo_ok else "0"})
        if path.endswith("/me"):
            return httpx.Response(200, json={"user_id": "1784", "username": "smartcentrr"})
        if path.endswith("/1784/media"):
            if self.media_error:
                return httpx.Response(403, json={"error": {"message": self.media_error}})
            return httpx.Response(200, json={"id": "C1"})
        if path.endswith("/C1"):
            if self.published:
                return httpx.Response(200, json={"status_code": self.after_drop})
            return httpx.Response(200, json={"status_code": self.statuses.pop(0) if self.statuses else "FINISHED"})
        if path.endswith("/1784/media_publish"):
            if self.publish_drops:
                self.published = True
                raise httpx.ReadTimeout("ответ потерялся", request=request)
            return httpx.Response(200, json={"id": "M1"})
        if path.endswith("/M1"):
            return httpx.Response(200, json={"permalink": "https://www.instagram.com/p/abc/"})
        return httpx.Response(404)


def run(coro):
    return asyncio.run(coro)


class Base(unittest.TestCase):
    def setUp(self):
        redis.data.clear()
        SENT.clear()
        CATALOG[:] = [ITEM]
        SETTINGS["SITE_IG_AUTO_STORY"] = "1"
        TOKEN["value"] = "ig-token"
        self.real_client = httpx.AsyncClient
        self.real_sleep = asyncio.sleep

        async def no_wait(_seconds):
            return None

        post.asyncio.sleep = no_wait

    def tearDown(self):
        post.httpx.AsyncClient = self.real_client
        post.asyncio.sleep = self.real_sleep

    def use(self, meta: Meta) -> Meta:
        real = self.real_client
        post.httpx.AsyncClient = lambda **kw: real(transport=httpx.MockTransport(meta), **kw)
        return meta

    def publish(self, kind="sale", fmt="post", caption="Подпись поста", item=ITEM):
        v = run(post.prepare(kind, item, fmt))
        entry, reason = run(post.start(kind, item["code"], item["name"], v, fmt))
        self.assertEqual(reason, "")
        result = run(post.publish(entry, v, caption, fmt, {"code": item["code"], "name": item["name"], "price": 15900, "oldPrice": 18900}))
        return v, result


class Publish(Base):
    def test_post_full_path(self):
        meta = self.use(Meta())
        v, result = self.publish()
        self.assertEqual(post.image_url(v), f"https://api.smartcentr.store/api/v1/shop/photos/ig/{v}.jpg")
        self.assertEqual(result, {"status": "done", "link": "https://www.instagram.com/p/abc/", "note": ""})
        [row] = run(post.history())
        self.assertEqual((row["format"], row["status"], row["link"]), ("post", "done", "https://www.instagram.com/p/abc/"))
        create = next(c for c in meta.calls if c[1].endswith("/1784/media"))
        # Meta забирает картинку с нашего сервера, подпись — полем формы, не в адресе.
        self.assertEqual(create[2], {"image_url": post.image_url(v), "caption": "Подпись поста"})
        self.assertTrue(any(c[1].endswith("/media_publish") and c[2] == {"creation_id": "C1"} for c in meta.calls))
        self.assertEqual(run(post.image(v)), JPEG)
        self.assertEqual(sum(1 for c in meta.calls if c[1] == "/api/instagram/post-image"), 1)
        self.assertIn("за последние сутки", run(post.blocked_reason("sale", ITEM["code"], ITEM)))
        self.assertIsNone(run(post.start("sale", ITEM["code"], ITEM["name"], v))[0])
        # История того же товара — отдельно от поста.
        self.assertIsNone(run(post.blocked_reason("sale", ITEM["code"], ITEM, "story")))

    def test_carousel(self):
        meta = self.use(Meta())
        other = {**ITEM, "code": "ЦБ-2", "name": "Утюг", "price": 900, "oldPrice": 1200}
        no_sale = {**ITEM, "code": "ЦБ-3", "oldPrice": 0}
        items = post.week_items([ITEM, other, no_sale])
        self.assertEqual([i["code"] for i in items], ["ЦБ-2", ITEM["code"]])  # −25 % раньше −15 %, без скидки — нет
        self.assertIsNone(run(post.carousel_blocked(len(items))))
        self.assertIn("хотя бы два", run(post.carousel_blocked(1)))
        cover = run(post.prepare_cover(items))
        self.assertEqual(json.loads(redis.data[f"ig:post:req:{cover}"])["maxPct"], 25)
        cards = [run(post.prepare("sale", i, "post")) for i in items]
        entry, _ = run(post.start("week", "week", "Скидки недели", cover, "carousel"))
        result = run(post.publish(entry, cover, "Подпись", "carousel", None, cards))
        self.assertEqual(result["status"], "done")
        creates = [c[2] for c in meta.calls if c[1].endswith("/1784/media")]
        self.assertEqual(len(creates), 4)  # обложка + 2 карточки + сама карусель
        self.assertTrue(all(c.get("is_carousel_item") == "true" for c in creates[:3]))
        self.assertEqual((creates[3]["media_type"], creates[3]["children"], creates[3]["caption"]), ("CAROUSEL", "C1,C1,C1", "Подпись"))
        self.assertIn("уже публиковали", run(post.carousel_blocked(2)))

    def test_story(self):
        meta = self.use(Meta())
        v, result = self.publish(fmt="story")
        self.assertEqual(result["status"], "done")
        self.assertEqual(json.loads(redis.data[f"ig:post:req:{v}"])["format"], "story")
        create = next(c for c in meta.calls if c[1].endswith("/1784/media"))
        self.assertEqual(create[2], {"image_url": post.image_url(v), "media_type": "STORIES"})  # у истории подписи нет
        # Ответ на эту историю — робот в Direct знает товар.
        self.assertEqual(run(post.describe_story("M1")), "[Ответ на историю магазина: Электро Эндуро WN-A10 — 15 900 сом, было 18 900 сом]")
        self.assertEqual(run(post.describe_story("чужая")), "")

    def test_no_permission_frees_the_day(self):
        self.use(Meta(media_error="(#10) Application does not have permission for this action"))
        _, result = self.publish(kind="new")
        self.assertEqual(result["status"], "failed")
        self.assertIn("instagram_business_content_publish", result["note"])
        self.assertIsNone(run(post.blocked_reason("new", ITEM["code"], ITEM)))
        self.assertEqual(redis.data.get(post._day_key("post")), "0")

    def test_lost_answer_but_published_is_done(self):
        # media_publish прошёл, а ответ потерялся: спрашиваем контейнер — PUBLISHED, значит вышел.
        self.use(Meta(publish_drops=True))
        _, result = self.publish()
        self.assertEqual(result["status"], "done")

    def test_lost_answer_unclear_keeps_lock(self):
        # Не ясно, вышел ли — замок не снимаем: второй такой же пост хуже, чем подождать.
        self.use(Meta(publish_drops=True, after_drop="FINISHED"))
        _, result = self.publish()
        self.assertEqual(result["status"], "unclear")
        self.assertIn("за последние сутки", run(post.blocked_reason("sale", ITEM["code"], ITEM)))

    def test_instagram_rejects_image(self):
        meta = self.use(Meta(statuses=("ERROR",)))
        _, result = self.publish()
        self.assertEqual(result["status"], "failed")
        self.assertFalse(any(c[1].endswith("/media_publish") for c in meta.calls))  # битую картинку не публикуем

    def test_picture_without_photo_is_not_used(self):
        meta = self.use(Meta(photo_ok=False))
        v, result = self.publish()
        self.assertEqual(result["status"], "failed")
        self.assertNotIn(f"ig:post:img:{v}", redis.data)  # заглушку не храним
        self.assertFalse(any(c[1].endswith("/1784/media") for c in meta.calls))

    def test_two_entries_dont_overwrite_each_other(self):
        self.use(Meta())
        v1 = run(post.prepare("sale", ITEM))
        first, _ = run(post.start("sale", ITEM["code"], ITEM["name"], v1))
        other = {**ITEM, "code": "ЦБ-2", "name": "Утюг"}
        v2 = run(post.prepare("sale", other))
        second, _ = run(post.start("sale", other["code"], other["name"], v2))
        run(post.publish(first, v1, "x"))
        rows = {r["id"]: r for r in run(post.history())}
        self.assertEqual((rows[first]["status"], rows[second]["status"]), ("done", "sending"))

    def test_day_limit_is_atomic(self):
        for i in range(post.rules.POSTS_PER_DAY):
            self.assertIsNotNone(run(post.start("sale", f"c{i}", "x", "v"))[0])
        entry, reason = run(post.start("sale", "c-last", "x", "v"))
        self.assertIsNone(entry)
        self.assertIn("больше в день", reason)
        self.assertIsNone(redis.data.get(post._item_key("post", "sale", "c-last")))  # замок не остался

    def test_restart_mid_publish(self):
        v = run(post.prepare("sale", ITEM))
        entry, _ = run(post.start("sale", ITEM["code"], ITEM["name"], v))
        stored = json.loads(redis.data[f"ig:post:entry:{entry}"])
        stored["at"] = "2020-01-01T00:00:00"
        redis.data[f"ig:post:entry:{entry}"] = json.dumps(stored)
        self.assertEqual(run(post.history())[0]["status"], "interrupted")
        self.assertIsNone(run(post.blocked_reason("sale", ITEM["code"], ITEM)))  # можно повторить

    def test_blocked(self):
        self.assertIn("Выберите товар", run(post.blocked_reason("sale", "", None)))
        self.assertIn("нет в каталоге", run(post.blocked_reason("sale", "X", None)))
        self.assertIn("старой цены", run(post.blocked_reason("sale", "c", {**ITEM, "oldPrice": 0})))
        self.assertIn("нет фото", run(post.blocked_reason("new", "c", {**ITEM, "photos": []})))
        self.assertIn("нельзя заказать", run(post.blocked_reason("new", "c", {**ITEM, "availability": "Нет в наличии"})))
        redis.data[post._day_key("post")] = "10"
        self.assertIn("10 постов", run(post.blocked_reason("new", "c", ITEM)))
        TOKEN["value"] = ""
        self.assertIn("IG_ACCESS_TOKEN", run(post.blocked_reason("new", "c", ITEM)))

    def test_price_change_is_new_picture(self):
        v1 = run(post.prepare("sale", ITEM))
        self.assertNotEqual(v1, run(post.prepare("sale", {**ITEM, "price": 14900})))
        self.assertNotEqual(v1, run(post.prepare("sale", ITEM, "story")))
        plain = run(post.prepare("custom", {**ITEM, "oldPrice": 0}))
        self.assertEqual(json.loads(redis.data[f"ig:post:req:{plain}"])["kind"], "plain")
        self.assertIsNone(run(post.image("0" * 16)))

    def test_explain(self):
        self.assertIn("устарел", post.explain("Instagram 401: Error validating access token"))
        self.assertIn("забрать картинку", post.explain("Instagram 400: (#9004) The media could not be fetched"))


# 10:30 по Бишкеку = 04:30 UTC — слот «Товар дня»
DEAL_TIME = datetime(2026, 10, 5, 4, 30, tzinfo=timezone.utc)
HIT_TIME = datetime(2026, 10, 5, 7, 30, tzinfo=timezone.utc)      # 13:30
EVENING = datetime(2026, 10, 5, 13, 30, tzinfo=timezone.utc)      # 19:30


class AutoStory(Base):
    def test_pick(self):
        today = "2026-10-05"
        small = {**ITEM, "code": "a", "price": 900, "oldPrice": 1000}
        big = {**ITEM, "code": "b", "price": 500, "oldPrice": 1000}
        no_photo = {**ITEM, "code": "c", "price": 100, "oldPrice": 1000, "photos": []}
        hit = {**ITEM, "code": "h", "oldPrice": 0, "hit": True}
        foryou = {**ITEM, "code": "f", "oldPrice": 0, "forYou": True}
        self.assertEqual(post.pick_story([small, big, no_photo], ("foryou", "sale"), {}, set(), today)[0]["code"], "b")
        self.assertEqual(post.pick_story([small, big, foryou], ("foryou", "sale"), {}, set(), today), (foryou, "foryou"))
        # Сегодня уже был в другом слоте — не повторяем; показывали вчера — ждём три дня.
        self.assertEqual(post.pick_story([small, big], ("sale",), {}, {"b"}, today)[0]["code"], "a")
        self.assertIsNone(post.pick_story([hit], ("hit",), {"hit|h": "2026-10-04"}, set(), today))
        self.assertEqual(post.pick_story([hit], ("hit",), {"hit|h": "2026-10-01"}, set(), today)[1], "hit")
        # «Товар дня» — каждый день, даже если вчера показывали.
        deal = {**ITEM, "code": "d", "dealOfDay": True}
        self.assertEqual(post.pick_story([deal], ("deal",), {"deal|d": "2026-10-04"}, set(), today)[1], "deal")

    def test_slots(self):
        self.meta = self.use(Meta())
        CATALOG[:] = [{**ITEM, "dealOfDay": True}, {**ITEM, "code": "ЦБ-2", "name": "Хит", "hit": True, "oldPrice": 0}]
        self.assertIsNone(run(post.auto_story(datetime(2026, 10, 5, 3, 0, tzinfo=timezone.utc))))  # 9:00 — рано
        deal = run(post.auto_story(DEAL_TIME))
        self.assertEqual((deal["status"], deal["mark"]), ("done", "deal"))
        self.assertIn("📸 Авто-история в Instagram · Товар дня", SENT[0])
        self.assertIn("15 900 сом", SENT[0])
        self.assertIsNone(run(post.auto_story(DEAL_TIME)))  # следующая минута — слот уже был
        # Та же история — статусом WhatsApp, со ссылкой на товар в подписи и без плашки «ответьте».
        status = next(c for c in self.meta.calls if c[1].endswith("/sendMediaStatus/tok"))
        self.assertIn("https://site.test/ky/product/cb-00001234", status[2]["caption"])
        wa_v = status[2]["urlFile"].rsplit("/", 1)[1].removesuffix(".jpg")
        self.assertEqual(json.loads(redis.data[f"ig:post:req:{wa_v}"])["cta"], "")
        self.assertIn("✅ Статус WhatsApp тоже вышел", SENT[0])
        hit = run(post.auto_story(HIT_TIME))
        self.assertEqual(hit["mark"], "hit")
        req = json.loads(redis.data[f"ig:post:req:{run(post.prepare('hit', CATALOG[1], 'story'))}"])
        self.assertEqual(req["kind"], "hit")
        # Вечером «Специально для вас»/«Скидка»: товар дня со скидкой уже был сегодня — не повторяем.
        self.assertEqual(run(post.auto_story(EVENING))["status"], "skipped")

    def test_switched_off(self):
        SETTINGS["SITE_IG_AUTO_STORY"] = "0"
        self.assertIsNone(run(post.auto_story(DEAL_TIME)))
        self.assertEqual(SENT, [])

    def test_failure_tells_owner(self):
        self.use(Meta(media_error="(#10) no permission", wa_ok=False))
        CATALOG[:] = [{**ITEM, "dealOfDay": True}]
        self.assertEqual(run(post.auto_story(DEAL_TIME))["status"], "failed")
        self.assertIn("не вышла · Товар дня", SENT[0])
        self.assertIn("Статус WhatsApp не вышел: Green API 466", SENT[0])
        self.assertNotIn(f"wa:status:{post._today()}:{ITEM['code']}", redis.data)  # не вышел — можно повторить


class WeekStats(Base):
    """Недельная статистика: Instagram отдаёт цифры, робот — свои счётчики."""

    def insights(self, permission=True):
        now = datetime.now(timezone.utc)
        fresh = (now - timedelta(days=2)).strftime("%Y-%m-%dT%H:%M:%S+0000")
        old = (now - timedelta(days=20)).strftime("%Y-%m-%dT%H:%M:%S+0000")

        def handler(request: httpx.Request) -> httpx.Response:
            path = request.url.path
            if path.endswith("/me/insights") or path.endswith("/insights"):
                if not permission:
                    return httpx.Response(403, json={"error": {"message": "(#10) Application does not have permission"}})
                if path.endswith("/me/insights"):
                    return httpx.Response(200, json={"data": [
                        {"name": "reach", "total_value": {"value": 5400}},
                        {"name": "website_clicks", "total_value": {"value": 37}},
                    ]})
                return httpx.Response(200, json={"data": [{"name": "reach", "values": [{"value": 900}]}]})
            if path.endswith("/me/media"):
                return httpx.Response(200, json={"data": [
                    {"id": "P1", "caption": "🔥 Скидка −15% · Арзандатуу\nЭлектро Эндуро", "timestamp": fresh, "like_count": 12, "comments_count": 3},
                    {"id": "P0", "caption": "Старый пост", "timestamp": old, "like_count": 99, "comments_count": 9},
                ]})
            if path.endswith("/me"):
                return httpx.Response(200, json={"followers_count": 1250})
            return httpx.Response(404)
        return handler

    def test_report(self):
        self.use(self.insights())
        run(stats.count_dm("u1"))
        run(stats.count_dm("u1"))  # один человек — один, сколько бы ни писал
        run(stats.count_dm("u2"))
        run(stats.count("storyreply"))
        redis.data["ig:stats:followers"] = json.dumps({"day": "20000101", "count": 1200})
        redis.data["ig:stats:stories"] = {"S1": json.dumps({
            "ts": (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%dT%H:%M:%S+0000"),
            "name": "Утюг", "reach": 300, "replies": 4})}
        text = run(stats.week_report())
        self.assertIn("👀 Охват — сколько людей видели магазин: 5 400", text)
        self.assertIn("🌐 Перешли на сайт из профиля: 37", text)
        self.assertIn("👥 Подписчиков: 1 250 (+50 за неделю)", text)
        self.assertIn("💬 Написали в Direct: 2 чел.", text)
        self.assertIn("↩️ Ответили на истории: 1", text)
        self.assertIn("• Скидка −15% Арзандатуу — охват 900, ❤ 12, 💬 3", text)
        self.assertIn("• Утюг — охват 300, ответов 4", text)
        self.assertNotIn("Старый пост", text)  # старше недели — не в отчёт

    def test_sales(self):
        """05.10: «нечта сотув келди?» — заказы бота в Direct и посты, под которыми спрашивали."""
        self.use(self.insights())
        for user in ("u1", "u2", "u3", "u4"):
            run(stats.count_dm(user))
        for _ in range(3):
            run(stats.count_media("R1", "Мини посудомойка 🤩😍 0557100505"))
        run(stats.count_media("P1", "Электро Эндуро"))
        real = stats._orders

        async def orders(since, until):
            return {"made": 1, "paid": 1, "sum": 23900}
        stats._orders = orders
        try:
            text = run(stats.week_report())
        finally:
            stats._orders = real
        self.assertIn("🛒 Заказали в Direct через бота: 1 (оплатили 1 — 23 900 сом)", text)
        self.assertIn("из 4 написавших — 25 %", text)
        self.assertIn("• Мини посудомойка 0557100505 — 3 чел.", text)
        self.assertLess(text.index("Мини посудомойка"), text.index("• Электро Эндуро — 1 чел."))
        # База недоступна — строки о заказах нет, остальное на месте.
        self.assertNotIn("Заказали", run(stats.week_report()))

    def test_no_permission(self):
        self.use(self.insights(permission=False))
        text = run(stats.week_report())
        self.assertIn("instagram_business_manage_insights", text)
        self.assertIn("👥 Подписчиков: 1 250", text)  # подписчики — и без права на статистику

    def use(self, handler):
        real = self.real_client
        post.httpx.AsyncClient = lambda **kw: real(transport=httpx.MockTransport(handler), **kw)
        stats.httpx.AsyncClient = post.httpx.AsyncClient


if __name__ == "__main__":
    unittest.main()
