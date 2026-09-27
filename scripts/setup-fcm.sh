#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════════
# Файлы Firebase для push-уведомлений на Android — версия для Mac.
# То же, что scripts/setup-fcm.ps1 для Windows. Инструкция: docs/ANDROID_PUSH_UZ.md
#
# Запуск (Терминал, из папки проекта):
#   bash scripts/setup-fcm.sh           — проверить, отправить ключ, положить файл
#   bash scripts/setup-fcm.sh --check   — только проверить файлы: ничего не
#                                         отправляет и ничего не копирует
# Пути можно дать и сразу, по порядку:
#   bash scripts/setup-fcm.sh <google-services.json> <ключ …firebase-adminsdk….json>
#
# Нужны два файла из Firebase, скрипт сам ищет их в «Загрузках»:
#   • google-services.json — «паспорт» приложения, кладём в android/app/.
#     Не секрет: он и так лежит внутри каждой сборки для Google Play.
#   • ключ сервисного аккаунта (…firebase-adminsdk….json) — секрет. Уходит на
#     сервер через stdin: на экран не выводится, в списке процессов не виден.
# Пароль сервера спрашивает ssh; скрипт его не видит.
#
# Порядок «всё или ничего»: сначала проверяем оба файла, потом сервер пишет
# ключ, и только после его «FCMOK» кладём google-services.json в проект.
# Не тот файл — понятная строка, и нигде ничего не записано.
# ════════════════════════════════════════════════════════════════════════════
set -u
SERVER=root@145.223.100.16
PACKAGE=kg.smarket.app
HERE=$(cd "$(dirname "$0")" && pwd)
ROOT=$(cd "$HERE/.." && pwd)
REMOTE="$HERE/fcm-remote.sh"
DEST="$ROOT/android/app/google-services.json"

[ -f "$REMOTE" ] || { echo "Не найден $REMOTE — обновите проект из git."; exit 1; }

CHECK=0
GS=""
SA=""
for a in "$@"; do
    case "$a" in
        --check) CHECK=1 ;;
        *) if [ -z "$GS" ]; then GS="$a"; elif [ -z "$SA" ]; then SA="$a"; fi ;;
    esac
done

echo "Firebase push для Android — настройка"

# Самый свежий файл по шаблону в «Загрузках»: браузер при повторном
# скачивании пишет «google-services (1).json», и нужен последний.
newest() {
    ls -t "$HOME/Downloads"/$1 "$HOME/Загрузки"/$1 2>/dev/null | head -n 1
}

# Спросить файл: найденный берём по Enter, иначе — перетащить в Терминал.
# Ответ кладём в PICKED.
pick() {
    local found="$1" what="$2" answer=""
    if [ -n "$found" ]; then
        echo "Нашёл $what: $found"
        printf 'Использовать его? [Enter — да, или перетащите сюда другой файл]: '
        read -r answer
        # «да», «yes», «ha» и прочее согласие — это не путь, а «бери найденный».
        case "$answer" in
            ""|[дД][аА]*|[yY]*|[hH][aA]*|[oO][kK]*) answer="$found" ;;
        esac
    else
        printf 'Перетащите сюда %s и нажмите Enter: ' "$what"
        read -r answer
    fi
    # Перетаскивание в Терминал добавляет кавычки и экранирует пробелы
    PICKED=$(printf '%s' "$answer" | sed "s/^['\"]//; s/['\"]$//; s/\\\\ / /g")
    case "$PICKED" in "~/"*) PICKED="$HOME/${PICKED#\~/}" ;; esac
}

# 1. Два файла
if [ -z "$GS" ]; then
    pick "$(newest 'google-services*.json')" "файл google-services.json"
    GS="$PICKED"
fi
[ -f "$GS" ] || { echo "Файл не найден: $GS"; exit 1; }

if [ -z "$SA" ]; then
    pick "$(newest '*firebase-adminsdk*.json')" "ключ сервисного аккаунта (…firebase-adminsdk….json)"
    SA="$PICKED"
fi
[ -f "$SA" ] || { echo "Файл не найден: $SA"; exit 1; }

