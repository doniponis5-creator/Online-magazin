"""
Проверки отправки push (shop_push.send) — без сервера, без базы и без интернета.

Сеть (httpx) и база подменены: тест видит, куда ушёл каждый адрес телефона
и что с ним сделали потом — стёрли, записали неудачу или не тронули.

Запуск из папки проекта (библиотеки сервера не нужны — вместо них пустышки):
  python -m unittest integrations/sbonus-server/shop/test_shop_push_send.py

На сервер этот файл не попадает: deploy_shop.sh копирует только список FILES.
Ключи здесь — выдуманные: подпись пропусков тоже подменена.
"""
from __future__ import annotations

import base64
import importlib
import importlib.util
import json
import pathlib
import sys
import time
import types
import unittest
from unittest import mock

_HERE = pathlib.Path(__file__).resolve().parent
# Своё имя пакета: shop_push.py импортирует соседей через «from . import».
_PKG = "_shop_push_send_test"

# Настройки сервера для shop_push — из этого словаря, а не из .env.production.
CFG: dict[str, str] = {}


def _cfg(name: str, default: str = "") -> str:
    return CFG.get(name) or default


def _stub(name: str, **attrs) -> types.ModuleType:
    module = types.ModuleType(name)
    module.__dict__.update(attrs)
    return module


def _load_push():
    """
    Загрузить настоящий shop_push.py. Чего нет на этом компьютере (sqlalchemy,
    httpx) — подкладываем пустышку только на время загрузки: сеть и базу
    тесты всё равно подменяют.
    """
    stubs = {
        "httpx": {"AsyncClient": None},
        "sqlalchemy": {"select": None, "text": None},
        "sqlalchemy.ext": {},
        "sqlalchemy.ext.asyncio": {"AsyncSession": object},
    }
    added = []
    for name, attrs in stubs.items():
        try:
            importlib.import_module(name)
        except ImportError:
            sys.modules[name] = _stub(name, **attrs)
            added.append(name)
    package = _stub(_PKG)
    package.__path__ = [str(_HERE)]
    sys.modules[_PKG] = package
    sys.modules[f"{_PKG}.shop_router"] = _stub(f"{_PKG}.shop_router", _cfg=_cfg)
    spec = importlib.util.spec_from_file_location(f"{_PKG}.shop_push", _HERE / "shop_push.py")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    try:
        spec.loader.exec_module(module)
    finally:
        # Пустышки другим тестам не оставляем.
        for name in added:
            sys.modules.pop(name, None)
    return module


push = _load_push()

PHONE = "996555123456"
DB = object()  # сама база не нужна: чтение и запись адресов подменены
PROJECT = "demo-shop-123"
APPLE_HOST = "https://api.sandbox.push.apple.com"
GOOGLE_URL = f"https://fcm.googleapis.com/v1/projects/{PROJECT}/messages:send"


def _fcm_key() -> str:
    account = {
        "type": "service_account",
        "project_id": PROJECT,
        "private_key": "-----BEGIN PRIVATE KEY-----\nfake\n-----END PRIVATE KEY-----\n",
        "client_email": f"push@{PROJECT}.iam.gserviceaccount.com",
    }
    return base64.b64encode(json.dumps(account).encode("utf-8")).decode("ascii")


def _keys() -> dict[str, str]:
    """Оба ключа есть: и Apple, и Google."""
    return {
        "apns_key_p8": "-----BEGIN PRIVATE KEY-----\nfake\n-----END PRIVATE KEY-----",
        "apns_key_id": "ABCDE12345",
        "apns_team_id": "TEAM123456",
        "fcm_service_account_b64": _fcm_key(),
    }


def _fcm_error(code: int, status: str, fcm_code: str = "") -> dict:
    error = {"code": code, "message": "error", "status": status, "details": []}
    if fcm_code:
        error["details"].append({
            "@type": "type.googleapis.com/google.firebase.fcm.v1.FcmError",
            "errorCode": fcm_code,
        })
    return {"error": error}


