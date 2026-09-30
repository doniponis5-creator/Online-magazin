import { describe, expect, it } from 'vitest'
import './helpers/canvas'
import { buildKitchen } from '@/components/kitchen/three/build'
import { elevationSvg, islandOverhang, planSvg, windowFor, type DrawingLabels } from '@/components/kitchen/drawing'
import { kitchenTexts } from '@/components/kitchen/texts'
import { cutWorkbook } from '@/lib/kitchen/cutExcel'
import { cutParts } from '@/lib/kitchen/cutting'
import { WINDOW } from '@/lib/kitchen/dims'
import { planKitchen, type Plan } from '@/lib/kitchen/layout'
import { planInputOf } from '@/lib/kitchen/order'
import { DEFAULT_STATE } from '@/lib/kitchen/share'
import { cutList, extraList, frontList, hardware, topList } from '@/lib/kitchen/spec'
import { getStyle, getTone } from '@/lib/kitchen/styles'
import type { KitchenState } from '@/lib/kitchen/types'

/**
 * Концерн 17: пустое место `gN` — только для 3D-захвата и плана; ни одна выгрузка
 * его не видит. Одна и та же кухня с `run.gaps` и с вычищенными `run.gaps` даёт
 * одинаковые cutList/frontList, раскрой, Excel, чертежи. Таблицы листа мастера
 * (`sheetTables` в KitchenPlanner.tsx) строятся из тех же `frontList`/`cutList`/
 * `hardware`/`topList`/`extraList` — сравниваются они.
 */

const style = getStyle('modern')
const ceiling = 270
// прямая 400: низ — мойка, пустое место g1 60, варочная; верх ручной — шкаф u1 и пустое g2
const state: KitchenState = {
  ...DEFAULT_STATE,
  shape: 'straight',
  a: 400,
  arrangement: { A: ['sink', 'g1', 'hob'] },
  gaps: { g1: { w: 60 }, g2: { w: 60 } },
  at: { sink: 30, g1: 90, hob: 220 },
  manualUppers: { A: ['u1', 'g2'] },
  upperCabs: { u1: { w: 60, kind: 'doors' } },
}
const withGaps = planKitchen(planInputOf(state, {}), { shelves: style.shelves })
const noGaps: Plan = { ...withGaps, runs: withGaps.runs.map((r) => ({ ...r, gaps: [] })) }

const spec = (plan: Plan) => buildKitchen({ plan, style, tone: getTone(style, 0), items: {}, photos: new Map(), evening: false, room: { ceiling, toCeiling: false }, fronts: {}, detail: 0.5 }).spec
const a = spec(withGaps)
const b = spec(noGaps)

describe('пустое место gN не попадает ни в одну выгрузку (концерн 17)', () => {
  it('кухня правда с пустыми местами в низу и в верху', () => {
    const rows = withGaps.runs.flatMap((r) => (r.gaps ?? []).map((g) => `${g.item}:${g.row}`))
    expect(rows.sort()).toEqual(['g1:base', 'g2:upper'])
  })

  it('cutList, frontList, фурнитура, столешницы, доборы — одинаковы', () => {
    expect(cutList(a.carcasses, a.panels)).toEqual(cutList(b.carcasses, b.panels))
    expect(cutList(a.carcasses, a.panels).length).toBeGreaterThan(0)
    expect(frontList(a.runs)).toEqual(frontList(b.runs))
    expect(hardware(a)).toEqual(hardware(b))
    expect(topList(a.runs)).toEqual(topList(b.runs))
    expect(extraList(a)).toEqual(extraList(b))
  })

  it('раскрой cutParts и книга Excel — одинаковы', () => {
    expect(cutParts(a, { lang: 'ru' })).toEqual(cutParts(b, { lang: 'ru' }))
    const t = kitchenTexts('ru')
    expect(cutWorkbook(a, {}, t)).toEqual(cutWorkbook(b, {}, t))
  })

  for (const lang of ['ru', 'ky'] as const) {
    it(`${lang}: план сверху и развёртки — одна и та же разметка`, () => {
      const t = kitchenTexts(lang)
      expect(planSvg(withGaps, { cm: t.cm, ...t.plan }, { runs: a.runs })).toBe(planSvg(noGaps, { cm: t.cm, ...t.plan }, { runs: b.runs }))
      const labels: DrawingLabels = { cm: t.cm, appliance: (slot) => t.techShort[slot as keyof typeof t.techShort] ?? slot, ...t.drawing }
      expect(a.runs.length).toBeGreaterThan(0)
      a.runs.forEach((run, i) => {
        const win = windowFor(withGaps, run.id, ceiling, WINDOW)
        expect(elevationSvg(run, a.heights, labels, win, { overhang: islandOverhang(a.runs) })).toBe(elevationSvg(b.runs[i], b.heights, labels, windowFor(noGaps, run.id, ceiling, WINDOW), { overhang: islandOverhang(b.runs) }))
      })
    })
  }
})
