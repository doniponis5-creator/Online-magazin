"""
Интернет-магазин Smart Centr — рассылки «Скидка» и «Новинка» из 1С.

Владелец в 1С («Панель сайта» → «Уведомления») выбирает товар и шаблон и
нажимает «Отправить». Не автоматически: по событиям каталога ничего не уходит.
Получают только те, кто сам включил «Новинки и скидки» в «Кабинете» приложения.

Что здесь:
  get_consent / set_consent / forget — согласие покупателя (/webhook/site/promo-consent, account-delete)
  recipients / recipient_phones      — кто получит: согласились и есть живой адрес телефона
  last_send   — время последней рассылки: не больше одной в день
  start_send  — записать рассылку в журнал; вторую в тот же день база не даст
  deliver     — разослать в фоне и записать, до скольких дошло
  history     — последние 20 рассылок для 1С

Можно ли слать и каким текстом — решает shop_promo_rules.py. Отправка — только
через shop_push.send(): свой отправщик не нужен. В журнал — только последние
четыре цифры номера.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from . import shop_promo_rules as rules

logger = logging.getLogger("sbonus.shop.promo")

# Время в базе — UTC без зоны, как created_at у заказов.
NOW_UTC = "timezone('utc', now())"
HISTORY_LIMIT = 20
# Рассылка «отправляется» дольше этого — значит, сервер перезапускали посреди неё.
STUCK_AFTER = timedelta(hours=1)

# Согласились и хоть один телефон жив: иначе человек всё равно ничего не увидит.
_RECIPIENTS = (
    "FROM shop_promo_consent c WHERE c.consent IS TRUE "
    "AND EXISTS (SELECT 1 FROM shop_push_devices d WHERE d.phone = c.phone AND d.failed < 3)"
)


def _tail(phone: str) -> str:
    return f"...{phone[-4:]}"


def _naive_utc(moment: datetime) -> datetime:
    if moment.tzinfo is None:
        return moment
    return moment.astimezone(timezone.utc).replace(tzinfo=None)


async def get_consent(db: AsyncSession, phone: str) -> bool | None:
    """Текущее согласие; None — ещё не спрашивали (или строки нет)."""
    result = await db.execute(
        text("SELECT consent FROM shop_promo_consent WHERE phone = :ph"), {"ph": phone}
    )
    return result.scalar()


async def set_consent(db: AsyncSession, phone: str, consent: bool) -> bool | None:
    """Записать ответ покупателя «присылать / не присылать новинки и скидки»."""
    result = await db.execute(
        text(
            f"INSERT INTO shop_promo_consent (phone, consent, updated_at) VALUES (:ph, :consent, {NOW_UTC}) "
            "ON CONFLICT (phone) DO UPDATE SET consent = EXCLUDED.consent, updated_at = EXCLUDED.updated_at "
            "RETURNING consent"
        ),
        {"ph": phone, "consent": bool(consent)},
    )
    saved = result.scalar()
    await db.commit()
    return saved


async def forget(db: AsyncSession, phone: str) -> int:
    """Покупатель удалил учётную запись — стираем и его согласие на рассылки."""
    result = await db.execute(text("DELETE FROM shop_promo_consent WHERE phone = :ph"), {"ph": phone})
    await db.commit()
    return int(result.rowcount or 0)


async def recipients(db: AsyncSession) -> int:
    """Сколько человек получит рассылку, если отправить сейчас."""
    return int((await db.execute(text(f"SELECT count(*) {_RECIPIENTS}"))).scalar() or 0)


async def recipient_phones(db: AsyncSession) -> list[str]:
    result = await db.execute(text(f"SELECT c.phone {_RECIPIENTS} ORDER BY c.phone"))
    return [row[0] for row in result.fetchall()]


async def last_send(db: AsyncSession) -> datetime | None:
    """Когда была последняя рассылка, которая до кого-то дошла или ещё идёт."""
    result = await db.execute(text("SELECT max(created_at) FROM shop_promo_sends WHERE status <> 'failed'"))
    return result.scalar()


async def start_send(
    db: AsyncSession, now: datetime, kind: str, code: str | None, title: str, body: str, url: str, count: int
) -> int | None:
    """
    Записать рассылку в журнал до отправки. None — сегодня рассылка уже есть:
    так бывает, если в 1С нажали «Отправить» дважды подряд. Проверку «одна в
    день» делает уникальный индекс базы, а не код, — двойное нажатие его не обойдёт.
    """
    try:
        result = await db.execute(
            text(
                "INSERT INTO shop_promo_sends (created_at, send_day, kind, code, title, body, url, recipients) "
                "VALUES (:at, :day, :kind, :code, :title, :body, :url, :count) RETURNING id"
            ),
            {
                "at": _naive_utc(now), "day": rules.shop_day(now), "kind": kind, "code": code,
                "title": title, "body": body, "url": url, "count": count,
            },
        )
        send_id = result.scalar()
        await db.commit()
    except IntegrityError:
        await db.rollback()
        return None
    return int(send_id)


async def deliver(send_id: int, phones: list[str], title: str, body: str, data: dict) -> dict:
    """
    Разослать в фоне: ответ 1С уже ушёл, отправка тысячи телефонов займёт минуты.
    Своё соединение с базой — соединение запроса к этому времени закрыто.
    Не дошло ни до кого — рассылка «failed» и день не занимает: можно повторить.
    """
    from app.core import database
    from .shop_push import send

    delivered = 0
    async with database.async_session() as db:
        try:
            for phone in phones:
                if await send(db, phone, title, body, data):
                    delivered += 1
        except Exception as error:
            # send() сам не бросает; сюда попадёт разве что обрыв базы.
            logger.warning(f"promo: рассылка №{send_id} прервана ({type(error).__name__})")
            await db.rollback()
        status = "done" if delivered else "failed"
        try:
            await db.execute(
                text("UPDATE shop_promo_sends SET delivered = :d, status = :s WHERE id = :id"),
                {"d": delivered, "s": status, "id": send_id},
            )
            await db.commit()
        except Exception as error:
            await db.rollback()
            logger.warning(f"promo: итог рассылки №{send_id} не записан ({type(error).__name__})")
    logger.info(f"promo: рассылка №{send_id}: доставлено {delivered} из {len(phones)}")
    return {"delivered": delivered, "status": status}


def _state(status: str, created_at: datetime | None, now: datetime) -> str:
    if status == "sending" and created_at is not None and _naive_utc(now) - created_at > STUCK_AFTER:
        return "interrupted"
    return status


async def history(db: AsyncSession, now: datetime) -> list[dict]:
    """Последние рассылки, новые сверху. Время — UTC, 1С переводит в бишкекское сама."""
    result = await db.execute(
        text(
            "SELECT id, created_at, kind, code, title, body, recipients, delivered, status "
            f"FROM shop_promo_sends ORDER BY id DESC LIMIT {HISTORY_LIMIT}"
        )
    )
    rows = []
    for row in result.mappings().all():
        created = row["created_at"]
        rows.append({
            "id": row["id"],
            "at": created.isoformat() if isinstance(created, datetime) else None,
            "kind": row["kind"],
            "code": row["code"] or "",
            "title": row["title"],
            "body": row["body"],
            "recipients": int(row["recipients"] or 0),
            "delivered": int(row["delivered"] or 0),
            "status": _state(row["status"], created, now),
        })
    return rows
