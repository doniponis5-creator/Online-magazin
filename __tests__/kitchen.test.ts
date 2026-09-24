import { describe, expect, it } from 'vitest'
import type { Product } from '@/data/products'
import { applianceFromProduct, defaultPick, finishOf, parseSize } from '@/lib/kitchen/catalog'
import {
  companions,
  DEPTH,
  itemGaps,
  itemPositions,
  LIMITS,
  minA,
  moveItem,
  nextWall,
  pinCabinet,
  planKitchen,
  resolveArrangement,
  resolveRun,
  splitFill,
  stepItem,
  type Plan,
} from '@/lib/kitchen/layout'
import { checkProject, type Check } from '@/lib/kitchen/checks'
import { frontsFromQuery, frontsToQuery } from '@/lib/kitchen/fronts'
import { DEFAULT_STATE, queryFromState, stateFromQuery } from '@/lib/kitchen/share'
import { cutList, frontList, hardware, hingesFor, modulesOf, topList, type SpecData } from '@/lib/kitchen/spec'
import { STYLES } from '@/lib/kitchen/styles'
import type { KitchenAppliance } from '@/lib/kitchen/types'
import { SIDE_SHARE, sideShare } from '@/components/kitchen/three/photo'

const spec = (label: string, value: string) => ({ labelRu: label, labelKy: label, valueRu: value, valueKy: value })

function product(name: string, specs: [string, string][], price = 20000, stock = 1): Product {
  return {
    id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    brand: 'Test',
    categoryId: 'kitchen',
    nameRu: name,
    nameKy: name,
    price,
    art: 'box',
    baseColor: '#000',
    descRu: '',
    descKy: '',
    specs: specs.map(([l, v]) => spec(l, v)),
    warrantyMonths: 12,
    variants: [{ id: 'std', stock }],
  }
}

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

describe('размеры из характеристик', () => {
  it('понимает порядок Ш×Г×В и запятую', () => {
    expect(parseSize([{ label: 'Размеры (Ш×Г×В)', value: '83×59,5×192 см' }])).toEqual({ w: 83, d: 59.5, h: 192 })
  })
  it('понимает порядок В×Ш×Г', () => {
    expect(parseSize([{ label: 'Размеры (В×Ш×Г)', value: '145×55×55 см' }])).toEqual({ h: 145, w: 55, d: 55 })
  })
  it('переводит миллиметры', () => {
    expect(parseSize([{ label: 'Размеры Ш×В×Г', value: '595 × 595 × 575 мм' }])).toEqual({ w: 59.5, h: 59.5, d: 57.5 })
  })
  it('берёт отдельные строки', () => {
    expect(parseSize([{ label: 'Ширина', value: '45 см' }])).toEqual({ w: 45, h: undefined, d: undefined })
  })
})

describe('цвет техники', () => {
  it('первое слово главнее', () => {
    expect(finishOf('Нержавеющая сталь / чёрное стекло')).toBe('inox')
    expect(finishOf('Серебристый')).toBe('inox')
    expect(finishOf('Тёмно-серый, чёрный люк')).toBe('black')
    expect(finishOf('Титан')).toBe('gray')
  })
})

describe('техника из каталога', () => {
  it('узнаёт встраиваемую духовку', () => {
    const a = applianceFromProduct(
      product('Встраиваемая духовка MIDEA MO 69103GB (черный)', [
        ['Тип', 'Электрический духовой шкаф'],
        ['Цвет', 'Чёрный'],
        ['Размеры В×Ш×Г', '59,5 × 59,5 × 57,5 см'],
      ]),
    )
    expect(a).toMatchObject({ slot: 'oven', builtIn: true, finish: 'black', w: 59.5, h: 59.5, sizeKnown: true })
  })
  it('отдельностоящая посудомойка не встраиваемая', () => {
    const a = applianceFromProduct(
      product('Посудомоечная машина VELBERG VLB-6609W инвертор белый 15 персон', [
        ['Тип', 'Отдельностоящая посудомоечная машина'],
        ['Ширина', '60 см'],
      ]),
    )
    expect(a).toMatchObject({ slot: 'dishwasher', builtIn: false, w: 60, finish: 'white' })
  })
  it('side-by-side без размеров — 90 см', () => {
    const a = applianceFromProduct(product('Холодильник X', [['Тип', 'Двухкамерный холодильник Side-by-Side']]))
    expect(a).toMatchObject({ slot: 'fridge', fridge: 'sbs', w: 90, sizeKnown: false })
  })
  it('вытяжка: вид по типу', () => {
    const a = applianceFromProduct(product('Встраиваемая вытяжка Asco', [['Тип', 'Телескопическая встраиваемая вытяжка'], ['Ширина', '60 см']]))
    expect(a).toMatchObject({ slot: 'hood', hood: 'telescopic', w: 60 })
  })
  it('полуавтомат, морозильник, товар без цены и без остатка — не для кухни', () => {
    expect(applianceFromProduct(product('Стиральная машина п/а AVANGARD', [['Тип загрузки', 'Вертикальная']]))).toBeNull()
    expect(applianceFromProduct(product('Морозилька LEVO 278', []))).toBeNull()
    expect(applianceFromProduct(product('Холодильник Y', [], 0))).toBeNull()
    expect(applianceFromProduct(product('Холодильник Z', [], 30000, 0))).toBeNull()
  })
  it('по умолчанию — обычный холодильник, а не широкий', () => {
    const list = [
      appliance({ id: 'wide', w: 90, price: 80000 }),
      appliance({ id: 'narrow', w: 60, price: 40000 }),
    ]
    expect(defaultPick('fridge', list)).toBe('narrow')
    expect(defaultPick('washer', list)).toBeNull()
  })
})

