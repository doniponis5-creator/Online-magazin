import { afterEach, describe, expect, it, vi } from 'vitest'
import './helpers/canvas'
import { buildKitchen } from '@/components/kitchen/three/build'
import { kitchenTexts } from '@/components/kitchen/texts'
import { cutParts, nest, type CutLook, type CutPart, type NestResult } from '@/lib/kitchen/cutting'
import { planKitchen, type PlanInput } from '@/lib/kitchen/layout'
import { estimate, estimateLines, isWhiteSheet, loadMaster, saveMaster, type MasterData, type MasterPrices } from '@/lib/kitchen/master'
import type { ProjectItem } from '@/lib/kitchen/order'
import { hardware, type SpecData, type SpecFront } from '@/lib/kitchen/spec'
import { getTone, STYLES, type KitchenStyle } from '@/lib/kitchen/styles'
import type { KitchenAppliance, Shape } from '@/lib/kitchen/types'

/** localStorage в node: простая память */
function memory(seed: Record<string, string> = {}) {
  const m = new Map(Object.entries(seed))
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    raw: m,
  }
}

afterEach(() => vi.unstubAllGlobals())

describe('цены и данные мастера (kp-master)', () => {
  it('без записи — пусто: ни одной цены, имя и телефон пустые, кромка корпуса 1 мм', () => {
    vi.stubGlobal('localStorage', memory())
    const d = loadMaster()
    expect(d).toEqual({ name: '', phone: '', shop: '', prices: {}, bodyEdge: 1, sheets: {} })
  })

  it('сохранил — прочитал то же самое; запись с версией', () => {
    const store = memory()
    vi.stubGlobal('localStorage', store)
    const d: MasterData = {
      name: 'Азамат',
      phone: '+996 700 123 456',
      shop: 'Мебель-Ош',
      prices: { ldsp: 3200, edge: { '2': 45 }, front: { acrylic: 5200 }, hinge: 150, markup: 15 },
      bodyEdge: 2,
      sheets: { ldsp: { L: 2750, W: 1830 } },
    }
    saveMaster(d)
    expect(JSON.parse(store.raw.get('kp-master') ?? '{}').v).toBe(1)
    expect(loadMaster()).toEqual(d)
  })

  it('битая или чужая запись — пусто, страница не падает; мусор в ценах отбрасывается', () => {
    const empty = { name: '', phone: '', shop: '', prices: {}, bodyEdge: 1, sheets: {} }
    for (const raw of ['{bad', 'null', '[]', '{"v":99,"name":"X"}', '"text"']) {
      vi.stubGlobal('localStorage', memory({ 'kp-master': raw }))
      expect(loadMaster()).toEqual(empty)
    }
    vi.stubGlobal('localStorage', memory({
      'kp-master': JSON.stringify({ v: 1, name: 5, phone: 'Тел', prices: { ldsp: '3000', hdf: -5, top: 4000, edge: { '1': 30, '7': 9 }, front: { acrylic: NaN, enamel: 6000, gold: 1 } }, bodyEdge: 3, sheets: { ldsp: { L: 0, W: 1830 }, hdf: { L: 2800, W: 2070 } } }),
    }))
    expect(loadMaster()).toEqual({ name: '', phone: 'Тел', shop: '', prices: { top: 4000, edge: { '1': 30 }, front: { enamel: 6000 } }, bodyEdge: 1, sheets: { hdf: { L: 2800, W: 2070 } } })
    vi.stubGlobal('localStorage', undefined)
    expect(loadMaster()).toEqual(empty)
    expect(() => saveMaster(empty as MasterData)).not.toThrow()
  })
})

/* ───────── смета: всё посчитано вручную ───────── */

