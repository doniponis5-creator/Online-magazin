"""
Цена на сайте («ЦенаСайта» в 1С: Онлайн магазин → карточка товара) — сразу у нескольких товаров, по COM.
Меняется только цена для сайта (регистр ИМ_ТоварыСайта), цены магазина и кассы 1С не трогаются.

Запуск из корня проекта:
    python scripts/set_site_prices.py --test     — тестовая копия
    python scripts/set_site_prices.py            — РАБОЧАЯ база (перед записью спрашивает «да»; --yes — без вопроса)
Список — PRICES ниже: код 1С, слово из названия (защита от чужого товара), новая цена и старая (зачёркнутая).
Цена ниже себестоимости + 3% не ставится. Старые цены печатаются — по ним можно вернуть как было.
Пароль 1С — из .env.local (как у upload_banner.py), не из командной строки.
"""
import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "integrations" / "1c-online-shop"))

MIN_MARGIN = 0.03

# Швейные машины (владелец 10.10): приход в долларах с бумажки → сом по курсу НБКР, +20 %, на сайте −5 %.
# Старая цена (СтараяЦена) = приход × курс × 1,20, округлено до 100; цена на сайте — на 5 % ниже, до 10 сом.
# Сайт показывает старую зачёркнутой и «−5%».
RATE = 87.45  # USD → KGS, НБКР на 10.10.2026
MARKUP = 0.20
DISCOUNT = 0.05
USD = [  # код 1С, слово из названия, приход $
    ("ЦБ-00002529", "R1000", 335),
    ("ЦБ-00002519", "R4200", 480),
    ("ЦБ-00002274", "A2C", 350),
    ("ЦБ-00002516", "JS-1530D", 450),
    ("ЦБ-00000932", "JS-H1", 285),
    ("ЦБ-00000933", "JS-H2", 320),
    ("ЦБ-00001270", "E4-4", 450),
    ("ЦБ-00001328", "JS-H4", 400),
    ("ЦБ-00001946", "JS-H8", 325),
    ("ЦБ-00000992", "GT-282", 400),
    ("ЦБ-00000849", "Q5", 290),
    ("ЦБ-00000942", "X5", 420),
    ("ЦБ-00000456", "JANOME", 130),
    ("ЦБ-00000848", "DS-1SD", 65),
    ("ЦБ-00002518", "GT899D", 365),
    ("ЦБ-00002522", "S90D", 420),
    ("ЦБ-00002524", "GT-500D-01CB", 640),
    ("ЦБ-00002520", "P5", 620),
    ("ЦБ-00002517", "0303D", 500),
    ("ЦБ-00002531", "20U53", 400),
    ("ЦБ-00002528", "6390B", 480),
]


def from_usd(usd: float) -> tuple[int, int]:
    """Приход $ → (цена на сайте, старая цена), сом."""
    old = round(usd * RATE * (1 + MARKUP) / 100) * 100
    return round(old * (1 - DISCOUNT) / 10) * 10, old


# код 1С, слово из названия, цена на сайте, старая цена (None — старую не трогаем)
PRICES = [(code, model, *from_usd(usd)) for code, model, usd in USD]


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
    for code, model, price, strike in PRICES:
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
        old_strike = int(info.СтараяЦена or 0)
        if cost > 0 and price < cost * (1 + MIN_MARGIN):
            print(f"  ✗ {name}: {price} ниже себестоимости {cost:.0f} + 3% — пропуск")
            continue
        margin = f"{(price - cost) / price * 100:.0f}%" if cost > 0 else "себестоимость неизвестна"
        crossed = f", зачёркнутая {old_strike} → {strike}" if strike is not None else ""
        print(f"  • {name}: {old} → {price}{crossed}  (наценка {margin})")
        if old != price or (strike is not None and old_strike != strike):
            plan.append((ref, name, old, price, strike))

    if not plan:
        print("Менять нечего.")
        return
    if not a.yes and input(f"Записать {len(plan)} цен? да/нет: ").strip().lower() not in ("да", "yes", "y", "ха", "ҳа"):
        print("Отменено.")
        return

    for ref, name, old, price, strike in plan:
        # как кнопка «Записать» карточки товара: все настройки сайта, тексты и галочки — прежние,
        # меняются только цены; записи сайта у товара не было — она появится (раньше такой пропускался)
        info = s.ИМ_ОнлайнМагазинСервер.СведенияОТоваре(ref)
        info.ЦенаСайта = price
        if strike is not None:
            info.СтараяЦена = strike
        s.ИМ_ОнлайнМагазинСервер.ЗаписатьНастройки(ref, info)
        now = s.ИМ_ОнлайнМагазинСервер.СведенияОТоваре(ref)
        print(f"  ✓ {name}: {old} → {int(now.ЦенаСайта or 0)} (зачёркнутая {int(now.СтараяЦена or 0)})")
    print("Готово. На сайт уйдёт с ближайшей выгрузкой каталога (до 10 минут).")


if __name__ == "__main__":
    main()
