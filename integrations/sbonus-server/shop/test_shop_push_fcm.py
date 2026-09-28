"""
Проверки протокола FCM (уведомления на Android) — без сервера и без интернета.

Запуск на Mac (своей cryptography там нет, uv подтягивает её на время прогона):
  uv run --with cryptography python -m unittest integrations/sbonus-server/shop/test_shop_push_fcm.py

На сервер этот файл не попадает: deploy_shop.sh копирует только список FILES.
Ключи здесь — выдуманные, RSA-ключ создаётся заново при каждом прогоне.
"""
from __future__ import annotations

import base64
import json
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import shop_push_fcm as fcm  # noqa: E402

from cryptography.hazmat.primitives import hashes, serialization  # noqa: E402
from cryptography.hazmat.primitives.asymmetric import padding, rsa  # noqa: E402

_KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)
_PEM = _KEY.private_bytes(
    serialization.Encoding.PEM,
    serialization.PrivateFormat.PKCS8,
    serialization.NoEncryption(),
).decode("ascii")


def _account_json(**override) -> dict:
    data = {
        "type": "service_account",
        "project_id": "demo-shop-123",
        "private_key_id": "0000test",
        "private_key": _PEM,
        "client_email": "push@demo-shop-123.iam.gserviceaccount.com",
        "token_uri": "https://oauth2.googleapis.com/token",
    }
    data.update(override)
    return data


def _b64(data: dict | str) -> str:
    raw = data if isinstance(data, str) else json.dumps(data)
    return base64.b64encode(raw.encode("utf-8")).decode("ascii")


def _unb64url(part: str) -> bytes:
    return base64.urlsafe_b64decode(part + "=" * (-len(part) % 4))


class LoadAccountTest(unittest.TestCase):
    def test_reads_service_account_from_base64(self):
        account = fcm.load_account(_b64(_account_json()))
        self.assertIsNotNone(account)
        self.assertEqual(account["project_id"], "demo-shop-123")
        self.assertEqual(account["client_email"], "push@demo-shop-123.iam.gserviceaccount.com")
        self.assertIn("BEGIN PRIVATE KEY", account["private_key"])

    def test_tolerates_spaces_and_line_breaks_around_value(self):
        value = "  " + _b64(_account_json()) + "\n"
        self.assertIsNotNone(fcm.load_account(value))

    def test_rejects_empty_garbage_and_foreign_files(self):
        self.assertIsNone(fcm.load_account(""))
        self.assertIsNone(fcm.load_account("не base64 !!!"))
        self.assertIsNone(fcm.load_account(_b64("{not json")))
        # google-services.json приложения — не сервисный аккаунт
        self.assertIsNone(fcm.load_account(_b64({"project_info": {"project_id": "demo-shop-123"}})))
        self.assertIsNone(fcm.load_account(_b64(_account_json(type="authorized_user"))))
        self.assertIsNone(fcm.load_account(_b64(_account_json(project_id=""))))
        self.assertIsNone(fcm.load_account(_b64(_account_json(client_email=None))))
        self.assertIsNone(fcm.load_account(_b64(_account_json(private_key=""))))


