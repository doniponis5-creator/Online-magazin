# Интерфейсы прогона kitchen-3d-pro

## Правила проекта (для каждого исполнителя)

- Стек: Next.js 16 (App Router), React 19, TypeScript, three ^0.186, vitest, Playwright. Новых npm-пакетов не ставить — если без пакета никак, вернуть `BLOCKED` с объяснением.
- Команды: типы `npx tsc --noEmit` · тесты `npx vitest run` · сборка `npx next build --webpack` (turbopack в этом worktree падает на symlink `node_modules`) · dev-сервер только через preview `storefront-webpack` (`npx next dev --webpack -p 3001`), не через Bash.
- После таска: tsc, vitest и build зелёные; коммит на русском в стиле репозитория (`feat(кухня): …`, `fix(кухня): …`), с `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Не трогать: `integrations/`, `ios/`, `android/`, `deploy/`, `infra/`, серверные части. Никаких деплоев.
- Дизайн: только токены `DESIGN.md` (цвета, шрифт Manrope, радиусы, отступы). Лимонная (`btn--primary`) кнопка — одна на экран. Касание ≥ 44 px.
- Тексты: `src/components/kitchen/texts.ts` — RU и KY одновременно (тип `Texts = typeof ru`); без ключа в KY tsc падает.
- Старые ссылки (`?f=…&a=…`) и 12 готовых кухонь (`src/data/kitchen-ready.ts`) должны открываться той же кухней. 851 существующий тест не удалять и не ослаблять.
- Аудит с доказательствами и номерами строк: `.autopilot/2026-09-29-kitchen-3d-mobile-audit/` (audit-move.md — модель и жесты, audit-render.md — рендер, audit-screen.md — экран).
- Оркестратор не пишет код проекта; исполнитель делает всё, включая тесты, сам.

## Границы, решённые в спецификации

| Модуль | Владеет | Выставляет | Прячет |
|---|---|---|---|
| `layout` (`src/lib/kitchen/layout.ts`, `types.ts`) | порядок модулей, `at`, пустые места `gN` (вид `gap`), ручной верх `uN`, авто-заполнение | `planKitchen(state)`, `placeAt(state, key, wall, cm) -> {state, fit}`, `addAt(state, wall, cm, kind) -> {state, key}`, `detachUppers(state, wall)`, `itemPositions(plan)`, `narrowFor(state, key, wall, cm) -> {neighbour, by} \| null` | как считается заполнение, снап, ширины |
| `drag` (`src/lib/kitchen/drag.ts`, новый) | геометрия перемещения | `previewMove(plan, key, wall, cm, grab) -> {center, fits, snap, labels, narrow}` | вычисление подписей и линий |
| `quality` (`src/components/kitchen/three/quality.ts`, новый; заменяет `governor.ts`) | класс устройства и регулятор | `pickTier() -> Tier`, `Tier` (материалы, ratio, тени, K, MSAA), `Governor` | проверки устройства |
| `engine` (`src/components/kitchen/three/engine.ts`) | сцена, камера, жесты | `setKitchen`, `setSelected`, события `onPick(key)`, `onDrag(phase, key, wall, cm, grab)`, `snapshot4k`, `setView` | материалы, свет, пересборка по частям |
| `PlanView` (`src/components/kitchen/PlanView.tsx`, новый) | SVG и жесты плана | props `plan, selected, preview, onPick, onDrag` | масштаб, размерные цепочки |
| `planner` (`src/components/kitchen/KitchenPlanner.tsx`) | состояние, шаги, адрес, панель | использует всё выше | — |
| `share` (`src/lib/kitchen/share.ts`) | кодирование состояния | `queryFromState`, `stateFromQuery` (новые поля `g`, `u` необязательны) | формат полей |

Швы для тестов: `layout` (уже покрыт), `drag` (чистые функции), `share` (круговой тест). `engine`, `PlanView` — Playwright + глазами в размере телефона.

### Общий контракт «перетаскивание» (для engine, PlanView, planner)

```ts
type DragPhase = 'start' | 'move' | 'end' | 'cancel'
// wall: 'A' | 'B' | 'C' | 'I'; cm — позиция ПАЛЬЦА вдоль стены от угла; grab — смещение центра модуля от точки захвата, см (запоминается на 'start')
onDrag(phase: DragPhase, key: string, wall: Wall, cm: number, grab: number): void
// planner отвечает предпросмотром (из drag.previewMove) → engine/PlanView рисуют:
type Preview = { center: number; width: number; wall: Wall; fits: boolean; snap: 'wall' | 'neighbour' | 'opposite' | null; labels: { left: number; right: number }; narrow: { neighbour: string; by: number } | null }
```

## Что построили таски

(дополняется после каждого таска)

### Таск 03 — жесты в 3D (`engine.ts`, `build.ts`, `KitchenPlanner.tsx`, `layout.ts`, `share.ts`, `texts.ts`, `e2e/`)

**Движок (`KitchenEngine`), события:** `EngineEvents = { onPick(pick); onDrag(phase: DragPhase, key: string, wall: WallId, cm: number, grab: number); onError() }` — `onMove`/`onPreview`, `DragTarget`, `DragPreview`, `HOLD_MS` убраны. `key` — ключ модуля **как в сцене**: предмет `sink`/`fridge`/`k1`, автошкаф низа `A120` (`baseKey`), верх `a120` (`upperKey`, и для `uN` тоже — ключ по началу в ряду). `cm` — палец от угла; `grab` считается на `'start'` по точке нажатия и повторяется во всех фазах. Правило пальца: тап (≤ 10 px, ≤ 400 мс) — `onPick`; тянуть выбранный (`setGrab(key)` совпал с ключом под пальцем) — после 10 px касанием / 5 px мышью `'start'`; невыбранный/пусто — OrbitControls; второй палец (`!isPrimary`) — OrbitControls, идущее перетаскивание → `'cancel'`; Esc — `'cancel'`. Дверца открывается тапом только по уже выбранному. Луч — вертикальная плоскость фронта ряда (`DEPTH`), ближайший по лучу ряд под пальцем, запасной — пол; мимо кухни — цели нет, отпускание = `'cancel'`.

**Движок, новые методы:** `setPreview(pv: Preview | null)` — планировщик зовёт синхронно из `onDrag('move')`: объект (группа сетки) переезжает в `pv.center` на `pv.wall` без пересборки, рамка синяя/красная (`fits`), линия снапа и рамка соседа (`snap`), HTML-метки `drag:left`/`drag:right` (планировщик рендерит `<span ref=setTag('drag:left')>`). После `'end'` объект остаётся на новом месте до `setKitchen`; не встал — `revertDrag()`. `cancelDrag()`, `selectedKey()`, `placeOf(key) -> { wall, center, w, row } | null`, `screenPointOf(key, dx?)`, `screenPointOnWall(wall, cm, y?)`, поле `lastDrag` — для e2e (`window.__kp` в dev). `setGrab(key)` — как раньше, но смена ключа отменяет идущее перетаскивание; планировщик ставит его из `moving` или из `editing.row === 'upper'`.

**Связка в планировщике (переиспользовать в таске 04 для `PlanView.onDrag`):** `onDragRef.current(phase, key, wall, cm, grab)` — `'start'`: `dragBaseFor(key)` → `{ key: ItemKey, state, plan, cab }` (автошкаф → `pinCabinet` в `kN` на том же месте, верхний автошкаф → `detachUppers` + поиск `uN` по середине; состояние на старте **не коммитится**, картинка та же); `'move'`: `previewMove(base.plan, base.key, wall, cm, grab)` → `engine.setPreview` (план: тот же вызов с `{ opposite: true }` и свой рисовальщик); `'end'`: `placeAt(base.state, key, wall, cm, trial, grab)` → `commitPlaced` (история, выбор остаётся: низ — `setMoving({key})`, верх — `setEditing({ key: upperKey(wall, x), row: 'upper' })`), не встал → `engine.revertDrag()` + тост `t.noRoomNarrow(name, by)` с действием `t.narrowAct` (`narrowFor` → `narrowed(state, neighbour, by)` → `placeAt`), сузить некого — `t.noRoom`. Подсказка: `hint` показывается до первого удачного `'end'` (`markHintSeen()` пишет `localStorage['kp-hint-seen']='1'`), не гаснет от касания и выбора; снова — кнопка «?» (`setHint(true)`). Смена ширины стены: `resize(patch)` → `resizeWalls(state, sizes, plan)` (at/gaps/manualUppers переносятся явно). `order` строится с `state.gaps`. Тексты: `hint`, `touchHint` (новое правило), `noRoomNarrow`, `narrowAct`, `emptyPlace` (RU+KY).

**`build.ts`:** `runKey` привязывает фасады к ряду по модулям ряда (`k1`/`u1` — только свой ряд; `A…`/`a…` — по букве); мелочи (лимоны, доска, чайник) назначаются заранее `decorPlan(plan, lite) -> Map<runId, Decor>` и входят в ключ ряда — вклад ряда не зависит от порядка сборки. **`layout.ts`:** `detachUppers` не превращает добор (`filler`) в `uN` — остаток ряда снова добор. **`share.ts`:** `uppersToQuery` ужимает ширину `uN` до `UPPER_MIN` (20), не до 2.

**e2e:** `e2e/kitchen-gestures.spec.ts` — синтетические PointerEvent на холсте через `window.__kp` (тап-выбор, захват у края, отмена вторым пальцем, перенос на другую стену + тост «Сузить»). Запуск против dev-сервера: конфиг с `baseURL` и без `webServer` (в `playwright.config.ts` baseURL 3100 зашит — таск 04+ может вынести в `PW_BASE_URL`).

### Таск 02 — качество и скорость (`quality.ts`, `engine.ts`, `build.ts`, `materials.ts`)

**`src/components/kitchen/three/quality.ts`** (заменил `governor.ts`; чистые функции, без three):

```ts
type TierName = 'desktop' | 'desktop-weak' | 'phone' | 'phone-low' | 'photo'
type Tier = { name; mobile; physical; lite; detail; shadow; msaa; fxaa; composer; roomProbe; pathTrace; texBudget; restBudget;
              moveRatio(dpr) -> number; restRatio(dpr, cssW, cssH) -> number }
