"""
Картинки баннеров главной для 1С «Панель сайта» → «Баннеры»: компьютер 2400×1000 и телефон 1080×1080.

Запуск из корня проекта:
    python scripts/banners/make_banners.py                 — нарисовать все баннеры из BANNERS
    python scripts/banners/make_banners.py 3-kemal-usman   — только названные
Готовые картинки — review/banners/<имя>-desktop.jpg и <имя>-phone.jpg (в git не идут).

Оформление — как сайт (DESIGN.md): Manrope 800/600, графит #263244, лимон — только кнопка, фон — светлый,
большого чёрного поля нет. Текст только по-русски (владелец 07.10). Цен на картинке нет: картинка в 1С
не меняется, а цена меняется. Фото товаров — по коду 1С из открытого снимка каталога сайта
(https://smarket.kg/api/catalog/snapshot), так что работает на любом компьютере.

Новый баннер — строка в BANNERS: (имя, фон, плашка, заголовок, подпись, кнопка, картинка справа).
В заголовке «|» — свой перенос строки, «~» — пробел без переноса («Kemal~Usman» не рвётся).
Картинка справа: products([три кода 1С], badge="−%") — первый код крупнее; photo_visual(файл) — своё фото.
"""
import json
import sys
import urllib.request
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
ASSETS = Path(__file__).resolve().parent / "assets"
OUT = ROOT / "review" / "banners"
CACHE = OUT / "_photos"
F800 = str(ROOT / "public/fonts/manrope-800.ttf")
F600 = str(ROOT / "public/fonts/manrope-600.ttf")
SNAPSHOT = "https://smarket.kg/api/catalog/snapshot"

INK = (38, 50, 68)
SOFT = (75, 91, 112)
LEMON = (234, 245, 0)
WHITE = (255, 255, 255)
MIST = (227, 232, 238)
DANGER = (211, 59, 46)

# как slugFromCode в src/data/1c/adapter.ts: «ЦБ-00001234» → «cb-00001234»
TRANSLIT = dict(zip("абвгдеёзийклмнопрстуфхцыэңөү", "abvgdeezijklmnoprstufhcyenou"))
TRANSLIT.update({"ж": "zh", "ч": "ch", "ш": "sh", "щ": "sch", "ю": "yu", "я": "ya", "ъ": "", "ь": "", "й": "y"})
_catalog = []


def fetch(url):
    # Cloudflare перед smarket.kg отклоняет стандартную подпись Python (403) — представляемся как curl
    return urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "curl/8.9"}), timeout=60)


def slug(code):
    raw = "".join(TRANSLIT.get(ch, ch) for ch in code.lower())
    return "-".join(p for p in "".join(ch if ch.isascii() and ch.isalnum() else "-" for ch in raw).split("-") if p)


def catalog():
    """Товары сайта: id (= slug кода 1С), n — название, c — раздел, p — цена, o — старая цена, s — остаток, img."""
    if not _catalog:
        with fetch(SNAPSHOT) as r:
            _catalog.extend(json.load(r)["items"])
    return _catalog


def code_of(item_id):
    return "ЦБ-" + item_id[3:] if item_id.startswith("cb-") else item_id


def find(query, limit=12):
    """Товары, в названии или разделе которых есть все слова запроса: в наличии и со скидкой — первыми."""
    words = query.lower().split()
    hits = [i for i in catalog() if i.get("img") and all(w in f"{i['n']} {i['c']} {i.get('b', '')}".lower() for w in words)]
    hits.sort(key=lambda i: (-(i.get("s", 0) > 0), -bool(i.get("o")), -i["p"]))
    for i in hits[:limit]:
        old = f" (было {i['o']})" if i.get("o") else ""
        print(f"{code_of(i['id'])}  {i['n']}  · {i['c']} · {i['p']} сом{old} · остаток {i.get('s', 0)}")
    if not hits:
        print("ничего не нашлось — попробуйте другое слово")


def photo(code):
    """Главное фото товара по коду 1С (или slug «cb-…»); скачанное лежит в review/banners/_photos."""
    CACHE.mkdir(parents=True, exist_ok=True)
    cache = CACHE / f"{slug(code)}.jpg"
    if not cache.exists():
        url = next((i.get("img") for i in catalog() if i["id"] == slug(code)), None)
        if not url:
            sys.exit(f"товара {code} нет на сайте или у него нет фото — возьмите другой код (--find)")
        with fetch(url) as r:
            cache.write_bytes(r.read())
    return Image.open(cache).convert("RGB")


