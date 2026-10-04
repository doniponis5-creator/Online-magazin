#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════════
# Серверная часть setup-instagram-token.ps1. Сам по себе не запускается:
# ключ приходит строкой на stdin, поэтому в этом файле секретов нет и в списке
# процессов ключ не виден.
#
# Порядок: сначала спрашиваем у Instagram, годится ли ключ (GET /me), и только если
# годится — пишем его в .env.production (с резервной копией) и перезапускаем API,
# чтобы робот и посты взяли новый ключ. Плохой ключ ничего не меняет.
# Ответ — одно слово: IGOK <ник> | NOENV | BADTOKEN | NOANSWER | NORESTART
# ════════════════════════════════════════════════════════════════════════════
set -u
ENV=/opt/sbonus/.env.production

read -r TOKEN

[ -f "$ENV" ] || { echo NOENV; exit 1; }

ME=$(curl -s -m 20 -H "Authorization: Bearer $TOKEN" \
    "https://graph.instagram.com/v23.0/me?fields=user_id,username")

case "$ME" in
    "") echo NOANSWER; exit 1 ;;
    *'"error"'*) echo BADTOKEN; exit 1 ;;
esac
NAME=$(printf '%s' "$ME" | sed -n 's/.*"username"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
[ -n "$NAME" ] || { echo BADTOKEN; exit 1; }

cp "$ENV" "$ENV.bak_$(date +%Y%m%d_%H%M%S)"
sed -i "/^IG_ACCESS_TOKEN=/d" "$ENV"
printf 'IG_ACCESS_TOKEN=%s\n' "$TOKEN" >> "$ENV"

# Новый ключ читается при запуске контейнера. Продлённый старый ключ в Redis (ig:token)
# робот сам перестанет брать: он помнит, от какого ключа из .env тот продлён.
if (cd /opt/sbonus && docker compose -f docker-compose.prod.yml up -d --no-deps --force-recreate api >/dev/null 2>&1); then
    echo "IGOK $NAME"
else
    echo NORESTART
fi
