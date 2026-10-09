"""
Галочка «Лучшая цена» в 1С (Онлайн магазин → карточка товара) — сразу у нескольких товаров, по COM.
Дальше владелец ставит и снимает её сам в карточке или в списке товаров (колонка «Лучш.»).

Запуск из корня проекта:
    python scripts/set_best_price.py --test      — тестовая копия
    python scripts/set_best_price.py             — РАБОЧАЯ база (спрашивает «да»; --yes — без вопроса)
    python scripts/set_best_price.py --off       — снять галочку у тех же товаров
Список — CODES ниже (код 1С и слово из названия — защита от чужого товара).
Пароль 1С — из .env.local (как у upload_banner.py), не из командной строки.
"""
import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "integrations" / "1c-online-shop"))

# Перенос списка с сайта в 1С (09.10): модели, у которых мы дешевле магазинов Бишкека
CODES = [
    ("ЦБ-00002246", "65NANO81"), ("ЦБ-00002376", "MF210W105"), ("ЦБ-00002472", "KFR-09AC-169"),
    ("ЦБ-00002385", "F2V3PS6W"), ("ЦБ-00001816", "VC73189NHTR"), ("ЦБ-00002487", "6401E"),
    ("ЦБ-00002506", "F2Y1WS3W"), ("ЦБ-00002500", "VC5420NHTCG"), ("ЦБ-00001447", "F2V5PS2S"),
    ("ЦБ-00001547", "MH60C785X"), ("ЦБ-00001634", "SC20M2540JN"), ("ЦБ-00001976", "MFO1610US40"),
    ("ЦБ-00002502", "VC73189NHTS"), ("ЦБ-00002501", "VC73189NHTB"), ("ЦБ-00002485", "F2Y1NS3W"),
    ("ЦБ-00002419", "VK69662N"), ("ЦБ-00002445", "FC9351"), ("ЦБ-00002503", "VK89609HQ"),
    ("ЦБ-00002412", "SC20M257AWR"), ("ЦБ-00000274", "VC20M253AWR"), ("ЦБ-00001892", "MM720C2MV-S"),
    ("ЦБ-00002482", "MJ-BL7001"), ("ЦБ-00001963", "MK-8015"),
]


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--test", action="store_true", help="тестовая копия вместо рабочей базы")
    ap.add_argument("--off", action="store_true", help="снять галочку")
    ap.add_argument("--yes", action="store_true", help="не спрашивать подтверждение")
    a = ap.parse_args()

    from fill_site_texts import connect, find_item

    s = connect("test" if a.test else "prod")
    print(f"База: {'ТЕСТОВАЯ копия' if a.test else 'РАБОЧАЯ'}")
    plan = []
    for code, model in CODES:
        ref = find_item(s, code)
        if ref is None:
            print(f"  ✗ {code}: нет в 1С — пропуск")
            continue
        name = str(ref.Наименование)
        if model.lower() not in name.lower():
            print(f"  ✗ {code}: «{name}» — не {model}, пропуск")
            continue
        plan.append((ref, name))
        print(f"  • {name}")
    if not plan:
        return
    verb = "Снять" if a.off else "Поставить"
    if not a.yes and input(f"{verb} «Лучшая цена» у {len(plan)} товаров? да/нет: ").strip().lower() not in ("да", "yes", "y", "ха", "ҳа"):
        print("Отменено.")
        return

    srv = s.ИМ_ОнлайнМагазинСервер
    for ref, name in plan:
        # Как кнопка «Записать» в карточке: прежние настройки товара (цена, «Хит», тексты) сохраняются
        info = srv.СведенияОТоваре(ref)
        info.ЛучшаяЦена = not a.off
        srv.ЗаписатьНастройки(ref, info)
        print(f"  ✓ {name}: {'да' if srv.СведенияОТоваре(ref).ЛучшаяЦена else 'нет'}")
    print("Готово. На сайт уйдёт с ближайшей выгрузкой каталога (до 10 минут).")


if __name__ == "__main__":
    main()
