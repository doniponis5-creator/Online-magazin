# 03 — Приложение Android: плагин по наличию Firebase, канал, значок, разрешение

**Требования:** R03, R05i, R07i, R08i, R11i
**Blocked by:** —
**Зона:** `android/` · `capacitor.config.ts`
**Волна:** 1
**Status:** ready

## Что должно заработать

Пока владелец не положил `android/app/google-services.json`, Android-сборка **ровно сегодняшняя**:
плагина уведомлений в ней нет, приложение не падает, кнопки уведомлений нет. Как только файл
появился и сделан `cap sync`, в сборку входит `@capacitor/push-notifications`, Google-сервисы
подключаются (это в `build.gradle` уже есть), и уведомление магазина выглядит как надо: белый
силуэт «S» в строке состояния, лимонный акцент бренда, канал «Заказы» со звуком, видно и при
открытом приложении. На Android 13+ разрешение спрашивает системное окно (запрос делает сайт).

## Из брифа, дословно

> «икосидахам»
> «ikalasiniham tayorla»

## Разделы спецификации

Истории 2, 3, 4, 5, 11; Решения §1; Границы — строка «приложение Android»; `interfaces.md` — общие константы.

## Критерии приёмки

- [ ] `capacitor.config.ts`: `android.includePlugins` = `['@capacitor/push-notifications']`, если есть
      `android/app/google-services.json`, иначе `[]`; комментарий объясняет почему; iOS-часть не меняется;
      `plugins.PushNotifications.presentationOptions = ['alert', 'sound']`
- [ ] `MainActivity`: канал `orders` («Заказы», высокая важность, звук) создаётся при запуске на Android 8+; без Firebase — безвреден
- [ ] `AndroidManifest.xml`: `POST_NOTIFICATIONS`; метаданные Firebase — значок по умолчанию (новый векторный
      монохромный силуэт «S» по мотивам логотипа, белый на прозрачном), цвет `@color/brand_lemon`, канал `orders`
- [ ] `versionCode` 3 → 4
- [ ] Сборка `assembleDebug` зелёная **дважды**: (а) без `google-services.json` — в `android/capacitor.settings.gradle`
      нет push-плагина; (б) с учебным поддельным `google-services.json` (package `kg.smarket.app`) во временной копии —
      плагин и Google-сервисы подключены; поддельный файл удалён и не попал в git
- [ ] Если есть эмулятор/устройство — сборка (а) запускается без падения (иначе честно написать, что не запускал)
