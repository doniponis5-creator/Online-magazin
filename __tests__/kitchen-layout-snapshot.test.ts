import { describe, expect, it } from 'vitest'
import { READY } from '@/data/kitchen-ready'
import live from './fixtures/kitchen-live-appliances.json'
import { products } from '@/data/products'
import { kitchenAppliances } from '@/lib/kitchen/catalog'
import { detachUppers, planKitchen, UPPER_MIN, type Plan } from '@/lib/kitchen/layout'
import { chosenItems, planInputOf } from '@/lib/kitchen/order'
import { stateFromQuery } from '@/lib/kitchen/share'
import { getStyle } from '@/lib/kitchen/styles'
import type { KitchenAppliance, KitchenState } from '@/lib/kitchen/types'

/**
 * Снимок раскладки: 12 готовых кухонь и старые адреса со своими местами
 * (`_095`, `-1325`) после эволюции модели (пустые места, ручной верх) должны
 * давать ту же раскладку, что до неё (R23i, R23i.1). Снимок снят до правок.
 */
const liveList = live.appliances as KitchenAppliance[]
const liveIds = new Set(liveList.map((a) => a.id))
const catalog = [...kitchenAppliances(products).filter((a) => !liveIds.has(a.id)), ...liveList]
const known = new Map(catalog.map((a) => [a.id, a]))

const planOf = (s: KitchenState): Plan => planKitchen(planInputOf(s, chosenItems(s.picks, catalog), []), { shelves: getStyle(s.style).shelves })

/** Только то, что видно: ряды, модули и верх с координатами до 0,1 см. */
const shapeOf = (p: Plan) =>
  p.runs.map((r) => ({
    id: r.id,
    length: r.length,
    modules: r.modules.map((m) => [m.kind, Math.round(m.x * 10) / 10, Math.round(m.w * 10) / 10, m.item ?? ''].join(':')),
    uppers: r.uppers.map((u) => [u.kind, Math.round(u.x * 10) / 10, Math.round(u.w * 10) / 10].join(':')),
    dropped: p.dropped.filter((d) => d.wall === r.id).map((d) => `${d.item}:${d.need}`),
  }))

const OLD_LINKS = [
  'f=straight&a=400&o=s_095d60ok1',
  'f=straight&a=400&o=60ok_120s-1325dh',
  'f=corner&a=300&b=240&o=sd.hv&pn=1',
  'f=u&a=360&b=240&c=240&o=s_150d.h_120v.wtpf&wd=s80h90',
  'f=island&a=320&i=180&o=fts.h_090d',
]

describe('снимок раскладки: готовые кухни и старые адреса', () => {
  it('12 готовых кухонь раскладываются как до эволюции модели', () => {
    for (const k of READY) {
      const state = stateFromQuery(new URLSearchParams(k.q), known)
      expect(shapeOf(planOf(state))).toMatchSnapshot(k.id)
    }
  })

  it('старые адреса без новых полей раскладываются как прежде', () => {
    for (const q of OLD_LINKS) {
      const state = stateFromQuery(new URLSearchParams(q), known)
      expect(shapeOf(planOf(state))).toMatchSnapshot(q)
    }
  })
})

describe('detachUppers на живых кухнях: верх стены становится ручным, картинка та же (концерн 22)', () => {
  const upperRow = (p: Plan, wall: string) => p.runs.find((r) => r.id === wall)!.uppers.map((u) => [u.kind, Math.round(u.x * 10) / 10, Math.round(u.w * 10) / 10].join(':'))
  const detachAll = (id: string) => {
    const k = READY.find((r) => r.id === id)!
    const s = stateFromQuery(new URLSearchParams(k.q), known)
    const p0 = planOf(s)
    return p0.runs.filter((r) => r.id !== 'I' && r.uppers.length > 0).map((r) => ({ wall: r.id, before: upperRow(p0, r.id), next: detachUppers(s, r.id as 'A' | 'B' | 'C', p0) }))
  }

  it('corner-300x240-marble (снимок): ряды A и B после отрыва — те же шкафы, угол, вытяжка и пустоты над высокими', () => {
    const walls = detachAll('corner-300x240-marble')
    expect(walls.map((w) => w.wall)).toEqual(['A', 'B'])
    for (const { wall, before, next } of walls) {
      expect(next.manualUppers?.[wall as 'A' | 'B'], wall).toBeDefined()
      expect(upperRow(planOf(next), wall), wall).toEqual(before)
      // ни одного ручного шкафа уже нормы — узкое место остаётся добором/пустотой, а не шкафом с дверцей
      for (const c of Object.values(next.upperCabs ?? {})) expect(c.w, wall).toBeGreaterThanOrEqual(UPPER_MIN)
    }
  })

  it('все 12 готовых: добор (filler) верха после отрыва остаётся добором на том же месте', () => {
    let fillers = 0
    for (const k of READY) {
      for (const { wall, before, next } of detachAll(k.id)) {
        fillers += before.filter((u) => u.startsWith('filler:')).length
        expect(upperRow(planOf(next), wall), `${k.id} ${wall}`).toEqual(before)
      }
    }
    // без хотя бы одного добора проверка выше ничего не говорит о доборах
    expect(fillers).toBeGreaterThan(0)
  })
})
