import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import './helpers/canvas'
import { buildKitchen, type Built } from '@/components/kitchen/three/build'
import { planKitchen, type Plan, type PlanInput } from '@/lib/kitchen/layout'
import { UNDER_COUNTER } from '@/lib/kitchen/checks'
import { BASE_H, BODY, PLINTH } from '@/lib/kitchen/dims'
import { frontColor } from '@/lib/kitchen/finishes'
import { cutList, extraList, frontList, modulesOf, type SpecData } from '@/lib/kitchen/spec'
import { getStyle, getTone, STYLES, type KitchenStyle } from '@/lib/kitchen/styles'
import type { HobKind, HoodKind, KitchenAppliance, Shape } from '@/lib/kitchen/types'

/**
 * 3D-сборка в node, как в аудите: текстуры рисуются на заглушке холста.
 * Находки C05–C08, C11, D01, D02, D05, D10, D13, D16, D17, D25
 * (`.autopilot/2026-09-26-kitchen-3d-audit-pro--wip/`).
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
const hood = (kind: HoodKind = 'chimney') => appliance({ slot: 'hood', w: 60, h: 50, d: 50, hood: kind })
const hob = (kind: HobKind = 'electric') => appliance({ slot: 'hob', w: 59, h: 5, d: 52, builtIn: true, hob: kind })
const dw = (w = 45) => appliance({ slot: 'dishwasher', w: w - 0.2, h: 81.5, d: 55, builtIn: true })

type Case = { name: string; input: PlanInput; style: KitchenStyle; ceiling: number; toCeiling: boolean; items: Record<string, KitchenAppliance | null> }

function build(c: Omit<Case, 'name'>, extra: { columns?: Record<string, number> } = {}): Built {
  const plan = planKitchen(c.input, { shelves: c.style.shelves })
  return buildKitchen({
    plan,
    style: c.style,
    tone: getTone(c.style, 0),
    items: c.items,
    photos: new Map(),
    evening: false,
    room: { ceiling: c.ceiling, toCeiling: c.toCeiling },
    fronts: {},
    detail: 0.5,
    ...extra,
  })
}

const SHAPES: { shape: Shape; a: number; b: number; c: number; island: number }[] = [
  { shape: 'straight', a: 300, b: 0, c: 0, island: 0 },
  { shape: 'corner', a: 300, b: 240, c: 0, island: 0 },
  { shape: 'u', a: 360, b: 240, c: 240, island: 0 },
  { shape: 'island', a: 330, b: 0, c: 0, island: 160 },
  // остров самый длинный и самый короткий (LIMITS.island 120–280)
  { shape: 'island', a: 330, b: 0, c: 0, island: 280 },
  { shape: 'island', a: 330, b: 0, c: 0, island: 120 },
]
const CEILINGS = [240, 250, 270, 290, 300, 320]
const COLUMNS: Partial<PlanInput>[] = [{}, { tallOven: true }, { ovenApart: true }, { pantries: 2 }]

/** Перебор: все формы × потолки × «до потолка»/«низкие» × пеналы/колонна/отдельная духовка. */
function* matrix(): Generator<Case> {
  let k = 0
  for (const s of SHAPES)
    for (const ceiling of CEILINGS)
      for (const toCeiling of [true, false])
        for (const col of COLUMNS) {
          k++
          const style = STYLES[k % STYLES.length]
          const gas = k % 3 === 0
          const hoodKind = (['chimney', 'inclined', 'telescopic'] as const)[k % 3]
          const items = { fridge, dishwasher: dw(k % 2 ? 45 : 60), hob: hob(gas ? 'gas' : 'electric'), oven, hood: hood(hoodKind) }
          // длина A гуляет — так появляются узкие доборы (C06)
          const a = s.a + ((k * 37) % 90) - 45
          const input: PlanInput = { ...s, a, ...col, fridge, dishwasher: items.dishwasher, hob: items.hob, oven, hood: { w: 60 } }
          yield { name: `${s.shape}-${a} ${ceiling}${toCeiling ? ' до потолка' : ''} ${JSON.stringify(col)} ${style.id}`, input, style, ceiling, toCeiling, items }
        }
}

