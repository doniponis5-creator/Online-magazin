import { describe, expect, it } from 'vitest'
import { buildKitchen } from '@/components/kitchen/three/build'
import { planKitchen, type PlanInput } from '@/lib/kitchen/layout'
import { cutList, frontList, type SpecData } from '@/lib/kitchen/spec'
import { getTone, STYLES, type KitchenStyle } from '@/lib/kitchen/styles'
import type { HobKind, KitchenAppliance, Shape } from '@/lib/kitchen/types'
import { cutParts, edgeTotals, nest, type CutLook, type CutPart, type NestResult } from '@/lib/kitchen/cutting'

/**
 * Раскрой для распила (пакет мастера, истории 2, 4–8): детали, кромка,
 * раскладка по листам. Кухни собираются в node, как в kitchen-build.test.ts.
 */

/* ───────────── заглушка холста для текстур ───────────── */

const ctx2d: unknown = new Proxy({} as Record<string | symbol, unknown>, {
  get: (t, k) => {
    if (k in t) return t[k]
    if (k === 'getImageData') return (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) })
    return () => ctx2d
  },
  set: (t, k, v) => {
    t[k] = v
    return true
  },
})
;(globalThis as { document?: unknown }).document = {
  createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }),
}

/* ───────────── техника и кухни ───────────── */

const appliance = (over: Partial<KitchenAppliance>): KitchenAppliance => ({
  id: 'x',
  slot: 'fridge',
  name: 'x',
  brand: '',
  price: 1,
  w: 60,
  h: 185,
  d: 65,
  sizeKnown: true,
  builtIn: false,
  finish: 'white',
  ...over,
})

const fridge = appliance({ slot: 'fridge' })
const oven = appliance({ slot: 'oven', w: 59.5, h: 59.5, d: 56, builtIn: true })
const hood = appliance({ slot: 'hood', w: 60, h: 50, d: 50, hood: 'chimney' })
const hob = (kind: HobKind = 'electric') => appliance({ slot: 'hob', w: 59, h: 5, d: 52, builtIn: true, hob: kind })
const dw = (w = 45) => appliance({ slot: 'dishwasher', w: w - 0.2, h: 81.5, d: 55, builtIn: true })

type Kitchen = { shape: Shape; a: number; b: number; c: number; island: number; style?: KitchenStyle; ceiling?: number; toCeiling?: boolean; col?: Partial<PlanInput>; gas?: boolean; dwW?: number }

function spec(k: Kitchen): SpecData {
  const style = k.style ?? STYLES[0]
  const items = { fridge, dishwasher: dw(k.dwW ?? 45), hob: hob(k.gas ? 'gas' : 'electric'), oven, hood }
  const input: PlanInput = { shape: k.shape, a: k.a, b: k.b, c: k.c, island: k.island, ...k.col, fridge, dishwasher: items.dishwasher, hob: items.hob, oven, hood: { w: 60 } }
  const plan = planKitchen(input, { shelves: style.shelves })
  return buildKitchen({
    plan,
    style,
    tone: getTone(style, 0),
    items,
    photos: new Map(),
    evening: false,
    room: { ceiling: k.ceiling ?? 270, toCeiling: k.toCeiling ?? false },
    fronts: {},
    detail: 0.5,
  }).spec
}

const corner = spec({ shape: 'corner', a: 300, b: 240, c: 0, island: 0 })
const uShape = spec({ shape: 'u', a: 360, b: 240, c: 240, island: 0, toCeiling: true })

const total = (parts: { count: number }[]) => parts.reduce((s, p) => s + p.count, 0)
const body = (parts: CutPart[]) => parts.filter((p) => !p.front)
const fronts = (parts: CutPart[]) => parts.filter((p) => p.front)

/* ───────────── детали ───────────── */