describe('раскладка', () => {
  it('режет столешницу на шкафы', () => {
    expect(splitFill(10, 'doors', 'work')).toEqual([{ kind: 'filler', w: 10 }])
    expect(splitFill(25, 'doors', 'work')).toEqual([{ kind: 'bottle', w: 25 }])
    expect(splitFill(170, 'doors', 'work').reduce((s, m) => s + m.w, 0)).toBe(170)
  })

  it('ряд занимает стену ровно', () => {
    const run = resolveRun(300, 0, [
      { kind: 'sink', w: 60 },
      { fill: 1, min: 40, prefer: 'doors', role: 'work' },
      { kind: 'hob', w: 60 },
      { fill: 0.35, min: 30, prefer: 'drawers', role: 'side' },
    ])!
    const last = run[run.length - 1]
    expect(last.x + last.w).toBe(300)
    expect(run.map((m) => m.kind)).toContain('hob')
  })

  const fullSet = {
    fridge: appliance({ slot: 'fridge' }),
    dishwasher: appliance({ slot: 'dishwasher', w: 60, builtIn: true }),
    washer: appliance({ slot: 'washer' }),
    microwave: appliance({ slot: 'microwave', w: 59.5, h: 38.5, builtIn: true }),
    hob: appliance({ slot: 'hob', w: 60 }),
  }

  const runEnd = (plan: Plan, id: string) => {
    const run = plan.runs.find((r) => r.id === id)!
    const last = run.modules[run.modules.length - 1]
    return { run, first: run.modules[0], last }
  }

  it('прямая 3 м: всё не помещается — лишнее уходит с запасом в см', () => {
    const plan = planKitchen({ shape: 'straight', a: 300, b: 0, c: 0, island: 0, ...fullSet }, { shelves: false })
    const { last } = runEnd(plan, 'A')
    expect(last.x + last.w).toBe(300)
    expect(plan.dropped.map((d) => d.slot)).toContain('washer')
    expect(plan.placed.hob).toBeDefined()
    expect(plan.placed.fridge).toBeDefined()
  })

  it('прямая 4,5 м: помещается всё', () => {
    const plan = planKitchen({ shape: 'straight', a: 450, b: 0, c: 0, island: 0, ...fullSet }, { shelves: false })
    expect(plan.dropped).toEqual([])
    const tall = plan.runs[0].modules.find((m) => m.kind === 'tall')
    const hob = plan.runs[0].modules.find((m) => m.kind === 'hob')
    expect(tall).toBeDefined()
    expect(hob?.oven).toBe(false)
  })

  it('без пенала духовка под варочной', () => {
    const plan = planKitchen({ shape: 'straight', a: 300, b: 0, c: 0, island: 0, hob: fullSet.hob }, { shelves: false })
    expect(plan.runs[0].modules.find((m) => m.kind === 'hob')?.oven).toBe(true)
  })

  it('угловая: левый ряд начинается за угловым шкафом', () => {
    const plan = planKitchen({ shape: 'corner', a: 300, b: 240, c: 0, island: 0, ...fullSet }, { shelves: false })
    const { run, last } = runEnd(plan, 'B')
    // ряд B идёт от зрителя к углу и кончается в 60 см от угла
    expect(last.x + last.w).toBe(run.length - DEPTH)
    expect(run.modules[0].x).toBe(0)
    expect(plan.runs[0].modules[0]).toMatchObject({ kind: 'corner', blindAt: 'start' })
    expect(plan.window?.wall).toBe('back')
  })

  it('П-образная на минимальных размерах не ломается', () => {
    const plan = planKitchen(
      { shape: 'u', a: minA('u'), b: LIMITS.b.min, c: LIMITS.c.min, island: 0, ...fullSet },
      { shelves: true },
    )
    expect(plan.runs).toHaveLength(3)
    expect(plan.placed.hob?.run).toBe('B')
    for (const run of plan.runs) {
      for (const m of run.modules) expect(m.w).toBeGreaterThan(0)
    }
  })

  it('остров: проход 110 см', () => {
    const plan = planKitchen({ shape: 'island', a: 360, b: 0, c: 0, island: 180, ...fullSet }, { shelves: false })
    expect(plan.island!.z - DEPTH - DEPTH).toBe(110)
    expect(plan.runs.find((r) => r.id === 'I')!.modules.reduce((s, m) => s + m.w, 0)).toBe(180)
  })
})

