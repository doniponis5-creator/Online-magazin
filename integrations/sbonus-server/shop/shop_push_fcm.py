"""
Уведомления на Android через Firebase Cloud Messaging (FCM HTTP v1) — только протокол.

Зачем отдельный файл: здесь нет ни базы, ни настроек, ни сети — только «как
говорить с Google». Поэтому его можно проверить тестами на Mac, не поднимая
сервер. Отправку, кеш и журнал делает shop_push.py.

Как Google понимает, что это мы. Владелец один раз скачивает в Firebase
«ключ сервисного аккаунта» (JSON). Сервер подписывает им короткий пропуск (JWT),
меняет его у Google на токен доступа на час и с ним шлёт уведомления.

Ключ лежит в /opt/sbonus/.env.production одной строкой base64:
  FCM_SERVICE_ACCOUNT_B64 — содержимое JSON-файла сервисного аккаунта в base64

Документация: https://firebase.google.com/docs/cloud-messaging/send/v1-api
"""
from __future__ import annotations

import base64
import binascii
import json

# Куда меняем пропуск на токен доступа и какое право просим.
TOKEN_URL = "https://oauth2.googleapis.com/token"
SCOPE = "https://www.googleapis.com/auth/firebase.messaging"
# Канал уведомлений в приложении Android: «Заказы», высокая важность.
CHANNEL_ID = "orders"

_REQUIRED = ("project_id", "client_email", "private_key")


def load_account(b64: str) -> dict | None:
    """
    Достать из строки base64 ключ сервисного аккаунта.

    Не то (пусто, мусор, файл приложения google-services.json вместо ключа) —
    None: модуль Android просто молчит, iPhone работает дальше.
    """
    value = "".join((b64 or "").split())
    if not value:
        return None
    try:
        raw = base64.b64decode(value + "=" * (-len(value) % 4), validate=True)
        data = json.loads(raw.decode("utf-8"))
    except (binascii.Error, ValueError, UnicodeDecodeError):
        return None
    if not isinstance(data, dict) or data.get("type") != "service_account":
        return None
    account = {name: data.get(name) for name in _REQUIRED}
    if not all(isinstance(v, str) and v.strip() for v in account.values()):
        return None
    # Если JSON вставили вручную, переносы в ключе иногда остаются как «\n».
    account["private_key"] = account["private_key"].replace("\\n", "\n")
    return account


def _b64url(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def _part(data: dict) -> str:
    return _b64url(json.dumps(data, separators=(",", ":")).encode("utf-8"))


def build_assertion(account: dict, now: int) -> str:
    """
    Пропуск (JWT RS256) для обмена на токен доступа Google. Живёт час — дольше
    Google не принимает. Ключ битый — бросает исключение: вызывающий пишет
    в журнал и молчит, заказ не страдает.
    """
    # Библиотека нужна только здесь: без неё модуль всё равно импортируется.
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import padding

    key = serialization.load_pem_private_key(account["private_key"].encode("utf-8"), password=None)
    header = _part({"alg": "RS256", "typ": "JWT"})
    claims = _part({
        "iss": account["client_email"],
        "scope": SCOPE,
        "aud": TOKEN_URL,
        "iat": int(now),
        "exp": int(now) + 3600,
    })
    message = f"{header}.{claims}".encode("ascii")
    signature = key.sign(message, padding.PKCS1v15(), hashes.SHA256())
    return f"{header}.{claims}.{_b64url(signature)}"


def _text(value) -> str:
    # Google принимает в data только строки: числа и да/нет переводим в текст.
    if isinstance(value, str):
        return value
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (dict, list)):
        return json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    return str(value)


def build_message(token: str, title: str, body: str, data: dict | None) -> dict:
    """
    Тело запроса к FCM для одного телефона Android: заголовок и текст видны
    на экране, data — для приложения (какой заказ открыть). Высокая важность
    и канал «Заказы» — чтобы уведомление всплыло со звуком, а не легло молча.
    """
    message: dict = {
        "token": token,
        "notification": {"title": title, "body": body},
    }
    strings = {str(k): _text(v) for k, v in (data or {}).items() if v is not None}
    if strings:
        message["data"] = strings
    message["android"] = {
        "priority": "HIGH",
        "notification": {"channel_id": CHANNEL_ID, "sound": "default"},
    }
    return {"message": message}


# Ответы FCM, после которых адрес мёртв: приложение удалили, адрес от другого
# проекта Firebase, адреса не существует. Такой адрес стираем, чтобы не слать зря.
_DEAD_CODES = {"UNREGISTERED", "SENDER_ID_MISMATCH"}


def _error_info(body: dict | str) -> tuple[str, str, str, list[str]]:
    """Из ответа Google: статус, код FCM, текст ошибки и поля, на которые он жалуется."""
    if isinstance(body, str):
        try:
            body = json.loads(body) if body.strip() else {}
        except ValueError:
            body = {}
    error = body.get("error") if isinstance(body, dict) else None
    if not isinstance(error, dict):
        return "", "", "", []
    code, fields = "", []
    for detail in error.get("details") or []:
        if not isinstance(detail, dict):
            continue
        code = code or str(detail.get("errorCode") or "")
        for violation in detail.get("fieldViolations") or []:
            if isinstance(violation, dict):
                fields.append(str(violation.get("field") or ""))
    return str(error.get("status") or ""), code, str(error.get("message") or ""), fields


def reason(status: int, body: dict | str) -> str:
    """Коротко для журнала: код ответа и код FCM. Без текста — там бывает адрес."""
    name, code, _, _ = _error_info(body)
    return " ".join(part for part in (str(status), code or name) if part)


def classify(status: int, body: dict | str) -> str:
    """
    Что делать после ответа FCM:
      ok   — доставлено;
      drop — адрес мёртв, стереть;
      auth — ключ неверный или без прав: остальные адреса не трогать, адреса не виноваты;
      fail — прочее (лимит, сбой Google): +1 к счётчику неудач, как у Apple.
    """
    if status == 200:
        return "ok"
    name, code, message, fields = _error_info(body)
    if code in _DEAD_CODES or name == "NOT_FOUND" or status == 404:
        return "drop"
    if "INVALID_ARGUMENT" in (name, code) and (
        "message.token" in fields or "registration token" in message.lower()
    ):
        return "drop"
    if status in (401, 403):
        return "auth"
    return "fail"
