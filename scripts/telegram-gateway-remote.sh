#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════════
# Серверная часть setup-telegram-gateway.ps1. Сам по себе не запускается:
# токен и username канала приходят двумя строками на stdin, поэтому в этом
# файле секретов нет и в списке процессов они не видны.
#
# Порядок: сначала спрашиваем у Telegram, годится ли токен, и только если
# годится — пишем его в .env.production. Плохой токен ничего не меняет.
# Проверка бесплатна: номер заведомо несуществующий, доставить его нельзя.
# ════════════════════════════════════════════════════════════════════════════
set -u
ENV=/opt/sbonus/.env.production

read -r TOKEN
read -r SENDER || SENDER=""

[ -f "$ENV" ] || { echo NOENV; exit 1; }

CHECK=$(curl -s -m 20 -X POST https://gatewayapi.telegram.org/checkSendAbility \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"phone_number":"+999999999999"}')

case "$CHECK" in
    *ACCESS_TOKEN_INVALID*|*ACCESS_TOKEN_REQUIRED*) echo BADTOKEN; exit 1 ;;
    "") echo NOANSWER; exit 1 ;;
esac

cp "$ENV" "$ENV.bak_$(date +%Y%m%d_%H%M%S)"
sed -i "/^TELEGRAM_GATEWAY_TOKEN=/d; /^TELEGRAM_GATEWAY_SENDER=/d" "$ENV"
printf '\n# Telegram Gateway: коды входа на сайт\nTELEGRAM_GATEWAY_TOKEN=%s\nTELEGRAM_GATEWAY_SENDER=%s\n' \
    "$TOKEN" "$SENDER" >> "$ENV"
echo TOKENOK
