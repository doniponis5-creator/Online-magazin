"""
Справочник сёл и городов Кыргызстана для консультанта → src/lib/assistant/placesData.ts.

Владелец 08.10: бот не понимал, откуда покупатель («Кашка-Суудан», «Токмокко»), и не знал, везём ли туда.
Хватает уровня «село → район → область»: улица и дом нужны водителю, а не решению «везём или нет».

Обновить (раз в полгода или если покупатели называют село, которого нет):
    curl -s -A "smartcentr-places/1.0" --data-urlencode "data@scripts/places/kg-places.overpass" \
         https://overpass-api.de/api/interpreter -o kg-places.json        # ~5 МБ, 3–6 минут
    python scripts/places/build_places.py kg-places.json
    npx vitest run __tests__/places.test.ts

Данные — © участники OpenStreetMap, лицензия ODbL (openstreetmap.org/copyright).
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "src" / "lib" / "assistant" / "placesData.ts"

# Название села совпадает с обычным словом или именем («Алма», «Достук», «Султан»): «мен Айбике» или
# «түп нуска» не должны превращаться в адрес. Короче 4 букв не берём вовсе (Ош — отдельным правилом policy.ts).
STOP = {
    "1мая", "агартуу", "адыр", "алга", "алма", "алтын", "арал", "арка", "аюу", "бирдик", "бирлик", "бостон",
    "восток", "гроздь", "достук", "дружба", "жаштык", "жениш", "кайрат", "кольцо", "курулуш", "лесхоз",
    "майдан", "максат", "мурас", "октябрь", "правда", "рассвет", "спартак", "талаа", "тамаша", "тамга",
    "терек", "тынчтык", "учкун", "эркин", "чаек", "чолпон", "шекер", "ынтымак", "айбике", "акимбек", "атай",
    "балбай", "казыбек", "калыгул", "кошой", "мамажан", "осмон", "самат", "семетей", "султан", "шабдан",
    "шералы", "исакеев", "шопоков", "эшперов", "гагарин", "киров", "кирова", "чкалова", "токтоян", "нурдар",
    "искра", "майское", "ровное", "орток", "толук", "кенеш", "учар", "таян", "бакмал", "эпкин", "актилек",
    "манас", "тюп", "туп", "алмалуу", "кайнар", "жайыл", "кашка", "сыны", "калба", "кабык", "калдык", "калтак",
    "тосор", "кетерме", "куланак", "шагым", "чечме", "ташлак", "таштак", "кум", "сырт", "улук", "монок",
}
# Как говорят покупатели, а в OpenStreetMap записано иначе
ALIASES = {"Токмак": ["Токмок", "Tokmok"], "Кара-Балта": ["Карабалта"], "Джалал-Абад": ["Жалолобод", "Жалол-Обод"],
           "Узген": ["Узгон", "Озгон", "Озган", "Ўзган"], "Ноокат": ["Наукат"], "Кызыл-Кия": ["Кызыл-Кыя"],
           "Исфана": ["Раззаков"], "Бишкек": ["Фрунзе"], "Кара-Суу": ["Карасуу", "Корасув"], "Баткен": [],
           "Каракол": ["Пржевальск"], "Балыкчы": ["Рыбачье"]}


def key(text):
    """Как в placeKey (places.ts): строчные, кыргызские и узбекские буквы → русские, «дж» = «ж», без пробелов и дефисов."""
    t = text.lower().replace("ё", "е").replace("ң", "н").replace("ө", "о").replace("ү", "у").replace("ў", "у")
    t = t.replace("қ", "к").replace("ғ", "г").replace("ҳ", "х").replace("дж", "ж")
    return re.sub(r"[^a-zа-я]", "", t)


def main():
    src = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))["elements"]
    rows, cur = [], None
    for e in src:
        if e["type"] == "node":
            cur = {"tags": e["tags"], "adm": {}}
            rows.append(cur)
        elif cur is not None:
            t = e["tags"]
            cur["adm"][t.get("admin_level")] = t.get("name:ru") or t.get("name")

    districts, regions, places = [], [], []
    def idx(lst, v):
        if v not in lst:
            lst.append(v)
        return lst.index(v)

    for r in rows:
        t = r["tags"]
        name = t.get("name:ru") or t.get("name") or t.get("name:ky")
        if not name:
            continue
        spell = {name}
        for k in ("name", "name:ru", "name:ky", "name:en", "name:uz", "alt_name", "old_name", "alt_name:ru", "old_name:ru"):
            spell.update(s.strip() for s in t.get(k, "").split(";") if s.strip())
        spell.update(ALIASES.get(name, []))
        keys = sorted({key(s) for s in spell} - STOP)
        keys = [k for k in keys if len(k) >= 4]
        if not keys:
            continue
        region = r["adm"].get("4") or ""
        district = r["adm"].get("6") or ""
        places.append([name, idx(districts, district), idx(regions, region), t.get("place"), keys])

    places.sort(key=lambda p: p[0])
    body = (
        "/**\n * Сёла и города Кыргызстана: название → район → область. Собрано scripts/places/build_places.py\n"
        " * из OpenStreetMap (© участники OpenStreetMap, ODbL). Руками не править — пересобрать скриптом.\n */\n"
        "/* eslint-disable */\n"
        f"export const DISTRICTS: string[] = {json.dumps(districts, ensure_ascii=False)}\n"
        f"export const REGIONS: string[] = {json.dumps(regions, ensure_ascii=False)}\n"
        "/** [название, район, область, вид (city|town|village), как пишут — placeKey] */\n"
        "export const PLACES: [string, number, number, string, string[]][] = [\n"
        + "".join(f"  {json.dumps(p, ensure_ascii=False)},\n" for p in places)
        + "]\n"
    )
    OUT.write_text(body, encoding="utf-8")
    print(f"{OUT.relative_to(ROOT)}: сёл {len(places)}, районов {len(districts)}, областей {len(regions)}, "
          f"{OUT.stat().st_size // 1024} КБ")


if __name__ == "__main__":
    main()