describe('перестановка', () => {
  const set = {
    fridge: appliance({ slot: 'fridge' }),
    dishwasher: appliance({ slot: 'dishwasher', w: 60, builtIn: true }),
    hob: appliance({ slot: 'hob', w: 60 }),
  }
  const kinds = (plan: Plan, id: string) => plan.runs.find((r) => r.id === id)!.modules.map((m) => m.kind).filter((k) => !['doors', 'drawers', 'bottle', 'filler', 'corner'].includes(k))

  it('свой порядок на одной стене', () => {
    const plan = planKitchen({ shape: 'straight', a: 400, b: 0, c: 0, island: 0, ...set, arrangement: { A: ['hob', 'sink', 'dishwasher', 'fridge'] } }, { shelves: false })
    expect(kinds(plan, 'A')).toEqual(['hob', 'sink', 'dishwasher', 'fridge'])
  })

  it('плиту на заднюю стену угловой кухни', () => {
    const plan = planKitchen({ shape: 'corner', a: 440, b: 240, c: 0, island: 0, ...set, arrangement: { A: ['sink', 'dishwasher', 'hob', 'fridge'], B: [] } }, { shelves: false })
    expect(kinds(plan, 'A')).toEqual(['sink', 'dishwasher', 'hob', 'fridge'])
    expect(kinds(plan, 'B')).toEqual([])
    expect(plan.placed.hob?.run).toBe('A')
  })

  it('забытый предмет встаёт на своё место по правилам', () => {
    const order = resolveArrangement('corner', { A: ['fridge'], C: ['hob'] })
    // C у угловой кухни нет — плита (с местом под отдельную духовку) возвращается на стену B
    expect(order.B).toEqual(['hob', 'oven'])
    expect(order.C).toEqual([])
    expect([...order.A].sort()).toEqual(['dishwasher', 'fridge', 'pantry', 'pantry2', 'sink', 'tall', 'washer'])
  })

  it('перетаскивание: мойка — в конец стены', () => {
    const plan = planKitchen({ shape: 'straight', a: 400, b: 0, c: 0, island: 0, ...set }, { shelves: false })
    const order = resolveArrangement('straight')
    const moved = moveItem(order, 'sink', 'A', 390, itemPositions(plan))
    expect(moved.A[moved.A.length - 1]).toBe('sink')
  })

  it('шаг влево и на другую стену', () => {
    const order = resolveArrangement('straight')
    const present = new Set(['fridge', 'sink', 'dishwasher', 'hob'] as const)
    const left = stepItem(order, 'sink', -1, present)
    // между холодильником и мойкой стоит пенал, которого нет, — его пропускаем
    expect(left.A.indexOf('sink')).toBeLessThan(left.A.indexOf('fridge'))
    const u = resolveArrangement('u')
    expect(nextWall(u, 'hob', 'u').C).toContain('hob')
  })

  it('без пенала духовка переезжает к плите на любой стене', () => {
    const plan = planKitchen({ shape: 'u', a: 320, b: 240, c: 150, island: 0, ...set, microwave: appliance({ slot: 'microwave', builtIn: true, w: 59.5, h: 38.5 }), arrangement: { C: ['washer', 'fridge', 'tall'] } }, { shelves: false })
    const hob = plan.runs.flatMap((r) => r.modules).find((m) => m.kind === 'hob')!
    const tall = plan.runs.flatMap((r) => r.modules).find((m) => m.kind === 'tall')
    expect(hob.oven).toBe(!tall)
  })
})

describe('пеналы', () => {
  const kinds = (plan: Plan) => plan.runs.flatMap((r) => r.modules.map((m) => m.kind))
  it('духовка на уровне глаз — без микроволновки', () => {
    const plan = planKitchen({ shape: 'straight', a: 400, b: 0, c: 0, island: 0, hob: appliance({ slot: 'hob' }), tallOven: true }, { shelves: false })
    expect(kinds(plan)).toContain('tall')
    expect(plan.runs[0].modules.find((m) => m.kind === 'hob')?.oven).toBe(false)
  })
  it('два пенала для хранения рядом с холодильником', () => {
    const plan = planKitchen({ shape: 'straight', a: 450, b: 0, c: 0, island: 0, fridge: appliance({ slot: 'fridge' }), pantries: 2 }, { shelves: false })
    const k = plan.runs[0].modules.map((m) => m.kind).filter((x) => x === 'pantry' || x === 'fridge')
    expect(k).toEqual(['pantry', 'pantry', 'fridge'])
    expect(itemPositions(plan).pantry2).toBeDefined()
  })
  it('не влезает — пенал уступает первым и видно, на какой стене', () => {
    const plan = planKitchen({ shape: 'corner', a: 300, b: 240, c: 0, island: 0, fridge: appliance({ slot: 'fridge' }), pantries: 2 }, { shelves: false })
    expect(plan.dropped[0]).toMatchObject({ item: 'pantry2', wall: 'A' })
  })
})

