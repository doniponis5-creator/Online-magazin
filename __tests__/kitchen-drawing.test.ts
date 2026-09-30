import { describe, expect, it } from 'vitest'
import './helpers/canvas'
import { buildKitchen } from '@/components/kitchen/three/build'
import { WINDOW } from '@/lib/kitchen/dims'
import {
  elevationSvg,
  islandOverhang,
  makerList,
  paperSize,
  pickScale,
  planSvg,
  printedScale,
  SCALES,
  SHEET_BOX,
  techRows,
  windowFor,
  type DrawingLabels,
} from '@/components/kitchen/drawing'
import { kitchenTexts } from '@/components/kitchen/texts'
import { LIMITS, planKitchen, type Plan, type PlanInput } from '@/lib/kitchen/layout'
import { modulesOf, type SpecData, type SpecRun } from '@/lib/kitchen/spec'
import { getTone, STYLES } from '@/lib/kitchen/styles'
import type { HobKind, KitchenAppliance, Shape } from '@/lib/kitchen/types'

/**
 * Развёртки стен (шов `elevationSvg`), как в аудите чертежа: настоящая сборка
 * planKitchen → buildKitchen (node, заглушка холста) → spec → SVG на переборе
 * из 400 случайных кухонь. Находки D06–D09, D11, D12, D15, D16, D18, D21, D27
 * (`.autopilot/2026-09-26-kitchen-3d-audit-pro--wip/audit-drawing.md`).
 */

/* ───────────── кухни ───────────── */

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

/** Псевдослучайные числа с зерном: перебор одинаковый при каждом прогоне. */
function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let x = s
    x = Math.imul(x ^ (x >>> 15), x | 1)
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61)
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296
  }
}

type Kitchen = { name: string; plan: Plan; spec: SpecData; lang: 'ru' | 'ky'; ceiling: number }

function kitchen(input: PlanInput, o: { style?: number; ceiling: number; toCeiling: boolean; hood?: 'chimney' | 'inclined' | 'telescopic' | 'insert'; gas?: boolean; lang?: 'ru' | 'ky' }): Kitchen {
  const style = STYLES[(o.style ?? 0) % STYLES.length]
  const plan = planKitchen(input, { shelves: style.shelves })
  const items = {
    fridge: input.fridge ?? null,
    dishwasher: input.dishwasher ?? null,
    washer: input.washer ?? null,
    hob: input.hob ?? null,
    oven: input.noOven ? null : appliance({ slot: 'oven', w: 59.5, h: 59.5, d: 56, builtIn: true }),
    hood: appliance({ slot: 'hood', w: 60, h: 50, d: 50, hood: o.hood ?? 'chimney' }),
  }
  const built = buildKitchen({
    plan,
    style,
    tone: getTone(style, 0),
    items,
    photos: new Map(),
    evening: false,
    room: { ceiling: o.ceiling, toCeiling: o.toCeiling },
    fronts: {},
    detail: 0.5,
  })
  return { name: `${input.shape} a${input.a} b${input.b} c${input.c} i${input.island} h${o.ceiling}${o.toCeiling ? '+' : ''}`, plan, spec: built.spec, lang: o.lang ?? 'ru', ceiling: o.ceiling }
}

const SHAPES: Shape[] = ['straight', 'corner', 'u', 'island']

