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

## Из таска 03 — раскладка и проверки

- `PlanInput`: `oven?: {w,h,d} | null`, `hood?: {w} | null`, `snap?: ItemKey[]` — без поля прилипают все (как раньше), `[]` — места заморожены; **экран передаёт `snap: [перетаскиваемый]` или `[]`** (таск 05, C16).
- `Plan`: `dropped: Dropped[]` = `{item, slot?, need, wall: RunId}` (wall обязательна); `ovenMovedUnderHob?: boolean`; `tooWide?: {slot:'oven'|'hood', w, room, wall}[]`; `underCounter?: {slot:'washer'|'dishwasher', h, wall}[]`; `hoodHeight?: {over, gas}`.
- `needByWall(plan): Partial<Record<RunId, number>>` — нехватка по стенам (без записей со slot `hood`). Вытяжка, которую не повесить: `{item:'hob', slot:'hood', wall}` в `dropped`. `minA(shape, widths?)`.
- `UpperKind` += `'corner'` (`Upper.blind = 35`, `Upper.blindAt`) и `'filler'` (панель без корпуса). Константы `UPPER_MIN = 20`, `HOOD_OVER = {gas: 75, electric: 65}`. `resolveRun(..., canSnap?)`.
- Сейчас в `build.ts` (правка 03, временная): `corner` рисуется как обычный шкаф, `filler` не рисуется (пустое место до 19 см) — **доделывает таск 04**. `plan.hoodHeight.over` — норма для 3D.
- `checkProject(plan, facts?: CheckFacts)`, `CheckFacts = {hoodOver?: number}` — **таск 04/05 передаёт фактическую высоту низа вытяжки над панелью из 3D**; без неё проверки `hoodHeight` нет. Норма одна — `HOOD_OVER` из `layout.ts` (`HOOD_MIN` удалена). Над модулем `hob` в верхнем ряду только `hood`/`none`. Проверки: `tallUnderWindow{level}`, `applianceWider{slot,w,room}`, `underCounterHeight{slot,h,max}`, `hoodHeight{over,min,gas}`; `UNDER_COUNTER = 82`. Тексты: `t.checks.tallUnderWindow/applianceWider/underCounter/hoodHeightOk/hoodHeightWarn`, `t.ovenUnderHob`, `t.hoodNoPlace`, `t.uppers.corner/filler`. В `KitchenPlanner.tsx` `checkText` уже знает 4 новых проверки.
- Поведение: вытесненный предмет сливает куски столешницы по бокам в один; если пенал/шкаф духовки не встал, а духовка ушла под плиту или в колонну — записи «пенал не поместился» нет; окно у задней стены может сузиться (не уже 60), чтобы не висеть над высоким шкафом.
- Для таска 05: запись о вытяжке под окном (`{item:'hob', slot:'hood'}`) сейчас входит в счёт проверки `fits` — экран должен показывать для неё `t.hoodNoPlace` и не советовать «удлините стену».

## Из таска 04 — 3D-сборка и спецификация

- `Built.hoodOver?: number` — фактическая высота низа вытяжки над панелью, см; вытяжки в 3D нет — поля нет. **Экран (таск 05) передаёт её в `checkProject(plan, {hoodOver})`.** Вытяжка висит по `plan.hoodHeight.over` (все виды, остров); шкаф со встроенной вытяжкой начинается выше соседей.
- `Dims.x`, `Dims.y` (см: вдоль ряда и от пола) пишутся при создании любой детали: `dims(obj, kind, w, h, d, at: {x,y}, slot?)` — `at` обязателен; `SpecBox.x/y` берутся из них, габарит `Box3` — только запасной путь.
- Деление длинных деталей: `partsOf(len)` рядом с `PART_MAX` в `build.ts` (портал, задняя панель острова 280 → 2 × 1400). `SpecData.extras?: SpecExtra[]`, `SpecExtra = {kind: ExtraKind; run: RunId; w; h; hMax?}` (см), `ExtraKind = 'dwOpening'|'filler'|'strip'|'islandBack'`; `extraList(data): ExtraRow[]`, `ExtraRow = {kind, w, h, hMax?, count}` (мм).
- `modulesOf(run)` возвращает ещё `fillers: SpecBox[]`; `filler` больше не в `lower`. Тексты `t.extrasTitle`, `t.extraNames` (RU/KY). **Таблицу «Проёмы и доборы» на экране и в PDF рисует `sheetTables()` в `KitchenPlanner.tsx` — таск 06.**
- Рамки: у открытых полок у каждой полки своя (нижняя — группа с `userData.cab`, верхняя — дочерняя); ПММ от пола (y=0) высотой с машину; «камин» — от полочки, без кронштейнов; вытяжка в «камине» — по центру короба. Верхний добор — только в списке доборов; нижний — «Глухая планка» в фасадах. Подъёмный фасад > 90 см → распашные.
- Тест `__tests__/kitchen-build.test.ts`: перебор `buildKitchen` (192 сборки) и паритет 3D ↔ спецификация.

## Из таска 05 — экран конструктора

