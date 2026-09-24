import { HANDLE_METALS, HANDLES, frontColor, splashChoice, topChoice } from './finishes'
import { frontsFromQuery, frontsToQuery } from './fronts'
import { CEILING, COLUMN_HEIGHT, LIMITS, minA, sizedWidth, WIDTH_LIMITS, WINDOW_LIMITS, wallsOf } from './layout'
import { FLOORS, STYLES, WALL_COLORS } from './styles'
import {
  COLUMN_ITEMS,
  isCabinet,
  SIZED_ITEMS,
  SLOTS,
  type SizedItem,
  type Arrangement,
  type BaseFront,
  type Cabinet,
  type CabinetId,
  type FixedItem,
  type ItemKey,
  type KitchenState,
  type Picks,
  type Shape,
  type SlotKind,
  type StyleId,
} from './types'

/**
 * Проект кухни в адресе страницы: ссылкой можно поделиться, и у получателя
 * откроется та же кухня. Всё, что пришло из адреса, проверяется.
 */

const SHAPES: Shape[] = ['straight', 'corner', 'u', 'island']
const SLOT_KEYS: Record<SlotKind, string> = {
  fridge: 'fr',
  oven: 'ov',
  microwave: 'mw',
  hob: 'hb',
  hood: 'hd',
  dishwasher: 'dw',
  washer: 'wm',
}

/**
 * Порядок предметов в адресе: стены через точку (в порядке wallsOf), предмет —
 * одной буквой, свой шкаф — шириной и буквой фасада: «s60hd.hv» — мойка, шкаф
 * 60 см с тремя ящиками, посудомойка; на второй стене плита и духовка.
 */
const ITEM_CODE: Record<FixedItem, string> = { fridge: 'f', tall: 't', sink: 's', dishwasher: 'd', washer: 'w', hob: 'h', pantry: 'p', pantry2: 'q', oven: 'v' }
const CODE_ITEM = Object.fromEntries(Object.entries(ITEM_CODE).map(([k, v]) => [v, k])) as Record<string, FixedItem>
const FRONT_CODE: Record<BaseFront, string> = { doors: 'o', drawers2: 't', drawers3: 'h', drawers4: 'f', mix: 'm', open: 'n' }
const CODE_FRONT = Object.fromEntries(Object.entries(FRONT_CODE).map(([k, v]) => [v, k])) as Record<string, BaseFront>
/** Предмет может стоять на своём месте: «s_095» — мойка, середина в 95 см от угла (всегда три цифры). */
const TOKEN = /(\d{2,3}[othfmn]|[ftsdwhpqv])(?:_(\d{3}))?/g
/** Своя ширина: «wd=s80h90» — мойка 80 см, шкаф под плитой 90 см. */
const WIDTH_CODE: Record<SizedItem, string> = { sink: 's', hob: 'h', pantry: 'p', pantry2: 'q', tall: 't' }

type Placed = { arrangement?: Arrangement; cabinets?: Record<CabinetId, Cabinet>; at?: Partial<Record<ItemKey, number>> }

function arrangementFromQuery(raw: string | null, shape: Shape): Placed {
  if (!raw || raw.length > 400 || !/^(?:\d{2,3}[othfmn]|[ftsdwhpqv]|_\d{3}|\.)+$/.test(raw)) return {}
  const arrangement: Arrangement = {}
  const cabinets: Record<CabinetId, Cabinet> = {}
  const at: Partial<Record<ItemKey, number>> = {}
  let n = 0
  const walls = wallsOf(shape)
  raw.split('.').forEach((part, i) => {
    const wall = walls[i]
    if (!wall) return
    const list: ItemKey[] = []
    for (const [, token, pos] of part.matchAll(TOKEN)) {
      let key: ItemKey
      if (token.length === 1) key = CODE_ITEM[token]
      else {
        key = `k${++n}`
        cabinets[key] = { w: clamp(Number(token.slice(0, -1)), WIDTH_LIMITS.cabinet.min, WIDTH_LIMITS.cabinet.max), front: CODE_FRONT[token.slice(-1)] }
      }
      list.push(key)
      if (pos !== undefined) at[key] = clamp(Number(pos), 0, 700)
    }
    arrangement[wall] = list
  })
  return { arrangement, ...(n ? { cabinets } : {}), ...(Object.keys(at).length ? { at } : {}) }
}

function arrangementToQuery(arr: Arrangement, shape: Shape, cabinets: KitchenState['cabinets'], at: KitchenState['at']): string {
  const pos = (k: ItemKey) => (at?.[k] !== undefined ? `_${String(Math.max(0, Math.min(700, Math.round(at[k]!)))).padStart(3, '0')}` : '')
  return wallsOf(shape)
    .map((w) =>
      (arr[w] ?? [])
        .map((k) => {
          if (!isCabinet(k)) return ITEM_CODE[k] + pos(k)
          const c = cabinets?.[k]
          return c ? `${Math.round(c.w)}${FRONT_CODE[c.front]}${pos(k)}` : ''
        })
        .join(''),
    )
    .join('.')
}

