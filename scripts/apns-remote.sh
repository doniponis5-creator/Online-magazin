#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════════
# Серверная часть setup-apns.ps1. Сам по себе не запускается: ключ Apple и
# номера приходят на stdin, поэтому в этом файле секретов нет и в списке
# процессов они не видны.
#
# Порядок: сначала проверяем, что ключ похож на настоящий и читается, и только
# потом пишем его в .env.production. Плохой ключ ничего не меняет.
# ════════════════════════════════════════════════════════════════════════════
set -u
ENV=/opt/sbonus/.env.production

read -r KEY_B64
read -r KEY_ID
read -r TEAM_ID
read -r PRODUCTION || PRODUCTION=0

[ -f "$ENV" ] || { echo NOENV; exit 1; }

PEM=$(printf '%s' "$KEY_B64" | base64 -d 2>/dev/null)
case "$PEM" in
    *"BEGIN PRIVATE KEY"*) : ;;
    *) echo BADKEY; exit 1 ;;
esac

# Key ID и Team ID у Apple — ровно 10 знаков.
case "$KEY_ID" in [A-Za-z0-9][A-Za-z0-9][A-Za-z0-9][A-Za-z0-9][A-Za-z0-9][A-Za-z0-9][A-Za-z0-9][A-Za-z0-9][A-Za-z0-9][A-Za-z0-9]) : ;; *) echo BADID; exit 1 ;; esac
case "$TEAM_ID" in [A-Za-z0-9][A-Za-z0-9][A-Za-z0-9][A-Za-z0-9][A-Za-z0-9][A-Za-z0-9][A-Za-z0-9][A-Za-z0-9][A-Za-z0-9][A-Za-z0-9]) : ;; *) echo BADTEAM; exit 1 ;; esac

# В .env значение должно быть одной строкой: переносы пишем как \n,
# сервер разворачивает их обратно (shop_push.py).
ONELINE=$(printf '%s' "$PEM" | awk '{printf "%s\\n", $0}')

cp "$ENV" "$ENV.bak_$(date +%Y%m%d_%H%M%S)"
sed -i "/^APNS_KEY_P8=/d; /^APNS_KEY_ID=/d; /^APNS_TEAM_ID=/d; /^APNS_PRODUCTION=/d; /^APNS_BUNDLE_ID=/d" "$ENV"
{
    printf '\n# Apple push: уведомления в приложении для iPhone\n'
    printf 'APNS_KEY_P8=%s\n' "$ONELINE"
    printf 'APNS_KEY_ID=%s\n' "$KEY_ID"
    printf 'APNS_TEAM_ID=%s\n' "$TEAM_ID"
    printf 'APNS_BUNDLE_ID=kg.smarket.app\n'
    printf 'APNS_PRODUCTION=%s\n' "$PRODUCTION"
} >> "$ENV"
echo KEYOK
