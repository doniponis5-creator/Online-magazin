import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { PlanSketch } from '@/components/kitchen/PlanSketch'
import { kitchenTexts } from '@/components/kitchen/texts'
import { planKitchen, type Plan } from '@/lib/kitchen/layout'

/**
 * «Итог» → «Коротко: что где стоит»: схема сверху подписывает мойку, как план
 * («Мойка», не «60»), а модуль уже 25 см — своим названием, не пустым (P4).
 */
describe('PlanSketch: подписи на схеме «Коротко»', () => {
  const plan = planKitchen({ shape: 'straight', a: 300, b: 0, c: 0, island: 0 }, { shelves: false })
  const nums = (html: string) => [...html.matchAll(/class="kp-sketch__num"[^>]*>([^<]*)</g)].map((m) => m[1])
  for (const lang of ['ru', 'ky'] as const) {
    const t = kitchenTexts(lang)
    const draw = (p: Plan) => renderToStaticMarkup(createElement(PlanSketch, { plan: p, labels: { a: 'A' }, showWidths: true, names: t.planNames, modules: t.modules }))
    it(`${lang}: мойка — «${t.planNames.sink}», у шкафов — ширина`, () => {
      const run = plan.runs[0]
      const sink = run.modules.find((m) => m.kind === 'sink')!
      const out = nums(draw(plan))
      expect(out).toContain(t.planNames.sink)
      expect(out.filter((s) => s === String(Math.round(sink.w))).length).toBe(run.modules.filter((m) => m.kind !== 'sink' && m.kind !== 'hob' && Math.round(m.w) === Math.round(sink.w)).length)
    })
    it(`${lang}: узкий модуль (бутылочница 15) подписан названием`, () => {
      const run = plan.runs[0]
      const i = run.modules.findIndex((m) => m.kind === 'doors' || m.kind === 'drawers')
      const m = run.modules[i]
      const narrow: Plan = { ...plan, runs: [{ ...run, modules: [...run.modules.slice(0, i), { ...m, kind: 'bottle', w: 15 }, { ...m, x: m.x + 15, w: m.w - 15 }, ...run.modules.slice(i + 1)] }] }
      const out = nums(draw(narrow))
      expect(out.some((s) => s.length > 0 && t.modules.bottle.toLowerCase().startsWith(s.replace(/\.$/, '').toLowerCase()))).toBe(true)
    })
  }
})