const front = (f: Partial<SpecFront>): SpecFront => ({ x: 0, y: 0, w: 40, h: 70, hinge: 'left', glass: false, framed: false, handle: true, ...f })
/** одна стена 120 см: две дверцы (70 и 100 см — 2 + 3 петли), ящик, подъёмная без ручки; столешница 1,2 м */
const SPEC: SpecData = {
  runs: [
    {
      id: 'A',
      length: 120,
      modules: [],
      boxes: [],
      fronts: [front({ h: 70 }), front({ h: 100, hinge: 'right' }), front({ hinge: 'drawer', h: 20 }), front({ hinge: 'top', handle: false, h: 35 })],
      tops: [{ x0: 0, x1: 120, depth: 60, thick: 3.8, sink: false, hob: false }],
    },
  ],
  carcasses: [],
  panels: [],
  plinth: 0,
  gola: 0,
  splash: 0,
  heights: { plinth: 10, counter: 86, upperBottom: 140, upperTop: 212, mezzTop: null, ceiling: 260 },
}
const edges0 = { l1: 0, l2: 0, w1: 0, w2: 0 } as const
// белый каталога (`lam-white`) — по цене белого листа
const white = { kind: 'ldsp', label: 'Белый', color: '#f1f0ec', thick: 16 } as const
const PARTS: CutPart[] = [
  // 2 × 1000 мм кромки 1 мм = 2,0 м, с запасом 10% — 2,2 м
  { id: '1', name: 'side', front: false, material: white, length: 1000, width: 500, count: 2, grain: false, edges: { ...edges0, l1: 1 } },
  { id: '2', name: 'back', front: false, material: { ...white, kind: 'hdf', thick: 3 }, length: 700, width: 500, count: 1, grain: false, edges: edges0 },
  // акрил 700 × 400 × 2 = 0,56 м²; фасад стиля 500 × 300 = 0,15 м²
  { id: '3', name: 'door', front: true, material: { kind: 'mdf', label: 'Бордо', color: '#700', thick: null }, length: 700, width: 400, count: 2, grain: false, edges: edges0, facade: { h: 700, w: 400, finish: 'acrylic' } },
  { id: '4', name: 'door', front: true, material: { kind: 'shop', label: 'Кашемир', color: '#eee', thick: null }, length: 500, width: 300, count: 1, grain: false, edges: edges0, facade: { h: 500, w: 300, finish: null } },
]
const sheets = (n: number) => Array.from({ length: n }, () => ({ placements: [] }))
const NESTED: NestResult[] = [
  { material: white, sheetL: 2800, sheetW: 2070, sheets: sheets(2), waste: 0.2, oversize: [] },
  { material: { ...white, kind: 'hdf', thick: 3 }, sheetL: 2800, sheetW: 2070, sheets: sheets(1), waste: 0.8, oversize: [] },
]

describe('смета мастера', () => {
  it('кол-во × цена = сумма; без цены — не в итоге и в missing; наценка к итогу', () => {
    const e = estimate(PARTS, NESTED, SPEC, {
      ldsp: 3000,
      hdf: 900,
      edge: { '1': 25 },
      front: { acrylic: 4000 },
      top: 5000,
      hinge: 150,
      runner: 400,
      lift: 1200,
      work: 2000,
      delivery: 3000,
      markup: 10,
    })
    const row = (key: string, what?: string) => e.rows.find((r) => r.key === key && (what === undefined || r.what === what))
    expect(row('ldsp')).toMatchObject({ qty: 2, price: 3000, sum: 6000, what: 'Белый' })
    expect(row('hdf')).toMatchObject({ qty: 1, price: 900, sum: 900 })
    expect(row('edge', '1')).toMatchObject({ qty: 2.2, price: 25, sum: 55 })
    expect(row('front', 'acrylic')).toMatchObject({ qty: 0.56, price: 4000, sum: 2240 })
    expect(row('front', 'style')).toMatchObject({ qty: 0.15, price: null, sum: null })
    expect(row('top')).toMatchObject({ qty: 1.2, price: 5000, sum: 6000 })
    expect(row('hinge')).toMatchObject({ qty: 5, price: 150, sum: 750 })
    expect(row('runner')).toMatchObject({ qty: 1, price: 400, sum: 400 })
    expect(row('lift')).toMatchObject({ qty: 1, price: 1200, sum: 1200 })
    expect(row('handle')).toMatchObject({ qty: 3, price: null, sum: null })
    expect(row('work')).toMatchObject({ qty: 1.2, price: 2000, sum: 2400 })
    expect(row('delivery')).toMatchObject({ qty: 1, price: 3000, sum: 3000 })
    // 6000 + 900 + 55 + 2240 + 6000 + 750 + 400 + 1200 + 2400 + 3000
    expect(e.subtotal).toBe(22945)
    expect(e.markup).toBe(2295)
    expect(e.total).toBe(25240)
    expect(e.missing).toEqual(['front', 'handle'])
  })

  it('цен нет совсем — итог 0, все строки без цены; нулевых строк нет', () => {
    const e = estimate(PARTS, NESTED, SPEC, {})
    expect(e.total).toBe(0)
    expect(e.rows.every((r) => r.price === null && r.sum === null)).toBe(true)
    expect(e.rows.every((r) => r.qty > 0)).toBe(true)
    expect(e.missing).toContain('ldsp')
  })
})

