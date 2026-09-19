"""
Установка расширения «Онлайн магазин» (ИМ_ОнлайнМагазин) в 1С.

Порядок работы:
  python manage.py copy          — свежая копия рабочей базы для проверки (около 6.6 ГБ)
  python manage.py install test  — собрать и загрузить расширение в КОПИЮ базы
  python manage.py open test     — открыть копию базы в 1С и проверить раздел «Онлайн магазин»
  python manage.py try           — всё сразу: собрать, установить в копию и открыть её в 1С
  python manage.py install prod  — только после проверки: установить в РАБОЧУЮ базу

  В копии базы можно завести пользователя без пароля (например «Claude_Test», полные права)
  и устанавливать так: python manage.py install test --test-user "Claude_Test"

Пароль пользователя 1С вводится вручную и нигде не сохраняется.
Основная конфигурация не меняется: загружается только расширение ИМ_ОнлайнМагазин.
"""

import datetime
import getpass
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
EXE = Path(r"C:\Program Files\1cv8\8.3.27.1719\bin\1cv8.exe")
PROD = Path(r"D:\doonni\1С Предприятие\Базы\Смарт центр база")
WORK = PROD / "OnlineShop_Extension"
TEST = WORK / "test_base"
LOGS = WORK / "logs"
EXTENSION = "ИМ_ОнлайнМагазин"
DEFAULT_USER = "Магазин SMART Центр"
BASES = {"test": TEST, "prod": PROD}


TEST_USER_FLAG = "--test-user"


def ask_credentials(base_key):
    # Для тестовой копии можно указать пользователя без пароля: --test-user "Имя".
    # Такой пользователь создаётся только в копии базы, в рабочей базе режим запрещён.
    if TEST_USER_FLAG in sys.argv:
        if base_key != "test":
            print("Пользователь без пароля разрешён только для тестовой копии.")
            sys.exit(1)
        index = sys.argv.index(TEST_USER_FLAG)
        return sys.argv[index + 1], ""
    sys.path.insert(0, str(ROOT.parents[1] / "scripts"))
    from local_env import onec_credentials  # логин и пароль из .env.local, иначе вопросом

    return onec_credentials(DEFAULT_USER)


def read_log(path):
    if not path.exists():
        return ""
    raw = path.read_bytes()
    for encoding in ("utf-8-sig", "cp1251"):
        try:
            return raw.decode(encoding)
        except UnicodeDecodeError:
            continue
    return raw.decode("utf-8", errors="replace")


def designer(base, user, password, arguments, step):
    LOGS.mkdir(parents=True, exist_ok=True)
    stamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    log = LOGS / f"{stamp}_{step}.log"
    auth = ["/N", user] + (["/P", password] if password else [])
    command = [str(EXE), "DESIGNER", "/F", str(base), *auth,
               "/DisableStartupMessages", "/DisableStartupDialogs", "/Out", str(log), *arguments]
    print(f"\n>> {step}...")
    result = subprocess.run(command, check=False)
    output = read_log(log).strip()
    print(output or "(журнал пуст)")
    print(f"  код завершения: {result.returncode}  журнал: {log}")
    return result.returncode == 0


def detect_variant(base, user, password):
    """УТ или BAS — от этого зависят заимствованные языки в расширении.

    COM-подключение открывается в отдельном процессе и закрывается вместе с ним,
    чтобы база не оставалась занятой во время загрузки расширения.
    """
    child = subprocess.run(
        [sys.executable, str(Path(__file__)), "_detect", str(base)],
        input=f"{user}\n{password}\n", capture_output=True, text=True, encoding="utf-8", check=False,
    )
    print(child.stdout.strip())
    if child.returncode != 0:
        print("Не удалось подключиться к базе:", child.stderr.strip()[-800:])
        sys.exit(1)
    lines = child.stdout.strip().splitlines()
    variant = lines[-1].split("=", 1)[1]
    extensions = [e for e in lines[-2].split("=", 1)[1].split(",") if e]
    return variant, extensions


