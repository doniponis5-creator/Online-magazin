"""
Проверки очереди ответов WhatsApp/Instagram-робота (shop_wa_bot.py, shop_ig_bot.py) — без сервера,
без Redis и без интернета (аудит 10.10).

Что проверяем:
  • консультант не ответил (Gemini занят, таймаут, кончились деньги, сайт лежит) — вопрос не
    пропадает: держится в очереди с растущей паузой до 6 часов, ответ уходит один раз;
  • владельцу «консультант не отвечает» — когда покупатель ждёт больше 10 минут, один раз;
  • «передам руководству» — час копим вопросы, сотрудник не написал — отвечает робот;
  • сотрудник ответил и пропал — через час владельцу сразу, один раз на чат;
  • напоминание в срок, названный покупателем («завтра»), флаг «напоминали за 3 дня» не глушит.

Redis — словарь в памяти с часами теста; сайт, Green API и Instagram подменены.
Запуск из папки проекта:
  python -m unittest integrations/sbonus-server/shop/test_shop_wa_bot.py
(или uv run python -m unittest …). На сервер этот файл не попадает: deploy_shop.sh копирует только FILES.
"""
from __future__ import annotations

import asyncio
import fnmatch
import importlib
import importlib.util
import json
import pathlib
import re
import sys
import types
import unittest
from datetime import datetime, timedelta, timezone
from unittest import mock

_HERE = pathlib.Path(__file__).resolve().parent
_PKG = "_shop_wa_bot_test"
OWNER = "996700000001"
BUYER = "996555111222"
BUYER2 = "996555333444"
IG_USER = "1234567890123456"
START = 1_791_000_000.0     # 2026-10-03 ~12:00 по Бишкеку — рабочее время


class Clock:
    """Часы теста: модуль берёт time.time() / time.monotonic() отсюда."""

    def __init__(self, now: float = START):
        self.now = now

    def time(self) -> float:
        return self.now

    def monotonic(self) -> float:
        return self.now

    def go(self, seconds: float) -> None:
        self.now += seconds


class FakeRedis:
    """Только то, что зовут роботы. Строки, срок жизни ключей — по часам теста."""

    def __init__(self, clock: Clock):
        self.clock = clock
        self.data: dict[str, object] = {}
        self.ttl: dict[str, float] = {}

    def _alive(self, key: str) -> bool:
        if key in self.ttl and self.ttl[key] <= self.clock.now:
            self.data.pop(key, None)
            self.ttl.pop(key, None)
        return key in self.data

    async def get(self, key):
        return self.data[key] if self._alive(key) else None

    async def set(self, key, value, ex=None, nx=False):
        if nx and self._alive(key):
            return None
        self.data[key] = str(value)
        if ex:
            self.ttl[key] = self.clock.now + ex
        else:
            self.ttl.pop(key, None)
        return True

    async def delete(self, *keys):
        for key in keys:
            self.data.pop(key, None)
            self.ttl.pop(key, None)

    async def expire(self, key, seconds):
        if self._alive(key):
            self.ttl[key] = self.clock.now + seconds

    def _hash(self, key) -> dict:
        if not self._alive(key):
            self.data[key] = {}
        return self.data[key]  # type: ignore[return-value]

    async def hget(self, key, field):
        return self._hash(key).get(field)

    async def hset(self, key, field, value):
        self._hash(key)[field] = value

    async def hsetnx(self, key, field, value):
        table = self._hash(key)
        if field in table:
            return 0
        table[field] = value
        return 1

    async def hdel(self, key, field):
        self._hash(key).pop(field, None)

    async def hgetall(self, key):
        return dict(self._hash(key))

    async def sadd(self, key, member):
        if not self._alive(key):
            self.data[key] = set()
        self.data[key].add(member)  # type: ignore[union-attr]

    async def scard(self, key):
        return len(self.data[key]) if self._alive(key) else 0  # type: ignore[arg-type]

    async def sismember(self, key, member):
        return self._alive(key) and member in self.data[key]  # type: ignore[operator]

    async def rpush(self, key, value):
        if not self._alive(key):
            self.data[key] = []
        self.data[key].append(value)  # type: ignore[union-attr]

    async def lpop(self, key):
        if not self._alive(key) or not self.data[key]:
            return None
        return self.data[key].pop(0)  # type: ignore[union-attr]

    async def incr(self, key):
        value = int(self.data[key]) + 1 if self._alive(key) else 1
        self.data[key] = str(value)
        return value

    async def scan_iter(self, match="*", count=None):
        for key in list(self.data):
            if self._alive(key) and fnmatch.fnmatchcase(key, match):
                yield key