function randomKitchen(r: () => number): Kitchen {
  const pick = <T,>(list: readonly T[]) => list[Math.floor(r() * list.length)]
  const span = (k: keyof typeof LIMITS) => Math.round(LIMITS[k].min + r() * (LIMITS[k].max - LIMITS[k].min))
  const shape = pick(SHAPES)
  const gas = r() < 0.3
  const input: PlanInput = {
    shape,
    a: Math.max(span('a'), shape === 'u' ? 300 : shape === 'corner' ? 240 : 180),
    b: shape === 'corner' || shape === 'u' ? span('b') : 0,
    c: shape === 'u' ? span('c') : 0,
    island: shape === 'island' ? span('island') : 0,
    fridge: r() < 0.9 ? appliance({ slot: 'fridge', w: pick([54, 59.5, 60, 70]), h: pick([170, 185, 201, 203]) }) : null,
    dishwasher: r() < 0.7 ? appliance({ slot: 'dishwasher', w: pick([44.8, 59.8]), h: 81.5, d: 55, builtIn: true }) : null,
    washer: r() < 0.3 ? appliance({ slot: 'washer', w: 59.5, h: 84, d: 50 }) : null,
    hob: appliance({ slot: 'hob', w: pick([59, 75, 90]), h: 5, d: 52, builtIn: true, hob: (gas ? 'gas' : 'electric') as HobKind }),
    oven: { w: 59.5, h: 59.5, d: 56 },
    hood: { w: 60 },
    ...pick([{}, { tallOven: true }, { ovenApart: true }, { pantries: 1 }, { pantries: 2 }, { noWindow: true }, { windowW: 60 }, { windowW: 240 }]),
  }
  const ceiling = 240 + 10 * Math.floor(r() * 9)
  return kitchen(input, {
    style: Math.floor(r() * STYLES.length),
    ceiling,
    toCeiling: r() < 0.5,
    hood: pick(['chimney', 'inclined', 'telescopic'] as const),
    gas,
    lang: r() < 0.5 ? 'ru' : 'ky',
  })
}

function labelsFor(lang: 'ru' | 'ky'): DrawingLabels {
  const t = kitchenTexts(lang)
  return { cm: t.cm, appliance: (slot) => t.techShort[slot as keyof typeof t.techShort] ?? slot, ...t.drawing }
}

function svgOf(k: Kitchen, run: SpecRun, scale?: number): string {
  // так же, как экран: окно — из WINDOW сборки, свес острова — из столешниц сборки
  return elevationSvg(run, k.spec.heights, labelsFor(k.lang), windowFor(k.plan, run.id, k.ceiling, WINDOW), { scale, overhang: islandOverhang(k.spec.runs) })
}

/* ───────────── разбор SVG ───────────── */

const attrsOf = (s: string): Record<string, string> => Object.fromEntries([...s.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, k, v]) => [k, v]))
const unesc = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&')
const texts = (svg: string) => [...svg.matchAll(/<text([^>]*)>([^<]*)<\/text>/g)].map(([, a, s]) => ({ a: attrsOf(a), s: unesc(s) }))
const rects = (svg: string, cls: string) =>
  [...svg.matchAll(/<rect([^>]*)\/>/g)].map((m) => attrsOf(m[1])).filter((a) => (a.class ?? '').split(' ').includes(cls))
const num = (s: string) => parseFloat(s.replace(',', '.'))
const rootFs = (svg: string) => parseFloat(/--el-fs:([\d.]+)px/.exec(svg)?.[1] ?? 'NaN')
const sizeOf = (svg: string, a: Record<string, string>) => {
  const m = /font-size:([\d.]+)px/.exec(a.style ?? '')
  return m ? parseFloat(m[1]) : rootFs(svg)
}
/**
 * Ширина надписи жирным Manrope: в аудите «Посудомойка» при шрифте 13,8 заняла
 * 93 см — 0,61 кегля на букву. Меньше не берём: иначе тест пропустит налезание.
 */
const textWidth = (s: string, size: number) => s.length * 0.61 * size

/* ───────────── перебор ───────────── */

const r = rng(20260926)
const FUZZ: Kitchen[] = Array.from({ length: 400 }, () => randomKitchen(r))

