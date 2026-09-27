# Что уже построено

Читается каждым исполнителем до начала работы. Не изобретай заново то, что здесь есть.

## Общие правила проекта

- Рабочая папка: `/Users/doniyorabduganiev/Online-magazin/.claude/worktrees/3d-konstruktor-audit-ac2c0b` (ветка `claude/3d-konstruktor-audit-ac2c0b`).
- Стек: Next.js (изменённые API — `node_modules/next/dist/docs/`), React, TypeScript strict, three.js, vitest. Размеры кухни — см; в раскрое и Excel — мм.
- Команды: `npx tsc --noEmit`; `npx vitest run 2>&1 | tail -30` (сейчас 445 passed); один файл — `npx vitest run __tests__/<файл>.test.ts`; `npm run build`.
- Браузер: dev-сервер может быть не запущен — проверь `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ru/kitchen`; если не отвечает — запусти `npm run dev` в фоне сам и останови после проверки. Playwright headless из скрипта (Chrome есть).
- Git: не коммить, не делай stash/checkout/reset/restore — коммитит оркестратор.
- Пакеты не ставь. Не хватает — `BLOCKED`.
- Тексты — только через `src/components/kitchen/texts.ts` (RU/KY); термины «Духовка», «Варочная панель» (тест `kitchen-texts.test.ts`).
- Подводные камни и устройство кухни — `CLAUDE.md` («Кухня: устройство», «Подводные камни кухни»). Числа кухни — `src/lib/kitchen/dims.ts`.
- Уже есть: `spec.ts` — `cutList` (`CutRow {name, a, b, count, hdf}`, мм, ЛДСП 16), `frontList` (`FrontRow {type, w, h, count, color}`), `topList`, `hardware`, `extraList`; `buildKitchen` в node с заглушкой холста — пример в `__tests__/kitchen-build.test.ts`; PDF — `pdfSheet.ts`/`pdfFile.ts` (растровый, кириллица, «ң» дорисовывается, дата KY своими месяцами, имя файла по UTC+6); экран — блок «Для мебельщика» в `KitchenPlanner.tsx` (`sheetTables()`); `order.ts` — `projectItems`/`projectTotal`.

## Границы, решённые в спецификации

| Модуль | Выставляет |
|---|---|
| `src/lib/kitchen/cutting.ts` | `cutParts(spec: SpecData, look: CutLook): CutPart[]`; `CutPart = {id, name, material: {kind:'ldsp'|'hdf'|'mdf', label, color, thick}, length, width, count, grain: boolean, edges: {l1,l2,w1,w2: 0|0.4|1|2}, note?}` (мм); `edgeTotals(parts): {thick, meters}[]` (запас 10%); `nest(parts, opts?: {sheet?: {L,W}, kerf?, trim?}): NestResult[]` = `{material, sheetL, sheetW, sheets: {placements: {id, x, y, l, w, rotated}[]}[], waste, oversize: string[]}` |
| `src/lib/kitchen/xlsx.ts` | `xlsx(sheets: {name; rows: (string|number|null)[][]; widths?: number[]}[]): Uint8Array` |
| `src/lib/kitchen/cutExcel.ts` | `cutWorkbook(spec, look, t): {name, rows, widths?}[]` |
| `src/lib/kitchen/master.ts` | `MasterData`, `loadMaster()`, `saveMaster(d)`, `estimate(...)` → `{rows, total, missing}` |
| `pdfSheet.ts` | + `estimateSheet(data)` |

Правила кромки, листы по умолчанию (2800 × 2070, пропил 4 мм, обрезка 10 мм), текстура — спецификация, истории 4–8.

## Из таска 01 — детали, кромка, листы (на ревью)

- `cutParts(spec: SpecData, look: CutLook): CutPart[]`; `CutLook = {facade?: string | CutFinish; body?: string | CutFinish; bodyEdge?: 0.4|1|2; lang?: 'ru'|'ky'}`; `CutFinish = {material: FrontMaterial; ru; ky; color; wood: boolean}`.
- `CutPart = {id; name: CutName | FrontType; front: boolean; material: CutMaterial; length; width; count; grain: boolean; edges: {l1,l2,w1,w2: EdgeThick}; note?}` (мм); `CutMaterial = {kind: 'ldsp'|'hdf'|'mdf'; label (имя цвета); color; thick}` — подпись «ЛДСП 16 мм» собирает вызывающий из `kind`/`thick`; `EdgeThick = 0|0.4|1|2`.
- `edgeTotals(parts): EdgeTotal[]`, `EdgeTotal = {thick; net; meters}` (meters — с запасом 10%).
- `nest(parts, opts?: NestOpts): NestResult[]`; `NestOpts = {sheet?; sheets?: Partial<Record<'ldsp'|'hdf', Sheet>>; kerf?; trim?}`; `Sheet = {L; W}`; `NestResult = {material; sheetL; sheetW; sheets: {placements: Placement[]}[]; waste (доля 0…1); oversize: string[]}`; `Placement = {id; x; y; l; w; rotated}`. Константы `SHEET` (2800×2070), `KERF` (4), `TRIM` (10), `EDGE_SPARE` (0.1).
- МДФ-фасады, стекло и рамочные — `kind:'mdf'`, на листы не идут. Корпус по умолчанию `lam-white`, без текстуры. ХДФ — 3 мм.
- **Известный пробел:** у `SpecFront` нет признака «верхний ряд», поэтому второй цвет верхних фасадов (`upperFacade`) не учитывается — закрывает таск 02 (поле `upper` в `SpecFront` из `build.ts`, `cutParts` берёт цвет верха).

