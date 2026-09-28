"""
Интернет-магазин Smart Centr — правила рассылок «Скидка» и «Новинка» из 1С.

Только решения, без базы и без отправки: какой товар годится, какой текст
у шаблона, можно ли слать прямо сейчас. Модуль нарочно не импортирует ничего
из приложения — его проверяют тесты без сервера (test_shop_promo_rules.py),
а пользуется им shop_promo.py.

Рассылка — только по кнопке владельца в 1С, не по событию каталога.
"""
from __future__ import annotations

import re
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation
from zoneinfo import ZoneInfo


# ── Шаблоны ──────────────────────────────────────────────────────────────────
# sale — «на этот товар скидка», new — «этот товар поступил», custom — свой текст.
KINDS = ("sale", "new", "custom")

# Длиннее 1С не даст отправить, и сервер тоже не примет: на экране блокировки
# длинный текст всё равно обрезается.
TITLE_MAX = 60
BODY_MAX = 180

SALE_TITLE = "Скидка на {name}"
SALE_BODY = "Было {old} сом, стало {price} сом. Можно заказать в приложении."
NEW_TITLE = "Новинка: {name}"
NEW_BODY = "{name} уже в магазине — можно заказать в приложении."


# ── Когда можно слать ────────────────────────────────────────────────────────
# Те же часы, что у напоминаний о корзине (shop_cart_rules.py): Бишкек,
# UTC+6 круглый год. Нет базы часовых поясов — те же +6 вручную.
try:
    SHOP_TZ = ZoneInfo("Asia/Bishkek")
except Exception:
    SHOP_TZ = timezone(timedelta(hours=6), "Asia/Bishkek")

DAY_START_HOUR = 10
DAY_END_HOUR = 20


def _utc(moment: datetime) -> datetime:
    """Время из базы лежит в UTC без зоны — приводим всё к одному виду."""
    if moment.tzinfo is None:
        return moment.replace(tzinfo=timezone.utc)
    return moment.astimezone(timezone.utc)


def local(moment: datetime) -> datetime:
    return _utc(moment).astimezone(SHOP_TZ)


def shop_day(now: datetime) -> date:
    """День по Бишкеку: «одна рассылка в сутки» считается по нему."""
    return local(now).date()


def blocked_reason(now: datetime, last_sent_at: datetime | None) -> str | None:
    """
    Почему сейчас слать нельзя — готовой фразой для владельца в 1С.
    None — можно. last_sent_at — время последней рассылки (UTC без зоны).
    """
    here = local(now)
    if not DAY_START_HOUR <= here.hour < DAY_END_HOUR:
        return (f"Сейчас {here:%H:%M} по Бишкеку. Уведомления уходят только днём, "
                f"с {DAY_START_HOUR}:00 до {DAY_END_HOUR}:00 — отправьте после {DAY_START_HOUR}:00.")
    if last_sent_at is not None and shop_day(last_sent_at) == here.date():
        return (f"Сегодня рассылка уже была в {local(last_sent_at):%H:%M}. "
                f"Не больше одной в день — следующую можно завтра с {DAY_START_HOUR}:00.")
    return None


# ── Товар из каталога сервера ────────────────────────────────────────────────

def _number(value) -> Decimal:
    try:
        number = Decimal(str(value if value is not None else 0))
    except (InvalidOperation, ValueError):
        return Decimal(0)
    return number if number.is_finite() else Decimal(0)


def price(item: dict) -> int:
    return max(int(_number(item.get("price")).to_integral_value()), 0)


def old_price(item: dict) -> int:
    """Старая цена, только если она больше нынешней — как на сайте (adapter.ts)."""
    now = price(item)
    old = int(_number(item.get("oldPrice")).to_integral_value())
    return old if now > 0 and old > now else 0


def on_sale(item: dict) -> bool:
    return old_price(item) > 0


def is_new(item: dict) -> bool:
    return bool(item.get("isNew"))


def sellable(item: dict) -> bool:
    """
    Можно ли заказать прямо сейчас. «Можно заказать» в тексте не должно врать:
    без цены или без остатка товар в рассылку не попадает. Остаток — как на
    сайте: «В наличии» продаётся всегда, «Нет в наличии» — никогда.
    """
    if price(item) <= 0:
        return False
    availability = str(item.get("availability") or "")
    if availability == "Нет в наличии":
        return False
    if availability == "В наличии":
        return True
    return _number(item.get("stock")) > 0


# Код 1С «ЦБ-00001234» → адрес страницы «cb-00001234». Так же, как slugFromCode
# на сайте (src/data/1c/adapter.ts): иначе уведомление откроет пустую страницу.
_TRANSLIT = {
    "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ё": "e", "ж": "zh", "з": "z", "и": "i",
    "й": "y", "к": "k", "л": "l", "м": "m", "н": "n", "о": "o", "п": "p", "р": "r", "с": "s", "т": "t",
    "у": "u", "ф": "f", "х": "h", "ц": "c", "ч": "ch", "ш": "sh", "щ": "sch", "ъ": "", "ы": "y", "ь": "",
    "э": "e", "ю": "yu", "я": "ya", "ң": "n", "ө": "o", "ү": "u",
}


