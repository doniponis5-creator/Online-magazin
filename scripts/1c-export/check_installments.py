"""
Проверка остатков по рассрочке перед выкатом — ничего не меняет и никуда не отправляет.

Берёт снимок из КОПИИ базы 1С (та же функция расширения, что шлёт его на сервер),
считает так же, как будет считать сервер, и печатает итоги. Их нужно сверить с
1С: «Журнал платежей» → «К поступлению», операция «Расчеты с клиентами».

Запуск (сначала расширение в копию: python integrations/1c-online-shop/manage.py install test):
  python scripts/1c-export/check_installments.py
  python scripts/1c-export/check_installments.py 0554282123   — подробно по одному телефону

Полный снимок кладётся в scripts/1c-export/output/installments_check.json (в git не попадает).
"""
import json
import sys
from datetime import date
from pathlib import Path

import win32com.client

PROJECT = Path(__file__).resolve().parents[2]
BASE = Path(r"D:\doonni\1С Предприятие\Базы\Смарт центр база\OnlineShop_Extension\test_base")
DEFAULT_USER = "Магазин SMART Центр"
OUT = Path(__file__).resolve().parent / "output" / "installments_check.json"

sys.path.insert(0, str(PROJECT / "scripts"))
sys.path.insert(0, str(PROJECT / "integrations" / "sbonus-server" / "shop"))
from local_env import onec_credentials  # noqa: E402  логин и пароль из .env.local, иначе вопросом
from shop_installments_calc import build_rows, parse_phones  # noqa: E402  тот же расчёт, что на сервере


def som(value):
    return f"{value:,.0f}".replace(",", " ") + " сом"


def main():
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    print("Читаю рассрочку из КОПИИ базы 1С. База не меняется, на сервер ничего не уходит.")
    user, password = onec_credentials(DEFAULT_USER)
    connector = win32com.client.Dispatch("V83.COMConnector")
    auth = f'Usr="{user}";' + (f'Pwd="{password}";' if password else "")
    v8 = connector.Connect(f'File="{BASE}";{auth}')
    raw = str(v8.ИМ_ЗаказыСайтаСервер.РассрочкаДляСайтаJSON())
    clients = json.loads(raw)["clients"]

    rows = build_rows(clients)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"clients": clients, "byPhone": rows}, ensure_ascii=False, indent=1), encoding="utf-8")

    schedule_total = sum(p["sum"] for c in clients for i in c["items"] for p in i["schedule"])
    no_phone = [c["name"] for c in clients if not parse_phones(c.get("phones", ""))]
    print()
    print(f"Клиентов с долгом:        {len(clients)}")
    print(f"Всего к поступлению:      {som(schedule_total)}   ← сверить с итогом «К поступлению» в 1С")
    shared = [p for p, r in rows.items() if r.get("shared")]
    print(f"Телефонов с долгом:       {len(rows) - len(shared)}")
    print(f"Общих телефонов:          {len(shared)} (записаны у разных людей — чат по ним цифр не скажет)")
    print(f"Клиентов без телефона:    {len(no_phone)} (им чат ответит «позвоните в магазин»)")
    print(f"Сегодня (по Бишкеку):     {date.today():%d.%m.%Y}")

    wanted = sys.argv[1] if len(sys.argv) > 1 else ""
    if wanted:
        phones = parse_phones(wanted)
        summary = rows.get(phones[0]) if phones else None
        if summary and summary.get("shared"):
            print(f"\nТелефон {wanted}: общий, записан у разных клиентов — чат скажет «позвоните в магазин»")
            return
        print(f"\nТелефон {wanted}: " + ("долга нет" if not summary else ""))
        if summary:
            print(f"  остаток {som(summary['debt'])}, просрочено {som(summary['overdue'])}, "
                  f"ближайший платёж {som(summary['nextAmount'])} — {summary['nextDate'] or 'нет'}, "
                  f"месяцев {summary['monthsLeft']}")
            for p in summary["purchases"]:
                print(f"  • {p['doc']} от {p['date']}: осталось {som(p['left'])} из {som(p['total'])}")
        return

    print("\nПять самых больших долгов — сверьте с 1С:")
    biggest = sorted(clients, key=lambda c: -sum(p["sum"] for i in c["items"] for p in i["schedule"]))[:5]
    for c in biggest:
        debt = sum(p["sum"] for i in c["items"] for p in i["schedule"])
        print(f"  {c['name']}: {som(debt)}  тел.: {c.get('phones') or '—'}")
    print(f"\nПолный снимок: {OUT}")


if __name__ == "__main__":
    main()