class BuildAssertionTest(unittest.TestCase):
    NOW = 1_790_000_000

    def setUp(self):
        self.account = fcm.load_account(_b64(_account_json()))
        self.jwt = fcm.build_assertion(self.account, self.NOW)
        self.parts = self.jwt.split(".")

    def test_is_three_part_jwt_with_rs256_header(self):
        self.assertEqual(len(self.parts), 3)
        header = json.loads(_unb64url(self.parts[0]))
        self.assertEqual(header["alg"], "RS256")
        self.assertEqual(header["typ"], "JWT")

    def test_claims_ask_google_for_firebase_messaging(self):
        claims = json.loads(_unb64url(self.parts[1]))
        self.assertEqual(claims["iss"], "push@demo-shop-123.iam.gserviceaccount.com")
        self.assertEqual(claims["aud"], "https://oauth2.googleapis.com/token")
        self.assertEqual(claims["scope"], "https://www.googleapis.com/auth/firebase.messaging")
        self.assertEqual(claims["iat"], 1_790_000_000)
        # Google принимает пропуск не дольше часа.
        self.assertEqual(claims["exp"], 1_790_003_600)

    def test_signature_verifies_with_public_key(self):
        message = f"{self.parts[0]}.{self.parts[1]}".encode("ascii")
        # Бросит InvalidSignature, если подпись не наша.
        _KEY.public_key().verify(_unb64url(self.parts[2]), message, padding.PKCS1v15(), hashes.SHA256())

    def test_signature_from_another_key_does_not_verify(self):
        other = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        message = f"{self.parts[0]}.{self.parts[1]}".encode("ascii")
        from cryptography.exceptions import InvalidSignature
        with self.assertRaises(InvalidSignature):
            other.public_key().verify(_unb64url(self.parts[2]), message, padding.PKCS1v15(), hashes.SHA256())

    def test_broken_private_key_raises(self):
        broken = dict(self.account, private_key="-----BEGIN PRIVATE KEY-----\nAAAA\n-----END PRIVATE KEY-----\n")
        with self.assertRaises(Exception):
            fcm.build_assertion(broken, self.NOW)


class BuildMessageTest(unittest.TestCase):
    TOKEN = "fake-android-address:" + "A" * 120

    def test_order_notification_for_android(self):
        body = fcm.build_message(self.TOKEN, "Заказ оплачен", "Заказ SC-1 оплачен.", {"orderId": "SC-1"})
        self.assertEqual(body, {
            "message": {
                "token": self.TOKEN,
                "notification": {"title": "Заказ оплачен", "body": "Заказ SC-1 оплачен."},
                "data": {"orderId": "SC-1"},
                "android": {
                    "priority": "HIGH",
                    "notification": {"channel_id": "orders", "sound": "default"},
                },
            }
        })

    def test_data_values_are_always_strings(self):
        # Google отвергает сообщение целиком, если в data есть число.
        body = fcm.build_message(self.TOKEN, "t", "b", {"orderId": 42, "paid": True, "sum": 1500.5, "token": "abc"})
        data = body["message"]["data"]
        self.assertEqual(data, {"orderId": "42", "paid": "true", "sum": "1500.5", "token": "abc"})
        # И то, что уходит по сети, тоже строки.
        for value in json.loads(json.dumps(body))["message"]["data"].values():
            self.assertIsInstance(value, str)

    def test_empty_values_and_no_data(self):
        body = fcm.build_message(self.TOKEN, "t", "b", {"orderId": "SC-2", "note": None})
        self.assertEqual(body["message"]["data"], {"orderId": "SC-2"})
        self.assertNotIn("data", fcm.build_message(self.TOKEN, "t", "b", None)["message"])
        self.assertNotIn("data", fcm.build_message(self.TOKEN, "t", "b", {})["message"])


def _error(code: int, status: str, message: str, *details: dict) -> dict:
    return {"error": {"code": code, "message": message, "status": status, "details": list(details)}}


def _fcm_code(name: str) -> dict:
    return {"@type": "type.googleapis.com/google.firebase.fcm.v1.FcmError", "errorCode": name}