class _Response:
    def __init__(self, status: int, body: dict | str):
        self.status_code = status
        self._body = body
        self.text = body if isinstance(body, str) else json.dumps(body)

    def json(self):
        # Страница вместо JSON — ошибка разбора, как у настоящего httpx.
        return json.loads(self._body) if isinstance(self._body, str) else self._body


class _Client:
    def __init__(self, net: "_Net"):
        self.net = net

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    async def post(self, url, json=None, headers=None, data=None):
        if url.startswith(APPLE_HOST + "/3/device/"):
            where, token = "apple", url.rsplit("/", 1)[1]
        elif url == GOOGLE_URL:
            where, token = "google", json["message"]["token"]
        else:
            raise AssertionError(f"запрос не туда: {url}")
        self.net.calls.append({"to": where, "token": token, "headers": headers or {}, "json": json})
        status, body = self.net.answers.get(token, (200, {}))
        return _Response(status, body)


class _Net:
    """Подменённая сеть: запоминает запросы, отвечает по адресу телефона (по умолчанию — 200)."""

    def __init__(self):
        self.calls: list[dict] = []
        self.clients: list[dict] = []
        self.answers: dict[str, tuple[int, dict | str]] = {}

    def client(self, **options):
        self.clients.append(options)
        return _Client(self)