describe('ссылка на проект', () => {
  it('туда и обратно', () => {
    const state = {
      ...DEFAULT_STATE,
      shape: 'u' as const,
      a: 320,
      b: 260,
      c: 240,
      style: 'loft' as const,
      tone: 2,
      picks: { fridge: 'f1', washer: null },
      arrangement: { A: ['sink' as const, 'hob' as const], B: [], C: ['fridge' as const, 'pantry' as const] },
      tallOven: true,
      pantries: 1,
      ceiling: 285,
      lowUppers: true,
      noWindow: true,
      windowW: 150,
      fridgeOpen: true,
      floor: 'herringboneDark' as const,
      wallColor: 3,
      fronts: { A120: 'drawers2' as const, a60: 'glass' as const, B0: 'open' as const },
    }
    const back = stateFromQuery(new URLSearchParams(queryFromState(state)), new Set(['f1']))
    expect(back).toEqual(state)
  })
  it('потолок по умолчанию и шкафы до потолка не пишутся в адрес', () => {
    const q = queryFromState({ ...DEFAULT_STATE, ceiling: 270 })
    expect(q).not.toContain('h=')
    expect(q).not.toContain('uc=')
  })
  it('чужие значения не проходят', () => {
    const back = stateFromQuery(new URLSearchParams('f=zzz&a=99999&s=evil&t=9&fr=unknown'), new Set())
    expect(back.shape).toBe(DEFAULT_STATE.shape)
    expect(back.a).toBe(LIMITS.a.max)
    expect(back.style).toBe(DEFAULT_STATE.style)
    expect(back.tone).toBe(2)
    expect(back.picks.fridge).toBeUndefined()
  })
})

describe('свои фасады', () => {
  it('туда и обратно, чужое не проходит', () => {
    const raw = frontsToQuery({ A120: 'drawers4', a60: 'lift', I0: 'mix' })
    expect(frontsFromQuery(raw)).toEqual({ A120: 'drawers4', a60: 'lift', I0: 'mix' })
    // у нижнего шкафа нет «стекла», у верхнего нет ящиков
    expect(frontsFromQuery('A120g.a60t')).toBeUndefined()
    expect(frontsFromQuery('<script>')).toBeUndefined()
  })
})

describe('окно, потолок, ниша холодильника', () => {
  const fridge = appliance({ slot: 'fridge', w: 59.5 })
  it('без окна верхние шкафы идут сплошь', () => {
    const plan = planKitchen({ shape: 'corner', a: 320, b: 240, c: 0, island: 0, noWindow: true }, { shelves: false })
    expect(plan.window).toBeNull()
    expect(plan.runs[0].uppers.some((u) => u.kind === 'none')).toBe(false)
  })
  it('широкое окно — шире проём, но не шире стены', () => {
    const plan = planKitchen({ shape: 'corner', a: 320, b: 240, c: 0, island: 0, windowW: 500 }, { shelves: false })
    expect(plan.window!.w).toBeLessThanOrEqual(320 - 40)
  })
  it('холодильник в нише — место шире на боковины, над ним антресоль', () => {
    const niche = planKitchen({ shape: 'straight', a: 400, b: 0, c: 0, island: 0, fridge }, { shelves: false })
    const open = planKitchen({ shape: 'straight', a: 400, b: 0, c: 0, island: 0, fridge, fridgeOpen: true }, { shelves: false })
    const w = (p: Plan) => p.runs[0].modules.find((m) => m.kind === 'fridge')!.w
    expect(w(niche) - w(open)).toBeGreaterThanOrEqual(3)
    expect(niche.runs[0].uppers.some((u) => u.kind === 'fridge')).toBe(true)
    expect(open.runs[0].uppers.some((u) => u.kind === 'fridge')).toBe(false)
  })
})

describe('стили', () => {
  it('у каждого стиля есть группа и три цвета, хай-тек — не меньше пяти', () => {
    for (const s of STYLES) expect(s.tones).toHaveLength(3)
    expect(STYLES.filter((s) => s.group === 'hitech').length).toBeGreaterThanOrEqual(5)
    expect(new Set(STYLES.map((s) => s.id)).size).toBe(STYLES.length)
  })
})

