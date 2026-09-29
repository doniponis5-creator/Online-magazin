import { describe, expect, it } from 'vitest'
import { grabOf, previewMove } from '@/lib/kitchen/drag'
import { addAt, detachUppers, itemPositions, narrowFor, placeAt, planKitchen, resizeWalls, type Plan, type PlanInput, type Planner } from '@/lib/kitchen/layout'
import { planInputOf, projectItems, projectTotal } from '@/lib/kitchen/order'
import { DEFAULT_STATE, queryFromState, stateFromQuery } from '@/lib/kitchen/share'
import type { ItemKey, KitchenAppliance, KitchenState } from '@/lib/kitchen/types'

/**
 * Модель расстановки — эволюция (спецификация §1, §2): пустое место `gN` —
 * модуль с `at` и шириной, которого нет в выгрузках; ручной верх `uN`;
 * постановка с точкой захвата. Швы: layout, drag, share.
 */

const hob = (w = 60): KitchenAppliance => ({ id: 'hb', slot: 'hob', name: 'hob', brand: '', price: 1, w, h: 5, d: 52, sizeKnown: true, builtIn: true, finish: 'black' })
const opts = { shelves: false }
const straight = (over: Partial<PlanInput> = {}): PlanInput => ({ shape: 'straight', a: 300, b: 0, c: 0, island: 0, hob: hob(), ...over })
const A = (p: Plan) => p.runs.find((r) => r.id === 'A')!
const planner: Planner = (s, snap) => planKitchen(planInputOf(s, { hob: hob() }, snap), opts)
/** Порядок стены без техники, которой в кухне нет (её раскладчик держит в порядке, как и экран). */
const present = (list: ItemKey[] | undefined, keys: ItemKey[]) => (list ?? []).filter((k) => keys.includes(k))
const OWN: ItemKey[] = ['sink', 'g1', 'g2', 'k1', 'hob', 'k2']

/**
 * Стена 400: мойка 0–60, пусто g1 60–100, свой шкаф k1 100–160, столешница
 * 160–190 (у плиты не меньше 30), плита 190–250, автошкаф 250–340, k2 340–400.
 */
const base: KitchenState = {
  ...DEFAULT_STATE,
  shape: 'straight',
  a: 400,
  arrangement: { A: ['sink', 'g1', 'k1', 'hob', 'k2'] },
  cabinets: { k1: { w: 60, front: 'doors' }, k2: { w: 60, front: 'doors' } },
  gaps: { g1: { w: 40 } },
  at: { sink: 30, g1: 80, k1: 130, hob: 220, k2: 370 },
}

describe('пустое место gN в раскладке', () => {
  it('gap — модуль в arrangement с at и шириной: в ряду пустой сегмент, itemPositions его возвращает', () => {
    const plan = planKitchen(
      straight({ arrangement: { A: ['sink', 'g1', 'k1', 'hob'] }, cabinets: { k1: { w: 60, front: 'doors' } }, gaps: { g1: { w: 40 } }, at: { sink: 30, g1: 80, k1: 130, hob: 220 } }),
      opts,
    )
    const pos = itemPositions(plan)
    expect(pos.g1).toEqual({ wall: 'A', center: 80, w: 40 })
    // модули ряда обходят пустое место: от 60 до 100 ничего не стоит
    expect(A(plan).modules.filter((m) => m.x < 100 - 0.01 && m.x + m.w > 60 + 0.01)).toEqual([])
    expect(pos.sink).toEqual({ wall: 'A', center: 30, w: 60 })
    expect(pos.k1).toEqual({ wall: 'A', center: 130, w: 60 })
    // пустое место лежит в ряду отдельно — 3D-сборка, спецификация, чертёж и раскрой ходят только по modules
    expect(A(plan).gaps).toEqual([{ x: 60, w: 40, item: 'g1', row: 'base' }])
    expect(A(plan).modules.some((m) => (m.kind as string) === 'gap')).toBe(false)
  })

  it('сумма техники не видит пустого места; ничего не выпадает', () => {
    const withGap = planner(base)
    const noGap = planner({ ...base, arrangement: { A: ['sink', 'k1', 'hob', 'k2'] }, gaps: undefined })
    const sum = (p: Plan) => projectTotal(projectItems(base, p, [hob()])).sum
    expect(sum(withGap)).toBe(sum(noGap))
    expect(withGap.dropped).toEqual([])
  })
})

