#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════════
# Серверная часть scripts/setup-jev.sh: ключ Jev (OpenRouter или TypeSafe) —
# в /opt/smartcentr-site/.env.production, потом сайт перезапускается.
#
#   bash jev-remote.sh on   — ключ приходит в stdin одной строкой, на экран не выводится
#   bash jev-remote.sh off  — убрать ключ: бот снова понимает ответы только по спискам слов
#
# Ответ одним словом: JEVON | JEVOFF | NOENV | BADKEY | NOBAK | NOUP.
# Старый .env.production сохраняется рядом (.bak_jev_<время>).
# ════════════════════════════════════════════════════════════════════════════
set -u
ENV=/opt/smartcentr-site/.env.production
COMPOSE=/opt/smartcentr-site/deploy/site/docker-compose.yml
MODE="${1:-on}"

[ -f "$ENV" ] || { echo NOENV; exit 1; }

KEY=""
if [ "$MODE" = on ]; then
    IFS= read -r KEY || true
    KEY=$(printf '%s' "$KEY" | tr -d '\r\n\t ')
    [[ "$KEY" =~ ^[A-Za-z0-9_-]{20,200}$ ]] || { echo BADKEY; exit 1; }
fi

cp -p "$ENV" "$ENV.bak_jev_$(date +%Y%m%d_%H%M%S)" || { echo NOBAK; exit 1; }

TMP=$(mktemp "$ENV.XXXXXX") || { echo NOBAK; exit 1; }
trap 'rm -f "$TMP"' EXIT
trap 'exit 1' HUP INT TERM PIPE

grep -v -E '^JEV_API_KEY=' "$ENV" > "$TMP"
if [ "$MODE" = on ]; then
    printf 'JEV_API_KEY=%s\n' "$KEY" >> "$TMP"
fi
# cat, а не mv: у .env.production остаются прежние владелец и права.
cat "$TMP" > "$ENV"
KEY=""

# env_file читается только при создании контейнера — пересоздаём сайт.
docker compose -f "$COMPOSE" up -d --force-recreate site >/dev/null 2>&1 || { echo NOUP; exit 1; }
for _ in $(seq 1 30); do
    if curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:18820/api/site-settings | grep -q 200; then
        if [ "$MODE" = on ]; then echo JEVON; else echo JEVOFF; fi
        exit 0
    fi
    sleep 2
done
echo NOUP
exit 1