function widthsFromQuery(raw: string | null): KitchenState['widths'] {
  if (!raw || raw.length > 40) return undefined
  const out: NonNullable<KitchenState['widths']> = {}
  for (const [, code, v] of raw.matchAll(/([shpqt])(\d{2,3})/g)) {
    const key = SIZED_ITEMS.find((k) => WIDTH_CODE[k] === code)
    if (key) out[key] = sizedWidth(key, Number(v))
  }
  return Object.keys(out).length ? out : undefined
}

/** Дверцы вправо: «dr=A120.a60.k1.sink» — ключи шкафов через точку. */
const DOOR_KEY = /^(?:[ABCIabci]\d{1,3}|k\d{1,3}|sink|tall|pantry2?|hob)$/

function doorsFromQuery(raw: string | null): string[] | undefined {
  if (!raw || raw.length > 400) return undefined
  const out = [...new Set(raw.split('.').filter((k) => DOOR_KEY.test(k)))]
  return out.length ? out : undefined
}

/** Своя высота колонн: «ht=p200t230» — пенал 200 см, колонна с духовкой 230 см. */
const HEIGHT_CODE: Record<(typeof COLUMN_ITEMS)[number], string> = { pantry: 'p', pantry2: 'q', tall: 't' }

function heightsFromQuery(raw: string | null): KitchenState['heights'] {
  if (!raw || raw.length > 20) return undefined
  const out: NonNullable<KitchenState['heights']> = {}
  for (const [, code, v] of raw.matchAll(/([pqt])(\d{3})/g)) {
    const key = COLUMN_ITEMS.find((k) => HEIGHT_CODE[k] === code)
    if (key) out[key] = clamp(Number(v), COLUMN_HEIGHT.min, CEILING.max)
  }
  return Object.keys(out).length ? out : undefined
}

function heightsToQuery(heights: KitchenState['heights']): string {
  return COLUMN_ITEMS.filter((k) => heights?.[k] !== undefined)
    .map((k) => `${HEIGHT_CODE[k]}${Math.round(heights![k]!)}`)
    .join('')
}

function widthsToQuery(widths: KitchenState['widths']): string {
  return SIZED_ITEMS.filter((k) => widths?.[k] !== undefined)
    .map((k) => `${WIDTH_CODE[k]}${Math.round(widths![k]!)}`)
    .join('')
}

