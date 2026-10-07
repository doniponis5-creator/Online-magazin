"""
Баннеры главной страницы сайта из 1С (владелец 07.10: «баннерни 1С'дан ўзим қўйсам… профессионал тиниқ расм»).

Только правила — без базы и сети, чтобы тесты шли без сервера (как shop_promo_rules.py):
  • image_info  — что за картинка (JPEG / PNG / WebP) и её размер в пикселях по первым байтам;
  • image_problem — годится ли картинка для компьютера или телефона (размер файла, ширина, пропорции);
  • clean_banner — поля баннера из 1С: заголовок, ссылка, включён, даты;
  • showing_today — показывать ли баннер сегодня (по Бишкеку).
Картинку не пережимаем: владелец кладёт готовую от дизайнера, сайт сам отдаёт её телефону нужного размера.
"""
from __future__ import annotations

import re
import struct
from datetime import date

MAX_BANNERS = 10
MAX_IMAGE_BYTES = 5 * 1024 * 1024
TITLE_MAX = 80
LINK_MAX = 300

# Компьютер — широкая (советуем 2400×1000), телефон — квадрат (1080×1080) или чуть выше/ниже.
KINDS = {
    "desktop": {"min_w": 1200, "ratio": (1.6, 4.0), "advice": "2400×1000"},
    "mobile": {"min_w": 600, "ratio": (0.6, 1.5), "advice": "1080×1080"},
}
TYPES = {"jpeg": ("image/jpeg", "jpg"), "png": ("image/png", "png"), "webp": ("image/webp", "webp")}


def _jpeg_size(b: bytes) -> tuple[int, int] | None:
    i = 2
    while i + 9 < len(b):
        if b[i] != 0xFF:
            i += 1
            continue
        marker = b[i + 1]
        if marker in (0xD8, 0x01) or 0xD0 <= marker <= 0xD7:
            i += 2
            continue
        seg = struct.unpack(">H", b[i + 2:i + 4])[0]
        # SOF0…SOF15, кроме DHT (C4), JPG (C8), DAC (CC): в них высота и ширина
        if 0xC0 <= marker <= 0xCF and marker not in (0xC4, 0xC8, 0xCC):
            h, w = struct.unpack(">HH", b[i + 5:i + 9])
            return w, h
        i += 2 + seg
    return None


def _webp_size(b: bytes) -> tuple[int, int] | None:
    chunk = b[12:16]
    if chunk == b"VP8 " and len(b) >= 30:
        w, h = struct.unpack("<HH", b[26:30])
        return w & 0x3FFF, h & 0x3FFF
    if chunk == b"VP8L" and len(b) >= 25:
        bits = int.from_bytes(b[21:25], "little")
        return (bits & 0x3FFF) + 1, ((bits >> 14) & 0x3FFF) + 1
    if chunk == b"VP8X" and len(b) >= 30:
        return int.from_bytes(b[24:27], "little") + 1, int.from_bytes(b[27:30], "little") + 1
    return None


def image_info(body: bytes) -> dict | None:
    """{'type': 'jpeg'|'png'|'webp', 'mime', 'ext', 'w', 'h'} или None — не картинка или не читается."""
    if body[:3] == b"\xff\xd8\xff":
        kind, size = "jpeg", _jpeg_size(body)
    elif body[:8] == b"\x89PNG\r\n\x1a\n" and len(body) >= 24:
        kind, size = "png", struct.unpack(">II", body[16:24])
    elif body[:4] == b"RIFF" and body[8:12] == b"WEBP":
        kind, size = "webp", _webp_size(body)
    else:
        return None
    if not size or size[0] <= 0 or size[1] <= 0:
        return None
    mime, ext = TYPES[kind]
    return {"type": kind, "mime": mime, "ext": ext, "w": int(size[0]), "h": int(size[1])}


