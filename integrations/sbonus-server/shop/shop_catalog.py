"""
Интернет-магазин Smart Centr — каталог и фото: 1С → сервер → сайт.

1С (расширение «Онлайн магазин», регламентное задание каждые 10 минут):
  GET  /api/v1/webhook/1c/shop/photos-index        (X-Api-Key)  какие фото уже есть на сервере (key → md5)
  POST /api/v1/webhook/1c/shop/photos/{key}        (HMAC тела)  загрузить одно фото (тело — JPEG)
  POST /api/v1/webhook/1c/shop/catalog             (HMAC тела)  полный снимок каталога {"items": [...]}
Сайт:
  GET  /api/v1/webhook/site/catalog                (HMAC пути)  каталог + hash (сайт обновляется при смене hash)
Публично:
  GET  /api/v1/shop/photos/{key}.jpg               фото товара (кэш на год: ключ меняется вместе с фото)

Себестоимость сюда не передаётся — 1С отправляет только то, что можно показать покупателям.
"""
from __future__ import annotations

import hashlib
import json
import re
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db

from .shop_router import _verify_1c_body, _verify_1c_key, _verify_site_path

router_1c_catalog = APIRouter(prefix="/webhook/1c/shop", tags=["1С: каталог сайта"])
router_site_catalog = APIRouter(prefix="/webhook/site", tags=["Сайт: каталог"])
router_public_photos = APIRouter(prefix="/shop/photos", tags=["Фото товаров"])

KEY_RE = re.compile(r"^[0-9a-f-]{36}-\d{1,3}-[0-9a-f]{10}$")
MAX_PHOTO_BYTES = 5 * 1024 * 1024
MAX_ITEMS = 20000


def _as_jpeg(body: bytes) -> bytes:
    """JPEG оставляем как есть; PNG, WebP, BMP, GIF переводим в JPEG (прозрачность — на белом фоне)."""
    if body[:3] == b"\xff\xd8\xff":
        return body
    from io import BytesIO
    from PIL import Image

    image = Image.open(BytesIO(body))
    image.load()
    if image.mode in ("RGBA", "LA", "P"):
        image = image.convert("RGBA")
        background = Image.new("RGB", image.size, (255, 255, 255))
        background.paste(image, mask=image.split()[-1])
        image = background
    elif image.mode != "RGB":
        image = image.convert("RGB")
    out = BytesIO()
    image.save(out, "JPEG", quality=90, optimize=True)
    return out.getvalue()


@router_1c_catalog.get("/photos-index")
async def photos_index(_=Depends(_verify_1c_key), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(text("SELECT key, md5 FROM shop_photos"))).all()
    return {"ok": True, "photos": {key: md5 for key, md5 in rows}}


@router_1c_catalog.post("/photos/{key}")
async def upload_photo(key: str, request: Request, db: AsyncSession = Depends(get_db)):
    body = await _verify_1c_body(request)
    if not KEY_RE.match(key):
        raise HTTPException(422, "неверный ключ фото")
    if not body or len(body) > MAX_PHOTO_BYTES:
        raise HTTPException(422, "ожидается картинка до 5 МБ")
    # md5 — от присланных байт: 1С сравнивает его в photos-index и не шлёт фото повторно.
    md5 = hashlib.md5(body).hexdigest()
    try:
        content = _as_jpeg(body)
    except Exception:
        raise HTTPException(422, "не удалось прочитать картинку (нужен JPEG, PNG, WebP, BMP или GIF)")
    await db.execute(
        text(
            "INSERT INTO shop_photos (key, content, md5, size_bytes, updated_at) VALUES (:k, :c, :m, :s, NOW()) "
            "ON CONFLICT (key) DO UPDATE SET content = :c, md5 = :m, size_bytes = :s, updated_at = NOW()"
        ),
        {"k": key, "c": content, "m": md5, "s": len(content)},
    )
    await db.commit()
    return {"ok": True, "key": key, "md5": md5}


@router_1c_catalog.post("/catalog")
async def upload_catalog(request: Request, db: AsyncSession = Depends(get_db)):
    body = await _verify_1c_body(request)
    try:
        data = json.loads(body.decode("utf-8"))
        items = data["items"]
        assert isinstance(items, list) and len(items) <= MAX_ITEMS
    except Exception:
        raise HTTPException(422, "ожидается {\"items\": [...]}")

    # Каталог нормализуем (сортировка ключей), чтобы hash не менялся от порядка полей.
    normalized = json.dumps({"items": items}, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    digest = hashlib.sha256(normalized.encode("utf-8")).hexdigest()
    await db.execute(
        text(
            "INSERT INTO shop_catalog (id, data, hash, items_count, updated_at) "
            "VALUES (1, CAST(:d AS JSONB), :h, :n, NOW()) "
            "ON CONFLICT (id) DO UPDATE SET data = CAST(:d AS JSONB), hash = :h, items_count = :n, updated_at = NOW()"
        ),
        {"d": normalized, "h": digest, "n": len(items)},
    )

    # Фото, на которые больше не ссылается ни один товар, удаляем.
    used = {url.rsplit("/", 1)[-1].removesuffix(".jpg") for item in items for url in (item.get("photos") or [])}
    existing = {row[0] for row in (await db.execute(text("SELECT key FROM shop_photos"))).all()}
    stale = list(existing - used)
    if stale:
        await db.execute(text("DELETE FROM shop_photos WHERE key = ANY(:keys)"), {"keys": stale})
    await db.commit()
    return {"ok": True, "hash": digest, "items": len(items), "photos_removed": len(stale)}


@router_site_catalog.get("/catalog")
async def site_catalog(request: Request, db: AsyncSession = Depends(get_db)):
    _verify_site_path(request)
    row = (await db.execute(text("SELECT data, hash, updated_at FROM shop_catalog WHERE id = 1"))).first()
    if not row:
        return {"hash": None, "exportedAt": None, "items": []}
    data, digest, updated_at = row
    if isinstance(data, str):
        data = json.loads(data)
    return {
        "hash": digest,
        "exportedAt": updated_at.isoformat() if isinstance(updated_at, datetime) else None,
        "items": data.get("items", []),
    }


@router_public_photos.get("/{key}.jpg")
async def public_photo(key: str, db: AsyncSession = Depends(get_db)):
    if not KEY_RE.match(key):
        raise HTTPException(404)
    row = (await db.execute(text("SELECT content, md5 FROM shop_photos WHERE key = :k"), {"k": key})).first()
    if not row:
        raise HTTPException(404)
    content, md5 = row
    return Response(
        content=bytes(content),
        media_type="image/jpeg",
        headers={"Cache-Control": "public, max-age=31536000, immutable", "ETag": f'"{md5}"'},
    )