const CASES = [...matrix()]
const SPECS: { c: Case; spec: SpecData; built: Built; plan: Plan }[] = CASES.map((c) => {
  const built = build(c)
  return { c, spec: built.spec, built, plan: planKitchen(c.input, { shelves: c.style.shelves }) }
})

const cornerDefault = (): Omit<Case, 'name'> => ({
  input: { shape: 'corner', a: 300, b: 240, c: 0, island: 0, fridge, dishwasher: dw(45), hob: hob(), oven, hood: { w: 60 } },
  style: STYLES[0],
  ceiling: 270,
  toCeiling: false,
  items: { fridge, dishwasher: dw(45), hob: hob(), oven, hood: hood() },
})

/* ───────────── D01: посудомойка без корпуса ───────────── */

describe('D01: встраиваемая посудомойка — проём, а не корпус', () => {
  it('в раскрое нет корпуса без дна и спинки; в списке — «Проём под посудомойку 450 × 820–870»', () => {
    const { spec } = build(cornerDefault())
    expect(spec.carcasses.filter((c) => c.row === 'base' && !c.bottom && !c.back)).toEqual([])
    expect(extraList(spec)).toContainEqual({ kind: 'dwOpening', w: 450, h: 820, hMax: 870, count: 1 })
  })

  it('на переборе: ни одного корпуса посудомойки, проём 450 или 600 у каждой кухни с ПММ', () => {
    for (const { c, spec, plan } of SPECS) {
      expect(spec.carcasses.filter((x) => !x.bottom && !x.back), c.name).toEqual([])
      const placed = plan.runs.flatMap((r) => r.modules).filter((m) => m.kind === 'dishwasher')
      const open = extraList(spec).filter((r) => r.kind === 'dwOpening')
      expect(open.reduce((s, r) => s + r.count, 0), c.name).toBe(placed.length)
      for (const r of open) expect([450, 600], c.name).toContain(r.w)
    }
  })
})

/* ───────────── C06/D02: над узкой планкой — добор, а не корпус ───────────── */

describe('C06/D02: узкий верх — панель-добор без корпуса', () => {
  it('на переборе: в раскрое нет деталей уже 50 мм, подъёмных фасадов уже 150 мм', () => {
    for (const { c, spec } of SPECS) {
      const thin = cutList(spec.carcasses, spec.panels).filter((r) => r.b < 50)
      expect(thin, c.name).toEqual([])
      const lifts = frontList(spec.runs).filter((f) => (f.type === 'lift' || f.type === 'glass') && f.w < 150)
      expect(lifts, c.name).toEqual([])
    }
  })

  it('прямая 185: над планкой 1 см — добор в «Проёмах и доборах», шкафа над ней нет', () => {
    const c = { ...cornerDefault(), input: { shape: 'straight' as const, a: 185, b: 0, c: 0, island: 0, fridge, dishwasher: dw(45), hob: hob(), oven, hood: { w: 60 } } }
    const plan = planKitchen(c.input, { shelves: false })
    const up = plan.runs[0].uppers.filter((u) => u.kind === 'filler')
    expect(up.length).toBeGreaterThan(0)
    const { spec } = build(c)
    expect(spec.carcasses.filter((x) => x.row === 'upper' && x.w < 20)).toEqual([])
    expect(extraList(spec).filter((r) => r.kind === 'filler').reduce((s, r) => s + r.count, 0)).toBe(up.length)
    // добор — не шкаф: в верхнем ряду его нет, он в списке доборов
    const m = modulesOf(spec.runs[0])
    expect(m.upper.every((b) => b.w >= 20)).toBe(true)
    expect(m.fillers.some((b) => b.y >= 100)).toBe(true)
  })
})

/* ───────────── C05: верхний угловой ───────────── */

