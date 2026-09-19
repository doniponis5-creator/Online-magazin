#!/usr/bin/env bash
#
# Поставить приложение «S Маркет» на настоящий iPhone, подключённый к MacBook.
#
# Зачем отдельный скрипт: в симуляторе нельзя проверить ни Face ID (он проходит
# сам собой), ни push от Apple (туда их не доставить). Настоящий телефон — это
# 7-й шаг из docs/IOS_APP_UZ.md.
#
# Запуск:   bash scripts/install-on-iphone.sh
#
# Что нужно заранее:
#   1. iPhone подключён кабелем, разблокирован, на вопрос «Доверять?» — «Доверять».
#   2. На iPhone включён режим разработчика:
#      Настройки → Конфиденциальность и безопасность → Режим разработчика → вкл,
#      затем телефон перезагрузится.
#   3. В Xcode один раз добавлен Apple ID владельца:
#      Xcode → Settings → Accounts → «+» → Apple ID.
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="$ROOT/ios/App"
SCHEME="App"
BUILD_DIR="$APP_DIR/build-device"

echo "── Ищу iPhone ──────────────────────────────────────────────────────"
# Спрашиваем сам Xcode, а не список «подключённых»: телефон может быть
# привязан по Wi-Fi, и тогда в списке USB-устройств его нет, а собрать и
# поставить на него всё равно можно.
DESTINATIONS="$(xcodebuild -project "$APP_DIR/App.xcodeproj" -scheme "$SCHEME" \
  -showdestinations 2>/dev/null || true)"

DEVICE_LINE="$(echo "$DESTINATIONS" \
  | grep -E "platform:iOS," \
  | grep -viE "Simulator|placeholder" \
  | head -1 || true)"

if [ -z "$DEVICE_LINE" ]; then
  cat <<'MSG'
iPhone не найден.

Проверьте по порядку:
  1. Телефон включён и разблокирован. Кабель воткнут — или телефон и MacBook
     в одной сети Wi-Fi, если привязка была по Wi-Fi.
  2. На телефоне нажали «Доверять этому компьютеру».
  3. Настройки → Конфиденциальность и безопасность → Режим разработчика → вкл.
     После включения телефон перезагружается.

Потом запустите скрипт ещё раз.
MSG
  exit 1
fi

# Строка вида: { platform:iOS, arch:arm64, id:00008150-…, name:IPhone 17 Pro Max }
DEVICE_ID="$(echo "$DEVICE_LINE" | sed -n 's/.*id:\([^,}]*\).*/\1/p' | tr -d ' ')"
DEVICE_NAME="$(echo "$DEVICE_LINE" | sed -n 's/.*name:\(.*\)}.*/\1/p' | sed 's/[[:space:]]*$//')"

if [ -z "$DEVICE_ID" ]; then
  echo "Телефон виден, но не удалось прочитать его номер:" >&2
  echo "$DEVICE_LINE" >&2
  exit 1
fi

echo "Нашёл: $DEVICE_NAME ($DEVICE_ID)"
echo

echo "── Собираю приложение ──────────────────────────────────────────────"
# Подпись настоящая (не «-», как для симулятора): иначе телефон не запустит
# приложение, а Keychain и push не заработают.
# -quiet: без него на экран сыплются сотни строк с флагами компилятора.
# Ошибки и предупреждения он всё равно показывает.
xcodebuild \
  -project "$APP_DIR/App.xcodeproj" \
  -scheme "$SCHEME" \
  -configuration Debug \
  -destination "id=$DEVICE_ID" \
  -derivedDataPath "$BUILD_DIR" \
  -allowProvisioningUpdates \
  -quiet \
  build || fail "приложение не собралось — строки с «error:» выше"

echo "✓ собрано и подписано"

APP_PATH="$BUILD_DIR/Build/Products/Debug-iphoneos/App.app"
if [ ! -d "$APP_PATH" ]; then
  echo "Собралось, но App.app не нашёлся: $APP_PATH" >&2
  exit 1
fi

echo
echo "── Ставлю на телефон ───────────────────────────────────────────────"
# Apple печатает сюда «No provider was found» — это не ошибка, установка идёт.
xcrun devicectl device install app --device "$DEVICE_ID" "$APP_PATH" 2>&1 \
  | grep -v "provisioning paramter list\|devicectl manage create\|No provider was found" \
  || fail "на телефон не поставилось"

echo
echo "Готово. Приложение «S Маркет» на телефоне."
echo "Что проверять — docs/IPHONE_TEST_UZ.md"