describe('placeAt: постановка с точкой захвата', () => {
  it('снап к концу стены; сдвиг в пределах своей ширины не оставляет пустого места', () => {
    const { state, fit } = placeAt(base, 'sink', 'A', 33, planner)
    expect(fit).toMatchObject({ ok: true, center: 30, snap: 'wall' })
    expect(Object.keys(state.gaps ?? {})).toEqual(['g1'])
    expect(itemPositions(planner(state)).sink?.center).toBe(30)
  })

  it('центр = палец − grab; освобождённое место становится gap той же ширины', () => {
    // палец в 300, шкаф держат на 10 см левее середины → середина 310, вплотную к столешнице плиты
    const { state, fit } = placeAt(base, 'k1', 'A', 300, planner, -10)
    expect(fit).toMatchObject({ ok: true, center: 310, snap: 'neighbour' })
    const pos = itemPositions(planner(state))
    expect(pos.k1).toEqual({ wall: 'A', center: 310, w: 60 })
    // где стоял шкаф (100–160) — пусто 60 см, а не автошкаф
    expect(pos.g2).toEqual({ wall: 'A', center: 130, w: 60 })
    expect(state.gaps?.g2).toEqual({ w: 60 })
    expect(present(state.arrangement?.A, OWN)).toEqual(['sink', 'g1', 'g2', 'hob', 'k1', 'k2'])
    // остальные на месте
    expect(pos.sink?.center).toBe(30)
    expect(pos.hob?.center).toBe(220)
    expect(pos.k2?.center).toBe(370)
  })

  it('пересечение с фиксированным соседом → снап к его краю (у плиты — к краю её столешницы)', () => {
    const { fit } = placeAt(base, 'k1', 'A', 255, planner)
    expect(fit).toMatchObject({ ok: true, center: 310, snap: 'neighbour' })
  })

  it('не помещается → fit.ok=false с need и narrow, состояние не меняется', () => {
    // k2 (60) в пустое место 40 между мойкой и шкафом k1
    const { state, fit } = placeAt(base, 'k2', 'A', 80, planner)
    expect(state).toBe(base)
    expect(fit).toMatchObject({ ok: false, need: 20, narrow: { neighbour: 'k1', by: 20 } })
    expect(narrowFor(planner(base), 'k2', 'A', 80)).toEqual({ neighbour: 'k1', by: 20 })
    // сузить некого — narrow null
    const tight: KitchenState = {
      ...base,
      cabinets: { k1: { w: 15, front: 'doors' }, k2: { w: 60, front: 'doors' } },
      gaps: { g1: { w: 30 } },
      at: { sink: 30, g1: 75, k1: 97.5, hob: 220, k2: 370 },
    }
    expect(placeAt(tight, 'k2', 'A', 75, planner).fit).toMatchObject({ ok: false, need: 30, narrow: null })
  })

  it('на другую стену: мойка с A на B, на A остаётся пусто 60', () => {
    // левая стена 300: угол занят рядом A (0–60), плита в 240 (210–270, столешница 30 с обеих сторон) → мойке есть место 60–180
    const corner: KitchenState = { ...DEFAULT_STATE, shape: 'corner', a: 300, b: 300, arrangement: { B: ['hob'] }, at: { hob: 240 } }
    const before = itemPositions(planner(corner)).sink!
    expect(before.wall).toBe('A')
    const { state, fit } = placeAt(corner, 'sink', 'B', 150, planner)
    expect(fit).toMatchObject({ ok: true, center: 150, snap: 'neighbour' })
    const pos = itemPositions(planner(state))
    expect(pos.sink).toEqual({ wall: 'B', center: 150, w: 60 })
    expect(pos.hob).toEqual({ wall: 'B', center: 240, w: 60 })
    expect(pos.g1).toEqual({ wall: 'A', center: before.center, w: 60 })
  })

  it('высокий модуль на остров → fit.ok=false, состояние не меняется (audit-move п. 8)', () => {
    const island: KitchenState = { ...DEFAULT_STATE, shape: 'island', a: 300, island: 180, pantries: 1 }
    const { state, fit } = placeAt(island, 'pantry', 'I', 90, planner)
    expect(state).toBe(island)
    expect(fit).toMatchObject({ ok: false })
    expect(state.at).toBeUndefined()
  })
})

