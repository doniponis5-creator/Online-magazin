# Интерфейсы

## Правила проекта (для каждого исполнителя)

- Репозиторий: рабочая копия `/Users/doniyorabduganiev/Online-magazin/.claude/worktrees/3d-konstruktor-mobile-native-0e2c9f`,
  ветка `claude/push-apns-fcm`. Работай только здесь. Главную копию `/Users/doniyorabduganiev/Online-magazin`
  не трогай (оттуда только читать: `node_modules` подключён ссылкой, `android/local.properties` можно скопировать).
- Стек: Next.js 16.3.4, React 19.3, TypeScript, vitest; Capacitor 8.5 (iOS + Android), `@capacitor/push-notifications` 8.1.2;
  сервер SBonus — Python 3 / FastAPI / SQLAlchemy async / httpx (HTTP/2), библиотека `cryptography` на сервере есть.
- Команды: `npm run typecheck`, `npm test` (vitest, весь набор), `npx vitest run __tests__/<файл>`.
  Android: `npx cap sync android`, затем в `android/`: `JAVA_HOME=/opt/homebrew/opt/openjdk@21 ./gradlew assembleDebug`.
  Python-тесты модуля FCM: `uv run --with cryptography python -m unittest <путь>` (локального `cryptography` нет).
- **Нельзя:** трогать живой сервер (`ssh`, `scp`, `docker` на 145.223.100.16), публиковать, пушить в git, ставить новые
  npm/pip-зависимости в проект. Не хватает зависимости → верни `BLOCKED`, не устанавливай.
- Комментарии в коде — по-русски, простым языком, как в соседнем коде (объясняют «зачем»). Тексты для покупателя — ru + ky
  (`src/lib/i18n/dictionaries.ts`, общий файл — меняй только свои ключи).
- Секреты: ни одного ключа/токена в коде, тестах, логах и коммитах. В тестах — только сгенерированные на лету ключи и
  выдуманные адреса.
- Коммит делает оркестратор. Ты оставляешь изменения в рабочей копии и перечисляешь файлы.

## Границы, решённые в спецификации

| Модуль | Владеет | Выставляет | Прячет |
|---|---|---|---|
| сайт `src/lib/native/push.ts` | разрешение и адрес телефона в приложении | `enablePush(): Promise<boolean>`, `pushState(): Promise<'granted'\|'denied'\|'ask'\|'none'>`, `resumePush(): Promise<void>`, `pushPlatform(): 'ios'\|'android'\|null` | как найти плагин, куда отправить адрес |
| сайт `POST /api/push/device` | приём адреса от приложения | тело `{token: string, platform?: 'ios'\|'android'}` → `200 {ok:true}` / `400 {ok:false, error:'token'\|'platform'}`; нет `platform` = `ios` | проверку формы адреса: `ios` — hex 60–200; `android` — `[A-Za-z0-9_:-]` 100–1024 |
| сайт `src/lib/customer/gateway.ts` | разговор с SBonus | `registerPushDevice(token: string, phone: string\|null, platform: 'ios'\|'android'): Promise<void>` → серверу `POST /api/v1/webhook/site/push-device` `{token, platform, phone}` | подпись запроса, тестовый режим |
| сервер `shop_push.py` | отправку на телефоны | `send(db, phone, title, body, data) -> int`, `save_device(db, token, platform, phone)`, `forget_phone(db, phone) -> int` — **сигнатуры не меняются** | выбор Apple/FCM по платформе, чистку мёртвых адресов |
| сервер `shop_push_fcm.py` (новый, **без импортов приложения**) | протокол FCM HTTP v1 | `load_account(b64: str) -> dict\|None` (нужны `project_id`, `client_email`, `private_key`, `type == "service_account"`), `build_assertion(account: dict, now: int) -> str` (JWT RS256, aud `https://oauth2.googleapis.com/token`, scope `https://www.googleapis.com/auth/firebase.messaging`), `build_message(token, title, body, data) -> dict`, `classify(status: int, body: dict\|str) -> 'ok'\|'drop'\|'fail'\|'auth'` | формат JWT и ответов Google |
| сервер `/webhook/site/push-device` (`shop_admin.py`) | приём адреса от сайта | `{token, platform, phone}`; платформа ∈ {`ios`,`android`}, иначе `saved:false`; длина ≤200 для `ios`, ≤1024 для `android` | лимиты по платформе |
| приложение Android | канал, значок, разрешение | канал `orders` («Заказы», высокая важность); плагин push в сборке ⇔ есть `android/app/google-services.json` | — |
| владелец: `scripts/setup-fcm.sh` / `.ps1` + `scripts/fcm-remote.sh` | доставку двух файлов Firebase | на сервер пишет `FCM_SERVICE_ACCOUNT_B64=<base64 JSON одной строкой>` в `/opt/sbonus/.env.production` с резервной копией; ответы `FCMOK`/`BADJSON`/`NOTSA`/`NOENV`; `google-services.json` копирует в `android/app/` после проверки `package_name == kg.smarket.app` | ключ не печатается и идёт через stdin |

### Напоминание о корзине (G01, таски 05–06)

