import type { Product } from '@/data/products'
import type { Finish, FridgeKind, HobKind, HoodKind, KitchenAppliance, SlotKind } from './types'

/**
 * Какая техника из каталога встаёт в кухню и какого она размера.
 *
 * Размеры берутся из характеристик 1С («Размеры Ш×В×Г», «Ширина»…). Если
 * их нет — типовой размер для этого вида техники, и в карточке это видно
 * (sizeKnown = false). Выдумывать нельзя, поэтому ничего сверх этого.
 */

type Spec = { label: string; value: string }

const TYPICAL: Record<SlotKind, { w: number; h: number; d: number }> = {
  fridge: { w: 60, h: 185, d: 65 },
  oven: { w: 59.5, h: 59.5, d: 56 },
  microwave: { w: 59.5, h: 38.5, d: 32 },
  hob: { w: 60, h: 5, d: 52 },
  hood: { w: 60, h: 50, d: 50 },
  dishwasher: { w: 60, h: 82, d: 55 },
  washer: { w: 60, h: 85, d: 50 },
}

function slotOf(name: string, specs: Spec[]): SlotKind | null {
  const n = name.toLowerCase()
  const type = (find(specs, /^тип$/) ?? '').toLowerCase()
  if (/морозил|ларь/.test(n) || /морозильн(ый|ая) ларь/.test(type)) return null
  if (/холодильник/.test(n)) return 'fridge'
  if (/духов/.test(n)) return 'oven'
  if (/микроволн|свч/.test(n)) return 'microwave'
  if (/варочн/.test(n)) return 'hob'
  if (/вытяжк/.test(n)) return 'hood'
  if (/посудомо/.test(n)) return 'dishwasher'
  if (/стиральн/.test(n)) {
    // В кухню под столешницу встаёт только фронтальная машина-автомат.
    const load = (find(specs, /^тип загрузки$/) ?? '').toLowerCase()
    if (/п\/а|полуавтомат/.test(n) || /полуавтомат/.test(type) || /вертикал/.test(load)) return null
    return 'washer'
  }
  return null
}

function find(specs: Spec[], label: RegExp): string | undefined {
  return specs.find((s) => label.test(s.label.trim().toLowerCase()))?.value
}

/** «59,5 см» → 59.5; «595 мм» → 59.5; «45–84» → 45 */
function number(part: string, mm: boolean): number | null {
  const m = part.replace(',', '.').match(/\d+(\.\d+)?/)
  if (!m) return null
  const v = Number(m[0])
  if (!Number.isFinite(v) || v <= 0) return null
  return mm || v > 400 ? v / 10 : v
}

export type Size = { w?: number; h?: number; d?: number }

/** Размеры из характеристик. Порядок букв Ш/В/Г берётся из названия строки. */
export function parseSize(specs: Spec[]): Size {
  const size: Size = {}
  for (const s of specs) {
    const label = s.label.toLowerCase()
    if (!/размер|габарит/.test(label)) continue
    const mm = /мм/.test(s.value)
    const parts = s.value.split(/[×xх*]/i).map((p) => number(p, mm))
    if (parts.length !== 3 || parts.some((p) => p === null)) continue
    const letters = (s.label.match(/[швг]/gi) ?? []).map((l) => l.toLowerCase())
    const order = letters.length === 3 ? letters : ['ш', 'в', 'г']
    order.forEach((letter, i) => {
      const v = parts[i]!
      if (letter === 'ш') size.w = v
      if (letter === 'в') size.h = v
      if (letter === 'г') size.d = v
    })
    break
  }
  const single = (re: RegExp) => {
    const v = find(specs, re)
    return v ? number(v, /мм/.test(v)) ?? undefined : undefined
  }
  size.w ??= single(/^ширина$/)
  size.h ??= single(/^высота$/)
  size.d ??= single(/^глубина$/)
  return size
}

const FINISH_WORDS: [Finish, RegExp][] = [
  ['inox', /нерж|inox|сталь|серебр|silver|\bix\b/],
  ['black', /черн|чёрн|black|графит|т[её]мно-сер/],
  ['white', /бел|white/],
  ['gray', /сер|gray|grey|титан/],
  ['beige', /беж|beige|слонов/],
]

/** Цвет по первому упомянутому слову: «Нержавейка / чёрное стекло» — это нержавейка. */
export function finishOf(text: string): Finish | null {
  const t = text.toLowerCase()
  let best: { finish: Finish; at: number } | null = null
  for (const [finish, re] of FINISH_WORDS) {
    const at = t.search(re)
    if (at >= 0 && (!best || at < best.at)) best = { finish, at }
  }
  return best?.finish ?? null
}