- `src/lib/kitchen/order.ts`: `CORE_SLOTS`; `type Chosen`; `type ItemStatus = 'placed'|'counter'|'underHob'|'dropped'|'typical'|'noStock'` (`noStock` — нужный слот без товара в каталоге, не в сумме; типовая без места — `dropped`); `type ProjectItem = {slot, appliance: KitchenAppliance|null, status, inTotal}`; `chosenItems(picks, appliances): Chosen`; `planInputOf(state, chosen, snap?: ItemKey[]): PlanInput`; `projectItems(state, plan: Pick<Plan,'dropped'|'ovenMovedUnderHob'>, appliances): ProjectItem[]`; `projectTotal(items): {count, sum}`; `cartAdditions(items, cart: {productId}[]): KitchenAppliance[]`; `wallsText(state, lang)`; `whatsappText(items, state, url, lang): string`. **Сумма, список и корзина экрана — только отсюда.**
- `engine.hoodOver(): number | undefined` → `checkProject(plan, {hoodOver})`. Основной план — со `snap: []`; перетаскивание и ←/→ — со `snap: [key]`.
- Автосохранение: `saveLast` через 400 мс после изменения (тот же таймер, что адрес), на паузе, пока видна плашка «Продолжить». `loadLast`/`stateFromQuery` получают Map id → техника. `?ov=<id>` применяется к сохранённой кухне или к кухне по умолчанию.
- Шаги: Форма → Размер → Техника → Стиль → Отделка. WhatsApp и звонок — `wa.me/996557100505`, `tel:+996557100505` из `contacts.ts`. Нижняя «Поделиться» отдаёт ссылку (`share()` без файлов); `sendPdf('share')` и `t.shareText` больше ни одна кнопка не зовёт — **таск 06 решает, удалить или использовать**.
- Список «что стоит в 3D» строится из `projectItems` (placed/underHob → модель, typical → типовая). Пока видна плашка «Продолжить», `kp-last` не перезаписывается; отложенное сохранение — ещё и на `pagehide`/размонтировании. Удалены ключи `soon`, `askText`.
- Ключи `texts.ts` (RU/KY): `counterNote, typicalNote, noStock, askSupply, askSupplyText(slot,url), details, askWa, call, allInCart, waHello, waStyle, waCounter, waAsk, waDropped, resumeLead, resume, startOver, startedOver, styleFinish, range(min,max), clamped(v), listCopyFailed, copyFailed, helpShow`; изменены `droppedFix(wall, len)`, `hint`. CSS: `kp-seg--wrap` (переносящийся сегмент-переключатель).
- Таблица PDF, читающая `inProject` (зона 06), теперь включает отдельностоящую микроволновку.
- **Для таска 07:** на телефоне плашка корзины сайта закрывает «Начать заново» под плашкой «Продолжить»; на компьютере после «Добавить всё» корзина сайта закрывает кнопку «Спросить»; у выбранной стиральной в П-образной кухне камера смотрит из-за стены — видна только синяя рамка (снимки `scratchpad/t05/phone-f4-resume.png`, `desk-f1-tech.png`).

## Из таска 06 — чертёж и PDF

- `drawing.ts`: `elevationSvg(run, heights, labels, window?, opts?: ElevationOpts)`, `ElevationOpts = {scale?: number}`, у корня SVG `data-scale="N"`; `DrawingLabels` + `corner, view, islandView, hoodOver, section`; экспорты `SCALES, SHEET_BOX, PLAN_BOX, paperSize(svg, scale), pickScale(make, box?)`, `planSvg(plan, labels: PlanLabels, opts?)`, `PlanLabels = {cm, window, passage, island, depths}`. Атрибуты SVG: `data-chain="low"|"up"`, `data-mark`, `data-dim="hood"|"overhang"|"passage"`.
- `pdfSheet` `SheetData` + `plan?: {title, svg}`, `contacts: {text, url}` (обязательное, из `contacts.ts`). Один масштаб на лист развёрток, «М 1:N» в заголовке. Имя файла `smarket-kitchen-ГГГГ-ММ-ДД-ЧЧММ.pdf` по UTC+6. «↗» и «ң» в PDF дорисовываются линиями (в Manrope их нет).
- Ключи `texts.ts` (RU/KY): `drawing{corner,view,islandView,hoodOver,section}, scaleLabel(n), planTitle, drawingOpen, plan{window,passage,island,depths}, approxSize, approxList(names), pdfContacts(phone), sheetDate(day,month,year)`; удалены `shareText`, `pdfLinkCopied`; `topRow` для 'I' — «Остров»/«Аралча». `sendPdf('share')` удалён. Строка стен — только `wallsText`.
- На телефоне нажатие по развёртке открывает её на весь экран с прокруткой.
- После дозапроса 06-1: экспорты `drawing.ts` — `cornerZones(length, modules)`/`CornerZone` (одно правило угла для развёртки и списка), `printedScale(svgs, scale, box)`, `windowFor(plan, runId, ceiling, sizes)`/`WindowSizes`, `islandOverhang(runs)`, `approxNames`, `techRows(list, t)`, `makerList(plan, items, t, inProject)`/`MakerItems`, `PlanOpts = {scale?, runs: SpecRun[]}` (runs обязателен), `PlanDepths`. `ElevationOpts.overhang?`; `DrawingLabels.windowNote(sill, top)`; `PlanLabels.depths` — функция. `SheetData.wallsScale?`, `scaleLabel(n)`, `plan.scale?`; при ужатии «М 1:N» не печатается. Проход = между фасадами (110). Окно — из `WINDOW` (`build.ts`, динамический импорт), «типовые, уточнить на месте».

## Из таска 07 — доводка

- Ключи `texts.ts` (RU/KY): + `toolsLabel`, `panelLabel`, `stepsLabel`, `photoInApp`; − `saveImage`; `photoSave` → «Сохранить фото» / «Сүрөттү сактоо»; `saving` → «Готовим фото…». Одна кнопка фото — в режиме «Фото».
- Помощники в tsx: `groupKeys`, `roving`, `groupItems` — стрелки/Home/End в группах `role=radio`/`role=tab`, один Tab на группу.
- `engine.focus()` ставит камеру в комнату лицом к фасаду выбранной техники.
- Пока видна плашка корзины сайта, «Спросить» на компьютере поднимается над ней (высота плашки ~70px вписана в CSS).
- `graphify update .` выполнен.