describe('addAt: «+» на пустом месте', () => {
  it('шкаф встаёт в пустое место его шириной', () => {
    const { state, key } = addAt(base, 'A', 80, 'doors', planner)
    expect(key).toBe('k3')
    expect(state.cabinets?.k3).toEqual({ w: 40, front: 'doors' })
    expect(state.gaps?.g1).toBeUndefined()
    expect(itemPositions(planner(state)).k3).toEqual({ wall: 'A', center: 80, w: 40 })
  })
  it('ящики — то же, но с ящиками', () => {
    const { state, key } = addAt(base, 'A', 80, 'drawers', planner)
    expect(key).toBe('k3')
    expect(state.cabinets?.k3?.front).toBe('drawers3')
  })
  it('«заполнить автоматически» убирает пустое место — его закрывают автошкафы', () => {
    const { state } = addAt(base, 'A', 80, 'fill', planner)
    expect(state.gaps).toBeUndefined()
    expect(present(state.arrangement?.A, OWN)).toEqual(['sink', 'k1', 'hob', 'k2'])
    const plan = planner(state)
    expect(A(plan).gaps).toBeUndefined()
    expect(A(plan).modules.some((m) => m.x < 100 - 0.01 && m.x + m.w > 60 + 0.01 && !m.item)).toBe(true)
  })
  it('планка закрывает пустое место, оно остаётся пустым местом', () => {
    const { state, key } = addAt(base, 'A', 80, 'strip', planner)
    expect(key).toBe('g1')
    expect(state.gaps?.g1).toEqual({ w: 40, strip: true })
  })
  it('пенал: в узкое место между фиксированными не встаёт, в свободное — встаёт и не оставляет за собой пустого места', () => {
    expect(addAt(base, 'A', 80, 'pantry', planner).key).toBeNull()
    const { state, key } = addAt(base, 'A', 300, 'pantry', planner)
    expect(key).toBe('pantry')
    expect(state.pantries).toBe(1)
    expect(itemPositions(planner(state)).pantry).toEqual({ wall: 'A', center: 310, w: 60 })
    expect(Object.keys(state.gaps ?? {})).toEqual(['g1'])
  })
  it('техника «сюда»: мойка в свободное место, на её месте — пусто', () => {
    const { state, key } = addAt(base, 'A', 300, 'sink', planner)
    expect(key).toBe('sink')
    const pos = itemPositions(planner(state))
    expect(pos.sink).toEqual({ wall: 'A', center: 310, w: 60 })
    expect(pos.g2).toEqual({ wall: 'A', center: 30, w: 60 })
  })
})