describe('C05: верхний угловой — глухая часть со стороны угла, дверца на открытой', () => {
  it('угловая по умолчанию: над угловым нет фасада в полосе 0–35 см, есть планка', () => {
    const { spec } = build(cornerDefault())
    const A = spec.runs.find((r) => r.id === 'A')!
    const plan = planKitchen(cornerDefault().input, { shelves: false })
    const up = plan.runs[0].uppers.find((u) => u.kind === 'corner')!
    expect(up.blindAt).toBe('start')
    // фасады верхнего ряда, начинающиеся в глухой части — только сама планка
    const inBlind = A.fronts.filter((f) => f.y >= 100 && f.x < 35 - 0.5 && f.hinge !== 'none')
    expect(inBlind).toEqual([])
    expect(extraList(spec).filter((r) => r.kind === 'strip').reduce((s, r) => s + r.count, 0)).toBe(2)
  })
})

/* ───────────── C07/C08: фасады и детали, которые можно изготовить ───────────── */

describe('C07: подъёмный фасад ≤ 900 мм, одностворчатая дверца ≤ 620 мм', () => {
  it('на переборе потолков 240–320', () => {
    for (const { c, spec } of SPECS) {
      const fronts = spec.runs.flatMap((r) => r.fronts)
      expect(fronts.filter((f) => f.hinge === 'top' && f.h > 90 + 0.05).map((f) => `${f.w}×${f.h}`), c.name).toEqual([])
      expect(fronts.filter((f) => (f.hinge === 'left' || f.hinge === 'right') && f.w > 62 + 0.05).map((f) => `${f.w}×${f.h}`), c.name).toEqual([])
    }
  })

  it('пенал 90 см — две створки, а не одна дверца 897 мм', () => {
    const c = { ...cornerDefault(), input: { shape: 'u' as const, a: 400, b: 260, c: 260, island: 0, fridge, hob: hob(), oven, pantries: 1, widths: { pantry: 90 } } }
    const plan = planKitchen(c.input, { shelves: false })
    expect(plan.runs.flatMap((r) => r.modules).find((m) => m.kind === 'pantry')?.w).toBe(90)
    const { spec } = build(c)
    const wide = spec.runs.flatMap((r) => r.fronts).filter((f) => f.w > 62 + 0.05 && f.hinge !== 'drawer' && f.hinge !== 'none')
    expect(wide.map((f) => `${f.hinge} ${f.w}×${f.h}`)).toEqual([])
  })
})

describe('C08: нет детали длиннее 2750 мм — высокие корпуса делятся на корпус и антресоль', () => {
  it('на переборе потолков 240–320', () => {
    for (const { c, spec } of SPECS) {
      const long = cutList(spec.carcasses, spec.panels).filter((r) => r.a > 2750)
      expect(long.map((r) => `${r.name} ${r.a}×${r.b}`), c.name).toEqual([])
      const tallFront = spec.runs.flatMap((r) => r.fronts).filter((f) => Math.max(f.w, f.h) > 275)
      expect(tallFront, c.name).toEqual([])
      // проёмы, доборы, планки, задняя панель острова — тоже детали
      const longExtra = extraList(spec).filter((r) => Math.max(r.w, r.h) > 2750)
      expect(longExtra, c.name).toEqual([])
    }
  })
})

/* ───────────── D16: высота вытяжки над панелью ───────────── */

describe('D16: низ вытяжки ≥ 65 см над электрической, ≥ 75 см над газовой', () => {
  it('на переборе (наклонная, каминная, телескопическая, «камин», остров): hoodOver = норма раскладки', () => {
    let seen = 0
    for (const { c, built, plan } of SPECS) {
      if (!plan.hoodHeight) {
        expect(built.hoodOver, c.name).toBeUndefined()
        continue
      }
      seen++
      const min = c.items.hob?.hob === 'gas' ? 75 : 65
      expect(built.hoodOver, c.name).toBe(min)
    }
    expect(seen).toBeGreaterThan(50)
  })

  it('«камин» классики над газовой панелью — 75 см', () => {
    const style = getStyle('classic')
    expect(style.mantel).toBe(true)
    const base = cornerDefault()
    const built = build({ ...base, style, input: { ...base.input, hob: hob('gas') }, items: { ...base.items, hob: hob('gas') } })
    expect(built.hoodOver).toBe(75)
  })
})

/* ───────────── D17/D25: все детали в спецификации, доборы — не шкафы ───────────── */