CLOCK = Clock()
REDIS = FakeRedis(CLOCK)


def _stub(name: str, **attrs) -> types.ModuleType:
    module = types.ModuleType(name)
    module.__dict__.update(attrs)
    return module


def _no_whatsapp():
    raise RuntimeError("Green API в тестах нет")


async def _no_login(*_args):
    return None


class _Router:
    def __init__(self, *args, **kwargs):
        self.routes = []

    def _deco(self, *args, **kwargs):
        return lambda fn: fn

    get = post = _deco


class _Timeout(Exception):
    pass


def _load():
    """Настоящие shop_wa_bot.py и shop_ig_bot.py. Приложение сервера (app.*) и соседи — пустышки."""
    added = []
    for name, attrs in {
        "httpx": {"AsyncClient": None, "TimeoutException": _Timeout},
        "fastapi": {"APIRouter": _Router, "HTTPException": Exception, "Request": object},
        "fastapi.responses": {"PlainTextResponse": object},
    }.items():
        try:
            importlib.import_module(name)
        except ImportError:
            sys.modules[name] = _stub(name, **attrs)
            added.append(name)
    for name, attrs in {
        "app": {}, "app.core": {}, "app.core.redis": {"redis_client": REDIS},
    }.items():
        if name not in sys.modules or name == "app.core.redis":
            sys.modules[name] = _stub(name, **attrs)
            added.append(name)
    package = _stub(_PKG)
    package.__path__ = [str(_HERE)]
    sys.modules[_PKG] = package
    sys.modules[f"{_PKG}.shop_customers"] = _stub(
        f"{_PKG}.shop_customers", WA_LOGIN_RE=re.compile(r"Код входа: \d{6}"), wa_login_message=_no_login)
    sys.modules[f"{_PKG}.shop_router"] = _stub(
        f"{_PKG}.shop_router", _cfg=lambda name, default="": "token" if name == "ig_access_token" else default,
        _admin_phone=lambda: OWNER, _site_base_url=lambda: "https://smarket.test", _site_secret=lambda: "secret")
    sys.modules[f"{_PKG}.shop_whatsapp"] = _stub(f"{_PKG}.shop_whatsapp", _url=_no_whatsapp)
    loaded = []
    try:
        for name in ("shop_wa_bot", "shop_ig_bot"):
            spec = importlib.util.spec_from_file_location(f"{_PKG}.{name}", _HERE / f"{name}.py")
            module = importlib.util.module_from_spec(spec)
            sys.modules[spec.name] = module
            spec.loader.exec_module(module)
            loaded.append(module)
    finally:
        for name in added:
            sys.modules.pop(name, None)
    return loaded


wa, ig = _load()
TimeoutError_ = getattr(wa.httpx, "TimeoutException", _Timeout)


def run(coro):
    return asyncio.run(coro)


def incoming(text: str, mid: str, chat: str = BUYER) -> dict:
    return {"chatId": f"{chat}@c.us", "typeMessage": "textMessage", "textMessage": text,
            "idMessage": mid, "timestamp": int(CLOCK.now), "senderName": "Умар"}