describe('detachUppers: ручной верх', () => {
  it('верхний ряд стены → ручной: uN с at, картинка та же, placeAt для uN работает, вытяжка не двигается', () => {
    const p0 = planner(base)
    const next = detachUppers(base, 'A', p0)
    // дыра над пустым местом низа становится пустым местом верха — картинка не меняется
    expect(next.manualUppers?.A).toEqual(['u1', 'g2', 'u2', 'u3', 'u4', 'u5'])
    expect(next.upperCabs?.u1).toEqual({ w: 60, kind: 'doors' })
    expect(next.gaps?.g2).toEqual({ w: 40 })
    expect(next.at?.u1).toBe(30)
    const p1 = planner(next)
    const pos1 = itemPositions(p1)
    expect(pos1.u1).toEqual({ wall: 'A', center: 30, w: 60, row: 'upper' })
    expect(pos1.g2).toEqual({ wall: 'A', center: 80, w: 40, row: 'upper' })
    expect(A(p1).uppers.map((u) => [u.kind, u.x, u.w])).toEqual(A(p0).uppers.map((u) => [u.kind, u.x, u.w]))
    // сдвинуть u1 к соседу u2: середина 70, вытяжка на месте, низ не тронут
    const { state, fit } = placeAt(next, 'u1', 'A', 70, planner)
    expect(fit).toMatchObject({ ok: true, center: 70, snap: 'neighbour', row: 'upper' })
    const p2 = planner(state)
    expect(itemPositions(p2).u1).toEqual({ wall: 'A', center: 70, w: 60, row: 'upper' })
    const hood = A(p2).uppers.find((u) => u.kind === 'hood')!
    expect([hood.x, hood.w]).toEqual([190, 60])
    expect(itemPositions(p2).k1?.center).toBe(130)
    expect(detachUppers(state, 'A', p2)).toBe(state)
  })

  it('верхний шкаф уносят — на его месте пусто (в верхнем ряду), пустое место под ним ужимается', () => {
    const next = detachUppers(base, 'A', planner(base))
    // u3 (30 см, 160–190) — в дыру 60–100: прилипает к u1, 60–90
    const { state, fit } = placeAt(next, 'u3', 'A', 80, planner)
    expect(fit).toMatchObject({ ok: true, center: 75, snap: 'neighbour' })
    const pos = itemPositions(planner(state))
    expect(pos.u3).toEqual({ wall: 'A', center: 75, w: 30, row: 'upper' })
    expect(pos.g3).toEqual({ wall: 'A', center: 175, w: 30, row: 'upper' })
    expect(pos.g2).toEqual({ wall: 'A', center: 95, w: 10, row: 'upper' })
  })
})

describe('drag.previewMove: одна модель для 3D и плана', () => {
  const plan = planner(base)
  it('снап к стене и подписи «до угла / до соседа»', () => {
    expect(previewMove(plan, 'sink', 'A', 33, 0)).toEqual({ center: 30, width: 60, wall: 'A', fits: true, snap: 'wall', labels: { left: 0, right: 40 }, narrow: null, need: 0 })
  })
  it('снап к соседу', () => {
    expect(previewMove(plan, 'k1', 'A', 255, 0)).toMatchObject({ center: 310, snap: 'neighbour', labels: { left: 0, right: 0 } })
  })
  it('не помещается — красный вердикт с подсказкой, кого сузить', () => {
    expect(previewMove(plan, 'k2', 'A', 80, 0)).toMatchObject({ fits: false, need: 20, narrow: { neighbour: 'k1', by: 20 } })
  })
  it('точка захвата: шкаф взяли у края — он не прыгает', () => {
    // k1 стоит 100–160; взяли в 158 (у правого края), палец ушёл на 8 см влево → середина 122
    const grab = grabOf(plan, 'k1', 158)
    expect(grab).toBe(28)
    expect(previewMove(plan, 'k1', 'A', 150, grab)?.center).toBe(122)
    // без точки захвата шкаф прыгнул бы серединой под палец (и упёрся в столешницу плиты)
    expect(previewMove(plan, 'k1', 'A', 150, 0)?.center).toBe(130)
  })
  it('в плане — ещё к краям противоположного ряда', () => {
    const island: KitchenState = {
      ...DEFAULT_STATE,
      shape: 'island',
      a: 300,
      island: 300,
      arrangement: { A: ['sink', 'hob'], I: ['k1'] },
      cabinets: { k1: { w: 60, front: 'doors' } },
      at: { sink: 30, hob: 200, k1: 150 },
    }
    const p = planner(island)
    // остров и стена смотрят друг на друга: правый край плиты (230 от угла) — это 300 − 230 = 70 в координатах острова; k1 левым краем к нему → середина 100
    expect(previewMove(p, 'k1', 'I', 104, 0, { opposite: true })).toMatchObject({ center: 100, snap: 'opposite' })
    expect(previewMove(p, 'k1', 'I', 104, 0)?.snap).toBeNull()
  })
})

