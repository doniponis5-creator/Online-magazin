#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════════
# Ключ Apple для push-уведомлений — версия для Mac.
# То же, что scripts/setup-apns.ps1 для Windows.
#
# Запуск (Терминал, из папки проекта):
#   bash scripts/setup-apns.sh
#
# Скрипт сам найдёт файл AuthKey_XXXXXXXXXX.p8 в «Загрузках» или спросит путь.
# Содержимое ключа на экран не выводится и здесь не сохраняется.
# Пароль сервера спрашивает ssh; скрипт его не видит.
# ════════════════════════════════════════════════════════════════════════════
set -u
SERVER=root@145.223.100.16
HERE=$(cd "$(dirname "$0")" && pwd)
REMOTE="$HERE/apns-remote.sh"

[ -f "$REMOTE" ] || { echo "Не найден $REMOTE — обновите проект из git."; exit 1; }

echo "Apple push — настройка ключа"

# 1. Файл ключа
KEY=""
for f in "$HOME/Downloads"/AuthKey_*.p8 "$HOME/Загрузки"/AuthKey_*.p8; do
    [ -f "$f" ] && KEY="$f" && break
done
if [ -n "$KEY" ]; then
    echo "Нашёл ключ: $KEY"
    printf 'Использовать его? [Enter — да, или впишите другой путь]: '
    read -r answer
    # «да», «yes», «ha» и прочее согласие — это не путь к файлу, а «бери найденный».
    case "$answer" in
        ""|[дД][аА]*|[yY]*|[hH][aA]*|[oO][kK]*) : ;;
        *) KEY="$answer" ;;
    esac
else
    printf 'Перетащите сюда файл AuthKey_XXXXXXXXXX.p8 и нажмите Enter: '
    read -r KEY
fi
# Перетаскивание в Терминал добавляет кавычки и экранирует пробелы
KEY=$(printf '%s' "$KEY" | sed "s/^['\"]//; s/['\"]$//; s/\\\\ / /g")
[ -f "$KEY" ] || { echo "Файл не найден: $KEY"; exit 1; }
grep -q "BEGIN PRIVATE KEY" "$KEY" || { echo "Это не похоже на ключ Apple (.p8)."; exit 1; }

# 2. Key ID берём из имени файла: Apple называет файл именно по нему.
# Спрашивать незачем — лишний вопрос это лишняя ошибка.
KEY_ID=$(basename "$KEY" | sed -n 's/^AuthKey_\(.*\)\.p8$/\1/p')
if [ ${#KEY_ID} -ne 10 ]; then
    printf 'Key ID (10 знаков, из имени файла AuthKey_XXXXXXXXXX.p8): '
    read -r KEY_ID
fi
echo "Key ID: $KEY_ID"

printf 'Team ID (10 знаков, справа вверху в кабинете Apple): '
read -r TEAM_ID
# Убираем всё лишнее: пробелы и скобки, если их скопировали вместе с номером.
KEY_ID=$(printf '%s' "$KEY_ID" | tr -d ' []')
TEAM_ID=$(printf '%s' "$TEAM_ID" | tr -d ' []')

if [ ${#KEY_ID} -ne 10 ] || [ ${#TEAM_ID} -ne 10 ]; then
    echo "Key ID и Team ID должны быть ровно по 10 знаков. Запустите скрипт заново."
    exit 1
fi

printf 'Приложение уже в App Store? [Enter — нет, «да» — да]: '
read -r inapp
PRODUCTION=0
case "$inapp" in [дД]*|[yY]*) PRODUCTION=1 ;; esac

# 3. Отправляем. Ключ идёт в base64 через stdin — в списке процессов его не видно.
KEY_B64=$(base64 < "$KEY" | tr -d '\n')
TMP=$(mktemp)
tr -d '\r' < "$REMOTE" > "$TMP"

echo "Записываю ключ на сервер..."
scp -q "$TMP" "$SERVER:/tmp/apns_setup.sh" || { rm -f "$TMP"; echo "Не удалось подключиться к серверу."; exit 1; }
rm -f "$TMP"
ANSWER=$(printf '%s\n%s\n%s\n%s\n' "$KEY_B64" "$KEY_ID" "$TEAM_ID" "$PRODUCTION" \
    | ssh "$SERVER" 'bash /tmp/apns_setup.sh; rm -f /tmp/apns_setup.sh')
KEY_B64=""

case "$ANSWER" in
    *NOENV*)    echo "На сервере нет /opt/sbonus/.env.production — сначала нужен deploy_shop.sh."; exit 1 ;;
    *BADKEY*)   echo "Сервер не смог прочитать ключ. Ничего не записано."; exit 1 ;;
    *BADID*)    echo "Key ID не подошёл. Ничего не записано."; exit 1 ;;
    *BADTEAM*)  echo "Team ID не подошёл. Ничего не записано."; exit 1 ;;
    *KEYOK*)    ;;
    *)          echo "Непонятный ответ сервера: $ANSWER"; exit 1 ;;
esac

echo "Готово: ключ Apple записан на сервер."
echo "Значение нигде не показывалось и на этом компьютере не сохранено."
echo "Сам файл .p8 сохраните у себя — Apple его второй раз не выдаёт."
echo "Напишите в чат «готово» — я установлю обновление сервера и проверю отправку."
