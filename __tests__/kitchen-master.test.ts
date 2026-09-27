import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CutPart, NestResult } from '@/lib/kitchen/cutting'
import { estimate, loadMaster, saveMaster, type MasterData } from '@/lib/kitchen/master'
import type { SpecData, SpecFront } from '@/lib/kitchen/spec'

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
const white = { kind: 'ldsp', label: 'Белый', color: '#ffffff', thick: 16 } as const
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
