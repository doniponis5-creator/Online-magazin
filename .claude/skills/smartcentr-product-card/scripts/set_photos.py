"""Фото товара в РАБОЧУЮ 1С (регистр ИМ_ФотоТоваров) — как «Онлайн магазин → товар → Фото».

  python set_photos.py ЦБ-00001882 --name "Точное название в 1С" 1.jpg 2.png 3.webp            — проверка, ничего не пишет
  python set_photos.py ЦБ-00001882 --name "…" 1.jpg 2.jpg 3.jpg --apply                      — записать (у товара нет фото)
  python set_photos.py ЦБ-00001882 --name "…" … --apply --replace                            — заменить прежние фото

Картинки → JPEG не больше 1200×1200 (меньше не растягиваются), прозрачный фон → белый; первая — главная.
Готовые файлы — review/product-card/<код>/; прежние фото перед заменой — review/product-card/backups/<код>-<время>/.
Название не совпало с 1С (другой товар под кодом) — стоп. Описание, характеристики, цена, остаток не трогаются.
"""
import argparse
import sys
from datetime import datetime
from pathlib import Path

from PIL import Image

from _onec import connect

MAX_SIDE = 1200


def prepare(files, folder):
    folder.mkdir(parents=True, exist_ok=True)
    out = []
    for n, src in enumerate(files, 1):
        with Image.open(src) as im:
            im.load()
            if im.mode in ("RGBA", "LA", "P"):
                im = im.convert("RGBA")
                bg = Image.new("RGB", im.size, (255, 255, 255))
                bg.paste(im, mask=im.getchannel("A"))
                im = bg
            im = im.convert("RGB")
            im.thumbnail((MAX_SIDE, MAX_SIDE), Image.LANCZOS)
            path = folder / f"{n}.jpg"
            im.save(path, "JPEG", quality=90, optimize=True, progressive=True)
            out.append(path)
            print(f"{n}. {Path(src).name} → {path} {im.width}×{im.height} {path.stat().st_size // 1024} КБ")
    return out


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser()
    ap.add_argument("code")
    ap.add_argument("files", nargs="+")
    ap.add_argument("--name", required=True, help="название товара в 1С — защита от чужого кода")
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--replace", action="store_true", help="у товара уже есть фото — заменить их")
    a = ap.parse_args()
    if len(a.files) > 10:
        sys.exit("не больше 10 фото")

    root = Path.cwd()
    ready = prepare(a.files, root / "review" / "product-card" / a.code)

    v = connect()
    module = v.ИМ_ОнлайнМагазинСервер
    ref = v.Справочники.Номенклатура.НайтиПоКоду(a.code)
    if ref.Пустая():
        sys.exit(f"{a.code} в 1С нет")
    if str(ref.Наименование).strip() != a.name.strip():
        sys.exit(f"под {a.code} в 1С «{ref.Наименование}», а не «{a.name}» — стоп")
    old = module.ФотоТовара(ref)
    count = old.Количество()
    print(f"{a.code} «{ref.Наименование}»: сейчас фото {count}, будет {len(ready)}")
    if count and not a.replace:
        sys.exit("у товара уже есть фото — добавьте --replace, если их правда нужно заменить (прежние сохраню)")
    if not a.apply:
        print("Это проверка — ничего не записано. Записать: --apply")
        return

    if count:
        backup = root / "review" / "product-card" / "backups" / f"{a.code}-{datetime.now():%Y%m%d-%H%M%S}"
        backup.mkdir(parents=True, exist_ok=False)
        for i in range(count):
            row = old.Получить(i)
            row.ДвоичныеДанные.Записать(str(backup / f"{int(row.Номер)}{'-main' if row.Главное else ''}.jpg"))
        print(f"прежние фото: {backup}")

    photos = v.NewObject("Массив")
    for n, path in enumerate(ready):
        row = v.NewObject("Структура")
        row.Вставить("Главное", n == 0)
        row.Вставить("ДвоичныеДанные", v.NewObject("ДвоичныеДанные", str(path)))
        photos.Добавить(row)
    module.ЗаписатьФото(ref, photos)
    if module.ФотоТовара(ref).Количество() != len(ready):
        sys.exit("после записи фото не столько, сколько отправили — проверьте товар в 1С")
    print(f"записано фото: {len(ready)}. На сайт уйдут с каталогом (publish_catalog.py или само за 10 мин).")


if __name__ == "__main__":
    main()