describe('D17/D25: планки угловых, задняя панель острова; «Шкафов» без доборов', () => {
  it('П-образная: 4 планки угловых шкафов (2 низ + 2 верх)', () => {
    const base = cornerDefault()
    const { spec } = build({ ...base, input: { ...base.input, shape: 'u', a: 360, b: 240, c: 240 } })
    expect(extraList(spec).filter((r) => r.kind === 'strip').reduce((s, r) => s + r.count, 0)).toBe(4)
  })

  it('остров: задняя панель во всю длину острова, высотой до столешницы', () => {
    const base = cornerDefault()
    const { spec } = build({ ...base, input: { ...base.input, shape: 'island', a: 330, b: 0, c: 0, island: 160 } })
    const I = spec.runs.find((r) => r.id === 'I')!
    expect(extraList(spec).filter((r) => r.kind === 'islandBack')).toEqual([{ kind: 'islandBack', w: I.length * 10, h: 820, count: 1 }])
  })

  it('доборы нижнего ряда не входят в шкафы — у них свой список', () => {
    const { spec } = build(cornerDefault())
    const all = spec.runs.map((r) => modulesOf(r))
    expect(all.flatMap((m) => m.lower).filter((b) => b.kind === 'filler')).toEqual([])
    expect(all.flatMap((m) => m.fillers).length).toBeGreaterThan(0)
  })
})

/* ───────────── D05/D10/D13: рамки берут координаты у самой детали ───────────── */

describe('D05/D10/D13: рамки для чертежа — по детали, а не по габариту 3D-группы', () => {
  const neo = getStyle('neoclassic')

  it('бутылочница со стержневой ручкой (неоклассика): рамка совпадает с модулем', () => {
    let seen = 0
    for (let a = 240; a <= 340 && seen < 4; a++) {
      const base = cornerDefault()
      const c = { ...base, style: neo, input: { ...base.input, a } }
      const A = planKitchen(c.input, { shelves: neo.shelves }).runs.find((r) => r.id === 'A')!
      const bottles = A.modules.filter((m) => m.kind === 'bottle')
      if (bottles.length === 0) continue
      const boxes = build(c).spec.runs.find((r) => r.id === 'A')!.boxes.filter((b) => b.kind === 'bottle')
      expect(boxes.map((b) => [b.x, b.y, b.w]), `a=${a}`).toEqual(bottles.map((m) => [m.x, 0, m.w]))
      seen++
    }
    expect(seen).toBeGreaterThan(0)
  })

  it('встраиваемая посудомойка на переборе: рамка от пола и не выше корпуса 82 см', () => {
    for (const { c, spec, plan } of SPECS)
      for (const run of plan.runs) {
        const n = run.modules.filter((m) => m.kind === 'dishwasher').length
        const boxes = spec.runs.find((r) => r.id === run.id)!.boxes.filter((b) => b.slot === 'dishwasher')
        expect(boxes.length, c.name).toBe(n)
        for (const b of boxes) expect([b.y, b.y + b.h <= 82], c.name).toEqual([0, true])
      }
  })

  it('открытые полки (лофт): у каждой полки своя рамка — на 156 и 194 см', () => {
    const loft = getStyle('loft')
    let seen = 0
    for (const s of SHAPES) {
      const base = cornerDefault()
      const c = { ...base, style: loft, input: { ...base.input, ...s } }
      const plan = planKitchen(c.input, { shelves: loft.shelves })
      const { spec } = build(c)
      for (const run of plan.runs)
        for (const u of run.uppers.filter((x) => x.kind === 'shelf')) {
          const ys = spec.runs.find((r) => r.id === run.id)!.boxes.filter((b) => b.kind === 'shelf' && b.x === u.x + 1).map((b) => b.y)
          expect(ys.sort((p, q) => p - q), `${s.shape} ${run.id} ${u.x}`).toEqual([156, 194])
          seen++
        }
    }
    expect(seen).toBeGreaterThan(0)
  })
})

/* ───────────── числа 3D и спецификации совпадают ───────────── */

