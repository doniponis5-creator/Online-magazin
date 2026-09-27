"""
Интернет-магазин Smart Centr — push-уведомления в приложении (iPhone и Android).

Зачем: «Заказ оплачен», «Заказ готов» приходят прямо на экран телефона.
Бесплатно и мгновенно — в отличие от WhatsApp, за который платим и рискуем
номером. WhatsApp остаётся: не у всех есть приложение.

Как Apple понимает, что это мы. Магазин не присылает Apple пароль. Вместо этого
мы подписываем короткий «пропуск» (JWT) своим ключом — файлом .p8, который
владелец один раз скачал в кабинете разработчика Apple. Пропуск живёт час,
потом делаем новый.

Настройки (/opt/sbonus/.env.production, задаются скриптом setup-apns.ps1):
  APNS_KEY_P8      — содержимое файла AuthKey_XXXXXXXXXX.p8
  APNS_KEY_ID      — Key ID этого ключа, 10 знаков
  APNS_TEAM_ID     — Team ID разработчика, 10 знаков
  APNS_BUNDLE_ID   — необязательно, по умолчанию kg.smarket.app
  APNS_PRODUCTION  — 1 для приложения из App Store, 0 (по умолчанию) для сборки с Mac

Android — через Firebase Cloud Messaging (FCM). Протокол (пропуск для Google,
тело сообщения, разбор ответов) — в shop_push_fcm.py, здесь только отправка.
  FCM_SERVICE_ACCOUNT_B64 — ключ сервисного аккаунта Firebase, JSON в base64
                            (задаётся скриптом scripts/setup-fcm.sh / .ps1)

Каждый телефон получает уведомление своим путём: адрес с платформой android —
через Google, остальные — через Apple, как раньше. Ключи независимы: нет ключа
Apple — iPhone молчит, Android работает; нет ключа FCM — наоборот.
Ни одна ошибка Apple или Google не должна мешать заказу: всё заворачиваем в try.
В журнал не пишем ни ключи, ни токен доступа, ни адреса телефонов.

Документация: https://developer.apple.com/documentation/usernotifications
              https://firebase.google.com/docs/cloud-messaging/send/v1-api
"""
from __future__ import annotations

import base64
import json
import logging
import time

import httpx
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from . import shop_push_fcm as fcm
from .shop_router import _cfg

logger = logging.getLogger("sbonus.shop.push")

# Проверочная сборка с Mac ходит на sandbox, приложение из App Store — на боевой адрес.
HOST_PROD = "https://api.push.apple.com"
HOST_SANDBOX = "https://api.sandbox.push.apple.com"
TIMEOUT = 10.0
# Apple разрешает держать пропуск до часа; обновляем чуть раньше.
# Токен доступа Google тоже живёт час — держим столько же.
TOKEN_TTL = 50 * 60

FCM_SEND_URL = "https://fcm.googleapis.com/v1/projects/{project}/messages:send"

_cached_jwt: tuple[str, float] | None = None
_cached_fcm: tuple[str, float] | None = None


def key_p8() -> str:
    # В .env перевод строки часто хранится как \n — возвращаем настоящие переносы.
    return _cfg("apns_key_p8").replace("\\n", "\n").strip()


def apple_enabled() -> bool:
    return bool(key_p8() and _cfg("apns_key_id") and _cfg("apns_team_id"))


def _fcm_account() -> dict | None:
    return fcm.load_account(_cfg("fcm_service_account_b64"))


def fcm_enabled() -> bool:
    return _fcm_account() is not None


def enabled() -> bool:
    """Есть хоть один путь: Apple или Google. Каждый включается своим ключом."""
    return apple_enabled() or fcm_enabled()


def _host() -> str:
    return HOST_PROD if _cfg("apns_production", "0") in ("1", "true", "True") else HOST_SANDBOX


def _bundle() -> str:
    return _cfg("apns_bundle_id", "kg.smarket.app")


