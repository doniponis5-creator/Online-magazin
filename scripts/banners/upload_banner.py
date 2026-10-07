"""
Баннер в 1С → сервер → сайт: те же функции, что вкладка «Онлайн магазин → Панель сайта → Баннеры».

Запуск из корня проекта (картинки — review/banners/<имя>-desktop.jpg и -phone.jpg от make_banners.py):
    python scripts/banners/upload_banner.py --list                       — что стоит сейчас
    python scripts/banners/upload_banner.py 5-holodilniki --title "Холодильники со скидкой" --link Холодильники
    python scripts/banners/upload_banner.py 5-holodilniki --title "…" --link … --pos 1   — поставить первым
    python scripts/banners/upload_banner.py --off 3      — выключить баннер id 3 (не удаляя)
    python scripts/banners/upload_banner.py --remove 3   — удалить баннер id 3
По умолчанию — РАБОЧАЯ база (prod). --test — тестовая копия, но она смотрит на ТОТ ЖЕ боевой сервер: для проверки
скрипта её сначала перенаправляют на локальную заглушку. Перед изменением спрашивает «да»; --yes — без вопроса.

Баннер с тем же названием уже есть — меняются только его картинки (ссылка и место прежние).
Сервер удаляет всех, кого нет в присланном списке, поэтому список всегда отправляется целиком: прежние баннеры
со своими датами и включённостью + новый. Пароль 1С — из .env.local (scripts/local_env.py), не из командной строки.

«Куда ведёт» (--link): код товара ЦБ-00001882 · раздел «Холодильники» · страница /ru/catalog?sale=1 · https://…
"""
import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "integrations" / "1c-online-shop"))
OUT = ROOT / "review" / "banners"
MAX = 10


def server_link(link):
    """Как СсылкаДляСервера в 1С: код товара → product:, название раздела → cat:, адреса — как есть."""
    v = link.strip()
    if not v or v.startswith(("/", "https://", "product:", "cat:")):
        return v
    if v.upper().startswith("ЦБ-"):
        return "product:" + v.upper()
    if v.startswith("http://"):
        sys.exit("адрес сайта должен начинаться с https://")
    return "cat:" + v


def read(srv):
    answer = srv.БаннерыСайта()
    if answer is None:
        sys.exit("сервер не ответил — ничего не менял")
    lst = answer.Получить("banners")
    out = []
    for i in range(lst.Количество()):
        b = lst.Получить(i)
        img = {k: (None if b.Получить(k) is None else f'{int(b.Получить(k).Получить("w"))}x{int(b.Получить(k).Получить("h"))}')
               for k in ("desktop", "mobile")}
        out.append({"id": int(b.Получить("id")), "title": str(b.Получить("title")), "link": str(b.Получить("link")),
                    "active": bool(b.Получить("active")),
                    "starts": None if b.Получить("starts") is None else str(b.Получить("starts")),
                    "ends": None if b.Получить("ends") is None else str(b.Получить("ends")), **img})
    return out


def show(rows):
    for n, b in enumerate(rows, 1):
        when = f" · {b['starts'] or '…'}—{b['ends'] or '…'}" if b["starts"] or b["ends"] else ""
        print(f"{n}. id {b['id']} · {'вкл' if b['active'] else 'ВЫКЛ'} · {b['title']} → {b['link'] or '—'}"
              f" · компьютер {b['desktop'] or 'НЕТ'}, телефон {b['mobile'] or 'как компьютер'}{when}")


def save(s, srv, rows):
    items = s.NewObject("Массив")
    for b in rows:
        st = s.NewObject("Структура")
        for k in ("id", "title", "link", "active", "starts", "ends"):
            if b.get(k) is not None:  # пустую дату COM не передаёт — не пишем вовсе
                st.Вставить(k, b[k])
        items.Добавить(st)
    if srv.СохранитьБаннерыСайта(items) is None:
        sys.exit("сервер не принял список (ссылка или название?) — ничего не менял")
    return read(srv)