describe('развёртки на переборе 400 кухонь', () => {
  it('без NaN; цепочка каждой стены сходится с её длиной, включая угол 60 на B/C', () => {
    for (const k of FUZZ)
      for (const run of k.spec.runs) {
        const svg = svgOf(k, run)
        const where = `${k.name} ${run.id}`
        expect(svg, where).not.toMatch(/NaN|undefined|Infinity/)
        const low = texts(svg).filter((t) => t.a['data-chain'] === 'low')
        expect(low.reduce((s, t) => s + num(t.s), 0), where).toBeCloseTo(run.length, 0)
        if (run.id === 'B' || run.id === 'C') {
          // угол 60 — на месте торца углового шкафа: у B в конце стены, у C в начале
          const [a, b] = run.id === 'B' ? [run.length - 60, run.length] : [0, 60]
          const seg = low.filter((t) => +t.a.x > a && +t.a.x < b)
          expect(seg.map((t) => num(t.s)), `${where}: угол`).toEqual([60])
          expect(rects(svg, 'el-cut').some((c) => Math.abs(+c.x - a) < 0.2 && Math.abs(+c.width - 60) < 0.2), `${where}: торец`).toBe(true)
          expect(rects(svg, 'el-hatch').length + (svg.match(/class="el-hatch"/g)?.length ?? 0), where).toBeGreaterThan(0)
          expect(texts(svg).some((t) => t.s === labelsFor(k.lang).corner), where).toBe(true)
        }
      }
  })

  it('у каждого модуля — нижнего и верхнего — есть число', () => {
    let lower = 0
    let upper = 0
    for (const k of FUZZ)
      for (const run of k.spec.runs) {
        const svg = svgOf(k, run)
        const all = texts(svg)
        const where = `${k.name} ${run.id}`
        for (const m of run.modules) {
          lower++
          const hit = all.some((t) => t.a['data-chain'] === 'low' && Math.abs(num(t.s) - m.w) < 0.06 && +t.a.x >= m.x - 0.01 && +t.a.x <= m.x + m.w + 0.01)
          expect(hit, `${where}: модуль ${m.x}+${m.w}`).toBe(true)
        }
        for (const b of modulesOf(run).upper) {
          upper++
          const parts = all.filter((t) => t.a['data-chain'] === 'up' && +t.a.x > b.x && +t.a.x < b.x + b.w)
          expect(parts.reduce((s, t) => s + num(t.s), 0), `${where}: верх ${b.kind} ${b.x}+${b.w}`).toBeCloseTo(b.w, 0)
        }
      }
    expect(lower).toBeGreaterThan(2000)
    expect(upper).toBeGreaterThan(1000)
  })

  it('подписи техники не шире своей рамки', () => {
    let checked = 0
    for (const k of FUZZ)
      for (const run of k.spec.runs) {
        const svg = svgOf(k, run)
        const frames = rects(svg, 'el-tech').map((a) => ({ x: +a.x, y: +a.y, w: +a.width, h: +a.height }))
        for (const t of texts(svg).filter((t) => (t.a.class ?? '').includes('el-tech'))) {
          const x = +t.a.x
          const y = +t.a.y
          const f = frames.find((f) => x >= f.x && x <= f.x + f.w && y >= f.y && y <= f.y + f.h)
          expect(f, `${k.name} ${run.id}: «${t.s}» вне рамки`).toBeTruthy()
          const room = /rotate/.test(t.a.transform ?? '') ? f!.h : f!.w
          expect(textWidth(t.s, sizeOf(svg, t.a)), `${k.name} ${run.id}: «${t.s}» в рамке ${room}`).toBeLessThanOrEqual(room)
          checked++
        }
      }
    expect(checked).toBeGreaterThan(400)
  })
})

/* ───────────── отдельные случаи ───────────── */

const fridge = appliance({ slot: 'fridge' })
const cornerDefault = kitchen(
  { shape: 'corner', a: 300, b: 240, c: 0, island: 0, fridge, dishwasher: appliance({ slot: 'dishwasher', w: 44.8, h: 81.5, d: 55, builtIn: true }), hob: appliance({ slot: 'hob', w: 59, h: 5, builtIn: true }), oven: { w: 59.5, h: 59.5, d: 56 }, hood: { w: 60 } },
  { ceiling: 270, toCeiling: true },
)
const marksOf = (svg: string) => texts(svg).filter((t) => t.a['data-mark'] !== undefined).map((t) => num(t.s))

