# 01 — Сервер: отправка на Android через FCM рядом с Apple

**Требования:** R03, R06i, R10i, R10i.1
**Blocked by:** —
**Зона:** `integrations/sbonus-server/shop/`
**Волна:** 1
**Status:** ready

## Что должно заработать

Сервер SBonus умеет слать «Заказ оплачен» / «Заказ готов» и на Android: по адресам с платформой
`android` — через FCM HTTP v1, по `ios` — через Apple, как сейчас. Одна функция `send()` обходит все
телефоны покупателя и каждому шлёт своим путём. Ключ FCM берётся из `FCM_SERVICE_ACCOUNT_B64`;
его нет — Android молчит, iPhone работает. Мёртвые адреса Android удаляются, прочие отказы
увеличивают счётчик, как у Apple. Любая ошибка Google не мешает заказу и отправке на iPhone.

## Из брифа, дословно

> «уведовления борми телни тепасидан чикадиган ? икосидахам»
> «ikalasiniham tayorla»

## Разделы спецификации

Истории 2, 6, 7, 8, 12; Решения §3; Границы — строки `shop_push.py`, `shop_push_fcm.py`, `/webhook/site/push-device`;
`interfaces.md` — общие константы.

## Критерии приёмки

- [ ] Новый модуль `shop_push_fcm.py` без импортов приложения: `load_account`, `build_assertion` (JWT RS256,
      проверяемый публичным ключом), `build_message` (`data` — только строки, `android.priority=HIGH`,
      `android.notification.channel_id="orders"`, звук), `classify` (UNREGISTERED / NOT_FOUND / SENDER_ID_MISMATCH /
      INVALID_ARGUMENT про адрес → `drop`; 401/403 авторизации → `auth`; прочее → `fail`; 200 → `ok`)
- [ ] `shop_push.py`: `send()` берёт (адрес, платформа), iOS — старым путём без изменения поведения, Android — FCM;
      токен доступа Google кешируется ~50 минут; при `auth` — не долбить остальные адреса, одна строка в журнал;
      в журнал не попадают ключ, токен доступа и адреса целиком (только последние символы телефона, как сейчас)
- [ ] `enabled()` не ломает iPhone: отправка на iOS идёт, даже если FCM не настроен, и наоборот
- [ ] `/webhook/site/push-device`: платформа ∈ {ios, android} (иначе `saved:false`), лимит длины 200/1024
- [ ] Миграция `009_shop_push_token_len_migration.sql`: `token` → `VARCHAR(1024)`, идемпотентна; `deploy_shop.sh`
      знает о ней (список `MIGRATIONS` и шаг применения — по образцу соседних)
- [ ] Unit-тесты `shop_push_fcm` (сгенерированный на лету RSA-ключ, подпись проверяется, классификация ответов,
      строковость `data`), запуск `uv run --with cryptography python -m unittest …` — зелёные;
      `python3 -m py_compile` по всем изменённым файлам модуля
