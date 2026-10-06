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


def story_url_of(message: dict) -> str:
    """Картинка истории, на которую ответили (её даёт сам webhook) — по ней узнаём товар истории, выложенной вручную."""
    reply_to = message.get("reply_to") or {}
    story = reply_to.get("story") if isinstance(reply_to, dict) else None
    url = str(story.get("url") or "") if isinstance(story, dict) else ""
    return url if url.startswith("https://") else ""


def seen_story_note(seen: str) -> str:
    """
    История выложена вручную (не из 1С) — что на ней, по картинке (05.10: на «9600 бу», «Ушул посудамойка»,
    «канча сом» к такой истории робот спрашивал «какой товар?», а покупатель обижался: «өзүңөр реклама кылып…»).
    """
    seen = seen.removeprefix("[Фото]").strip()
    return f"[Ответ на историю магазина. На истории: {seen[:400]}]" if seen else ""


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
            # Нажали готовый вопрос (ice breaker) — Meta шлёт postback, а не сообщение: читаем его текст
            # как сообщение покупателя («Баасы канча?»), робот отвечает как обычно.
            postback = item.get("postback")
            if isinstance(postback, dict) and not item.get("message"):
                sender = str((item.get("sender") or {}).get("id") or "")
                title = str(postback.get("title") or "").strip()
                ts = item.get("timestamp") or 0
                try:
                    ts = float(ts)
                except (TypeError, ValueError):
                    ts = 0.0
                if sender and title and not (own and sender == own):
                    found.append({
                        "kind": "in", "user": sender,
                        "mid": str(postback.get("mid") or f"pb:{sender}:{int(ts)}"),
                        "ts": ts / 1000 if ts > 10_000_000_000 else ts,
                        "text": title[:200], "context": [], "media": [], "story": "",
                    })
                continue
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
                "story_url": story_url_of(message),
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
# 06.10: «все товары по очереди» — 11 историй в день (10:00–20:00) плюс 4 по меткам; у Instagram предел 100 в сутки
STORIES_PER_DAY = 20
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


# Метки товара из 1С (карточка товара: «Товар дня», «Скидка», «Хит», «Специально для вас», «Новинка»)
# и метка на картинке. Порядок — что важнее показать, если меток несколько.
MARKS = ("deal", "sale", "hit", "foryou", "new")


def image_kind(kind: str, marks) -> str:
    """
    Какая метка на картинке. Шаблон из 1С («Скидка», «Новинка») или слот авто-истории
    («deal», «hit», «foryou») — его метка; «свой текст» — самая важная метка товара, нет меток — без метки.
    """
    if kind in MARKS:
        return kind
    for mark in MARKS:
        if mark in marks:
            return mark
    return "plain"


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


# ── Ответ на нашу историю и статус WhatsApp (04.10) ───────────────────────────
# Ссылку-стикер Instagram через программу не даёт, поэтому на истории — «ответьте, пришлём ссылку»,
# и первый ответ на короткое «Канча?» — шаблоном, без Gemini: товар истории известен.

STORY_QUICK_MAX = 60              # короче — шаблон с фото и ссылкой; длиннее (вопрос) — отвечает Gemini


def talk_lang(text: str) -> str:
    """Язык покупателя по буквам и частым словам: ky | uz | ru. Не понять («+», «?») — кыргызский."""
    low = (text or "").lower()
    if re.search(r"[ңөү]", low) or re.search(r"(?<![а-я])(канча|баасы|барбы|бар|жок|кандай|салам)(?![а-я])", low):
        return "ky"
    if re.search(r"[ўқғҳ]", low) or re.search(r"(?<![а-я])(нархи|нечпул|борми|керак)(?![а-я])", low):
        return "uz"
    if re.search(r"(?<![а-я])(сколько|цена|стоит|есть|здравствуйте|добрый|можно)(?![а-я])", low):
        return "ru"
    return "ky"


def product_link(site: str, slug: str, lang: str) -> str:
    return f"{site.rstrip('/')}/{'ky' if lang == 'ky' else 'ru'}/product/{slug}"


def story_answer(lang: str, name: str, price: int, old: int, link: str) -> str:
    """Ответ на нашу историю: товар, цена, ссылка на сайт и вопрос — как первый ответ продавца."""
    if lang == "ru":
        was = f" (было {_som(old)})" if old > price else ""
        return f"Здравствуйте! {name} — {_som(price)}{was}.\nПосмотреть и заказать на сайте: {link}\nВы из какого города?"
    if lang == "uz":
        was = f" (олдин {_som(old)})" if old > price else ""
        return f"Ассалому алайкум! {name} — {_som(price)}{was}.\nСайтда кўриб, буюртма беришингиз мумкин: {link}\nҚайси шаҳардансиз?"
    was = f" (мурун {_som(old)})" if old > price else ""
    return f"Ассаламу алейкум! {name} — {_som(price)}{was}.\nСайттан көрүп, заказ берсеңиз болот: {link}\nКайсы шаардан болосуз?"


