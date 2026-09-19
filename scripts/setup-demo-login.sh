#!/usr/bin/env bash
#
# Демонстрационный вход для проверяющего из Apple.
#
#   bash scripts/setup-demo-login.sh
#
# Зачем. Apple проверяет приложение вручную, из другой страны. Наш вход — код в
# Telegram на кыргызский номер: проверяющий такой код не получит, а значит не
# увидит ни бонусную карту, ни Face ID, ни уведомления — и вернёт приложение.
# Поэтому один номер входит по заранее известному коду.
#
# Этот номер живёт только на сайте: в SBonus его нет, бонусы ему не начисляются,
# в 1С он не попадает, бонусами платить он не может.
#
# Скрипт спрашивает номер и код, записывает их в настройки сайта на сервере и
# перезапускает сайт. Код вводится скрыто — на экране его не видно.
#
# После того как Apple одобрит приложение, демо-вход можно убрать:
#   bash scripts/setup-demo-login.sh --off
#
set -euo pipefail

SERVER="root@145.223.100.16"
ENV_FILE="/opt/smartcentr-site/.env.production"
COMPOSE="docker compose -f /opt/smartcentr-site/deploy/site/docker-compose.yml"

# ── Выключение ──────────────────────────────────────────────────────────────
if [ "${1:-}" = "--off" ]; then
  echo "Убираю демо-вход с сервера…"
  ssh -o ConnectTimeout=20 "$SERVER" \
    "sed -i '/^SITE_DEMO_/d' $ENV_FILE && $COMPOSE up -d site" \
    || { echo "Не получилось. Проверьте интернет."; exit 1; }
  echo "Готово: демо-входа больше нет."
  exit 0
fi

# ── Включение ───────────────────────────────────────────────────────────────
cat <<'MSG'
Демонстрационный вход для Apple.

Придумайте номер, которого НЕТ у настоящих покупателей — например
+996700000001. И четырёхзначный код, как при обычном входе.

Эти же номер и код вы впишете в App Store Connect:
  App Store Connect → ваше приложение → App Review Information →
  Sign-In Required → User Name / Password.

MSG

printf "Номер в виде +996XXXXXXXXX: "
read -r DEMO_PHONE
case "$DEMO_PHONE" in
  +996[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]) ;;
  *) echo "Номер должен быть ровно такого вида: +996700000001"; exit 1 ;;
esac

printf "Код из 4 цифр (вводится скрыто): "
stty -echo; read -r DEMO_CODE; stty echo; echo
case "$DEMO_CODE" in
  [0-9][0-9][0-9][0-9]) ;;
  *) echo "Код должен быть из 4 цифр."; exit 1 ;;
esac

echo
echo "Записываю на сервер…"
ssh -o ConnectTimeout=20 "$SERVER" "bash -s" <<EOF || { echo "Не получилось. Проверьте интернет."; exit 1; }
set -eu
sed -i '/^SITE_DEMO_/d' "$ENV_FILE"
{
  echo "SITE_DEMO_PHONE=$DEMO_PHONE"
  echo "SITE_DEMO_CODE=$DEMO_CODE"
  echo "SITE_DEMO_NAME=Apple Review"
  echo "SITE_DEMO_QR=SB-DEMO000001"
  echo "SITE_DEMO_BALANCE=1500"
} >> "$ENV_FILE"
$COMPOSE up -d site >/dev/null
EOF

echo "Жду, пока сайт поднимется…"
for i in $(seq 1 30); do
  sleep 2
  if ssh -o ConnectTimeout=20 "$SERVER" "curl -fs -o /dev/null http://127.0.0.1:18820/ru"; then
    echo "✓ сайт отвечает"
    break
  fi
done

echo
echo "Проверяю демо-вход…"
RESULT=$(curl -s -X POST https://smarket.kg/api/customer/verify \
  -H 'content-type: application/json' \
  -d "{\"phone\":\"$DEMO_PHONE\",\"code\":\"$DEMO_CODE\"}" || true)
case "$RESULT" in
  *'"ok":true'*) echo "✓ демо-вход работает" ;;
  *) echo "⚠ не сработал. Ответ сервера: $RESULT"; exit 1 ;;
esac

echo
echo "Готово. В App Store Connect впишите:"
echo "  User Name: $DEMO_PHONE"
echo "  Password:  тот код, что вы сейчас ввели"