function hoodKind(type: string): HoodKind {
  if (/телескоп|выдвиж/.test(type)) return 'telescopic'
  if (/полностью встраив|встраиваем/.test(type)) return 'insert'
  if (/наклон/.test(type)) return 'inclined'
  return 'chimney'
}

function fridgeKind(type: string, w: number): FridgeKind {
  if (/side|сайд/.test(type)) return 'sbs'
  if (/четыр|4-?х? ?двер|french|французск|многодвер/.test(type)) return 'french'
  if (/однокамер/.test(type)) return 'single'
  if (/верхн/.test(type)) return 'top'
  if (w >= 80) return 'french'
  return 'bottom'
}

function hobKind(text: string): HobKind {
  if (/индукц/.test(text)) return 'induction'
  if (/газ/.test(text)) return 'gas'
  return 'electric'
}

const round = (v: number) => Math.round(v * 10) / 10

export function applianceFromProduct(p: Product): KitchenAppliance | null {
  if (p.chatOnly || p.price <= 0) return null
  if (!p.variants.some((v) => v.stock > 0)) return null
  const specs: Spec[] = p.specs.map((s) => ({ label: s.labelRu, value: s.valueRu }))
  const slot = slotOf(p.nameRu, specs)
  if (!slot) return null

  const type = (find(specs, /^тип$/) ?? '').toLowerCase()
  const install = (find(specs, /^установка$/) ?? '').toLowerCase()
  const parsed = parseSize(specs)
  const typical = TYPICAL[slot]
  // Для встраиваемой техники главное — ширина; для стоящей — ещё и высота.
  const sizeKnown = slot === 'fridge' || slot === 'washer' ? Boolean(parsed.w && parsed.h) : Boolean(parsed.w)
  let fridge: FridgeKind | undefined
  if (slot === 'fridge') {
    fridge = fridgeKind(type, parsed.w ?? typical.w)
    if (!parsed.w && fridge === 'sbs') parsed.w = 90
  }

  const w = round(parsed.w ?? typical.w)
  // У вытяжки в «высоте» часто диапазон трубы — корпус считаем сами.
  const h = slot === 'hood' ? typical.h : round(parsed.h ?? typical.h)
  const d = round(parsed.d ?? typical.d)

  const text = `${p.nameRu} ${type} ${install}`.toLowerCase()
  const standing = /отдельностоящ|соло/.test(text)
  const builtIn =
    slot === 'oven' || slot === 'hob' || slot === 'hood'
      ? true
      : slot === 'fridge' || slot === 'washer'
        ? /встраиваем/.test(text)
        : !standing && /встраив/.test(text)

  const color = find(specs, /^цвет/) ?? ''
  const finish =
    finishOf(color) ??
    finishOf(p.nameRu.replace(/встраиваем\S*/i, '')) ??
    (slot === 'washer' || slot === 'fridge' ? 'white' : 'black')

  const burnersMatch = `${p.nameRu} ${specs.map((s) => `${s.label} ${s.value}`).join(' ')}`.match(/(\d)\s*(конфор|зон)/i)

  return {
    id: p.id,
    slot,
    name: p.nameRu.replace(/\*/g, '').replace(/\s{2,}/g, ' ').trim(),
    brand: p.brand,
    price: p.price,
    oldPrice: p.oldPrice,
    image: p.image,
    w,
    h,
    d,
    sizeKnown,
    builtIn,
    finish,
    hood: slot === 'hood' ? hoodKind(type) : undefined,
    fridge,
    hob: slot === 'hob' ? hobKind(text) : undefined,
    burners: slot === 'hob' ? Number(burnersMatch?.[1] ?? 4) : undefined,
  }
}

export function kitchenAppliances(products: Product[]): KitchenAppliance[] {
  return products
    .map(applianceFromProduct)
    .filter((a): a is KitchenAppliance => a !== null)
    .sort((x, y) => x.price - y.price)
}

/**
 * Модель «по умолчанию» для первого показа: середина по цене, подходящая по
 * размеру. Микроволновку и стиральную машину по умолчанию не ставим.
 */
export function defaultPick(slot: SlotKind, list: KitchenAppliance[]): string | null {
  if (slot === 'microwave' || slot === 'washer') return null
  let pool = list.filter((a) => a.slot === slot)
  const prefer = (fits: (a: KitchenAppliance) => boolean) => {
    const narrowed = pool.filter(fits)
    if (narrowed.length > 0) pool = narrowed
  }
  if (slot === 'fridge') prefer((a) => a.w <= 70 && a.h >= 170)
  if (slot === 'dishwasher') prefer((a) => a.builtIn)
  if (slot === 'hood') prefer((a) => a.hood === 'chimney')
  if (pool.length === 0) return null
  const sorted = [...pool].sort((x, y) => x.price - y.price)
  return sorted[Math.floor((sorted.length - 1) / 2)].id
}