describe('cutParts: детали корпусов и фасадов', () => {
  it('на угловой и П-образной кухне: деталей корпуса — как в cutList, фасадов — как в frontList', () => {
    for (const s of [corner, uShape]) {
      const parts = cutParts(s, {})
      const cut = cutList(s.carcasses, s.panels)
      expect(total(body(parts))).toBe(total(cut))
      expect(total(body(parts).filter((p) => p.material.kind === 'hdf'))).toBe(total(cut.filter((r) => r.hdf)))
      expect(total(body(parts).filter((p) => p.material.kind === 'ldsp'))).toBe(total(cut.filter((r) => !r.hdf)))
      expect(total(fronts(parts))).toBe(total(frontList(s.runs)))
      expect(total(parts)).toBeGreaterThan(40)
    }
  })

  it('фасады акрил, эмаль, шпон, Fenix — МДФ, в распил не идут; ламинат — ЛДСП 16', () => {
    for (const id of ['acr-white', 'en-sage', 'ven-oak', 'fx-nero']) {
      const f = fronts(cutParts(corner, { facade: id }))
      expect(f.length).toBeGreaterThan(0)
      for (const p of f) expect(p.material.kind, id).toBe('mdf')
    }
    const lam = fronts(cutParts(corner, { facade: 'lam-grey' })).filter((p) => p.name !== 'glass' && p.name !== 'framed')
    expect(lam.length).toBeGreaterThan(0)
    for (const p of lam) expect(p.material).toMatchObject({ kind: 'ldsp', thick: 16, label: 'Серый шифер' })
  })
})

/* ───────────── кромка ───────────── */

/** Один нижний шкаф 30 × 72 × 56 см с полкой и дверцей 296 × 716 мм — всё считается вручную. */
function oneBase(carcass: Partial<SpecData['carcasses'][number]> = {}): SpecData {
  return {
    runs: [{ id: 'A', length: 30, modules: [], boxes: [], tops: [], fronts: [{ x: 0.2, y: 10, w: 29.6, h: 71.6, hinge: 'left', glass: false, framed: false, handle: true }] }],
    carcasses: [{ row: 'base', w: 30, h: 72, d: 56, shelves: 1, top: false, bottom: true, back: true, ...carcass }],
    panels: [],
    plinth: 30,
    gola: 0,
    splash: 0,
    heights: { plinth: 10, counter: 86, upperBottom: 140, upperTop: 212, mezzTop: null, ceiling: 270 },
  }
}
const byName = (parts: CutPart[], name: string) => parts.find((p) => p.name === name)!

describe('кромка по сторонам (история 4)', () => {
  it('шкаф 30 см: боковина — передняя длинная 1 мм, дно и полка — передняя (узкая сторона), царга — 0,4, ХДФ — без кромки, фасад — 2 по кругу', () => {
    const parts = cutParts(oneBase(), {})
    expect(byName(parts, 'side')).toMatchObject({ length: 720, width: 560, count: 2, edges: { l1: 1, l2: 0, w1: 0, w2: 0 } })
    // дно 268 × 560: передняя кромка — по ширине шкафа, 268 мм
    expect(byName(parts, 'bottom')).toMatchObject({ length: 560, width: 268, edges: { l1: 0, l2: 0, w1: 1, w2: 0 } })
    expect(byName(parts, 'shelf')).toMatchObject({ length: 540, width: 266, edges: { l1: 0, l2: 0, w1: 1, w2: 0 } })
    expect(byName(parts, 'rail')).toMatchObject({ length: 268, width: 100, count: 2, edges: { l1: 0.4, l2: 0, w1: 0, w2: 0 } })
    expect(byName(parts, 'back')).toMatchObject({ material: { kind: 'hdf' }, edges: { l1: 0, l2: 0, w1: 0, w2: 0 } })
    expect(byName(parts, 'door')).toMatchObject({ length: 716, width: 296, material: { kind: 'ldsp' }, edges: { l1: 2, l2: 2, w1: 2, w2: 2 } })
  })

  it('видимая кромка корпуса — параметр: 2 мм вместо 1, скрытая остаётся 0,4', () => {
    const parts = cutParts(oneBase(), { bodyEdge: 2 })
    expect(byName(parts, 'side').edges).toEqual({ l1: 2, l2: 0, w1: 0, w2: 0 })
    expect(byName(parts, 'bottom').edges).toEqual({ l1: 0, l2: 0, w1: 2, w2: 0 })
    expect(byName(parts, 'rail').edges).toEqual({ l1: 0.4, l2: 0, w1: 0, w2: 0 })
  })

  it('корпус под дерево: длина — вдоль волокна (дно — по ширине шкафа), передняя кромка — l1', () => {
    const parts = cutParts(oneBase(), { body: 'lam-sonoma' })
    expect(byName(parts, 'side')).toMatchObject({ length: 720, width: 560, grain: true, edges: { l1: 1, w1: 0 } })
    expect(byName(parts, 'bottom')).toMatchObject({ length: 268, width: 560, grain: true, edges: { l1: 1, w1: 0 } })
    expect(byName(parts, 'shelf')).toMatchObject({ length: 266, width: 540, grain: true, edges: { l1: 1, w1: 0 } })
    // низкая антресоль 35 см: передняя кромка боковины — 350 мм, короче глубины
    const mezz = cutParts(oneBase({ row: 'upper', w: 60, h: 35, d: 56, bottom: true, top: true, shelves: 0 }), {})
    expect(byName(mezz, 'side')).toMatchObject({ length: 560, width: 350, edges: { l1: 0, w1: 1 } })
  })
})

