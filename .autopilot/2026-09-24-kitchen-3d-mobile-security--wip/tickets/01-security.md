# 01 — Безопасность: рамка, прокси фото, тесты парсера

**Требования:** R01, R02, R02.1, R02.2, R02.3, R02.5, R02.6, R14i
**Blocked by:** —
**Зона:** `next.config.ts` · `src/app/api/kitchen/photo/` · `__tests__/kitchen.test.ts`
**Волна:** 1
**Status:** ready

## Что должно заработать

Сайт нельзя вставить в чужой сайт через `<iframe>`. Прокси фото отдаёт только фото товаров
из каталога сборки и только jpeg/png/webp, с `nosniff`; на выдуманный ключ отвечает 400 и
не ходит наружу. `Referrer-Policy` не отдаёт адрес проекта чужим сайтам. Парсер ссылки
закреплён тестами на мусор.

## Из брифа, дословно

> «3D Конструктор ни битта аудит кил безопасность сини кара бролар огирлаб кочирип олмасин»

## Разделы спецификации

Истории 1–8, Решения §1–2, `audit-security.md` в папке прогона.

## Критерии приёмки

- [ ] `next.config.ts` — `headers()` на все пути: `X-Frame-Options: SAMEORIGIN`, `Content-Security-Policy: frame-ancestors 'self'`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Content-Type-Options: nosniff`. Перед этим `grep -rn "iframe" src public ios --include=*.tsx --include=*.ts --include=*.html --include=*.swift` — сайт нигде не встраивается в рамку легально (приложение iPhone грузит сайт напрямую, не в iframe; если найдено иное — `BLOCKED` с объяснением)
- [ ] Прокси: множество допустимых `src` строится из `products` (`src/data/products.ts`, поле `image`; собрать все адреса, начинающиеся с `HOST`) один раз через `store(...)`; `src` не из множества → 400. Регулярка `KEY` остаётся второй линией
- [ ] Прокси: `Content-Type` только `image/jpeg`, `image/png`, `image/webp`; ответ с `X-Content-Type-Options: nosniff`; `MAX_BYTES` 2 МБ; `KEEP` 40
- [ ] Тесты в `__tests__/kitchen.test.ts` рядом с существующими на чужие значения: `h=1e999`, `pn=Infinity`, `a=NaN`, `o` из 500 символов, `o` со 100+ шкафами — `stateFromQuery` не бросает, значения в лимитах
- [ ] `npx tsc --noEmit` и `npx vitest run` зелёные
- [ ] Комментарий в `route.ts` по-русски: почему белый список (иначе любой ключ = запрос к серверу каталога нашими руками)
