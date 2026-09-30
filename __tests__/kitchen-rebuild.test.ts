import { describe, expect, it } from 'vitest'
import './helpers/canvas'
import { buildKitchen, type BuildInput } from '@/components/kitchen/three/build'
import { planKitchen, type PlanInput } from '@/lib/kitchen/layout'
import { baseKey } from '@/lib/kitchen/fronts'
import { getTone, STYLES } from '@/lib/kitchen/styles'
import type { KitchenAppliance } from '@/lib/kitchen/types'

/*
  Пересборка по частям (история 24, R06.1): `buildKitchen(input, built.parts)`
  берёт готовыми ряды, которые не менялись, и строит заново только затронутый.
  Шов — публичный `buildKitchen`: `rebuilt` называет пересобранные стены, а
  спецификация для мебельщика после частичной сборки та же, что после полной.
*/

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

const fridge = appliance({ slot: 'fridge', id: 'fr', image: 'fridge.jpg' })
const oven = appliance({ slot: 'oven', id: 'ov', w: 59.5, h: 59.5, d: 56, builtIn: true })
const hob = appliance({ slot: 'hob', id: 'hb', w: 59, h: 5, d: 52, builtIn: true, hob: 'electric' })
const dishwasher = appliance({ slot: 'dishwasher', id: 'dw', w: 44.8, h: 81.5, d: 55, builtIn: true })

const planInput: PlanInput = { shape: 'corner', a: 300, b: 240, c: 0, island: 0, fridge, dishwasher, hob, oven, hood: { w: 60 } }

function input(photos: Map<string, null>): BuildInput {
  const style = STYLES[0]
  return {
    plan: planKitchen(planInput, { shelves: false }),
    style,
    tone: getTone(style, 0),
    items: { fridge, oven, hob, dishwasher },
    photos,
    evening: false,
    room: { ceiling: 270, toCeiling: false },
    fronts: {},
    detail: 0.5,
  }
}

describe('пересборка по частям', () => {
  it('без изменений — ни одна стена не пересобирается, спецификация та же', () => {
    const first = buildKitchen(input(new Map()))
    expect(first.rebuilt.sort()).toEqual(['A', 'B'])
    // готовые ряды переезжают в новую сборку — считаем детей до переезда
    const children = first.root.children.length
    const again = buildKitchen(input(new Map()), first.parts)
    expect(again.rebuilt).toEqual([])
    expect(again.spec).toEqual(first.spec)
    expect(again.root.children.length).toBe(children)
    expect(first.root.children.length).toBe(children - 2)
  })

  it('пришло фото холодильника — пересобирается только его стена, спецификация как у полной сборки', () => {
    const first = buildKitchen(input(new Map()))
    const wall = planKitchen(planInput, { shelves: false }).placed.fridge?.run
    expect(wall).toBeTruthy()
    const photos = new Map<string, null>([['fridge.jpg', null]])
    const partial = buildKitchen(input(photos), first.parts)
    expect(partial.rebuilt).toEqual([wall])
    const full = buildKitchen(input(photos))
    expect(partial.spec).toEqual(full.spec)
    expect(Object.keys(partial.objects).sort()).toEqual(Object.keys(full.objects).sort())
  })

  it('фасад автошкафа на одной стене — пересобирается только она', () => {
    const first = buildKitchen(input(new Map()))
    const runs = planKitchen(planInput, { shelves: false }).runs
    const run = runs.find((r) => r.modules.some((m) => (m.kind === 'doors' || m.kind === 'drawers') && m.w >= 30))!
    const door = run.modules.find((m) => (m.kind === 'doors' || m.kind === 'drawers') && m.w >= 30)!
    const next = input(new Map())
    next.fronts = { [baseKey(run.id, door.x)]: 'drawers3' }
    const partial = buildKitchen(next, first.parts)
    expect(partial.rebuilt).toEqual([run.id])
  })

  it('свой шкаф k1 на A: его фасад — только ряд A, не вся кухня', () => {
    const withOwn: PlanInput = { ...planInput, a: 420, arrangement: { A: ['k1', 'sink', 'hob'], B: ['fridge', 'oven'] }, cabinets: { k1: { w: 60, front: 'doors' } } }
    const mk = (fronts: BuildInput['fronts']): BuildInput => ({ ...input(new Map()), plan: planKitchen(withOwn, { shelves: false }), fronts })
    const first = buildKitchen(mk({}))
    expect(first.rebuilt.sort()).toEqual(['A', 'B'])
    const partial = buildKitchen(mk({ k1: 'drawers3' }), first.parts)
    expect(partial.rebuilt).toEqual(['A'])
  })

  const count = (root: { traverse: (f: (o: { name: string }) => void) => void }, name: string) => {
    let n = 0
    root.traverse((o) => {
      if (o.name === name) n++
    })
    return n
  }

  it('мелочи: доска у плиты и чайник у мойки — по одному на кухню, и после частичной пересборки тоже', () => {
    const first = buildKitchen(input(new Map()))
    expect(count(first.root, 'prop:board')).toBe(1)
    expect(count(first.root, 'prop:kettle')).toBe(1)
    const partial = buildKitchen(input(new Map([['fridge.jpg', null]])), first.parts)
    expect(count(partial.root, 'prop:board')).toBe(1)
    expect(count(partial.root, 'prop:kettle')).toBe(1)
  })

  it('доска — у модуля рядом с плитой, чайник — у модуля рядом с мойкой, не на одном месте', () => {
    const built = buildKitchen(input(new Map()))
    const at = (name: string) => {
      let x: number | null = null
      built.root.traverse((o) => {
        if (o.name === name) x = o.position.x
      })
      return x!
    }
    const runs = planKitchen(planInput, { shelves: false }).runs
    // на каком модуле стоит вещь: ряд с предметом (плита/мойка), соседи по порядку, x — середина модуля (у доски сдвиг 4 см)
    const spot = (kind: 'hob' | 'sink', x: number, shift: number, around: number[]) => {
      const run = runs.find((r) => r.modules.some((m) => m.kind === kind))!
      const i = run.modules.findIndex((m) => m.kind === kind)
      const j = around.map((d) => i + d).find((k) => run.modules[k] && Math.abs((run.modules[k].x + run.modules[k].w / 2) / 100 - shift - x) < 1e-6)
      return j === undefined ? null : `${run.id}:${j}`
    }
    const board = spot('hob', at('prop:board'), 0.04, [1, -1])
    const kettle = spot('sink', at('prop:kettle'), 0, [1, -1, 2, -2])
    expect(board).not.toBeNull()
    expect(kettle).not.toBeNull()
    expect(board).not.toBe(kettle)
  })

  it('кухня без плиты: доски нет, чайник у мойки остаётся', () => {
    // раскладка всегда держит место под варочную — убираем её из плана: на её месте обычный шкаф
    const plan = planKitchen(planInput, { shelves: false })
    const noHob = { ...plan, runs: plan.runs.map((r) => ({ ...r, modules: r.modules.map((m) => (m.kind === 'hob' ? { ...m, kind: 'doors' as const, item: undefined, oven: undefined } : m)) })) }
    const built = buildKitchen({ ...input(new Map()), plan: noHob })
    expect(count(built.root, 'prop:board')).toBe(0)
    expect(count(built.root, 'prop:kettle')).toBe(1)
  })
})

