# 04 — Владельцу: одна команда для файлов Firebase и инструкция

**Требования:** R02, R09i, R09i.1, R11i
**Blocked by:** —
**Зона:** `scripts/setup-fcm.sh` · `scripts/setup-fcm.ps1` · `scripts/fcm-remote.sh` · `docs/`
**Волна:** 1
**Status:** ready

## Что должно заработать

Владелец (не программист) по инструкции на узбекском создаёт проект Firebase, скачивает два файла
и запускает одну команду `bash scripts/setup-fcm.sh` (на ПК — `setup-fcm.ps1`). Скрипт сам находит
файлы в «Загрузках», проверяет их, кладёт `google-services.json` в `android/app/`, а ключ сервисного
аккаунта отправляет на сервер через stdin — ключ нигде не показывается. Сервер проверяет его и пишет
`FCM_SERVICE_ACCOUNT_B64` в `.env.production`, сделав резервную копию. Не тот файл → понятная строка,
ничего не записано. В инструкции — готовые команды обновления сервера, сайта и выпуска Android.
Документы проекта больше не держат «переключить push в боевой режим» открытым пунктом.

## Из брифа, дословно

> «ikalasiniham tayorla»
> Дополнение: «аха разрешаю !» — на план «владельцу останется дать два файла»

## Разделы спецификации

Истории 1, 9, 10, 11; Решения §4; Границы — строка «владелец: scripts/setup-fcm.*»; образец — `scripts/setup-apns.sh`,
`scripts/setup-apns.ps1`, `scripts/apns-remote.sh`.

## Критерии приёмки

- [ ] `scripts/setup-fcm.sh` (Mac) по образцу `setup-apns.sh`: находит `google-services.json` и `*firebase-adminsdk*.json`
      в `~/Downloads`/`~/Загрузки` или спрашивает путь (перетаскивание в Терминал); проверяет
      `package_name == kg.smarket.app` и `type == service_account` + `project_id` + `private_key` + `client_email`,
      и что `project_id` в обоих файлах совпадает; копирует первый в `android/app/`; второй — base64 через stdin
      `ssh root@145.223.100.16`; понятные сообщения на русском на каждый отказ
- [ ] `scripts/fcm-remote.sh`: проверяет JSON (python3 на сервере есть), `NOENV` / `BADJSON` / `NOTSA` / `FCMOK`,
      резервная копия `.env.production`, строка `FCM_SERVICE_ACCOUNT_B64=` заменяется, не дублируется;
      ничего не печатает из ключа
- [ ] `scripts/setup-fcm.ps1` — то же для Windows (по образцу `setup-apns.ps1`)
- [ ] `docs/ANDROID_PUSH_UZ.md` — узбекская латиница, простыми словами, пошагово: Firebase → Android-приложение
      `kg.smarket.app` → `google-services.json` → «Service accounts» → «Generate new private key» → `bash scripts/setup-fcm.sh`
      → три команды дословно из spec §4 (сервер, сайт, Android `.aab` по разделу 5 `ANDROID_PLAY_UZ.md`) → проверка;
      что делать при каждом сообщении скрипта об ошибке; бесплатно ли (FCM бесплатен)
- [ ] `docs/TODO_NEXT.md`, `docs/IOS_APP_UZ.md`, `docs/APP_STORE_UZ.md`: пункт про боевой режим push закрыт —
      «27.09.2026 владелец переключил, `APNS_PRODUCTION=1`»; `docs/ANDROID_PLAY_UZ.md` — ссылка на новую инструкцию
- [ ] `bash -n` по обоим `.sh`; прогон `setup-fcm.sh` на поддельных файлах во временной папке до шага `ssh`
      (или с флагом проверки без отправки) — сообщения об ошибках видны; `ssh` на живой сервер **не запускать**