def staff(text: str, mid: str, chat: str = BUYER) -> dict:
    return {"chatId": f"{chat}@c.us", "typeMessage": "textMessage", "textMessage": text,
            "idMessage": mid, "sendByApi": False}


GOOD = {"ok": True, "text": "Есть, 23 900 сом.", "source": "gemini", "products": []}


def local(why: str) -> dict:
    return {"ok": True, "text": "шаблон", "source": "local", "why": why, "products": []}


class Robot:
    """Обвязка: журнал Green API, ответы сайта и всё, что ушло в WhatsApp."""

    def __init__(self, case: unittest.TestCase):
        self.incoming: list[dict] = []
        self.outgoing: list[dict] = []
        self.site: list = []          # что ответит сайт на каждый вопрос (dict или исключение)
        self.asked: list[str] = []    # кому задавали вопрос
        self.sent: list[tuple[str, str]] = []

        async def journal(method, minutes=15):
            return list(self.incoming if method == "lastIncomingMessages" else self.outgoing)

        async def ask_site(digits, name, asked):
            self.asked.append(digits)
            answer = self.site.pop(0) if self.site else GOOD
            if isinstance(answer, Exception):
                raise answer
            return answer

        async def send_text(digits, text):
            self.sent.append((digits, text))

        async def nothing(*_args, **_kwargs):
            return None

        async def settings():
            return True, 5

        def bishkek():
            return datetime.fromtimestamp(CLOCK.now, timezone.utc) + timedelta(hours=6)

        for patch in (
            mock.patch.object(wa, "time", CLOCK),
            mock.patch.object(ig, "time", CLOCK),
            mock.patch.object(wa, "_journal", journal),
            mock.patch.object(wa, "_ask_site", ask_site),
            mock.patch.object(wa, "_send_text", send_text),
            mock.patch.object(wa, "_send_photos", nothing),
            mock.patch.object(wa, "check_spend", nothing),
            mock.patch.object(wa, "_settings", settings),
            mock.patch.object(wa, "_bishkek_now", bishkek),
        ):
            patch.start()
            case.addCleanup(patch.stop)
        REDIS.data.clear()
        REDIS.ttl.clear()
        CLOCK.now = START

    def poll(self) -> dict:
        result = run(wa.poll_once())
        self.incoming.clear()
        self.outgoing.clear()
        return result

    def to(self, who: str) -> list[str]:
        return [text for digits, text in self.sent if digits == who]

    def pending(self, who: str = BUYER) -> dict | None:
        raw = REDIS.data.get("wa:pending", {}).get(who)  # type: ignore[union-attr]
        return json.loads(raw) if raw else None


# ── Чистые решения ───────────────────────────────────────────────────────────