class SendTest(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self._fresh()
        CFG.clear()
        CFG.update(_keys())
        self.addCleanup(CFG.clear)
        patches = {
            # Сеть — через self.net, чтобы _fresh() мог начать её с чистого листа.
            "httpx": types.SimpleNamespace(AsyncClient=lambda **options: self.net.client(**options)),
            "_devices": self._devices,
            "_drop": self._drop,
            "_fail": self._fail,
            "_jwt": lambda: "apple-jwt",
            "_fcm_access_token": self._fcm_access_token,
            "_cached_fcm": None,
        }
        for name, value in patches.items():
            patcher = mock.patch.object(push, name, value)
            patcher.start()
            self.addCleanup(patcher.stop)

    def _fresh(self):
        self.net = _Net()
        self.devices: list[tuple[str, str]] = []
        self.dropped: list[str] = []
        self.failed: list[str] = []
        self.token_asked: list[str] = []

    # ── подменённая база и токен доступа Google ──
    async def _devices(self, db, phone):
        self.assertEqual(phone, PHONE)
        return list(self.devices)

    async def _drop(self, db, token):
        self.dropped.append(token)

    async def _fail(self, db, token):
        self.failed.append(token)

    async def _fcm_access_token(self, client, account):
        self.token_asked.append(account["project_id"])
        return "google-access"

    async def send(self) -> int:
        return await push.send(DB, PHONE, "Заказ оплачен", "Заказ SC-1 оплачен.", {"orderId": "SC-1"})

    def sent_to(self, where: str) -> list[str]:
        return [call["token"] for call in self.net.calls if call["to"] == where]

    # ── проверки ──
    async def test_android_goes_through_google_and_iphone_through_apple(self):
        self.devices = [("iphone-1", "ios"), ("android-1", "android"), ("iphone-2", "ios")]
        self.assertEqual(await self.send(), 3)
        self.assertEqual(self.sent_to("apple"), ["iphone-1", "iphone-2"])
        self.assertEqual(self.sent_to("google"), ["android-1"])

        apple = next(call for call in self.net.calls if call["to"] == "apple")
        self.assertEqual(apple["headers"]["authorization"], "bearer apple-jwt")
        self.assertEqual(apple["json"]["aps"]["alert"], {"title": "Заказ оплачен", "body": "Заказ SC-1 оплачен."})
        google = next(call for call in self.net.calls if call["to"] == "google")
        self.assertEqual(google["headers"]["authorization"], "Bearer google-access")
        self.assertEqual(google["json"]["message"]["data"], {"orderId": "SC-1"})
        # Apple принимает только HTTP/2.
        self.assertTrue(self.net.clients[0].get("http2"))
        self.assertEqual((self.dropped, self.failed), ([], []))

    async def test_without_google_key_iphone_still_gets_it(self):
        for name, key in {"ключа нет": "", "ключ испорчен": "не base64 !!!"}.items():
            with self.subTest(name):
                self._fresh()
                CFG["fcm_service_account_b64"] = key
                self.devices = [("android-1", "android"), ("iphone-1", "ios")]
                self.assertEqual(await self.send(), 1)
                self.assertEqual(self.sent_to("apple"), ["iphone-1"])
                self.assertEqual(self.sent_to("google"), [])
                self.assertEqual(self.token_asked, [])
                # Адрес Android не виноват, что ключа нет: не стираем и неудачей не считаем.
                self.assertEqual((self.dropped, self.failed), ([], []))

    async def test_without_apple_key_android_still_gets_it(self):
        for name in ("apns_key_p8", "apns_key_id", "apns_team_id"):
            CFG.pop(name)
        self.devices = [("iphone-1", "ios"), ("android-1", "android")]
        self.assertEqual(await self.send(), 1)
        self.assertEqual(self.sent_to("apple"), [])
        self.assertEqual(self.sent_to("google"), ["android-1"])
        self.assertEqual((self.dropped, self.failed), ([], []))

    async def test_rejected_google_key_leaves_other_addresses_alone(self):
        cases = {
            "ключ не принят": (401, _fcm_error(401, "UNAUTHENTICATED")),
            "у ключа нет прав": (403, _fcm_error(403, "PERMISSION_DENIED")),
        }
        for name, answer in cases.items():
            with self.subTest(name):
                self._fresh()
                self.devices = [
                    ("iphone-1", "ios"),
                    ("android-1", "android"),
                    ("android-2", "android"),
                    ("android-3", "android"),
                ]
                self.net.answers["android-1"] = answer
                push._cached_fcm = ("old-access", time.time())
                with self.assertLogs("sbonus.shop.push", "ERROR"):
                    # iPhone своё получил: сбой Google ему не мешает.
                    self.assertEqual(await self.send(), 1)
                self.assertEqual(self.sent_to("apple"), ["iphone-1"])
                # Виноват ключ, а не адреса: дальше по Android не шлём,
                # ни один адрес не стёрт и неудачей не записан.
                self.assertEqual(self.sent_to("google"), ["android-1"])
                self.assertEqual((self.dropped, self.failed), ([], []))
                # Токен доступа забыт — в следующий раз попросим новый.
                self.assertIsNone(push._cached_fcm)

    async def test_google_answer_decides_each_address(self):
        self.devices = [
            ("android-gone", "android"),
            ("android-busy", "android"),
            ("android-proxy", "android"),
            ("android-ok", "android"),
        ]
        self.net.answers.update({
            "android-gone": (404, _fcm_error(404, "NOT_FOUND", "UNREGISTERED")),
            "android-busy": (503, _fcm_error(503, "UNAVAILABLE", "UNAVAILABLE")),
            # 404 от прокси — не про адрес: не стираем, только +1 к неудачам.
            "android-proxy": (404, "<html>404 Not Found</html>"),
        })
        with self.assertLogs("sbonus.shop.push", "INFO") as logs:
            self.assertEqual(await self.send(), 1)
        self.assertEqual(self.sent_to("google"), ["android-gone", "android-busy", "android-proxy", "android-ok"])
        self.assertEqual(self.dropped, ["android-gone"])
        self.assertEqual(self.failed, ["android-busy", "android-proxy"])
        # В журнале нет ни номера целиком, ни адресов телефонов, ни токена доступа.
        journal = "\n".join(logs.output)
        for secret in (PHONE, "android-gone", "android-busy", "android-proxy", "android-ok", "google-access"):
            self.assertNotIn(secret, journal)

    async def test_database_failure_does_not_break_the_order(self):
        async def broken(db, phone):
            raise RuntimeError("база недоступна")

        with mock.patch.object(push, "_devices", broken), self.assertLogs("sbonus.shop.push", "WARNING"):
            self.assertEqual(await self.send(), 0)
        self.assertEqual(self.net.calls, [])


if __name__ == "__main__":
    unittest.main()