| Модуль | Владеет | Выставляет | Прячет |
|---|---|---|---|
| сервер `shop_cart_remind.py` | расписание и отправку напоминаний | `python3 -m app.shop.shop_cart_remind` (одна проверка, выход); чистые функции `due(row, now) -> bool`, `reminder_text(items, count) -> (title, body)` без импортов приложения — в отдельном `shop_cart_rules.py` | запрос к БД, тихие часы, счётчик |
| сервер `/webhook/site/push-cart` | снимок корзины | `{phone, items: [str] (≤3 названия), count: int, total: number}` → `{ok, saved}`; пустая корзина = `count: 0` | сброс счётчика при изменении |
| сервер `/webhook/site/cart-consent` | согласие | `{phone, consent: bool}` → `{ok}`; и `GET`-вариант или поле в ответе для чтения текущего согласия — `{consent: bool\|null}` (`null` — ещё не спрашивали) | — |
| сайт `POST /api/push/cart`, `POST/GET /api/push/consent` | мост приложения к серверу | тело корзины `{items, count, total}` / `{consent}`; телефон берётся из сессии, не из тела; без входа → `401` | подпись к SBonus |
| сайт `native/push` | нажатие на уведомление | `data.type === "cart"` → переход в корзину текущего языка | — |
| таблица `shop_cart_reminders` (миграция `010`) | — | `phone PK, consent BOOLEAN NULL, items JSONB, count INT, total NUMERIC, changed_at, sent INT, last_sent_at` | — |

### Общие константы (одни и те же во всех местах)

- Переменная окружения ключа FCM: `FCM_SERVICE_ACCOUNT_B64` (читать через `_cfg("fcm_service_account_b64")`).
- Канал уведомлений Android: id `orders`, название «Заказы».
- Платформы: строго `ios` и `android`.
- Максимальная длина адреса: `ios` 200, `android` 1024; колонка БД `shop_push_devices.token` → `VARCHAR(1024)` (миграция `009`).
- FCM `data`: только строковые значения (Google отвергает числа).

## Что построили таски

### Из таска 01 — сервер FCM

- `shop_push_fcm` (без импортов приложения): `load_account(b64) -> dict|None`; `build_assertion(account, now) -> str` (бросает, если ключ битый); `build_message(token, title, body, data) -> dict`; `classify(status, body) -> 'ok'|'drop'|'fail'|'auth'`; `reason(status, body) -> str` (для журнала); константы `TOKEN_URL`, `SCOPE`, `CHANNEL_ID="orders"`
- `shop_push`: `send/save_device/forget_phone` — сигнатуры прежние; добавлены `apple_enabled() -> bool`, `fcm_enabled() -> bool`; `enabled() = apple_enabled() or fcm_enabled()`; ключ — `_cfg("fcm_service_account_b64")`. Любую отправку на телефоны делай через `send()` — не пиши второй отправщик
- `/webhook/site/push-device`: платформа `ios|android`, длина 200/1024, иначе `{ok:true, saved:false}`
- БД: `shop_push_devices.token VARCHAR(1024)` (миграция `009`, идемпотентна через DO-блок); `deploy_shop.sh`: `shop_push_fcm.py` в `FILES`, `009` в `MIGRATIONS` + шаг применения, импорт `shop_push` в предпроверке 0.1 — новые модули и миграции добавляй так же
- Тесты модуля: `uv run --with cryptography python -m unittest integrations/sbonus-server/shop/test_shop_push_fcm.py` (16); тестовые файлы не входят в `FILES`

### Из таска 02 — сайт

- `src/lib/native/push.ts`: `pushPlatform(): 'ios' | 'android' | null` (из `window.Capacitor.getPlatform()`; `null` в браузере/на сервере/неизвестно); `sendToken` шлёт `{token, platform}`, при неизвестной платформе — ничего
- `src/lib/customer/gateway.ts`: `export type PushPlatform = 'ios' | 'android'`; `registerPushDevice(token, phone, platform: PushPlatform)` → SBonus `{token, platform, phone}`; `mock` — только консоль
- `POST /api/push/device`: `{token, platform?}`; нет/`null` → `ios`; иное (включая `''`, `'IOS'`) → `400 {ok:false, error:'platform'}`; адрес `ios` hex 60–200, `android` `[A-Za-z0-9_:-]` 100–1024, иначе `400 {error:'token'}`; успех `200 {ok:true}`
- Словарь: `account.pushDeniedAndroid` (ru + ky)
- Тесты: `__tests__/push-device.test.ts`, `__tests__/push-platform.test.ts` — образец для новых тестов маршрутов push
- `npm run typecheck` в этой рабочей копии требует сначала `npx next typegen` (иначе 10 старых ошибок `RouteContext` в чужих маршрутах)

### Из таска 03 — приложение Android

- `android.includePlugins` = `['@capacitor/push-notifications']` ⇔ есть `android/app/google-services.json`, иначе `[]` (`capacitor.config.ts`)
- `plugins.PushNotifications.presentationOptions = ['alert', 'sound']`
- Канал `orders` («Заказы», `@string/orders_channel_name`, IMPORTANCE_HIGH, звук и вибрация) — `MainActivity.ORDERS_CHANNEL_ID`, создаётся при каждом запуске, API 26+
- Манифест: `POST_NOTIFICATIONS`; Firebase: `default_notification_icon=@drawable/ic_stat_s`, `default_notification_color=@color/brand_lemon`, `default_notification_channel_id=orders`
- `versionCode 4`, `versionName "1.0"`
- Сборка: `npx cap sync android` в этой рабочей копии переписывает путь к `node_modules` в `android/capacitor.settings.gradle` (ссылка на `node_modules`) — после sync верни файл `git checkout -- android/capacitor.settings.gradle`
