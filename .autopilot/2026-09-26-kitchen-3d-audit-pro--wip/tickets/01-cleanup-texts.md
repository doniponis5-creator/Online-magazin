# 01 — Уборка и тексты

**Требования:** R05, R05.1, R05.2, R04.1, R13i
**Blocked by:** —
**Зона:** `smartcentr-site/` · `.gitignore` · `.dockerignore` · `src/components/kitchen/texts.ts` · `src/components/kitchen/KitchenPromo.tsx` · `src/app/[lang]/kitchen/page.tsx` · `src/lib/kitchen/finishes.ts`
**Волна:** 1
**Status:** ready

## Что должно заработать

В репозитории больше нет устаревшей второй копии сайта, которая попала в git случайно и мешает проверке типов, сборке образа и карте кода. Покупатель читает правильные слова по-русски и по-кыргызски: без ошибок рода, без «Свернуть» на кнопке закрытия, с «21 стиль» вместо устаревших «15». Баннер кухни на главной не тянет весь каталог стилей ради пяти цветов.

## Из брифа, дословно

> «kamchiliklari va keremas narsalari»
> «klientga udobstvasi»
> Дополнение: «matnlar to'g'rilanadi, eski nusxa papkasi o'chiriladi»

## Разделы спецификации

Истории 45–47, 49; Решения §9, §10. Подробности находок: `audit-ux.md` §2 (T01–T18) и §3 (X01, X02), U22.

## Критерии приёмки

- [ ] `smartcentr-site/` удалена из git (`git rm -r`), строка `smartcentr-site/` есть в `.gitignore` и `.dockerignore`; ничего в проекте на неё не ссылается
- [ ] Все 18 правок текстов T01–T18 из `audit-ux.md` §2 сделаны в RU и KY (T15 — в `finishes.ts`); T17: везде «Духовка» и «Варочная панель» для этих предметов
- [ ] «21 стиль» (число из `STYLES.length`, не константой) в SEO-описании страницы кухни и в баннере на главной, RU и KY
- [ ] 10 неиспользуемых ключей X02 удалены из RU и KY; `grep` не находит обращений
- [ ] Баннер `KitchenPromo` больше не импортирует `styles.ts` целиком — пять цветов записаны в нём самом, внешний вид баннера не изменился
- [ ] `npx tsc --noEmit`, `npx vitest run`, `npm run build` зелёные