class QueueRules(unittest.TestCase):
    def test_entry_keeps_waiting_since_and_tries(self):
        fresh = wa.queue_entry(None, {"ts": 100, "voice": False})
        self.assertEqual(fresh["first"], 100)
        held = json.dumps({"ts": 100, "first": 90, "tries": 3, "next": 400, "why": "busy"})
        merged = wa.queue_entry(held, {"ts": 200, "name": "Умар", "voice": False})
        self.assertEqual((merged["ts"], merged["name"]), (200, "Умар"))     # новое сообщение
        self.assertEqual((merged["first"], merged["tries"], merged["next"]), (90, 3, 400))   # пауза не сбрасывается
        self.assertEqual(wa.queue_entry("{битое", {"ts": 5})["first"], 5)
        self.assertEqual(wa.queue_entry(json.dumps({"ts": 50}), {"ts": 70})["first"], 50)   # ждёт с первого

    def test_step(self):
        step = wa.pending_step
        p = {"ts": 1000, "first": 1000}
        self.assertEqual(step(p, 1400, "", 300), "answer")
        self.assertEqual(step(p, 1100, "", 300), "keep")                 # ждём сотрудника 5 минут
        self.assertEqual(step(p, 1100, "", 0), "answer")                 # робот уже ведёт разговор
        self.assertEqual(step(p, 1400, wa.HUMAN_HANDOFF, 0), "keep")     # передали руководству — копим
        self.assertEqual(step(p, 1400, wa.HUMAN_MUTE, 0), "drop")
        self.assertEqual(step(p, 1400, wa.HUMAN_STAFF, 0), "human")
        self.assertEqual(step({**p, "tries": 2, "next": 2000}, 1500, "", 0), "keep")   # пауза
        self.assertEqual(step({**p, "tries": 2, "next": 2000}, 2000, "", 0), "answer")
        self.assertEqual(step({**p, "tries": 9, "next": 0}, 1000 + wa.HOLD_MAX + 1, "", 0), "drop")
        # Instagram: старое (3 часа) — не отвечаем, а удержанное — держим до 6 часов.
        self.assertEqual(step(p, 1000 + 4 * 3600, "", 0, stale=3 * 3600), "drop")
        self.assertEqual(step({**p, "tries": 5}, 1000 + 4 * 3600, "", 0, stale=3 * 3600), "answer")

    def test_hold_backs_off_and_gives_up(self):
        p, now, pauses = {"ts": 0, "first": 0}, 0.0, []
        while True:
            held = wa.hold(p, now, "busy")
            if held is None:
                break
            pauses.append(held["next"] - now)
            self.assertEqual(held["why"], "busy")
            self.assertEqual(held["first"], 0)
            p, now = held, held["next"]
        self.assertEqual(pauses[:7], [60, 60, 120, 180, 300, 600, 900])
        self.assertTrue(all(x == 900 for x in pauses[7:]))     # дальше пауза не растёт
        self.assertGreater(now, wa.HOLD_MAX)                    # держали 6 часов, не дольше
        self.assertLess(now, wa.HOLD_MAX + 901)
        self.assertLess(len(pauses), 40)                        # конечное число попыток

    def test_alert_after_ten_minutes_money_at_once(self):
        self.assertFalse(wa.hold_alert({"first": 0, "why": "busy"}, 9 * 60))
        self.assertTrue(wa.hold_alert({"first": 0, "why": "busy"}, 10 * 60))
        self.assertTrue(wa.hold_alert({"first": 0, "why": "money"}, 5))

    def test_late_step(self):
        e = {"first": 0}
        noon = 13
        self.assertEqual(wa.late_step(e, 3599, "1", noon), "keep")
        self.assertEqual(wa.late_step(e, 3600, "1", noon), "alert")
        self.assertEqual(wa.late_step(e, 3600, "1", 23), "keep")        # ночью не будим
        self.assertEqual(wa.late_step({**e, "alerted": True}, 9999, "1", noon), "keep")   # один раз
        self.assertEqual(wa.late_step(e, 3600, "", noon), "drop")       # 12 часов прошли — снова робот
        self.assertEqual(wa.late_step(e, 3600, wa.HUMAN_MUTE, noon), "drop")

    def test_nudge_flag(self):
        self.assertEqual(wa.nudge_flag("wa", "1", {}), ("wa:nudged:1", wa.NUDGE_QUIET))
        self.assertEqual(wa.nudge_flag("ig", "7", {"planned": True}), ("ig:plannednudge:7", 24 * 3600))

    def test_site_reply(self):
        self.assertEqual(wa.site_reply(200, {"ok": True, "text": "x"}, "t")["text"], "x")
        self.assertIsNone(wa.site_reply(200, {"ok": False}, "t"))
        self.assertIsNone(wa.site_reply(400, None, "t"))               # нечего спрашивать — не держим
        for status in (404, 500, 502):
            with self.assertRaises(wa.SiteDown):
                wa.site_reply(status, None, "t")
        self.assertEqual(wa.site_failure(TimeoutError_("x")), "slow")
        self.assertEqual(wa.site_failure(wa.SiteDown("502")), "site")

    def test_site_timeout(self):
        self.assertEqual(wa.SITE_TIMEOUT, 50)


