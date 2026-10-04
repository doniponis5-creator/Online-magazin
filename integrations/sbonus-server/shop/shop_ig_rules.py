"""
Instagram-продавец: правила без приложения (разбор webhook Meta, подпись, текст).

Модуль не импортирует app — тесты идут без сервера:
    uv run python -m unittest integrations/sbonus-server/shop/test_shop_ig_rules.py

Сам робот (очередь, ожидание сотрудника, отправка) — shop_ig_bot.py.
"""
from __future__ import annotations

import hashlib
import hmac
import re

GRAPH = "https://graph.instagram.com/v23.0"
# Instagram принимает до 1000 БАЙТ в сообщении, а буква кириллицы — 2 байта.
# Считаем байты, с запасом: ответ длиннее — уходит частями.
TEXT_LIMIT = 950
WINDOW = 24 * 3600                # Meta: писать покупателю можно 24 часа после его сообщения
WINDOW_SAFE = 23 * 3600           # напоминаем с запасом в час

# Публикация, которую покупатель переслал: пост, рилс, реклама.
SHARE_TYPES = ("share", "ig_reel", "reel", "ig_post", "post")


def signature_ok(secrets: str, body: bytes, header: str) -> bool:
    """
    X-Hub-Signature-256: «sha256=<hex>» — HMAC тела запроса секретом приложения.

    Секретов может быть несколько через запятую: у приложения Meta есть свой секрет
    и отдельный «секрет приложения Instagram», и каким из них Meta подпишет — проверим вживую.
    """
    if not header.startswith("sha256="):
        return False
    given = header[len("sha256="):]
    for secret in (s.strip() for s in secrets.split(",")):
        if secret and hmac.compare_digest(given, hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()):
            return True
    return False


def _items(entry: dict) -> list[dict]:
    """Сообщения из одной записи webhook. Meta шлёт их в messaging, проверка из кабинета — в changes."""
    items = [m for m in entry.get("messaging") or [] if isinstance(m, dict)]
    for change in entry.get("changes") or []:
        if isinstance(change, dict) and change.get("field") == "messages" and isinstance(change.get("value"), dict):
            items.append(change["value"])
    return items


def _context(message: dict, item: dict) -> list[str]:
    """Что пришло вместе с текстом: реклама, пересланный пост, ответ на историю."""
    notes = []
    referral = message.get("referral") or item.get("referral") or {}
    if isinstance(referral, dict):
        ad = referral.get("ads_context_data") or {}
        title = str((ad.get("ad_title") if isinstance(ad, dict) else "") or "").strip()
        if title:
            notes.append(f"[Пришёл по рекламе: {title[:200]}]")
        elif referral.get("source") == "ADS" or referral.get("ad_id"):
            notes.append("[Пришёл по рекламе в Instagram]")
    if story_of(message):
        notes.append(STORY_NOTE)
    for attachment in message.get("attachments") or []:
        if not isinstance(attachment, dict):
            continue
        kind = attachment.get("type")
        payload = attachment.get("payload") or {}
        title = str((payload.get("title") if isinstance(payload, dict) else "") or "").strip()
        if kind in SHARE_TYPES:
            notes.append(f"[Прислал публикацию: {title[:200]}]" if title else "[Прислал публикацию из Instagram]")
        elif kind == "story_mention":
            notes.append("[Отметил магазин в своей истории]")
    return notes


STORY_NOTE = "[Ответ на историю магазина]"


def story_of(message: dict) -> str:
    """id истории, на которую ответили; "" — не ответ на историю. По нему робот узнаёт товар нашей истории."""
    reply_to = message.get("reply_to") or {}
    story = reply_to.get("story") if isinstance(reply_to, dict) else None
    if not story:
        return ""
    return str(story.get("id") or "-") if isinstance(story, dict) else "-"


def story_note(name: str, price: int, old: int) -> str:
    """Пометка для мозга: на какую нашу историю ответили — товар и цена, как на картинке."""
    was = f", было {_som(old)}" if old > price > 0 else ""
    return f"[Ответ на историю магазина: {name} — {_som(price)}{was}]"


def _media(message: dict) -> list[dict]:
    """Фото и голосовые, которые может прочитать сайт. Видео и стикеры — нет."""
    found = []
    for attachment in message.get("attachments") or []:
        if not isinstance(attachment, dict):
            continue
        kind = {"image": "image", "audio": "audio"}.get(str(attachment.get("type") or ""))
        payload = attachment.get("payload") or {}
        url = str((payload.get("url") if isinstance(payload, dict) else "") or "")
        if kind and url.startswith("https://") and not (isinstance(payload, dict) and payload.get("sticker_id")):
            found.append({"kind": kind, "url": url})
    return found


