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