class ClassifyTest(unittest.TestCase):
    def test_delivered(self):
        self.assertEqual(fcm.classify(200, {"name": "projects/demo-shop-123/messages/0:1"}), "ok")

    def test_dead_addresses_are_dropped(self):
        cases = {
            "приложение удалили": (404, _error(404, "NOT_FOUND", "Requested entity was not found.", _fcm_code("UNREGISTERED"))),
            "адреса нет": (404, _error(404, "NOT_FOUND", "Requested entity was not found.")),
            "адрес от другого проекта Firebase": (403, _error(403, "PERMISSION_DENIED", "SenderId mismatch", _fcm_code("SENDER_ID_MISMATCH"))),
            "адрес испорчен": (400, _error(400, "INVALID_ARGUMENT", "The registration token is not a valid FCM registration token", _fcm_code("INVALID_ARGUMENT"))),
            "поле token неверно": (400, _error(400, "INVALID_ARGUMENT", "Invalid value", {
                "@type": "type.googleapis.com/google.rpc.BadRequest",
                "fieldViolations": [{"field": "message.token", "description": "Invalid registration token"}],
            })),
        }
        for name, (status, body) in cases.items():
            with self.subTest(name):
                self.assertEqual(fcm.classify(status, body), "drop")

    def test_bad_key_or_rights_is_auth_not_address_problem(self):
        self.assertEqual(fcm.classify(401, _error(401, "UNAUTHENTICATED", "Request had invalid authentication credentials.")), "auth")
        self.assertEqual(fcm.classify(403, _error(403, "PERMISSION_DENIED", "Permission 'cloudmessaging.messages.create' denied")), "auth")
        self.assertEqual(fcm.classify(401, "<html>Unauthorized</html>"), "auth")

    def test_other_refusals_count_as_failure(self):
        cases = {
            "ошибка в data, не в адресе": (400, _error(400, "INVALID_ARGUMENT", "Invalid value at 'message.data[0].value' (TYPE_STRING), 42", {
                "@type": "type.googleapis.com/google.rpc.BadRequest",
                "fieldViolations": [{"field": "message.data[0].value", "description": "Invalid value"}],
            })),
            "лимит": (429, _error(429, "RESOURCE_EXHAUSTED", "Quota exceeded", _fcm_code("QUOTA_EXCEEDED"))),
            "Google сломался": (500, _error(500, "INTERNAL", "Internal error", _fcm_code("INTERNAL"))),
            "Google недоступен": (503, _error(503, "UNAVAILABLE", "The service is currently unavailable.", _fcm_code("UNAVAILABLE"))),
            "страница вместо JSON": (502, "<html>Bad Gateway</html>"),
            "пустой ответ": (500, ""),
        }
        for name, (status, body) in cases.items():
            with self.subTest(name):
                self.assertEqual(fcm.classify(status, body), "fail")

    def test_body_may_come_as_json_text(self):
        body = json.dumps(_error(404, "NOT_FOUND", "Requested entity was not found.", _fcm_code("UNREGISTERED")))
        self.assertEqual(fcm.classify(404, body), "drop")

    def test_404_without_fcm_answer_keeps_the_address(self):
        # 404 от прокси или не тот путь — телефон тут ни при чём, стирать нельзя.
        cases = {
            "страница прокси": "<html><body>404 Not Found</body></html>",
            "простой текст": "Not Found",
            "пустой JSON": {},
            "пустой JSON текстом": "{}",
            "пустой ответ": "",
            "ошибка без статуса и кода": {"error": {"code": 404, "message": "Not Found"}},
        }
        for name, body in cases.items():
            with self.subTest(name):
                self.assertEqual(fcm.classify(404, body), "fail")

    def test_address_is_dropped_only_by_fcm_words(self):
        cases = {
            "404 NOT_FOUND в статусе": (404, _error(404, "NOT_FOUND", "Requested entity was not found.")),
            "404 NOT_FOUND в коде FCM": (404, {"error": {"code": 404, "details": [_fcm_code("NOT_FOUND")]}}),
            "404 UNREGISTERED в коде FCM": (404, {"error": {"code": 404, "details": [_fcm_code("UNREGISTERED")]}}),
            "400 UNREGISTERED в коде FCM": (400, _error(400, "INVALID_ARGUMENT", "Invalid value", _fcm_code("UNREGISTERED"))),
            "UNREGISTERED после другой подробности": (404, _error(404, "NOT_FOUND", "Requested entity was not found.",
                                                                 {"@type": "type.googleapis.com/google.rpc.DebugInfo"},
                                                                 _fcm_code("UNREGISTERED"))),
        }
        for name, (status, body) in cases.items():
            with self.subTest(name):
                self.assertEqual(fcm.classify(status, body), "drop")


if __name__ == "__main__":
    unittest.main()
