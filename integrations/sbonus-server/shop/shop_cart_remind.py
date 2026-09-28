"""
Интернет-магазин Smart Centr — напоминание о товарах в корзине.

Человек положил товары в корзину приложения и ушёл. Через день, потом ещё
через несколько — мягко напоминаем уведомлением на телефон (iPhone и Android).
Только тем, кто сам согласился, только днём по Бишкеку и только пока с
изменения корзины не было заказа этим номером.

Что здесь:
  save_cart / set_consent / get_consent — для /webhook/site/push-cart и cart-consent
  clear_after_order — заказ оформлен: корзина на сервере обнуляется
  forget            — удаление учётной записи стирает строку
  run_once / main   — одна проверка из cron и выход:
                      docker exec -e PYTHONPATH=/app sbonus_api python3 -m app.shop.shop_cart_remind

Когда и каким текстом — решает shop_cart_rules.py (там же расписание одной
строкой). Отправка — только через shop_push.send(): свой отправщик не нужен.
В журнал — только последние четыре цифры номера.
"""
from __future__ import annotations

import asyncio
import json
import logging
import re
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from . import shop_cart_rules as rules

logger = logging.getLogger("sbonus.shop.cart")

# Снимок корзины от сайта: не больше трёх названий, разумные числа.
MAX_ITEMS = 3
ITEM_LEN = 120
MAX_COUNT = 999
MAX_TOTAL = Decimal("100000000")
_PHONE = re.compile(r"\+?\d{9,15}")

# Время в базе — UTC без зоны, как created_at у заказов (datetime.utcnow).
NOW_UTC = "timezone('utc', now())"

# Корзина изменилась, если поменялся состав, число позиций или сумма.
_CHANGED = (
    "(shop_cart_reminders.items IS DISTINCT FROM EXCLUDED.items "
    "OR shop_cart_reminders.count IS DISTINCT FROM EXCLUDED.count "
    "OR shop_cart_reminders.total IS DISTINCT FROM EXCLUDED.total)"
)
# Человек только что сказал «да»: расписание начинаем с этой минуты, а не со
# старого изменения корзины — иначе напоминание пришло бы через полчаса.
_JUST_AGREED = "(shop_cart_reminders.consent IS NOT TRUE AND EXCLUDED.consent IS TRUE)"


def _tail(phone: str) -> str:
    return f"...{phone[-4:]}"


def clean_phone(raw) -> str | None:
    """Номер из подписанного сайтом тела — в том виде, в каком он в заказах."""
    phone = str(raw or "").strip()
    return phone if _PHONE.fullmatch(phone) else None


def clean_snapshot(items, count, total) -> tuple[list[str], int, Decimal] | None:
    """Проверить снимок корзины. None — снимок негодный, не сохраняем."""
    try:
        count = int(count or 0)
        total = Decimal(str(total or 0))
    except (TypeError, ValueError, InvalidOperation):
        return None
    if not isinstance(items, list) or count < 0 or count > MAX_COUNT:
        return None
    if not total.is_finite() or total < 0 or total >= MAX_TOTAL:
        return None
    if count == 0:
        # Пустая корзина — тоже снимок: напоминать не о чем.
        return [], 0, Decimal("0")
    names = [item.strip()[:ITEM_LEN] for item in items if isinstance(item, str) and item.strip()]
    return names[:MAX_ITEMS], count, total.quantize(Decimal("0.01"))


async def save_cart(db: AsyncSession, phone: str, items: list[str], count: int, total: Decimal) -> bool | None:
    """
    Запомнить снимок корзины. Изменилась — расписание начинается заново
    (счётчик в ноль, время изменения — сейчас). Тот же снимок, присланный
    повторно (например, при входе), расписание не сбивает.
    Возвращает текущее согласие: True / False / None — ещё не спрашивали.
    """
    result = await db.execute(
        text(
            "INSERT INTO shop_cart_reminders (phone, items, count, total, changed_at, sent) "
            f"VALUES (:ph, CAST(:items AS JSONB), :count, :total, {NOW_UTC}, 0) "
            "ON CONFLICT (phone) DO UPDATE SET "
            f"changed_at = CASE WHEN {_CHANGED} THEN EXCLUDED.changed_at ELSE shop_cart_reminders.changed_at END, "
            f"sent = CASE WHEN {_CHANGED} THEN 0 ELSE shop_cart_reminders.sent END, "
            "items = EXCLUDED.items, count = EXCLUDED.count, total = EXCLUDED.total "
            "RETURNING consent"
        ),
        {"ph": phone, "items": json.dumps(items, ensure_ascii=False), "count": count, "total": total},
    )
    consent = result.scalar()
    await db.commit()
    return consent


async def set_consent(db: AsyncSession, phone: str, consent: bool) -> bool | None:
    """Записать ответ покупателя «напоминать / не напоминать»."""
    result = await db.execute(
        text(
            f"INSERT INTO shop_cart_reminders (phone, consent, changed_at) VALUES (:ph, :consent, {NOW_UTC}) "
            "ON CONFLICT (phone) DO UPDATE SET "
            f"changed_at = CASE WHEN {_JUST_AGREED} THEN EXCLUDED.changed_at ELSE shop_cart_reminders.changed_at END, "
            f"sent = CASE WHEN {_JUST_AGREED} THEN 0 ELSE shop_cart_reminders.sent END, "
            "consent = EXCLUDED.consent "
            "RETURNING consent"
        ),
        {"ph": phone, "consent": bool(consent)},
    )
    saved = result.scalar()
    await db.commit()
    return saved


