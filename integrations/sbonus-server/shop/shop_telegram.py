"""
Интернет-магазин Smart Centr — код входа через Telegram Gateway.

Зачем: код в Telegram стоит $0.01, приходит мгновенно и не грозит блокировкой
номера — в отличие от отправки через обычный WhatsApp-аккаунт (Green API).
Если у покупателя нет Telegram на этом номере, проверка бесплатна и код уходит
в WhatsApp, как раньше. Telegram не раскрывает нам ничего о пользователе:
мы отправляем номер и получаем «доставлено / не могу доставить».

Порядок вызовов (так платим один раз за код):
  checkSendAbility      → платно, если доставить можно; бесплатно, если нельзя
  sendVerificationMessage с request_id из проверки → бесплатно

Настройки (/opt/sbonus/.env.production, задаются скриптом setup-telegram-gateway.ps1):
  TELEGRAM_GATEWAY_TOKEN   — токен из настроек аккаунта gateway.telegram.org
  TELEGRAM_GATEWAY_SENDER  — необязательно: username проверенного канала-отправителя

Токен пуст — модуль выключен, всё идёт в WhatsApp. Ни одна ошибка Telegram
не должна ломать вход: любая проблема означает «не смогли», и код идёт в WhatsApp.

Документация: https://core.telegram.org/gateway/api
"""
from __future__ import annotations

import logging

import httpx

from .shop_router import _cfg

logger = logging.getLogger("sbonus.shop.telegram")

API = "https://gatewayapi.telegram.org"
TIMEOUT = 10.0


def token() -> str:
    return _cfg("telegram_gateway_token").strip()


def sender() -> str:
    return _cfg("telegram_gateway_sender").strip()


def enabled() -> bool:
    return bool(token())


async def _post(client: httpx.AsyncClient, method: str, payload: dict) -> dict | None:
    """Один вызов Gateway API. Возвращает result или None, если не вышло."""
    response = await client.post(
        f"{API}/{method}",
        json=payload,
        headers={"Authorization": f"Bearer {token()}"},
    )
    data = response.json()
    if not data.get("ok"):
        logger.info(f"telegram {method}: {data.get('error')}")
        return None
    return data.get("result") or {}


async def send_code(phone: str, code: str, ttl: int) -> bool:
    """
    Отправить код входа в Telegram. True — доставлено в Telegram,
    False — нет Telegram на этом номере или сервис недоступен (шлём в WhatsApp).

    ttl: если код не доставлен за это время, Telegram сам вернёт деньги.
    """
    if not enabled():
        return False
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            check = await _post(client, "checkSendAbility", {"phone_number": phone})
            if not check:
                return False
            message = {
                "phone_number": phone,
                "request_id": check.get("request_id"),
                "code": code,
                "ttl": max(30, min(3600, ttl)),
            }
            if sender():
                message["sender_username"] = sender()
            result = await _post(client, "sendVerificationMessage", message)
            if not result:
                return False
    except Exception as error:
        logger.warning(f"telegram gateway недоступен ...{phone[-4:]}: {error}")
        return False
    logger.info(f"site code via telegram ...{phone[-4:]}")
    return True
