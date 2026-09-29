import { describe, expect, it } from 'vitest'
import './helpers/canvas'
import { buildKitchen, type BuildInput } from '@/components/kitchen/three/build'
import { planKitchen, type PlanInput } from '@/lib/kitchen/layout'
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
})