# ── WhatsApp целиком: poll_once с подменённым Redis ───────────────────────────

class BrainDown(unittest.TestCase):
    def setUp(self):
        self.bot = Robot(self)

    def test_question_survives_outage_and_is_answered_once(self):
        bot = self.bot
        bot.incoming = [incoming("Чоңу барбы?", "m1")]
        bot.poll()
        self.assertEqual(bot.asked, [])                      # 5 минут ждём сотрудника
        CLOCK.go(5 * 60)
        bot.site = [local("busy")]
        bot.poll()
        self.assertEqual(bot.asked, [BUYER])
        self.assertEqual(bot.to(BUYER), [])                  # шаблон покупателю не шлём
        self.assertEqual(bot.pending()["tries"], 1)          # вопрос в очереди, а не выброшен
        self.assertEqual(bot.to(OWNER), [])                  # ждёт 5 минут — владельцу рано
        # Покупатель дописал, пока Gemini лежит: одна запись, ждёт с первого сообщения.
        bot.incoming = [incoming("Алло?", "m2")]
        bot.site = [local("timeout")] * 20
        for _ in range(8):
            CLOCK.go(60)
            bot.poll()
        self.assertEqual(len(bot.to(OWNER)), 1)              # ждёт > 10 минут — одна тревога
        self.assertIn("держит до 6 часов", bot.to(OWNER)[0])
        tries = len(bot.asked)
        self.assertLess(tries, 8)                            # паузы растут: не каждую минуту
        bot.site = []                                        # Gemini вернулся
        for _ in range(20):
            CLOCK.go(60)
            bot.poll()
        self.assertEqual(bot.to(BUYER), [GOOD["text"]])      # ответ один раз
        self.assertIsNone(bot.pending())
        self.assertEqual(len(bot.to(OWNER)), 1)              # тревога не повторилась

    def test_timeout_and_dead_site_are_held(self):
        bot = self.bot
        REDIS.data[f"wa:botactive:{BUYER}"] = "1"            # разговор уже идёт — отвечаем сразу
        bot.incoming = [incoming("Доставка есть?", "m1")]
        bot.site = [TimeoutError_("read timeout")]
        bot.poll()
        self.assertEqual(bot.pending()["why"], "slow")
        CLOCK.go(60)
        bot.site = [wa.SiteDown("502")]
        bot.poll()
        self.assertEqual((bot.pending()["why"], bot.pending()["tries"]), ("site", 2))
        CLOCK.go(120)
        bot.poll()
        self.assertEqual(bot.to(BUYER), [GOOD["text"]])
        self.assertIsNone(bot.pending())

    def test_one_probe_per_run_when_down(self):
        bot = self.bot
        bot.incoming = [incoming("Салам", "a1", BUYER), incoming("Баасы?", "b1", BUYER2)]
        bot.poll()
        CLOCK.go(5 * 60)
        bot.site = [local("busy"), local("busy")]
        bot.poll()
        self.assertEqual(len(bot.asked), 1)                  # второго не спрашиваем: сайт уже не ответил
        self.assertEqual(bot.pending(BUYER)["tries"], 1)
        self.assertEqual(bot.pending(BUYER2)["tries"], 1)    # но и его не выбросили

    def test_money_tells_owner_at_once(self):
        bot = self.bot
        REDIS.data[f"wa:botactive:{BUYER}"] = "1"
        REDIS.data["bot:alerted"] = "1"                       # недавно уже была тревога о таймауте
        bot.incoming = [incoming("Narxi qancha?", "m1")]
        bot.site = [local("money")]
        bot.poll()
        self.assertEqual(len(bot.to(OWNER)), 1)
        self.assertIn("ai.studio/spend", bot.to(OWNER)[0])
        self.assertEqual(bot.pending()["why"], "money")

    def test_gives_up_after_six_hours(self):
        bot = self.bot
        REDIS.data[f"wa:botactive:{BUYER}"] = "1"
        bot.incoming = [incoming("Бар бы?", "m1")]
        bot.site = [local("busy")] * 100
        for _ in range(7 * 60):
            bot.poll()
            CLOCK.go(60)
            if bot.pending() is None:
                break
        self.assertIsNone(bot.pending())
        self.assertGreaterEqual(CLOCK.now - START, wa.HOLD_MAX)
        self.assertLess(len(bot.asked), 40)
        self.assertEqual(bot.to(BUYER), [])

    def test_send_failure_after_answer_is_not_retried(self):
        """Сайт ответил, а Green API упал — второй раз не спрашиваем: покупатель мог получить ответ."""
        bot = self.bot
        REDIS.data[f"wa:botactive:{BUYER}"] = "1"
        bot.incoming = [incoming("Есть?", "m1")]

        async def broken(digits, text):
            raise RuntimeError("Green API 500")

        with mock.patch.object(wa, "_send_text", broken):
            bot.poll()
        self.assertIsNone(bot.pending())
        CLOCK.go(600)
        bot.poll()
        self.assertEqual(len(bot.asked), 1)


