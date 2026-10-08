"""
Заклад (предоплата частью) — правила без импортов приложения: тесты идут без сервера.

Владелец 08.10: покупатель издалека боится платить всё сразу или хочет «отдам, когда привезёте». Тогда он
платит заклад — сумму выбирает сам, не меньше 1 000 сом. Товар грузим в такси, покупателю уходят номер машины
и телефон водителя, остаток он платит по второй ссылке. Такси оплачивает водителю сам. Отказался без причины —
из заклада удерживается такси, остальное возвращается (это делает руководство вручную).

Ссылки O!Деньги: первая — заказ как есть (order_id), вторая — тот же заказ с «-R» на конце (остаток).
"""
from decimal import Decimal, ROUND_DOWN
import re

DEPOSIT_MIN = Decimal("1000")
REST_SUFFIX = "-R"
CAR_MAX = 40


def check_deposit(deposit, pay_amount) -> Decimal | None:
    """
    Сколько платить сейчас. None — заклада нет, платится всё (0, пусто или заклад ≥ суммы заказа).
    Меньше 1 000 сом — ValueError: так покупателю и скажут.
    """
    if deposit in (None, "", 0, "0"):
        return None
    value = Decimal(str(deposit)).quantize(Decimal("1"), rounding=ROUND_DOWN)
    total = Decimal(str(pay_amount))
    if value >= total:
        return None
    if value < DEPOSIT_MIN:
        raise ValueError(f"заклад — не меньше {int(DEPOSIT_MIN)} сом")
    return value


def rest_amount(pay_amount, deposit) -> Decimal:
    return max(Decimal("0"), Decimal(str(pay_amount)) - Decimal(str(deposit or 0)))


def rest_ref(order_id: str, n: int = 1) -> str:
    """Ссылка на остаток: первая — «-R», перевыпущенная (истекла) — «-R2», «-R3»…"""
    return f"{order_id}{REST_SUFFIX}" + (str(n) if n > 1 else "")


def next_rest_ref(order_id: str, current: str | None) -> str:
    m = re.search(r"-R(\d*)$", current or "")
    n = (int(m.group(1) or 1) + 1) if m else 1
    return rest_ref(order_id, n)


def parse_ref(ref: str) -> tuple[str, bool]:
    """«SC-…-R» / «SC-…-R2» → («SC-…», True) — оплата остатка; без «-R» — первая оплата.
    Хвост «-R» отрезаем только после полного номера (5 знаков): сам номер бывает «SC-251008-R1234»."""
    ref = str(ref or "")
    m = re.fullmatch(r"(.+-[A-Z0-9]{5})-R\d*", ref)
    if m:
        return m.group(1), True
    return ref, False


def clean_taxi(car: str, driver_phone: str) -> dict:
    """Номер машины и телефон водителя от сотрудника. Пусто или не телефон — ValueError."""
    car = re.sub(r"\s+", " ", str(car or "")).strip()[:CAR_MAX]
    digits = re.sub(r"\D", "", str(driver_phone or ""))
    if digits.startswith("0") and len(digits) == 10:
        digits = "996" + digits[1:]
    if len(digits) == 9:
        digits = "996" + digits
    if not car:
        raise ValueError("номер машины не указан")
    if not re.fullmatch(r"996\d{9}|7\d{10}", digits):
        raise ValueError("телефон водителя — как 0555 123 456 или +996 555 123 456")
    return {"car": car, "driver_phone": "+" + digits}


def _som(value) -> str:
    return f"{int(Decimal(str(value))):,}".replace(",", " ") + " сом"


def deposit_paid_text(lang: str, name: str, order_id: str, deposit, rest) -> str:
    first = (name or "").split()[0] if name else ""
    if lang == "ky":
        return (f"Саламатсызбы{', ' + first if first else ''}!\n"
                f"{order_id} заказы боюнча заклад {_som(deposit)} алынды ✅\n"
                f"Товарды машинага жүктөгөндө айдоочунун номерин жана машинанын номерин жөнөтөбүз. "
                f"Калганы — {_som(rest)} — ошондо шилтеме аркылуу төлөйсүз. Таксини айдоочуга өзүңүз төлөйсүз.")
    return (f"Здравствуйте{', ' + first if first else ''}!\n"
            f"Заклад {_som(deposit)} по заказу {order_id} получен ✅\n"
            f"Когда погрузим товар в машину, пришлём номер машины и телефон водителя. "
            f"Остаток — {_som(rest)} — оплатите тогда по ссылке. Такси оплачиваете водителю сами.")


def taxi_text(lang: str, order_id: str, taxi: dict, rest, url: str) -> str:
    if lang == "ky":
        return (f"Товарыңыз машинага жүктөлдү 🚕 (заказ {order_id})\n"
                f"Машина: {taxi['car']}\nАйдоочу: {taxi['driver_phone']}\n\n"
                f"Калган сумма — {_som(rest)}. Төлөө: {url}\n"
                f"Таксини айдоочуга өзүңүз төлөйсүз.")
    return (f"Ваш товар погружен в машину 🚕 (заказ {order_id})\n"
            f"Машина: {taxi['car']}\nВодитель: {taxi['driver_phone']}\n\n"
            f"Остаток — {_som(rest)}. Оплата: {url}\n"
            f"Такси оплачиваете водителю сами.")


def rest_paid_text(lang: str, order_id: str) -> str:
    if lang == "ky":
        return f"{order_id} заказы толук төлөндү ✅ Рахмат! Колдонуп ийгилик."
    return f"Заказ {order_id} оплачен полностью ✅ Спасибо за покупку!"


# ── «Таксига юкландим» из WhatsApp: владелец не у 1С ─────────────────────────
# Одна строка в чате магазина с самим собой: «такси 7K3QF 01KG123ABC 0555123456» —
# конец номера заказа (5 знаков) или номер целиком, машина (можно с пробелами), телефон водителя в конце.
TAXI_COMMAND = re.compile(
    r"(?:такси|taksi|taxi)[\s:,]+(.+?)[\s,]+(\+?996[\d\s()\-]{9,15}|0[\d\s()\-]{9,13})",
    re.I,
)
ORDER_CODE = re.compile(r"(?:SC-\d{6}-)?([A-Za-z0-9]{5})(?:\s+|$)", re.I)


def parse_taxi_command(text: str) -> dict | None:
    """
    «такси [7K3QF] 01KG123ABC 0555123456» одной строкой → {code, car, body, phone}, иначе None.
    code — первое слово, если похоже на конец номера заказа (5 знаков) или номер целиком; может оказаться и
    частью номера машины («AB123 KG») — решает бот: такого заказа нет → body целиком — машина.
    Длинное сообщение (сводка, тревога) командой не бывает.
    """
    text = str(text or "").strip()
    m = TAXI_COMMAND.fullmatch(text)
    if not m or "\n" in text:
        return None
    body, phone = m.group(1).strip(), m.group(2).strip()
    if "<" in body:            # подсказка из тревоги «<номер машины>» — не команда
        return None
    code, car = None, body
    c = ORDER_CODE.match(body)
    if c and not body[c.end():].strip():
        return None            # «такси 7K3QF 0555…» — номер заказа есть, машины нет
    if c:
        code, car = c.group(1).upper(), body[c.end():].strip()
    return {"code": code, "car": car, "body": body, "phone": phone}


def taxi_hint(order_id: str) -> str:
    return (f"или напишите в этот чат одной строкой: такси, номер машины, телефон водителя.\n"
            f"Например: такси 01KG123ABC 0555123456\n"
            f"(ждут такси несколько заказов — добавьте после «такси» {order_id[-5:]})")
