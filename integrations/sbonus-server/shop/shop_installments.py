"""
Интернет-магазин Smart Centr — остаток по рассрочке для чата на сайте.

Покупатель спрашивает в чате «сколько я ещё должен», «сколько месяцев
осталось». Эти цифры есть только в 1С, поэтому 1С раз в 10 минут присылает
сюда полный снимок: кто, сколько, когда ближайший платёж.

Эндпоинты (под /api/v1):
  POST /webhook/1c/shop/installments                 подпись 1С    полный снимок долгов
  GET  /webhook/site/customer/{996XXXXXXXXX}/installment
                                                     подпись сайта остаток одного покупателя

Чужой долг отсюда не узнать. Сайт спрашивает только по телефону из входного
cookie — то есть того, кто подтвердил номер кодом. Номер, набранный в чате,
сюда не попадает никогда.

Сам расчёт (телефоны, остаток, просрочка) — в shop_installments_calc.py.
"""
from __future__ import annotations

import json
import logging
import re
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db

from .shop_installments_calc import build_rows, parse_phones  # noqa: F401 (parse_phones — для проверки при выкате)
from .shop_router import _verify_1c_body, _verify_site_path

logger = logging.getLogger("sbonus.shop.installments")

router_1c_installments = APIRouter(prefix="/webhook/1c/shop", tags=["1С: рассрочка для сайта"])
router_site_installments = APIRouter(prefix="/webhook/site/customer", tags=["Сайт: рассрочка покупателя"])

MAX_CLIENTS = 20000


@router_1c_installments.post("/installments")
async def upload_installments(request: Request, db: AsyncSession = Depends(get_db)):
    body = await _verify_1c_body(request)
    try:
        data = json.loads(body.decode("utf-8"))
        clients = data["clients"]
        assert isinstance(clients, list) and len(clients) <= MAX_CLIENTS
    except Exception:
        raise HTTPException(422, "ожидается {\"clients\": [...]}")

    rows = build_rows([c for c in clients if isinstance(c, dict)])
    # Снимок полный: кто выплатил — пропадает. Замена целиком в одной транзакции,
    # чтобы сайт не увидел полупустую таблицу.
    await db.execute(text("DELETE FROM shop_installments"))
    for phone, summary in rows.items():
        await db.execute(
            text("INSERT INTO shop_installments (phone, data, updated_at) VALUES (:p, CAST(:d AS JSONB), NOW())"),
            {"p": phone, "d": json.dumps(summary, ensure_ascii=False)},
        )
    await db.commit()
    return {"ok": True, "clients": len(clients), "phones": len(rows)}


@router_site_installments.get("/{digits}/installment")
async def site_installment(digits: str, request: Request, db: AsyncSession = Depends(get_db)):
    _verify_site_path(request)
    if not re.fullmatch(r"996\d{9}|7\d{10}", digits):
        raise HTTPException(422, "телефон должен быть 996XXXXXXXXX или 7XXXXXXXXXX")
    row = (
        await db.execute(text("SELECT data, updated_at FROM shop_installments WHERE phone = :p"), {"p": "+" + digits})
    ).first()
    # Когда 1С присылала снимок в последний раз — даже если этого покупателя в нём нет.
    last = (await db.execute(text("SELECT MAX(updated_at) FROM shop_installments"))).scalar()
    as_of = last.isoformat() if isinstance(last, datetime) else None
    if not row:
        return {"has": False, "asOf": as_of}
    data, _ = row
    if isinstance(data, str):
        data = json.loads(data)
    return {"has": True, "asOf": as_of, **data}