class Handoff(unittest.TestCase):
    def setUp(self):
        self.bot = Robot(self)
        REDIS.data[f"wa:botactive:{BUYER}"] = "1"
        self.bot.incoming = [incoming("Позвоните мне", "m1")]
        self.bot.site = [{**GOOD, "text": "Передам руководству, позвоним.", "handoff": True}]
        self.bot.poll()
        self.assertEqual(REDIS.data[f"wa:human:{BUYER}"], wa.HUMAN_HANDOFF)

    def test_questions_in_handoff_hour_answered_by_robot(self):
        bot = self.bot
        CLOCK.go(10 * 60)
        bot.incoming = [incoming("Чоңу барбы?", "m2")]
        bot.poll()
        CLOCK.go(10 * 60)
        bot.incoming = [incoming("Бишкекте би?", "m3")]
        bot.poll()
        self.assertEqual(len(bot.asked), 1)                  # в этот час робот молчит
        self.assertIsNotNone(bot.pending())                  # но вопрос не выброшен
        CLOCK.go(45 * 60)                                    # час прошёл, сотрудник не писал
        bot.poll()
        self.assertEqual(len(bot.asked), 2)                  # оба вопроса — одним ответом
        self.assertIsNone(bot.pending())
        turns = json.loads(REDIS.data[f"wa:turns:{BUYER}"])
        self.assertEqual([t["role"] for t in turns][-3:], ["user", "user", "assistant"])

    def test_staff_answered_then_vanished(self):
        bot = self.bot
        CLOCK.go(10 * 60)
        bot.outgoing = [staff("Здравствуйте, сейчас посмотрю", "o1")]
        bot.poll()
        self.assertEqual(REDIS.data[f"wa:human:{BUYER}"], wa.HUMAN_STAFF)
        CLOCK.go(60)
        bot.incoming = [incoming("Ну что там?", "m2")]
        bot.poll()
        self.assertIsNone(bot.pending())                     # робот молчит: ведёт сотрудник
        CLOCK.go(30 * 60)
        bot.poll()
        self.assertEqual(bot.to(OWNER), [])                  # полчаса — рано
        CLOCK.go(31 * 60)
        bot.poll()
        self.assertEqual(len(bot.to(OWNER)), 1)
        self.assertIn(f"+{BUYER}", bot.to(OWNER)[0])
        self.assertIn("Ну что там?", bot.to(OWNER)[0])
        CLOCK.go(60 * 60)
        bot.incoming = [incoming("???", "m3")]
        bot.poll()
        self.assertEqual(len(bot.to(OWNER)), 1)              # один раз на чат
        self.assertEqual(len(bot.asked), 1)                  # робот так и молчит
        # Сотрудник ответил — следить больше не за чем.
        bot.outgoing = [staff("Есть, привезём завтра", "o2")]
        bot.poll()
        self.assertNotIn(BUYER, REDIS.data.get("wa:late", {}))

    def test_staff_during_handoff_keeps_robot_quiet(self):
        bot = self.bot
        CLOCK.go(5 * 60)
        bot.incoming = [incoming("Когда позвоните?", "m2")]
        bot.poll()
        CLOCK.go(60)
        bot.outgoing = [staff("Сейчас наберу", "o1")]
        bot.poll()
        CLOCK.go(2 * 3600)
        bot.poll()
        self.assertEqual(len(bot.asked), 1)                  # робот не вмешался