describe('ширина стены меняется — места сохраняются', () => {
  it('at и gap остаются; предмет за краем придвигается к краю', () => {
    const plan = planner(base)
    const same = resizeWalls(base, { a: 400 }, plan)
    expect(same.at).toEqual(base.at)
    expect(same.gaps).toEqual(base.gaps)
    const shorter = resizeWalls(base, { a: 300 }, plan)
    expect(shorter.a).toBe(300)
    expect(shorter.at).toEqual({ sink: 30, g1: 80, k1: 130, hob: 220, k2: 270 })
  })
  it('gap за пределами стены ужимается до края или убирается', () => {
    const plan = planner(base)
    const cut = resizeWalls(base, { a: 95 }, plan)
    expect(cut.gaps?.g1).toEqual({ w: 35 })
    expect(cut.at?.g1).toBe(77.5)
    const gone = resizeWalls(base, { a: 60 }, plan)
    expect(gone.gaps).toBeUndefined()
    expect(present(gone.arrangement?.A, OWN)).toEqual(['sink', 'k1', 'hob', 'k2'])
  })
})

describe('share: пустые места и ручной верх в адресе', () => {
  const roundTrip = (s: KitchenState) => stateFromQuery(new URLSearchParams(queryFromState(s)), new Set<string>())
  it('gap — в порядке стены («40g_080»), круговой тест', () => {
    const q = new URLSearchParams(queryFromState(base))
    expect(q.get('o')).toBe('s_03040g_08060o_130h_22060o_370')
    expect(q.get('u')).toBeNull()
    const back = roundTrip(base)
    expect(back.gaps).toEqual({ g1: { w: 40 } })
    expect(back.arrangement).toEqual(base.arrangement)
    expect(back.at).toEqual(base.at)
    expect(back.manualUppers).toBeUndefined()
  })
  it('планка и ручной верх (u=) — необязательны и возвращаются как были', () => {
    const state: KitchenState = {
      ...base,
      gaps: { g1: { w: 40, strip: true }, g2: { w: 90 } },
      manualUppers: { A: ['u1', 'g2', 'u2'] },
      upperCabs: { u1: { w: 60, kind: 'doors' }, u2: { w: 62.5, kind: 'shelf' } },
      at: { ...base.at, u1: 30, g2: 295, u2: 131.5 },
    }
    const q = new URLSearchParams(queryFromState(state))
    expect(q.get('o')).toBe('s_03040x_08060o_130h_22060o_370')
    expect(q.get('u')).toBe('600d_0300900g_2950625s_1315')
    const back = roundTrip(state)
    expect(back.gaps).toEqual(state.gaps)
    expect(back.manualUppers).toEqual(state.manualUppers)
    expect(back.upperCabs).toEqual(state.upperCabs)
    expect(back.at).toEqual(state.at)
  })
  it('старый адрес без g/u открывается как прежде; мусор в u= отбрасывается', () => {
    const old = stateFromQuery(new URLSearchParams('f=straight&a=400&o=s_095d60ok1'), new Set())
    expect(old.gaps).toBeUndefined()
    expect(old.manualUppers).toBeUndefined()
    expect(old.upperCabs).toBeUndefined()
    const junk = stateFromQuery(new URLSearchParams('f=straight&a=400&u=<script>'), new Set())
    expect(junk.manualUppers).toBeUndefined()
    const empty = stateFromQuery(new URLSearchParams('f=straight&a=400&u=~'), new Set())
    expect(empty.manualUppers).toEqual({ A: [] })
  })
})
