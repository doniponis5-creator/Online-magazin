import type { BaseFront, FrontVariant, UpperFront } from './types'

/**
 * Свои фасады отдельных шкафов. Покупатель нажимает на шкаф и выбирает:
 * дверцы, ящики, открытые полки, стекло. Ключ шкафа — ряд и начало шкафа
 * вдоль стены в см: «A120» — низ стены A от 120 см, «a120» — верх.
 * Если кухню перестроили и шкафа с таким началом больше нет, выбор просто
 * не применяется, а не переезжает на чужой шкаф.
 */

export const BASE_FRONTS: BaseFront[] = ['doors', 'drawers3', 'drawers2', 'drawers4', 'mix', 'open']
export const UPPER_FRONTS: UpperFront[] = ['doors', 'glass', 'lift', 'open', 'none']
/**
 * Шкаф над холодильником (в нише): подъёмная дверца, как всегда было, стекло
 * в рамке, две распашные дверцы или открытая полка. Убрать его нельзя —
 * боковины ниши без него остались бы голыми. Ключ — как у верхнего шкафа.
 */
export const OVER_FRIDGE_FRONTS: UpperFront[] = ['lift', 'glass', 'doors', 'open']

/** Ящики: доли высоты фасада сверху вниз. */
export const DRAWER_PARTS: Record<'drawers2' | 'drawers3' | 'drawers4' | 'mix', number[]> = {
  drawers2: [0.5, 0.5],
  drawers3: [0.24, 0.38, 0.38],
  drawers4: [0.25, 0.25, 0.25, 0.25],
  // один ящик сверху, под ним дверцы
  mix: [0.24],
}

export function baseKey(run: string, x: number): string {
  return `${run.toUpperCase()}${Math.round(x)}`
}

export function upperKey(run: string, x: number): string {
  return `${run.toLowerCase()}${Math.round(x)}`
}

export const isUpperKey = (key: string) => /^[abci]/.test(key)

/** Шкафы уже 30 см — бутылочницы и планки: у них свой фасад. */
export const MIN_EDIT_W = 30

const CODE: Record<FrontVariant, string> = {
  doors: 'o',
  drawers2: 't',
  drawers3: 'h',
  drawers4: 'f',
  mix: 'm',
  open: 'n',
  glass: 'g',
  lift: 'l',
  none: 'x',
}
const BY_CODE = Object.fromEntries(Object.entries(CODE).map(([k, v]) => [v, k])) as Record<string, FrontVariant>

/** В адрес: «A120h.a60g» — через точку, вариант одной буквой. */
export function frontsToQuery(fronts: Record<string, FrontVariant>): string {
  return Object.entries(fronts)
    .filter(([key, v]) => validKey(key) && allowed(key, v))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, v]) => `${key}${CODE[v]}`)
    .join('.')
}

export function frontsFromQuery(raw: string | null): Record<string, FrontVariant> | undefined {
  if (!raw || raw.length > 600 || !/^[ABCIabci0-9a-z.]+$/.test(raw)) return undefined
  const out: Record<string, FrontVariant> = {}
  for (const part of raw.split('.')) {
    const m = /^([ABCIabci]\d{1,3})([a-z])$/.exec(part)
    if (!m) continue
    const v = BY_CODE[m[2]]
    if (v && allowed(m[1], v)) out[m[1]] = v
  }
  return Object.keys(out).length ? out : undefined
}

const validKey = (key: string) => /^[ABCIabci]\d{1,3}$/.test(key)

function allowed(key: string, v: FrontVariant): boolean {
  return isUpperKey(key) ? (UPPER_FRONTS as FrontVariant[]).includes(v) : (BASE_FRONTS as FrontVariant[]).includes(v)
}