async def get_consent(db: AsyncSession, phone: str) -> bool | None:
    """Текущее согласие; None — ещё не спрашивали (или строки нет)."""
    result = await db.execute(
        text("SELECT consent FROM shop_cart_reminders WHERE phone = :ph"), {"ph": phone}
    )
    return result.scalar()


async def clear_after_order(db: AsyncSession, phone: str) -> None:
    """Заказ этим номером оформлен — корзина на сервере пуста, напоминать не о чем."""
    await db.execute(
        text(
            "UPDATE shop_cart_reminders SET items = '[]'::jsonb, count = 0, total = 0, sent = 0, "
            f"changed_at = {NOW_UTC} WHERE phone = :ph"
        ),
        {"ph": phone},
    )
    await db.commit()


async def forget(db: AsyncSession, phone: str) -> int:
    """Покупатель удалил учётную запись — стираем его корзину и согласие."""
    result = await db.execute(text("DELETE FROM shop_cart_reminders WHERE phone = :ph"), {"ph": phone})
    await db.commit()
    return int(result.rowcount or 0)


async def run_once(db: AsyncSession, now: datetime) -> dict:
    """
    Одна проверка: кому пора напомнить — тому и шлём.
    Счётчик растёт, только если уведомление дошло хотя бы до одного телефона:
    иначе напоминание не считается отправленным и будет в следующий раз.
    """
    from .shop_push import enabled, send

    if not rules.daytime(now) or not enabled():
        return {"due": 0, "sent": 0}
    # Без согласия, с пустой корзиной, без адреса телефона и после заказа
    # этим номером — даже не рассматриваем.
    result = await db.execute(
        text(
            "SELECT r.phone, r.consent, r.items, r.count, r.changed_at, r.sent, r.last_sent_at "
            "FROM shop_cart_reminders r "
            "WHERE r.consent IS TRUE AND r.count > 0 "
            "AND EXISTS (SELECT 1 FROM shop_push_devices d WHERE d.phone = r.phone AND d.failed < 3) "
            "AND NOT EXISTS (SELECT 1 FROM shop_orders o "
            "WHERE o.customer_phone = r.phone AND o.created_at >= r.changed_at)"
        )
    )
    rows = result.mappings().all()
    due = delivered = 0
    for row in rows:
        if not rules.due(row, now):
            continue
        due += 1
        phone = row["phone"]
        items = row["items"]
        if isinstance(items, str):
            items = json.loads(items or "[]")
        title, body = rules.reminder_text(items, row["count"])
        sent = int(row["sent"] or 0)
        mark = {"ph": phone, "changed": row["changed_at"], "sent": sent}
        # Сначала отмечаем, потом шлём. Наоборот при сбое записи через 30 минут
        # ушёл бы дубль; так худшее — одно пропущенное напоминание.
        # changed_at и sent в условии: корзина поменялась или строку уже отметили —
        # расписание не наше, ничего не трогаем.
        try:
            marked = await db.execute(
                text(
                    f"UPDATE shop_cart_reminders SET sent = sent + 1, last_sent_at = {NOW_UTC} "
                    "WHERE phone = :ph AND changed_at = :changed AND sent = :sent RETURNING phone"
                ),
                mark,
            )
            claimed = marked.first() is not None
            await db.commit()
        except Exception as error:
            await db.rollback()
            logger.warning(f"cart: отметка не записана {_tail(phone)} ({type(error).__name__}), не шлём")
            continue
        if not claimed:
            continue
        if not await send(db, phone, title, body, {"type": "cart"}):
            # Не дошло ни до одного телефона — отметку снимаем: напоминание не считается,
            # придёт в следующий раз. Не снялась — один раз промолчим, это не страшно.
            try:
                await db.execute(
                    text(
                        "UPDATE shop_cart_reminders SET sent = :sent, last_sent_at = :last "
                        "WHERE phone = :ph AND changed_at = :changed AND sent = :sent + 1"
                    ),
                    {**mark, "last": row["last_sent_at"]},
                )
                await db.commit()
            except Exception as error:
                await db.rollback()
                logger.warning(f"cart: отметка не снята {_tail(phone)} ({type(error).__name__})")
            continue
        delivered += 1
        logger.info(f"cart: напомнили {_tail(phone)}, №{sent + 1}")
    return {"due": due, "sent": delivered}


def main() -> None:
    """Запуск из cron: одна проверка и выход. В журнал — только события и ошибки."""
    logging.basicConfig(level=logging.WARNING, format="%(asctime)s %(message)s")
    logging.getLogger("sbonus.shop").setLevel(logging.INFO)

    async def once() -> dict:
        from app.core import database
        try:
            async with database.async_session() as db:
                return await run_once(db, datetime.now(timezone.utc))
        finally:
            # Закрываем соединения сами: иначе при выходе Python ругается на закрытый цикл.
            engine = getattr(database, "engine", None)
            if engine is not None:
                await engine.dispose()

    try:
        result = asyncio.run(once())
    except Exception as error:
        # Только тип: даже первая строка ошибки asyncpg может нести значение параметра — номер.
        print(f"{datetime.now():%Y-%m-%d %H:%M} ошибка: {type(error).__name__}")
        raise SystemExit(1)
    if result.get("due") or result.get("sent"):
        print(f"{datetime.now():%Y-%m-%d %H:%M} пора напомнить: {result['due']}, доставлено: {result['sent']}")


if __name__ == "__main__":
    main()
