#!/usr/bin/env bash
#
# Собрать приложение для App Store и TestFlight.
#
#   bash scripts/build-appstore.sh
#
# Чем отличается от scripts/install-on-iphone.sh: та сборка отладочная, она
# живёт только на телефоне владельца и ходит в отладочный мир уведомлений
# Apple. Эта — боевая: подписана сертификатом распространения, уведомления
# берёт из боевого мира, и её принимает App Store Connect.
#
# ⚠ ПЕРЕД первой такой сборкой сервер должен переключить ключ Apple в боевой
#   режим (apns_production = 1). Иначе уведомления в TestFlight не придут.
#   Это делает PC — напишите ему, когда запустите скрипт.
#
# Готовый файл — .ipa. Загрузить его можно двумя способами:
#   • Xcode → Window → Organizer → Distribute App;
#   • программой Transporter (бесплатно в Mac App Store) — проще.
#
# Загрузка требует пароля Apple, поэтому её делает владелец сам.
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="$ROOT/ios/App"
OUT="$ROOT/build-appstore"
ARCHIVE="$OUT/SMarket.xcarchive"

step() { echo; echo "── $* ──────────────────────────────────"; }
fail() { echo; echo "❌ $*"; exit 1; }

# Оболочка должна смотреть на живой сайт, а не на ноутбук.
grep -q "url: 'https://smarket.kg'" "$ROOT/capacitor.config.ts" \
  || fail "в capacitor.config.ts стоит не https://smarket.kg — верните адрес"

step "1. Проверяю код"
( cd "$ROOT" && npx tsc --noEmit ) || fail "ошибка типов"
( cd "$ROOT" && npx vitest run --reporter=dot ) || fail "тесты не прошли"
( cd "$ROOT" && npx cap sync ios >/dev/null ) || fail "cap sync не прошёл"
echo "✓ код в порядке"

rm -rf "$OUT"
mkdir -p "$OUT"

step "2. Собираю архив (3–5 минут)"
xcodebuild -project "$APP_DIR/App.xcodeproj" -scheme App -configuration Release \
  -destination 'generic/platform=iOS' -archivePath "$ARCHIVE" \
  -allowProvisioningUpdates -quiet archive \
  || fail "архив не собрался"
echo "✓ архив готов"

step "3. Готовлю файл для App Store"
cat > "$OUT/ExportOptions.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>method</key>
	<string>app-store-connect</string>
	<key>teamID</key>
	<string>434V33P6X2</string>
	<key>signingStyle</key>
	<string>automatic</string>
	<key>uploadSymbols</key>
	<true/>
	<key>destination</key>
	<string>export</string>
</dict>
</plist>
PLIST

xcodebuild -exportArchive -archivePath "$ARCHIVE" \
  -exportOptionsPlist "$OUT/ExportOptions.plist" -exportPath "$OUT/export" \
  -allowProvisioningUpdates >/dev/null \
  || fail "файл для App Store не собрался"

IPA="$OUT/export/App.ipa"
[ -f "$IPA" ] || fail "файл .ipa не нашёлся"

step "4. Проверяю, что внутри"
WORK="$OUT/check"
rm -rf "$WORK"; mkdir -p "$WORK"
unzip -o -q "$IPA" -d "$WORK"
BUNDLE="$WORK/Payload/App.app"

AUTH=$(codesign -dvvv "$BUNDLE" 2>&1 | grep -m1 "^Authority=" | cut -d= -f2-)
APS=$(codesign -d --entitlements - --xml "$BUNDLE" 2>/dev/null \
  | plutil -p - | grep -A1 "aps-environment" | tail -1 | tr -d ' "')
VER=$(/usr/libexec/PlistBuddy -c "Print :CFBundleShortVersionString" "$BUNDLE/Info.plist")
BUILD=$(/usr/libexec/PlistBuddy -c "Print :CFBundleVersion" "$BUNDLE/Info.plist")

echo "  подпись:      $AUTH"
echo "  уведомления:  $APS"
echo "  версия:       $VER (сборка $BUILD)"

case "$AUTH" in
  *"Apple Distribution"*) ;;
  *) fail "подписано не тем сертификатом: $AUTH" ;;
esac
case "$APS" in
  *production*) ;;
  *) fail "уведомления настроены на отладочный мир ($APS), а не на боевой" ;;
esac

echo
echo "=== ГОТОВО ==="
echo "Файл: $IPA"
echo
echo "Дальше:"
echo "  1. Откройте программу Transporter (Mac App Store, бесплатно)."
echo "  2. Войдите своим Apple ID."
echo "  3. Перетащите в неё файл выше и нажмите «Доставить»."
echo
echo "Если App Store Connect ругается, что версия уже есть — увеличьте номер"
echo "сборки: в ios/App/App.xcodeproj настройка CURRENT_PROJECT_VERSION."
