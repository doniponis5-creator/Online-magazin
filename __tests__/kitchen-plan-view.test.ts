import { describe, expect, it } from 'vitest'
import { addPicked, chainOf, hitRun, planCells, resetForShape } from '@/components/kitchen/planGeom'
import { DEPTH, itemPositions, minA, moduleCenter, planKitchen, runCm, runX, type Plan, type PlanInput, type Planner, type Run } from '@/lib/kitchen/layout'
import { planInputOf } from '@/lib/kitchen/order'
import { DEFAULT_STATE } from '@/lib/kitchen/share'
import type { KitchenAppliance, KitchenState } from '@/lib/kitchen/types'

/**
 * Таск 04 — план сверху (спецификация §4, R16i): геометрия плана без React —
 * та же система координат, что у чертежа (`PlanSketch`/`planSvg`), палец →
 * «стена + см», цепочки размеров; и сброс полей при смене формы (ревью 03).
 */

const hob = (): KitchenAppliance => ({ id: 'hb', slot: 'hob', name: 'hob', brand: '', price: 1, w: 60, h: 5, d: 52, sizeKnown: true, builtIn: true, finish: 'black' })
const opts = { shelves: false }
const straight = (over: Partial<PlanInput> = {}): PlanInput => ({ shape: 'straight', a: 300, b: 0, c: 0, island: 0, hob: hob(), ...over })

/** Точка ряда в мире — формула чертежа (`PlanSketch.tsx`), не из модуля под тестом. */
const world = (run: Run, x: number, z: number) => ({ x: run.ox + x * Math.cos(run.rot) + z * Math.sin(run.rot), z: run.oz - x * Math.sin(run.rot) + z * Math.cos(run.rot) })

describe('resetForShape — смена формы сбрасывает всё своё', () => {
  it('gaps, manualUppers и upperCabs уходят вместе с arrangement/cabinets/at (сирот не остаётся)', () => {
    const s: KitchenState = {
      ...DEFAULT_STATE,
      shape: 'corner',
      a: 300,
      arrangement: { A: ['sink', 'g1', 'k1'] },
      cabinets: { k1: { w: 60, front: 'doors' } },
      gaps: { g1: { w: 40 } },
      at: { sink: 30, g1: 80, k1: 130 },
      manualUppers: { A: ['u1'] },
      upperCabs: { u1: { w: 60, kind: 'doors' } },
    }
    const patch = resetForShape(s, 'straight')
    expect(patch.shape).toBe('straight')
    expect(patch.a).toBe(Math.max(300, minA('straight')))
    for (const k of ['arrangement', 'cabinets', 'at', 'gaps', 'manualUppers', 'upperCabs'] as const) {
      expect(k in patch, k).toBe(true)
      expect(patch[k], k).toBeUndefined()
    }
  })
})

describe('hitRun — палец на плане → стена и см от угла', () => {
  const plan = planKitchen({ ...straight({ shape: 'corner', a: 300, b: 240 }) }, opts)
  it('середина каждого модуля попадает в свой ряд с той же координатой (формула чертежа)', () => {
    for (const run of plan.runs) {
      for (const m of run.modules) {
        const p = world(run, m.x + m.w / 2, DEPTH / 2)
        const hit = hitRun(plan, p.x, p.z)
        expect(hit?.wall, `${run.id} ${m.kind}`).toBe(run.id)
        // см — от угла, как в модели (moduleCenter): на стене B это length − x, не x
        expect(Math.abs(hit!.cm - moduleCenter(run, m)), `${run.id} ${m.kind}`).toBeLessThan(0.01)
      }
    }
  })
  it('стена B: см считаются от угла одной формулой с раскладкой — runCm/runX обратны друг другу и равны moduleCenter', () => {
    const B = plan.runs.find((r) => r.id === 'B')!
    expect(runCm(B, 50)).toBe(B.length - 50)
    expect(runCm(plan.runs.find((r) => r.id === 'A')!, 50)).toBe(50)
    expect(runX(B, runCm(B, 37.5))).toBe(37.5)
    for (const m of B.modules) expect(runCm(B, m.x + m.w / 2)).toBe(moduleCenter(B, m))
    const p = world(B, 50, DEPTH / 2)
    expect(hitRun(plan, p.x, p.z)).toEqual({ wall: 'B', cm: B.length - 50 })
  })
  it('стена A: точка (150, 30) → A 150; далеко от кухни — цели нет; чуть дальше полосы — ближайшая стена', () => {
    expect(hitRun(plan, 150, 30)).toEqual({ wall: 'A', cm: 150 })
    expect(hitRun(plan, 600, 600)).toBeNull()
    expect(hitRun(plan, 150, DEPTH + 25)?.wall).toBe('A')
  })
})