describe('для мебельщика', () => {
  const data: SpecData = {
    runs: [
      {
        id: 'A',
        length: 300,
        modules: [
          { x: 0, w: 60 },
          { x: 60, w: 60 },
        ],
        boxes: [
          { kind: 'base', x: 0, y: 0, w: 60, h: 82, d: 60 },
          { kind: 'drawers', x: 60, y: 0, w: 60, h: 82, d: 60 },
          { kind: 'upper', x: 0, y: 142, w: 60, h: 72, d: 35 },
          { kind: 'appliance', x: 120, y: 0, w: 59.5, h: 185, d: 65, slot: 'fridge' },
          { kind: 'appliance', x: 0, y: 20, w: 59.5, h: 59.5, d: 56, slot: 'oven' },
        ],
        fronts: [
          { x: 0.15, y: 10.3, w: 29.7, h: 71.6, hinge: 'left', glass: false, framed: false, handle: true },
          { x: 30.15, y: 10.3, w: 29.7, h: 71.6, hinge: 'right', glass: false, framed: false, handle: true },
          { x: 60.15, y: 60, w: 59.7, h: 20, hinge: 'drawer', glass: false, framed: false, handle: true },
          { x: 0.15, y: 142, w: 59.7, h: 72, hinge: 'top', glass: false, framed: false, handle: false },
          { x: 0.15, y: 10.3, w: 59.7, h: 170, hinge: 'left', glass: false, framed: false, handle: true },
        ],
        tops: [{ x0: 0, x1: 120, depth: 62, thick: 2, sink: true, hob: false }],
      },
    ],
    carcasses: [
      { row: 'base', w: 60, h: 72, d: 58, shelves: 1, top: false, bottom: true, back: true },
      { row: 'base', w: 60, h: 72, d: 58, shelves: 0, top: false, bottom: false, back: false },
      { row: 'upper', w: 60, h: 72, d: 33, shelves: 1, top: true, bottom: true, back: true },
    ],
    panels: [{ h: 260, d: 59.8, count: 2 }],
    plinth: 120,
    gola: 0,
    splash: 0.7,
    heights: { plinth: 10, counter: 84, upperBottom: 142, upperTop: 214, mezzTop: 270, ceiling: 270 },
  }
  it('одинаковые фасады складываются в одну строку', () => {
    const rows = frontList(data.runs)
    expect(rows.find((r) => r.type === 'door' && r.w === 297)).toMatchObject({ h: 716, count: 2 })
    expect(rows.find((r) => r.type === 'lift')).toMatchObject({ w: 597, h: 720, count: 1 })
  })
  it('раскрой: боковины, дно, царги у нижних, ниша отдельно', () => {
    const cuts = cutList(data.carcasses, data.panels)
    expect(cuts.find((c) => c.name === 'side' && c.a === 720 && c.b === 580)?.count).toBe(4)
    // у посудомойки (без дна) царг нет
    expect(cuts.find((c) => c.name === 'rail')?.count).toBe(2)
    expect(cuts.find((c) => c.name === 'nicheSide')).toMatchObject({ a: 2600, b: 598, count: 2 })
    expect(cuts.find((c) => c.name === 'back' && c.hdf)).toBeDefined()
  })
  it('фурнитура: петли по высоте дверцы, ножки только у шкафов с дном', () => {
    expect(hingesFor(71.6)).toBe(2)
    expect(hingesFor(170)).toBe(4)
    const hw = hardware(data)
    expect(hw).toMatchObject({ hinges: 2 + 2 + 4, lifts: 1, runners: 1, handles: 4, legs: 4, hangers: 2, plinth: 1.2 })
  })
  it('столешница в миллиметрах, модули без духовки в пенале', () => {
    expect(topList(data.runs)).toMatchObject({ total: 1.2, rows: [{ length: 1200, depth: 620, thick: 20, sink: true }] })
    const { lower, upper } = modulesOf(data.runs[0])
    expect(lower.map((b) => b.kind)).toEqual(['base', 'drawers', 'appliance'])
    expect(upper).toHaveLength(1)
  })
})