describe('отметки высот, вытяжка, остров, масштаб', () => {
  it('D12: отметки 0 / цоколь / корпус / столешница / верх / потолок — и на стене 600', () => {
    const long = kitchen({ shape: 'straight', a: 600, b: 0, c: 0, island: 0, fridge }, { ceiling: 270, toCeiling: true })
    for (const k of [cornerDefault, long]) {
      const run = k.spec.runs.find((r) => r.id === 'A')!
      const h = k.spec.heights
      const marks = marksOf(svgOf(k, run))
      const thick = run.tops[0].thick
      for (const v of [0, h.plinth, h.counter - thick, h.counter, h.upperBottom, h.upperTop, 270]) expect(marks, `${k.name}: ${v}`).toContainEqual(expect.closeTo(v, 1))
    }
  })

  it('D11: высота колонны и ниши холодильника, если они не совпадают с верхом шкафов', () => {
    const k = kitchen({ shape: 'straight', a: 360, b: 0, c: 0, island: 0, fridge: appliance({ slot: 'fridge', h: 203 }), tallOven: true }, { ceiling: 320, toCeiling: false })
    const run = k.spec.runs[0]
    const tall = run.boxes.filter((b) => b.kind === 'tall' || b.kind === 'pantry' || b.kind === 'overFridge')
    expect(tall.length).toBeGreaterThan(0)
    const marks = marksOf(svgOf(k, run))
    for (const b of tall) expect(marks, `${b.kind} ${b.y + b.h}`).toContainEqual(expect.closeTo(b.y + b.h, 1))
  })

  it('D16: число «вытяжка над панелью» равно низу вытяжки минус столешница', () => {
    const run = cornerDefault.spec.runs.find((r) => r.boxes.some((b) => b.slot === 'hood'))!
    const hood = run.boxes.find((b) => b.slot === 'hood')!
    const dim = texts(svgOf(cornerDefault, run)).find((t) => t.a['data-dim'] === 'hood')
    expect(dim).toBeTruthy()
    expect(num(dim!.s)).toBeCloseTo(hood.y - cornerDefault.spec.heights.counter, 0)
  })

  it('2026-09-27: встроенная вытяжка — отметка низа верхнего ряда на обеих стенах поднята, «до вытяжки» = норма 65', () => {
    const k = kitchen(
      { shape: 'corner', a: 300, b: 240, c: 0, island: 0, fridge, hob: appliance({ slot: 'hob', w: 59, h: 5, builtIn: true }), oven: { w: 59.5, h: 59.5, d: 56 }, hood: { w: 60 } },
      { ceiling: 270, toCeiling: false, hood: 'telescopic' },
    )
    const ub = k.spec.heights.upperBottom
    expect(ub).toBeGreaterThan(142)
    for (const run of k.spec.runs) {
      const marks = marksOf(svgOf(k, run))
      expect(marks, run.id).toContainEqual(expect.closeTo(ub, 1))
      expect(marks, run.id).not.toContainEqual(expect.closeTo(142, 0.5))
    }
    const run = k.spec.runs.find((r) => r.boxes.some((b) => b.slot === 'hood'))!
    const dim = texts(svgOf(k, run)).find((t) => t.a['data-dim'] === 'hood')
    expect(num(dim!.s)).toBe(65)
  })

  it('D18: остров — без стены и отметок верхних шкафов, со свесом в разрезе', () => {
    const k = kitchen({ shape: 'island', a: 330, b: 0, c: 0, island: 160, fridge }, { ceiling: 270, toCeiling: false })
    const run = k.spec.runs.find((r) => r.id === 'I')!
    const svg = svgOf(k, run)
    expect(rects(svg, 'el-wall')).toEqual([])
    expect(marksOf(svg)).not.toContainEqual(expect.closeTo(k.spec.heights.upperBottom, 1))
    const over = texts(svg).find((t) => t.a['data-dim'] === 'overhang')
    expect(over && num(over.s)).toBeCloseTo(run.tops[0].depth - 62, 0)
  })

  it('D21: один масштаб на все стены листа — один шрифт и отметка масштаба', () => {
    const u = kitchen({ shape: 'u', a: 450, b: 240, c: 300, island: 0, fridge }, { ceiling: 270, toCeiling: false })
    const svgs = u.spec.runs.map((r) => svgOf(u, r, 30))
    expect(new Set(svgs.map(rootFs)).size).toBe(1)
    for (const s of svgs) expect(s).toContain('data-scale="30"')
  })
})

