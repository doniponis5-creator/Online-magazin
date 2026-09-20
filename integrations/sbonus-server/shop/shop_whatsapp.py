"""
Интернет-магазин Smart Centr — сообщение в WhatsApp с кнопкой.

Зачем. Раньше в конце письма о заказе стояла длинная ссылка вида
https://smarket.kg/ru/order/SC-260920-837AK?token=19fc5c4f76... — её неудобно
читать и страшно нажимать. Green API умеет присылать вместо неё кнопку
«Открыть заказ», и у магазина такой доступ есть.

Главное правило здесь — не навредить. Кнопка это украшение, а сообщение о
заказе человек ждёт по-настоящему. Поэтому:

  • не получилось отправить с кнопкой — тут же отправляем обычным текстом,
    со ссылкой, как раньше;
  • текст длиннее, чем WhatsApp разрешает в таком сообщении, — сразу
    отправляем обычным текстом, не пробуя;
  • модуль рассрочки (app/payments) не трогаем: он живёт своей жизнью, и
    ломать его ради кнопки нельзя. Берём оттуда только отправку текста.
"""
from __future__ import annotations

import logging

import httpx

from app.payments import payments_greenapi as wa  # type: ignore

logger = logging.getLogger("sbonus.shop.whatsapp")

# WhatsApp разрешает в сообщении с кнопками примерно тысячу знаков.
# Берём с запасом: лучше отправить обычным текстом, чем потерять письмо.
MAX_BODY = 900
TIMEOUT = 20.0


def _url() -> tuple[str, str, str]:
    """Адрес Green API и ключи. Бросает, если не настроено."""
    settings = wa._settings()
    instance = getattr(settings, "greenapi_instance_id", "")
    token = getattr(settings, "greenapi_api_token", "")
    if not instance or not token:
        raise wa.GreenAPIError("Green API не настроен")
    host = getattr(settings, "greenapi_host", "https://api.green-api.com")
    return host, instance, token


def send_with_button(phone: str, text: str, button_text: str, url: str) -> bool:
    """
    Отправить сообщение, а ссылку показать кнопкой.

    Возвращает True, если ушло с кнопкой, и False, если пришлось отправить
    обычным текстом. В обоих случаях человек сообщение получает — ошибку
    наружу не бросаем.
    """
    plain = f"{text}\n{url}"

    if len(text) > MAX_BODY:
        logger.info("whatsapp: текст длинный, отправляю без кнопки")
        _send_plain(phone, plain)
        return False

    try:
        host, instance, token = _url()
        payload = {
            "chatId": wa._normalize_phone(phone),
            "body": text,
            "buttons": [
                {"type": "url", "buttonId": "order", "buttonText": button_text, "url": url}
            ],
        }
        with httpx.Client(timeout=TIMEOUT) as client:
            response = client.post(
                f"{host}/waInstance{instance}/sendInteractiveButtons/{token}", json=payload
            )
        if response.status_code == 200 and response.json().get("idMessage"):
            return True
        logger.warning(
            f"whatsapp: кнопка не принята ({response.status_code}), отправляю текстом"
        )
    except Exception as error:
        logger.warning(f"whatsapp: кнопка не отправилась ({error}), отправляю текстом")

    _send_plain(phone, plain)
    return False


def _send_plain(phone: str, message: str) -> None:
    """Обычное сообщение. Ошибку не прячем: выше её ловит вызывающий."""
    wa.send_text(phone, message)