describe('переставить что угодно', () => {
  const hob = appliance({ slot: 'hob', w: 60 })
  const oven = appliance({ slot: 'oven', w: 59.5, h: 59.5, builtIn: true })
  const kinds = (plan: Plan, id: string) => plan.runs.find((r) => r.id === id)!.modules.map((m) => m.kind)

  it('духовка отдельно: свой шкаф рядом с плитой, под плитой — ящики', () => {
    const plan = planKitchen({ shape: 'straight', a: 400, b: 0, c: 0, island: 0, hob, ovenApart: true }, { shelves: false })
    const a = plan.runs[0].modules
    const hi = a.findIndex((m) => m.kind === 'hob')
    expect(a[hi + 1].kind).toBe('oven')
    expect(a[hi].oven).toBe(false)
  })

  it('мойка и плита на острове, холодильник туда нельзя', () => {
    const plan = planKitchen(
      { shape: 'island', a: 360, b: 0, c: 0, island: 220, hob, fridge: appliance({ slot: 'fridge' }), arrangement: { A: ['fridge'], I: ['sink', 'hob', 'fridge'] } },
      { shelves: false },
    )
    expect(kinds(plan, 'I')).toContain('sink')
    expect(kinds(plan, 'I')).toContain('hob')
    expect(kinds(plan, 'I')).not.toContain('fridge')
    expect(kinds(plan, 'A')).toContain('fridge')
    expect(itemPositions(plan).sink?.wall).toBe('I')
  })

  it('свои шкафы: стоят вплотную друг к другу и у стены без доборов', () => {
    const plan = planKitchen(
      {
        shape: 'straight',
        a: 400,
        b: 0,
        c: 0,
        island: 0,
        hob,
        cabinets: { k1: { w: 40, front: 'drawers4' }, k2: { w: 60, front: 'open' } },
        arrangement: { A: ['k1', 'k2', 'sink', 'hob'] },
      },
      { shelves: false },
    )
    const a = plan.runs[0].modules
    expect(a[0]).toMatchObject({ x: 0, w: 40, item: 'k1', front: 'drawers4' })
    expect(a[1]).toMatchObject({ x: 40, w: 60, item: 'k2', front: 'open' })
    const last = a[a.length - 1]
    expect(last.x + last.w).toBe(400)
  })

  it('обычный шкаф становится своим и встаёт на своё место', () => {
    const plan = planKitchen({ shape: 'straight', a: 400, b: 0, c: 0, island: 0, hob }, { shelves: false })
    const order = resolveArrangement('straight')
    const pos = itemPositions(plan)
    const sinkAt = pos.sink!.center
    const pinned = pinCabinet(order, {}, { w: 50, front: 'doors' }, 'A', sinkAt + 1, pos)
    expect(pinned.id).toBe('k1')
    expect(pinned.cabinets.k1).toEqual({ w: 50, front: 'doors' })
    const A = pinned.order.A
    expect(A.indexOf('sink')).toBeLessThan(A.indexOf('k1'))
    expect(A.indexOf('k1')).toBeLessThan(A.indexOf('hob'))
  })

  it('в адресе: свои шкафы, духовка отдельно, остров и отделка', () => {
    const state = {
      ...DEFAULT_STATE,
      shape: 'island' as const,
      a: 380,
      island: 220,
      arrangement: { A: ['fridge' as const, 'k1' as const, 'hob' as const, 'oven' as const], I: ['sink' as const, 'k2' as const] },
      cabinets: { k1: { w: 45, front: 'drawers4' as const }, k2: { w: 90, front: 'open' as const } },
      ovenApart: true,
      facade: 'acr-emerald',
      upperFacade: 'style',
      top: 'tc-nero',
      splash: 'sp-g-emerald',
      handle: 'knurled' as const,
      handleMetal: 'brass' as const,
      handleless: false,
    }
    const back = stateFromQuery(new URLSearchParams(queryFromState(state)), new Set())
    expect(back).toEqual(state)
    // чужой код отделки не проходит
    const bad = stateFromQuery(new URLSearchParams('f=corner&fc=zzz&tp=%3Cb%3E&hd=gun&o=999z'), new Set())
    expect(bad.facade).toBeUndefined()
    expect(bad.top).toBeUndefined()
    expect(stateFromQuery(new URLSearchParams('f=corner&sp=evil'), new Set()).splash).toBeUndefined()
    expect(bad.handle).toBeUndefined()
    expect(bad.arrangement).toBeUndefined()
  })
})