/* ───────────── окно, план, масштаб, список для мастера (дозапрос 06-1) ───────────── */

describe('окно на развёртке', () => {
  it('подоконник 100 и верх 230 — из WINDOW сборки и помечены «уточнить на месте» (RU/KY)', () => {
    const run = cornerDefault.spec.runs.find((r) => r.id === 'A')!
    const svg = svgOf(cornerDefault, run)
    expect(marksOf(svg)).toContainEqual(expect.closeTo(100, 1))
    expect(marksOf(svg)).toContainEqual(expect.closeTo(230, 1))
    expect(kitchenTexts('ky').drawing.windowNote('100', '230')).toMatch(/100.*230.*тактаңыз/)
    const note = texts(svg)
      .filter((t) => t.a['data-cap'] === 'window')
      .map((t) => t.s)
      .join(' ')
    expect(note).toMatch(/100.*230.*уточнить на месте/)
  })
})

describe('план сверху', () => {
  const isl = kitchen({ shape: 'island', a: 330, b: 0, c: 0, island: 160, fridge }, { ceiling: 270, toCeiling: false })
  it('проход до острова — между фасадами (110) и подпись говорит, между какими; глубины 60/35/62/92/30 — из модели', () => {
    for (const lang of ['ru', 'ky'] as const) {
      const t = kitchenTexts(lang)
      const svg = planSvg(isl.plan, { cm: t.cm, ...t.plan }, { runs: isl.spec.runs })
      expect(svg).not.toMatch(/NaN|undefined/)
      const pass = texts(svg).find((x) => x.a['data-dim'] === 'passage')
      expect(pass?.s).toBe(`${t.plan.passage} 110`)
      expect(t.plan.passage).toMatch(/фасад/)
      const dim = (k: string) => num(texts(svg).find((x) => x.a['data-dim'] === k)?.s ?? 'NaN')
      expect(dim('depth')).toBe(60)
      expect(dim('islandDepth')).toBe(92)
      const top = rects(svg, 'pl-top')
      expect(top.map((r) => +r.height)).toEqual([92])
      const cap = texts(svg).find((x) => x.a['data-cap'] === 'depths')?.s ?? ''
      for (const v of [60, 62, 35, 92, 30]) expect(cap, `${lang}: ${v}`).toMatch(new RegExp(`(^|\\D)${v}(\\D|$)`))
    }
  })
})

describe('масштаб листа', () => {
  const uMax = kitchen({ shape: 'u', a: LIMITS.a.max, b: LIMITS.b.max, c: LIMITS.c.max, island: 0, fridge }, { ceiling: 270, toCeiling: false, lang: 'ky' })
  const long = kitchen({ shape: 'straight', a: 600, b: 0, c: 0, island: 0, fridge }, { ceiling: 270, toCeiling: true })
  it('pickScale — один масштаб на все стены, самый крупный из влезающих; printedScale подписывает только влезший рисунок', () => {
    for (const k of [cornerDefault, uMax, long]) {
      const make = (s: number) => k.spec.runs.map((r) => svgOf(k, r, s))
      const s = pickScale(make)
      const svgs = make(s)
      for (const svg of svgs) {
        expect(svg).toContain(`data-scale="${s}"`)
        expect(paperSize(svg, s).w, k.name).toBeLessThanOrEqual(SHEET_BOX.w)
        expect(paperSize(svg, s).h, k.name).toBeLessThanOrEqual(SHEET_BOX.h)
      }
      const i = SCALES.indexOf(s)
      expect(i, k.name).toBeGreaterThan(0)
      const bigger = make(SCALES[i - 1])
      expect(printedScale(svgs, s, SHEET_BOX), k.name).toBe(s)
      expect(printedScale(bigger, SCALES[i - 1], SHEET_BOX), k.name).toBeNull()
    }
  })
})