describe('edgeTotals: метры кромки по толщине, запас 10% (история 5)', () => {
  it('шкаф 30 см вручную: 1 мм — 2×720 + 268 + 266 = 1974 мм; 0,4 — 2×268 = 536; 2 мм — 2×(716+296) = 2024', () => {
    expect(edgeTotals(cutParts(oneBase(), {}))).toEqual([
      { thick: 0.4, net: 0.5, meters: 0.6 }, // 0,536 × 1,1 = 0,59
      { thick: 1, net: 2, meters: 2.2 }, // 1,974 × 1,1 = 2,17
      { thick: 2, net: 2, meters: 2.2 }, // 2,024 × 1,1 = 2,23
    ])
  })

  it('видимая кромка 2 мм складывается с кромкой фасадов; МДФ-фасады кромку не добавляют', () => {
    expect(edgeTotals(cutParts(oneBase(), { bodyEdge: 2 }))).toEqual([
      { thick: 0.4, net: 0.5, meters: 0.6 },
      { thick: 2, net: 4, meters: 4.4 }, // (1974 + 2024) × 1,1 = 4,40
    ])
    expect(edgeTotals(cutParts(oneBase(), { facade: 'acr-white' })).map((e) => e.thick)).toEqual([0.4, 1])
  })
})

/* ───────────── материал и цвет ───────────── */

describe('материал, цвет, текстура — из выбранной отделки (Решения §5, §6)', () => {
  it('корпус по умолчанию — белый без текстуры, ХДФ того же цвета; фасады под дерево — с текстурой', () => {
    const parts = cutParts(corner, { facade: 'lam-sonoma' })
    for (const p of body(parts)) {
      expect(p.grain, p.name).toBe(false)
      expect(p.material.label).toBe('Белый премиум')
    }
    for (const p of fronts(parts).filter((f) => f.material.kind === 'ldsp')) expect(p).toMatchObject({ grain: true, material: { label: 'Дуб Сонома', color: '#c9a67b' } })
    // однотонный ламинат и бетон — без текстуры, на киргизском — киргизское название
    for (const p of fronts(cutParts(corner, { facade: 'lam-concrete', lang: 'ky' }))) expect(p).toMatchObject({ grain: false, material: { label: 'Чикаго бетону' } })
  })

  it('фасад стиля без id каталога — своей отделкой; свой цвет шкафа над холодильником — отдельной строкой', () => {
    const style: CutLook = { facade: { material: 'laminate', ru: 'Орех', ky: 'Жаңгак', color: '#7a5436', wood: true } }
    const f = fronts(cutParts(oneBase(), style))
    expect(f).toHaveLength(1)
    expect(f[0]).toMatchObject({ grain: true, material: { kind: 'ldsp', label: 'Орех', color: '#7a5436' } })
    const own = oneBase()
    own.runs[0].fronts.push({ x: 0.2, y: 150, w: 29.6, h: 35, hinge: 'top', glass: false, framed: false, handle: true, color: 'acr-bordeaux' })
    const lift = fronts(cutParts(own, {})).find((p) => p.name === 'lift')!
    expect(lift.material).toMatchObject({ kind: 'mdf', label: 'Бордо' })
  })
})

/* ───────────── раскладка по листам ───────────── */