def _detect(base):
    import win32com.client

    sys.stdin.reconfigure(encoding="utf-8")
    user = sys.stdin.readline().rstrip("\n")
    password = sys.stdin.readline().rstrip("\n")

    connector = win32com.client.Dispatch("V83.COMConnector")
    auth = f'Usr="{user}";' + (f'Pwd="{password}";' if password else "")
    session = connector.Connect(f'File="{base}";{auth}')
    name = str(session.Метаданные.Имя)
    version = str(session.Метаданные.Версия)
    extensions = [str(e.Имя) for e in session.РасширенияКонфигурации.Получить()]
    print(f"Конфигурация: {name} {version}")
    print(f"Расширения в базе: {', '.join(extensions) or 'нет'}")
    print("EXTENSIONS=" + ",".join(extensions))
    print("VARIANT=" + ("bas" if name.upper().startswith("BAS") else "ut"))


def configure_extension(base, user, password, base_key):
    """После загрузки: выключить безопасный режим (нужен доступ к серверу заказов по HTTPS)
    и настроить обмен. Отдельный процесс, как и определение конфигурации.

    В копии базы обмен ВЫКЛЮЧАЕТСЯ. Копия смотрит на тот же боевой сервер SBonus,
    и включённый обмен уводил настоящие оплаченные заказы в копию: сервер помечал
    их как «проведены в 1С», а в рабочей базе документов не появлялось.
    """
    child = subprocess.run(
        [sys.executable, str(Path(__file__)), "_configure", str(base), base_key],
        input=f"{user}\n{password}\n", capture_output=True, text=True, encoding="utf-8", check=False,
    )
    print(child.stdout.strip())
    if child.returncode != 0:
        print("Не удалось настроить расширение:", child.stderr.strip()[-800:])
        return False
    return True


def _configure(base, base_key="test"):
    import win32com.client

    sys.stdin.reconfigure(encoding="utf-8")
    user = sys.stdin.readline().rstrip("\n")
    password = sys.stdin.readline().rstrip("\n")
    connector = win32com.client.Dispatch("V83.COMConnector")
    auth = f'Usr="{user}";' + (f'Pwd="{password}";' if password else "")
    session = connector.Connect(f'File="{base}";{auth}')
    live = base_key == "prod"

    for extension in session.РасширенияКонфигурации.Получить():
        if str(extension.Имя) != EXTENSION:
            continue
        try:
            session.Справочники.ВерсииРасширений.ОтключитьПредупрежденияБезопасности(extension)
        except Exception:
            pass
        extension.БезопасныйРежим = False
        extension.Записать()
        print("Расширение: безопасный режим выключен (нужен для связи с сервером заказов)")

    for name, seconds, title in (
        ("ИМ_ЗагрузкаЗаказовСайта", 300, "Загрузка заказов с сайта"),
        ("ИМ_ОтправкаКаталогаНаСайт", 600, "Отправка каталога на сайт"),
    ):
        meta = session.Метаданные.РегламентныеЗадания.Найти(name)
        if meta is None:
            continue
        job = session.РегламентныеЗадания.НайтиПредопределенное(meta)
        if job is None:
            continue
        schedule = session.NewObject("РасписаниеРегламентногоЗадания")
        schedule.ПериодПовтораДней = 1
        schedule.ПериодПовтораВТечениеДня = seconds
        job.Расписание = schedule
        job.Использование = live
        job.Записать()
        print(f"Регламентное задание «{title}»: "
              + (f"каждые {seconds // 60} мин" if live else "ВЫКЛЮЧЕНО (копия базы)"))

    # Копия не должна разговаривать с боевым сервером ни по расписанию, ни руками:
    # иначе оплаченный заказ уходит в копию, а в рабочей базе его нет.
    if not live:
        record = session.РегистрыСведений.ИМ_НастройкиМагазина.СоздатьМенеджерЗаписи()
        record.Ключ = "Основные"
        record.Прочитать()
        if record.Выбран() and record.Включено:
            record.Включено = False
            record.Записать()
            print("Обмен с сайтом в копии базы ВЫКЛЮЧЕН: копия не заберёт настоящие заказы")
        else:
            print("Обмен с сайтом в копии базы выключен")