class Nudge(unittest.TestCase):
    def setUp(self):
        self.bot = Robot(self)
        self.posted: list[dict] = []
        posted = self.posted

        class Response:
            status_code = 200

            def json(self):
                return {"ok": True, "text": "Здравствуйте! Ещё актуально?"}

        class Client:
            def __init__(self, *args, **kwargs):
                pass

            async def __aenter__(self):
                return self

            async def __aexit__(self, *args):
                return False

            async def post(self, url, content=b"", headers=None):
                posted.append(json.loads(content))
                return Response()

        patch = mock.patch.object(wa.httpx, "AsyncClient", Client)
        patch.start()
        self.addCleanup(patch.stop)

    def test_planned_nudge_not_blocked_by_three_day_flag(self):
        bot = self.bot
        REDIS.data[f"wa:nudged:{BUYER}"] = "1"                # недавно уже спрашивали «ещё актуально?»
        REDIS.ttl[f"wa:nudged:{BUYER}"] = CLOCK.now + wa.NUDGE_QUIET
        REDIS.data[f"wa:botactive:{BUYER}"] = "1"
        bot.incoming = [incoming("Эртең алам", "m1")]
        bot.site = [{**GOOD, "text": "Макул, эртең жазабыз.", "followAfter": 24 * 3600}]
        bot.poll()
        self.assertTrue(json.loads(REDIS.data[f"wa:nudge:{BUYER}"])["planned"])
        CLOCK.go(24 * 3600 + 60)                             # «завтра» в то же время — рабочий день
        bot.poll()
        self.assertEqual(bot.to(BUYER)[-1], "Здравствуйте! Ещё актуально?")
        self.assertNotIn(f"wa:nudge:{BUYER}", REDIS.data)
        # Второе «завтра» в те же сутки — не напоминаем дважды.
        bot.incoming = [incoming("Ертең", "m2")]
        bot.site = [{**GOOD, "text": "Жарайт.", "followAfter": 3 * 3600}]
        bot.poll()
        CLOCK.go(3 * 3600)
        sent = len(bot.to(BUYER))
        bot.poll()
        self.assertEqual(len(bot.to(BUYER)), sent)

    def test_plain_nudge_still_three_days(self):
        bot = self.bot
        REDIS.data[f"wa:nudged:{BUYER}"] = "1"
        REDIS.data[f"wa:nudge:{BUYER}"] = json.dumps({"ts": CLOCK.now - wa.NUDGE_AFTER - 1, "name": ""})
        bot.poll()
        self.assertEqual(bot.to(BUYER), [])


# ── Instagram: та же очередь ─────────────────────────────────────────────────