def font(path, size):
    return ImageFont.truetype(path, size)


def wrap(draw, text, fnt, width):
    """Перенос по словам; «|» — свой перенос, «~» — пробел без переноса."""
    lines = []
    for part in text.split("|"):
        line = ""
        for w in part.split():
            test = f"{line} {w}".strip()
            if not line or draw.textlength(test.replace("~", " "), font=fnt) <= width:
                line = test
            else:
                lines.append(line)
                line = w
        lines.append(line)
    return [l.replace("~", " ") for l in lines]


def card(img, size, radius):
    """Фото товара на белой карточке со скруглением и тонкой рамкой."""
    c = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size - 1, size - 1), radius, fill=255)
    base = Image.new("RGB", (size, size), WHITE)
    pad = int(size * 0.08)
    im = img.copy()
    im.thumbnail((size - 2 * pad, size - 2 * pad), Image.LANCZOS)
    base.paste(im, ((size - im.width) // 2, (size - im.height) // 2))
    c.paste(base, (0, 0), mask)
    ImageDraw.Draw(c).rounded_rectangle((0, 0, size - 1, size - 1), radius, outline=MIST, width=max(2, size // 160))
    return c


def pill(draw, xy, text, fnt, fill, color, pad_x, pad_y, radius=None, border=0):
    """Капсула (плашка) или кнопка: radius задан — прямоугольник со скруглением, как .btn на сайте (12 px)."""
    x, y = xy
    w = draw.textlength(text, font=fnt)
    asc, desc = fnt.getmetrics()
    h = asc + desc
    r = (h + 2 * pad_y) // 2 if radius is None else radius
    # border — белая рамка вокруг кнопки (владелец 08.10: лимон на светлом фоне «как кнопка» только с ней)
    draw.rounded_rectangle((x, y, x + w + 2 * pad_x, y + h + 2 * pad_y), r, fill=fill,
                           outline=WHITE if border else None, width=border or 1)
    draw.text((x + pad_x, y + pad_y), text, font=fnt, fill=color)
    return x + w + 2 * pad_x, y + h + 2 * pad_y


LAYOUT = {}  # где встала кнопка и низ содержимого — для товаров и знаков, которые рисуются после текста


def centered(img, bg, top, bottom):
    """Телефон: содержимое (от top до bottom) — посередине по высоте, а не прижато к верху с пустотой внизу."""
    shift = (img.height - (bottom - top)) // 2 - top
    if shift <= 0:
        return img
    out = Image.new("RGB", img.size, bg)
    out.paste(img.crop((0, 0, img.width, img.height - shift)), (0, shift))
    return out


def save(img, name, wide):
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / f"{name}-{'desktop' if wide else 'phone'}.jpg"
    img.save(path, "JPEG", quality=92, subsampling=0)
    return path


def banner(name, bg, chip, title, ky, cta, visual, w, h):
    """Текст слева (компьютер) или сверху (телефон), картинка — функцией visual."""
    if isinstance(visual, PhotoVisual) and w == h:
        return visual.phone(name, bg, title, ky, cta)
    img = Image.new("RGB", (w, h), bg)
    d = ImageDraw.Draw(img)
    wide = w > h
    k = w / 2400 if wide else w / 1080
    pad = int((140 if wide else 72) * (1 if wide else k))
    text_w = int(w * 0.44) if wide else w - 2 * pad
    if wide and isinstance(visual, PhotoVisual):
        text_w = 1100 - pad - 60  # фото встаёт с x=1100: заголовок не должен уйти под него («парфюмы» обрезались)
    # Размеры — как на сайте (DESIGN.md, владелец 08.10: «шрифт катта, стилимизга мос қил»). Баннер на компьютере
    # показывается ~1260 px из 2400 (×0,53): заголовок ~42 px, кнопка — 16 px текст, 50 px высота, скругление 12 px.
    f_chip, f_title, f_ky, f_cta = (font(F600, int(30 * k)), font(F800, int(80 * k)), font(F600, int(40 * k)),
                                    font(F800, int(32 * k))) if wide else (
        font(F600, 34), font(F800, 76), font(F600, 40), font(F800, 40))
    # длинный заголовок не должен столкнуть кнопку за край: уменьшаем, пока всё влезает
    while True:
        need = (len(wrap(d, title, f_title, text_w)) * f_title.size * 1.12
                + (len(wrap(d, ky, f_ky, text_w)) * f_ky.size * 1.3 if ky else 0))
        room = h * (0.50 if wide else 0.40)
        widest = max(d.textlength(l, font=f_title) for l in wrap(d, title, f_title, text_w))
        if (need <= room and widest <= text_w) or f_title.size < 60:
            break
        f_title = font(F800, int(f_title.size * 0.92))
    y = int(h * 0.15) if wide else 72
    if chip.strip():  # плашки может не быть — тогда заголовок сразу сверху
        _, y2 = pill(d, (pad, y), chip, f_chip, WHITE, INK, int(30 * (k if wide else 1)), int(17 * (k if wide else 1)))
        y = y2 + int(40 * (k if wide else 0.8))
    for line in wrap(d, title, f_title, text_w):
        d.text((pad, y), line, font=f_title, fill=INK)
        y += int(f_title.size * 1.12)
    if ky:
        y += int(14 * (k if wide else 1))
        for line in wrap(d, ky, f_ky, text_w):
            d.text((pad, y), line, font=f_ky, fill=SOFT)
            y += int(f_ky.size * 1.3)
    y += int(52 * (k if wide else 0.7))
    # кнопка как .btn сайта: прямоугольник со скруглением 12 px (на компьютере ×1/0,53 ≈ 23, на телефоне ×3 ≈ 36)
    _, cta_bottom = pill(d, (pad, y), cta, f_cta, LEMON, INK, int(46 * (k if wide else 0.9)), int(26 * (k if wide else 0.9)),
                         radius=int(23 * k) if wide else 36, border=int(6 * k) if wide else 6)
    if wide:
        # текст с кнопкой — посередине по высоте, как товары справа (раньше прижат к верху, внизу пусто)
        top = int(h * 0.15)
        dy = (h - (cta_bottom - top)) // 2 - top
        if dy > 0:
            left = img.crop((0, 0, pad + text_w + 20, h - dy))
            img.paste(Image.new("RGB", left.size, bg), (0, 0))
            img.paste(left, (0, dy))
            y, cta_bottom = y + dy, cta_bottom + dy
    LAYOUT.update(cta_top=y, cta_bottom=cta_bottom, bottom=cta_bottom)
    visual(img, wide, w, h, pad)
    if not wide:
        img = centered(img, bg, 72, LAYOUT["bottom"])
    return save(img, name, wide)


def products(codes, badge=None):
    """Три товара по кодам 1С: на компьютере одним рядом справа (первый крупнее), на телефоне — под кнопкой."""
    def draw(img, wide, w, h, pad):
        if wide:
            small, big, gap = 300, 380, 20
            x0 = w - pad - (2 * small + big + 2 * gap)
            mid = (h - big) // 2 + 40
            spots = [(x0, mid + big - small, small, codes[1]), (x0 + small + gap, mid, big, codes[0]),
                     (x0 + small + big + 2 * gap, mid + big - small, small, codes[2])]
            for x, y, size, code in spots:
                c = card(photo(code), size, 44)
                img.paste(c, (x, y), c)
            main = spots[1][:3]
        else:
            size, gap = 310, 20
            x0 = (w - 3 * size - 2 * gap) // 2
            top = LAYOUT["cta_bottom"] + 64
            for n, code in enumerate(codes):
                c = card(photo(code), size, 32)
                img.paste(c, (x0 + n * (size + gap), top), c)
            LAYOUT["bottom"] = top + size
            main = (x0, top, size)
        if badge:
            # наклейка на правом верхнем углу главной карточки, а не отдельно в углу баннера
            d = ImageDraw.Draw(img)
            f = font(F800, 72 if wide else 50)
            px_, py_ = (32, 14) if wide else (22, 10)
            tw = d.textlength(badge, font=f)
            bw, bh = tw + 2 * px_, f.size + 2 * py_ + 8
            mx, my, ms = main
            bx, by = mx + ms - bw * 0.7, my - bh * 0.35
            d.rounded_rectangle((bx, by, bx + bw, by + bh), 22 if wide else 16, fill=DANGER)
            d.text((bx + px_, by + py_), badge, font=f, fill=WHITE)
    return draw


def with_mark(visual, mark_file):
    """Знак партнёра на белой плашке: компьютер — вверху справа, телефон — справа от кнопки."""
    def draw(img, wide, w, h, pad):
        visual(img, wide, w, h, pad)
        mark = Image.open(ASSETS / mark_file).convert("RGBA")
        width = 420 if wide else 300
        mark = mark.resize((width, int(width * mark.height / mark.width)), Image.LANCZOS)
        plate = Image.new("RGBA", (mark.width + 60, mark.height + 40), (255, 255, 255, 255))
        pm = Image.new("L", plate.size, 0)
        ImageDraw.Draw(pm).rounded_rectangle((0, 0, plate.width - 1, plate.height - 1), 24, fill=255)
        plate.paste(mark, (30, 20), mark)
        pos = ((w - pad - plate.width, int(h * 0.06)) if wide else
               (w - 72 - plate.width, (LAYOUT["cta_top"] + LAYOUT["cta_bottom"] - plate.height) // 2))
        img.paste(plate, pos, pm)
    return draw


def photo_card(src, box, size, radius):
    """Кусок фото `box` (x0, y0, x1, y1 в пикселях источника) → карточка `size` со скруглением и рамкой."""
    im = src.crop(box).resize(size, Image.LANCZOS)
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), radius, fill=255)
    out = Image.new("RGBA", size, (0, 0, 0, 0))
    out.paste(im, (0, 0), mask)
    ImageDraw.Draw(out).rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), radius, outline=MIST, width=3)
    return out


class PhotoVisual:
    """Своё фото (≈ 3:2): компьютер — фото справа целиком; телефон — фото сверху (полоса от phone_top), текст под ним."""

    def __init__(self, file, phone_top=40):
        self.file, self.phone_top = file, phone_top

    def __call__(self, img, wide, w, h, pad):
        src = Image.open(ASSETS / self.file).convert("RGB")  # абсолютный путь ASSETS / не меняет
        cw = w - pad - 1100
        c = photo_card(src, (0, 0, src.width, src.height), (cw, int(cw * src.height / src.width)), 44)
        img.paste(c, (1100, (h - c.height) // 2), c)

    def phone(self, name, bg, title, ky, cta):
        w = h = 1080
        img = Image.new("RGB", (w, h), bg)
        d = ImageDraw.Draw(img)
        src = Image.open(ASSETS / self.file).convert("RGB")
        card_w, card_h = w - 2 * 72, 470
        crop_h = int(src.width * card_h / card_w)
        c = photo_card(src, (0, self.phone_top, src.width, self.phone_top + crop_h), (card_w, card_h), 32)
        img.paste(c, (72, 72), c)
        # каждая часть заголовка (до «|») — одной строкой: три строки сталкивали кнопку за нижний край
        size = 76
        while size > 56 and max(d.textlength(p.replace("~", " "), font=font(F800, size))
                                for p in title.split("|")) > w - 144:
            size -= 2
        title = "|".join(p.replace(" ", "~") for p in title.split("|"))
        f_title, f_ky, f_cta = font(F800, size), font(F600, 40), font(F800, 40)
        y = 72 + card_h + 44
        for line in wrap(d, title, f_title, w - 144):
            d.text((72, y), line, font=f_title, fill=INK)
            y += int(f_title.size * 1.12)
        if ky:
            y += 10
            d.text((72, y), ky, font=f_ky, fill=SOFT)
            y += int(f_ky.size * 1.3)
        y += 30
        _, bottom = pill(d, (72, y), cta, f_cta, LEMON, INK, 41, 24, radius=36, border=6)
        return save(centered(img, bg, 72, bottom), name, False)


def photo_visual(file, phone_top=40):
    return PhotoVisual(file, phone_top)


# Что стоит на сайте с 07.10.2026 (тот же порядок, что в 1С). «Куда ведёт» в 1С:
# 1 → /ru/catalog?inst=1 · 2 → Энергоснабжение (cat:power) · 3 → https://kemalusman.kg · 4 → /ru/catalog?sale=1
BANNERS = [
    ("1-rassrochka", (249, 251, 220), "Рассрочка «Адал» · MIslamic", "Техника в рассрочку|без~переплаты",
     "", "Выбрать технику  ›", with_mark(products(["ЦБ-00002385", "ЦБ-00002233", "ЦБ-00002232"]), "mislamic.png")),
    ("2-zima-ups", (234, 243, 255), "К зиме", "Свет~отключили~—|дома светло",
     "", "Инверторы и UPS  ›", products(["ЦБ-00002043", "ЦБ-00002055", "ЦБ-00002104"])),
    # фото — от владельца; «Ussman» на знаке исправлено на «Usman» (убрана одна «s»)
    ("3-kemal-usman", (246, 236, 226), "Наш второй магазин", "Оригинальные парфюмы|Kemal~Usman",
     "", "kemalusman.kg  ›", photo_visual("kemal-usman-photo.jpg")),
    ("4-skidki", (247, 249, 252), "Скидки недели", "Скидки на технику",
     "", "Все скидки  ›", products(["ЦБ-00002467", "ЦБ-00002468", "ЦБ-00002355"], badge="−%")),
]

BACKGROUNDS = {"lemon": (249, 251, 220), "blue": (234, 243, 255), "cream": (246, 236, 226),
               "grey": (247, 249, 252), "mint": (232, 246, 238), "rose": (250, 236, 238)}


def draw_all(items):
    for name, bg, chip, title, ky, cta, visual in items:
        for w, h in ((2400, 1000), (1080, 1080)):
            p = banner(name, bg, chip, title, ky, cta, visual, w, h)
            print(p.relative_to(ROOT), round(p.stat().st_size / 1024), "КБ")


if __name__ == "__main__":
    import argparse

    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(description="Баннеры главной: без ключей — все из BANNERS; имена — только они; "
                                             "--title … — новый баннер одной командой; --find — подобрать товары.")
    ap.add_argument("names", nargs="*", help="имена из BANNERS (1-rassrochka …)")
    ap.add_argument("--find", help="показать товары сайта по словам: «холодильник», «samsung телевизор»")
    ap.add_argument("--name", help="имя файла нового баннера (латиница): 5-holodilniki")
    ap.add_argument("--bg", default="grey", choices=sorted(BACKGROUNDS), help="фон")
    ap.add_argument("--chip", default="", help="плашка над заголовком: «Скидки недели»")
    ap.add_argument("--title", help="заголовок; «|» — перенос, «~» — пробел без переноса")
    ap.add_argument("--cta", help="текст кнопки (стрелка › добавится сама)")
    ap.add_argument("--codes", help="три кода 1С через запятую, первый — крупнее: ЦБ-00002385,ЦБ-00002233,ЦБ-00002232")
    ap.add_argument("--badge", default=None, help="наклейка на главном товаре: «−%%», «Хит», «Новинка»")
    ap.add_argument("--photo", help="своё фото (≈ 3:2) вместо товаров — путь к файлу")
    ap.add_argument("--phone-top", type=int, default=40, help="для --photo: с какой высоты фото резать полосу на телефоне")
    ap.add_argument("--mark", help="знак партнёра из scripts/banners/assets/ (mislamic.png)")
    a = ap.parse_args()
    if a.find:
        find(a.find)
    elif a.title:
        if not (a.name and a.cta and (a.codes or a.photo)):
            ap.error("для нового баннера нужны --name, --title, --cta и --codes или --photo")
        if a.photo:
            visual = photo_visual(str(Path(a.photo).resolve()), a.phone_top)
        else:
            codes = [c.strip() for c in a.codes.split(",") if c.strip()]
            if len(codes) != 3:
                ap.error("--codes: нужно ровно три кода")
            visual = products(codes, badge=a.badge)
        if a.mark:
            if a.photo:
                ap.error("--mark только вместе с --codes")
            visual = with_mark(visual, a.mark)
        draw_all([(a.name, BACKGROUNDS[a.bg], a.chip, a.title, "", f"{a.cta.rstrip(' ›')}  ›", visual)])
    else:
        draw_all([b for b in BANNERS if not a.names or b[0] in a.names])