describe('ключ ряда и выпавшая техника (C1, 21)', () => {
  // прямая стена 200 см: холодильник, посудомойка, варочная с духовкой и стиральная не помещаются — что-то выпадает
  const washer = appliance({ slot: 'washer', id: 'wm', w: 60, h: 85, d: 60 })
  const short: PlanInput = { shape: 'straight', a: 200, b: 0, c: 0, island: 0, fridge, dishwasher, hob, oven, washer, hood: { w: 60 } }
  const build = (items: BuildInput['items'], reuse?: ReturnType<typeof buildKitchen>['parts']) => {
    const style = STYLES[0]
    return buildKitchen(
      { plan: planKitchen(short, { shelves: false }), style, tone: getTone(style, 0), items, photos: new Map(), evening: false, room: { ceiling: 270, toCeiling: false }, fronts: {}, detail: 0.5 },
      reuse,
    )
  }

  it('выпавшая техника не входит в ключ ряда: другая её модель — ни одна стена не пересобирается', () => {
    const plan = planKitchen(short, { shelves: false })
    const gone = plan.dropped.map((d) => d.slot).filter((s): s is NonNullable<typeof s> => Boolean(s))
    expect(gone.length).toBeGreaterThan(0)
    const slot = gone[0]
    expect(plan.placed[slot]).toBeUndefined()
    const items: BuildInput['items'] = { fridge, oven, hob, dishwasher, washer }
    const first = build(items)
    const other = { ...items, [slot]: appliance({ ...items[slot]!, id: 'another', w: 45 }) }
    expect(build(other, first.parts).rebuilt).toEqual([])
  })

  it('а стоящая на ряду — входит: другая модель посудомойки пересобирает её стену', () => {
    const plan = planKitchen(short, { shelves: false })
    const at = plan.placed.dishwasher
    if (!at) return
    const items: BuildInput['items'] = { fridge, oven, hob, dishwasher, washer }
    const first = build(items)
    const other = { ...items, dishwasher: appliance({ ...dishwasher, id: 'dw2', w: 59.8 }) }
    expect(build(other, first.parts).rebuilt).toEqual([at.run])
  })
})
