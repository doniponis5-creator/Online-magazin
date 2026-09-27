import type { KitchenTexts } from '@/components/kitchen/texts'
import { formatSom } from '@/lib/format'
import { FRONT_MATERIALS, frontColor, type FrontMaterial } from './finishes'
import { edgeTotals, type CutMaterial, type CutPart, type NestResult, type Sheet } from './cutting'
import { projectTotal, type ProjectItem } from './order'
import { hardware, topList, type SpecData } from './spec'

/**
 * Пакет мастера: его цены и данные (в этом браузере, `kp-master`) и смета
 * клиенту. Цен по умолчанию нет: их знает только мастер — пустое поле значит
 * «цена не указана», а не ноль.
 */

/** цена фасада за м² — по материалу из каталога отделки; 'style' — фасад стиля (материал уточнить) */
export type FrontPriceKey = FrontMaterial | 'style'
export type MasterPrices = {
  /** лист ЛДСП белый — корпус по умолчанию (`lam-white`) */
  ldsp?: number
  /** лист ЛДСП цветной / декор — в цвет фасадов или верха; нет цены — «цена не указана», белую не подставляем */
  ldspDecor?: number
  hdf?: number
  edge?: Partial<Record<'0.4' | '1' | '2', number>>
  front?: Partial<Record<FrontPriceKey, number>>
  top?: number
  hinge?: number
  runner?: number
  lift?: number
  handle?: number
  /** за шт: толкатель, ножка (опора), навес верхнего шкафа */
  push?: number
  leg?: number
  hanger?: number
  /** за м: профиль Gola, цоколь */
  gola?: number
  plinth?: number
  /** за погонный метр столешницы */
  work?: number
  delivery?: number
  markup?: number
}
export type MasterData = {
  name: string
  phone: string
  shop: string
  prices: MasterPrices
  /** толщина видимой кромки корпуса, мм */
  bodyEdge: 0.4 | 1 | 2
  /** свой размер листа, мм; нет — 2800 × 2070 */
  sheets: { ldsp?: Sheet; hdf?: Sheet }
}

/** Ключ в браузере мастера. Формат с версией: поменяется — старая запись читается как пустая, а не роняет страницу. */
export const MASTER_KEY = 'kp-master'
const VERSION = 1
const FRONT_KEYS: FrontPriceKey[] = ['laminate', 'acrylic', 'enamel', 'veneer', 'fenix', 'style']
const EDGE_KEYS = ['0.4', '1', '2'] as const
const PRICE_KEYS = ['ldsp', 'ldspDecor', 'hdf', 'top', 'hinge', 'runner', 'lift', 'handle', 'push', 'leg', 'hanger', 'gola', 'plinth', 'work', 'delivery', 'markup'] as const

/** Пусто: цен нет — их знает только мастер; кромка корпуса 1 мм, листы — по умолчанию раскроя. */
export function emptyMaster(): MasterData {
  return { name: '', phone: '', shop: '', prices: {}, bodyEdge: 1, sheets: {} }
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
/** цена — только настоящее неотрицательное число; строка, NaN, минус — «цены нет» */
const price = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : undefined)
const text = (v: unknown): string => (typeof v === 'string' ? v.slice(0, 120) : '')
const sheet = (v: unknown): Sheet | undefined =>
  isObj(v) && typeof v.L === 'number' && typeof v.W === 'number' && v.L >= 100 && v.W >= 100 && v.L <= 6000 && v.W <= 6000 ? { L: v.L, W: v.W } : undefined

/** Разбор записи: всё незнакомое отбрасывается, битая запись — пусто. */
function parseMaster(raw: string | null): MasterData {
  const out = emptyMaster()
  let v: unknown
  try {
    v = raw ? JSON.parse(raw) : null
  } catch {
    return out
  }
  if (!isObj(v) || v.v !== VERSION) return out
  out.name = text(v.name)
  out.phone = text(v.phone)
  out.shop = text(v.shop)
  if (v.bodyEdge === 0.4 || v.bodyEdge === 1 || v.bodyEdge === 2) out.bodyEdge = v.bodyEdge
  const p = isObj(v.prices) ? v.prices : {}
  for (const k of PRICE_KEYS) {
    const n = price(p[k])
    if (n !== undefined) out.prices[k] = n
  }
  const pick = <K extends string>(src: unknown, keys: readonly K[]) => {
    const got: Partial<Record<K, number>> = {}
    if (isObj(src)) for (const k of keys) {
      const n = price(src[k])
      if (n !== undefined) got[k] = n
    }
    return Object.keys(got).length ? got : undefined
  }
  const edge = pick(p.edge, EDGE_KEYS)
  if (edge) out.prices.edge = edge
  const front = pick(p.front, FRONT_KEYS)
  if (front) out.prices.front = front
  const s = isObj(v.sheets) ? v.sheets : {}
  const ldsp = sheet(s.ldsp)
  const hdf = sheet(s.hdf)
  if (ldsp) out.sheets.ldsp = ldsp
  if (hdf) out.sheets.hdf = hdf
  return out
}

