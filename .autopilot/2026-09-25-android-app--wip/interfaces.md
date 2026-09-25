# Интерфейсы

## Границы, решённые в спецификации

| Модуль | Владеет | Выставляет (JS → Android) | Прячет |
|---|---|---|---|
| `BonusCard` | карта SBonus в телефоне | `save({qr,name,phone,balance,tier,updatedAt,lang})`, `clear()`, `state() -> {saved,phone,updatedAt}`, `show()` | шифрование (Android Keystore), экран карты, яркость |
| `AppLock` | ключ быстрого входа | `available() -> {available,kind}`, `saveKey({key}) -> {ok}`, `hasKey() -> {saved}`, `unlock({reason}) -> {ok,key?}`, `clearKey()` | BiometricPrompt, шифрование ключа |
| `OfflineCatalog` | снимок каталога | `save({version,updatedAt,payload})`, `state() -> {saved,version,count,updatedAt}`, `show({lang})`, `clear()` | файл снимка, экран списка, поиск |
| оболочка (`MainActivity`, тема, заставка, иконки, `capacitor.config.ts` → android) | запуск, заставка, края экрана, «Назад», внешние ссылки, «Нет связи» | — | — |

Контракт — тот же, что у iPhone: сайт общий (`src/lib/native/*.ts`). Имена
плагинов и формы вызовов **не меняются**. Чинится только Android-сторона.

**Шов для проверки — один:** эмулятор через `adb` (install, `am start`,
`input tap/keyevent`, `screencap`, `uiautomator dump`, `logcat`,
`emu finger touch`, `svc wifi|data disable|enable`).

## Правила проекта для исполнителя

- Java: `export JAVA_HOME=/opt/homebrew/opt/openjdk@21` (keg-only, в PATH не прописан).
- SDK: `~/Library/Android/sdk` (`ANDROID_HOME`). `adb` и `emulator` — оттуда.
  `sdkmanager`/`avdmanager`: `/opt/homebrew/share/android-commandlinetools/cmdline-tools/latest/bin/`.
- Образ эмулятора уже скачан: `system-images;android-36;google_apis_playstore;arm64-v8a`.
- Сборка: из корня `npx cap sync android`, затем в `android/`:
  `./gradlew assembleRelease` (APK для эмулятора) и `./gradlew bundleRelease` (AAB).
  Подпись release берётся из `android/keystore.properties` (в git нет) —
  **пароли из него никогда не печатать, не копировать, не писать в логи и отчёты.**
- Android Studio не ставится и не нужна.
- **Не трогать:** `ios/`, `src/`, `graphify-out/`. Ошибка на стороне сайта (`src/`)
  — не чинить, а вернуть строкой в отчёте: это половина PC.
- Не хватает зависимости или инструмента → `BLOCKED` с причиной, а не установка.
- Код демо-входа Apple/Google — секрет владельца, его не спрашивать и не искать
  на сервере. Для входа — тестовый режим локального сайта (код 1234).
- Снимки и логи проверки — `build-play/android-check/<таск>/` (папка вне git).
- Тесты сайта: `npx vitest run` (должны оставаться зелёными, если `src/` не трогали).
- Коммитит оркестратор; исполнитель не коммитит и не пушит.

## Что построили таски

## Из таска 01 — эмулятор (предварительно, таск ещё идёт)

- AVD `smarket-api36`: API 36, google_apis_playstore arm64, Pixel 7 1080×2400, датчик отпечатка включён. Создан вручную в `~/.android/avd/` (brew-овский `avdmanager` SDK не видит).
- Запуск: `~/Library/Android/sdk/emulator/emulator -avd smarket-api36 -no-window -no-audio -no-boot-anim -no-snapshot-save -gpu swiftshader_indirect`
- Сборка и установка: `npx cap sync android` → `cd android && JAVA_HOME=/opt/homebrew/opt/openjdk@21 ./gradlew assembleRelease` → `adb install -r android/app/build/outputs/apk/release/app-release.apk`
- Страница «Нет связи» открывается как `https://localhost/index.html` (из `ios-web/`, общая с iPhone).

## Из таска 01 — итог

- `MainActivity.connectOfflinePage()` подключает мост Capacitor и плагины `BonusCard`, `OfflineCatalog` к странице «Нет связи» `https://localhost/index.html` (адрес из `errorPath`). Причина: Capacitor 8 вставляет свой JS только на адрес `server.url`; на iPhone — во все страницы.
- Новая зависимость `androidx.webkit:webkit:$androidxWebkitVersion` (1.14.0).
- Заставка: фон = `ic_launcher_background` (#EAF500), у `splash_logo` прозрачный фон.
- «Повторить» на «Нет связи» открывает главную smarket.kg (не ту страницу, где был покупатель).
