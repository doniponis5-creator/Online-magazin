"""
Почему товара нет на сайте — только чтение, база 1С не меняется.

На сайт уходит товар, у которого есть остаток ИЛИ который настроен в «Онлайн
магазин», и который не скрыт. Купить можно, только если есть и цена.
Скрипт показывает по каждой группе: сколько товара на складе, сколько из него
скрыто, сколько без цены — и список того, что лежит на складе, но купить на
сайте нельзя. Этот список и надо разобрать в 1С.

Запуск:  python scripts/1c-export/check_catalog_gaps.py
Полный список: scripts/1c-export/output/catalog_gaps.csv (в git не попадает).
"""
import csv
import sys
from collections import defaultdict
from pathlib import Path

from export_catalog import connect, rows as table_rows, run, s, num

OUT = Path(__file__).resolve().parent / "output" / "catalog_gaps.csv"

QUERY = '''
ВЫБРАТЬ
    Н.Код КАК Код,
    Н.Наименование КАК Наименование,
    ЕСТЬNULL(Н.Родитель.Наименование, "") КАК Группа,
    ЕСТЬNULL(Н.Родитель.Родитель.Наименование, "") КАК ГруппаВерхняя,
    ЕСТЬNULL(О.ВНаличии, 0) КАК Остаток,
    ЕСТЬNULL(Т.Скрыть, ЛОЖЬ) КАК Скрыть,
    ЕСТЬNULL(Т.ЦенаСайта, 0) КАК ЦенаСайта,
    ЕСТЬNULL(Т.Наличие, "") КАК Наличие
ИЗ Справочник.Номенклатура КАК Н
    ЛЕВОЕ СОЕДИНЕНИЕ РегистрСведений.ИМ_ТоварыСайта КАК Т
    ПО Т.Номенклатура = Н.Ссылка
    ЛЕВОЕ СОЕДИНЕНИЕ (
        ВЫБРАТЬ Номенклатура, СУММА(ВНаличииОстаток) КАК ВНаличии
        ИЗ РегистрНакопления.ТоварыНаСкладах.Остатки
        СГРУППИРОВАТЬ ПО Номенклатура
    ) КАК О ПО О.Номенклатура = Н.Ссылка
ГДЕ НЕ Н.ЭтоГруппа И НЕ Н.ПометкаУдаления
    И Н.ТипНоменклатуры = ЗНАЧЕНИЕ(Перечисление.ТипыНоменклатуры.Товар)
    И (ЕСТЬNULL(О.ВНаличии, 0) > 0 ИЛИ НЕ Т.Номенклатура ЕСТЬ NULL)
'''


def reason(row) -> str:
    if row["hidden"]:
        return "скрыт с сайта"
    if row["price"] <= 0:
        return "нет цены на сайте"
    if row["availability"] == "Нет в наличии":
        return "стоит «Нет в наличии»"
    return ""


def main():
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    print("Читаю номенклатуру из рабочей 1С. База не меняется.")
    v8 = connect()
    table = run(v8, QUERY)
    rows = []
    for r in table_rows(table):
        rows.append({
            "code": s(r["Код"]), "name": s(r["Наименование"]),
            "group": " / ".join(x for x in (s(r["ГруппаВерхняя"]), s(r["Группа"])) if x) or "(без группы)",
            "stock": num(r["Остаток"]), "hidden": bool(r["Скрыть"]), "price": num(r["ЦенаСайта"]),
            "availability": s(r["Наличие"]) or "По остатку",
        })

    by_group = defaultdict(lambda: {"stock": 0, "hidden": 0, "noprice": 0, "sell": 0})
    gaps = []
    for row in rows:
        g = by_group[row["group"]]
        if row["stock"] > 0:
            g["stock"] += 1
        why = reason(row)
        if not why:
            g["sell"] += 1
        elif row["stock"] > 0:
            g["hidden" if why == "скрыт с сайта" else "noprice"] += 1
            gaps.append({**row, "why": why})

    print(f"\n{'Группа':45} {'на складе':>9} {'скрыто':>7} {'без цены':>9} {'продаётся':>10}")
    for name, g in sorted(by_group.items(), key=lambda x: -x[1]["stock"]):
        print(f"{name[:45]:45} {g['stock']:>9} {g['hidden']:>7} {g['noprice']:>9} {g['sell']:>10}")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(["Код", "Товар", "Группа", "Остаток", "Почему не продаётся"])
        for g in sorted(gaps, key=lambda x: (x["group"], x["name"])):
            w.writerow([g["code"], g["name"], g["group"], f"{g['stock']:.0f}", g["why"]])

    print(f"\nНа складе есть, а купить на сайте нельзя: {len(gaps)} товаров.")
    print(f"Список (открывается в Excel): {OUT}")


if __name__ == "__main__":
    main()