describe('«Коротко: что где стоит»', () => {
  const rowOf = (text: string, head: string, which: string) =>
    text
      .split('\n\n')
      .find((b) => b.startsWith(head))
      ?.split('\n')
      .find((l) => l.trim().startsWith(`${which}:`))
      ?.split(': ')[1]
      .split(' · ') ?? []
  const sum = (parts: string[]) => parts.reduce((s, p) => s + parseFloat(p.split(' ').pop()!), 0)

  it('угловая по умолчанию, стена B: в верхе угловой заход 35, сумма верха и низа = 240', () => {
    const t = kitchenTexts('ru')
    const text = makerList(cornerDefault.plan, {}, t, [])
    const head = t.wall('B', 240)
    const up = rowOf(text, head, t.upper)
    const low = rowOf(text, head, t.lower)
    expect(up[up.length - 1]).toBe(`${t.drawing.corner} 35`)
    expect(low[low.length - 1]).toBe(`${t.drawing.corner} 60`)
    expect(sum(up)).toBe(240)
    expect(sum(low)).toBe(240)
  })

  it('на переборе: угол в списке — тот же, что заштрихован на развёртке; низ и верх стены сходятся с её длиной', () => {
    for (const k of FUZZ) {
      const t = kitchenTexts(k.lang)
      const text = makerList(k.plan, {}, t, [])
      const h = k.spec.heights
      for (const run of k.plan.runs.filter((r) => r.wall)) {
        const where = `${k.name} ${run.id}`
        const head = t.wall(run.id, Math.round(run.length))
        const low = rowOf(text, head, t.lower)
        const up = rowOf(text, head, t.upper)
        const corners = (parts: string[]) => parts.filter((p) => p.startsWith(`${t.drawing.corner} `)).map((p) => parseFloat(p.split(' ').pop()!))
        const cuts = rects(svgOf(k, k.spec.runs.find((r) => r.id === run.id)!), 'el-cut')
        const widths = (hh: number) => cuts.filter((c) => Math.abs(+c.height - hh) < 0.2).map((c) => Math.round(+c.width))
        expect(corners(low), `${where}: угол низа`).toEqual(widths(h.counter))
        expect(Math.abs(sum(low) - run.length), `${where}: низ ${low.join(' · ')}`).toBeLessThanOrEqual(low.length * 0.5)
        if (up.length) {
          expect(corners(up), `${where}: угол верха`).toEqual(widths(h.upperTop - h.upperBottom))
          expect(Math.abs(sum(up) - run.length), `${where}: верх ${up.join(' · ')}`).toBeLessThanOrEqual(up.length * 0.5)
        }
      }
    }
  })

  it('окно в верхнем ряду — одной записью; пустое место не над окном окном не называется (RU/KY)', () => {
    for (const lang of ['ru', 'ky'] as const) {
      const t = kitchenTexts(lang)
      // угловая по умолчанию: окно 100 на стене A — одна запись «окно 100»
      const upA = rowOf(makerList(cornerDefault.plan, {}, t, []), t.wall('A', 300), t.upper)
      expect(upA.filter((p) => p.startsWith(`${t.uppers.none} `)), `${lang}: ${upA.join(' · ')}`).toEqual([`${t.uppers.none} 100`])
      expect(sum(upA)).toBe(300)
      // C18: плита у окна на стене A — над варочной за окном пусто, но это не окно.
      // Раскладка (таск 03) уводит плиту от окна, где может; берём первую угловую
      // из ряда, где плита всё же встала краем под окно.
      const outsideOf = (plan: Plan) => {
        const w = plan.window!
        const run = plan.runs.find((r) => r.id === 'A')!
        return run.uppers.filter((u) => u.kind === 'none' && (u.x + u.w <= w.at - w.w / 2 + 0.5 || u.x >= w.at + w.w / 2 - 0.5))
      }
      const hob = appliance({ slot: 'hob', w: 59, h: 5, builtIn: true })
      let c18: Kitchen | undefined
      search: for (const arrangement of [{ A: ['sink', 'hob', 'oven'], B: ['fridge'] }, { A: ['hob', 'oven', 'sink'], B: ['fridge'] }, { A: ['sink', 'dishwasher', 'hob', 'oven'], B: ['fridge'] }] as const)
        for (const windowW of [100, 160, 240])
          for (let a = 240; a <= 420; a += 10) {
            const input: PlanInput = { shape: 'corner', a, b: 240, c: 0, island: 0, fridge, hob, oven: { w: 59.5, h: 59.5, d: 56 }, hood: { w: 60 }, windowW, arrangement: { A: [...arrangement.A], B: [...arrangement.B] } }
            if (!outsideOf(planKitchen(input, { shelves: false })).length) continue
            c18 = kitchen(input, { ceiling: 270, toCeiling: true, lang })
            if (outsideOf(c18.plan).length) break search
          }
      expect(c18, 'нет угловой с плитой краем под окном').toBeTruthy()
      const win = c18!.plan.window!
      const outside = outsideOf(c18!.plan)
      const la = Math.round(c18!.plan.runs.find((r) => r.id === 'A')!.length)
      const up = rowOf(makerList(c18!.plan, {}, t, []), t.wall('A', la), t.upper)
      expect(up.filter((p) => p.startsWith(`${t.uppers.none} `)), `${lang}: ${up.join(' · ')}`).toEqual([`${t.uppers.none} ${win.w}`])
      for (const u of outside) expect(up, `${lang}: ${up.join(' · ')}`).toContain(`${t.upperEmpty} ${Math.round(u.w)}`)
      expect(t.upperEmpty).not.toBe(t.uppers.none)
      expect(Math.abs(sum(up) - la)).toBeLessThanOrEqual(up.length * 0.5)
    }
  })

  it('U11: техника без размеров — «размер примерный» в строках PDF и в «что где стоит» (RU/KY)', () => {
    for (const lang of ['ru', 'ky'] as const) {
      const t = kitchenTexts(lang)
      const hood = appliance({ slot: 'hood', name: 'Hood X', sizeKnown: false })
      const rows = techRows([fridge, hood], t)
      expect(rows[1][1]).toContain(t.approxSize)
      expect(rows[0][1]).not.toContain(t.approxSize)
      const list = makerList(cornerDefault.plan, {}, t, [fridge, hood])
      expect(list.toLowerCase()).toContain(lang === 'ru' ? 'размер примерный' : 'өлчөмү болжолдуу')
      expect(list).toContain(t.slots.hood)
      expect(makerList(cornerDefault.plan, {}, t, [fridge])).not.toContain(t.approxList(t.slots.fridge))
    }
  })
})

describe('подпись мойки на развёртке (P3)', () => {
  it('стена с мойкой: мойка подписана, как духовка и вытяжка; RU и KY', () => {
    for (const lang of ['ru', 'ky'] as const) {
      const k = kitchen({ shape: 'straight', a: 300, b: 0, c: 0, island: 0, hob: appliance({ slot: 'hob', w: 59, h: 5, d: 52, builtIn: true }), oven: { w: 59.5, h: 59.5, d: 56 }, hood: { w: 60 } }, { ceiling: 270, toCeiling: false, lang })
      const run = k.spec.runs.find((r) => r.id === 'A')!
      expect(run.boxes.some((b) => b.kind === 'sinkBase')).toBe(true)
      const svg = elevationSvg(run, k.spec.heights, labelsFor(lang), null, {})
      expect(svg).toContain('data-label="sink"')
      expect(svg).toContain(lang === 'ru' ? '>Мойка<' : '>Жуугуч<')
    }
  })
})