/* ───────── таск 04: вся фурнитура, лист белый и цветной, числа как напечатаны ───────── */

describe('цены мастера: новые поля', () => {
  it('старая запись kp-master без новых полей читается без потерь', () => {
    const old = { v: 1, name: 'Азамат', phone: '0700', shop: '', prices: { ldsp: 3200, hdf: 900, hinge: 150, runner: 400, work: 2000, markup: 10, edge: { '1': 30 } }, bodyEdge: 1, sheets: {} }
    vi.stubGlobal('localStorage', memory({ 'kp-master': JSON.stringify(old) }))
    const { v: _v, ...rest } = old
    expect(loadMaster()).toEqual(rest)
  })

  it('ножка, навес, толкатель, Gola, цоколь и цветной лист сохраняются и читаются', () => {
    const store = memory()
    vi.stubGlobal('localStorage', store)
    const d: MasterData = {
      name: '',
      phone: '',
      shop: '',
      prices: { ldsp: 3200, ldspDecor: 4100, leg: 35, hanger: 60, push: 180, gola: 900, plinth: 450 },
      bodyEdge: 1,
      sheets: {},
    }
    saveMaster(d)
    expect(loadMaster()).toEqual(d)
  })
})

describe('смета: лист ЛДСП белый и цветной', () => {
  const decor = { kind: 'ldsp', label: 'Кашемир', color: '#d0c5b7', thick: 16 } as const
  const withDecor: NestResult[] = [...NESTED, { material: decor, sheetL: 2800, sheetW: 2070, sheets: sheets(3), waste: 0.1, oversize: [] }]

  it('белый (lam-white) — по цене ldsp; цветной — по ldspDecor', () => {
    expect(isWhiteSheet(white)).toBe(true)
    expect(isWhiteSheet({ kind: 'ldsp', color: '#F1F0EC' })).toBe(true)
    // другой белый, не каталожный, — уже цвет: цены знает только мастер
    expect(isWhiteSheet({ kind: 'ldsp', color: '#ffffff' })).toBe(false)
    expect(isWhiteSheet({ kind: 'hdf', color: '#f1f0ec' })).toBe(false)
    const e = estimate(PARTS, withDecor, SPEC, { ldsp: 3000, ldspDecor: 4200 })
    expect(e.rows.find((r) => r.key === 'ldsp')).toMatchObject({ qty: 2, price: 3000, sum: 6000 })
    expect(e.rows.find((r) => r.key === 'ldspDecor')).toMatchObject({ qty: 3, price: 4200, sum: 12600, what: 'Кашемир' })
  })

  it('нет цветной цены — «цена не указана», белую не подставляем', () => {
    const e = estimate(PARTS, withDecor, SPEC, { ldsp: 3000, ldspDecor: undefined })
    expect(e.rows.find((r) => r.key === 'ldspDecor')).toMatchObject({ qty: 3, price: null, sum: null })
    expect(e.missing).toContain('ldspDecor')
  })
})

