/**
 * Размеры кухни, см — одно место для раскладки, проверок, адреса, 3D-сборки,
 * чертежа и экрана. Без three.js: экран и чертёж берут числа отсюда напрямую,
 * без загрузки 3D. Поменял число здесь — поменялось везде; рядом его не переписывать.
 */
import type { DiningSeats, HoodKind } from './types'

/** Цоколь (ножки с планкой). */
export const PLINTH = 10
/** Корпус нижнего шкафа — от цоколя до столешницы. */
export const BODY = 72
/** Низ столешницы от пола: цоколь + корпус. Выше — стиральная и отдельностоящая ПММ под столешницу не встанут. */
export const BASE_H = PLINTH + BODY
/** Глубина корпуса нижнего шкафа. */
export const CARCASS_D = 58
/** Глубина столешницы. */
export const TOP_D = 62
/** Толщина фасада (ЛДСП 18 мм). Глубина ряда в раскладке — корпус + фасад (`DEPTH`, `UPPER_DEPTH` в layout.ts). */
export const FRONT_T = 1.8
/** Глубина корпуса верхнего шкафа. */
export const UPPER_CARCASS_D = 33
/**
 * Низ верхних шкафов от пола — 58 см над столешницей. Со встроенной вытяжкой
 * ряд выше — считает только `upperBottomOf` (layout.ts).
 */
export const UPPER_BOTTOM = 142
/** Верх столешницы от пола при её толщине `topCm` (у каждого стиля своя, `Style.topCm`). */
export const counterTop = (topCm: number): number => BASE_H + topCm
/** Отдельностоящая плита и верх столешницы: разницу до стольких см ножки плиты не выровняют заметно — вровень. */
export const STOVE_LEVEL = 1.5

/** Проём встраиваемой ПММ: от пола до низа столешницы; ножки машины добирают ещё до 5 см. */
export const DW_OPENING = { h: BASE_H, hMax: BASE_H + 5 }

/**
 * Нижний шкаф колонны с духовкой — от пола до духовки, см: по умолчанию 83
 * (духовка на уровне глаз), покупатель может сделать его ниже или выше.
 */
export const TALL_BASE = { min: 40, max: 110, base: 83 }
/** Колонна с духовкой не ниже 160 см, а со встраиваемой микроволновкой над духовкой — 200 (при нижнем шкафе 83 см). */
export const TALL_MIN = { oven: 160, withMicrowave: 200 }
/** Не ниже: духовка (и микроволновка) должны влезть над нижним шкафом `base`, см. */
export const tallMin = (builtInMicrowave: boolean, base: number = TALL_BASE.base): number =>
  (builtInMicrowave ? TALL_MIN.withMicrowave : TALL_MIN.oven) + (base - TALL_BASE.base)

/** Высокие модули: под окно не встают, столешницу прерывают. */
const TALL_KINDS: ReadonlySet<string> = new Set(['fridge', 'tall', 'pantry'])
export const isTall = (kind: string): boolean => TALL_KINDS.has(kind)

/** Место под технику — вверх до 5 см. */
export const up5 = (w: number): number => Math.ceil(w / 5) * 5

/** Низ вытяжки над варочной панелью: 65 см над электрической и индукционной, 75 над газовой (D16). */
export const HOOD_OVER = { gas: 75, electric: 65 }
export const hoodNorm = (gas: boolean): number => (gas ? HOOD_OVER.gas : HOOD_OVER.electric)
/**
 * Встроенная вытяжка ниже корпуса своего шкафа, см: полностью встраиваемая —
 * планка 5 мм, телескопическая — ещё козырёк 4,5 см. Каминная и наклонная
 * висят на стене сами, в шкаф не встают — `null`. Вид не указан — как
 * полностью встраиваемая (так её и рисует 3D).
 */
export const HOOD_BELOW = { telescopic: 5, insert: 0.5 }
export const hoodBelow = (kind: HoodKind | undefined): number | null =>
  kind === 'chimney' || kind === 'inclined' || kind === 'flat' ? null : kind === 'telescopic' ? HOOD_BELOW.telescopic : HOOD_BELOW.insert

/**
 * Плоская (подвесная) вытяжка, см: корпус висит под своим верхним шкафом, низ —
 * на норме над панелью; шкаф над ней короче соседей, ряд не поднимается.
 * Размеры типовые (у моделей высота 8–15, глубина 45–50): в карточке их нет.
 */
export const HOOD_FLAT = { h: 12, d: 47 }

/**
 * Обеденная группа (только для примерки, в сумму не входит), см: стол Ш×Г,
 * стульев вдоль каждой длинной стороны (`long`) и в каждом торце (`ends`).
 */
export const DINING: Record<DiningSeats, { w: number; d: number; long: number; ends: number }> = {
  4: { w: 120, d: 80, long: 2, ends: 0 },
  6: { w: 180, d: 90, long: 3, ends: 0 },
  8: { w: 200, d: 100, long: 3, ends: 1 },
}
/** Стул: от края стола до спинки отодвинутого стула, см. */
export const DINING_CHAIR = 55
/** Проход от кухни (фасадов, стульев острова) до обеденной группы, см. */
export const DINING_AISLE = 90

/** Планка у глухой части углового шкафа (низ и верх). */
export const CORNER_STRIP = 3

/** Самая длинная деталь — лист ЛДСП, 2750 мм. */
export const PART_MAX = 275
/** На сколько равных частей делить деталь длиной `len` см, чтобы каждая была не длиннее листа. */
export const partsOf = (len: number): number => Math.max(1, Math.ceil(len / PART_MAX - 1e-9))

/** Окно: подоконник у задней и у левой стены, верх. Типовые, уточнить на месте. В метры переводит только build.ts. */
export const WINDOW = { backSill: 100, leftSill: 90, top: 230 }
/** Верх окна не ближе этого к потолку, см: при низком потолке окно ниже. */
export const WINDOW_GAP = 25