describe('chainOf — цепочка размеров ряда', () => {
  it('прямая 300: мойка 0–60, плита 190–250 — в цепочке есть их края, сумма отрезков = длина', () => {
    const plan = planKitchen(straight({ arrangement: { A: ['sink', 'hob'] }, at: { sink: 30, hob: 220 } }), opts)
    const run = plan.runs.find((r) => r.id === 'A')!
    const cuts = chainOf(run)
    expect(cuts[0]).toBe(0)
    expect(cuts[cuts.length - 1]).toBe(300)
    for (const c of [60, 190, 250]) expect(cuts).toContain(c)
    expect(cuts.slice(1).reduce((s, c, i) => s + (c - cuts[i]), 0)).toBe(300)
    expect([...cuts].sort((a, b) => a - b)).toEqual(cuts)
  })
})

describe('planCells — что рисует и что можно взять', () => {
  it('пустое место — своя ячейка с «+», предметы и свои шкафы — по ключу модели, автошкафы — по ряду и началу', () => {
    const s: KitchenState = {
      ...DEFAULT_STATE,
      shape: 'straight',
      a: 400,
      arrangement: { A: ['sink', 'g1', 'k1', 'hob'] },
      cabinets: { k1: { w: 60, front: 'doors' } },
      gaps: { g1: { w: 40 } },
      at: { sink: 30, g1: 80, k1: 130, hob: 220 },
    }
    const plan: Plan = planKitchen(planInputOf(s, { hob: hob() }, []), opts)
    const cells = planCells(plan)
    const gap = cells.find((c) => c.key === 'g1')
    expect(gap).toMatchObject({ wall: 'A', row: 'gap', x: 60, w: 40, pick: true })
    expect(cells.find((c) => c.key === 'k1')).toMatchObject({ row: 'base', x: 100, w: 60, pick: true })
    expect(cells.find((c) => c.key === 'sink')).toMatchObject({ row: 'base', pick: true })
    // автошкаф 250–340 — ключ сцены A250
    expect(cells.some((c) => c.key === 'A250' && c.row === 'base')).toBe(true)
    // верх — контуром, ключ сцены строчной буквой
    expect(cells.some((c) => c.row === 'upper' && /^a\d+$/.test(c.key))).toBe(true)
  })
})

describe('addPicked — техника из меню «+» встаёт в запомненное место', () => {
  it('выбрали посудомойку в шаге «Техника» → она в пустом месте g1, пустого места нет', () => {
    const dw: KitchenAppliance = { id: 'dw', slot: 'dishwasher', name: 'dw', brand: '', price: 1, w: 60, h: 82, d: 55, sizeKnown: true, builtIn: true, finish: 'white' }
    const s: KitchenState = {
      ...DEFAULT_STATE,
      shape: 'straight',
      a: 400,
      picks: { dishwasher: 'dw' },
      arrangement: { A: ['sink', 'g1', 'hob'] },
      gaps: { g1: { w: 60 } },
      at: { sink: 30, g1: 90, hob: 220 },
    }
    const planner: Planner = (st, snap) => planKitchen(planInputOf(st, { hob: hob(), dishwasher: dw }, snap), opts)
    const { state: next, placed } = addPicked(s, { wall: 'A', cm: 90, gap: 'g1' }, 'dishwasher', planner)
    expect(placed).toBe(true)
    const pos = itemPositions(planner(next, []))
    expect(pos.dishwasher).toEqual({ wall: 'A', center: 90, w: 60 })
    // прежнего пустого места на 90 нет (там посудомойка); её старое авто-место стало пустым — это правило placeAt
    expect(pos.g1?.center).not.toBe(90)
    // вытяжке и микроволновке места в ряду нет — состояние не меняется
    expect(addPicked(s, { wall: 'A', cm: 90, gap: 'g1' }, 'hood', planner)).toEqual({ state: s, placed: false })
  })

  it('в запомненное место не влезает → placed=false и прежнее состояние: экран говорит «не помещается», а не молчит (ревью 32)', () => {
    const dw: KitchenAppliance = { id: 'dw', slot: 'dishwasher', name: 'dw', brand: '', price: 1, w: 60, h: 82, d: 55, sizeKnown: true, builtIn: true, finish: 'white' }
    // стена 130: мойка 60 + плита 60 — на посудомойку 60 места нет
    const tight: KitchenState = { ...DEFAULT_STATE, shape: 'straight', a: 130, picks: { dishwasher: 'dw' }, arrangement: { A: ['sink', 'hob'] } }
    const planner: Planner = (st, snap) => planKitchen(planInputOf(st, { hob: hob(), dishwasher: dw }, snap), opts)
    const r = addPicked(tight, { wall: 'A', cm: 65, gap: null }, 'dishwasher', planner)
    expect(r.placed).toBe(false)
    expect(r.state).toBe(tight)
  })
})