def slug_from_code(code: str) -> str:
    value = "".join(_TRANSLIT.get(ch, ch) for ch in str(code or "").lower())
    return re.sub(r"[^a-z0-9]+", "-", value).strip("-")


HOME_URL = "/ru"


def product_url(item: dict) -> str:
    """Адрес страницы товара. Язык сайт в приложении поменяет на текущий сам."""
    slug = slug_from_code(item.get("code") or "") or str(item.get("id") or "")
    slug = re.sub(r"[^A-Za-z0-9._~-]+", "-", slug).strip("-")
    return f"/ru/product/{slug}" if slug else HOME_URL


def _name(item: dict) -> str:
    return re.sub(r"\s+", " ", str(item.get("name") or "")).strip()


def money(value: int) -> str:
    """12900 → «12 900»: так цены пишет весь магазин."""
    return f"{int(value):,}".replace(",", " ")


def _fit(template: str, name: str, limit: int, **values) -> str:
    """Подставить название так, чтобы строка влезла в предел: длинное — обрезаем с «…»."""
    full = template.format(name=name, **values)
    if len(full) <= limit:
        return full
    room = limit - len(template.format(name="", **values)) - 1
    short = name[: max(room, 1)].rstrip() + "…"
    return template.format(name=short, **values)[:limit]


def template(kind: str, item: dict) -> tuple[str, str] | None:
    """
    Заголовок и текст по шаблону. Цены — только из каталога 1С.
    None — шаблон для этого товара не годится (скидка без старой цены).
    """
    name = _name(item)
    if kind == "sale":
        if not name or not on_sale(item):
            return None
        values = {"old": money(old_price(item)), "price": money(price(item))}
        return _fit(SALE_TITLE, name, TITLE_MAX), SALE_BODY.format(**values)[:BODY_MAX]
    if kind == "new":
        if not name:
            return None
        return _fit(NEW_TITLE, name, TITLE_MAX), _fit(NEW_BODY, name, BODY_MAX)
    if kind == "custom":
        return "", ""
    return None


def candidate(item: dict) -> dict | None:
    """Строка списка товаров для 1С: цены, метки, адрес и готовые тексты шаблонов."""
    if not _name(item) or not sellable(item):
        return None
    row = {
        "code": str(item.get("code") or ""),
        "name": _name(item),
        "price": price(item),
        "oldPrice": old_price(item),
        "sale": on_sale(item),
        "isNew": is_new(item),
        "url": product_url(item),
    }
    for kind in ("sale", "new"):
        texts = template(kind, item)
        if texts:
            row[f"{kind}Title"], row[f"{kind}Body"] = texts
    return row


def candidates(items: list[dict]) -> list[dict]:
    """Все товары, которые можно предложить: сначала со скидкой, потом новинки, потом остальные."""
    rows = [row for row in (candidate(item) for item in items or []) if row]
    rows.sort(key=lambda row: (not row["sale"], not row["isNew"], row["name"].lower()))
    return rows


def find_item(items: list[dict], code: str) -> dict | None:
    code = str(code or "").strip()
    if not code:
        return None
    for item in items or []:
        if str(item.get("code") or "").strip() == code:
            return item
    return None


# ── Проверка того, что прислала 1С ───────────────────────────────────────────

def clean_text(value) -> str:
    """Без лишних пробелов и переводов строк: уведомление — одна-две строки."""
    return re.sub(r"\s+", " ", str(value or "")).strip()


def text_problem(title: str, body: str) -> str | None:
    """Что не так с заголовком и текстом — фразой для 1С. None — всё хорошо."""
    if not title:
        return "Заполните заголовок."
    if not body:
        return "Заполните текст."
    if len(title) > TITLE_MAX:
        return f"Заголовок длиннее {TITLE_MAX} знаков ({len(title)}) — сократите."
    if len(body) > BODY_MAX:
        return f"Текст длиннее {BODY_MAX} знаков ({len(body)}) — сократите."
    return None


def target(kind: str, code: str, items: list[dict]) -> tuple[str, str | None, str | None]:
    """
    Куда откроет нажатие и годится ли товар для шаблона.
    Возвращает (адрес, код товара или None, причина отказа или None).
    """
    if kind not in KINDS:
        return HOME_URL, None, "Неизвестный шаблон."
    code = str(code or "").strip()
    if not code:
        if kind == "custom":
            return HOME_URL, None, None
        return HOME_URL, None, "Выберите товар."
    item = find_item(items, code)
    if item is None:
        return HOME_URL, None, "Товара нет в каталоге сайта — обновите список."
    if not sellable(item):
        return HOME_URL, None, "Этот товар сейчас нельзя заказать на сайте: нет цены или остатка."
    if kind == "sale" and not on_sale(item):
        return HOME_URL, None, "У товара нет старой цены — шаблон «Скидка» не подходит."
    return product_url(item), code, None