const square = (id: string, count: number, grain = false): CutPart => ({
  id,
  name: 'shelf',
  front: false,
  material: { kind: 'ldsp', label: 'Белый', color: '#fff', thick: 16 },
  length: 1000,
  width: 1000,
  count,
  grain,
  edges: { l1: 0, l2: 0, w1: 0, w2: 0 },
})
const placed = (r: NestResult) => r.sheets.flatMap((s) => s.placements)

describe('nest: раскладка по листам (истории 6–8)', () => {
  it('4 детали 1000 × 1000 — один лист 2800 × 2070, отход 1 − 4 м² / (2,78 × 2,05) = 29,8%; пятая — второй лист', () => {
    const [one] = nest([square('1', 4)])
    expect(one).toMatchObject({ sheetL: 2800, sheetW: 2070, oversize: [] })
    expect(one.sheets).toHaveLength(1)
    expect(one.waste).toBeCloseTo(0.2981, 3)
    const [two] = nest([square('1', 5)])
    expect(two.sheets).toHaveLength(2)
    expect(two.waste).toBeCloseTo(0.5614, 3)
  })

  it('деталь с текстурой не поворачивается: 600 × 2100 поперёк волокна не лезет — в oversize; однотонная ложится повёрнутой', () => {
    const wide = (grain: boolean): CutPart => ({ ...square('7', 1, grain), length: 600, width: 2100 })
    const [g] = nest([wide(true), square('1', 1, true)])
    expect(g.oversize).toEqual(['7'])
    expect(placed(g).map((p) => p.id)).toEqual(['1'])
    const [plain] = nest([wide(false)])
    expect(plain.oversize).toEqual([])
    expect(placed(plain)).toEqual([{ id: '7', x: 10, y: 10, l: 2100, w: 600, rotated: true }])
  })

  it('длиннее листа — в oversize, не теряется; МДФ в раскладку не идёт; ЛДСП и ХДФ, разные цвета — отдельно', () => {
    const long: CutPart = { ...square('3', 2), length: 2900, width: 300 }
    const [r] = nest([long])
    expect(r.oversize).toEqual(['3'])
    expect(r.sheets).toEqual([])
    const res = nest(cutParts(corner, { facade: 'lam-sonoma' }))
    expect(res.map((x) => `${x.material.kind} ${x.material.label}`).sort()).toEqual(['hdf Белый премиум', 'ldsp Белый премиум', 'ldsp Дуб Сонома'])
    expect(nest(cutParts(corner, { facade: 'acr-white' })).map((x) => x.material.kind).sort()).toEqual(['hdf', 'ldsp'])
  })

  it('свой лист, пропил и обрезка из опций', () => {
    const [r] = nest([square('1', 2)], { sheet: { L: 2440, W: 1220 }, kerf: 5, trim: 15 })
    expect(r).toMatchObject({ sheetL: 2440, sheetW: 1220 })
    expect(placed(r)).toEqual([
      { id: '1', x: 15, y: 15, l: 1000, w: 1000, rotated: false },
      { id: '1', x: 1020, y: 15, l: 1000, w: 1000, rotated: false },
    ])
  })
})

/* ───────────── перебор кухонь ───────────── */

const SHAPES: Kitchen[] = [
  { shape: 'straight', a: 300, b: 0, c: 0, island: 0 },
  { shape: 'corner', a: 300, b: 240, c: 0, island: 0 },
  { shape: 'u', a: 360, b: 240, c: 240, island: 0 },
  { shape: 'island', a: 330, b: 0, c: 0, island: 160 },
  { shape: 'island', a: 330, b: 0, c: 0, island: 280 },
  { shape: 'corner', a: 420, b: 300, c: 0, island: 0 },
  { shape: 'u', a: 300, b: 200, c: 260, island: 0 },
]
const LOOKS: CutLook[] = [{}, { facade: 'lam-sonoma' }, { facade: 'acr-white', body: 'lam-walnut' }, { facade: 'lam-graphite', bodyEdge: 2 }, { body: 'lam-craft', facade: 'lam-wotan', bodyEdge: 0.4 }]
const OPTS = [undefined, { sheet: { L: 2440, W: 1830 }, kerf: 5, trim: 15 }, { sheets: { hdf: { L: 2745, W: 1700 } } }]

