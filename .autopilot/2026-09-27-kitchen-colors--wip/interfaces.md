# Интерфейсы

## Правила проекта для исполнителей

- Next.js 16 (API изменены — `AGENTS.md`), TypeScript strict, three.js, vitest. Команды: `npx tsc --noEmit`, `npx vitest run` (один файл: `npx vitest run __tests__/<имя>.test.ts`), `npm run build`.
- Пакеты не ставь. Не хватает — `BLOCKED`. Не коммить (коммитит оркестратор). Без `git stash` / `checkout` / `reset`.
- Тексты — только `src/components/kitchen/texts.ts`, RU и KY; термины «Духовка», «Варочная панель» (тест `kitchen-texts.test.ts`).
- Устройство кухни и подводные камни — `CLAUDE.md` («Кухня: устройство», «Подводные камни кухни»); числа — `src/lib/kitchen/dims.ts`.
- `KitchenPlanner.tsx` берёт из `./three/*` только `import type`; тяжёлое — через `import()`.
- Отделка сегодня: `FrontColor = {id, material, ru, ky, color, texture?: 'wood'|'concrete'}`, 52 цвета `lam-/acr-/en-/ven-/fx-`; `frontColor(id)` — единственный разбор id; `KitchenState.facade`/`upperFacade` ('style' можно)/`overFridgeFacade`; ссылка `fc`/`uf`/`ofc`; неизвестный id отбрасывается через `frontColor(...)?.id`. 3D: `createMaterials(style, tone, evening, room, finish: FinishLook, lite)`, `catalogFront(c)` по материалу; фактуры — `three/textures.ts` (`wood(base, seed)`, `concrete(base, seed)`). Раскрой: `cutting.ts` `finishOf` бросает на неизвестном id, `face()`: laminate → ЛДСП 16, остальное → МДФ, стекло/рамка/стиль → цех.

## Границы, решённые в спецификации

| Модуль | Владеет | Выставляет | Прячет |
|---|---|---|---|
| `src/lib/kitchen/ral.ts` *(новый)* | палитра RAL Classic | `RAL: {code: string; hex: string; ru: string}[]`, `parseRal(input: string): string \| null` (нормализует к «7016») | таблица |
| `src/lib/kitchen/decors.ts` *(новый)* | декоры ЛДСП брендов | `DECORS: Decor[]`, `Decor = {id; brand: 'egger'\|'kronospan'\|'lamarty'; code; ru; ky; color; texture?: 'wood'\|'concrete'}` | список |
| `src/lib/kitchen/finishes.ts` | отделка | `frontColor(id)` понимает `ral-NNNN` и `dec-…`; `FrontColor.code?`, `brand?`; `findColors(query): FrontColor[]` | разбор id |
| `share.ts` | ссылка | ключ `if` (остров); `fc`/`uf`/`ofc`/`if` принимают новые id через `frontColor` | — |
| `three/materials.ts`, `three/build.ts` | 3D | `FinishLook.island?`; материал острова для фасадов и задней панели острова | — |
| `cutting.ts` | раскрой | `CutLook.islandFacade?`; `SpecFront.island` / панель острова — цвет острова; `CutMaterial.label` с кодом (таск 03) | — |

**Швы для тестов:** `parseRal`, `frontColor` (новые id), `findColors`, `stateFromQuery`/`queryFromState`, `cutParts`/`cutWorkbook`, `whatsappText`.

## Из таска 02 — цвет острова (на ревью)