/** Что в 3D на самом деле: габарит детали без ручек, в см ряда (вдоль ряда и от пола). */
function body(o: THREE.Object3D, inv: THREE.Matrix4) {
  const box = new THREE.Box3()
  o.traverse((x) => {
    const mesh = x as THREE.Mesh
    if (!mesh.isMesh) return
    for (let p: THREE.Object3D | null = x; p && p !== o; p = p.parent) if (p.userData.handle) return
    mesh.geometry.computeBoundingBox()
    box.union(mesh.geometry.boundingBox!.clone().applyMatrix4(mesh.matrixWorld).applyMatrix4(inv))
  })
  const r = (v: number) => Math.round(v * 1000) / 10
  return { x0: r(box.min.x), x1: r(box.max.x), y0: r(Math.max(0, box.min.y)), y1: r(box.max.y) }
}

describe('числа 3D и спецификации совпадают', () => {
  // мебель и техника, у которых рамка — это сама деталь (у ПММ, мойки и спрятанной вытяжки рамка — проём/техника, не 3D-оболочка)
  const SAME = new Set(['base', 'drawers', 'sinkBase', 'hobBase', 'ovenBase', 'corner', 'bottle', 'openBase', 'tall', 'pantry', 'upper', 'vitrine', 'lift', 'antresol', 'overFridge', 'filler', 'top'])
  const APPS = new Set(['fridge', 'oven', 'microwave'])
  const kitchens = () => {
    const base = cornerDefault()
    return [
      { name: 'угловая по умолчанию', c: base },
      { name: 'П-образная, неоклассика', c: { ...base, style: getStyle('neoclassic'), input: { ...base.input, shape: 'u' as const, a: 360, b: 240, c: 240 } } },
    ]
  }

  for (const { name, c } of kitchens())
    it(`${name}: рамка каждой детали — там же и того же размера, что деталь в 3D (±1 см)`, () => {
      const plan = planKitchen(c.input, { shelves: c.style.shelves })
      const built = build(c)
      built.root.updateMatrixWorld(true)
      let checked = 0
      for (const run of plan.runs) {
        const g = built.root.children.find((o) => Math.abs(o.position.x * 100 - run.ox) < 0.01 && Math.abs(o.position.z * 100 - run.oz) < 0.01 && Math.abs(o.rotation.y - run.rot) < 1e-6)!
        const inv = g.matrixWorld.clone().invert()
        const objs: THREE.Object3D[] = []
        g.traverse((o) => {
          if (o !== g && o.userData.dims && !o.userData.ghost) objs.push(o)
        })
        const boxes = built.spec.runs.find((r) => r.id === run.id)!.boxes
        expect(boxes.length, run.id).toBe(objs.length)
        boxes.forEach((b, k) => {
          if (!SAME.has(b.kind) && !(b.kind === 'appliance' && APPS.has(b.slot ?? ''))) return
          const real = body(objs[k], inv)
          const frame = { x0: b.x, x1: b.x + b.w, y0: b.y, y1: b.y + b.h }
          for (const key of ['x0', 'x1', 'y0', 'y1'] as const) expect(Math.abs(real[key] - frame[key]), `${run.id} ${b.kind} ${b.slot ?? ''} x=${b.x} ${key}: 3D ${real[key]}, рамка ${frame[key]}`).toBeLessThanOrEqual(1)
          checked++
        })
      }
      expect(checked).toBeGreaterThan(10)
    })
})

/* ───────────── 08: размеры кухни из одного места ───────────── */

describe('08: высоты из dims.ts — одни для проверки, 3D и спецификации', () => {
  it('низ столешницы = цоколь 10 + корпус 72 = 82: проверка «выше столешницы», высоты 3D и проём ПММ', () => {
    // спецификация §5: стиральная/ПММ — «высота техники > низа столешницы»; цоколь 10 + корпус 72
    expect(PLINTH + BODY).toBe(82)
    expect(BASE_H).toBe(82)
    expect(UNDER_COUNTER).toBe(82)
    let openings = 0
    for (const { c, spec } of SPECS) {
      expect(spec.heights.plinth, c.name).toBe(10)
      // верх столешницы из 3D минус её толщина — низ столешницы
      expect(spec.heights.counter - c.style.topCm, c.name).toBeCloseTo(82, 5)
      for (const e of (spec.extras ?? []).filter((x) => x.kind === 'dwOpening')) {
        openings++
        expect([e.h, e.hMax], c.name).toEqual([82, 87])
      }
    }
    expect(openings).toBeGreaterThan(0)
  })
})

