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
