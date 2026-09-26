# Что уже построено

Читается каждым исполнителем до начала работы. Не изобретай заново то, что здесь есть.

## Общие правила проекта

- **Рабочая папка:** `/Users/doniyorabduganiev/Online-magazin/.claude/worktrees/3d-konstruktor-audit-ac2c0b` (git worktree, ветка `claude/3d-konstruktor-audit-ac2c0b`). Все команды — отсюда.
- **Стек:** Next.js (версия с изменёнными API — перед правкой роутинга, `Link`, метаданных, серверных компонентов читай `node_modules/next/dist/docs/`), React, TypeScript strict, three.js, vitest. Размеры в кухне — сантиметры.
- **Команды:** проверка типов `npx tsc --noEmit`; все тесты `npx vitest run 2>&1 | tail -30`; один файл `npx vitest run __tests__/kitchen.test.ts`; сборка `npm run build`. Тесты лежат только в `__tests__/**/*.test.ts`.
- **Браузер:** dev-сервер уже запущен на `http://localhost:3000` (HMR). Второй `next dev` в этой папке не запускай. Страница — `/ru/kitchen`, `/ky/kitchen`. Для снимков экрана и проверок — Playwright (`npx playwright` / скрипт на `playwright`), Chrome установлен.
- **Git:** не коммить, не делай `stash`, `checkout`, `reset`, `restore` — коммитит оркестратор. Параллельно может работать другой исполнитель в своей зоне: не трогай файлы вне своей зоны.
- **Нельзя трогать:** `integrations/` (1С, SBonus), `deploy/`, `ios/`, `android/`, `ios-web/`, `graphify-out/` (кроме таска 07), `.env*`. Ничего не выкладывать на сервер.
- **Зависимости:** не устанавливай пакеты. Не хватает — верни `BLOCKED` с названием.
- **Тексты:** всё, что видит покупатель, — через `src/components/kitchen/texts.ts` (тип `Texts`, RU и KY обязательны). Кыргызский — простыми словами; сомневаешься в слове — возьми уже употреблённое в `texts.ts`.
- **Подводные камни кухни** — раздел «Подводные камни кухни (24.09.2026)» в `CLAUDE.md`: движок рисует в `.kp-scene`; телефонная раскладка — одна строка `STACKED` в `KitchenPlanner.tsx` и `@media` в `kitchen.css`, менять обе; `parseVariants` не заменять сырым `JSON.parse`; «Лёгкий» — только через `Mats.lite`; `Built.spec` от `lite` не зависит; `governor.ts` не трогать.
- **Находки аудита с воспроизведением:** `.autopilot/2026-09-26-kitchen-3d-audit-pro--wip/audit-calc.md` (C01–C18), `audit-drawing.md` (D01–D28), `audit-ux.md` (U01–U23, T01–T18, X01–X10). Входные данные «вход → факт → ожидалось» оттуда — готовые тесты. Сборку `buildKitchen` аудит запускал в node с заглушкой текстур — так можно и в тестах.

## Границы, решённые в спецификации

| Модуль | Владеет | Выставляет | Прячет |
|---|---|---|---|
| `src/lib/kitchen/layout.ts` | раскладка модулей по стенам, окно, «не поместилось» | `planKitchen(input: PlanInput): Plan` — `PlanInput` получает `oven?: {w,h,d}`, `hood?: {w}`; `Plan.dropped[]` c `wall` и `need` у каждой записи; `minA(shape, widths?)`; существующие экспорты без изменения имён | правила жертв, привязка окна, снап мест |
| `src/lib/kitchen/checks.ts` | проверки проекта для покупателя | `checkProject(...) : Check[]` — новые id: `tallUnderWindow`, `applianceWider`, `underCounterHeight`, `hoodHeight` | пороги |
| `src/lib/kitchen/catalog.ts` | товар → техника с размерами | `parseSize(specs)`, `applianceFromProduct(p)` — те же сигнатуры | разбор строк характеристик |
| `src/lib/kitchen/share.ts` | состояние ↔ адрес; автосохранение | `stateFromQuery`, `queryFromState` — прежние; новые `saveLast(state)`, `loadLast(known): KitchenState \| null`, `clearLast()`, `kitchenLinkFor(product, lang): string \| null` | формат токенов, нумерация своих шкафов |
| `src/lib/kitchen/order.ts` *(новый, таск 05)* | состав проекта и деньги | `projectItems(state, plan, appliances): ProjectItem[]` (`{slot, appliance, status: 'placed'\|'counter'\|'underHob'\|'dropped'\|'typical', inTotal: boolean}`), `projectTotal(items)`, `cartAdditions(items, cart)`, `whatsappText(items, state, url, lang)` | правила «что считается» |
| `src/components/kitchen/three/build.ts` | 3D-сборка и `Built.spec` | `buildKitchen(...)` → `Built` c `spec` — прежняя форма; у деталей в `userData.dims` добавляются `x`, `y` | корпуса, фасады, раскрой |
| `src/lib/kitchen/spec.ts` | таблицы для мастера | `cutList`, `frontList`, `hardware`, `topList`, `modulesOf` — прежние; новая строка «Проёмы и доборы» | форматирование |
| `src/components/kitchen/drawing.ts` | развёртки SVG | `elevationSvg(run, opts)` — прежняя; опция `scale` (общий масштаб листа) | цепочки, подписи |
| `src/components/kitchen/pdfSheet.ts` / `pdfFile.ts` | PDF мастеру | прежние входы + `plan` (данные для страницы плана) и `contacts` | вёрстка страниц |
| `src/components/kitchen/KitchenPlanner.tsx` | экран конструктора | компонент `KitchenPlanner` — прежние пропсы | шаги, тосты, плашки |
| карточка товара `src/app/[lang]/product/[id]` | кнопка «Примерить в кухне» | ссылка из `kitchenLinkFor` | — |