/** Цены и данные мастера из этого браузера; нет записи, битая, нет хранилища — пусто. */
export function loadMaster(): MasterData {
  try {
    return parseMaster(globalThis.localStorage?.getItem(MASTER_KEY) ?? null)
  } catch {
    return emptyMaster()
  }
}

/** Сохранить в этом браузере; хранилище недоступно (приватный режим) — молча, форма работает до перезагрузки. */
export function saveMaster(d: MasterData): void {
  try {
    globalThis.localStorage?.setItem(MASTER_KEY, JSON.stringify({ v: VERSION, ...d }))
  } catch {
    // нет места или запрещено — цены остаются в памяти страницы
  }
}

/* ───────── смета ───────── */

/** что за строка: листы, кромка, фасады в цех, столешница, фурнитура, работа, доставка и монтаж */
export type EstimateKey =
  | 'ldsp'
  | 'ldspDecor'
  | 'hdf'
  | 'edge'
  | 'front'
  | 'top'
  | 'hinge'
  | 'runner'
  | 'lift'
  | 'handle'
  | 'push'
  | 'leg'
  | 'hanger'
  | 'gola'
  | 'plinth'
  | 'work'
  | 'delivery'
export type EstimateUnit = 'sheet' | 'm' | 'm2' | 'pcs' | 'pair' | 'job'
export type EstimateRow = {
  key: EstimateKey
  /** уточнение: цвет листа (ldsp, hdf), толщина кромки '0.4' | '1' | '2' (edge), материал фасада `FrontPriceKey` (front) */
  what?: string
  /** толщина листа, мм (ldsp, hdf) */
  thick?: number
  qty: number
  unit: EstimateUnit
  /** цена мастера за единицу; null — «цена не указана», строка не входит в итог */
  price: number | null
  sum: number | null
}
export type Estimate = {
  rows: EstimateRow[]
  /** сумма строк с ценой */
  subtotal: number
  /** наценка, % и сом */
  markupPct: number
  markup: number
  /** итог с наценкой, сом */
  total: number
  /** строки без цены — чего не хватает, по порядку, без повторов */
  missing: EstimateKey[]
}

const r2 = (v: number) => Math.round(v * 100) / 100

/** Белый лист — цвет корпуса по умолчанию (`lam-white`), в каком бы месте кухни он ни стоял. */
const WHITE = frontColor('lam-white')?.color.toLowerCase()
/** ЛДСП белый — по цене `ldsp`; любой другой цвет или декор ЛДСП — по цене `ldspDecor`. */
export const isWhiteSheet = (m: Pick<CutMaterial, 'kind' | 'color'>): boolean => m.kind === 'ldsp' && m.color.toLowerCase() === WHITE

/**
 * Смета мастера: листы из раскладки, кромка с запасом, фасады не из листа — м²,
 * столешница и работа — погонные метры столешницы, фурнитура — из спецификации.
 * Цены — только мастера: нет цены — строка «цена не указана», в итог не входит.
 */
export function estimate(parts: CutPart[], nested: NestResult[], spec: SpecData, prices: MasterPrices): Estimate {
  const rows: EstimateRow[] = []
  const add = (key: EstimateKey, raw: number, unit: EstimateUnit, price: number | undefined, extra: Pick<EstimateRow, 'what' | 'thick'> = {}) => {
    // кол-во — до сотых, как печатается: 4,78 м × 5 500 = 26 290 сходится глазами
    const qty = r2(raw)
    if (!(qty > 0)) return
    const p = price ?? null
    rows.push({ key, ...extra, qty, unit, price: p, sum: p === null ? null : Math.round(qty * p) })
  }
  for (const r of nested) {
    if (!r.sheets.length) continue
    const kind = r.material.kind === 'hdf' ? 'hdf' : isWhiteSheet(r.material) ? 'ldsp' : 'ldspDecor'
    add(kind, r.sheets.length, 'sheet', prices[kind], { what: r.material.label, thick: r.material.thick ?? undefined })
  }
  for (const e of edgeTotals(parts)) {
    const k = String(e.thick) as '0.4' | '1' | '2'
    add('edge', e.meters, 'm', prices.edge?.[k], { what: k })
  }
  // фасады и доборы не из листа — в цех фасадов, по м²; материал стиля — своя цена «по стилю»
  const area = new Map<FrontPriceKey, number>()
  for (const p of parts) {
    if (!p.front || !p.facade || p.material.kind === 'ldsp' || p.material.kind === 'hdf') continue
    const k: FrontPriceKey = p.facade.finish ?? 'style'
    area.set(k, (area.get(k) ?? 0) + (p.facade.h * p.facade.w * p.count) / 1e6)
  }
  for (const [k, m2] of area) add('front', r2(m2), 'm2', prices.front?.[k], { what: k })
  const top = topList(spec.runs).total
  add('top', top, 'm', prices.top)
  const hw = hardware(spec)
  add('hinge', hw.hinges, 'pcs', prices.hinge)
  add('runner', hw.runners, 'pair', prices.runner)
  add('lift', hw.lifts, 'pcs', prices.lift)
  add('handle', hw.handles, 'pcs', prices.handle)
  add('push', hw.push, 'pcs', prices.push)
  add('leg', hw.legs, 'pcs', prices.leg)
  add('hanger', hw.hangers, 'pcs', prices.hanger)
  add('gola', hw.gola, 'm', prices.gola)
  add('plinth', hw.plinth, 'm', prices.plinth)
  // работа — за погонный метр кухни: по длине столешницы
  add('work', top, 'm', prices.work)
  add('delivery', 1, 'job', prices.delivery)

  const subtotal = rows.reduce((s, r) => s + (r.sum ?? 0), 0)
  const markupPct = prices.markup ?? 0
  const markup = Math.round((subtotal * markupPct) / 100)
  const missing = [...new Set(rows.filter((r) => r.price === null).map((r) => r.key))]
  return { rows, subtotal, markupPct, markup, total: subtotal + markup, missing }
}