type DeviceEnv = { coarse; fine; memory?; cores; gpu; dpr }
readEnv(gpu = '') -> DeviceEnv                       // из window/navigator; gpu передаёт движок (нужен контекст WebGL)
pickTier(env = readEnv(), force?: TierName) -> Tier  // localStorage не читается и не пишется; force: 'photo' — временный класс для снимка 4K
newGovernor(now = 0) -> GovernorState                // { level 0..5, times, calmSince }
governStep(s, dtMs, nowMs) -> GovernorState          // 10 кадров в среднем > 30 мс → level+1; 3 с без кадров > 25 мс → level−1
governIdle(s, nowMs) -> GovernorState                // покой: восстановление по часам
governorPlan(level, tier, dpr) -> { shadow, detail, ratio }  // 1: тени 1024, 2: тени выкл, 3: K/2, 4: ratio×0,75, 5: ratio = 0,85 (dpr ≥ 2) / 0,75
```

Классы: `phone` — MeshStandard (без clearcoat/sheen/anisotropy), K=1, тени 2048 статичные, MSAA выкл + FXAA, движение min(dpr,1,5), покой min(dpr,3) в 4 Мп, без снимка комнаты и трассировки, сборка полная (не lite). `phone-low` (память ≤ 3 ГБ, не-Apple ≤ 4 ядер, слабый GPU) — то же, но lite-сборка (без внутренностей/посуды/декора), тени 1024, движение 1, покой min(dpr,2) в 2,4 Мп. `desktop` — как раньше 4K (Physical, K=2, тени 4096, GTAO, покой до 3× в 8,3 Мп). `desktop-weak` (встроенная графика) — тени 2048, покой до 2× в 4 Мп. `photo` — Physical, K=2 (на phone-low K=1), тени 2048, снимок комнаты.

**Движок (`KitchenEngine`), что изменилось в публичном API:**
- `getTier() -> Tier` — новый. `setQuality(q)` — безвредная заглушка (ничего не делает); `getQuality()` — `'4k'` на компьютере, `'hd'` на телефоне (для подписи, пока таск 06 не убрал переключатель). `restPixels()` — как раньше.
- `setKitchen(input, motion, reframe)` — сигнатура та же; внутри пересборка по частям: `buildKitchen(input, old.parts)` — ряд с тем же ключом (стена + шкафы + техника с фото + свои фасады при тех же общих настройках) берётся готовым. Dev-консоль: `kitchen build: пересобрано стен N из M (A, B)`. Смена стиля/цвета/столешницы/комнаты — полная пересборка (это общий ключ). Приход фото техники — пересборка только её стены (карта-only не сделана: без фото геометрия лица другая).
- `startPhoto()` на телефоне (`tier.pathTrace = false`) сразу возвращает `'failed'` — планировщик уходит в `snapshot4k`, трассировка не запускается. `prewarmPhoto()` — только `desktop`.
- `snapshot4k()` на телефоне временно переключает класс на `photo` (пересборка с полными материалами, тени 2048, снимок комнаты), рисует 3840 px четырьмя плитками при 1× и возвращает живой класс. На компьютере — как раньше (1,5× через композер).
- `thumbnail(input, w, h)` — теперь с кэшем (ключ: стиль + тон + форма/размеры/техника/комната, до 24 штук). Новый `thumbnailAsync(input, w, h) -> Promise<string>` — ждёт простоя 300 мс (нет жестов/анимаций) и рисует ≤ 8 эскизов за один простой; из кэша — сразу. Таск 06: карусель стилей → `thumbnailAsync`. На `phone-low`, если сборка эскиза заняла > 200 мс, дальше эскизы без пересборки: снимок своей кухни, перекрашенный в `tone.facade` композицией `color` (решение таска 02).
- Холст: `renderer.setSize/setPixelRatio` — только в `resize()` и снимках; жест меняет цель композера (`applyRatio`). На телефоне холст в родных точках экрана (restRatio), в движении цель 1,5× и FXAA растягивает. Тени: `shadowMap.autoUpdate=false`, `needsUpdate` после `setKitchen`, смены света, в кадрах с анимацией (дверцы, волна стиля). Шейдеры: `compileAsync` при первой сборке (оба варианта теней), кадры до конца компиляции не рисуются.
- Обработчики указателя/жестов (onDown/onMove/onUp, startDrag/moveDrag/stopDrag) не тронуты — таск 03.

**`build.ts`:** `BuildInput.physical?: boolean` (по умолчанию true); `buildKitchen(input, reuse?: ReadonlyMap<string, RunCache>) -> Built`; `Built.parts: Map<runId, RunCache>`, `Built.rebuilt: string[]`, `Built.dispose(keep?)`. Вечерние лампы днём `visible=false` и `intensity=0`. **`materials.ts`:** `createMaterials(..., lite, physical)`, `Mats.physical`. **`parts.ts`:** у ручек `castShadow=false`. **`appliances.ts`:** плитка с фото помечена `userData.photoFace`.


### Таск 01 — модель расстановки (`layout.ts`, `types.ts`, `share.ts`, новый `drag.ts`)

**Состояние (`KitchenState`, `types.ts`):**

```ts
type GapId = `g${number}`; type UpperId = `u${number}`
type ItemKey = FixedItem | CabinetId | GapId | UpperId          // isGap(k), isUpperCab(k) — как isCabinet
type Gap = { w: number; strip?: boolean }                        // пустое место; strip — закрыто декоративной планкой
type UpperCab = { w: number; kind: 'doors' | 'shelf' }
KitchenState.gaps?: Record<GapId, Gap>                           // ключи gN стоят в arrangement (низ) или в manualUppers (верх)
KitchenState.manualUppers?: Partial<Record<WallId, ItemKey[]>>   // стена в карте → её верх ручной: порядок uN и gN; нет — верх из низа, как раньше
KitchenState.upperCabs?: Record<UpperId, UpperCab>
KitchenState.at?: Partial<Record<ItemKey, number>>               // середина, см от угла — и для gN, и для uN (одна карта)
```

**План (`Plan`, `layout.ts`):** `Run.modules` — без пустых мест (3D-сборка, чертёж, спецификация, раскрой, Excel, PDF их не видят автоматически); `Run.gaps?: { x; w; item: GapId; row: 'base' | 'upper' }[]` — пустые места в координатах ряда (как модули); `Upper.item?: UpperId` — шкаф ручного верха. `itemPositions(plan)` возвращает и gN, и uN: `ItemPlace = { wall; center; w; row?: 'upper' }`. Вытяжка, угловой, шкаф над холодильником, пусто над пеналами и под окном в ручном ряду — фиксированные (из низа). `PlanInput` получил `gaps`, `manualUppers`, `upperCabs` (`order.planInputOf` их передаёт). `resolveArrangement(shape, custom, cabinets, gaps?)` — 4-й аргумент, иначе gN выпадут из порядка. `resolveRun` возвращает `LaidModule[]` (`kind: ModuleKind | 'gap'`).

**Постановка (чистые функции, `layout.ts`):**

```ts
type Planner = (s: KitchenState, snap?: ItemKey[]) => Plan       // экран: (s, snap) => planKitchen(planInputOf(s, chosen, snap), { shelves })
type Fit = { ok; center; w; wall; row: 'base'|'upper'; snap: 'wall'|'neighbour'|'opposite'|null; need; narrow: { neighbour: ItemKey; by: number } | null;
             free: { from; to }; neighbours: { left: ItemKey|null; right: ItemKey|null } }