/* реальные кухни, как в kitchen-cutting.test.ts */
const appliance = (over: Partial<KitchenAppliance>): KitchenAppliance => ({
  id: 'x', slot: 'fridge', name: 'x', brand: '', price: 1, w: 60, h: 185, d: 65, sizeKnown: true, builtIn: false, finish: 'white', ...over,
})
const fridge = appliance({ id: 'f', slot: 'fridge', name: 'Холодильник X', price: 45990 })
const oven = appliance({ id: 'o', slot: 'oven', name: 'Духовка Y', price: 23990, w: 59.5, h: 59.5, d: 56, builtIn: true })
const hood = appliance({ id: 'h', slot: 'hood', name: 'Вытяжка Z', price: 12490, w: 60, h: 50, d: 50, hood: 'chimney' })
const hob = appliance({ id: 'b', slot: 'hob', name: 'Панель W', price: 18990, w: 59, h: 5, d: 52, builtIn: true, hob: 'electric' })
const dw = appliance({ id: 'd', slot: 'dishwasher', name: 'ПММ V', price: 31990, w: 44.8, h: 81.5, d: 55, builtIn: true })
function kitchen(shape: Shape, a: number, b: number, c: number, style: KitchenStyle): SpecData {
  const input: PlanInput = { shape, a, b, c, island: 0, fridge, dishwasher: dw, hob, oven, hood: { w: 60 } }
  const plan = planKitchen(input, { shelves: style.shelves })
  return buildKitchen({
    plan,
    style,
    tone: getTone(style, 0),
    items: { fridge, dishwasher: dw, hob, oven, hood },
    photos: new Map(),
    evening: false,
    room: { ceiling: 270, toCeiling: false },
    fronts: {},
    detail: 0.5,
  }).spec
}
const styleOf = (id: string) => STYLES.find((s) => s.id === id) ?? STYLES[0]
const ITEMS: ProjectItem[] = [
  { slot: 'fridge', appliance: fridge, status: 'placed', inTotal: true },
  { slot: 'oven', appliance: oven, status: 'placed', inTotal: true },
  { slot: 'hob', appliance: hob, status: 'placed', inTotal: true },
  { slot: 'hood', appliance: hood, status: 'placed', inTotal: true },
  // не в сумме — и не в смете
  { slot: 'dishwasher', appliance: dw, status: 'noStock', inTotal: false },
]
const FULL: MasterPrices = {
  ldsp: 3150,
  ldspDecor: 4275,
  hdf: 980,
  edge: { '0.4': 12, '1': 27, '2': 45 },
  front: { laminate: 3900, acrylic: 5200, enamel: 6100, veneer: 7400, fenix: 8800, style: 5500 },
  top: 5500,
  hinge: 150.5,
  runner: 420,
  lift: 1250,
  handle: 180,
  push: 190,
  leg: 35,
  hanger: 65,
  gola: 950,
  plinth: 460,
  work: 3300,
  delivery: 4000,
  markup: 12.25,
}
/** число как напечатано: «4,78 м» → 4.78, «26 290» → 26290, «12 345 сом» → 12345 */
const printed = (s: string) => Number((s.match(/^[\d\s\u00a0\u202f]+(,\d+)?/)?.[0] ?? 'NaN').replace(/[\s\u00a0\u202f]/g, '').replace(',', '.'))

