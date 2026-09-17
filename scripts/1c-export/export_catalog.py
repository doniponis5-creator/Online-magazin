"""
Выгрузка каталога из 1С (Смарт Центр) для сайта.

ТОЛЬКО ЧТЕНИЕ: скрипт выполняет запросы ВЫБРАТЬ и ничего не записывает в базу.
Себестоимость и закупочные цены НЕ выгружаются — файл публикуется на сайте.

Что берётся:
  • товары, остатки, группы, артикулы — из справочника и регистров 1С;
  • цена, старая цена, наличие, «Скрыть», «Распродажа», «Товар дня», «Хит», «Новинка» и фото —
    из расширения «Онлайн магазин» (ИМ_ТоварыСайта, ИМ_ФотоТоваров).
На сайт попадают товары, которые не скрыты и либо есть в наличии, либо настроены в расширении.

Запуск (Windows, нужен pywin32 и платформа 1С 8.3):
    python scripts/1c-export/export_catalog.py          — рабочая база
    python scripts/1c-export/export_catalog.py --test   — тестовая копия

Пароль пользователя 1С вводится вручную при запуске и нигде не сохраняется.
Результат: src/data/1c/catalog.json и фото в public/products/1c/
"""

import datetime
import getpass
import json
import re
import shutil
import sys
from pathlib import Path

import win32com.client

BASES = {
    "prod": r"D:\doonni\1С Предприятие\Базы\Смарт центр база",
    # тестовая копия с расширением «Онлайн магазин» (integrations/1c-online-shop/manage.py copy)
    "test": r"D:\doonni\1С Предприятие\Базы\Смарт центр база\OnlineShop_Extension\test_base",
}
BASE_KEY = "test" if "--test" in sys.argv else "prod"
BASE_PATH = BASES[BASE_KEY]
DEFAULT_USER = "Магазин SMART Центр"
PROJECT = Path(__file__).resolve().parents[2]
OUT_FILE = PROJECT / "src" / "data" / "1c" / "catalog.json"
PHOTO_DIR = PROJECT / "public" / "products" / "1c"
PHOTO_URL = "/products/1c"

# Поле «Марка» в базе не заполнено — бренд определяем по словам в названии.
KNOWN_BRANDS = [
    "MIDEA", "ТЕХНОМИР", "UAKEEN", "HANTAJI", "ARTEL", "VELBERG", "VELBURG", "SAMSUNG", "LEVO",
    "ASCO", "ASKO", "AVANGARD", "HISENSE", "TOEAR", "PHILIPS", "EMIN", "AVEST", "CHANGHONG",
    "ARNICA", "AUCMA", "ITIMAT", "FERRE", "REDMOND", "CHIGO", "BOSCH", "BEKO", "HITACHI",
    "ARSHIA", "BRUCE", "BRUSE", "BAOYU", "KUMTEL", "SHIVAKI", "ARISTON", "GEMEI", "LG", "XIAOMI",
    "TEFAL", "BRAUN", "ATLANT", "INDESIT", "HAIER", "GORENJE", "ELECTROLUX", "POLARIS",
    "SCARLETT", "VITEK", "TCL", "SONY", "PANASONIC", "SHARP", "KENWOOD", "DELONGHI", "FLAGMAN",
]


def connect():
    sys.path.insert(0, str(PROJECT / "scripts"))
    from local_env import onec_credentials  # логин и пароль из .env.local, иначе вопросом

    user, pwd = onec_credentials(DEFAULT_USER)
    connector = win32com.client.Dispatch("V83.COMConnector")
    return connector.Connect(f'File="{BASE_PATH}";Usr="{user}";Pwd="{pwd}";')


def run(v8, text, params=None):
    query = v8.NewObject("Запрос")
    query.Текст = text
    for name, value in (params or {}).items():
        query.УстановитьПараметр(name, value)
    return query.Выполнить().Выгрузить()


def s(value):
    return "" if value is None else str(value).strip()


