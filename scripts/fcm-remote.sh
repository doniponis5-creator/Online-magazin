#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════════
# Серверная часть setup-fcm.sh / setup-fcm.ps1. Сама по себе не запускается:
# ключ сервисного аккаунта Firebase приходит на stdin одной строкой base64,
# поэтому в этом файле секретов нет и в списке процессов ключ не виден.
#
# Порядок: сначала проверяем, что это настоящий ключ сервисного аккаунта,
# и только потом пишем его в .env.production (перед этим — резервная копия).
# Плохой ключ ничего не меняет. Повторный запуск заменяет строку, а не
# добавляет вторую.
#
# Отвечает одним словом: FCMOK — записано; NOENV — нет .env.production;
# BADJSON — не base64/не JSON; NOTSA — не ключ сервисного аккаунта;
# NOPY — нет python3; NOBAK — не вышло сделать резервную копию.
# Из самого ключа не печатается ничего.
#
# FCM_ENV_FILE — другой путь к .env (только для проверки на своём компьютере).
# ════════════════════════════════════════════════════════════════════════════
set -u
umask 077
ENV=${FCM_ENV_FILE:-/opt/sbonus/.env.production}

KEY_B64=""
read -r KEY_B64 || true
# PowerShell присылает строку с \r на конце; в base64 пробелов не бывает.
KEY_B64=$(printf '%s' "$KEY_B64" | tr -d '\r\t ')

[ -f "$ENV" ] || { echo NOENV; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo NOPY; exit 1; }

# Ключ идёт в python через stdin (printf — встроенная команда bash, в ps не видна).
# Читаем ровно как сервер при загрузке (shop_push_fcm.load_account): пробелы
# убираем, недостающие «=» дописываем, байты — строгий UTF-8. BOM в начале —
# ошибка, как и у сервера: иначе здесь было бы FCMOK, а Android молчал бы.
# Те же поля; сверх того — «PRIVATE KEY» в ключе: без него подписать нечем.
VERDICT=$(printf '%s' "$KEY_B64" | python3 -c '
import base64, json, sys
value = "".join(sys.stdin.read().split())
try:
    raw = base64.b64decode(value + "=" * (-len(value) % 4), validate=True)
    data = json.loads(raw.decode("utf-8"))
except Exception:
    data = None
if not isinstance(data, dict):
    print("BADJSON")
    sys.exit(0)
def text(k):
    v = data.get(k)
    return v.strip() if isinstance(v, str) else ""
ok = (data.get("type") == "service_account"
      and text("project_id") and text("client_email")
      and "PRIVATE KEY" in text("private_key"))
print("OK" if ok else "NOTSA")
' 2>/dev/null)

case "$VERDICT" in
    OK) : ;;
    NOTSA) echo NOTSA; exit 1 ;;
    *) echo BADJSON; exit 1 ;;
esac

cp -p "$ENV" "$ENV.bak_$(date +%Y%m%d_%H%M%S)" || { echo NOBAK; exit 1; }

# Старую строку ключа (и нашу подпись к ней) убираем, новую пишем в конец.
# Собираем во временном файле рядом, потом переписываем .env.production
# содержимым — сам файл остаётся тем же: права и владелец не меняются.
TMP=$(mktemp "$ENV.XXXXXX") || { echo NOBAK; exit 1; }
# В TMP — весь .env.production с ключом. Оборвалась связь, Ctrl+C — файл
# всё равно стираем. На сигнал именно выходим: иначе bash пошёл бы дальше,
# и «cat» без TMP обнулил бы .env.production.
trap 'rm -f "$TMP"' EXIT
trap 'exit 1' HUP INT TERM PIPE
grep -v -e '^FCM_SERVICE_ACCOUNT_B64=' -e '^# Firebase push:' "$ENV" > "$TMP"
{
    # Если последняя строка без перевода строки — добавим, чтобы не склеить.
    if [ -s "$TMP" ] && [ -n "$(tail -c 1 "$TMP")" ]; then echo; fi
    printf '# Firebase push: ключ сервисного аккаунта для уведомлений на Android\n'
    printf 'FCM_SERVICE_ACCOUNT_B64=%s\n' "$KEY_B64"
} >> "$TMP"
cat "$TMP" > "$ENV"
rm -f "$TMP"
KEY_B64=""
echo FCMOK
