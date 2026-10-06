"""
Описание и характеристики для сайта — пакетом в 1С (регистр ИМ_ТоварыСайта), через COM.

Владелец 06.10: «характеристикаси йўқ товарларни ҳаммасини тўғрилаб чиқ, интернетдан олиб».
Данные собраны из интернета (файл JSON), в 1С они ложатся туда же, куда их пишет карточка товара
(«Онлайн магазин» → товар → «Описание и характеристики для сайта»).

Правила — чтобы не испортить то, что вписал владелец:
  • описание пишется, только если в 1С его нет;
  • характеристики дописываются: строки, которые уже есть (по названию), не трогаются;
  • прочие поля записи (цена сайта, метки, гарантия, раздел) не меняются;
  • перед записью сохраняется копия прежних значений — откат одной командой.

Запуск:
  python fill_site_texts.py данные.json test            — показать, что изменится (ничего не пишет)
  python fill_site_texts.py данные.json test --apply    — записать в КОПИЮ базы
  python fill_site_texts.py данные.json prod --apply    — записать в РАБОЧУЮ базу (после проверки копии)
  python fill_site_texts.py --undo копия.json test|prod — вернуть прежние значения из копии

Формат данных: [{"code": "ЦБ-00001882", "name": "…", "description": "…", "specs": [["Объём", "1,7 л"], …]}, …]
«name» — название как на сайте: если в 1С под этим кодом другой товар, он пропускается.
"""

import datetime
import json
import sys
from pathlib import Path

from manage import BASES, LOGS, ask_credentials

REGISTER = "ИМ_ТоварыСайта"


def parse_specs(text):
    """«Название=Значение» по строке → список пар; строки без «=» сохраняются как есть (название пустое)."""
    rows = []
    for line in str(text or "").splitlines():
        line = line.strip()
        if not line:
            continue
        name, sep, value = line.partition("=")
        rows.append((name.strip(), value.strip()) if sep else ("", line))
    return rows


def specs_text(rows):
    return "\n".join(f"{name}={value}" if name else value for name, value in rows)


def merge(old_description, old_specs, item):
    """Что записать: (описание, характеристики, что изменилось). Владельца не перезаписываем."""
    changes = []
    description = old_description
    new_description = str(item.get("description") or "").strip()
    if not old_description.strip() and new_description:
        description = new_description
        changes.append("описание")

    rows = parse_specs(old_specs)
    have = {name.lower() for name, _ in rows if name}
    added = 0
    for pair in item.get("specs") or []:
        if not isinstance(pair, (list, tuple)) or len(pair) != 2:
            continue
        name, value = str(pair[0]).strip().replace("=", "-"), str(pair[1]).strip().replace("\n", " ")
        if not name or not value or name.lower() in have:
            continue
        rows.append((name, value))
        have.add(name.lower())
        added += 1
    if added:
        changes.append(f"характеристик: +{added}")
    return description, specs_text(rows) if added else old_specs, changes


def connect(base_key):
    import win32com.client

    user, password = ask_credentials(base_key)
    connector = win32com.client.Dispatch("V83.COMConnector")
    auth = f'Usr="{user}";' + (f'Pwd="{password}";' if password else "")
    return connector.Connect(f'File="{BASES[base_key]}";{auth}')


def same_name(a, b):
    """Название из файла и из 1С — одно и то же (без регистра, звёздочек и лишних пробелов)."""
    norm = lambda s: " ".join(str(s or "").replace("*", " ").replace("ё", "е").lower().split())
    return norm(a) == norm(b)


def find_item(session, code):
    ref = session.Справочники.Номенклатура.НайтиПоКоду(code)
    return None if ref is None or ref.Пустая() else ref


def read(session, ref):
    record = session.РегистрыСведений.ИМ_ТоварыСайта.СоздатьМенеджерЗаписи()
    record.Номенклатура = ref
    record.Прочитать()
    if record.Выбран():
        return record, str(record.Описание or "").strip(), str(record.Характеристики or "").strip()
    record = session.РегистрыСведений.ИМ_ТоварыСайта.СоздатьМенеджерЗаписи()
    record.Номенклатура = ref
    return record, "", ""


def fill(data_path, base_key, apply):
    items = json.loads(Path(data_path).read_text(encoding="utf-8-sig"))
    if base_key == "prod" and apply:
        answer = input(f"Записать описания и характеристики в РАБОЧУЮ базу ({len(items)} товаров)? Напишите да: ")
        if answer.strip().lower() not in ("да", "ha", "ҳа", "yes"):
            print("Отменено.")
            return
    session = connect(base_key)
    backup, missing, other, written = [], [], [], 0
    for item in items:
        code = str(item.get("code") or "").strip()
        ref = find_item(session, code) if code else None
        if ref is None:
            missing.append(code)
            continue
        # Защита: в старой копии базы тот же код может стоять у другого товара (карточку переименовали).
        # Название не совпало — этому товару ничего не пишем.
        if item.get("name") and not same_name(item["name"], ref.Наименование):
            other.append(f"{code} (в файле «{item['name']}», в 1С «{str(ref.Наименование).strip()}»)")
            continue
        record, old_description, old_specs = read(session, ref)
        description, specs, changes = merge(old_description, old_specs, item)
        if not changes:
            continue
        print(f"{code}  {str(ref.Наименование).strip()[:60]}: {', '.join(changes)}")
        if not apply:
            continue
        backup.append({"code": code, "description": old_description, "specs": old_specs})
        record.Описание = description
        record.Характеристики = specs
        record.Записать(True)
        written += 1

    if missing:
        print("Не найдены в 1С по коду:", ", ".join(missing))
    if other:
        print("Пропущены — под этим кодом в 1С другой товар:")
        for line in other:
            print("  " + line)
    if not apply:
        print("Это проверка — ничего не записано. Записать: добавьте --apply")
        return
    LOGS.mkdir(parents=True, exist_ok=True)
    stamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    path = LOGS / f"site_texts_backup_{base_key}_{stamp}.json"
    path.write_text(json.dumps(backup, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"Записано товаров: {written}. Прежние значения: {path}")


def undo(backup_path, base_key):
    items = json.loads(Path(backup_path).read_text(encoding="utf-8"))
    session = connect(base_key)
    for item in items:
        ref = find_item(session, item["code"])
        if ref is None:
            continue
        record, _, _ = read(session, ref)
        record.Описание = item["description"]
        record.Характеристики = item["specs"]
        record.Записать(True)
    print(f"Возвращено товаров: {len(items)}")


def main():
    args = [a for a in sys.argv[1:] if a != "--apply"]
    if len(args) >= 3 and args[0] == "--undo" and args[2] in BASES:
        undo(args[1], args[2])
        return
    if len(args) < 2 or args[1] not in BASES:
        print(__doc__)
        sys.exit(1)
    fill(args[0], args[1], "--apply" in sys.argv)


if __name__ == "__main__":
    main()