## Из таска 02 — Excel (на ревью)

- `xlsx(sheets: XlsxSheet[]): Uint8Array`; `XlsxSheet = {name; rows: XlsxCell[][]; widths?: number[]}`; `XlsxCell = string | number | null`; первая строка листа — жирная; имена листов чистятся по правилам Excel.
- `cutWorkbook(spec: SpecData, look: CutLook, t: KitchenTexts, opts?: NestOpts): XlsxSheet[]` — листы «Распил», «Фасады», «Столешница», «Фурнитура», «Кромка», «Листы». **Язык `look.lang` и `t` должны совпадать.** Через `opts` — размеры листов мастера.
- Тексты `t.xl`: `sheets{cut,fronts,top,hw,edge,nest}`, `cutHead`, `frontsHead`, `topHead`, `hwHead`, `edgeHead`, `nestHead`, `placeHead`, `kinds{ldsp,hdf,mdf}`, `frontMat`, `mm`, `yes`, `no`, `total`, `wall(run)`, `sink`, `hob`, `edgeNote`, `oversize`, `oversizeList(ids)`, `frontsInCut`, `nestOf(what, sheet)`.

## Из таска 01b — цвет верха, доборы, «Фасады» из деталей (на ревью)

- `SpecFront.upper?: boolean`, `SpecExtra.upper?: boolean`; `HDF = 3` в `spec.ts` рядом с `LDSP`.
- `CutLook` + `upperFacade?: string | CutFinish` (включая 'style'), `tone?: CutTone` (`Pick<Tone, ru|ky|facade|upper|texture|upperTexture>`); `CutFinish.material` необязателен (нет — фасад стиля).
- `CutMaterial.kind` += `'shop'` (стекло, рамочные, фасад стиля — в цех фасадов); `thick: number | null` (null — не из листа).
- `CutPart.name` += `PanelName` ('filler'|'strip'|'islandBack'); фасады и доборы: `facade?: CutFace = {h, w, finish: FrontMaterial | null}`; `front` = «в цвет фасадов».
- `cutWorkbook` берёт язык только из `t.xl.lang`. Новые ключи: `xl.lang`, `xl.styleMat`, `xl.cutGaps(ids)`.
- **Экран (таск 03) должен передать в `CutLook`: `facade`, `upperFacade`, `tone` (тон стиля), `bodyEdge`** — иначе раскрой идёт белым ламинатом.

## Из таска 03 — цены мастера, смета, блок «Мастеру»

- `src/lib/kitchen/master.ts`: `MasterData = {name; phone; shop; prices: MasterPrices; bodyEdge: 0.4|1|2; sheets: {ldsp?: Sheet; hdf?: Sheet}}`; `MasterPrices = {ldsp?, hdf?, edge?: {'0.4'|'1'|'2'}, front?: Record<FrontMaterial|'style'>, top?, hinge?, runner?, lift?, handle?, work?, delivery?, markup?}` (сом; пусто — «цены нет»).
- `MASTER_KEY = 'kp-master'`, запись `{v:1, …}`; `emptyMaster()`, `loadMaster()` (битая/чужая запись — пусто), `saveMaster(d)` (ошибки хранилища не бросает).
- `estimate(parts, nested, spec, prices): Estimate` — **без `items`** (техника берётся на экране из `order.ts`). `Estimate = {rows: EstimateRow[]; subtotal; markupPct; markup; total; missing: EstimateKey[]}`; `EstimateRow = {key; what?; thick?; qty; unit: 'sheet'|'m'|'m2'|'pcs'|'pair'|'job'; price: number|null; sum: number|null}`.
- Работа «за погонный метр» — по длине столешницы; фасад стиля — своя цена `front.style`.
- `pdfSheet.ts`: `estimateSheet(d: EstimateData): Promise<Blob>`; `SheetData.cutMaps?: {title; maps: CutMap[]}` — карты раскроя страницами в «PDF для мастера»; `CutMap = {title; L; W; rects: {x,y,l,w,label}[]}`.
- Тексты `t.master.*` (форма, итоги, смета), `t.xl.tier` («— низ / — верх»).