**Швы для тестов:** `planKitchen`, `checkProject`, `parseSize`, `stateFromQuery`/`queryFromState`, `buildKitchen().spec` (node, заглушка текстур), `elevationSvg`, новый `order.ts`. Новых швов не заводить.

**Разумные числа (решены в спецификации):** верхний корпус не уже 20 см, иначе добор-панель; подъёмный фасад ≤ 90 см; одностворчатая дверь ≤ 62 см; деталь ≤ 2750 мм; низ вытяжки над панелью 65 см (электро/индукция), 75 см (газ).

## Из таска 01 — уборка и тексты

- `smartcentr-site/` удалена из git, есть в `.gitignore` и `.dockerignore`. `graphify-out/` ещё помнит её пути — обновит таск 07.
- Из `texts.ts` удалены ключи (RU и KY): `change`, `hintShort`, `tallOven`, `tallOvenNote`, `moveHint`, `makerLead`, `priceTag`, `som`, `modulesTitle`, `factStyle`. Новых ключей нет.
- `checkScore(ok, all)` — прежняя сигнатура; без замечаний «Хорошо: 6 из 6», с замечаниями «Есть что поправить: 2 из 6».
- Термины: везде «Духовка» и «Варочная панель» (не «Духовой шкаф», не «Плита») — тест `__tests__/kitchen-texts.test.ts` проходит по всем строкам; новые тексты должны это соблюдать.
- «Скачать/Сохранить фото 4K» — одна формулировка; две кнопки остаются до таска 07 (U17).
- `KitchenPromo` экспортирует `PROMO_STYLES {count, swatches[{id, facade, wood}]}`; баннер не импортирует `styles.ts`; `count` сверяется тестом с `STYLES.length`.

## Из таска 02 — ссылка, автосохранение, размеры, кнопка на карточке

- `saveLast(state: KitchenState): void` — пишет сразу; задержку (debounce) делает экран.
- `loadLast(known: KnownAppliances): KitchenState | null`; `clearLast(): void`. Запись: `localStorage['kp-last'] = {"q":"<строка адреса>","t":<мс>}`; запись без правильного `f=` → `null`.
- `kitchenLinkFor(product: Product, lang: Lang): string | null` → `"/ru/kitchen?ov=<id>"` (ключ слота из `share.ts`).
- `stateFromQuery(query, known: KnownAppliances)`; `KnownAppliances = ReadonlySet<string> | ReadonlyMap<string, {builtIn?: boolean}>`. **Экран должен передавать Map id → техника** (сейчас `new Set(byId.keys())`), иначе правило «колонна ≥ 200 при встраиваемой микроволновке» из адреса не работает (с Set — минимум 160). Это делает таск 05.
- **Экран применяет адрес только при наличии `f=`** (`KitchenPlanner.tsx` около стр. 387): адрес `?ov=<id>` с карточки сейчас открывает конструктор без модели — таск 05 должен применить одиночный параметр модели (к сохранённой кухне или к кухне по умолчанию).
- Формат адреса: целые места — `_095`, половинки — `-1325` (мм, 4 цифры); свои шкафы в `dr=` перенумерованы k1, k2… в порядке адреса; старые ссылки открываются как раньше.
- `parseSize`: порядок из группы букв, единицы на тройку, «упаков» пропускается; на живом каталоге размеры не изменились.
- Кнопка RU «Примерить в кухне» / KY «Ашканада көрүү» — в `ProductDetail.tsx`, стиль кнопки «Поделиться», под ней; текст в `src/lib/i18n/dictionaries.ts`.
