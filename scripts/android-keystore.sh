#!/usr/bin/env bash
# Ключ подписи Android-приложения для Google Play. Запускается ОДИН раз.
#
# Что делает:
#   1. Спрашивает пароль (буквы на экране не видны).
#   2. Создаёт ключ ~/smarket-keys/smarket-upload.jks
#   3. Пишет android/keystore.properties — оттуда его берёт сборка.
#
# ВАЖНО. Этот ключ и пароль — навсегда. Потеряете — новую версию приложения
# в Google Play загрузить не выйдет, пока Google не заменит ключ (это долго).
# Скопируйте папку ~/smarket-keys на флешку и запишите пароль на бумаге.
# В git ключ не попадает.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
KEY_DIR="$HOME/smarket-keys"
KEY_FILE="$KEY_DIR/smarket-upload.jks"
PROPS="$ROOT/android/keystore.properties"
ALIAS="smarket-upload"

export JAVA_HOME="${JAVA_HOME:-/opt/homebrew/opt/openjdk@21}"
KEYTOOL="$JAVA_HOME/bin/keytool"

if [ -f "$KEY_FILE" ]; then
  echo "Ключ уже есть: $KEY_FILE"
  echo "Второй раз не создаю — старый ключ нужен для обновлений."
  exit 1
fi

read -r -s -p "Придумайте пароль ключа (не меньше 8 знаков): " PASS; echo
read -r -s -p "Повторите пароль: " PASS2; echo
if [ "$PASS" != "$PASS2" ]; then echo "Пароли не совпали. Запустите ещё раз."; exit 1; fi
if [ "${#PASS}" -lt 8 ]; then echo "Слишком короткий пароль."; exit 1; fi

mkdir -p "$KEY_DIR"
chmod 700 "$KEY_DIR"

# Пароль передаём через переменные окружения, а не в командной строке:
# так он не виден в списке процессов.
KS_PASS="$PASS" "$KEYTOOL" -genkeypair -v \
  -keystore "$KEY_FILE" \
  -storetype PKCS12 \
  -alias "$ALIAS" \
  -keyalg RSA -keysize 4096 -validity 10000 \
  -storepass:env KS_PASS -keypass:env KS_PASS \
  -dname "CN=S Market, O=Smart Centr, L=Bishkek, C=KG"

cat > "$PROPS" <<EOF
storeFile=$KEY_FILE
storePassword=$PASS
keyAlias=$ALIAS
keyPassword=$PASS
EOF
chmod 600 "$PROPS" "$KEY_FILE"

echo
echo "Готово. Ключ: $KEY_FILE"
echo "Сейчас же скопируйте папку $KEY_DIR на флешку и запишите пароль."