describe('проверка проекта', () => {
  const set = {
    fridge: appliance({ slot: 'fridge' }),
    dishwasher: appliance({ slot: 'dishwasher', w: 60, builtIn: true }),
    hob: appliance({ slot: 'hob', w: 60 }),
  }
  const pick = <K extends Check['id']>(list: Check[], id: K) => list.find((c) => c.id === id) as Extract<Check, { id: K }> | undefined
  /** Один ряд из модулей подряд: [вид, ширина]. */
  const row = (mods: [string, number][], window: Plan['window'] = null) => {
    let x = 0
    const modules = mods.map(([kind, w]) => {
      const m = { kind, x, w }
      x += w
      return m
    })
    return { runs: [{ id: 'A', ox: 0, oz: 0, rot: 0, len: x, modules, uppers: [] }], window, dropped: [] } as unknown as Plan
  }

  it('угловая кухня по умолчанию — удобная', () => {
    const list = checkProject(planKitchen({ shape: 'corner', a: 300, b: 240, c: 0, island: 0, ...set }, { shelves: false }))
    const tri = pick(list, 'triangle')!
    expect(tri.level).toBe('ok')
    expect(tri.sum).toBeLessThanOrEqual(790)
    expect(pick(list, 'hobSides')!.level).toBe('ok')
    expect(pick(list, 'sinkDw')!.level).toBe('ok')
    expect(pick(list, 'fits')!.level).toBe('ok')
  })

  it('тесная прямая кухня — треугольник слишком маленький, не всё влезло', () => {
    const list = checkProject(
      planKitchen({ shape: 'straight', a: 260, b: 0, c: 0, island: 0, ...set, arrangement: { A: ['hob', 'sink', 'dishwasher', 'fridge'] } }, { shelves: false }),
    )
    const tri = pick(list, 'triangle')!
    expect(tri.level).toBe('warn')
    expect(Math.min(...tri.legs)).toBeLessThan(115)
    expect(pick(list, 'fits')).toEqual({ id: 'fits', level: 'warn', count: 1 })
  })

  it('посудомойка далеко от мойки; за углом — считается рядом', () => {
    const far = checkProject(
      planKitchen({ shape: 'straight', a: 400, b: 0, c: 0, island: 0, ...set, arrangement: { A: ['sink', 'hob', 'fridge', 'dishwasher'] } }, { shelves: false }),
    )
    expect(pick(far, 'sinkDw')!.level).toBe('warn')
    expect(pick(far, 'sinkDw')!.gap).toBeGreaterThan(60)
    const corner = checkProject(
      planKitchen({ shape: 'corner', a: 300, b: 240, c: 0, island: 0, ...set, arrangement: { A: ['sink', 'hob', 'fridge'], B: ['dishwasher'] } }, { shelves: false }),
    )
    expect(pick(corner, 'sinkDw')!.level).toBe('ok')
  })

  it('плита у стены, вплотную к холодильнику и под окном', () => {
    const list = checkProject(
      row(
        [
          ['hob', 60],
          ['fridge', 60],
          ['doors', 60],
          ['sink', 60],
        ],
        { wall: 'back', at: 30, w: 100 },
      ),
    )
    expect(pick(list, 'hobSides')).toEqual({ id: 'hobSides', level: 'warn', left: 0, right: 0 })
    expect(pick(list, 'hobFridge')).toEqual({ id: 'hobFridge', level: 'warn', gap: 0 })
    expect(pick(list, 'hobWindow')?.level).toBe('warn')
  })

  it('столешница у плиты считается до мойки и высокого шкафа', () => {
    const list = checkProject(
      row([
        ['doors', 40],
        ['sink', 60],
        ['drawers', 20],
        ['hob', 60],
        ['drawers', 45],
        ['doors', 30],
        ['tall', 60],
      ]),
    )
    expect(pick(list, 'hobSides')).toEqual({ id: 'hobSides', level: 'warn', left: 20, right: 75 })
  })
})

describe('фото техники: снято спереди или «три четверти»', () => {
  // верх товара в каждом столбце, как его видит photo.ts
  const front = (n: number) => Array.from({ length: n }, (_, i) => (i < 3 || i > n - 4 ? 6 - Math.min(i, n - 1 - i) * 2 : 0))
  const withSide = (n: number, share: number, where: 'left' | 'right') => {
    const side = Math.round(n * share)
    const tops = Array.from({ length: n }, (_, i) => {
      const d = where === 'left' ? side - i : i - (n - 1 - side)
      return d > 0 ? Math.round(d * 0.5) : 0
    })
    // светлая линия на ребре между боковиной и фасадом
    tops[where === 'left' ? side : n - 1 - side] = 400
    return tops
  }

  it('ровно спереди, со скруглёнными углами — боковины нет', () => {
    expect(sideShare(front(300))).toBeLessThan(SIDE_SHARE)
  })

  it('боковина слева или справа — видна', () => {
    expect(sideShare(withSide(300, 0.22, 'left'))).toBeGreaterThanOrEqual(SIDE_SHARE)
    expect(sideShare(withSide(300, 0.22, 'right'))).toBeGreaterThanOrEqual(SIDE_SHARE)
  })

  it('кнопка или ручка на верхней кромке — не боковина', () => {
    const tops = front(300)
    for (let i = 200; i < 215; i++) tops[i] = -6
    expect(sideShare(tops)).toBeLessThan(SIDE_SHARE)
  })
})

