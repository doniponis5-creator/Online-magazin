#!/usr/bin/env bash
# Включить телеграм-бота на боевом сайте.
#
# Telegram будет приносить сообщения покупателей на https://smarket.kg/api/telegram/webhook
# и подписывать их условным словом из TELEGRAM_WEBHOOK_SECRET.
#
# Запускать НА СЕРВЕРЕ, где лежит /opt/smartcentr-site/.env.production:
#   bash scripts/telegram-webhook.sh
#
# Выключить бота: bash scripts/telegram-webhook.sh off
set -euo pipefail

ENV_FILE="${ENV_FILE:-.env.production}"
SITE_URL="${SITE_URL:-https://smarket.kg}"

[ -f "$ENV_FILE" ] || { echo "Нет файла $ENV_FILE"; exit 1; }
# shellcheck disable=SC1090
set -a; . "$ENV_FILE"; set +a

[ -n "${TELEGRAM_BOT_TOKEN:-}" ] || { echo "В $ENV_FILE нет TELEGRAM_BOT_TOKEN"; exit 1; }
[ -n "${TELEGRAM_WEBHOOK_SECRET:-}" ] || { echo "В $ENV_FILE нет TELEGRAM_WEBHOOK_SECRET"; exit 1; }

API="https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}"

if [ "${1:-on}" = "off" ]; then
  curl -sS -X POST "$API/deleteWebhook" -d drop_pending_updates=false
  echo; echo "Бот выключен: Telegram больше не шлёт сообщения на сайт."
  exit 0
fi

curl -sS -X POST "$API/setWebhook" \
  --data-urlencode "url=${SITE_URL}/api/telegram/webhook" \
  --data-urlencode "secret_token=${TELEGRAM_WEBHOOK_SECRET}" \
  --data-urlencode "allowed_updates=[\"message\"]"
echo
curl -sS "$API/getWebhookInfo"
echo
echo "Готово. Напишите боту в Telegram — он должен ответить."