def _b64(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def _jwt() -> str | None:
    """Пропуск для Apple. Держим его в памяти, пока не истечёт."""
    global _cached_jwt
    now = time.time()
    if _cached_jwt and now - _cached_jwt[1] < TOKEN_TTL:
        return _cached_jwt[0]
    try:
        from cryptography.hazmat.primitives import hashes, serialization
        from cryptography.hazmat.primitives.asymmetric import ec, utils
    except ImportError:
        logger.error("push: нет библиотеки cryptography, уведомления не отправляются")
        return None
    try:
        key = serialization.load_pem_private_key(key_p8().encode("utf-8"), password=None)
        header = _b64(json.dumps({"alg": "ES256", "kid": _cfg("apns_key_id")}, separators=(",", ":")).encode())
        claims = _b64(json.dumps({"iss": _cfg("apns_team_id"), "iat": int(now)}, separators=(",", ":")).encode())
        message = f"{header}.{claims}".encode("ascii")
        der = key.sign(message, ec.ECDSA(hashes.SHA256()))
        # Apple ждёт подпись из двух чисел по 32 байта, а cryptography даёт DER — переводим.
        r, s = utils.decode_dss_signature(der)
        signature = _b64(r.to_bytes(32, "big") + s.to_bytes(32, "big"))
        token = f"{header}.{claims}.{signature}"
    except Exception as error:
        logger.error(f"push: не удалось подписать пропуск для Apple: {error}")
        return None
    _cached_jwt = (token, now)
    return token


async def save_device(db: AsyncSession, token: str, platform: str, phone: str | None) -> None:
    """Запомнить адрес телефона. Тот же адрес приходит при каждом запуске — обновляем."""
    await db.execute(
        text(
            "INSERT INTO shop_push_devices (token, platform, phone) VALUES (:t, :p, :ph) "
            "ON CONFLICT (token) DO UPDATE SET "
            "phone = COALESCE(EXCLUDED.phone, shop_push_devices.phone), "
            "platform = EXCLUDED.platform, failed = 0, updated_at = NOW()"
        ),
        {"t": token, "p": platform[:16], "ph": phone},
    )
    await db.commit()


async def _devices(db: AsyncSession, phone: str) -> list[tuple[str, str]]:
    """Адреса телефонов покупателя вместе с платформой: (адрес, 'ios' | 'android')."""
    rows = await db.execute(
        text(
            "SELECT token, platform FROM shop_push_devices WHERE phone = :ph AND failed < 3 "
            "ORDER BY updated_at DESC LIMIT 10"
        ),
        {"ph": phone},
    )
    return [(row[0], row[1] or "ios") for row in rows.fetchall()]


async def _drop(db: AsyncSession, token: str) -> None:
    """Apple или Google сказали, что такого телефона больше нет: приложение удалили."""
    await db.execute(text("DELETE FROM shop_push_devices WHERE token = :t"), {"t": token})
    await db.commit()


async def forget_phone(db: AsyncSession, phone: str) -> int:
    """
    Покупатель удалил учётную запись: больше не пишем ему на телефон.

    Стираем все адреса этого номера. Возвращаем, сколько стёрли, — чтобы сайт
    мог честно сказать человеку, что именно убрали.
    """
    result = await db.execute(
        text("DELETE FROM shop_push_devices WHERE phone = :ph"), {"ph": phone}
    )
    await db.commit()
    return int(result.rowcount or 0)


async def _fail(db: AsyncSession, token: str) -> None:
    await db.execute(
        text("UPDATE shop_push_devices SET failed = failed + 1, updated_at = NOW() WHERE token = :t"),
        {"t": token},
    )
    await db.commit()


async def send(db: AsyncSession, phone: str, title: str, body: str, data: dict | None = None) -> int:
    """
    Отправить уведомление покупателю на все его телефоны — каждому своим путём.
    Возвращает, на сколько телефонов доставлено. Ошибки не бросает.
    """
    if not enabled():
        return 0
    try:
        devices = await _devices(db, phone)
    except Exception as error:
        logger.warning(f"push: не удалось прочитать адреса ...{phone[-4:]}: {error}")
        return 0
    if not devices:
        return 0

    # Всё, что не android, — iPhone: так было до Android, старые адреса без платформы тоже Apple.
    apple = [token for token, platform in devices if platform != "android"]
    android = [token for token, platform in devices if platform == "android"]
    sent = 0
    # Два пути не зависят друг от друга: сбой Google не мешает iPhone, и наоборот.
    if apple and apple_enabled():
        sent += await _send_apple(db, phone, apple, title, body, data)
    if android:
        sent += await _send_fcm(db, phone, android, title, body, data)
    if sent:
        logger.info(f"push: доставлено {sent} ...{phone[-4:]}")
    return sent


async def _send_apple(
    db: AsyncSession, phone: str, tokens: list[str], title: str, body: str, data: dict | None
) -> int:
    """iPhone — через Apple, как было до Android."""
    jwt = _jwt()
    if not jwt:
        return 0
    payload = {"aps": {"alert": {"title": title, "body": body}, "sound": "default"}}
    if data:
        payload.update(data)
    headers = {
        "authorization": f"bearer {jwt}",
        "apns-topic": _bundle(),
        "apns-push-type": "alert",
        "apns-priority": "10",
    }
    sent = 0
    try:
        async with httpx.AsyncClient(http2=True, timeout=TIMEOUT) as client:
            for token in tokens:
                try:
                    response = await client.post(
                        f"{_host()}/3/device/{token}", json=payload, headers=headers
                    )
                except Exception as error:
                    logger.info(f"push: Apple недоступна: {error}")
                    break
                if response.status_code == 200:
                    sent += 1
                    continue
                reason = ""
                try:
                    reason = (response.json() or {}).get("reason", "")
                except Exception:
                    reason = response.text[:100]
                if reason in ("BadDeviceToken", "Unregistered", "DeviceTokenNotForTopic"):
                    await _drop(db, token)
                else:
                    await _fail(db, token)
                    logger.info(f"push: Apple отказала ({response.status_code} {reason})")
    except Exception as error:
        logger.warning(f"push: отправка не удалась ...{phone[-4:]}: {error}")
    return sent


def _forget_fcm_token() -> None:
    global _cached_fcm
    _cached_fcm = None


async def _fcm_access_token(client: httpx.AsyncClient, account: dict) -> str | None:
    """
    Токен доступа Google для отправки. Меняем подписанный пропуск на токен
    и держим его в памяти ~50 минут, чтобы не ходить за ним на каждый заказ.
    """
    global _cached_fcm
    now = time.time()
    if _cached_fcm and now - _cached_fcm[1] < TOKEN_TTL:
        return _cached_fcm[0]
    try:
        assertion = fcm.build_assertion(account, int(now))
    except ImportError:
        logger.error("push: нет библиотеки cryptography, уведомления на Android не отправляются")
        return None
    except Exception as error:
        # Только тип ошибки: текст не нужен, а ключ в журнал попасть не должен.
        logger.error(f"push: не удалось подписать пропуск для Google ({type(error).__name__})")
        return None
    try:
        response = await client.post(
            fcm.TOKEN_URL,
            data={"grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer", "assertion": assertion},
        )
    except Exception as error:
        logger.info(f"push: Google недоступен ({type(error).__name__})")
        return None
    answer: dict = {}
    try:
        answer = response.json() or {}
    except Exception:
        pass
    access = answer.get("access_token") if isinstance(answer, dict) else None
    if response.status_code != 200 or not isinstance(access, str) or not access:
        # Код ответа и короткая причина вида invalid_grant — без тела целиком.
        why = answer.get("error", "") if isinstance(answer, dict) else ""
        logger.error(f"push: Google не выдал токен доступа ({response.status_code} {str(why)[:40]}), Android пропущен")
        return None
    _cached_fcm = (access, now)
    return access


async def _send_fcm(
    db: AsyncSession, phone: str, tokens: list[str], title: str, body: str, data: dict | None
) -> int:
    """Android — через Firebase Cloud Messaging. Нет ключа — молчим."""
    account = _fcm_account()
    if not account:
        return 0
    url = FCM_SEND_URL.format(project=account["project_id"])
    sent = 0
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            access = await _fcm_access_token(client, account)
            if not access:
                return 0
            headers = {"authorization": f"Bearer {access}"}
            for token in tokens:
                try:
                    response = await client.post(
                        url, json=fcm.build_message(token, title, body, data), headers=headers
                    )
                except Exception as error:
                    logger.info(f"push: Google недоступен ({type(error).__name__})")
                    break
                try:
                    answer = response.json()
                except Exception:
                    answer = response.text[:500]
                verdict = fcm.classify(response.status_code, answer)
                if verdict == "ok":
                    sent += 1
                elif verdict == "drop":
                    await _drop(db, token)
                elif verdict == "auth":
                    # Виноват ключ, а не адреса: остальным не шлём, счётчики не трогаем.
                    _forget_fcm_token()
                    logger.error(f"push: Google не принял ключ FCM ({fcm.reason(response.status_code, answer)}), Android пропущен")
                    break
                else:
                    await _fail(db, token)
                    logger.info(f"push: Google отказал ({fcm.reason(response.status_code, answer)})")
    except Exception as error:
        logger.warning(f"push: отправка на Android не удалась ...{phone[-4:]} ({type(error).__name__})")
    return sent