def num(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def rows(table):
    cols = [table.Колонки.Получить(i).Имя for i in range(table.Колонки.Количество())]
    for i in range(table.Количество()):
        row = table.Получить(i)
        yield {c: row.Получить(idx) for idx, c in enumerate(cols)}


def detect_brand(*texts):
    words = set()
    for text in texts:
        words.update(w.upper() for w in re.findall(r"[A-Za-zА-Яа-яЁё]+", text or ""))
    brand = next((b for b in KNOWN_BRANDS if b in words), "")
    # на логотипе бренд пишется BRUCE, в названиях 1С встречается BRUSE
    return "BRUCE" if brand == "BRUSE" else brand


QUERY_ITEMS = """
ВЫБРАТЬ
    Н.Ссылка КАК Ссылка,
    Н.Код КАК Код,
    Н.Наименование КАК Наименование,
    Н.Артикул КАК Артикул,
    Н.Описание КАК Описание,
    ЕСТЬNULL(Н.Родитель.Наименование, "") КАК ГруппаТовара,
    ЕСТЬNULL(Н.Родитель.Родитель.Наименование, "") КАК ГруппаВерхняя,
    ЕСТЬNULL(Н.Марка.Наименование, "") КАК Марка,
    ЕСТЬNULL(Н.Производитель.Наименование, "") КАК Производитель,
    ЕСТЬNULL(Остатки.ВНаличии, 0) КАК Остаток
ИЗ
    Справочник.Номенклатура КАК Н
        ЛЕВОЕ СОЕДИНЕНИЕ (
            ВЫБРАТЬ
                ТовО.Номенклатура КАК Номенклатура,
                СУММА(ТовО.ВНаличииОстаток) КАК ВНаличии
            ИЗ
                РегистрНакопления.ТоварыНаСкладах.Остатки КАК ТовО
            СГРУППИРОВАТЬ ПО
                ТовО.Номенклатура
        ) КАК Остатки
        ПО Остатки.Номенклатура = Н.Ссылка
ГДЕ
    НЕ Н.ЭтоГруппа
    И НЕ Н.ПометкаУдаления
    И Н.ТипНоменклатуры = ЗНАЧЕНИЕ(Перечисление.ТипыНоменклатуры.Товар)
"""

QUERY_SETTINGS = """
ВЫБРАТЬ
    Н.Номенклатура КАК Номенклатура,
    Н.Скрыть КАК Скрыть,
    Н.Наличие КАК Наличие,
    Н.ЦенаСайта КАК ЦенаСайта,
    Н.СтараяЦена КАК СтараяЦена,
    Н.Распродажа КАК Распродажа,
    Н.ТоварДня КАК ТоварДня,
    Н.Хит КАК Хит,
    Н.Новинка КАК Новинка,
    Н.СтоимостьДоставки КАК СтоимостьДоставки
ИЗ
    РегистрСведений.ИМ_ТоварыСайта КАК Н
"""

QUERY_PHOTOS = """
ВЫБРАТЬ
    Ф.Номенклатура КАК Номенклатура,
    Ф.Номер КАК Номер,
    Ф.Главное КАК Главное,
    Ф.Картинка КАК Картинка
ИЗ
    РегистрСведений.ИМ_ФотоТоваров КАК Ф
УПОРЯДОЧИТЬ ПО
    Ф.Главное УБЫВ,
    Ф.Номер
"""


def load_settings(v8):
    try:
        table = run(v8, QUERY_SETTINGS)
    except Exception as error:
        print(f"  Расширение «Онлайн магазин» не найдено ({error.__class__.__name__}) — цены будут «по запросу».")
        return None
    settings = {}
    for r in rows(table):
        settings[s(v8.XMLString(r["Номенклатура"]))] = {
            "hidden": bool(r["Скрыть"]),
            "availability": s(r["Наличие"]) or "По остатку",
            "price": num(r["ЦенаСайта"]),
            "oldPrice": num(r["СтараяЦена"]),
            "sale": bool(r["Распродажа"]),
            "dealOfDay": bool(r["ТоварДня"]),
            "hit": bool(r["Хит"]),
            "isNew": bool(r["Новинка"]),
            "deliveryPrice": num(r["СтоимостьДоставки"]),
        }
    return settings


def export_photos(v8, wanted_ids):
    """Пишет JPEG из регистра фото в public/products/1c и возвращает {id товара: [адреса]}."""
    try:
        table = run(v8, QUERY_PHOTOS)
    except Exception:
        return {}
    if PHOTO_DIR.exists():
        shutil.rmtree(PHOTO_DIR)
    PHOTO_DIR.mkdir(parents=True, exist_ok=True)
    photos = {}
    for r in rows(table):
        ref_id = s(v8.XMLString(r["Номенклатура"]))
        if ref_id not in wanted_ids:
            continue
        data = r["Картинка"].Получить()
        if data is None:
            continue
        index = len(photos.get(ref_id, [])) + 1
        name = f"{ref_id}-{index}.jpg"
        data.Записать(str(PHOTO_DIR / name))
        photos.setdefault(ref_id, []).append(f"{PHOTO_URL}/{name}")
    return photos


def main():
    print(f"Подключение к базе 1С ({'ТЕСТОВАЯ КОПИЯ' if BASE_KEY == 'test' else 'рабочая база'}, только чтение)…")
    try:
        v8 = connect()
    except Exception as error:
        print(f"Не удалось подключиться: {error}")
        sys.exit(1)

    print("Читаю настройки сайта из расширения…")
    settings = load_settings(v8) or {}

    print("Читаю товары и остатки…")
    items = []
    for r in rows(run(v8, QUERY_ITEMS)):
        ref_id = s(v8.XMLString(r["Ссылка"]))
        own = settings.get(ref_id)
        stock = max(0.0, num(r["Остаток"]))
        if own and own["hidden"]:
            continue
        # без остатка показываем только товары, настроенные в расширении
        if stock <= 0 and not own:
            continue
        name = s(r["Наименование"])
        item = {
            "id": ref_id,
            "code": s(r["Код"]),
            "name": name,
            "article": s(r["Артикул"]),
            "description": s(r["Описание"]),
            "group": s(r["ГруппаТовара"]),
            "parentGroup": s(r["ГруппаВерхняя"]),
            "brand": s(r["Марка"]) or s(r["Производитель"]) or detect_brand(name, s(r["Артикул"])),
            "stock": stock,
            "availability": "По остатку",
            "price": 0,
        }
        if own:
            item.update({k: v for k, v in own.items() if k != "hidden"})
        items.append(item)

    print("Выгружаю фото…")
    photos = export_photos(v8, {i["id"] for i in items})
    for item in items:
        item["photos"] = photos.get(item["id"], [])

    result = {"exportedAt": datetime.datetime.now().isoformat(timespec="seconds"), "items": items}
    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    OUT_FILE.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")

    with_price = sum(1 for i in items if i["price"] > 0)
    with_photo = sum(1 for i in items if i["photos"])
    print("\nГотово.")
    print(f"  Товаров на сайте: {len(items)} (с ценой: {with_price}, с фото: {with_photo})")
    print(f"  Файл: {OUT_FILE}")
    print("  Перезапустите сайт или обновите страницу — товары появятся.")


if __name__ == "__main__":
    main()