def wa_status_caption(name: str, price: int, old: int, link: str) -> str:
    """Подпись статуса WhatsApp: там ссылка нажимается — ведём прямо на страницу товара."""
    was = f" (мурун {_som(old)})" if old > price else ""
    return f"{name}\n{_som(price)}{was}\n\nСайттан көрүү · Смотреть на сайте:\n{link}"


# ── Готовые вопросы в Direct и карусель «Скидки недели» (04.10) ───────────────

# Покупатель впервые открывает Direct — Instagram показывает эти кнопки (ice breakers, не больше 4).
# Нажал — приходит postback с текстом вопроса (events() делает из него сообщение), отвечает робот.
ICE_BREAKERS = {
    "default": ["Баасы канча?", "Дарегиңиз кайда?", "Жеткирүү барбы?", "Насыяга алсам болобу?"],
    "ru_RU": ["Сколько стоит?", "Где вы находитесь?", "Есть доставка?", "Можно в рассрочку?"],
}


def ice_breakers_payload() -> dict:
    """Тело POST /me/messenger_profile: набор по умолчанию (кыргызский) и русский для русского Instagram."""
    return {
        "platform": "instagram",
        "ice_breakers": [
            {"locale": locale, "call_to_actions": [{"question": q, "payload": f"IB_{i}"} for i, q in enumerate(questions)]}
            for locale, questions in ICE_BREAKERS.items()
        ],
    }


CAROUSEL_MAX = 9                  # товаров в карусели: Instagram даёт 10 картинок, первая — обложка


def carousel_caption(rows: list[tuple[str, int, int]]) -> str:
    """Подпись карусели: каждый товар строкой с ценой — по ней робот комментариев найдёт товар по названию."""
    lines = ["🔥 Аптанын арзандатуулары · Скидки недели", ""]
    for name, price, old in rows:
        was = f" (мурун {_som(old)})" if old > price else ""
        # Без обратной косой внутри f-строки: на сервере Python 3.11.
        clean = re.sub(r"\s+", " ", name.replace("*", "")).strip()
        lines.append(f"• {clean} — {_som(price)}{was}")
    lines += [
        "",
        "Жылдырып көрүңүз 👉 · Листайте 👉",
        "✅ В наличии · Бар",
        "📩 Пишите в Direct · Директке жазыңыз",
        f"📞 WhatsApp: {SHOP_PHONE}",
        "🌐 smarket.kg",
        "",
        "#smartcentr #smarketkg #скидка #арзандатуу #ош #кыргызстан",
    ]
    return "\n".join(lines)


# ── Недельная статистика владельцу (shop_ig_stats.py, 04.10) ──────────────────

def _n(value) -> str:
    try:
        return f"{int(value):,}".replace(",", " ")
    except (TypeError, ValueError):
        return "—"


def _title(caption: str, limit: int = 48) -> str:
    """Первая осмысленная строка подписи: без эмодзи и хэштегов, коротко."""
    for line in (caption or "").split("\n"):
        line = re.sub(r"#\S+", "", line)
        line = re.sub(r"[^\w\s.,%()+−-]", "", line).strip(" ·-")
        line = re.sub(r"\s{2,}", " ", line)
        if len(line) >= 4:
            return line[:limit] + ("…" if len(line) > limit else "")
    return "Пост"


def sales_lines(sales: dict | None, dm: int) -> list[str]:
    """«Продажи из Instagram»: заказы в Direct, доля от написавших и посты, под которыми больше спрашивали."""
    if not sales:
        return []
    lines: list[str] = []
    orders = sales.get("orders")
    if orders is not None:
        made, paid = int(orders.get("made") or 0), int(orders.get("paid") or 0)
        paid_text = f" (оплатили {paid} — {_som(int(orders.get('sum') or 0))})" if paid else ""
        lines.append(f"🛒 Заказали в Direct через бота: {_n(made)}{paid_text}")
        if dm > 0:
            share = f"{made * 100 / dm:.1f}".replace(".", ",").replace(",0", "")
            lines.append(f"   из {_n(dm)} написавших — {share} %")
        lines.append("   (заказы на сайте по ссылке из Instagram сюда не входят)")
    top = [(caption, n) for caption, n in sales.get("top") or [] if n > 0]
    if top:
        lines += ["", "🎯 Больше всего спросили под публикацией:"]
        for caption, n in top:
            lines.append(f"• {_title(caption) if caption else 'Пост'} — {_n(n)} чел.")
    return lines


