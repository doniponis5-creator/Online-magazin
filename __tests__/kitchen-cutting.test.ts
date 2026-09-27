import { describe, expect, it } from 'vitest'
import './helpers/canvas'
import { buildKitchen } from '@/components/kitchen/three/build'
import type { FinishLook } from '@/components/kitchen/three/materials'
import { frontColor } from '@/lib/kitchen/finishes'
import { DECORS } from '@/lib/kitchen/decors'
import { planKitchen, type Plan, type PlanInput } from '@/lib/kitchen/layout'
import { cutList, extraList, frontList, type SpecData, type SpecExtra } from '@/lib/kitchen/spec'
import { getTone, STYLES, type KitchenStyle } from '@/lib/kitchen/styles'
import type { HobKind, KitchenAppliance, Shape } from '@/lib/kitchen/types'
import { cutParts, edgeTotals, nest, type CutLook, type CutPart, type NestResult } from '@/lib/kitchen/cutting'
import { cutWorkbook } from '@/lib/kitchen/cutExcel'
import { kitchenTexts } from '@/components/kitchen/texts'

/**
 * Раскрой для распила (пакет мастера, истории 2, 4–8): детали, кромка,
 * раскладка по листам. Кухни собираются в node, как в kitchen-build.test.ts.
 */

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

type Kitchen = { shape: Shape; a: number; b: number; c: number; island: number; style?: KitchenStyle; tone?: number; ceiling?: number; toCeiling?: boolean; col?: Partial<PlanInput>; gas?: boolean; dwW?: number; finish?: FinishLook }

function spec(k: Kitchen): SpecData {
  return built(k).spec
}