- `KitchenState.islandFacade?: string` (те же id, что `facade`, через `frontColor`); ссылка `if`; `kp-last` хранит.
- `FinishLook.island?: FrontColor`; `createMaterials(...)` += `island: THREE.Material`, `islandTextured: boolean` (нет цвета острова — `island === facade`).
- `SpecFront.island?: boolean`, `SpecExtra.island?: boolean` — ставятся только когда у острова свой цвет.
- `CutLook.islandFacade?: string | CutFinish`.
- **Экран (таск 03) должен:** в `FinishLook` (KitchenPlanner.tsx ~742–749) добавить `island: frontColor(state.islandFacade)` и зависимость мемо; в `CutLook` (~1950) — `islandFacade: state.islandFacade`; сбрасывать `islandFacade` там же, где `upperFacade` (~1109, «Вся кухня» ~3059–3062); «Остров» — только при `shape === 'island'`.
- В 3D ряд острова строится с `ctx.mats.facade = island` — видимые боковины корпусов острова тоже цвета острова.

## Из таска 01 — RAL и декоры (на ревью)

- `ral.ts`: `RalColor = {code; hex; ru}`, `RAL: RalColor[]` (216 кодов RAL Classic), `ralColor(code)`, `parseRal(input): string | null`.
- `decors.ts`: `DecorBrand = 'egger'|'kronospan'|'lamarty'`, `Decor = {id; brand; code; ru; ky; color; texture?: 'wood'|'concrete'}`, `DECORS` (по 12 на бренд), `DECOR_BRANDS: {id; name}[]`, `decor(id)`, `decorCode(d)` («Egger H1145 ST10»; у Lamarty номеров нет — «Lamarty», `code` пустой).
- `finishes.ts`: `FrontColor` += `code?`, `brand?`; `frontColor('ral-NNNN')` → enamel, `code: 'RAL NNNN'`, ky = ru; `frontColor('dec-…')` → laminate; объект на id кэшируется; `findColors(query, lang = 'ru')` — порядок: код целиком → начало кода → код содержит → название; максимум 60.
- Группировка палитры RAL по первой цифре — на экране (таск 03).

## Из таска 03 — экран и выгрузки (на ревью)

- `finishes.ts`: `frontLabel(c: FrontColor, lang = 'ru'): string` — «RAL 7016 Антрацитово-серый», «Egger H1145 ST10 …», «Lamarty Графит»; это `CutMaterial.label` раскроя.
- `order.ts`: `FacadeTier = 'lower'|'upper'|'island'`; `facadeTiers(state): {tier, color: FrontColor}[]` — цвета, которые реально стоят (без «как в стиле»); `whatsappText` — строка «Фасады: низ — …, верх — …, остров — …».
- `master.ts`: `EstimateRow.color?`; строки фасадов — по материалу и цвету, цена — по материалу.
- `texts.ts`: `t.colors.*` (ral, decor, ralCode, ralMissing, ralGroups[9], search, notFound(q), approx, asLower…), `t.waFronts`, `t.frontTier`, `finishTarget.island`, `master.rowFront(mat, color?)`.
- Экран: «Для чего» — Вся кухня / Низ / Верх / Остров (остров при `shape==='island'`); RAL — поле кода (`inputmode=numeric`, кнопка «Применить») + 9 сворачиваемых групп; декоры — чипы брендов; поиск — `findColors`.

## Из таска 04 — правки ревью и корпус в 3D (на ревью)

- Kronospan: 12 декоров, у всех ЛДСП в продукции (K101, K112, 0540, K164, K190, K001–K004, K086, K350, K353); убраны K091/K200/K201/K203/K205 (не ЛДСП). RAL: +9012, −6040 (не Classic), источник sRGB — en.wikipedia «List of RAL colours».
- `share.ts`: `if=` пишется только при `shape === 'island'`.
- `Mats.body` — материал корпуса (`catalogFront(frontColor('lam-white'))`, как белый корпус раскроя); `carcass()` рисует боковины, дно, крышу, спинку, полки материалом `body`; короб антресоли, ниша и портал холодильника — `body`. Фасады, подъёмники, планки, доборы, задняя панель острова, пилястры камина, короб модуля-добора — цвет фасада.
- `materials.ts`: остров того же цвета, что низ, — тот же материал, без пометок `island`.
