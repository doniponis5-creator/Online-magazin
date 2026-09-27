"""
Интернет-магазин Smart Centr — правила напоминания о корзине.

Только решения, без базы и без отправки: кому пора напомнить и каким текстом.
Модуль нарочно не импортирует ничего из приложения — его проверяют тесты
без сервера (test_shop_cart_rules.py), а пользуется им shop_cart_remind.py.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo


# ── Расписание ───────────────────────────────────────────────────────────────
# Паузы в днях: первая — после последнего изменения корзины, каждая следующая —
# после предыдущего напоминания. Паузы кончились — тишина до нового изменения.
# «...» в конце — повторять последнюю паузу, пока человек не купит.
#   вариант 1 (сейчас):            (1, 3, 7)
#   вариант 2 — каждые 3 дня:      (3, ...)
# Смена схемы — правка одной этой строки.
SCHEDULE_DAYS = (1, 3, 7)

# Даже при «повторять до покупки» больше стольких напоминаний на одну корзину
# не шлём: брошенная навсегда корзина не должна писать человеку вечно.
MAX_REMINDERS = 10


# ── Тихие часы ───────────────────────────────────────────────────────────────
# Магазин живёт по Бишкеку: UTC+6 круглый год, летнего времени нет. Если в
# контейнере нет базы часовых поясов (tzdata), берём те же +6 вручную —
# иначе задача упала бы целиком из-за одного справочника.
try:
    SHOP_TZ = ZoneInfo("Asia/Bishkek")
except Exception:
    SHOP_TZ = timezone(timedelta(hours=6), "Asia/Bishkek")

# Пишем людям только днём: с 10:00 включительно до 20:00 (в 20:00 уже нет).
DAY_START_HOUR = 10
DAY_END_HOUR = 20


def daytime(now: datetime) -> bool:
    """Сейчас день по Бишкеку — можно писать."""
    return DAY_START_HOUR <= _utc(now).astimezone(SHOP_TZ).hour < DAY_END_HOUR


def _utc(moment: datetime) -> datetime:
    """Время из базы лежит в UTC без зоны — приводим всё к одному виду."""
    if moment.tzinfo is None:
        return moment.replace(tzinfo=timezone.utc)
    return moment.astimezone(timezone.utc)


def pause_days(sent: int) -> int | None:
    """Сколько дней ждать перед напоминанием номер sent + 1; None — хватит."""
    steps = [day for day in SCHEDULE_DAYS if day is not Ellipsis]
    repeat = bool(SCHEDULE_DAYS) and SCHEDULE_DAYS[-1] is Ellipsis
    if sent < 0 or not steps or sent >= MAX_REMINDERS:
        return None
    if sent < len(steps):
        return steps[sent]
    return steps[-1] if repeat else None


def due(row, now: datetime) -> bool:
    """
    Пора ли напомнить. row — строка shop_cart_reminders (словарь или строка
    SQLAlchemy .mappings()), now — текущее время.
    """
    # Напоминания — это реклама: без явного «да» (правило Apple 4.5.4) молчим.
    # None — ещё не спрашивали, это тоже не согласие.
    if row.get("consent") is not True:
        return False
    if int(row.get("count") or 0) <= 0:
        return False
    if not daytime(now):
        return False
    sent = int(row.get("sent") or 0)
    pause = pause_days(sent)
    if pause is None:
        return False
    changed = row.get("changed_at")
    if changed is None:
        return False
    since = _utc(changed)
    last = row.get("last_sent_at")
    if sent and last is not None:
        since = max(since, _utc(last))
    return _utc(now) - since >= timedelta(days=pause)


TITLE = "Товары ждут в корзине"
# Длинное название обрезаем: уведомление на экране блокировки короткое.
NAME_LIMIT = 60


def reminder_text(items, count: int) -> tuple[str, str]:
    """
    Заголовок и текст напоминания. Спокойно и честно: без «осталось 2 штуки»
    и «успейте» — выдуманная срочность обманывает человека.

    items — названия из снимка корзины (не больше трёх), count — сколько
    позиций в корзине всего. Называем первую, остальные — числом.
    """
    names = [str(name).strip() for name in (items or []) if str(name or "").strip()]
    first = names[0] if names else "Товар из корзины"
    if len(first) > NAME_LIMIT:
        first = first[: NAME_LIMIT - 1].rstrip() + "…"
    rest = max(int(count or 0) - 1, 0)
    more = f" и ещё {rest}" if rest else ""
    return TITLE, f"{first}{more} — оформите заказ, когда будет удобно."