def week_report(period: str, account: dict, posts: list[dict], stories: list[dict], counts: dict,
                followers: tuple | None, problem: str = "", sales: dict | None = None) -> str:
    """Текст «Instagram за неделю» для WhatsApp владельца: цифры и лучшие публикации, без советов от модели."""
    lines = [f"📊 Instagram за неделю ({period})", "━━━━━━━━━━━━━━━━━━━"]
    if problem:
        lines += [f"⚠️ {problem}", ""]
    if account.get("reach") is not None:
        lines.append(f"👀 Охват — сколько людей видели магазин: {_n(account['reach'])}")
    if account.get("profile_views") is not None:
        lines.append(f"👤 Открыли профиль: {_n(account['profile_views'])}")
    if account.get("website_clicks") is not None:
        lines.append(f"🌐 Перешли на сайт из профиля: {_n(account['website_clicks'])}")
    if followers:
        now, before = followers
        delta = f" ({'+' if now - before >= 0 else ''}{now - before} за неделю)" if before is not None else ""
        lines.append(f"👥 Подписчиков: {_n(now)}{delta}")
    lines.append(f"💬 Написали в Direct: {_n(counts.get('dm', 0))} чел.")
    lines.append(f"↩️ Ответили на истории: {_n(counts.get('storyreply', 0))}")
    lines.append(f"🗨️ Комментариев разобрал робот: {_n(counts.get('comments', 0))}")
    selling = sales_lines(sales, int(counts.get("dm") or 0))
    if selling:
        lines += [""] + selling
    ranked = sorted(posts, key=lambda p: (p.get("reach") or 0, p.get("likes") or 0), reverse=True)[:3]
    if ranked:
        lines += ["", f"🏆 Лучшие посты (всего {len(posts)}):"]
        for p in ranked:
            reach = f"охват {_n(p['reach'])}, " if p.get("reach") is not None else ""
            lines.append(f"• {_title(p.get('caption') or '')} — {reach}❤ {_n(p.get('likes'))}, 💬 {_n(p.get('comments'))}")
    best = sorted(stories, key=lambda s: (s.get("reach") or 0), reverse=True)[:3]
    if best:
        lines += ["", f"📸 Лучшие истории (всего {len(stories)}):"]
        for s in best:
            lines.append(f"• {(s.get('name') or 'История')[:48]} — охват {_n(s.get('reach'))}, ответов {_n(s.get('replies'))}")
    if not posts and not stories:
        lines += ["", "Постов и историй за неделю не было."]
    return "\n".join(lines)


def place_answer(current: list[dict], asked: list[dict] | None, text: str) -> list[dict]:
    """
    Ответ — сразу после тех реплик, на которые он отвечал. Покупатель дописал, пока думал Gemini
    (05.10, Instagram после рилса): раньше ответ ложился в конец — «вопрос, вопрос, ответ», — и
    следующий запрос к сайту кончался репликой магазина. Gemini такое не принимает (400 «Requests
    ending with a model turn»), и второй вопрос оставался без ответа с тревогой владельцу.
    """
    turn = {"role": "assistant", "text": text[:800]}
    n = len(asked or [])
    if asked and len(current) > n and current[:n] == asked:
        return current[:n] + [turn] + current[n:]
    return current + [turn]


# Google перегружен (503 «high demand», 05.10) или молчит — это минуты. Покупателя не бросаем:
# вопрос возвращается в очередь, и cron спрашивает снова каждую минуту, до BUSY_RETRIES раз.
# Владельцу «консультант не отвечает» — только если и это не помогло.
BUSY_RETRIES = 5


def busy_retry(pending: dict | None, why) -> dict | None:
    """Запись очереди для следующей попытки или None — пробовать больше не нужно (ключ, норма) или хватит."""
    if pending is None or str(why or "") not in ("busy", "timeout"):
        return None
    tries = int(pending.get("retry") or 0)
    if tries >= BUSY_RETRIES:
        return None
    return {**pending, "retry": tries + 1}


def comment_turn(comment: str, caption: str) -> str:
    """
    Реплика покупателя для разговора в Direct, начатого с комментария: что написал и под каким постом.
    По ней модель понимает «вот эту», «баасы» — товар из подписи (05.10, рилс «Мини посудомойка»).
    """
    where = f"под постом «{_title(caption, 120)}»" if caption.strip() else "под постом"
    return f"[Комментарий {where}] {comment.strip()[:500]}"