/* ───────── смета словами: одна и та же на экране и в PDF ───────── */

export type EstimateTotal = { label: string; value: string }
export type EstimateLines = {
  head: string[]
  /** наименование, кол-во с единицей («4,78 м»), цена («цена не указана»), сумма («—») */
  rows: [string, string, string, string][]
  /** «Сумма по строкам» и «Наценка» — только при наценке; последняя — «Итого» */
  totals: EstimateTotal[]
  missing?: string
  /** техника магазина — то, что в сумме проекта (`projectItems`, `inTotal`) */
  tech?: { head: string[]; rows: [string, string, string][]; total: EstimateTotal }
}

const som = (v: number) => new Intl.NumberFormat('ru-RU').format(v)
/** число как напечатано: до сотых, с запятой */
const num = (v: number) => String(r2(v)).replace('.', ',')

/**
 * Строки сметы клиенту — чистая функция: экран и PDF печатают одно и то же.
 * Язык — из `t` (`t.xl.lang`). Техника — из `projectItems`, итог — `projectTotal`.
 */
export function estimateLines(e: Estimate, items: readonly ProjectItem[], t: KitchenTexts): EstimateLines {
  const m = t.master
  const lang = t.xl.lang
  const name = (r: EstimateRow): string => {
    switch (r.key) {
      case 'ldsp':
      case 'ldspDecor':
        return m.rowSheet(t.xl.kinds.ldsp, r.thick, r.what ?? '')
      case 'hdf':
        return m.rowSheet(t.xl.kinds.hdf, r.thick, r.what ?? '')
      case 'edge':
        return m.rowEdge(num(Number(r.what)))
      case 'front': {
        const mat = FRONT_MATERIALS.find((x) => x.id === r.what)
        return m.rowFront(mat ? (lang === 'ky' ? mat.ky : mat.ru) : m.frontStyle)
      }
      case 'top':
        return t.topTitle
      case 'hinge':
        return t.hw.hinges
      case 'runner':
        return m.rowRunner
      case 'lift':
        return t.hw.lifts
      case 'handle':
        return t.hw.handles
      case 'push':
        return t.hw.push
      case 'leg':
        return t.hw.legs
      case 'hanger':
        return t.hw.hangers
      case 'gola':
        return t.hw.gola
      case 'plinth':
        return t.hw.plinth
      case 'work':
        return m.rowWork
      case 'delivery':
        return m.rowDelivery
    }
  }
  const rows = e.rows.map((r): [string, string, string, string] => [
    name(r),
    `${num(r.qty)}${m.units[r.unit] ? ` ${m.units[r.unit]}` : ''}`,
    r.price === null ? m.noPrice : som(r.price),
    r.sum === null ? '—' : som(r.sum),
  ])
  const totals: EstimateTotal[] = [
    ...(e.markupPct > 0
      ? [
          { label: m.subtotal, value: formatSom(e.subtotal) },
          // наценка — как ввёл мастер, без округления: 12,25 → «12,25%»
          { label: m.markup(String(e.markupPct).replace('.', ',')), value: formatSom(e.markup) },
        ]
      : []),
    { label: m.total, value: formatSom(e.total) },
  ]
  const tech = items.flatMap((i): [string, string, string][] => (i.inTotal && i.appliance ? [[t.slots[i.slot], i.appliance.name, som(i.appliance.price)]] : []))
  return {
    head: [m.colName, m.colQty, m.colPrice, m.colSum],
    rows,
    totals,
    missing: e.missing.length ? m.missing : undefined,
    tech: tech.length ? { head: [t.colWhat, t.colModel, m.colPrice], rows: tech, total: { label: m.techTotal, value: formatSom(projectTotal(items).sum) } } : undefined,
  }
}