export const DEFAULT_STATE: KitchenState = {
  shape: 'corner',
  a: 300,
  b: 240,
  c: 220,
  island: 180,
  style: 'marble',
  tone: 0,
  picks: {},
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

function size(raw: string | null, key: keyof typeof LIMITS, fallback: number): number {
  const v = Math.round(Number(raw))
  if (!raw || !Number.isFinite(v)) return fallback
  return clamp(v, LIMITS[key].min, LIMITS[key].max)
}

export function stateFromQuery(query: URLSearchParams, known: Set<string>): KitchenState {
  const shape = SHAPES.find((s) => s === query.get('f')) ?? DEFAULT_STATE.shape
  const style = (STYLES.find((s) => s.id === query.get('s'))?.id ?? DEFAULT_STATE.style) as StyleId
  const toneRaw = Number(query.get('t'))
  const tone = Number.isInteger(toneRaw) ? clamp(toneRaw, 0, 2) : 0
  const picks: Picks = {}
  for (const slot of SLOTS) {
    const v = query.get(SLOT_KEYS[slot])
    if (v === '-') picks[slot] = null
    else if (v && known.has(v)) picks[slot] = v
  }
  const a = Math.max(size(query.get('a'), 'a', DEFAULT_STATE.a), minA(shape))
  const { arrangement, cabinets, at } = arrangementFromQuery(query.get('o'), shape)
  const widths = widthsFromQuery(query.get('wd'))
  const heights = heightsFromQuery(query.get('ht'))
  const doorsRight = doorsFromQuery(query.get('dr'))
  const pantries = clamp(Math.round(Number(query.get('pn')) || 0), 0, 2)
  const num = (key: string, min: number, max: number) => {
    const raw = query.get(key)
    const v = Math.round(Number(raw))
    return raw && Number.isFinite(v) ? clamp(v, min, max) : undefined
  }
  const ceiling = num('h', CEILING.min, CEILING.max)
  const windowW = num('ww', WINDOW_LIMITS.min, WINDOW_LIMITS.max)
  const floor = FLOORS.find((f) => f.id === query.get('fl'))?.id
  const wallColor = num('wc', 1, WALL_COLORS.length - 1)
  const fronts = frontsFromQuery(query.get('fx'))
  const facade = frontColor(query.get('fc') ?? undefined)?.id
  const upperFacade = query.get('uf') === 'style' ? 'style' : frontColor(query.get('uf') ?? undefined)?.id
  const overFridgeFacade = frontColor(query.get('ofc') ?? undefined)?.id
  const top = topChoice(query.get('tp') ?? undefined)?.id
  const splash = splashChoice(query.get('sp') ?? undefined)?.id
  const handle = HANDLES.find((h) => h.id === query.get('hd'))?.id
  const handleMetal = HANDLE_METALS.find((m) => m.id === query.get('hm'))?.id
  const hl = query.get('hl')
  return {
    shape,
    a,
    b: size(query.get('b'), 'b', DEFAULT_STATE.b),
    c: size(query.get('c'), 'c', DEFAULT_STATE.c),
    island: size(query.get('i'), 'island', DEFAULT_STATE.island),
    style,
    tone,
    picks,
    ...(arrangement ? { arrangement } : {}),
    ...(query.get('po') === '1' ? { tallOven: true } : {}),
    ...(pantries ? { pantries } : {}),
    ...(ceiling && ceiling !== CEILING.base ? { ceiling } : {}),
    ...(query.get('uc') === '0' ? { lowUppers: true } : {}),
    ...(query.get('nw') === '1' ? { noWindow: true } : {}),
    ...(windowW ? { windowW } : {}),
    ...(query.get('fn') === '0' ? { fridgeOpen: true } : {}),
    ...(floor ? { floor } : {}),
    ...(wallColor ? { wallColor } : {}),
    ...(fronts ? { fronts } : {}),
    ...(query.get('oa') === '1' ? { ovenApart: true } : {}),
    ...(cabinets ? { cabinets } : {}),
    ...(at ? { at } : {}),
    ...(widths ? { widths } : {}),
    ...(heights ? { heights } : {}),
    ...(doorsRight ? { doorsRight } : {}),
    ...(facade ? { facade } : {}),
    ...(upperFacade ? { upperFacade } : {}),
    ...(overFridgeFacade ? { overFridgeFacade } : {}),
    ...(top ? { top } : {}),
    ...(splash ? { splash } : {}),
    ...(handle ? { handle } : {}),
    ...(handleMetal ? { handleMetal } : {}),
    ...(hl === '1' ? { handleless: true } : hl === '0' ? { handleless: false } : {}),
  }
}

export function queryFromState(state: KitchenState): string {
  const q = new URLSearchParams()
  q.set('f', state.shape)
  q.set('a', String(state.a))
  if (state.shape === 'corner' || state.shape === 'u') q.set('b', String(state.b))
  if (state.shape === 'u') q.set('c', String(state.c))
  if (state.shape === 'island') q.set('i', String(state.island))
  q.set('s', state.style)
  if (state.tone) q.set('t', String(state.tone))
  for (const slot of SLOTS) {
    const v = state.picks[slot]
    if (v === null) q.set(SLOT_KEYS[slot], '-')
    else if (v) q.set(SLOT_KEYS[slot], v)
  }
  if (state.arrangement) q.set('o', arrangementToQuery(state.arrangement, state.shape, state.cabinets, state.at))
  const wd = widthsToQuery(state.widths)
  if (wd) q.set('wd', wd)
  const ht = heightsToQuery(state.heights)
  if (ht) q.set('ht', ht)
  const dr = (state.doorsRight ?? []).filter((k) => DOOR_KEY.test(k))
  if (dr.length) q.set('dr', dr.join('.'))
  if (state.tallOven) q.set('po', '1')
  if (state.pantries) q.set('pn', String(state.pantries))
  if (state.ceiling && state.ceiling !== CEILING.base) q.set('h', String(state.ceiling))
  if (state.lowUppers) q.set('uc', '0')
  if (state.noWindow) q.set('nw', '1')
  if (state.windowW) q.set('ww', String(state.windowW))
  if (state.fridgeOpen) q.set('fn', '0')
  if (state.floor) q.set('fl', state.floor)
  if (state.wallColor) q.set('wc', String(state.wallColor))
  const fx = state.fronts ? frontsToQuery(state.fronts) : ''
  if (fx) q.set('fx', fx)
  if (state.ovenApart) q.set('oa', '1')
  if (state.facade) q.set('fc', state.facade)
  if (state.upperFacade) q.set('uf', state.upperFacade)
  if (state.overFridgeFacade) q.set('ofc', state.overFridgeFacade)
  if (state.top) q.set('tp', state.top)
  if (state.splash) q.set('sp', state.splash)
  if (state.handle) q.set('hd', state.handle)
  if (state.handleMetal) q.set('hm', state.handleMetal)
  if (state.handleless !== undefined) q.set('hl', state.handleless ? '1' : '0')
  return q.toString()
}
