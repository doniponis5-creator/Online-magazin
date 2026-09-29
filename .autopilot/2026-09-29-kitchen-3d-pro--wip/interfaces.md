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

