# 02 — Сайт: адрес телефона с платформой, текст «Кабинета» для Android

**Требования:** R03, R06i, R07i
**Blocked by:** —
**Зона:** `src/lib/native/` · `src/app/api/push/` · `src/lib/customer/gateway.ts` · `src/components/AccountView.tsx` · `src/lib/i18n/dictionaries.ts` (только ключи push) · `__tests__/push-*.test.ts`
**Волна:** 1
**Status:** ready

## Что должно заработать

Приложение на Android (когда в нём есть плагин уведомлений) отдаёт адрес телефона сайту с
`platform: "android"`, сайт проверяет его по правилам Android и передаёт серверу вместе с платформой.
iPhone работает ровно как раньше: его адреса проходят, старые установки без поля `platform` считаются `ios`.
Если покупатель на Android запретил уведомления, «Кабинет» показывает путь в настройках Android,
на iPhone — прежний текст.

## Из брифа, дословно

> «уведовления борми телни тепасидан чикадиган ? икосидахам»
> «ikalasiniham tayorla»

## Разделы спецификации

Истории 2, 4, 6; Решения §2; Границы — строки `native/push`, `POST /api/push/device`, `customer/gateway`.

## Критерии приёмки

- [ ] `pushPlatform()` в `push.ts` — `'ios' | 'android' | null` по `Capacitor.getPlatform()`; `sendToken` шлёт настоящую платформу
- [ ] `POST /api/push/device`: `ios` — hex 60–200 (как сейчас), `android` — `[A-Za-z0-9_:-]` 100–1024,
      нет `platform` → `ios`, неизвестная → `400 {ok:false, error:'platform'}`, плохой адрес → `400 {ok:false, error:'token'}`
- [ ] `registerPushDevice(token, phone, platform)` передаёт платформу серверу; тестовый режим (`mock`) как был
- [ ] Новый ключ `pushDeniedAndroid` (ru + ky): «… Включить: Настройки → Приложения → S Маркет → Уведомления.»;
      «Кабинет» выбирает текст по платформе; iPhone-текст не меняется
- [ ] Тесты vitest на маршрут (оба вида адресов, без платформы, чужая платформа, мусор) и на выбор платформы;
      `npm run typecheck` и весь `npm test` зелёные