class Instagram(unittest.TestCase):
    def setUp(self):
        Robot(self)                        # Redis, часы, WhatsApp владельца
        self.sent: list[tuple[str, str]] = []
        self.site: list = []
        self.asked = 0

        async def ask_site(user, asked):
            self.asked += 1
            answer = self.site.pop(0) if self.site else GOOD
            if isinstance(answer, Exception):
                raise answer
            return answer

        async def send_text(user, text):
            self.sent.append((user, text))

        async def nothing(*_args, **_kwargs):
            return None

        async def no_photos(user, products):
            return []

        for patch in (
            mock.patch.object(ig, "_ask_site", ask_site),
            mock.patch.object(ig, "_send_text", send_text),
            mock.patch.object(ig, "_send_photos", nothing),
            mock.patch.object(ig, "_new_photos", no_photos),
            mock.patch.object(ig, "_stat", nothing),
        ):
            patch.start()
            self.addCleanup(patch.stop)

    def message(self, text: str, mid: str):
        run(ig._on_message({"kind": "in", "user": IG_USER, "mid": mid, "ts": CLOCK.now, "text": text}))

    def queue(self) -> int:
        return run(wa.answer_queue("ig", "Instagram", 0, ig._reply_one, stale=ig.STALE_AFTER))

    def pending(self):
        raw = REDIS.data.get("ig:pending", {}).get(IG_USER)  # type: ignore[union-attr]
        return json.loads(raw) if raw else None

    def test_question_held_until_gemini_back(self):
        self.message("Баасы канча?", "i1")
        self.site = [local("busy"), local("busy")]
        self.queue()
        self.assertEqual(self.pending()["tries"], 1)
        self.message("Алло", "i2")
        CLOCK.go(60)
        self.queue()
        self.assertEqual(self.sent, [])
        CLOCK.go(4 * 3600)                    # дольше STALE_AFTER, но вопрос удержан — отвечаем
        self.assertEqual(self.queue(), 1)
        self.assertEqual(self.sent, [(IG_USER, GOOD["text"])])
        self.assertIsNone(self.pending())

    def test_timeout_held(self):
        self.message("Есть?", "i1")
        self.site = [TimeoutError_("timeout")]
        self.queue()
        self.assertEqual(self.pending()["why"], "slow")

    def test_handoff_hour_then_robot(self):
        self.message("Позвоните", "i1")
        self.site = [{**GOOD, "handoff": True}]
        self.queue()
        self.assertEqual(REDIS.data[f"ig:human:{IG_USER}"], wa.HUMAN_HANDOFF)
        CLOCK.go(600)
        self.message("Бишкекте барбы?", "i2")
        self.queue()
        self.assertEqual(self.asked, 1)
        CLOCK.go(3600)
        self.queue()
        self.assertEqual(self.asked, 2)
        self.assertIsNone(self.pending())

    def test_comment_kept_when_site_down(self):
        async def text_only(*_args):
            return ""

        calls = []

        async def plan(event, caption):
            calls.append(event["id"])
            if len(calls) == 1:
                raise TimeoutError_("timeout")
            return {"action": "skip"}

        event = {"kind": "comment", "id": "c1", "mid": "c:c1", "user": IG_USER, "media": "m1", "text": "Баасы?", "ts": CLOCK.now}
        REDIS.data["ig:comments"] = [json.dumps(event), json.dumps({**event, "id": "c2", "mid": "c:c2"})]
        with mock.patch.object(ig, "_plan_comment", plan), mock.patch.object(ig, "_own_username", text_only), \
                mock.patch.object(ig, "_caption", text_only):
            run(ig._handle_comments())
            self.assertEqual(calls, ["c1"])                   # сайт лежит — остальные не спрашиваем
            self.assertEqual([json.loads(x)["id"] for x in REDIS.data["ig:comments"]], ["c2", "c1"])   # c1 — в конец
            run(ig._handle_comments())
            self.assertEqual(calls, ["c1", "c2", "c1"])       # и c1 разобран снова, а не потерян

    def test_staff_echo_then_late_alert(self):
        run(ig._on_echo({"kind": "echo", "user": IG_USER, "mid": "e1", "text": "Сейчас уточню"}))
        self.message("Ну что?", "i1")
        self.queue()
        self.assertIsNone(self.pending())
        CLOCK.go(3601)
        self.assertEqual(run(wa.late_check("ig", ig._ig_label)), 1)
        self.assertEqual(run(wa.late_check("ig", ig._ig_label)), 0)   # один раз


if __name__ == "__main__":
    unittest.main()
