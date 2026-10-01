import type { Product } from '@/data/products'
import type { Lang } from '@/lib/i18n/config'
import type { ApplianceInfo, Finish, FridgeKind, HobKind, HoodKind, KitchenAppliance, SlotKind } from './types'

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
/** Отдельностоящая плита без размеров в характеристиках. */
const STOVE_TYPICAL = { w: 60, h: 85, d: 60 }

/**
 * Вид товара. stove — отдельностоящая плита; desk — плитка, настольная или
 * мини-плита; freezer — морозильник; other — известная не кухонная техника
 * (гриль, вафельница, мини-печь…). Последние три ни в какой слот не идут.
 */
type Kind = SlotKind | 'stove' | 'desk' | 'freezer' | 'other'

/**
 * Слово-вид в начале фразы (слова в нижнем регистре через пробел). Только
 * именительный падеж: «с духовкой», «для плиты», «сменными плитами» — не вид.
 */
const KINDS: [Kind, RegExp][] = [
  ['desk', /^(электро)?плитк/],
  ['stove', /^(электро|газо)?плита(?![а-яё])/],
  ['microwave', /^микроволн|^свч|^печ[ьи] (свч|микроволн)/],
  ['oven', /^(электро)?духовк[аи](?![а-яё])|^духов(ой|ые) шкаф|^шкаф\S* духов/],
  // В 1С варочные панели часто заведены как «Встраиваемая поверхность …».
  ['hob', /^варочн|^поверхност|^панел\S* варочн/],
  ['hood', /^вытяжк/],
  ['dishwasher', /^посудомо|^машин\S* посудомо/],
  ['washer', /^стиральн|^машин\S* стиральн/],
  ['fridge', /^холодильник/],
  ['freezer', /^морозильник|^морозильк|^морозилк|^морозильн\S* (ларь|шкаф)|^ларь/],
  ['other', /^(электро|аэро)?печ[ьи](?![а-яё])|^(электро|аэро)?гриль|^вафельниц|^сэндвич|^сендвич|^мультипекар|^блинниц|^тостер|^мультиварк/],
]

/** Определение перед видом или после него: «газовая», «встраиваемая», «мини». */
const MODIFIER = /^[а-яё]+(ая|яя|ый|ий|ой|ое|ее|ые|ие|ого|его|ую|юю|ым|им|ых|их)$|^(мини|полностью|частично)$/
/** Граница фразы: после запятой или скобки голову уже не ищем. */
const STOP = '|'

function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[,;()]/g, ` ${STOP} `)
    .split(/\s+/)
    .flatMap((t) => (/\d/.test(t) ? [t] : t.split('-'))) // «мини-плита» → мини плита; «4-х» — целиком
    .map((t) => t.replace(/^[^a-zа-яё0-9|]+|[^a-zа-яё0-9|]+$/g, '')) // «машина*», кавычки
    .filter(Boolean)
}

const DESK_WORD = /^настольн|^мини$/

/** Плита «настольная» или «мини» — по её собственным определениям рядом со словом «плита». */
function deskStove(ws: string[], at: number): boolean {
  const near: string[] = []
  for (const step of [-1, 1]) {
    for (let j = at + step; j >= 0 && j < ws.length && MODIFIER.test(ws[j]); j += step) near.push(ws[j])
  }
  return near.some((w) => DESK_WORD.test(w))
}

/**
 * Вид по голове фразы: идём по словам, пропуская определения, марки и
 * числа, до первого существительного. Оно — вид (если это вид техники) или
 * вида нет (null): дальше в фразе слова вид уже не меняют.
 */
function kindOf(text: string): Kind | null {
  const ws = words(text)
  for (let i = 0; i < ws.length; i++) {
    const w = ws[i]
    if (w === STOP) return null
    if (/\d/.test(w) || !/[а-яё]/.test(w)) continue // марка, модель, объём
    const rest = ws.slice(i).join(' ')
    const hit = KINDS.find(([, re]) => re.test(rest))?.[0]
    if (hit) return hit === 'stove' && deskStove(ws, i) ? 'desk' : hit
    if (!MODIFIER.test(w)) return null
  }
  return null
}

/**
 * Вид решает «Тип», если называет его; иначе — начало названия (в 1С оно с
 * вида). «Тип» без вида, но с определением «Настольная» — про плиту из названия.
 * Варочная панель по названию с «Тип» «Газовая плита» — всё та же встроенная
 * панель: плитой её делает только «Отдельностоящая … плита».
 */
function productKind(name: string, type: string): Kind | null {
  const byType = kindOf(type)
  const byName = kindOf(name)
  if (byType === 'stove' && byName === 'hob' && !/отдельностоящ/.test(type)) return 'hob'
  if (byType) return byType
  const ws = words(type)
  const noun = ws.findIndex((w) => !MODIFIER.test(w))
  const mods = noun < 0 ? ws : ws.slice(0, noun)
  return byName === 'stove' && mods.some((w) => DESK_WORD.test(w)) ? 'desk' : byName
}

