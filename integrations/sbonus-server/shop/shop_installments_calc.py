"""
Рассрочка для сайта: чистый расчёт без сервера и базы.

Отдельный файл, чтобы то же самое можно было прогнать на компьютере с 1С
(scripts/1c-export/check_installments.py) и сверить с «Журналом платежей»
до выката на сервер.
"""
from __future__ import annotations

import re
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone

# Номер, записанный у двух разных клиентов, — не личный: номер магазина, мужа,
# поручителя. Мы не знаем, чей он на самом деле, поэтому чужой долг по нему не
# показываем никому. Такой номер получает отметку «общий», и чат отвечает
# «позвоните в магазин», а не «долга нет».
MAX_NAMES_PER_PHONE = 1
SHARED = {"shared": True}
# Общий покупатель «Клиент розничная» — в нём долги чужих людей.
SHARED_CLIENT_RE = re.compile(r"розничн|retail", re.I)

_RUN_RE = re.compile(r"\+?\d[\d\s\-()]{7,}\d")


def _one_phone(digits: str) -> str | None:
    """Цифры одного номера → +996XXXXXXXXX / +7XXXXXXXXXX или None."""
    if len(digits) == 12 and digits.startswith("996"):
        return "+" + digits
    if len(digits) == 10 and digits.startswith("0"):
        return "+996" + digits[1:]
    if len(digits) == 9 and digits[0] in "2345679":
        return "+996" + digits
    if len(digits) == 11 and digits[0] in "78":
        return "+7" + digits[1:]
    return None


def parse_phones(raw: str) -> list[str]:
    """Все телефоны из строки 1С. Порядок сохраняется, повторы убираются."""
    found: list[str] = []
    for run in _RUN_RE.findall(raw or ""):
        digits = re.sub(r"\D", "", run)
        phone = _one_phone(digits)
        if phone is None:
            # Два номера через пробел слиплись: «0555929138 0550167161».
            for size in (10, 9, 12):
                if len(digits) == 2 * size:
                    parts = [_one_phone(digits[:size]), _one_phone(digits[size:])]
                    if all(parts):
                        found.extend(p for p in parts if p)
                    break
            continue
        found.append(phone)
    return list(dict.fromkeys(found))


def _money(value) -> float:
    try:
        return round(max(float(value or 0), 0.0), 2)
    except (TypeError, ValueError):
        return 0.0


def _day(value) -> str | None:
    """«2026-09-20» или «2026-09-20T00:00:00» → «2026-09-20»; пустая дата 1С («0001-…») → None."""
    text_value = str(value or "")[:10]
    try:
        parsed = date.fromisoformat(text_value)
    except ValueError:
        return None
    return None if parsed.year < 2000 else parsed.isoformat()


def _today() -> date:
    """Сегодня по Бишкеку: сервер живёт в UTC, а просрочка считается по местному дню."""
    return (datetime.now(timezone.utc) + timedelta(hours=6)).date()


def _purchase(item: dict, today: date) -> dict | None:
    """Одна покупка: график неоплаченных частей из 1С → остаток, просрочка, ближайший платёж."""
    parts: list[tuple[str, float]] = []
    for part in item.get("schedule") or []:
        if not isinstance(part, dict):
            continue
        day, amount = _day(part.get("date")), _money(part.get("sum"))
        if day and amount > 0:
            parts.append((day, amount))
    left = round(sum(a for _, a in parts), 2)
    if left <= 0:
        return None
    now = today.isoformat()
    upcoming = sorted(d for d, _ in parts if d >= now)
    next_date = upcoming[0] if upcoming else None
    return {
        "doc": str(item.get("doc") or "")[:40],
        "date": _day(item.get("date")),
        "total": _money(item.get("total")),
        "left": left,
        "overdue": round(sum(a for d, a in parts if d < now), 2),
        "nextDate": next_date,
        "nextAmount": round(sum(a for d, a in parts if d == next_date), 2) if next_date else 0.0,
        # Платежей осталось — сколько разных месяцев в неоплаченном графике, просроченные тоже.
        "monthsLeft": len({d[:7] for d, _ in parts}),
    }


def summarize(purchases: list[dict]) -> dict:
    """Итог по всем покупкам одного телефона: как его прочитает покупатель."""
    debt = round(sum(p["left"] for p in purchases), 2)
    overdue = round(sum(p["overdue"] for p in purchases), 2)
    dates = sorted(p["nextDate"] for p in purchases if p["nextDate"])
    next_date = dates[0] if dates else None
    next_amount = round(sum(p["nextAmount"] for p in purchases if p["nextDate"] == next_date), 2) if next_date else 0.0
    return {
        "debt": debt,
        "overdue": overdue,
        "nextDate": next_date,
        "nextAmount": next_amount,
        "monthsLeft": max((p["monthsLeft"] for p in purchases), default=0),
        "purchases": sorted(purchases, key=lambda p: p["date"] or ""),
    }


def build_rows(clients: list[dict], today: date | None = None) -> dict[str, dict]:
    """Снимок из 1С → {телефон: итог}. Чужое и общее отбрасывается здесь."""
    today = today or _today()
    by_phone: dict[str, list[dict]] = defaultdict(list)
    names: dict[str, set[str]] = defaultdict(set)
    for client in clients:
        name = str(client.get("name") or "").strip()
        if not name or SHARED_CLIENT_RE.search(name):
            continue
        purchases = [p for p in (_purchase(i, today) for i in client.get("items") or [] if isinstance(i, dict)) if p]
        if not purchases:
            continue
        for phone in parse_phones(str(client.get("phones") or "")):
            names[phone].add(name.lower())
            by_phone[phone].extend(purchases)
    return {
        phone: summarize(purchases) if len(names[phone]) <= MAX_NAMES_PER_PHONE else dict(SHARED)
        for phone, purchases in by_phone.items()
    }
