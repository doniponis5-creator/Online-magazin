# 02 — Свой цвет острова: состояние, ссылка, 3D, раскрой

**Требования:** R10, R10.1, R11 (ссылка), R14i
**Blocked by:** —
**Зона:** `src/lib/kitchen/types.ts` · `src/lib/kitchen/share.ts` · `src/components/kitchen/three/materials.ts` · `src/components/kitchen/three/build.ts` · `src/lib/kitchen/spec.ts` · `src/lib/kitchen/cutting.ts` · тесты `kitchen-share`, `kitchen-cutting`, `kitchen-build`
**Волна:** 1 (параллельно с 01 — зоны не пересекаются; НЕ трогать `finishes.ts`, `KitchenPlanner.tsx`, `texts.ts`)
**Status:** ready

## Что должно заработать

Кухня с островом и `islandFacade` — фасады острова и его задняя панель в 3D своего цвета, в раскрое — свои строки и своя группа листов. Без `islandFacade` — всё как раньше (остров как низ).

## Из брифа, дословно

> «Orol (ostrov) uchun uchinchi rang.»

## Разделы спецификации

Истории 9–11, 13; Решения §5; Границы (share.ts, three, cutting.ts).

## Критерии приёмки

- [ ] `KitchenState.islandFacade?: string` (id отделки через `frontColor`; нет — как у низа); ключ ссылки `if`; туда-обратно; неизвестный id отбрасывается, как у `fc`; старые ссылки без `if` — как раньше; автосохранение сохраняет
- [ ] 3D: `FinishLook.island?: FrontColor`; `createMaterials` даёт материал острова (каталожный фасад → `catalogFront`, нет → `facade`); фасады модулей острова и задняя панель острова — этим материалом. Как экран строит `FinishLook` — в `KitchenPlanner.tsx` сейчас (строки ~742–749); **сам экран не меняй** — оставь в отчёте, какое поле экран должен передать (это сделает таск 03)
- [ ] `SpecFront.island?: boolean`, `SpecExtra` панели острова — `island: true` (ставит `build.ts`, как `upper`); `CutLook.islandFacade?: string | CutFinish`; `cutParts` красит фасады и панель острова цветом острова (нет — как низ); своя группа листов, если ЛДСП; «Фасады» в Excel — свой цвет
- [ ] Тесты: ссылка с `if` туда-обратно и мусор; `buildKitchen` острова с `islandFacade` — фасады острова помечены `island`, у задней панели тоже; `cutParts` — фасады острова своим цветом, число деталей прежнее; без `islandFacade` — всё как раньше
- [ ] `npx tsc --noEmit`, `npx vitest run` зелёные
