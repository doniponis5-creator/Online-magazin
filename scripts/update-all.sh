#!/usr/bin/env bash
#
# Обновить всё одной командой: сайт на сервере и приложение на iPhone.
#
#   bash scripts/update-all.sh
#
# Что делает по порядку:
#   1. Проверяет код (типы и тесты). Что-то не так — дальше не идёт.
#   2. Собирает архив сайта и обновляет smarket.kg. Перед этим спрашивает.
#   3. Пересобирает приложение и ставит на подключённый iPhone.
#
# Можно пропустить часть:
#   bash scripts/update-all.sh --only-site    только сайт
#   bash scripts/update-all.sh --only-phone   только телефон
#
# Сайт обновляется скриптом deploy/site/update_site.sh: он сам делает бэкап
# и сам возвращает прежнюю версию, если новая не поднялась.
#
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

SERVER="root@145.223.100.16"
DO_SITE=1
DO_PHONE=1

case "${1:-}" in
  --only-site)  DO_PHONE=0 ;;
  --only-phone) DO_SITE=0 ;;
  "")           ;;
  *) echo "Не понял «$1». Можно: --only-site, --only-phone или без ничего."; exit 1 ;;
esac

step() { echo; echo "════ $* ════════════════════════════════════"; }
fail() { echo; echo "❌ $*"; exit 1; }

# ── 1. Проверка кода ────────────────────────────────────────────────────────
step "1. Проверяю код"
npx tsc --noEmit || fail "в коде ошибка типов — на сервер и телефон не отправляю"
echo "✓ типы в порядке"
npx vitest run --reporter=dot || fail "тесты не прошли — на сервер и телефон не отправляю"
echo "✓ тесты прошли"

# ── 2. Сайт ─────────────────────────────────────────────────────────────────
if [ "$DO_SITE" = 1 ]; then
  step "2. Сайт smarket.kg"
  echo "Сейчас обновится РАБОЧИЙ сайт. Бэкап делается сам, откат тоже."
  printf "Обновляем? (да/нет): "
  read -r ANSWER
  case "$ANSWER" in
    да|ДА|Да|yes|y|ha|HA|Ha) ;;
    *) echo "Сайт не трогаю."; DO_SITE=0 ;;
  esac
fi

if [ "$DO_SITE" = 1 ]; then
  echo "── собираю архив ──"
  bash deploy/site/pack.sh || fail "архив не собрался"

  echo "── отправляю на сервер ──"
  scp -o ConnectTimeout=20 smartcentr-site.tar.gz deploy/site/update_site.sh "$SERVER:/tmp/" \
    || fail "не удалось отправить на сервер — проверьте интернет и ключ SSH"

  echo "── обновляю сайт ──"
  ssh -o ConnectTimeout=20 "$SERVER" "bash /tmp/update_site.sh" || fail "сайт не обновился"
fi

# ── 3. Телефон ──────────────────────────────────────────────────────────────
if [ "$DO_PHONE" = 1 ]; then
  step "3. Приложение на iPhone"
  # Оболочка приложения должна смотреть на живой сайт, а не на ноутбук:
  # с локальным адресом на телефоне ничего не откроется.
  if ! grep -q "url: 'https://smarket.kg'" capacitor.config.ts; then
    fail "в capacitor.config.ts стоит не https://smarket.kg — верните адрес и запустите снова"
  fi
  npx cap sync ios >/dev/null || fail "cap sync не прошёл"
  bash scripts/install-on-iphone.sh || fail "на телефон не поставилось"
fi

step "Готово"
[ "$DO_SITE" = 1 ]  && echo "• сайт smarket.kg обновлён"
[ "$DO_PHONE" = 1 ] && echo "• приложение на iPhone обновлено"
echo
echo "Что проверять на телефоне — docs/IPHONE_TEST_UZ.md"
