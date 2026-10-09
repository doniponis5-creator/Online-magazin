"""
Цена на сайте («ЦенаСайта» в 1С: Онлайн магазин → карточка товара) — сразу у нескольких товаров, по COM.
Меняется только цена для сайта (регистр ИМ_ТоварыСайта), цены магазина и кассы 1С не трогаются.

Запуск из корня проекта:
    python scripts/set_site_prices.py --test     — тестовая копия
    python scripts/set_site_prices.py            — РАБОЧАЯ база (перед записью спрашивает «да»; --yes — без вопроса)
Список — PRICES ниже: код 1С, слово из названия (защита от чужого товара), новая цена.
Цена ниже себестоимости + 3% не ставится. Старые цены печатаются — по ним можно вернуть как было.
Пароль 1С — из .env.local (как у upload_banner.py), не из командной строки.
"""
import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "integrations" / "1c-online-shop"))

MIN_MARGIN = 0.03

# «Лучшая цена» (09.10): пылесосы дешевле магазинов Бишкека (src/data/best-price.ts)
PRICES = [
    ("ЦБ-00002500", "VC5420NHTCG", 10_390),
    ("ЦБ-00001816", "VC73189NHTR", 12_290),
    ("ЦБ-00002501", "VC73189NHTB", 12_290),
    ("ЦБ-00002419", "VK69662N", 6_990),
    ("ЦБ-00001634", "SC20M2540JN", 9_890),
    ("00-00000007", "SC4520", 6_790),
    ("ЦБ-00002505", "VK89309H", 11_890),
    ("ЦБ-00002445", "FC9351", 15_390),
    ("ЦБ-00002503", "VK89609HQ", 14_190),
]


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--test", action="store_true", help="тестовая копия вместо рабочей базы")
    ap.add_argument("--yes", action="store_true", help="не спрашивать подтверждение")
    a = ap.parse_args()

    from fill_site_texts import connect, find_item

    base = "test" if a.test else "prod"
    s = connect(base)
    print(f"База: {'ТЕСТОВАЯ копия' if a.test else 'РАБОЧАЯ'}")

    plan = []
    for code, model, price in PRICES:
        ref = find_item(s, code)
        if ref is None:
            print(f"  ✗ {code}: нет в 1С — пропуск")
            continue
        name = str(ref.Наименование)
        if model.lower() not in name.lower():
            print(f"  ✗ {code}: «{name}» — не {model}, пропуск")
            continue
        info = s.ИМ_ОнлайнМагазинСервер.СведенияОТоваре(ref)
        old, cost = int(info.ЦенаСайта or 0), float(info.Себестоимость or 0)
        if cost > 0 and price < cost * (1 + MIN_MARGIN):
            print(f"  ✗ {name}: {price} ниже себестоимости {cost:.0f} + 3% — пропуск")
            continue
        margin = f"{(price - cost) / price * 100:.0f}%" if cost > 0 else "себестоимость неизвестна"
        print(f"  • {name}: {old} → {price}  (наценка {margin})")
        if old != price:
            plan.append((ref, name, old, price))

    if not plan:
        print("Менять нечего.")
        return
    if not a.yes and input(f"Записать {len(plan)} цен? да/нет: ").strip().lower() not in ("да", "yes", "y", "ха", "ҳа"):
        print("Отменено.")
        return

    for ref, name, old, price in plan:
        record = s.РегистрыСведений.ИМ_ТоварыСайта.СоздатьМенеджерЗаписи()
        record.Номенклатура = ref
        record.Прочитать()
        if not record.Выбран():
            print(f"  ✗ {name}: записи сайта нет — пропуск")
            continue
        record.ЦенаСайта = price
        record.ДатаИзменения = s.ТекущаяДатаСеанса()
        record.Записать()
        check = int(s.ИМ_ОнлайнМагазинСервер.СведенияОТоваре(ref).ЦенаСайта or 0)
        print(f"  ✓ {name}: {old} → {check}")
    print("Готово. На сайт уйдёт с ближайшей выгрузкой каталога (до 10 минут).")


if __name__ == "__main__":
    main()
