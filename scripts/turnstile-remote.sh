#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════════
# Серверная часть scripts/setup-turnstile.ps1: ключи Cloudflare Turnstile
# («Я не робот») — в /opt/smartcentr-site/.env.production, потом сайт
# перезапускается с новыми настройками.
#
#   bash turnstile-remote.sh on   — ключи приходят в stdin: две строки, сначала
#                                   Site Key, потом Secret Key; на экран не выводятся
#   bash turnstile-remote.sh off  — убрать ключи: проверка выключается, формы
#                                   работают как раньше (на случай, если что-то мешает)
#
# Ответ одним словом: TSON | TSOFF | NOENV | BADKEY | NOBAK | NOUP.
# Старый .env.production сохраняется рядом (.bak_turnstile_<время>).
# ════════════════════════════════════════════════════════════════════════════
set -u
ENV=/opt/smartcentr-site/.env.production
COMPOSE=/opt/smartcentr-site/deploy/site/docker-compose.yml
MODE="${1:-on}"

[ -f "$ENV" ] || { echo NOENV; exit 1; }

SITE=""
SECRET=""
if [ "$MODE" = on ]; then
    IFS= read -r SITE || true
    IFS= read -r SECRET || true
    SITE=$(printf '%s' "$SITE" | tr -d '\r\n\t ')
    SECRET=$(printf '%s' "$SECRET" | tr -d '\r\n\t ')
    # Ключи Turnstile выглядят как 0x4AAAA…; тестовые ключи Cloudflare — 1x…, 2x…
    [[ "$SITE" =~ ^[0-9]x[A-Za-z0-9_-]{16,}$ ]] || { echo BADKEY; exit 1; }
    [[ "$SECRET" =~ ^[0-9]x[A-Za-z0-9_-]{16,}$ ]] || { echo BADKEY; exit 1; }
fi

cp -p "$ENV" "$ENV.bak_turnstile_$(date +%Y%m%d_%H%M%S)" || { echo NOBAK; exit 1; }

# Временный файл с настройками — только на время работы: при обрыве связи
# trap его сотрёт. exit в trap сигналов нужен, чтобы после обрыва скрипт
# не дошёл до записи в .env.production.
TMP=$(mktemp "$ENV.XXXXXX") || { echo NOBAK; exit 1; }
trap 'rm -f "$TMP"' EXIT
trap 'exit 1' HUP INT TERM PIPE

grep -v -E '^TURNSTILE_(SITE|SECRET)_KEY=' "$ENV" > "$TMP"
if [ "$MODE" = on ]; then
    printf 'TURNSTILE_SITE_KEY=%s\nTURNSTILE_SECRET_KEY=%s\n' "$SITE" "$SECRET" >> "$TMP"
fi
# cat, а не mv: у .env.production остаются прежние владелец и права.
cat "$TMP" > "$ENV"
SITE=""
SECRET=""

# env_file читается только при создании контейнера — пересоздаём сайт.
docker compose -f "$COMPOSE" up -d --force-recreate site >/dev/null 2>&1 || { echo NOUP; exit 1; }
for _ in $(seq 1 30); do
    if curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:18820/api/site-settings | grep -q 200; then
        if [ "$MODE" = on ]; then echo TSON; else echo TSOFF; fi
        exit 0
    fi
    sleep 2
done
echo NOUP
exit 1