def events(payload: dict) -> list[dict]:
    """
    Webhook → события по порядку:
      {"kind": "in" | "echo", "user": id покупателя, "mid", "ts" (секунды), "text", "context": [...], "media": [...]}

    echo — сообщение ушло ОТ магазина (сотрудник с телефона или наш же робот).
    Прочитано, реакция, удалённое и неподдерживаемое — не события.
    """
    if not isinstance(payload, dict) or payload.get("object") != "instagram":
        return []
    found = []
    for entry in payload.get("entry") or []:
        if not isinstance(entry, dict):
            continue
        own = str(entry.get("id") or "")
        for item in _items(entry):
            message = item.get("message")
            if not isinstance(message, dict) or message.get("is_deleted") or message.get("is_unsupported"):
                continue
            mid = str(message.get("mid") or "")
            sender = str((item.get("sender") or {}).get("id") or "")
            recipient = str((item.get("recipient") or {}).get("id") or "")
            echo = bool(message.get("is_echo"))
            user = recipient if echo else sender
            if not mid or not user or (not echo and own and user == own):
                continue
            ts = item.get("timestamp") or 0
            try:
                ts = float(ts)
            except (TypeError, ValueError):
                ts = 0.0
            found.append({
                "kind": "echo" if echo else "in",
                "user": user,
                "mid": mid,
                # Meta шлёт миллисекунды; проверка из кабинета — иногда секунды.
                "ts": ts / 1000 if ts > 10_000_000_000 else ts,
                "text": str(message.get("text") or "").strip(),
                "context": _context(message, item),
                "media": _media(message),
                "story": story_of(message).strip("-"),
            })
    return sorted(found, key=lambda e: e["ts"])


def comment_events(payload: dict) -> list[dict]:
    """
    Комментарии под постами и рилсами магазина (поле webhook «comments», 04.10):
      {"kind": "comment", "id", "mid": "c:<id>", "user", "username", "media", "text", "ts"}
    Комментарии самого магазина (from.id = id аккаунта) — не события: это наши ответы.
    """
    if not isinstance(payload, dict) or payload.get("object") != "instagram":
        return []
    found = []
    for entry in payload.get("entry") or []:
        if not isinstance(entry, dict):
            continue
        own = str(entry.get("id") or "")
        ts = entry.get("time") or 0
        for change in entry.get("changes") or []:
            if not isinstance(change, dict) or change.get("field") != "comments" or not isinstance(change.get("value"), dict):
                continue
            value = change["value"]
            sender = value.get("from") or {}
            user = str(sender.get("id") or "") if isinstance(sender, dict) else ""
            cid = str(value.get("id") or "")
            text = str(value.get("text") or "").strip()
            if not cid or not user or not text or (own and user == own):
                continue
            media = value.get("media") or {}
            try:
                ts = float(ts)
            except (TypeError, ValueError):
                ts = 0.0
            found.append({
                "kind": "comment",
                "id": cid,
                "mid": f"c:{cid}",
                "user": user,
                "username": str(sender.get("username") or "")[:60],
                "media": str(media.get("id") or "") if isinstance(media, dict) else "",
                "text": text[:500],
                "ts": ts / 1000 if ts > 10_000_000_000 else ts,
            })
    return found


def describe(event: dict) -> str:
    """Реплика покупателя для разговора: пометки (реклама, пост) + его текст."""
    return "\n".join([*(event.get("context") or []), event.get("text") or ""]).strip()


def text_key(text: str) -> str:
    """Отпечаток текста — узнать свой ответ, когда Instagram вернёт его эхом."""
    return hashlib.sha1(re.sub(r"\s+", " ", text).strip().encode("utf-8")).hexdigest()


def _size(text: str) -> int:
    return len(text.encode("utf-8"))


def _cut(text: str, limit: int) -> tuple[str, str]:
    """Голова не больше limit байт (букву пополам не режем) и остаток."""
    head = text.encode("utf-8")[:limit].decode("utf-8", errors="ignore")
    return head, text[len(head):]


def split_text(text: str, limit: int = TEXT_LIMIT) -> list[str]:
    """Длинный ответ — на части по абзацам и предложениям, каждая не больше limit байт."""
    text = text.strip()
    if _size(text) <= limit:
        return [text] if text else []
    parts, current = [], ""
    for piece in re.split(r"(?<=[\n.!?])\s+", text):
        while _size(piece) > limit:
            if current:
                parts.append(current)
                current = ""
            head, piece = _cut(piece, limit)
            parts.append(head)
        candidate = f"{current} {piece}".strip() if current else piece
        if _size(candidate) <= limit:
            current = candidate
        else:
            parts.append(current)
            current = piece
    if current:
        parts.append(current)
    return [p for p in parts if p.strip()]


