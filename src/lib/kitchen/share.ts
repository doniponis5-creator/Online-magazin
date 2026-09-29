import type { Product } from '@/data/products'
import type { Lang } from '@/lib/i18n/config'
import { applianceFromProduct } from './catalog'
import { TALL_BASE, tallMin } from './dims'
import { HANDLE_METALS, HANDLES, frontColor, splashChoice, topChoice } from './finishes'
import { frontsFromQuery, frontsToQuery } from './fronts'
import { CEILING, COLUMN_HEIGHT, CORNER_W, FREE_CORNER, FREE_UPPER, islandTurnOf, LIMITS, minA, sizedWidth, WIDTH_LIMITS, WINDOW_LIMITS, wallsOf } from './layout'
import { FLOORS, STYLES, WALL_COLORS } from './styles'
import {
  COLUMN_ITEMS,
  DINING_SEATS,
  isCabinet,
  SIZED_ITEMS,
  SLOTS,
  type SizedItem,
  type Arrangement,
  type BaseFront,
  type Cabinet,
  type CabinetId,
  type DiningSeats,
  type FixedItem,
  type FreeRoom,
  type FreeUpper,
  type FreeWall,
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
export const SLOT_KEYS: Record<SlotKind, string> = {
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
const FRONT_CODE: Record<BaseFront, string> = { doors: 'o', drawers1: 'e', drawers2: 't', drawers3: 'h', drawers4: 'f', mix: 'm', open: 'n' }
const CODE_FRONT = Object.fromEntries(Object.entries(FRONT_CODE).map(([k, v]) => [v, k])) as Record<string, BaseFront>
/**
 * Предмет может стоять на своём месте: «s_095» — мойка, середина в 95 см от угла
 * (всегда три цифры). Место с половиной сантиметра — в миллиметрах через минус:
 * «s-1325» — середина в 132,5 см. Места двигаются с шагом 0,5 см.
 */
const TOKEN = /(\d{2,3}[othfmne]|[ftsdwhpqv])(?:_(\d{3})|-(\d{4}))?/g
/** Своя ширина: «wd=s80h90» — мойка 80 см, шкаф под плитой 90 см. */
const WIDTH_CODE: Record<SizedItem, string> = { sink: 's', hob: 'h', pantry: 'p', pantry2: 'q', tall: 't' }

type Placed = { arrangement?: Arrangement; cabinets?: Record<CabinetId, Cabinet>; at?: Partial<Record<ItemKey, number>> }

function arrangementFromQuery(raw: string | null, shape: Shape): Placed {
  if (!raw || raw.length > 400 || !/^(?:\d{2,3}[othfmne]|[ftsdwhpqv]|_\d{3}|-\d{4}|\.)+$/.test(raw)) return {}
  const arrangement: Arrangement = {}
  const cabinets: Record<CabinetId, Cabinet> = {}
  const at: Partial<Record<ItemKey, number>> = {}
  let n = 0
  const walls = wallsOf(shape)
  raw.split('.').forEach((part, i) => {
    const wall = walls[i]
    if (!wall) return
    const list: ItemKey[] = []
    for (const [, token, cm, mm] of part.matchAll(TOKEN)) {
      let key: ItemKey
      if (token.length === 1) key = CODE_ITEM[token]
      else {
        key = `k${++n}`
        cabinets[key] = { w: clamp(Number(token.slice(0, -1)), WIDTH_LIMITS.cabinet.min, WIDTH_LIMITS.cabinet.max), front: CODE_FRONT[token.slice(-1)] }
      }
      list.push(key)
      if (cm !== undefined) at[key] = clamp(Number(cm), 0, 700)
      else if (mm !== undefined) at[key] = clamp(Math.round(Number(mm) / 5) / 2, 0, 700)
    }
    arrangement[wall] = list
  })
  return { arrangement, ...(n ? { cabinets } : {}), ...(Object.keys(at).length ? { at } : {}) }
}

/**
 * При разборе адреса свои шкафы получают номера k1, k2… по порядку в адресе.
 * Значит, и при записи ключи шкафов надо перенумеровать так же — иначе
 * «дверца вправо» уедет на другой шкаф. Старый ключ → новый.
 */
function cabinetOrder(arr: Arrangement, shape: Shape, cabinets: KitchenState['cabinets']): Map<string, string> {
  const order = new Map<string, string>()
  for (const w of wallsOf(shape)) {
    for (const k of arr[w] ?? []) {
      if (isCabinet(k) && cabinets?.[k] && !order.has(k)) order.set(k, `k${order.size + 1}`)
    }
  }
  return order
}

function doorsToQuery(state: KitchenState): string[] {
  const order = state.arrangement ? cabinetOrder(state.arrangement, state.shape, state.cabinets) : null
  return (state.doorsRight ?? [])
    .filter((k) => DOOR_KEY.test(k))
    .flatMap((k) => {
      // без раскладки в адресе нет и своих шкафов — перенумеровывать нечего
      if (!order || !/^k\d/.test(k)) return [k]
      const renamed = order.get(k)
      // шкафа нет в адресе — его ключ достался бы чужому шкафу
      return renamed ? [renamed] : []
    })
}

function arrangementToQuery(arr: Arrangement, shape: Shape, cabinets: KitchenState['cabinets'], at: KitchenState['at']): string {
  const pos = (k: ItemKey) => {
    if (at?.[k] === undefined) return ''
    const v = clamp(Math.round(at[k]! * 2) / 2, 0, 700)
    return Number.isInteger(v) ? `_${String(v).padStart(3, '0')}` : `-${String(v * 10).padStart(4, '0')}`
  }
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


function heightsFromQuery(raw: string | null, minTall: number): KitchenState['heights'] {
  if (!raw || raw.length > 20) return undefined
  const out: NonNullable<KitchenState['heights']> = {}
  for (const [, code, v] of raw.matchAll(/([pqt])(\d{3})/g)) {
    const key = COLUMN_ITEMS.find((k) => HEIGHT_CODE[k] === code)
    if (key) out[key] = clamp(Number(v), key === 'tall' ? minTall : COLUMN_HEIGHT.min, CEILING.max)
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

/**
 * Пустая комната (PRO): «er=1» (старые ссылки «fr=1» тоже читаются: «fr» — это
 * холодильник, и «fr=1» затирал выбранную модель); угловые шкафы стены A — «fk=s», «fk=e», «fk=se», со своей
 * шириной — «fk=s110e105»;
 * свои верхние шкафы — «up=c095w60c-1325w45.c200w80»: стены через точку (в порядке
 * wallsOf, без острова), шкаф — «c» + середина (как у места в `o=`) + «w» + ширина.
 */
const UPPER_TOKEN = /c(?:(\d{3})|-(\d{4}))w(\d{2,3})/g

function freeFromQuery(query: URLSearchParams, shape: Shape): FreeRoom | undefined {
  if (query.get('er') !== '1' && query.get('fr') !== '1') return undefined
  const fk = /^(?:s(\d{2,3})?)?(?:e(\d{2,3})?)?$/.exec(query.get('fk') ?? '')
  const corners = (['start', 'end'] as const).filter((e) => fk && fk[0].includes(e[0]))
  const cornerW: Partial<Record<'start' | 'end', number>> = {}
  if (fk?.[1]) cornerW.start = clamp(Number(fk[1]), FREE_CORNER.min, FREE_CORNER.max)
  if (fk?.[2]) cornerW.end = clamp(Number(fk[2]), FREE_CORNER.min, FREE_CORNER.max)
  const raw = query.get('up')
  const uppers: Partial<Record<FreeWall, FreeUpper[]>> = {}
  if (raw && raw.length <= 400 && /^(?:c(?:\d{3}|-\d{4})w\d{2,3}|\.)+$/.test(raw)) {
    const walls = wallsOf(shape).filter((w): w is FreeWall => w !== 'I')
    raw.split('.').forEach((part, i) => {
      const wall = walls[i]
      if (!wall) return
      const list: FreeUpper[] = []
      for (const [, cm, mm, w] of part.matchAll(UPPER_TOKEN)) {
        const c = cm !== undefined ? Number(cm) : Math.round(Number(mm) / 5) / 2
        list.push({ c: clamp(c, 0, 700), w: clamp(Number(w), FREE_UPPER.min, FREE_UPPER.max) })
      }
      if (list.length) uppers[wall] = list
    })
  }
  return {
    ...(corners.length ? { corners } : {}),
    ...(Object.keys(cornerW).length ? { cornerW } : {}),
    ...(Object.keys(uppers).length ? { uppers } : {}),
  }
}

function freeToQuery(q: URLSearchParams, free: FreeRoom, shape: Shape) {
  q.set('er', '1')
  const fk = (['start', 'end'] as const)
    .filter((e) => free.corners?.includes(e))
    .map((e) => {
      const w = free.cornerW?.[e]
      return w !== undefined && Math.round(w) !== CORNER_W ? `${e[0]}${Math.round(clamp(w, FREE_CORNER.min, FREE_CORNER.max))}` : e[0]
    })
    .join('')
  if (fk) q.set('fk', fk)
  const walls = wallsOf(shape).filter((w): w is FreeWall => w !== 'I')
  const pos = (v: number) => {
    const x = clamp(Math.round(v * 2) / 2, 0, 700)
    return Number.isInteger(x) ? String(x).padStart(3, '0') : `-${String(x * 10).padStart(4, '0')}`
  }
  const parts = walls.map((w) => (free.uppers?.[w] ?? []).map((u) => `c${pos(u.c)}w${Math.round(clamp(u.w, FREE_UPPER.min, FREE_UPPER.max))}`).join(''))
  if (parts.some(Boolean)) q.set('up', parts.join('.').replace(/\.+$/, ''))
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

/**
 * Какая техника есть в каталоге. Достаточно набора id; если передать карту
 * id → техника, разбор ещё узнает, встраиваемая ли выбранная микроволновка.
 */
export type KnownAppliances = ReadonlySet<string> | ReadonlyMap<string, { builtIn?: boolean }>

const builtInOf = (known: KnownAppliances, id: string | null | undefined): boolean =>
  Boolean(id && !(known instanceof Set) && (known as ReadonlyMap<string, { builtIn?: boolean }>).get(id)?.builtIn)

export function stateFromQuery(query: URLSearchParams, known: KnownAppliances): KitchenState {
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
  const free = freeFromQuery(query, shape)
  // пустая комната: угловых шкафов по правилам нет — стена A может быть короче
  const a = free ? size(query.get('a'), 'a', DEFAULT_STATE.a) : Math.max(size(query.get('a'), 'a', DEFAULT_STATE.a), minA(shape))
  const { arrangement, cabinets, at } = arrangementFromQuery(query.get('o'), shape)
  const widths = widthsFromQuery(query.get('wd'))
  // нижний шкаф колонны с духовкой: «tb=70» — 70 см от пола до духовки
  const tbRaw = Math.round(Number(query.get('tb')))
  const tallBase = query.get('tb') && Number.isFinite(tbRaw) ? clamp(tbRaw, TALL_BASE.min, TALL_BASE.max) : undefined
  const heights = heightsFromQuery(query.get('ht'), tallMin(builtInOf(known, picks.microwave), tallBase))
  const doorsRight = doorsFromQuery(query.get('dr'))
  // обеденный стол «dn=6» и поворот острова «it=45» (градусы) — только знакомые значения
  const dn = Number(query.get('dn'))
  const dining = (DINING_SEATS as number[]).includes(dn) ? (dn as DiningSeats) : undefined
  const islandTurn = shape === 'island' ? islandTurnOf(Number(query.get('it'))) : 0
  const diningTurn = dining ? islandTurnOf(Number(query.get('dt'))) : 0
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
  // остров своего цвета (R10); неизвестный id отбрасывается, как у fc=
  const islandFacade = frontColor(query.get('if') ?? undefined)?.id
  const top = topChoice(query.get('tp') ?? undefined)?.id
  const splash = splashChoice(query.get('sp') ?? undefined)?.id
  // Ручка живёт в `hn=`; `hd=` — ключ вытяжки. Старые ссылки писали ручку в `hd=`:
  // id ручки не совпадает с id товара, поэтому её оттуда можно прочитать без путаницы.
  const handle = HANDLES.find((h) => h.id === (query.get('hn') ?? query.get('hd')))?.id
  const handleMetal = HANDLE_METALS.find((m) => m.id === query.get('hm'))?.id
  const hl = query.get('hl')
  return {
    shape,
    a,
    b: size(query.get('b'), 'b', DEFAULT_STATE.b),
    c: size(query.get('c'), 'c', DEFAULT_STATE.c),
    // остров не длиннее стены A: иначе он вылезает за комнату
    island: Math.min(size(query.get('i'), 'island', DEFAULT_STATE.island), a),
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
    ...(tallBase !== undefined && tallBase !== TALL_BASE.base ? { tallBase } : {}),
    ...(doorsRight ? { doorsRight } : {}),
    ...(facade ? { facade } : {}),
    ...(upperFacade ? { upperFacade } : {}),
    ...(overFridgeFacade ? { overFridgeFacade } : {}),
    ...(islandFacade ? { islandFacade } : {}),
    ...(top ? { top } : {}),
    ...(splash ? { splash } : {}),
    ...(handle ? { handle } : {}),
    ...(handleMetal ? { handleMetal } : {}),
    ...(hl === '1' ? { handleless: true } : hl === '0' ? { handleless: false } : {}),
    ...(free ? { free } : {}),
    ...(dining ? { dining } : {}),
    ...(islandTurn ? { islandTurn } : {}),
    ...(diningTurn ? { diningTurn } : {}),
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
  const dr = doorsToQuery(state)
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
  if (state.shape === 'island' && state.islandFacade) q.set('if', state.islandFacade)
  if (state.top) q.set('tp', state.top)
  if (state.splash) q.set('sp', state.splash)
  if (state.handle) q.set('hn', state.handle)
  if (state.handleMetal) q.set('hm', state.handleMetal)
  if (state.handleless !== undefined) q.set('hl', state.handleless ? '1' : '0')
  // нижний шкаф колонны — тоже в конце: у кухни без него адрес прежний
  if (state.tallBase !== undefined && Math.round(state.tallBase) !== TALL_BASE.base) q.set('tb', String(Math.round(state.tallBase)))
  // пустая комната — в конце адреса: у обычной кухни адрес прежний, байт в байт
  if (state.free) freeToQuery(q, state.free, state.shape)
  // обеденный стол и поворот острова — ещё дальше: у кухни без них адрес прежний
  if (state.dining) q.set('dn', String(state.dining))
  const turn = state.shape === 'island' ? islandTurnOf(state.islandTurn) : 0
  if (turn) q.set('it', String(turn))
  const dt = state.dining ? islandTurnOf(state.diningTurn) : 0
  if (dt) q.set('dt', String(dt))
  return q.toString()
}

/* ───────── последняя кухня в браузере ───────── */

/**
 * Последняя собранная кухня живёт в localStorage['kp-last'] — адрес проекта и
 * время: {"q":"f=corner&a=300…","t":1790000000000}. Разбирается тем же
 * stateFromQuery, поэтому мусор в записи не страшен. Хранилище может быть
 * закрыто (приватный режим, запрет сайта) или переполнено — тогда просто
 * ничего не сохраняется. Когда писать (с задержкой) — решает экран.
 */
const LAST_KEY = 'kp-last'

function storage(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null {
  try {
    return typeof localStorage === 'undefined' || !localStorage ? null : localStorage
  } catch {
    return null
  }
}

export function saveLast(state: KitchenState): void {
  try {
    storage()?.setItem(LAST_KEY, JSON.stringify({ q: queryFromState(state), t: Date.now() }))
  } catch {
    // нет места или запрещено — кухня останется только в адресе
  }
}

export function loadLast(known: KnownAppliances): KitchenState | null {
  try {
    const raw = storage()?.getItem(LAST_KEY)
    if (!raw) return null
    const record: unknown = JSON.parse(raw)
    if (!record || typeof record !== 'object') return null
    const q = (record as { q?: unknown }).q
    if (typeof q !== 'string' || q.length > 4000) return null
    const query = new URLSearchParams(q)
    // запись без формы кухни — не наша
    if (!SHAPES.some((s) => s === query.get('f'))) return null
    return stateFromQuery(query, known)
  } catch {
    return null
  }
}

export function clearLast(): void {
  try {
    storage()?.removeItem(LAST_KEY)
  } catch {
    // запрещено — нечего и стирать
  }
}

/* ───────── с карточки товара ───────── */

/**
 * «Примерить в кухне»: ссылка на конструктор с этой моделью в её слоте —
 * «/ru/kitchen?ov=<id>». Только для техники, которую конструктор принимает
 * (тот же applianceFromProduct, из которого строится его каталог), иначе null.
 */
export function kitchenLinkFor(product: Product, lang: Lang): string | null {
  const appliance = applianceFromProduct(product)
  if (!appliance) return null
  return `/${lang}/kitchen?${new URLSearchParams({ [SLOT_KEYS[appliance.slot]]: product.id })}`
}