describe('08/D16: hoodOver меряется по поставленной вытяжке', () => {
  it('на переборе: hoodOver = низ меша вытяжки над столешницей (±0,5 см)', () => {
    let seen = 0
    const v = new THREE.Vector3()
    for (const { c, built } of SPECS) {
      const hood = built.objects.hood
      if (!hood) {
        expect(built.hoodOver, c.name).toBeUndefined()
        continue
      }
      built.root.updateMatrixWorld(true)
      let low = Infinity
      hood.traverse((o) => {
        const m = o as THREE.Mesh
        if (!m.isMesh) return
        const pos = m.geometry.getAttribute('position')
        for (let i = 0; i < pos.count; i++) low = Math.min(low, v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld).y)
      })
      const counterTop = 82 + c.style.topCm
      expect(built.hoodOver, c.name).toBeCloseTo(low * 100 - counterTop, 0)
      seen++
    }
    expect(seen).toBeGreaterThan(50)
  })
})

/* ───────────── 2026-09-27: встроенная вытяжка поднимает весь ряд ───────────── */

describe('2026-09-27: встроенная вытяжка поднимает весь верхний ряд', () => {
  /** угловая по умолчанию с вытяжкой `kind` над панелью `hobKind` */
  const withHood = (kind: HoodKind, hobKind: HobKind = 'electric', style = STYLES[0]) => {
    const base = cornerDefault()
    return build({ ...base, style, input: { ...base.input, hob: hob(hobKind) }, items: { ...base.items, hob: hob(hobKind), hood: hood(kind) } })
  }
  /** низ каждого шкафа и добора верхнего ряда на всех стенах, см (антресоли и шкаф над холодильником — не ряд) */
  const ROW = new Set(['upper', 'vitrine', 'lift'])
  const rowBottoms = (spec: SpecData) =>
    spec.runs.flatMap((r) => {
      const m = modulesOf(r)
      return [...m.upper.filter((b) => ROW.has(b.kind)), ...m.fillers.filter((b) => b.y > 100)].map((b) => ({ run: r.id, kind: b.kind, x: b.x, y: b.y }))
    })

  for (const [kind, hobKind, norm] of [
    ['telescopic', 'electric', 65],
    ['insert', 'electric', 65],
    ['telescopic', 'gas', 75],
    ['insert', 'gas', 75],
  ] as const)
    it(`${kind} над ${hobKind === 'gas' ? 'газовой' : 'электрической'}: все верхние шкафы на обеих стенах на одной высоте, низ вытяжки — ${norm} см`, () => {
      const built = withHood(kind, hobKind)
      const counter = 82 + STYLES[0].topCm
      const bottoms = rowBottoms(built.spec)
      expect(new Set(bottoms.map((b) => b.run))).toEqual(new Set(['A', 'B']))
      const ub = built.spec.heights.upperBottom
      // разница 0 мм: низ шкафа с вытяжкой = низ соседей
      for (const b of bottoms) expect(b.y, `${b.run} ${b.kind} x=${b.x}`).toBeCloseTo(ub, 1)
      // ряд поднят — 58 см над столешницей не хватает до нормы вытяжки
      expect(ub).toBeGreaterThanOrEqual(counter + norm)
      expect(built.hoodOver).toBe(norm)
      const strip = built.spec.runs.flatMap((r) => r.boxes).find((b) => b.slot === 'hood')!
      expect(strip.y - counter).toBeCloseTo(norm, 1)
    })

  it('каминная, наклонная, без вытяжки, «камин» классики и вытяжка над островом — ряд прежний: 142 см на всех стенах', () => {
    const base = cornerDefault()
    // варочная панель на острове — вытяжка висит над ней, не в ряду у стены
    const island = {
      ...base,
      input: { ...base.input, shape: 'island' as const, a: 330, b: 0, island: 160, arrangement: { A: ['fridge', 'sink', 'dishwasher', 'oven'], I: ['hob'] } } satisfies PlanInput,
      items: { ...base.items, hood: hood('telescopic') },
    }
    const kitchens: [string, Built][] = [
      ['каминная', withHood('chimney')],
      ['наклонная над газовой', withHood('inclined', 'gas')],
      ['без вытяжки', build({ ...base, input: { ...base.input, hood: null }, items: { ...base.items, hood: null } })],
      ['«камин» классики, телескопическая', withHood('telescopic', 'electric', getStyle('classic'))],
      ['остров, телескопическая', build(island)],
    ]
    const onIsland = planKitchen(island.input, { shelves: island.style.shelves })
    expect(onIsland.runs.find((r) => !r.wall)?.modules.some((m) => m.kind === 'hob')).toBe(true)
    expect(onIsland.hoodHeight).toBeDefined()
    for (const [name, built] of kitchens) {
      expect(built.spec.heights.upperBottom, name).toBe(142)
      for (const b of rowBottoms(built.spec)) expect(b.y, `${name}: ${b.run} ${b.kind} x=${b.x}`).toBeCloseTo(142, 1)
    }
  })
})