describe('смета клиенту: каждая напечатанная строка сходится', () => {
  const cases: { name: string; spec: SpecData; look: CutLook }[] = [
    // угловая: низ цветной ЛДСП, верх — акрил (м²), ручки
    { name: 'угловая', spec: kitchen('corner', 300, 240, 0, styleOf('neoclassic')), look: { facade: 'lam-cashmere', upperFacade: 'acr-white' } },
    // П-образная без ручек (Gola): низ — декор под дерево, верх — белый ЛДСП (по белой цене)
    { name: 'П-образная', spec: kitchen('u', 360, 240, 240, styleOf('column')), look: { facade: 'lam-sonoma', upperFacade: 'lam-white' } },
  ]
  for (const c of cases)
    for (const lang of ['ru', 'ky'] as const)
      it(`${c.name}, ${lang}: кол-во × цена = сумма, строки = «Сумма по строкам», техника = «Итого техника»`, () => {
        const t = kitchenTexts(lang)
        const parts = cutParts(c.spec, { ...c.look, lang, tier: t.xl.tier })
        const nested = nest(parts)
        const e = estimate(parts, nested, c.spec, FULL)
        const L = estimateLines(e, ITEMS, t)

        // вся фурнитура из спецификации — своей строкой
        const hw = hardware(c.spec)
        const want = { hinge: hw.hinges, runner: hw.runners, lift: hw.lifts, handle: hw.handles, push: hw.push, leg: hw.legs, hanger: hw.hangers, gola: hw.gola, plinth: hw.plinth }
        for (const [key, qty] of Object.entries(want)) {
          const row = e.rows.find((r) => r.key === key)
          if (qty > 0) expect(row, key).toMatchObject({ qty })
          else expect(row, key).toBeUndefined()
        }
        expect(hw.legs * hw.hangers * hw.plinth).toBeGreaterThan(0)
        // П-образная без ручек — Gola и толкатели; угловая — ручки
        if (c.name === 'П-образная') expect(hw.gola * hw.push).toBeGreaterThan(0)
        else expect(hw.handles).toBeGreaterThan(0)
        expect(e.missing).toEqual([])
        expect(e.rows.some((r) => r.key === 'ldspDecor')).toBe(true)
        expect(e.rows.some((r) => r.key === 'ldsp')).toBe(true)

        expect(L.rows).toHaveLength(e.rows.length)
        let sum = 0
        for (const [name, qty, price, total] of L.rows) {
          expect(name.length, name).toBeGreaterThan(0)
          const q = printed(qty)
          const p = printed(price)
          const s = printed(total)
          expect(Number.isFinite(q) && Number.isFinite(p) && Number.isFinite(s), `${name}: ${qty} × ${price} = ${total}`).toBe(true)
          expect(Math.round(q * p), `${name}: ${qty} × ${price} = ${total}`).toBe(s)
          sum += s
        }
        const m = t.master
        const [sub, mk, tot] = L.totals
        expect(sub.label).toBe(m.subtotal)
        expect(printed(sub.value)).toBe(sum)
        expect(mk.label).toBe(m.markup('12,25'))
        expect(mk.label).toContain('12,25%')
        expect(printed(mk.value)).toBe(Math.round((sum * 12.25) / 100))
        expect(tot.label).toBe(m.total)
        expect(printed(tot.value)).toBe(sum + printed(mk.value))

        // техника: только то, что в сумме проекта
        expect(L.tech?.rows).toHaveLength(4)
        const tech = (L.tech?.rows ?? []).reduce((a, r) => a + printed(r[2]), 0)
        expect(tech).toBe(45990 + 23990 + 18990 + 12490)
        expect(printed(L.tech?.total.value ?? '')).toBe(tech)
        expect(L.tech?.total.label).toBe(m.techTotal)

        // направляющие — своим ключом, без обрезки по запятой
        if (hw.runners > 0) expect(L.rows.some((r) => r[0] === m.rowRunner)).toBe(true)
      })

  it('кол-во печатается до сотых с запятой и единицей: 4,78 м × 5 500 = 26 290', () => {
    const t = kitchenTexts('ru')
    const spec: SpecData = { ...SPEC, runs: [{ ...SPEC.runs[0], length: 478, tops: [{ x0: 0, x1: 478, depth: 60, thick: 3.8, sink: false, hob: false }] }] }
    const e = estimate([], [], spec, { top: 5500 })
    const top = estimateLines(e, [], t).rows.find((r) => r[0] === t.topTitle)
    expect(top?.[1]).toBe('4,78 м')
    expect(top?.[3].replace(/[\s\u00a0\u202f]/g, '')).toBe('26290')
  })

  it('без наценки — одна строка «Итого»; без цен — «цена не указана» и «—»', () => {
    const t = kitchenTexts('ky')
    const L = estimateLines(estimate(PARTS, NESTED, SPEC, {}), [], t)
    expect(L.totals.map((x) => x.label)).toEqual([t.master.total])
    expect(L.rows.every((r) => r[2] === t.master.noPrice && r[3] === '—')).toBe(true)
    expect(L.missing).toBe(t.master.missing)
    expect(L.tech).toBeUndefined()
  })

  for (const lang of ['ru', 'ky'] as const)
    it(`техника, ${lang}: отдельностоящая плита — t.stove.name («Плита»), варочная панель — как была`, () => {
      const t = kitchenTexts(lang)
      const stove = appliance({ id: 's', slot: 'hob', name: 'Плита S', price: 27990, w: 50, h: 85, d: 60, stove: true, hob: 'electric' })
      const e = estimate(PARTS, NESTED, SPEC, {})
      const withStove = estimateLines(e, [{ slot: 'hob', appliance: stove, status: 'placed', inTotal: true }], t).tech?.rows
      expect(withStove?.[0][0]).toBe(t.stove.name)
      expect(withStove?.[0][0]).not.toBe(t.slots.hob)
      const withHob = estimateLines(e, [{ slot: 'hob', appliance: hob, status: 'placed', inTotal: true }], t).tech?.rows
      expect(withHob?.[0][0]).toBe(t.slots.hob)
    })
})

describe('смета: цвет с кодом в строках листов и фасадов (таск 03)', () => {
  it('декор Egger — строка листа с кодом; RAL — строка фасадов «Эмаль, RAL 7016 …»; разные цвета одного материала — разные строки', () => {
    const t = kitchenTexts('ru')
    const s = kitchen('straight', 300, 0, 0, STYLES[0])
    const parts = cutParts(s, { facade: 'dec-egger-h1145-st10', upperFacade: 'ral-7016' })
    const names = estimateLines(estimate(parts, nest(parts), s, {}), [], t).rows.map((r) => r[0])
    expect(names).toContain('Лист ЛДСП 16 мм, Egger H1145 ST10 Дуб Бардолино натуральный')
    expect(names).toContain('Фасады — Эмаль, RAL 7016 Антрацитово-серый')
    const two = cutParts(s, { facade: 'ral-9003', upperFacade: 'ral-7016' })
    const fronts = estimateLines(estimate(two, nest(two), s, {}), [], t).rows.map((r) => r[0]).filter((n) => n.startsWith('Фасады'))
    expect(fronts.sort()).toEqual(['Фасады — Эмаль, RAL 7016 Антрацитово-серый', 'Фасады — Эмаль, RAL 9003 Сигнальный белый'])
  })
})