function slotOf(kind: Kind | null, n: string, type: string, specs: Spec[]): SlotKind | null {
  if (kind === 'stove') return 'hob'
  if (kind === 'washer') {
    // В кухню под столешницу встаёт только фронтальная машина-автомат.
    const load = (find(specs, /^тип загрузки$/) ?? '').toLowerCase()
    if (/п\/а|полуавтомат/.test(n) || /полуавтомат/.test(type) || /вертикал/.test(load)) return null
    return 'washer'
  }
  return kind === null || kind === 'desk' || kind === 'freezer' || kind === 'other' ? null : kind
}

function find(specs: Spec[], label: RegExp): string | undefined {
  return specs.find((s) => label.test(s.label.trim().toLowerCase()))?.value
}

/** Первое число как есть: «59,5 см» → 59.5; «45–84» → 45 */
function rawNumber(part: string): number | null {
  const m = part.replace(',', '.').match(/\d+(\.\d+)?/)
  if (!m) return null
  const v = Number(m[0])
  return Number.isFinite(v) && v > 0 ? v : null
}

/** Отдельная строка «Ширина»: «59,5 см» → 59.5; «595 мм» → 59.5 */
function number(part: string, mm: boolean): number | null {
  const v = rawNumber(part)
  if (v === null) return null
  return mm || v > 400 ? v / 10 : v
}

export type Size = { w?: number; h?: number; d?: number }

/** Буква в названии строки → размер. «Д» (длина) у техники — это глубина. */
const LETTER_DIM: Record<string, keyof Size> = { ш: 'w', в: 'h', г: 'd', д: 'd' }
/** Порядок — только из группы вида «Ш×В×Г», «(ВхШхГ)», «Д*Ш*В», а не из всех букв названия. */
const ORDER_GROUP = /([швгд])\s*[×xх*]\s*([швгд])\s*[×xх*]\s*([швгд])/i
const DEFAULT_ORDER: (keyof Size)[] = ['w', 'h', 'd']

function orderOf(label: string): (keyof Size)[] {
  const m = ORDER_GROUP.exec(label)
  if (!m) return DEFAULT_ORDER
  const dims = m.slice(1, 4).map((l) => LETTER_DIM[l.toLowerCase()])
  return new Set(dims).size === 3 ? dims : DEFAULT_ORDER
}

/**
 * Размеры из характеристик. Единицы — на всю тройку сразу: «мм» в названии или
 * значении, или хоть одно число больше 300 (так в сантиметрах не бывает) —
 * значит, все три в миллиметрах. Габариты упаковки — не размеры товара.
 */