def ask(a, text):
    if not a.yes and input(f"{text} Напишите да: ").strip().lower() != "да":
        sys.exit("отменено")


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("name", nargs="?", help="имя картинок в review/banners (без -desktop.jpg)")
    ap.add_argument("--title", help="название баннера (подсказка на сайте)")
    ap.add_argument("--link", default="", help="куда ведёт")
    ap.add_argument("--pos", type=int, help="место в карусели, с 1 (по умолчанию — последним)")
    ap.add_argument("--list", action="store_true")
    ap.add_argument("--off", type=int, metavar="ID")
    ap.add_argument("--on", type=int, metavar="ID")
    ap.add_argument("--remove", type=int, metavar="ID")
    ap.add_argument("--test", action="store_true", help="тестовая копия вместо рабочей базы")
    ap.add_argument("--yes", action="store_true", help="не спрашивать подтверждение")
    a = ap.parse_args()

    if a.name:
        files = {k: OUT / f"{a.name}-{s}.jpg" for k, s in (("desktop", "desktop"), ("mobile", "phone"))}
        missing = [str(p) for p in files.values() if not p.exists()]
        if missing:
            sys.exit("нет картинок: " + ", ".join(missing) + " — сначала make_banners.py")
        if not a.title:
            sys.exit("нужно --title")

    from fill_site_texts import connect  # пароль — из .env.local или вопросом, как у manage.py

    base = "test" if a.test else "prod"
    s = connect(base)
    srv = s.ИМ_ЗаказыСайтаСервер
    rows = read(srv)
    print(f"База: {'ТЕСТОВАЯ копия' if a.test else 'РАБОЧАЯ'}. Сейчас баннеров: {len(rows)}")

    if a.off or a.on or a.remove:
        bid = a.off or a.on or a.remove
        hit = [b for b in rows if b["id"] == bid]
        if not hit:
            show(rows)
            sys.exit(f"баннера id {bid} нет")
        if a.remove:
            ask(a, f"Удалить «{hit[0]['title']}»?")
            rows = [b for b in rows if b["id"] != bid]
        else:
            ask(a, f"{'Выключить' if a.off else 'Включить'} «{hit[0]['title']}»?")
            hit[0]["active"] = bool(a.on)
        rows = save(s, srv, rows)
    elif a.name:
        same = [b for b in rows if b["title"].strip().lower() == a.title.strip().lower()]
        if same:
            target = same[0]
            ask(a, f"Заменить картинки баннера «{target['title']}» (id {target['id']})?")
        else:
            if len(rows) >= MAX:
                sys.exit(f"на сайте уже {MAX} баннеров — сначала уберите один (--remove ID)")
            new = {"id": 0, "title": a.title.strip(), "link": server_link(a.link), "active": True,
                   "starts": None, "ends": None}
            pos = len(rows) if not a.pos else max(0, min(len(rows), a.pos - 1))
            ask(a, f"Поставить на сайт баннер «{new['title']}» → {new['link'] or 'никуда'} на место {pos + 1}?")
            before = {b["id"] for b in rows}
            rows = save(s, srv, rows[:pos] + [new] + rows[pos:])
            target = next(b for b in rows if b["id"] not in before)
        for kind, path in files.items():
            data = s.NewObject("ДвоичныеДанные", str(path))
            if srv.ЗагрузитьКартинкуБаннера(target["id"], kind, data) is None:
                sys.exit(f"сервер не принял картинку {path.name} (размер или пропорции) — баннер id {target['id']} "
                         "стоит без неё: исправьте картинку и запустите ещё раз")
            print(f"картинка {path.name}: ok")
        rows = read(srv)

    show(rows)
    if a.name or a.off or a.on or a.remove:
        print("Сайт покажет изменения в течение минуты.")


if __name__ == "__main__":
    main()