def image_problem(kind: str, body: bytes) -> str | None:
    """Почему картинку нельзя поставить — словами для владельца в 1С; None — можно."""
    rule = KINDS.get(kind)
    if not rule:
        return "неизвестный вид картинки"
    if not body:
        return "файл пустой"
    if len(body) > MAX_IMAGE_BYTES:
        return f"файл больше {MAX_IMAGE_BYTES // (1024 * 1024)} МБ — сохраните в JPG качеством 85–90"
    info = image_info(body)
    if not info:
        return "это не JPG, PNG или WebP"
    w, h = info["w"], info["h"]
    # сначала форма: квадрат вместо широкой — частая путаница кнопок, «мелкая» тут сбивала бы с толку
    lo, hi = rule["ratio"]
    if kind == "desktop" and w / h < lo:
        return (f"картинка {w}×{h} — квадратная или узкая, это картинка для телефона; "
                f"для компьютера нужна широкая {rule['advice']}")
    if kind == "mobile" and w / h > hi:
        return (f"картинка {w}×{h} — широкая, это картинка для компьютера; "
                f"для телефона нужна квадратная {rule['advice']}")
    if not lo <= w / h <= hi:
        return f"картинка {w}×{h} — слишком вытянутая; нужна {rule['advice']}"
    if w < rule["min_w"]:
        return f"картинка {w}×{h} — мелкая, будет мутной; нужна от {rule['min_w']} px в ширину (лучше {rule['advice']})"
    return None


PRODUCT_CODE = re.compile(r"^[0-9A-Za-zА-Яа-яЁё\-_.]{1,40}$")
# раздел — код сайта (fridges) или название как в 1С («Холодильники», «Телевизоры и ТВ»); сверяет сайт
CATEGORY = re.compile(r"^[0-9A-Za-zА-Яа-яЁё][0-9A-Za-zА-Яа-яЁё\- ]{1,39}$")


def clean_link(raw: str) -> str | None:
    """
    Куда ведёт баннер: '' — никуда; 'product:<код 1С>'; 'cat:<раздел>'; '/ru/…' — страница сайта;
    'https://…' — другой сайт (откроется в новой вкладке). None — ссылка не годится.
    """
    link = (raw or "").strip()
    if not link:
        return ""
    if len(link) > LINK_MAX:
        return None
    if link.startswith("product:"):
        return link if PRODUCT_CODE.match(link[8:].strip()) else None
    if link.startswith("cat:"):
        return link if CATEGORY.match(link[4:].strip()) else None
    if link.startswith("https://") and " " not in link:
        return link
    if link.startswith("/") and not link.startswith("//") and " " not in link:
        return link
    return None


def _day(raw) -> date | None:
    if raw in (None, ""):
        return None
    if isinstance(raw, date):
        return raw
    text = str(raw)[:10]
    # 1С пишет пустую дату как 0001-01-01
    if text.startswith("0001-"):
        return None
    try:
        return date.fromisoformat(text)
    except ValueError:
        raise ValueError(f"дата «{raw}» не читается")


def clean_banner(raw: dict) -> dict:
    """Поля одного баннера из 1С. Ошибка — ValueError с текстом для владельца."""
    title = str(raw.get("title") or "").strip()[:TITLE_MAX]
    link = clean_link(str(raw.get("link") or ""))
    if link is None:
        raise ValueError(
            f"ссылка «{raw.get('link')}» не годится: product:КОД, cat:раздел, /ru/страница или https://адрес"
        )
    starts, ends = _day(raw.get("starts")), _day(raw.get("ends"))
    if starts and ends and ends < starts:
        raise ValueError(f"«{title or 'баннер'}»: дата «по» раньше даты «с»")
    raw_id = raw.get("id")
    return {
        "id": int(raw_id) if raw_id not in (None, "", 0, "0") else None,
        "title": title,
        "link": link,
        "active": bool(raw.get("active", True)),
        "starts": starts,
        "ends": ends,
    }


def showing_today(active: bool, starts: date | None, ends: date | None, today: date, has_image: bool) -> bool:
    """Показывать ли баннер сегодня: включён, есть картинка для компьютера и сегодня в его сроке."""
    if not active or not has_image:
        return False
    if starts and today < starts:
        return False
    if ends and today > ends:
        return False
    return True
