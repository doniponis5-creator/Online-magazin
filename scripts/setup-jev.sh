#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════════
# Jev для консультанта: кладёт ключ на сервер сайта и перезапускает сайт.
# Jev читает короткий ответ покупателя на «Оформляем?» / «Позвонить?» —
# согласие, «потом», отказ и почему (src/lib/assistant/jev.ts).
#
# Запуск (Mac, из папки проекта):
#   bash scripts/setup-jev.sh        — ключ берётся из ~/.claude/jev.env
#                                      (строка JEV_API_KEY=…), иначе спросит без показа
#   bash scripts/setup-jev.sh off    — убрать ключ (бот работает как раньше)
#
# Ключ уходит на сервер через stdin и на экран не выводится.
# ════════════════════════════════════════════════════════════════════════════
set -u
SERVER=root@145.223.100.16
HERE="$(cd "$(dirname "$0")" && pwd)"
MODE="${1:-on}"

scp -q "$HERE/jev-remote.sh" "$SERVER:/tmp/jev-remote.sh" || { echo "Не удалось скопировать скрипт на сервер. Ничего не изменено."; exit 1; }

if [ "$MODE" = off ]; then
    RESULT=$(ssh "$SERVER" "bash /tmp/jev-remote.sh off; rm -f /tmp/jev-remote.sh")
else
    KEY=$(sed -n 's/^JEV_API_KEY=//p' ~/.claude/jev.env 2>/dev/null | head -1)
    if [ -z "$KEY" ]; then
        read -r -s -p "Ключ Jev (OpenRouter, начинается с sk-or-): " KEY
        echo
    fi
    RESULT=$(printf '%s\n' "$KEY" | ssh "$SERVER" "bash /tmp/jev-remote.sh on; rm -f /tmp/jev-remote.sh")
    KEY=""
fi

case "$RESULT" in
    *JEVON*)  echo "✓ Jev включён: бот понимает «да / потом / нет» и причину" ;;
    *JEVOFF*) echo "✓ Jev выключен: бот работает как раньше" ;;
    *BADKEY*) echo "❌ Ключ не похож на ключ OpenRouter/TypeSafe. Ничего не изменено." ; exit 1 ;;
    *NOENV*)  echo "❌ На сервере нет /opt/smartcentr-site/.env.production" ; exit 1 ;;
    *NOUP*)   echo "❌ Сайт не поднялся после перезапуска — проверьте: docker ps" ; exit 1 ;;
    *)        echo "❌ Неизвестный ответ сервера: $RESULT" ; exit 1 ;;
esac
