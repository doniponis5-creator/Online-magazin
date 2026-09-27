import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { buildKitchen, type Built } from '@/components/kitchen/three/build'
import { planKitchen, type Module, type PlanInput } from '@/lib/kitchen/layout'
import { elevationSvg, type DrawingLabels } from '@/components/kitchen/drawing'
import { kitchenTexts } from '@/components/kitchen/texts'
import { extraList, topList } from '@/lib/kitchen/spec'
import { getTone, STYLES } from '@/lib/kitchen/styles'
import type { KitchenAppliance } from '@/lib/kitchen/types'

/**
 * Отдельностоящая плита в 3D и у мебельщика
 * (`.autopilot/2026-09-27-kitchen-stove/spec.md`, пункты 6–8).
 */

/* заглушка холста для текстур — как в kitchen-build.test.ts */
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

const base = { brand: '', sizeKnown: true, finish: 'black' as const }
const STOVE: KitchenAppliance = {
  ...base,
  id: 'st1',
  slot: 'hob',
  name: 'Плита SHIVAKI 6401E',
  price: 24_300,
  w: 60,
  h: 85,
  d: 60,
  builtIn: false,
  hob: 'electric',
  burners: 4,
  stove: true,
}
const HOOD: KitchenAppliance = { ...base, id: 'hd1', slot: 'hood', name: 'Вытяжка', price: 1, w: 60, h: 50, d: 50, builtIn: false, hood: 'chimney' }
const FRIDGE: KitchenAppliance = { ...base, id: 'fr1', slot: 'fridge', name: 'Холодильник', price: 1, w: 60, h: 185, d: 65, builtIn: false, finish: 'white' }

const input: PlanInput = {
  shape: 'straight',
  a: 300,
  b: 0,
  c: 0,
  island: 0,
  fridge: FRIDGE,
  hob: STOVE,
  stove: { w: 60, h: 85, d: 60 },
  hood: { w: 60 },
}

function build(style = STYLES[0], lite = false): { built: Built; stove: Module } {
  const plan = planKitchen(input, { shelves: style.shelves })
  const built = buildKitchen({
    plan,
    style,
    tone: getTone(style, 0),
    items: { hob: STOVE, hood: HOOD, fridge: FRIDGE, oven: null },
    photos: new Map(),
    evening: false,
    room: { ceiling: 270, toCeiling: false },
    fronts: {},
    detail: 0.5,
    lite,
  })
  const stove = plan.runs[0].modules.find((m) => m.stove)!
  return { built, stove }
}

const CARCASS_KINDS = ['base', 'drawers', 'sinkBase', 'hobBase', 'ovenBase', 'corner', 'bottle', 'openBase', 'filler']

describe('плита в 3D и для мебельщика', () => {
  it('на месте плиты нет корпуса; плита — рамка от пола 60×85', () => {
    for (const style of STYLES) {
      const { built, stove } = build(style)
      const run = built.spec.runs[0]
      const inside = (x0: number, x1: number) => x1 > stove.x + 0.5 && x0 < stove.x + stove.w - 0.5
      const cabinets = run.boxes.filter((b) => CARCASS_KINDS.includes(b.kind) && b.y < 80 && inside(b.x, b.x + b.w))
      expect(cabinets, style.id).toEqual([])
      const frame = run.boxes.filter((b) => b.slot === 'hob' && b.kind === 'appliance')
      expect(frame, style.id).toHaveLength(1)
      expect(frame[0], style.id).toMatchObject({ stove: true, w: 60, h: 85, d: 60, y: 0 })
      expect(frame[0].x, style.id).toBeCloseTo(stove.x, 0)
      expect(built.anchors.hob, style.id).toBeDefined()
    }
  })

  it('столешница прерывается: куски слева и справа, без выреза под варочную; строка «место под плиту»', () => {
    const { built, stove } = build()
    const run = built.spec.runs[0]
    for (const t of run.tops) expect(t.x1 <= stove.x + 0.5 || t.x0 >= stove.x + stove.w - 0.5, `${t.x0}–${t.x1}`).toBe(true)
    if (stove.x > 1) expect(run.tops.some((t) => Math.abs(t.x1 - stove.x) < 2.5)).toBe(true)
    if (stove.x + stove.w < run.length - 1) expect(run.tops.some((t) => Math.abs(t.x0 - (stove.x + stove.w)) < 2.5)).toBe(true)
    expect(topList(built.spec.runs).rows.every((r) => !r.hob)).toBe(true)
    expect(extraList(built.spec)).toContainEqual({ kind: 'stoveOpening', w: 600, h: 850, count: 1 })
  })

  it('hoodOver — от верха плиты (85 см): 65 см над электрической', () => {
    const { built } = build()
    const hood = built.objects.hood!
    built.root.updateMatrixWorld(true)
    const low = new THREE.Box3().setFromObject(hood).min.y
    expect(built.hoodOver).toBeCloseTo(low * 100 - 85, 0)
    expect(built.hoodOver).toBe(65)
  })

  it('«Лёгкий» собирает ту же плиту: spec тот же', () => {
    const full = build(STYLES[0]).built
    const lite = build(STYLES[0], true).built
    expect(JSON.stringify(lite.spec)).toBe(JSON.stringify(full.spec))
    expect(lite.objects.hob).toBeDefined()
  })

  it('развёртка: рамка «Плита 60×85» от пола, «до вытяжки» от верха плиты, цепочка по модулям — плита 60', () => {
    const t = kitchenTexts('ru')
    const labels: DrawingLabels = {
      cm: t.cm,
      appliance: (slot) => t.techShort[slot as keyof typeof t.techShort] ?? slot,
      ...t.drawing,
      stove: t.stove.name,
    }
    const { built, stove } = build()
    const run = built.spec.runs[0]
    const svg = elevationSvg(run, built.spec.heights, labels, null)
    const texts = [...svg.matchAll(/<text([^>]*)>([^<]*)<\/text>/g)].map(([, a, s]) => ({ a, s }))
    const H = built.spec.heights.ceiling
    const tech = [...svg.matchAll(/<rect([^>]*)\/>/g)].map((m) => m[1]).filter((a) => a.includes('el-tech'))
    // рамка плиты: низ на полу (y + h = H), высота 85
    expect(
      tech.some((a) => Math.abs(+/ y="([\d.]+)"/.exec(a)![1] + 85 - H) < 0.2 && Math.abs(+/height="([\d.]+)"/.exec(a)![1] - 85) < 0.2),
    ).toBe(true)
    expect(texts.some((x) => x.s === 'Плита')).toBe(true)
    expect(texts.some((x) => x.s === '60×85')).toBe(true)
    const hood = texts.find((x) => x.a.includes('data-dim="hood"'))
    expect(hood?.s).toBe('65')
    // цепочка вдоль пола — кусок на каждый модуль слева направо: плита ровно 60, соседние шкафы — своей шириной
    const low = texts.filter((x) => x.a.includes('data-chain="low"')).map((x) => parseFloat(x.s.replace(',', '.')))
    const mods = [...run.modules].sort((a, b) => a.x - b.x)
    const at = mods.findIndex((m) => Math.abs(m.x - stove.x) < 0.5)
    expect(at).toBeGreaterThanOrEqual(0)
    expect(low[at]).toBe(60)
    expect(low).toEqual(mods.map((m) => Math.round(m.w * 10) / 10))
  })
})