# 2. Проверка. python3 есть на любом Mac с Xcode. Он печатает только код и
# безобидные подробности (имя пакета, id проекта) — ключ не печатается никогда.
command -v python3 >/dev/null 2>&1 || {
    echo "Не найден python3 — он нужен, чтобы проверить файлы. Установите: xcode-select --install"
    exit 1
}
RESULT=$(python3 - "$GS" "$SA" "$PACKAGE" 2>/dev/null <<'PY'
import json, sys

gs_path, sa_path, package = sys.argv[1:4]


def load(path):
    try:
        with open(path, encoding="utf-8-sig") as f:
            data = json.load(f)
    except Exception:
        return None
    return data if isinstance(data, dict) else None


def done(code):
    print(code)
    sys.exit(0)


def text(value):
    return value.strip() if isinstance(value, str) else ""


gs = load(gs_path)
if gs is None:
    done("GS_JSON")
if gs.get("type") == "service_account":
    done("GS_IS_KEY")
info = gs.get("project_info") if isinstance(gs.get("project_info"), dict) else {}
clients = gs.get("client") if isinstance(gs.get("client"), list) else []
gs_project = text(info.get("project_id"))
if not gs_project or not clients:
    done("GS_BAD")
packages = []
for c in clients:
    try:
        name = text(c["client_info"]["android_client_info"]["package_name"])
    except (KeyError, TypeError):
        name = ""
    if name:
        packages.append(name)
if package not in packages:
    done("GS_NOPKG " + (", ".join(packages) or "пусто"))

sa = load(sa_path)
if sa is None:
    done("SA_JSON")
if "project_info" in sa and "client" in sa:
    done("SA_IS_GS")
if sa.get("type") != "service_account":
    done("SA_NOTSA")
for field in ("project_id", "private_key", "client_email"):
    if not text(sa.get(field)):
        done("SA_FIELD " + field)
if "PRIVATE KEY" not in sa["private_key"]:
    done("SA_FIELD private_key")
if text(sa["project_id"]) != gs_project:
    done("MISMATCH " + gs_project + " " + text(sa["project_id"]))
done("OK " + gs_project)
PY
)
CODE=${RESULT%% *}
DETAIL=""
case "$RESULT" in *" "*) DETAIL=${RESULT#* } ;; esac

NOTHING="Ничего не записано."
case "$CODE" in
    OK) echo "Оба файла подходят: проект Firebase «$DETAIL», приложение $PACKAGE." ;;
    GS_JSON)   echo "«$GS» не читается как JSON — это не google-services.json. Скачайте его в Firebase заново. $NOTHING"; exit 1 ;;
    GS_IS_KEY) echo "Файлы перепутаны: вместо google-services.json дан ключ сервисного аккаунта. $NOTHING"; exit 1 ;;
    GS_BAD)    echo "«$GS» не похож на google-services.json. Он скачивается в Firebase у Android-приложения (Настройки проекта → Ваши приложения). $NOTHING"; exit 1 ;;
    GS_NOPKG)  echo "В google-services.json нет приложения $PACKAGE (в файле: $DETAIL). Добавьте в Firebase Android-приложение с именем пакета $PACKAGE и скачайте файл заново. $NOTHING"; exit 1 ;;
    SA_JSON)   echo "Ключ «$SA» не читается как JSON. Создайте ключ заново: Сервисные аккаунты → Создать закрытый ключ. $NOTHING"; exit 1 ;;
    SA_IS_GS)  echo "Файлы перепутаны: вместо ключа сервисного аккаунта дан google-services.json. $NOTHING"; exit 1 ;;
    SA_NOTSA)  echo "Это не ключ сервисного аккаунта Firebase. Нужен файл …firebase-adminsdk….json: Настройки проекта → Сервисные аккаунты → Создать закрытый ключ. $NOTHING"; exit 1 ;;
    SA_FIELD)  echo "В ключе нет поля «$DETAIL» — файл неполный. Создайте ключ заново: Сервисные аккаунты → Создать закрытый ключ. $NOTHING"; exit 1 ;;
    MISMATCH)  echo "Файлы из разных проектов Firebase: google-services.json — «${DETAIL%% *}», ключ — «${DETAIL#* }». Скачайте оба в одном проекте. $NOTHING"; exit 1 ;;
    *)         echo "Не получилось проверить файлы. $NOTHING"; exit 1 ;;
esac

if [ "$CHECK" = 1 ]; then
    echo "Это была только проверка: на сервер ничего не отправлено, в проект ничего не скопировано."
    exit 0
fi

# 3. Ключ — на сервер. Идёт в base64 через stdin: в списке процессов его не видно.
KEY_B64=$(base64 < "$SA" | tr -d '\n')
TMP=$(mktemp)
tr -d '\r' < "$REMOTE" > "$TMP"

echo "Записываю ключ на сервер..."
scp -q "$TMP" "$SERVER:/tmp/fcm_setup.sh" || { rm -f "$TMP"; echo "Не удалось подключиться к серверу. $NOTHING"; exit 1; }
rm -f "$TMP"
ANSWER=$(printf '%s\n' "$KEY_B64" | ssh "$SERVER" 'bash /tmp/fcm_setup.sh; rm -f /tmp/fcm_setup.sh')
KEY_B64=""

case "$ANSWER" in
    *NOENV*)   echo "На сервере нет /opt/sbonus/.env.production — сначала нужен deploy_shop.sh. $NOTHING"; exit 1 ;;
    *BADJSON*) echo "Сервер не смог прочитать ключ — файл испортился по дороге. Запустите скрипт ещё раз. $NOTHING"; exit 1 ;;
    *NOTSA*)   echo "Сервер говорит: это не ключ сервисного аккаунта. $NOTHING"; exit 1 ;;
    *NOPY*)    echo "На сервере нет python3 — ключ нечем проверить. $NOTHING"; exit 1 ;;
    *NOBAK*)   echo "Сервер не смог сделать резервную копию .env.production. $NOTHING"; exit 1 ;;
    *FCMOK*)   ;;
    "")        echo "Сервер не ответил (связь оборвалась или не тот пароль). $NOTHING"; exit 1 ;;
    *)         echo "Непонятный ответ сервера: $ANSWER"; exit 1 ;;
esac
echo "Ключ Firebase записан на сервер (FCM_SERVICE_ACCOUNT_B64), старый .env.production сохранён рядом."

# 4. google-services.json — в Android-проект.
if cmp -s "$GS" "$DEST"; then
    echo "google-services.json уже лежит в android/app/ — тот же самый."
else
    cp "$GS" "$DEST" || { echo "Не удалось скопировать google-services.json в android/app/."; exit 1; }
    echo "google-services.json положен в android/app/."
fi

echo ""
echo "Готово. Ключ нигде не показывался и на этом компьютере не сохранён."
echo "Файл ключа из «Загрузок» можно удалить: он уже на сервере, а новый всегда можно создать в Firebase."
echo "google-services.json нужно сохранить в git (это не секрет) — напишите в чат «готово»"
echo "или сами: git add android/app/google-services.json && git commit -m \"android: google-services.json\""
echo "Дальше — три команды из docs/ANDROID_PUSH_UZ.md (раздел 6): сервер, сайт, Android."