/** Кухня целиком: раскладка (где какой модуль) и спецификация из 3D. */
function built(k: Kitchen): { plan: Plan; spec: SpecData } {
  const style = k.style ?? STYLES[0]
  const items = { fridge, dishwasher: dw(k.dwW ?? 45), hob: hob(k.gas ? 'gas' : 'electric'), oven, hood }
  const input: PlanInput = { shape: k.shape, a: k.a, b: k.b, c: k.c, island: k.island, ...k.col, fridge, dishwasher: items.dishwasher, hob: items.hob, oven, hood: { w: 60 } }
  const plan = planKitchen(input, { shelves: style.shelves })
  const b = buildKitchen({
    plan,
    style,
    tone: getTone(style, k.tone ?? 0),
    items,
    photos: new Map(),
    evening: false,
    room: { ceiling: k.ceiling ?? 270, toCeiling: k.toCeiling ?? false },
    fronts: {},
    detail: 0.5,
    finish: k.finish,
  })
  return { plan, spec: b.spec }
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
      // таск 01b (Решения §5a): доборы, планки угла и задняя панель острова — тоже в цвет фасадов; раньше их в раскрое не было
      const panels = extraList(s).filter((r) => r.kind === 'filler' || r.kind === 'strip' || r.kind === 'islandBack')
      expect(total(fronts(parts))).toBe(total(frontList(s.runs)) + total(panels))
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
      { thick: 2, net: 2, meters: 2.3 }, // 2,024 × 1,1 = 2,2264 → купить 2,3 (таск 01b: вверх, было до ближайшего 2,2)
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

/** Лист, пропил и обрезка, которые ждём (не из ответа nest). */
type Expect = { L: number; W: number; kerf: number; trim: number }
const DEFAULT: Expect = { L: 2800, W: 2070, kerf: 4, trim: 10 }

/**
 * Свойства раскладки, а не координаты: лист того размера, что ждём; детали внутри
 * листа за обрезкой, не пересекаются, между ними не меньше пропила; размеры — как в
 * раскрое; повёрнута только деталь без текстуры.
 */
function expectLayout(r: NestResult, parts: CutPart[], e: Expect, name = '') {
  expect([r.sheetL, r.sheetW], name).toEqual([e.L, e.W])
  const byId = new Map(parts.map((p) => [p.id, p]))
  for (const sh of r.sheets) {
    const pl = sh.placements
    expect(pl.length, name).toBeGreaterThan(0)
    for (const p of pl) {
      const part = byId.get(p.id)!
      expect(part.material, name).toEqual(r.material)
      expect(p.rotated ? [p.w, p.l] : [p.l, p.w], name).toEqual([part.length, part.width])
      if (part.grain) expect(p.rotated, `${name}: деталь ${p.id} с текстурой`).toBe(false)
      expect(p.x, name).toBeGreaterThanOrEqual(e.trim)
      expect(p.y, name).toBeGreaterThanOrEqual(e.trim)
      expect(p.x + p.l, name).toBeLessThanOrEqual(e.L - e.trim)
      expect(p.y + p.w, name).toBeLessThanOrEqual(e.W - e.trim)
    }
    for (let i = 0; i < pl.length; i++)
      for (let j = i + 1; j < pl.length; j++) {
        const [p, q] = [pl[i], pl[j]]
        const apart = p.x + p.l + e.kerf <= q.x || q.x + q.l + e.kerf <= p.x || p.y + p.w + e.kerf <= q.y || q.y + q.w + e.kerf <= p.y
        expect(apart, `${name}: ${JSON.stringify(p)} ${JSON.stringify(q)}`).toBe(true)
      }
  }
}

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
    expect(placed(plain)).toMatchObject([{ id: '7', l: 2100, w: 600, rotated: true }])
    expectLayout(plain, [wide(false)], DEFAULT)
    expectLayout(g, [wide(true), square('1', 1, true)], DEFAULT)
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

  it('свой лист, пропил и обрезка из опций: обе детали на листе 2440 × 1220, за обрезкой 15 и через пропил 5', () => {
    const parts = [square('1', 2)]
    const [r] = nest(parts, { sheet: { L: 2440, W: 1220 }, kerf: 5, trim: 15 })
    expect(r.sheets).toHaveLength(1)
    expect(placed(r)).toHaveLength(2)
    expectLayout(r, parts, { L: 2440, W: 1220, kerf: 5, trim: 15 })
  })

  it('лист мастера по материалу (opts.sheets): ЛДСП 2750 × 1830 — листов больше; ХДФ — по умолчанию; sheets важнее sheet', () => {
    const hdf: CutPart = { ...square('9', 1), name: 'back', material: { kind: 'hdf', label: 'Белый', color: '#fff', thick: 3 } }
    const parts = [square('1', 4), hdf]
    const [l, h] = nest(parts, { sheets: { ldsp: { L: 2750, W: 1830 } } })
    // 1000 × 1000 на рабочей 2730 × 1810: в ряд две (2 × 1000 + 4 ≤ 2730), второго ряда нет (2 × 1000 + 4 > 1810) — 2 листа; на 2800 × 2070 был бы один
    expect(l.sheets).toHaveLength(2)
    expectLayout(l, parts, { ...DEFAULT, L: 2750, W: 1830 })
    expectLayout(h, parts, DEFAULT)
    const [l2, h2] = nest(parts, { sheet: { L: 2440, W: 1220 }, sheets: { ldsp: { L: 2750, W: 1830 } } })
    expect([l2.sheetL, l2.sheetW, h2.sheetL, h2.sheetW]).toEqual([2750, 1830, 2440, 1220])
    expect(nest([square('1', 4)])[0].sheets).toHaveLength(1)
  })

  it('перебор порядков и поворотов (история 7a): каждой из двух кухонных задач нужен свой способ — один проход сделал бы 2 листа', () => {
    // 3 однотонные панели 2000 × 800: вдоль листа — по одной в полосе, 2 полосы (3 × 800 + 2 × 4 > 2050) → 2 листа;
    // повёрнутые (800 вдоль листа, 2000 поперёк) — три в ряд: 3 × 800 + 2 × 4 = 2408 ≤ 2780 → 1 лист
    const panels: CutPart = { ...square('1', 3), length: 2000, width: 800 }
    const [a] = nest([panels])
    expect(a.sheets).toHaveLength(1)
    expectLayout(a, [panels], DEFAULT)
    // 4 детали 1350 × 1000: без поворота — 2 в ряд (2 × 1350 + 4 = 2704 ≤ 2780), 2 ряда (2 × 1000 + 4 = 2004 ≤ 2050) → 1 лист;
    // повёрнутые (1000 вдоль, 1350 поперёк) — 2 в ряд, второго ряда нет (2 × 1350 > 2050) → 2 листа
    const blocks: CutPart = { ...square('2', 4), length: 1350, width: 1000 }
    const [b] = nest([blocks])
    expect(b.sheets).toHaveLength(1)
    expectLayout(b, [blocks], DEFAULT)
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

/**
 * Передняя кромка корпуса — независимо от кода: пары (передняя сторона, глубина), мм,
 * по каждому шкафу и нише: боковина — высота × глубина, дно и крыша — ширина внутри × глубина,
 * полка — на 2 мм уже и на 20 мельче, царга — ширина внутри × 100, боковина ниши — высота × глубина.
 */
function frontPairs(s: SpecData): Map<string, Set<string>> {
  const mm = (cm: number) => Math.round(cm * 10)
  const out = new Map<string, Set<string>>()
  const add = (name: string, front: number, depth: number) => out.set(name, (out.get(name) ?? new Set()).add(`${front}×${depth}`))
  for (const c of s.carcasses) {
    const inner = mm(c.w) - 32
    add('side', mm(c.h), mm(c.d))
    add('bottom', inner, mm(c.d))
    add('top', inner, mm(c.d))
    add('rail', inner, 100)
    add('shelf', inner - 2, mm(c.d) - 20)
  }
  for (const p of s.panels) add('nicheSide', mm(p.h), mm(p.d))
  return out
}

/** Каждая деталь корпуса из ЛДСП — ровно одна кромка: царга 0,4 по длинной, остальные видимой толщины по передней стороне; ХДФ — без кромки. */
function expectBodyEdges(s: SpecData, parts: CutPart[], visible: number, name: string) {
  const pairs = frontPairs(s)
  for (const p of body(parts)) {
    const e = p.edges
    const on = (['l1', 'l2', 'w1', 'w2'] as const).filter((k) => e[k] > 0)
    if (p.material.kind === 'hdf') {
      expect(on, `${name}: ${p.name} ${p.id}`).toEqual([])
      continue
    }
    expect(on, `${name}: ${p.name} ${p.id} ${p.length}×${p.width}`).toHaveLength(1)
    expect(e[on[0]], `${name}: ${p.name} ${p.id}`).toBe(p.name === 'rail' ? 0.4 : visible)
    // кромка — на передней стороне: сторона с кромкой × другая = (передняя × глубина) какого-то шкафа
    const [front, depth] = on[0][0] === 'l' ? [p.length, p.width] : [p.width, p.length]
    expect(pairs.get(p.name)?.has(`${front}×${depth}`), `${name}: ${p.name} ${p.id} кромка по ${front}, другая ${depth}`).toBe(true)
  }
}

/** Лист, который ждём для материала: свой мастера → общий → 2800 × 2070. */
const sheetFor = (kind: string, opts: (typeof OPTS)[number]): Expect => {
  const o = opts as { sheet?: { L: number; W: number }; sheets?: Record<string, { L: number; W: number }>; kerf?: number; trim?: number } | undefined
  const sh = o?.sheets?.[kind] ?? o?.sheet ?? { L: 2800, W: 2070 }
  return { L: sh.L, W: sh.W, kerf: o?.kerf ?? 4, trim: o?.trim ?? 10 }
}

describe('nest на переборе кухонь', () => {
  it('≥ 200 кухонь: всё размещено, свойства раскладки, листов ≥ площадь деталей / рабочая площадь; кромка корпуса — спереди', () => {
    let n = 0
    for (const { name, spec: s, look, opts } of kitchens()) {
      n++
      const parts = cutParts(s, look)
      expectBodyEdges(s, parts, look.bodyEdge ?? 1, name)
      const res = nest(parts, opts)
      const seen = new Map<string, number>()
      for (const r of res) {
        const e = sheetFor(r.material.kind, opts)
        expectLayout(r, parts, e, name)
        for (const p of placed(r)) seen.set(p.id, (seen.get(p.id) ?? 0) + 1)
        // нижняя граница — не из раскладки: площадь деталей этого материала из раскроя / рабочая площадь листа мастера, вверх
        const mine = parts.filter((p) => JSON.stringify(p.material) === JSON.stringify(r.material) && !r.oversize.includes(p.id))
        const area = mine.reduce((sum, p) => sum + p.length * p.width * p.count, 0)
        const work = (e.L - 2 * e.trim) * (e.W - 2 * e.trim)
        expect(area, name).toBeGreaterThan(0)
        expect(r.sheets.length, name).toBeGreaterThanOrEqual(Math.ceil(area / work))
        // отход — по истории 7: 1 − площадь деталей / (листов × рабочая площадь)
        expect(r.waste, name).toBeCloseTo(1 - area / (r.sheets.length * work), 9)
        for (const id of r.oversize) expect(seen.has(id), name).toBe(false)
      }
      // каждая деталь из листа — на листе столько раз, сколько штук, или в oversize
      const over = new Set(res.flatMap((r) => r.oversize))
      // таск 01b: не из листа теперь не только 'mdf', но и 'shop' (стекло, рамочные, фасад стиля) — из листа только ЛДСП и ХДФ
      const sheetKind = (x: CutPart) => x.material.kind === 'ldsp' || x.material.kind === 'hdf'
      for (const p of parts.filter(sheetKind)) {
        if (over.has(p.id)) continue
        expect(seen.get(p.id), `${name}: деталь ${p.id}`).toBe(p.count)
      }
      for (const p of parts.filter((x) => !sheetKind(x))) expect(seen.has(p.id), name).toBe(false)
    }
    expect(n).toBeGreaterThanOrEqual(200)
  }, 120_000)
})

/* ───────────── второй цвет верха, доборы и планки (таск 01b) ───────────── */

describe('признак upper из 3D: фасады и доборы верхнего ряда', () => {
  it('угловая и П-образная до потолка: upper — у фасадов выше столешницы (верх, антресоли, над холодильником), у низа — нет', () => {
    for (const s of [corner, uShape]) {
      const all = s.runs.flatMap((r) => r.fronts)
      const high = (f: { y: number }) => f.y >= s.heights.counter
      expect(all.filter(high).length).toBeGreaterThan(0)
      expect(all.filter((f) => !high(f)).length).toBeGreaterThan(0)
      for (const f of all) expect(Boolean(f.upper), `${f.x}:${f.y} ${f.hinge}`).toBe(high(f))
    }
  })

  it('добор верхнего ряда — upper, планка углового низа и задняя панель острова — нет', () => {
    const island = spec({ shape: 'island', a: 330, b: 0, c: 0, island: 160 })
    const ex = [...(corner.extras ?? []), ...(island.extras ?? [])]
    expect(ex.some((e) => e.kind === 'islandBack')).toBe(true)
    for (const e of ex.filter((e) => e.kind === 'islandBack')) expect(Boolean(e.upper)).toBe(false)
    for (const e of ex.filter((e) => e.kind === 'filler')) expect(e.upper).toBe(true)
  })
})

const FRONT_TYPES = ['door', 'framed', 'glass', 'drawer', 'lift', 'dw', 'panel']
const facades = (parts: CutPart[]) => parts.filter((p) => FRONT_TYPES.includes(p.name))

describe('верх своим цветом (upperFacade)', () => {
  it('угловая кухня: верх графит, низ белый — штук каждого цвета столько, сколько фасадов выше и ниже столешницы', () => {
    const all = corner.runs.flatMap((r) => r.fronts)
    const high = all.filter((f) => f.y >= corner.heights.counter).length
    const parts = facades(cutParts(corner, { facade: 'lam-white', upperFacade: 'lam-graphite' }))
    const qty = (label: string) => total(parts.filter((p) => p.material.label === label))
    expect(qty('Графит')).toBe(high)
    expect(qty('Белый премиум')).toBe(all.length - high)
    // графит — отдельная группа листов
    expect(nest(parts).map((r) => r.material.label).sort()).toEqual(['Белый премиум', 'Графит'])
  })

  it('без upperFacade и при upperFacade = style без тона — всё как низ', () => {
    for (const look of [{ facade: 'lam-grey' }, { facade: 'lam-grey', upperFacade: 'style' }] as CutLook[]) {
      const parts = facades(cutParts(corner, look))
      expect(new Set(parts.map((p) => p.material.label))).toEqual(new Set(['Серый шифер']))
      expect(total(parts)).toBe(total(frontList(corner.runs)))
    }
  })
})

describe('цвет верха по умолчанию — тон стиля (styles.ts, materials.ts)', () => {
  // первый тон с отдельным однотонным верхом: у стиля нет материала фасада — всё в цех фасадов
  const pick = STYLES.flatMap((st) => st.tones.map((t, i) => ({ st, t, i }))).find((x) => x.t.upper && !x.t.texture && !x.t.upperTexture)!
  const s = spec({ shape: 'corner', a: 300, b: 240, c: 0, island: 0, style: pick.st, tone: pick.i })
  const all = s.runs.flatMap((r) => r.fronts)
  const high = all.filter((f) => f.y >= s.heights.counter).length
  const colorQty = (parts: CutPart[], color: string) => total(facades(parts).filter((p) => p.material.color === color))

  it('без upperFacade: верх — цветом верха тона, низ — цветом фасадов тона; из листа ничего', () => {
    const parts = cutParts(s, { tone: pick.t })
    expect(colorQty(parts, pick.t.upper!)).toBe(high)
    expect(colorQty(parts, pick.t.facade)).toBe(all.length - high)
    expect(nest(facades(parts))).toEqual([])
  })

  it('фасад из каталога — верх как низ (как в 3D); upperFacade = style — снова цвет верха тона', () => {
    expect(colorQty(cutParts(s, { tone: pick.t, facade: 'lam-grey' }), '#8e9194')).toBe(all.length)
    const both = cutParts(s, { tone: pick.t, facade: 'lam-grey', upperFacade: 'style' })
    expect(colorQty(both, pick.t.upper!)).toBe(high)
    expect(colorQty(both, '#8e9194')).toBe(all.length - high)
  })
})

describe('доборы, планки угла, задняя панель острова — в раскрое и листах (Решения §5a)', () => {
  /** Без шкафов и фасадов: 4 задние панели острова 200 × 80 см, 2 добора верха 15 × 70, планка угла 5 × 71,6 и проём (не деталь). */
  const withExtras = (extras: SpecExtra[]): SpecData => ({ ...oneBase(), runs: [{ ...oneBase().runs[0], fronts: [] }], carcasses: [], extras })
  const ex: SpecExtra[] = [
    ...[1, 2, 3, 4].map((): SpecExtra => ({ kind: 'islandBack', run: 'I', w: 200, h: 80 })),
    { kind: 'filler', run: 'A', w: 15, h: 70, upper: true },
    { kind: 'filler', run: 'A', w: 15, h: 70, upper: true },
    { kind: 'strip', run: 'A', w: 5, h: 71.6 },
    { kind: 'dwOpening', run: 'A', w: 45, h: 82, hMax: 87 },
  ]
  const look: CutLook = { facade: 'lam-white', upperFacade: 'lam-graphite' }

  it('детали в цвет фасада, доборы верха — в цвет верха; ЛДСП 16, кромка 2 мм по кругу; проём — не деталь', () => {
    const parts = cutParts(withExtras(ex), look)
    const row = (p: CutPart) => [p.name, p.length, p.width, p.count, p.material.kind, p.material.label]
    expect(parts.map(row)).toHaveLength(3)
    expect(parts.map(row)).toEqual(
      expect.arrayContaining([
        ['islandBack', 2000, 800, 4, 'ldsp', 'Белый премиум'],
        ['strip', 716, 50, 1, 'ldsp', 'Белый премиум'],
        ['filler', 700, 150, 2, 'ldsp', 'Графит'],
      ]),
    )
    for (const p of parts) expect(p.edges).toEqual({ l1: 2, l2: 2, w1: 2, w2: 2 })
    // 2 мм: 4 × 2 × (2000 + 800) + 2 × 2 × (700 + 150) + 2 × (716 + 50) = 22 400 + 3 400 + 1 532 = 27 332 мм; × 1,1 = 30,07
    expect(edgeTotals(parts)).toEqual([{ thick: 2, net: 27.3, meters: 30.1 }])
  })

  it('листов больше на эти детали: белых 2 (6,44 м² > рабочих 2,78 × 2,05 = 5,70 м²), графит — 1; без доборов листов нет', () => {
    const sheets = (e: SpecExtra[]) => nest(cutParts(withExtras(e), look)).map((r) => [r.material.label, r.sheets.length])
    expect(sheets(ex)).toEqual([
      ['Белый премиум', 2],
      ['Графит', 1],
    ])
    expect(sheets([])).toEqual([])
  })

  it('МДФ — не из листа, в раскладку не идёт; добор из тона стиля — в цех фасадов', () => {
    const mdf = cutParts(withExtras(ex), { facade: 'en-white' })
    expect(mdf.filter((p) => p.material.kind === 'ldsp')).toEqual([])
    expect(total(mdf)).toBe(7)
    expect(nest(mdf)).toEqual([])
  })
})

describe('мелочи ревью (таск 01b)', () => {
  it('неизвестный id отделки — явный отказ: фасад, верх, корпус, свой цвет фасада', () => {
    expect(() => cutParts(oneBase(), { facade: 'no-such' })).toThrow(/no-such/)
    expect(() => cutParts(oneBase(), { upperFacade: 'nope' })).toThrow(/nope/)
    expect(() => cutParts(oneBase(), { body: 'bad-body' })).toThrow(/bad-body/)
    const own = oneBase()
    own.runs[0].fronts[0].color = 'gone'
    expect(() => cutParts(own, {})).toThrow(/gone/)
  })

  it('кромку «купить» — вверх до 0,1 м: ровно 2,2 м остаётся 2,2', () => {
    // деталь 1000 × 0 не бывает — берём фасад 500 × 500 из ЛДСП: 2 мм по кругу = 2000 мм, × 1,1 = 2,2 ровно
    const sq = oneBase()
    sq.carcasses = []
    sq.runs[0].fronts[0] = { ...sq.runs[0].fronts[0], w: 50, h: 50 }
    expect(edgeTotals(cutParts(sq, {}))).toEqual([{ thick: 2, net: 2, meters: 2.2 }])
  })
})

/* ───────────── таск 05: тесты, которые падают на поломке ───────────── */

describe('кромка крыши и боковины ниши (история 4)', () => {
  it('шкаф 30 см с крышей и ниша 210 × 60: крыша — передняя по ширине шкафа (268), боковина ниши — по высоте, 1 мм', () => {
    const s = oneBase({ top: true })
    s.panels = [{ h: 210, d: 60, count: 2 }]
    const parts = cutParts(s, {})
    expect(byName(parts, 'top')).toMatchObject({ length: 560, width: 268, count: 1, edges: { l1: 0, l2: 0, w1: 1, w2: 0 } })
    expect(byName(parts, 'nicheSide')).toMatchObject({ length: 2100, width: 600, count: 2, edges: { l1: 1, l2: 0, w1: 0, w2: 0 } })
    // под дерево и видимая 2 мм: длина — вдоль передней кромки, кромка — l1
    const wood = cutParts(s, { body: 'lam-sonoma', bodyEdge: 2 })
    expect(byName(wood, 'top')).toMatchObject({ length: 268, width: 560, grain: true, edges: { l1: 2, l2: 0, w1: 0, w2: 0 } })
    expect(byName(wood, 'nicheSide')).toMatchObject({ length: 2100, width: 600, grain: true, edges: { l1: 2, l2: 0, w1: 0, w2: 0 } })
    // 1 мм: 2 × 720 боковины + 268 дно + 268 крыша + 266 полка + 2 × 2100 ниша = 6442; 2 мм — дверца 2 × (716 + 296) = 2024
    expect(edgeTotals(parts)).toEqual([
      { thick: 1, net: 6.4, meters: 7.1 }, // 6,442 × 1,1 = 7,0862 → 7,1
      { thick: 2, net: 2, meters: 2.3 },
    ])
  })

  it('настоящие кухни (угловая, П-образная до потолка с нишей холодильника): у каждой крыши и боковины ниши — видимая кромка спереди', () => {
    for (const s of [corner, uShape]) {
      const parts = cutParts(s, {})
      expect(parts.some((p) => p.name === 'top')).toBe(true)
      expectBodyEdges(s, parts, 1, 'кухня')
    }
    expect(cutParts(uShape, {}).some((p) => p.name === 'nicheSide')).toBe(true)
  })
})

describe('текстура фасада — вдоль высоты фасада (истории 4, 8)', () => {
  /** Только фасад ящика 596 × 176 мм: шире, чем выше. */
  const drawer = (): SpecData => {
    const s = oneBase()
    s.carcasses = []
    s.runs[0].fronts = [{ x: 0.2, y: 10, w: 59.6, h: 17.6, hinge: 'drawer', glass: false, framed: false, handle: true }]
    return s
  }

  it('ящик под дерево: длина 176 — по высоте, вдоль волокна, на листе не повёрнут; однотонный — длинной стороной', () => {
    const [wood] = cutParts(drawer(), { facade: 'lam-sonoma' })
    expect(wood).toMatchObject({ length: 176, width: 596, grain: true, facade: { h: 176, w: 596 } })
    const [r] = nest([wood])
    expect(placed(r)).toMatchObject([{ l: 176, w: 596, rotated: false }])
    const [plain] = cutParts(drawer(), { facade: 'lam-grey' })
    expect(plain).toMatchObject({ length: 596, width: 176, grain: false })
  })

  it('угловая кухня под дерево: у каждого фасада и добора из ЛДСП длина — высота, ширина — ширина; широкие (ящики, подъёмные) есть', () => {
    const f = fronts(cutParts(corner, { facade: 'lam-sonoma' })).filter((p) => p.material.kind === 'ldsp')
    expect(f.some((p) => p.facade!.w > p.facade!.h)).toBe(true)
    for (const p of f) expect([p.length, p.width, p.grain], `${p.name} ${p.id}`).toEqual([p.facade!.h, p.facade!.w, true])
  })
})

describe('цвет верха: колонна и стиль без своего верха', () => {
  it('колонна с духовкой — цветом низа: её фасады выше столешницы (подъёмный над духовкой) без upper, в раскрое — цветом низа (build.ts, upper)', () => {
    // 3D и раскрой — с одной отделкой, как на экране: низ белый, верх графит
    const finish: FinishLook = { facade: frontColor('lam-white'), upper: frontColor('lam-graphite') }
    const { plan, spec: s } = built({ shape: 'corner', a: 300, b: 240, c: 0, island: 0, col: { tallOven: true }, finish })
    const cols = plan.runs.flatMap((r) => r.modules.filter((m) => m.kind === 'tall').map((m) => ({ run: r.id, x0: m.x, x1: m.x + m.w })))
    expect(cols.length).toBeGreaterThan(0)
    const inCol = s.runs.flatMap((r) => r.fronts.filter((f) => cols.some((c) => c.run === r.id && f.x >= c.x0 - 1 && f.x + f.w <= c.x1 + 1)))
    // над духовкой — подъёмный фасад выше столешницы: по высоте он «верх», по цвету — нет
    expect(inCol.some((f) => f.hinge === 'top' && f.y >= s.heights.counter)).toBe(true)
    for (const f of inCol) expect(Boolean(f.upper), `${f.hinge} ${f.x}:${f.y}`).toBe(false)
    // верх графит — у колонны ни одного графитового фасада; графитовых — сколько upper-фасадов вне колонны
    const parts = facades(cutParts(s, { facade: 'lam-white', upperFacade: 'lam-graphite' }))
    const all = s.runs.flatMap((r) => r.fronts)
    const up = all.filter((f) => f.upper).length
    expect(up).toBeGreaterThan(0)
    expect(total(parts.filter((p) => p.material.label === 'Графит'))).toBe(up)
    expect(total(parts.filter((p) => p.material.label === 'Белый премиум'))).toBe(all.length - up)
  })

  it('upperFacade = style, фасад из каталога, тон без своего верха — верх цветом низа тона (как в 3D: materials.ts styleUpper)', () => {
    const pick = STYLES.flatMap((st) => st.tones.map((t, i) => ({ st, t, i }))).find((x) => !x.t.upper && !x.t.texture && x.t.facade !== '#8e9194')!
    const s = spec({ shape: 'corner', a: 300, b: 240, c: 0, island: 0, style: pick.st, tone: pick.i })
    const all = s.runs.flatMap((r) => r.fronts)
    const high = all.filter((f) => f.y >= s.heights.counter).length
    expect(high).toBeGreaterThan(0)
    const parts = facades(cutParts(s, { tone: pick.t, facade: 'lam-grey', upperFacade: 'style' }))
    const upper = parts.filter((p) => p.material.color === pick.t.facade)
    expect(total(upper)).toBe(high)
    // цвет стиля — в цех фасадов, названием тона
    for (const p of upper) expect(p.material).toMatchObject({ kind: 'shop', label: pick.t.ru })
    expect(total(parts.filter((p) => p.material.color === '#8e9194'))).toBe(all.length - high)
  })
})

/* ───────────── R10: остров своим цветом ───────────── */

describe('остров своим цветом (islandFacade)', () => {
  const islandSpec = spec({ shape: 'island', a: 330, b: 0, c: 0, island: 160, finish: { facade: frontColor('lam-white'), island: frontColor('lam-graphite') } })
  const islandFronts = islandSpec.runs.find((r) => r.id === 'I')!.fronts.length
  const allFronts = islandSpec.runs.flatMap((r) => r.fronts).length
  const panels = (parts: CutPart[]) => parts.filter((p) => p.name === 'islandBack')

  it('фасады и задняя панель острова — графит, остальное — белый; штук столько же, сколько фасадов', () => {
    const parts = cutParts(islandSpec, { facade: 'lam-white', islandFacade: 'lam-graphite' })
    const f = facades(parts)
    const qty = (label: string) => total(f.filter((p) => p.material.label === label))
    expect(islandFronts).toBeGreaterThan(0)
    expect(qty('Графит')).toBe(islandFronts)
    expect(qty('Белый премиум')).toBe(allFronts - islandFronts)
    expect(total(f)).toBe(total(frontList(islandSpec.runs)))
    expect(panels(parts).length).toBeGreaterThan(0)
    for (const p of panels(parts)) expect(p.material.label).toBe('Графит')
    // остров из ЛДСП — своя группа листов
    expect(nest(parts.filter((p) => p.front)).map((r) => r.material.label).sort()).toEqual(['Белый премиум', 'Графит'])
  })

  it('верх, низ и остров — три цвета, каждый своими строками', () => {
    const parts = facades(cutParts(islandSpec, { facade: 'lam-white', upperFacade: 'lam-grey', islandFacade: 'lam-graphite' }))
    const upper = islandSpec.runs.flatMap((r) => r.fronts).filter((f) => f.upper).length
    const qty = (label: string) => total(parts.filter((p) => p.material.label === label))
    expect(upper).toBeGreaterThan(0)
    expect(qty('Графит')).toBe(islandFronts)
    expect(qty('Серый шифер')).toBe(upper)
    expect(qty('Белый премиум')).toBe(allFronts - islandFronts - upper)
  })

  it('остров МДФ (акрил) — в цех фасадов, из листа ЛДСП не пилится', () => {
    const acr = frontColor('acr-vanilla')!
    const parts = cutParts(islandSpec, { facade: 'lam-white', islandFacade: acr.id })
    const own = parts.filter((p) => p.front && p.material.label === acr.ru)
    expect(total(own)).toBe(islandFronts + total(panels(parts)))
    for (const p of own) expect(p.material.kind).toBe('mdf')
    expect(nest(parts).map((r) => r.material.label)).not.toContain(acr.ru)
    // в Excel «Фасады» — строки острова своим цветом, столько же штук
    const rows = cutWorkbook(islandSpec, { facade: 'lam-white', islandFacade: acr.id }, kitchenTexts('ru')).find((b) => b.name === 'Фасады')!.rows
    expect(rows.filter((r) => r[2] === acr.ru).reduce((n, r) => n + Number(r[5]), 0)).toBe(total(own))
  })

  it('без islandFacade — как раньше: остров цветом низа, одна группа фасадов', () => {
    const parts = cutParts(islandSpec, { facade: 'lam-white' })
    expect(new Set(parts.filter((p) => p.front).map((p) => p.material.label))).toEqual(new Set(['Белый премиум']))
    expect(total(facades(parts))).toBe(total(frontList(islandSpec.runs)))
  })
})

/* ───────────── R07, R04: код цвета в раскрое и Excel ───────────── */

describe('код цвета в подписи раскроя и в Excel (таск 03)', () => {
  const EGGER = 'Egger H1145 ST10 Дуб Бардолино натуральный'
  const book = (look: CutLook) => cutWorkbook(corner, look, kitchenTexts('ru'))
  const colorsOf = (look: CutLook, sheet: string, col: number) => new Set(book(look).find((b) => b.name === sheet)!.rows.slice(1).map((r) => r[col]).filter((v) => v !== null))

  it('декор Egger: «Распил» и «Листы» — «Egger H1145 ST10 Дуб Бардолино натуральный», дерево — текстура «да»', () => {
    const look: CutLook = { facade: 'dec-egger-h1145-st10' }
    expect(colorsOf(look, 'Распил', 3)).toContain(EGGER)
    expect(colorsOf(look, 'Листы', 1)).toContain(EGGER)
    const rows = book(look).find((b) => b.name === 'Распил')!.rows.filter((r) => r[3] === EGGER)
    expect(rows.length).toBeGreaterThan(0)
    for (const r of rows) expect(r[11]).toBe('да')
  })

  it('RAL 7016: «Фасады» — «МДФ, эмаль»-цех, цвет «RAL 7016 Антрацитово-серый»; в распил не идёт', () => {
    const look: CutLook = { facade: 'ral-7016' }
    expect(colorsOf(look, 'Фасады', 2)).toEqual(new Set(['RAL 7016 Антрацитово-серый']))
    expect(colorsOf(look, 'Распил', 3)).not.toContain('RAL 7016 Антрацитово-серый')
  })

  it('Lamarty без номера — «Lamarty Графит»; каталожный цвет — без кода, как раньше', () => {
    const lam = DECORS.find((d) => d.brand === 'lamarty' && d.ru === 'Графит')!
    expect(colorsOf({ facade: lam.id }, 'Распил', 3)).toContain('Lamarty Графит')
    expect(colorsOf({ facade: 'lam-graphite' }, 'Распил', 3)).toContain('Графит')
  })

  it('низ RAL, остров декором: RAL — в «Фасады» (цех), фасады острова из ЛДСП — в «Распил», оба с кодом', () => {
    const islandSpec = spec({ shape: 'island', a: 330, b: 0, c: 0, island: 160, finish: { facade: frontColor('ral-7016'), island: frontColor('dec-egger-h1145-st10') } })
    const wb = cutWorkbook(islandSpec, { facade: 'ral-7016', islandFacade: 'dec-egger-h1145-st10' }, kitchenTexts('ru'))
    const col = (sheet: string, i: number) => new Set(wb.find((b) => b.name === sheet)!.rows.slice(1).map((r) => r[i]))
    expect(col('Фасады', 2)).toContain('RAL 7016 Антрацитово-серый')
    expect(col('Распил', 3)).toContain(EGGER)
    expect(col('Фасады', 2)).not.toContain(EGGER)
  })
})