def mention_only(event: dict) -> bool:
    """Покупатель только отметил магазин в своей истории — это не вопрос, отвечать не нужно."""
    return not event.get("text") and not event.get("media") and event.get("context") == ["[Отметил магазин в своей истории]"]


def window_open(last_user_ts: float, at: float) -> bool:
    """Можно ли написать первым в момент at: покупатель писал меньше 23 часов назад."""
    return bool(last_user_ts) and 0 <= at - last_user_ts < WINDOW_SAFE


# ── Посты «Скидка» / «Новинка» из 1С (04.10) ─────────────────────────────────
# Пост выходит только по кнопке владельца в «Панели сайта» → «Уведомления».
# Картинку рисует сайт в оформлении smarket.kg (/api/instagram/post-image),
# публикует shop_ig_post.py. Здесь — только текст и проверки, без сервера.

CAPTION_MAX = 2200                # предел Instagram
HASHTAGS_MAX = 30                 # больше Instagram не опубликует
POSTS_PER_DAY = 10                # наш предел: лента из десяти скидок в день — уже спам
STORIES_PER_DAY = 10              # историй — столько же (у Instagram общий предел 100 в сутки)
# Тот же номер, что первый в src/data/contacts.ts (подвал сайта и картинка поста).
SHOP_PHONE = "+996 557 100 505"


def _som(value: int) -> str:
    """15900 → «15 900 сом» — как formatSom на сайте (пробел-разделитель тысяч)."""
    return f"{int(value):,}".replace(",", " ") + " сом"


def discount_pct(price: int, old: int) -> int:
    """Как на картинке (postImage.tsx discountPct): от старой цены, вниз до целого."""
    if price <= 0 or old <= price:
        return 0
    return (old - price) * 100 // old


def image_kind(kind: str, on_sale: bool) -> str:
    """Какая метка на картинке: «Скидка», «Новинка» или без метки («свой текст» без скидки)."""
    if kind == "sale":
        return "sale"
    if kind == "new":
        return "new"
    return "sale" if on_sale else "plain"


def post_caption(kind: str, name: str, price: int, old: int) -> str:
    """
    Подпись поста по шаблону: по-русски и по-кыргызски, цена только из каталога.
    Полное название и цена в подписи нужны и роботу комментариев: по ним он узнаёт товар
    поста (knowledge.bestNameMatch) и отвечает «Канча?» правильной ценой.
    """
    name = re.sub(r"\s+", " ", name.replace("*", "")).strip()
    pct = discount_pct(price, old)
    if kind == "sale" and pct > 0:
        head = [f"🔥 Скидка −{pct}% · Арзандатуу", name, "", f"Было: {_som(old)}", f"Сейчас: {_som(price)}"]
        tags = "#smartcentr #smarketkg #скидка #арзандатуу #ош #кыргызстан"
    elif kind == "new":
        head = ["✨ Новинка · Жаңы товар", name, "", f"Цена: {_som(price)}"]
        tags = "#smartcentr #smarketkg #новинка #жаңытовар #ош #кыргызстан"
    else:
        head = [name, "", f"Цена: {_som(price)}"]
        tags = "#smartcentr #smarketkg #ош #кыргызстан"
    tail = [
        "",
        "✅ В наличии · Бар",
        "📩 Пишите в Direct · Директке жазыңыз",
        f"📞 WhatsApp: {SHOP_PHONE}",
        "🌐 smarket.kg",
        "",
        tags,
    ]
    return "\n".join(head + tail)


def clean_caption(value) -> str:
    """Переводы строк оставляем (пост — не уведомление), лишние пробелы в строках убираем."""
    lines = [re.sub(r"[ \t]+", " ", line).strip() for line in str(value or "").replace("\r\n", "\n").split("\n")]
    return re.sub(r"\n{3,}", "\n\n", "\n".join(lines)).strip()


def caption_problem(caption: str) -> str | None:
    """Что не так с подписью — фразой для 1С. None — всё хорошо."""
    if not caption:
        return "Заполните текст поста."
    if len(caption) > CAPTION_MAX:
        return f"Текст поста длиннее {CAPTION_MAX} знаков ({len(caption)}) — сократите."
    tags = len(re.findall(r"(?<![\w#])#\w", caption))
    if tags > HASHTAGS_MAX:
        return f"Хэштегов {tags}, Instagram разрешает не больше {HASHTAGS_MAX}."
    return None