/* ───────────── R10: свой цвет острова ───────────── */

describe('R10: остров своего цвета — фасады и задняя панель', () => {
  const graphite = new THREE.Color(frontColor('lam-graphite')!.color).getHex()
  const islandKitchen = () => {
    const base = cornerDefault()
    return { ...base, input: { ...base.input, shape: 'island' as const, a: 330, b: 0, c: 0, island: 160 } }
  }
  const withFinish = (island?: string): Built => {
    const c = islandKitchen()
    const plan = planKitchen(c.input, { shelves: c.style.shelves })
    return buildKitchen({
      plan,
      style: c.style,
      tone: getTone(c.style, 0),
      items: c.items,
      photos: new Map(),
      evening: false,
      room: { ceiling: c.ceiling, toCeiling: c.toCeiling },
      fronts: {},
      detail: 0.5,
      finish: { facade: frontColor('lam-white'), ...(island ? { island: frontColor(island) } : {}) },
    })
  }
  const colors = (o: THREE.Object3D) => {
    const out: number[] = []
    o.traverse((m) => {
      const mat = (m as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined
      if ((m as THREE.Mesh).isMesh && mat?.color) out.push(mat.color.getHex())
    })
    return out
  }

  it('фасады острова помечены island, у стены — нет; задняя панель острова — тоже island', () => {
    const { spec } = withFinish('lam-graphite')
    const I = spec.runs.find((r) => r.id === 'I')!
    expect(I.fronts.length).toBeGreaterThan(0)
    expect(I.fronts.every((f) => f.island === true)).toBe(true)
    expect(spec.runs.filter((r) => r.id !== 'I').flatMap((r) => r.fronts).some((f) => f.island)).toBe(false)
    const backs = (spec.extras ?? []).filter((e) => e.kind === 'islandBack')
    expect(backs.length).toBeGreaterThan(0)
    expect(backs.every((e) => e.island === true)).toBe(true)
  })

  it('в 3D фасады острова и задняя панель — цвет острова; фасады у стены — нет', () => {
    const { root } = withFinish('lam-graphite')
    root.updateMatrixWorld(true)
    const fronts: THREE.Object3D[] = []
    root.traverse((o) => {
      if (o.userData.front) fronts.push(o)
    })
    const island = fronts.filter((o) => o.userData.front.island)
    expect(island.length).toBeGreaterThan(0)
    for (const o of island) expect(colors(o)).toContain(graphite)
    for (const o of fronts.filter((f) => !f.userData.front.island)) expect(colors(o)).not.toContain(graphite)
    // задняя панель: деталь не-фасад в цвете острова во всю длину острова (160 см), толщиной 2 см
    const inFront = new Set<THREE.Object3D>()
    for (const o of fronts) o.traverse((m) => inFront.add(m))
    const panels: THREE.Vector3[] = []
    root.traverse((m) => {
      const mat = (m as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined
      if ((m as THREE.Mesh).isMesh && !inFront.has(m) && mat?.color?.getHex() === graphite) panels.push(new THREE.Box3().setFromObject(m).getSize(new THREE.Vector3()))
    })
    expect(panels.some((s) => Math.abs(Math.max(s.x, s.z) - 1.6) < 0.01 && Math.abs(Math.min(s.x, s.z) - 0.02) < 0.005)).toBe(true)
  })

  it('цвет острова тот же, что у низа, — тот же материал, без пометок island', () => {
    const { spec, root } = withFinish('lam-white')
    expect(spec.runs.flatMap((r) => r.fronts).some((f) => f.island)).toBe(false)
    expect((spec.extras ?? []).some((e) => e.island)).toBe(false)
    const mats = new Set<THREE.Material>()
    root.traverse((o) => {
      if (o.userData.front) o.traverse((m) => (m as THREE.Mesh).isMesh && mats.add((m as THREE.Mesh).material as THREE.Material))
    })
    const plain = new Set<THREE.Material>()
    withFinish().root.traverse((o) => {
      if (o.userData.front) o.traverse((m) => (m as THREE.Mesh).isMesh && plain.add((m as THREE.Mesh).material as THREE.Material))
    })
    // сколько разных материалов у фасадов — столько же, сколько без цвета острова
    expect(mats.size).toBe(plain.size)
  })

  it('без islandFacade — как раньше: ни одной пометки island и ни одного графита', () => {
    const { spec, root } = withFinish()
    expect(spec.runs.flatMap((r) => r.fronts).some((f) => f.island)).toBe(false)
    expect((spec.extras ?? []).some((e) => e.island)).toBe(false)
    expect(colors(root)).not.toContain(graphite)
  })
})

describe('G01: корпус в 3D — материал корпуса, как в раскрое', () => {
  const hex = (id: string) => new THREE.Color(frontColor(id)!.color).getHex()
  const [graphite, white] = [hex('lam-graphite'), hex('lam-white')]
  const colorOf = (m: THREE.Object3D) => ((m as THREE.Mesh).material as THREE.MeshStandardMaterial).color?.getHex()

  it('цветные фасады: боковины, дно и полки корпусов (низ, верх, остров) — белый ЛДСП корпуса, фасады — цвет фасада', () => {
    const base = cornerDefault()
    const c = { ...base, input: { ...base.input, shape: 'island' as const, a: 330, b: 0, c: 0, island: 160 } }
    const plan = planKitchen(c.input, { shelves: c.style.shelves })
    const { root } = buildKitchen({
      plan,
      style: c.style,
      tone: getTone(c.style, 0),
      items: c.items,
      photos: new Map(),
      evening: false,
      room: { ceiling: c.ceiling, toCeiling: c.toCeiling },
      fronts: {},
      detail: 0.5,
      finish: { facade: frontColor('lam-graphite') },
    })
    root.updateMatrixWorld(true)
    // короб шкафа — прямые детали модуля во всю его ширину и выше 30 см (не фасад, не техника)
    const box: THREE.Object3D[] = []
    const fronts: THREE.Object3D[] = []
    root.traverse((o) => {
      if (o.userData.front) fronts.push(o)
      const d = o.userData.dims
      if (!d || d.kind === 'filler' || d.kind === 'mantel') return
      for (const m of o.children) {
        if (!(m as THREE.Mesh).isMesh || m.userData.front) continue
        const s = new THREE.Box3().setFromObject(m).getSize(new THREE.Vector3())
        if (Math.abs(Math.max(s.x, s.z) - d.w / 100) < 0.01 && s.y > 0.3) box.push(m)
      }
    })
    expect(box.filter((m) => colorOf(m) === white).length).toBeGreaterThan(5)
    expect(box.filter((m) => colorOf(m) === graphite)).toEqual([])
    // фасады — цвет фасада
    expect(fronts.length).toBeGreaterThan(0)
    const frontColors = new Set<number | undefined>()
    for (const f of fronts) f.traverse((m) => (m as THREE.Mesh).isMesh && frontColors.add(colorOf(m)))
    expect(frontColors.has(graphite)).toBe(true)
  })
})