def copy_base():
    source = PROD / "1Cv8.1CD"
    target = TEST / "1Cv8.1CD"
    free = shutil.disk_usage(PROD).free
    size = source.stat().st_size
    print(f"Копирую рабочую базу ({size / 1024**3:.1f} ГБ) в {TEST}")
    print("Лучше делать, когда в 1С никто не работает — иначе копия может быть неполной.")
    if free < size * 1.1:
        print(f"Мало места на диске: свободно {free / 1024**3:.1f} ГБ.")
        sys.exit(1)
    if target.exists():
        answer = input("Копия уже есть. Заменить её свежей? (да/нет) [нет]: ").strip().lower()
        if answer not in ("да", "ha", "yes", "y"):
            return
        shutil.rmtree(TEST)
    TEST.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, target)
    print("Копия готова.")


def install(base_key):
    base = BASES[base_key]
    if not (base / "1Cv8.1CD").exists():
        print(f"База не найдена: {base}. Сначала выполните: python manage.py copy")
        sys.exit(1)
    if base_key == "prod":
        print("ВНИМАНИЕ: установка в РАБОЧУЮ базу. Перед этим проверьте расширение на копии.")
        if input("Для продолжения напишите УСТАНОВИТЬ: ").strip() != "УСТАНОВИТЬ":
            print("Отменено.")
            return

    user, password = ask_credentials(base_key)
    variant, extensions = detect_variant(base, user, password)

    build = subprocess.run([sys.executable, str(ROOT / "build_extension.py"), variant], check=False)
    if build.returncode != 0:
        sys.exit(build.returncode)
    source = ROOT / "build" / variant

    if base_key == "prod" and EXTENSION in extensions:
        backup = WORK / "backups" / f"{EXTENSION}_{datetime.datetime.now():%Y%m%d_%H%M%S}.cfe"
        backup.parent.mkdir(parents=True, exist_ok=True)
        if not designer(base, user, password, ["/DumpCfg", str(backup), "-Extension", EXTENSION], "backup"):
            print("Не удалось сохранить резервную копию расширения — установка остановлена.")
            sys.exit(1)

    steps = [
        (["/LoadConfigFromFiles", str(source), "-Extension", EXTENSION], "load"),
        (["/UpdateDBCfg", "-Extension", EXTENSION], "update"),
        (["/CheckModules", "-ThinClient", "-Server", "-Extension", EXTENSION], "check"),
    ]
    for arguments, step in steps:
        if not designer(base, user, password, arguments, step):
            print(f"\nШаг «{step}» завершился с ошибкой. Скопируйте текст выше и отправьте его в чат.")
            sys.exit(1)
    configure_extension(base, user, password, base_key)
    print("\nГотово: расширение «Онлайн магазин» установлено.")
    print("Дальше в 1С: «Онлайн магазин» → «Настройки заказов с сайта» — заполнить организацию и склад.")
    if base_key == "test":
        print("Дальше: python manage.py open test")


def open_base(base_key):
    base = BASES[base_key]
    subprocess.Popen([str(EXE), "ENTERPRISE", "/F", str(base)])
    print("1С запускается. Войдите как обычно и откройте раздел «Онлайн магазин».")


def try_test():
    """Одной командой: собрать, установить в копию базы и открыть её в 1С.

    Обычный порядок проверки — install test, потом open test. Две команды подряд
    владелец набирает каждый раз, поэтому здесь они склеены. Если установка
    упадёт, install завершит процесс и 1С не откроется: смотреть нечего.
    """
    if not (TEST / "1Cv8.1CD").exists():
        print(f"Копии базы нет: {TEST}")
        print("Сначала сделайте копию (около 6.6 ГБ): python manage.py copy")
        sys.exit(1)
    install("test")
    open_base("test")


def main():
    sys.stdout.reconfigure(errors="replace")
    action = sys.argv[1] if len(sys.argv) > 1 else ""
    base_key = sys.argv[2] if len(sys.argv) > 2 else "test"
    if action == "_configure":
        sys.stdout.reconfigure(encoding="utf-8")
        _configure(sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else "test")
    elif action == "_detect":
        sys.stdout.reconfigure(encoding="utf-8")
        _detect(sys.argv[2])
    elif action == "copy":
        copy_base()
    elif action == "install" and base_key in BASES:
        install(base_key)
    elif action == "open" and base_key in BASES:
        open_base(base_key)
    elif action == "try":
        try_test()
    else:
        print(__doc__)


if __name__ == "__main__":
    main()