function* kitchens(): Generator<{ name: string; spec: SpecData; look: CutLook; opts: (typeof OPTS)[number] }> {
  let k = 0
  for (const s of SHAPES)
    for (const ceiling of [240, 250, 270, 290, 300, 320])
      for (const toCeiling of [true, false])
        for (const col of [{}, { tallOven: true }, { pantries: 2 }] as Partial<PlanInput>[]) {
          k++
          const a = s.a + ((k * 37) % 90) - 45
          const style = STYLES[k % STYLES.length]
          yield {
            name: `${s.shape}-${a} ${ceiling}${toCeiling ? ' до потолка' : ''} ${JSON.stringify(col)} ${style.id} #${k}`,
            spec: spec({ ...s, a, style, ceiling, toCeiling, col, gas: k % 3 === 0, dwW: k % 2 ? 45 : 60 }),
            look: LOOKS[k % LOOKS.length],
            opts: OPTS[k % OPTS.length],
          }
        }
}

describe('nest на переборе кухонь', () => {
  it('≥ 200 кухонь: всё размещено, без пересечений, пропил между деталями, внутри рабочей зоны, текстура вдоль, листов ≥ нижней границы', () => {
    let n = 0
    for (const { name, spec: s, look, opts } of kitchens()) {
      n++
      const parts = cutParts(s, look)
      const res = nest(parts, opts)
      const kerf = opts?.kerf ?? 4
      const trim = opts?.trim ?? 10
      const byId = new Map(parts.map((p) => [p.id, p]))
      const seen = new Map<string, number>()
      for (const r of res) {
        const box = { L: r.sheetL - 2 * trim, W: r.sheetW - 2 * trim }
        let area = 0
        for (const sh of r.sheets) {
          const pl = sh.placements
          expect(pl.length, name).toBeGreaterThan(0)
          for (const p of pl) {
            const part = byId.get(p.id)!
            expect(part.material, name).toEqual(r.material)
            seen.set(p.id, (seen.get(p.id) ?? 0) + 1)
            area += p.l * p.w
            // размеры детали — как в раскрое, повёрнута только однотонная
            expect(p.rotated ? [p.w, p.l] : [p.l, p.w], name).toEqual([part.length, part.width])
            if (part.grain) expect(p.rotated, name).toBe(false)
            // внутри рабочей зоны листа
            expect(p.x, name).toBeGreaterThanOrEqual(trim)
            expect(p.y, name).toBeGreaterThanOrEqual(trim)
            expect(p.x + p.l, name).toBeLessThanOrEqual(r.sheetL - trim)
            expect(p.y + p.w, name).toBeLessThanOrEqual(r.sheetW - trim)
          }
          // не пересекаются, между деталями — не меньше пропила
          for (let i = 0; i < pl.length; i++)
            for (let j = i + 1; j < pl.length; j++) {
              const [p, q] = [pl[i], pl[j]]
              const apart = p.x + p.l + kerf <= q.x || q.x + q.l + kerf <= p.x || p.y + p.w + kerf <= q.y || q.y + q.w + kerf <= p.y
              expect(apart, `${name}: ${JSON.stringify(p)} ${JSON.stringify(q)}`).toBe(true)
            }
        }
        // листов не меньше, чем по площади; отход — по формуле истории 7
        expect(r.sheets.length, name).toBeGreaterThanOrEqual(Math.ceil(area / (box.L * box.W)))
        if (r.sheets.length) expect(r.waste, name).toBeCloseTo(1 - area / (r.sheets.length * box.L * box.W), 9)
        for (const id of r.oversize) expect(seen.has(id), name).toBe(false)
      }
      // каждая деталь из листа — на листе столько раз, сколько штук, или в oversize
      const over = new Set(res.flatMap((r) => r.oversize))
      for (const p of parts.filter((x) => x.material.kind !== 'mdf')) {
        if (over.has(p.id)) continue
        expect(seen.get(p.id), `${name}: деталь ${p.id}`).toBe(p.count)
      }
      for (const p of parts.filter((x) => x.material.kind === 'mdf')) expect(seen.has(p.id), name).toBe(false)
    }
    expect(n).toBeGreaterThanOrEqual(200)
  }, 120_000)
})