describe('своё место и своя ширина', () => {
  const hob = appliance({ slot: 'hob', w: 60 })
  const dishwasher = appliance({ slot: 'dishwasher', w: 60, builtIn: true })
  const base = { shape: 'straight' as const, a: 400, b: 0, c: 0, island: 0, hob, dishwasher }
  const run = (plan: Plan, id = 'A') => plan.runs.find((r) => r.id === id)!
  /** ряд без щелей и нахлёстов, ровно во всю стену */
  const solid = (plan: Plan, id = 'A', start = 0, end?: number) => {
    const r = run(plan, id)
    let x = start
    for (const m of r.modules) {
      expect(m.x).toBeCloseTo(x, 3)
      x += m.w
    }
    expect(x).toBeCloseTo(end ?? r.length, 3)
  }

  it('мойка встаёт куда поставили, соседние шкафы подстраиваются', () => {
    const plan = planKitchen({ ...base, at: { sink: 150 } }, { shelves: false })
    expect(itemPositions(plan).sink!.center).toBe(150)
    solid(plan)
    // посудомойка по-прежнему вплотную к мойке — одна труба
    const mods = run(plan).modules
    const si = mods.findIndex((m) => m.kind === 'sink')
    expect(mods[si + 1].kind).toBe('dishwasher')
  })

  it('ближе 6 см к краю — встаёт вплотную, за край стены не уходит', () => {
    const two = { ...base, dishwasher: null, arrangement: { A: ['hob' as const, 'sink' as const] } }
    const snapped = planKitchen({ ...two, at: { sink: 367 } }, { shelves: false })
    expect(itemPositions(snapped).sink!.center).toBe(370)
    const outside = planKitchen({ ...two, at: { sink: 520 } }, { shelves: false })
    const mods = run(outside).modules
    expect(mods[mods.length - 1].kind).toBe('sink')
    solid(outside)
    const plan = planKitchen({ ...base, at: { sink: 34 } }, { shelves: false })
    expect(run(plan).modules[0].kind).toBe('sink')
    solid(plan)
  })

  it('у плиты с обеих сторон остаётся 30 см столешницы', () => {
    const plan = planKitchen({ ...base, arrangement: { A: ['sink', 'dishwasher', 'hob'] }, at: { sink: 30, hob: 160 } }, { shelves: false })
    const pos = itemPositions(plan)
    expect(pos.hob!.center - 30 - (pos.dishwasher!.center + 30)).toBeGreaterThanOrEqual(30)
    solid(plan)
  })

  it('своя ширина мойки и пенала; шкаф под плитой не уже панели', () => {
    const wide = appliance({ slot: 'hob', w: 88 })
    const plan = planKitchen({ ...base, hob: wide, pantries: 1, widths: { sink: 80, pantry: 45, hob: 60 } }, { shelves: false })
    const pos = itemPositions(plan)
    expect(pos.sink!.w).toBe(80)
    expect(pos.pantry!.w).toBe(45)
    expect(pos.hob!.w).toBe(90)
    solid(plan)
  })

  it('на боковой стене место считается от угла', () => {
    const plan = planKitchen({ shape: 'corner', a: 300, b: 260, c: 0, island: 0, hob, at: { hob: 170 } }, { shelves: false })
    const pos = itemPositions(plan)
    expect(pos.hob!.wall).toBe('B')
    expect(pos.hob!.center).toBe(170)
    // ряд у левой стены кончается у углового шкафа задней стены
    solid(plan, 'B', 0, 260 - DEPTH)
  })

  it('вместе с мойкой едет посудомойка, свои шкафы — каждый сам', () => {
    const plan = planKitchen(
      { ...base, cabinets: { k1: { w: 40, front: 'doors' }, k2: { w: 50, front: 'doors' } }, arrangement: { A: ['k1', 'k2', 'sink', 'dishwasher', 'hob'] } },
      { shelves: false },
    )
    expect(companions(plan, 'sink')).toEqual(['dishwasher'])
    expect(companions(plan, 'k2')).toEqual([])
  })

  it('пока тащат — видна свободная столешница по бокам', () => {
    const plan = planKitchen({ ...base, at: { sink: 150 } }, { shelves: false })
    const gaps = itemGaps(plan, 'sink')
    expect(gaps).toHaveLength(1)
    expect(gaps[0].w).toBeGreaterThan(0)
    const hobGaps = itemGaps(plan, 'hob')
    expect(hobGaps.length).toBeGreaterThanOrEqual(1)
  })

  it('в адресе: место и ширина туда и обратно', () => {
    const state = {
      ...DEFAULT_STATE,
      shape: 'straight' as const,
      a: 400,
      cabinets: { k1: { w: 45, front: 'drawers3' as const } },
      arrangement: { A: ['k1' as const, 'sink' as const, 'hob' as const] },
      at: { sink: 95, k1: 30, hob: 250 },
      widths: { sink: 80, pantry: 45 },
    }
    const q = queryFromState(state)
    expect(q).toContain('o=45h_030s_095h_250')
    expect(q).toContain('wd=s80p45')
    const back = stateFromQuery(new URLSearchParams(q), new Set())
    expect(back.at).toEqual({ k1: 30, sink: 95, hob: 250 })
    expect(back.widths).toEqual({ sink: 80, pantry: 45 })
    expect(back.cabinets).toEqual({ k1: { w: 45, front: 'drawers3' } })
    // чужое не проходит: ширина за пределами, мусор в позиции
    expect(stateFromQuery(new URLSearchParams('f=straight&wd=s999'), new Set()).widths).toEqual({ sink: 120 })
    expect(stateFromQuery(new URLSearchParams('f=straight&o=s_12'), new Set()).at).toBeUndefined()
  })
})