fitOn(plan, key, wall, center, opts?: { w?; row?; opposite? }) -> Fit | null      // геометрия: соседи, снап 6 см, столешница 30 см у плиты (HOB_SIDE)
placeAt(state, key, wall, cm, planner, grab = 0, opts?: { w? }) -> { state; fit }  // центр = cm − grab; не встал → state прежний, fit.ok=false
addAt(state, wall, cm, kind: 'doors'|'drawers'|'pantry'|'strip'|'fill'|FixedItem, planner) -> { state; key: ItemKey | null }
detachUppers(state, wall, plan) -> KitchenState                   // верх стены → ручной (uN + gN за дыры); картинка не меняется; повторно — тот же объект
narrowFor(plan, key, wall, cm, opts?) -> { neighbour; by } | null
resizeWalls(state, { a?, b?, c?, island? }, plan) -> KitchenState // at и gap сохраняются; за краем — придвинуть/ужать/убрать (вместо KP:1110 `at: undefined`)
allowedOn(wall, key), minWidthOf(key), gapWidth(w), HOB_SIDE = 30
```

Правила `placeAt`: все остальные `at` замораживаются (как `frozen` в планировщике); освобождённое место → `gN` той же ширины (если новое положение его не перекрывает); пустые места под новым положением убираются/ужимаются; верхний шкаф на стену с автоматическим верхом — та стена сначала `detachUppers`; проверка пробной раскладкой (ничего нового не выпало). Пустые места не считаются потерей: `place` роняет их первыми и молча (не в `dropped`).

**Предпросмотр (`src/lib/kitchen/drag.ts`):**

```ts
type Preview = { center; width; wall; fits; snap; labels: { left; right }; narrow; need }
previewMove(plan, key, wall, cm, grab, opts?: { opposite?: boolean }) -> Preview | null   // 3D: без opposite; план: opposite = true
grabOf(plan, key, cm) -> number                                    // на 'start': смещение пальца от середины, см; дальше передаётся в previewMove/placeAt
```

**Адрес (`share.ts`):** пустые места — в `o=` как элементы порядка стены: `40g_080` (пусто 40 см, середина 80), `40x_080` (с планкой); отдельного `g=` нет — порядок хранится в одном месте. Ручной верх — `u=`: стены через точку в порядке `wallsOf`, пустая часть — авто, `~` — ручной без шкафов, элемент `<ширина мм 2–4 цифры><d|s|g|x>[_<середина мм, 4 цифры>]`, например `u=600d_0300900g_2950625s_1315`. Старые ссылки без них открываются как прежде; снимок 12 готовых кухонь и старых адресов — `__tests__/kitchen-layout-snapshot.test.ts`.

**Для таска 03 (`build.ts`, `engine.ts`, `KitchenPlanner.tsx`):** `Run.gaps` рисовать контуром при выборе (модули их не содержат — ничего пропускать не нужно); `gap.strip` — декоративная планка (панель по ширине места, не шкаф; в спецификацию пока не идёт — решить в 03/05); `Upper.item` — выбираемый/перетаскиваемый верх, у `itemPositions` он с `row: 'upper'`; на drop — `placeAt(state, key, wall, cm, trial, grab)` вместо `moveItem`+`frozen`+`apply`; «+» — `addAt`; смена ширины стены — `resizeWalls`; `resolveArrangement(..., state.gaps)` везде, где планировщик строит `order`. **Для таска 04 (`PlanView`):** `previewMove(..., { opposite: true })`, пунктир с «+» по `run.gaps`.