export function parseSize(specs: Spec[]): Size {
  const size: Size = {}
  for (const s of specs) {
    const label = s.label.toLowerCase()
    if (!/размер|габарит/.test(label) || /упаков/.test(label)) continue
    const raw = s.value.split(/[×xх*]/i).map(rawNumber)
    if (raw.length !== 3 || raw.some((p) => p === null)) continue
    const mm = /мм/.test(label) || /мм/.test(s.value) || raw.some((v) => v! > 300)
    const order = orderOf(s.label)
    order.forEach((dim, i) => {
      size[dim] = mm ? raw[i]! / 10 : raw[i]!
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
  // «Плоская кухонная вытяжка» (ARTEL ART-0960 PUNTO) — висит под шкафом, трубы нет
  if (/плоск|подвесн/.test(type)) return 'flat'
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

/**
 * Вид плиты по характеристикам («Тип», «Варочная поверхность», «Количество
 * конфорок»): в 1С название может говорить «газовая» у электрической плиты.
 * Комбинированная — газовая (нормы вытяжки строже). Не понять — null.
 */
function stoveKind(text: string): HobKind | null {
  if (/индукц/.test(text)) return 'induction'
  if (/газ|комбинир/.test(text)) return 'gas'
  // «чугунные решётки» бывают и у газовой, и у электрической — вид не решают
  if (/электр|стеклокерам|hi-?light/.test(text)) return 'electric'
  return null
}

/**
 * Вид варочной панели. burners — «Тип» и строки про конфорки («Конфорки =
 * 2 газовые + 2 электрические», «Мощность газовых конфорок»): есть там газ —
 * панель газовая, даже комбинированная с индукцией (норма вытяжки 75 см).
 */
function hobKind(text: string, burners = ''): HobKind {
  if (/газ/.test(burners)) return 'gas'
  if (/индукц/.test(text)) return 'induction'
  if (/газ/.test(text)) return 'gas'
  return 'electric'
}

/**
 * Число конфорок: «Количество конфорок = 3» → 3; «Конфорки = 3 газовые +
 * 1 инфракрасная» → 4 (сумма); иначе «4 конфорки» в названии или строках;
 * не понять — 4.
 */
function burnersOf(name: string, specs: Spec[]): number {
  const valid = (n: number | null | undefined): n is number => n !== null && n !== undefined && Number.isInteger(n) && n >= 1 && n <= 6
  const count = find(specs, /^(количество|число) (конфорок|зон)/)
  const byCount = count ? rawNumber(count) : null
  if (valid(byCount)) return byCount
  const listed = find(specs, /^конфорки$/)?.split('+').map(rawNumber)
  const sum = listed && listed.every((n) => n !== null) ? listed.reduce((t, n) => t + n!, 0) : null
  if (valid(sum)) return sum
  const loose = `${name} ${specs.map((s) => `${s.label} ${s.value}`).join(' ')}`.match(/(\d)\s*(конфор|зон)/i)
  return Number(loose?.[1] ?? 4)
}

const round = (v: number) => Math.round(v * 10) / 10

export function applianceFromProduct(p: Product): KitchenAppliance | null {
  if (p.chatOnly || p.price <= 0) return null
  if (!p.variants.some((v) => v.stock > 0)) return null
  const specs: Spec[] = p.specs.map((s) => ({ label: s.labelRu, value: s.valueRu }))
  const type = (find(specs, /^тип$/) ?? '').toLowerCase()
  const kind = productKind(p.nameRu, type)
  const slot = slotOf(kind, p.nameRu.toLowerCase(), type, specs)
  if (!slot) return null

  const install = (find(specs, /^установка$/) ?? '').toLowerCase()
  const parsed = parseSize(specs)
  const stove = kind === 'stove'
  const typical = stove ? STOVE_TYPICAL : TYPICAL[slot]
  // Для встраиваемой техники главное — ширина; для стоящей — ещё и высота.
  const sizeKnown = slot === 'fridge' || slot === 'washer' || stove ? Boolean(parsed.w && parsed.h) : Boolean(parsed.w)
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
  const builtIn = stove
    ? false
    : slot === 'oven' || slot === 'hob' || slot === 'hood'
      ? true
      : slot === 'fridge' || slot === 'washer'
        ? /встраиваем/.test(text)
        : !standing && /встраив/.test(text)

  const color = find(specs, /^цвет/) ?? ''
  const finish =
    finishOf(color) ??
    finishOf(p.nameRu.replace(/встраиваем\S*/i, '')) ??
    (slot === 'washer' || slot === 'fridge' ? 'white' : 'black')

  const burnersText = specs
    .filter((s) => /^тип$|конфор/.test(s.label.trim().toLowerCase()))
    .map((s) => `${s.label} ${s.value}`)
    .join(' ')
    .toLowerCase()

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
    hob: stove ? (stoveKind([type, find(specs, /варочн/), find(specs, /конфор/)].join(' ').toLowerCase()) ?? hobKind(text)) : slot === 'hob' ? hobKind(text, burnersText) : undefined,
    burners: slot === 'hob' ? burnersOf(p.nameRu, specs) : undefined,
    ...(stove ? { stove: true } : {}),
  }
}

export function kitchenAppliances(products: Product[]): KitchenAppliance[] {
  return products
    .map(applianceFromProduct)
    .filter((a): a is KitchenAppliance => a !== null)
    .sort((x, y) => x.price - y.price)
}

/**
 * Фото, описание и характеристики техники для окна «Подробнее» — на языке
 * страницы и только для того, что стоит в конструкторе.
 */
export function applianceInfo(products: Product[], ids: Iterable<string>, lang: Lang): Record<string, ApplianceInfo> {
  const wanted = new Set(ids)
  const out: Record<string, ApplianceInfo> = {}
  for (const p of products) {
    if (!wanted.has(p.id)) continue
    const ky = lang === 'ky'
    out[p.id] = {
      name: (ky ? p.nameKy : p.nameRu) || p.nameRu,
      images: p.images?.length ? p.images : p.image ? [p.image] : [],
      desc: ((ky ? p.descKy : p.descRu) || p.descRu || '').trim(),
      specs: p.specs
        .map((s): [string, string] => [(ky ? s.labelKy : s.labelRu) || s.labelRu, (ky ? s.valueKy : s.valueRu) || s.valueRu])
        .filter(([label, value]) => label.trim() && value.trim()),
    }
  }
  return out
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
  // Плита — осознанный выбор покупателя; по умолчанию — варочная панель.
  if (slot === 'hob') prefer((a) => !a.stove)
  if (pool.length === 0) return null
  const sorted = [...pool].sort((x, y) => x.price - y.price)
  return sorted[Math.floor((sorted.length - 1) / 2)].id
}
