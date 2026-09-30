import { describe, expect, it } from 'vitest'
import { grabOf, previewMove } from '@/lib/kitchen/drag'
import { addAt, addWidth, detachUppers, fitOn, itemPositions, moduleCenter, narrowNeighbour, pinCabinet, resolveArrangement, swapFit, moveToWall, narrowFor, needByWall, pinnedIds, pinWalls, placeAt, planKitchen, resizeWalls, squeezeGaps, UPPER_MIN, type Plan, type PlanInput, type Planner } from '@/lib/kitchen/layout'
import { checkProject, droppedName } from '@/lib/kitchen/checks'
import { makerList } from '@/components/kitchen/drawing'
import { kitchenTexts } from '@/components/kitchen/texts'
import { planInputOf, projectItems, projectTotal } from '@/lib/kitchen/order'
import { DEFAULT_STATE, queryFromState, stateFromQuery } from '@/lib/kitchen/share'
import type { ItemKey, KitchenAppliance, KitchenState, WallId } from '@/lib/kitchen/types'
import { readyKitchen } from '@/data/kitchen-ready'
import { products } from '@/data/products'
import { kitchenAppliances } from '@/lib/kitchen/catalog'
import { chosenItems } from '@/lib/kitchen/order'
import { getStyle } from '@/lib/kitchen/styles'

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

  it('пересечение с фиксированным соседом → снап к его краю (свой шкаф ≥ 30 у плиты — вплотную, он сам столешница)', () => {
    const { fit } = placeAt(base, 'k1', 'A', 255, planner)
    expect(fit).toMatchObject({ ok: true, center: 280, snap: 'neighbour' })
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
    expect(previewMove(plan, 'k1', 'A', 255, 0)).toMatchObject({ center: 280, snap: 'neighbour', labels: { left: 0, right: 30 } })
  })
  it('не помещается — красный вердикт с подсказкой, кого сузить', () => {
    expect(previewMove(plan, 'k2', 'A', 80, 0)).toMatchObject({ fits: false, need: 20, narrow: { neighbour: 'k1', by: 20 } })
  })
  it('точка захвата: шкаф взяли у края — он не прыгает', () => {
    // k1 стоит 100–160; взяли в 158 (у правого края), палец ушёл на 8 см влево → середина 122
    const grab = grabOf(plan, 'k1', 158)
    expect(grab).toBe(28)
    expect(previewMove(plan, 'k1', 'A', 150, grab)?.center).toBe(122)
    // без точки захвата шкаф прыгнул бы серединой под палец
    expect(previewMove(plan, 'k1', 'A', 150, 0)?.center).toBe(150)
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
  it('неопределённый размер не трогает стену: {a: 300, b: undefined} сохраняет длину B (ревью 05)', () => {
    const corner = { ...base, shape: 'corner' as const, b: 240 }
    const plan = planner(corner)
    const next = resizeWalls(corner, { a: 300, b: undefined }, plan)
    expect(next.a).toBe(300)
    expect(next.b).toBe(240)
    expect('b' in next && next.b !== undefined).toBe(true)
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

describe('заметки ревью таска 01', () => {
  const corner: KitchenState = { ...DEFAULT_STATE, shape: 'corner', a: 300, b: 240 }
  const rowOf = (p: Plan, wall: WallId) => p.runs.find((r) => r.id === wall)!.uppers.map((u) => [u.kind, Math.round(u.x * 10) / 10, Math.round(u.w * 10) / 10])

  it('detachUppers: добор автоматического ряда остаётся добором, а не шкафом с дверцей', () => {
    // в ряду A есть 10-см добор (как панель в углу): режем один шкаф автоматического ряда на шкаф и добор
    const p0 = planner(base)
    const run = A(p0)
    const i = run.uppers.findIndex((u) => u.kind === 'doors' && u.w >= 40)
    expect(i).toBeGreaterThanOrEqual(0)
    const u = run.uppers[i]
    const cut: Plan = { ...p0, runs: p0.runs.map((r) => (r.id !== 'A' ? r : { ...r, uppers: [...r.uppers.slice(0, i), { ...u, w: u.w - 10 }, { kind: 'filler', x: u.x + u.w - 10, w: 10 }, ...r.uppers.slice(i + 1)] })) }
    const next = detachUppers(base, 'A', cut)
    // ни одного «шкафа» уже минимальной ширины — добор в ряду остаётся добором
    for (const c of Object.values(next.upperCabs ?? {})) expect(c.w).toBeGreaterThanOrEqual(UPPER_MIN)
    expect(rowOf(planner(next), 'A')).toEqual(rowOf(cut, 'A'))
  })

  it('share: верхний шкаф уже 20 см в адресе ужимается до 20, а не до 2', () => {
    const s: KitchenState = { ...DEFAULT_STATE, shape: 'straight', a: 300, manualUppers: { A: ['u1'] }, upperCabs: { u1: { w: 15, kind: 'doors' } }, at: { u1: 30 } }
    const back = stateFromQuery(new URLSearchParams(queryFromState(s)), new Set<string>())
    expect(back.upperCabs?.u1?.w).toBe(UPPER_MIN)
  })

  it('подпись в движении не врёт: центр previewMove равен центру после placeAt', () => {
    const plan = planner(base)
    for (const cm of [33, 45, 70, 100, 128, 150, 255, 300, 340, 370, 395]) {
      const pv = previewMove(plan, 'k1', 'A', cm, 0)!
      const { fit } = placeAt(base, 'k1', 'A', cm, planner)
      expect(fit?.ok, `cm=${cm}`).toBe(pv.fits)
      if (pv.fits) expect(fit?.center, `cm=${cm}`).toBe(pv.center)
    }
  })

  it('ручной верх на стене B: середина от угла, в ряду — от зрителя к углу', () => {
    const manual: KitchenState = { ...corner, manualUppers: { B: ['u1'] }, upperCabs: { u1: { w: 60, kind: 'doors' } }, at: { u1: 150 } }
    const { state, fit } = placeAt(manual, 'u1', 'B', 100, planner)
    expect(fit).toMatchObject({ ok: true, wall: 'B', row: 'upper' })
    // к углу от 150: середина ≤ 100 (магнит к соседу может подвинуть), ряд B считает x от зрителя
    expect(fit!.center).toBeLessThanOrEqual(100)
    expect(fit!.center).toBeGreaterThanOrEqual(80)
    const p = planner(state)
    expect(itemPositions(p).u1).toEqual({ wall: 'B', center: fit!.center, w: 60, row: 'upper' })
    const u = p.runs.find((r) => r.id === 'B')!.uppers.find((x) => x.item === 'u1')!
    expect(u.x).toBe(240 - fit!.center - 30)
  })

  it('верхний шкаф на остров не встаёт', () => {
    const island: KitchenState = { ...DEFAULT_STATE, shape: 'island', a: 300, island: 300, arrangement: { A: ['sink', 'hob'] }, at: { sink: 30, hob: 200 } }
    const p0 = planner(island)
    const next = detachUppers(island, 'A', p0)
    const u = Object.keys(next.upperCabs ?? {})[0] as ItemKey
    const { state, fit } = placeAt(next, u, 'I', 150, planner)
    expect(fit?.ok).toBe(false)
    expect(state).toBe(next)
  })

  it('resizeWalls: верхний шкаф ручного ряда за краем придвигается к краю', () => {
    const next = detachUppers(base, 'A', planner(base))
    // u5 — последний шкаф ряда (340–400); стена 350 → он у края 290–350
    const p = itemPositions(planner(next))
    const last = (Object.keys(next.upperCabs ?? {}) as ItemKey[]).sort((a, b) => p[b]!.center - p[a]!.center)[0]
    const cut = resizeWalls(next, { a: 350 }, planner(next))
    expect(cut.at?.[last]).toBe(350 - p[last]!.w / 2)
    expect(cut.manualUppers?.A).toContain(last)
  })
})

describe('нехватка длины и неудачная постановка — не молча', () => {
  it('пустое место, которому не хватило стены, попадает в dropped, а не исчезает (ревью 15)', () => {
    // стена 300: мойка 60 + плита 60 с полями 30 + пусто 200 — на 20 см длиннее стены
    const s: KitchenState = { ...DEFAULT_STATE, shape: 'straight', a: 300, arrangement: { A: ['sink', 'g1', 'hob'] }, gaps: { g1: { w: 200 } }, at: { sink: 30, g1: 160, hob: 270 } }
    const plan = planner(s)
    expect(plan.dropped.map((d) => d.item)).toContain('g1')
    const g = plan.dropped.find((d) => d.item === 'g1')!
    expect(g.wall).toBe('A')
    expect(g.need).toBeGreaterThanOrEqual(1)
    // техника при этом на месте
    expect(itemPositions(plan).sink).toBeDefined()
    expect(itemPositions(plan).hob).toBeDefined()
    // пустое место ужимаемо — «удлините стену» из-за него не советуем
    expect(needByWall(plan)).toEqual({})
  })

  it('подпись выпавшего: пустое место — «пустое место» RU/KY, не «Пенал»', () => {
    const s: KitchenState = { ...DEFAULT_STATE, cabinets: { k1: { w: 45, front: 'doors' } } }
    const ru = kitchenTexts('ru')
    const ky = kitchenTexts('ky')
    expect(droppedName({ item: 'g1', need: 20, wall: 'A' }, s, ru)).toBe('пустое место')
    expect(droppedName({ item: 'g1', need: 20, wall: 'A' }, s, ky)).toBe('бош жер')
    expect(droppedName({ item: 'g1', need: 20, wall: 'A' }, s, ru)).not.toBe(ru.pantryName)
    expect(droppedName({ item: 'fridge', slot: 'fridge', need: 20, wall: 'A' }, s, ru)).toBe(ru.slots.fridge)
    expect(droppedName({ item: 'k1', need: 20, wall: 'A' }, s, ru)).toBe(ru.cabName(45))
    expect(droppedName({ item: 'pantry', need: 20, wall: 'A' }, s, ru)).toBe(ru.pantryName)
  })

  it('ширина кнопками: шкаф +5 при соседнем пустом месте 20 — место ужимается до 15, ничего не выпадает', () => {
    // стена 260 без запаса: мойка 0–60, пусто g1 60–80, свой шкаф k1 80–140, столешница 30, плита 170–230, столешница 30
    const s: KitchenState = {
      ...DEFAULT_STATE,
      shape: 'straight',
      a: 260,
      arrangement: { A: ['sink', 'g1', 'k1', 'hob'] },
      cabinets: { k1: { w: 60, front: 'doors' } },
      gaps: { g1: { w: 20 } },
      at: { sink: 30, g1: 70, k1: 110, hob: 200 },
    }
    const p0 = planner(s)
    expect(p0.dropped).toEqual([])
    expect(itemPositions(p0).g1?.w).toBe(20)
    const next = squeezeGaps(s, p0, 'k1', 65)
    const p1 = planner({ ...next, cabinets: { k1: { w: 65, front: 'doors' } } })
    expect(p1.dropped).toEqual([])
    expect(itemPositions(p1).g1?.w).toBe(15)
    expect(itemPositions(p1).k1?.w).toBe(65)
    // без ужатия рост шкафа (экран: все места заморожены, snap = []) роняет пустое место; с P3 свой шкаф сам — столешница
    // у варочной и может съесть её запас 30, поэтому рост берём больше запаса: +65 → по 32,5 в каждую сторону
    const frozen = Object.fromEntries(Object.entries(itemPositions(p0)).map(([k, p]) => [k, p!.center])) as KitchenState['at']
    expect(planner({ ...s, cabinets: { k1: { w: 125, front: 'doors' } }, at: frozen }, []).dropped.map((d) => d.item)).toContain('g1')
    // соседей-пустых мест нет — состояние то же
    expect(squeezeGaps(s, p0, 'hob', 60)).toBe(s)
  })

  it('addAt: не встало → key=null и fit с need > 0 (ревью 26); fill без пустого места — без fit', () => {
    // стена 130: мойка 60 + плита 60 — шкафу 60 места нет
    const tight: KitchenState = { ...DEFAULT_STATE, shape: 'straight', a: 130, arrangement: { A: ['sink', 'hob'] } }
    const r = addAt(tight, 'A', 65, 'doors', planner)
    expect(r.key).toBeNull()
    expect(r.state).toBe(tight)
    expect(r.fit?.ok).toBe(false)
    expect(r.fit?.need).toBeGreaterThanOrEqual(1)
    expect(addAt(tight, 'A', 65, 'fill', planner).fit).toBeUndefined()
  })
})

/**
 * P1 (находка критика, e2e на локальном каталоге): в `corner-300x240-marble` стена A —
 * угловой 100, автошкаф 82, мойка 60, автошкаф 58. Передвинул мойку — соседи
 * остаются своего вида и ширины: пересечение → «не помещается» с «Сузить», а
 * освобождённое место — пустое `gN`, не новый автошкаф.
 */
describe('перемещение: соседи не перестраиваются (P1)', () => {
  const catalog = kitchenAppliances(products)
  const known = new Map(catalog.map((a) => [a.id, a]))
  const live: Planner = (s, snap) => planKitchen(planInputOf(s, chosenItems(s.picks, catalog), snap), { shelves: getStyle(s.style).shelves })
  const marble = stateFromQuery(new URLSearchParams(readyKitchen('corner-300x240-marble')!.q), known)
  const kinds = (p: Plan, skip: ItemKey[] = ['sink']) => A(p).modules.filter((m) => !m.item || !skip.includes(m.item)).map((m) => `${m.kind}:${Math.round(m.w * 10) / 10}`)
  const upperCabs = (p: Plan) => A(p).uppers.filter((u) => u.kind === 'doors' || u.kind === 'shelf').length

  it('закрепление автошкафов стены не меняет картинку: те же виды и ширины, те же середины', () => {
    const p0 = live(marble, [])
    expect(kinds(p0)).toEqual(['corner:100', 'doors:82', 'doors:58'])
    const pinned = pinWalls(marble, p0, ['A'])
    const p1 = live(pinned, [])
    expect(kinds(p1)).toEqual(kinds(p0))
    expect(A(p1).modules.filter((m) => m.kind === 'doors').every((m) => m.item?.startsWith('k'))).toBe(true)
    expect(A(p1).uppers.map((u) => `${u.kind}:${u.x}:${u.w}`)).toEqual(A(p0).uppers.map((u) => `${u.kind}:${u.x}:${u.w}`))
  })

  it('мойка на 30 см влево или в конец стены: соседи молча не ужимаются — снап к краю соседа (домой), новых шкафов и пустых мест нет', () => {
    const p0 = live(marble, [])
    const pinned = pinWalls(marble, p0, ['A'])
    for (const cm of [182, 270]) {
      const { state, fit } = placeAt(pinned, 'sink', 'A', cm, live)
      expect(fit).toMatchObject({ ok: true, center: 212, snap: 'neighbour' })
      const p1 = live(state, [])
      expect(kinds(p1)).toEqual(['corner:100', 'doors:82', 'doors:58'])
      expect(A(p1).gaps ?? []).toEqual([])
      expect(upperCabs(p1)).toBe(upperCabs(p0))
    }
  })

  it('после «Сузить» 82 → 52: мойка встаёт, 58 и угловой те же, на освобождённом — пустое место 30, верх без новых шкафов', () => {
    const p0 = live(marble, [])
    const pinned = pinWalls(marble, p0, ['A'])
    const k82 = (Object.entries(pinned.cabinets ?? {}) as [ItemKey, { w: number }][]).find(([, c]) => c.w === 82)![0]
    const narrowed: KitchenState = { ...pinned, cabinets: { ...pinned.cabinets, [k82]: { ...pinned.cabinets![k82 as 'k1']!, w: 52 } }, at: { ...pinned.at, [k82]: 126 } }
    const { state, fit } = placeAt(narrowed, 'sink', 'A', 182, live)
    expect(fit?.ok).toBe(true)
    const p1 = live(state, [])
    expect(itemPositions(p1).sink).toEqual({ wall: 'A', center: 182, w: 60 })
    expect(kinds(p1)).toEqual(['corner:100', 'doors:52', 'doors:58'])
    expect(A(p1).gaps).toEqual([expect.objectContaining({ x: 212, w: 30, row: 'base' })])
    expect(upperCabs(p1)).toBeLessThanOrEqual(upperCabs(p0))
  })

  it('«На другую стену» — через placeAt: занятая стена → fit.ok=false и «Сузить», состояние прежнее; есть пустое место — встаёт в него', () => {
    // B 420 занята СВОИМИ шкафами покупателя (закреплены раньше) — они не уступают: мойка не встаёт, «Сузить» называет соседа
    const long: KitchenState = { ...marble, b: 420 }
    const own = pinWalls(long, live(long, []), ['B'])
    const busy = moveToWall(own, 'sink', 'B', live)
    expect(busy.fit?.ok).toBe(false)
    expect(busy.fit?.narrow).toMatchObject({ by: expect.any(Number) })
    expect(busy.state).toBe(own)
    // B 240: сузить некого (шкафы по 60, у варочной столешница) — тоже не встаёт, без «Сузить»
    const tight = moveToWall(marble, 'sink', 'B', live)
    expect(tight.fit).toMatchObject({ ok: false, narrow: null })
    expect(tight.state).toBe(marble)
    // на B вместо первых ящиков — пустое место 60
    const p0 = live(marble, [])
    const onB = pinWalls(long, live(long, []), ['B'])
    const B = (p: Plan) => p.runs.find((r) => r.id === 'B')!
    const first = B(live(onB, [])).modules.find((m) => m.item?.startsWith('k') && m.w >= 60)!.item as ItemKey
    const at: NonNullable<KitchenState['at']> = { ...onB.at, g1: onB.at![first]! }
    delete at[first]
    const cabinets = { ...onB.cabinets }
    delete cabinets[first as 'k1']
    const free: KitchenState = { ...onB, cabinets, gaps: { g1: { w: onB.cabinets![first as 'k1']!.w } }, at, arrangement: { ...onB.arrangement, B: onB.arrangement!.B!.map((k) => (k === first ? 'g1' : k)) } }
    const pf = live(free, [])
    const bFree = B(pf).gaps![0]
    const { state, fit } = moveToWall(free, 'sink', 'B', live)
    expect(fit?.ok).toBe(true)
    const p1 = live(state, [])
    expect(itemPositions(p1).sink).toMatchObject({ wall: 'B', w: 60 })
    // встала в пустое место B, а не поверх соседей
    const sx = B(p1).modules.find((m) => m.item === 'sink')!.x
    expect(sx).toBeGreaterThanOrEqual(bFree.x - 0.5)
    expect(sx + 60).toBeLessThanOrEqual(bFree.x + bFree.w + 0.5)
    // на A на месте мойки — пустое место 60, соседи прежние
    expect(kinds(p1)).toEqual(['corner:100', 'doors:82', 'doors:58'])
    expect(A(p1).gaps).toEqual([expect.objectContaining({ w: 60 })])
  })
  it('мягкие соседи (дозапрос): мойка на 30 см влево встаёт под палец, автососед 82 уступает ровно 30 → 52, угловой и 58 прежние', () => {
    const p0 = live(marble, [])
    const pinned = pinWalls(marble, p0, ['A'])
    const soft = pinnedIds(marble, pinned)
    expect(soft).toHaveLength(2)
    const { state, fit } = placeAt(pinned, 'sink', 'A', 182, live, 0, { soft })
    expect(fit?.ok).toBe(true)
    const p1 = live(state, [])
    expect(itemPositions(p1).sink).toEqual({ wall: 'A', center: 182, w: 60 })
    expect(kinds(p1)).toEqual(['corner:100', 'doors:52', 'doors:58'])
    expect(A(p1).gaps).toEqual([expect.objectContaining({ x: 212, w: 30, row: 'base' })])
    expect(upperCabs(p1)).toBeLessThanOrEqual(upperCabs(p0))
  })

  it('мягкие соседи: варочная с B на A стартовой кухни из автошкафов (70 + 70) встаёт в 160; ящики её бывшей зоны на B прежние', () => {
    const s = stateFromQuery(new URLSearchParams('f=corner&a=300&b=240&o=dwtpqfs_270.h_150v'), known)
    const p0 = live(s, [])
    // как на старте жеста: автошкафы обеих стен (зону столешницы варочной закрепит сама постановка)
    const pinned = pinWalls(s, p0, ['B', 'A'])
    const soft = pinnedIds(s, pinned)
    const { state, fit } = placeAt(pinned, 'hob', 'A', 160, live, 0, { soft })
    expect(fit?.ok).toBe(true)
    const p1 = live(state, [])
    expect(itemPositions(p1).hob).toEqual({ wall: 'A', center: 160, w: 60 })
    expect(p1.dropped).toEqual([])
    // A: столешница 100…220 (по бокам — автоящики зоны варочной) — первый 70 ушёл целиком, второй уступил 50 → остаток 20
    // уже CAB_MIN — не «Шкаф 20», а автозаполнение: вместе со столешницей у варочной это ящики 50 (P3)
    expect(kinds(p1)).toEqual(['corner:100', 'drawers:30', 'hob:60', 'drawers:50'])
    const B = p1.runs.find((r) => r.id === 'B')!
    expect(B.modules.map((m) => `${m.kind}:${m.w}`)).toEqual(['drawers:60', 'drawers:60'])
    // «На другую стену» — то же правило
    const moved = moveToWall(s, 'hob', 'A', live)
    expect(moved.fit?.ok).toBe(true)
    expect(itemPositions(live(moved.state, [])).hob?.wall).toBe('A')
  })

  it('варочная в пустое место другой стены: пустое место не заходит на её столешницу — встаёт, остаток пустым', () => {
    // A: угол 0…100, пустое место 100…240, мойка 240…300; варочная с B в 160 → панель 130…190, столешница 100…220
    const s = stateFromQuery(new URLSearchParams('f=corner&a=300&b=240&o=dwtpqf140g_170s_270.h_150v'), known)
    const pinned = pinWalls(s, live(s, []), ['B', 'A'])
    const { state, fit } = placeAt(pinned, 'hob', 'A', 160, live)
    expect(fit?.ok).toBe(true)
    const p1 = live(state, [])
    expect(itemPositions(p1).hob).toEqual({ wall: 'A', center: 160, w: 60 })
    expect(A(p1).gaps).toEqual([expect.objectContaining({ x: 220, w: 20, row: 'base' })])
    expect(p1.dropped).toEqual([])
  })
})

describe('доводка круг 2 (P3): обмен местами и остатки', () => {
  const catalog = kitchenAppliances(products)
  const known = new Map(catalog.map((a) => [a.id, a]))
  const live: Planner = (s, snap) => planKitchen(planInputOf(s, chosenItems(s.picks, catalog), snap), { shelves: getStyle(s.style).shelves })
  const marble = stateFromQuery(new URLSearchParams(readyKitchen('corner-300x240-marble')!.q), known)
  const run = (p: Plan, id: WallId) => p.runs.find((r) => r.id === id)!
  const row = (p: Plan, id: WallId) => run(p, id).modules.map((m) => `${m.item && !m.item.startsWith('k') ? m.item : m.kind}:${Math.round(m.w * 10) / 10}@${Math.round(m.x)}`)
  /** как на старте жеста: стены закреплены, мягкие — новые kN */
  const gesture = (walls: WallId[]) => {
    const pinned = pinWalls(marble, live(marble, []), walls)
    return { pinned, soft: pinnedIds(marble, pinned) }
  }
  const cabAt = (s: KitchenState, p: Plan, wall: WallId, x: number) => run(p, wall).modules.find((m) => Math.round(m.x) === x && m.item?.startsWith('k'))!.item as ItemKey

  it('A: шкаф 82 тянут на мойку → поменялись местами, ширины прежние', () => {
    const { pinned, soft } = gesture(['A'])
    const p0 = live(pinned, [])
    const k82 = cabAt(pinned, p0, 'A', 100)
    const { state, fit } = placeAt(pinned, k82, 'A', 212, live, 0, { soft })
    expect(fit).toMatchObject({ ok: true, swap: 'sink' })
    const p1 = live(state, [])
    expect(row(p1, 'A')).toEqual(['corner:100@0', 'sink:60@100', 'doors:82@160', 'doors:58@242'])
    expect(p1.dropped).toEqual([])
  })

  it('B: ящики 60 тянут на ящики 60 по ту сторону варочной (автошкаф) → поменялись местами, варочная на месте', () => {
    // как dragStart: взятый автошкаф становится kN на том же месте
    const p00 = live(marble, [])
    const B0 = run(p00, 'B')
    const m0 = B0.modules[0]
    const c0 = moduleCenter(B0, m0)
    const c2 = moduleCenter(B0, B0.modules[2])
    const pin = pinCabinet(resolveArrangement(marble.shape, marble.arrangement, marble.cabinets, marble.gaps), marble.cabinets ?? {}, { w: m0.w, front: 'drawers3' }, 'B', c0, itemPositions(p00))
    const at: NonNullable<KitchenState['at']> = { [pin.id]: c0 }
    for (const [k, p] of Object.entries(itemPositions(p00)) as [ItemKey, { center: number }][]) at[k] = p.center
    const s0: KitchenState = { ...marble, arrangement: pin.order, cabinets: pin.cabinets as KitchenState['cabinets'], at }
    const p0 = live(s0, [])
    expect(itemPositions(p0)[pin.id]).toMatchObject({ wall: 'B', center: c0 })
    const { state, fit } = placeAt(s0, pin.id, 'B', c2, live, 0)
    expect(fit).toMatchObject({ ok: true, swap: null })
    const p1 = live(state, [])
    expect(itemPositions(p1)[pin.id]).toMatchObject({ wall: 'B', center: c2, w: 60 })
    expect(itemPositions(p1).hob).toEqual(itemPositions(p0).hob)
    expect(run(p1, 'B').modules.map((m) => `${m.kind}:${m.w}`)).toEqual(['drawers:60', 'hob:60', 'drawers:60'])
    expect(p1.dropped).toEqual([])
  })

  it('предпросмотр обмена = вердикт placeAt: шкаф 60 на варочную B — рамка не зелёная, если постановка откажет', () => {
    const p00 = live(marble, [])
    const B0 = run(p00, 'B')
    const m2 = B0.modules[2]
    const c2 = moduleCenter(B0, m2)
    const hob = itemPositions(p00).hob!
    const pin = pinCabinet(resolveArrangement(marble.shape, marble.arrangement, marble.cabinets, marble.gaps), marble.cabinets ?? {}, { w: m2.w, front: 'drawers3' }, 'B', c2, itemPositions(p00))
    const at: NonNullable<KitchenState['at']> = { [pin.id]: c2 }
    for (const [k, p] of Object.entries(itemPositions(p00)) as [ItemKey, { center: number }][]) at[k] = p.center
    const s0: KitchenState = { ...marble, arrangement: pin.order, cabinets: pin.cabinets as KitchenState['cabinets'], at }
    const p0 = live(s0, [])
    const placed = placeAt(s0, pin.id, 'B', hob.center, live, 0)
    const pv = previewMove(p0, pin.id, 'B', hob.center, 0, { trial: { state: s0, planner: live } })
    expect(pv?.fits).toBe(Boolean(placed.fit?.ok))
    if (placed.fit?.ok) expect(pv?.center).toBe(placed.fit.center)
  })

  // жестом мойка на 82 теперь меняется с ним местами (P5); остаток 22 даёт «Сузить» 82 на 60
  const narrowed60 = () => {
    const { pinned } = gesture(['A'])
    const p0 = live(pinned, [])
    return narrowNeighbour(pinned, cabAt(pinned, p0, 'A', 100), 60, p0, 130)
  }
  it('«Сузить» 82 на 60 → остаток 22 — бутылочница (автозаполнение), не «Шкаф 22» с ящиками; верх — по UPPER_MIN', () => {
    const { state, fit } = placeAt(narrowed60(), 'sink', 'A', 130, live)
    expect(fit?.ok).toBe(true)
    const p1 = live(state, [])
    expect(row(p1, 'A')).toEqual(['corner:100@0', 'sink:60@100', 'bottle:22@160', 'doors:58@242'])
    // остаток — не свой шкаф: карточки с ящиками у него нет, в состоянии нет шкафа уже CAB_MIN
    expect(run(p1, 'A').modules.find((m) => m.kind === 'bottle')?.item).toBeUndefined()
    expect(Object.values(state.cabinets ?? {}).every((c) => c!.w >= 30)).toBe(true)
    // на прежнем месте мойки — пустое место 60
    expect(run(p1, 'A').gaps).toEqual([expect.objectContaining({ x: 182, w: 60, row: 'base' })])
    for (const u of run(p1, 'A').uppers) {
      if (u.kind === 'doors' || u.kind === 'shelf') expect(u.w).toBeGreaterThanOrEqual(UPPER_MIN)
      if (u.kind === 'filler') expect(u.w).toBeLessThan(UPPER_MIN)
    }
    expect(p1.dropped).toEqual([])
  })

  it('«Сузить» 82 на 60: остаток 22 уже CAB_MIN — шкаф уходит в автозаполнение, мойка встаёт, рядом бутылочница', () => {
    const { pinned } = gesture(['A'])
    const p0 = live(pinned, [])
    const k82 = cabAt(pinned, p0, 'A', 100)
    const s1 = narrowNeighbour(pinned, k82, 60, p0, 130)
    expect(s1.cabinets?.[k82 as 'k1']).toBeUndefined()
    const { state, fit } = placeAt(s1, 'sink', 'A', 130, live)
    expect(fit?.ok).toBe(true)
    expect(row(live(state, []), 'A')).toEqual(['corner:100@0', 'sink:60@100', 'bottle:22@160', 'doors:58@242'])
    // шире CAB_MIN — остаётся своим шкафом, прижат к дальнему краю
    const s2 = narrowNeighbour(pinned, k82, 30, p0, 130)
    expect(s2.cabinets?.[k82 as 'k1']?.w).toBe(52)
  })

  it('«Коротко» (makerList): мойка, бутылочница и планка — названиями, не голой шириной', () => {
    const { state } = placeAt(narrowed60(), 'sink', 'A', 130, live)
    const text = makerList(live(state, []), {}, kitchenTexts('ru'), [])
    const lines = text.split('\n')
    const lowA = lines[lines.indexOf(kitchenTexts('ru').wall('A', 300)) + 1]
    expect(lowA).toMatch(/Мойка 60/i)
    expect(lowA).toMatch(/бутылочница 22/)
    for (const cell of lowA.split(':').slice(1).join(':').split(' · ')) expect(cell.trim()).toMatch(/^\S.*\D.* \d+$/)
  })

  it('обмен не влезает (82 на 58 через мойку) → отказ, состояние прежнее', () => {
    const { pinned, soft } = gesture(['A'])
    const p0 = live(pinned, [])
    const k82 = cabAt(pinned, p0, 'A', 100)
    const { state, fit } = placeAt(pinned, k82, 'A', 271, live, 0, { soft })
    expect(fit?.ok).toBe(false)
    expect(fit?.swap).toBeUndefined()
    expect(state).toBe(pinned)
  })
})

/**
 * P1, меню «+»: в каждом пункте — ширина, которая встанет (как у `addAt`, без постановки).
 * Прямая 300: мойка 0…60, пустое место 60…100 (40 см), варочная 190…250.
 */
describe('ширина пункта меню «+» (P1)', () => {
  const catalog = kitchenAppliances(products)
  const known = new Map(catalog.map((a) => [a.id, a]))
  const live: Planner = (s, snap) => planKitchen(planInputOf(s, chosenItems(s.picks, catalog), snap), { shelves: getStyle(s.style).shelves })
  const gap40 = stateFromQuery(new URLSearchParams('f=straight&a=300&o=s_03040g_080h_220'), known)

  it('пустое место 40: шкаф с дверцами и с ящиками — 40, планка — 40; «заполнить» без ширины', () => {
    expect(addWidth(gap40, live(gap40, []), 'A', 80, 'doors')).toBe(40)
    expect(addWidth(gap40, live(gap40, []), 'A', 80, 'drawers')).toBe(40)
    expect(addWidth(gap40, live(gap40, []), 'A', 80, 'strip')).toBe(40)
    expect(addWidth(gap40, live(gap40, []), 'A', 80, 'fill')).toBeNull()
  })

  it('не встанет — ширины нет: «+» на варочной у правого края (190…250 + столешница до 280, до стены 20)', () => {
    expect(addWidth(gap40, live(gap40, []), 'A', 220, 'doors')).toBeNull()
  })
})


describe('столешница у варочной — одно правило для раскладки и fitOn (P4)', () => {
  // стена 400: k1 100–160, варочная 190–250, k2 340–400 (см. base)
  it('свой шкаф ≥ 30 — сам столешница: fitOn пускает его вплотную к варочной и варочную вплотную к нему', () => {
    const p = planner(base)
    // палец 165: край k1 зашёл бы на варочную (190) — встаёт вплотную, 130–190, а не за 30 см до неё
    expect(fitOn(p, 'k1', 'A', 165)?.center).toBe(160)
    // варочная у k2 (340): палец 305 → 275–335, до k2 5 см < SNAP — прилипает вплотную, 280–340
    expect(fitOn(p, 'hob', 'A', 305)?.center).toBe(310)
    // правило раскладки то же: такая постановка встаёт на своё место
    const { fit } = placeAt(base, 'k1', 'A', 160, planner)
    expect(fit?.ok).toBe(true)
    expect(itemPositions(planner({ ...base, at: { ...base.at, k1: 160 } })).k1?.center).toBe(160)
  })
})

/**
 * P5 (находки критика, круг 3; `corner-300x240-marble`): A — угловой 100, 82, мойка 60, 58;
 * B — ящики 60, варочная 60 (середина 150 от угла), ящики 60, над варочной вытяжка.
 */
describe('доводка круг 3 (P5): вытяжка не уезжает, мойка на 82 — обмен', () => {
  const catalog = kitchenAppliances(products)
  const known = new Map(catalog.map((a) => [a.id, a]))
  const live: Planner = (s, snap) => planKitchen(planInputOf(s, chosenItems(s.picks, catalog), snap), { shelves: getStyle(s.style).shelves })
  const marble = stateFromQuery(new URLSearchParams(readyKitchen('corner-300x240-marble')!.q), known)
  const run = (p: Plan, id: WallId) => p.runs.find((r) => r.id === id)!
  const mid = (r: { x: number; w: number }) => r.x + r.w / 2
  /** середина вытяжки минус середина варочной на стене B, см (в координатах ряда — у обоих одинаково) */
  const hoodOff = (p: Plan) => {
    const B = run(p, 'B')
    const hood = B.uppers.find((u) => u.kind === 'hood')
    const hob = B.modules.find((m) => m.kind === 'hob')!
    return hood ? mid(hood) - mid(hob) : NaN
  }

  it('верхний шкаф с A на B у угла: вытяжка над варочной (±1 см) или перенос не встаёт', () => {
    const p0 = live(marble, [])
    expect(hoodOff(p0)).toBe(0)
    // как на старте жеста: верх A — ручной, берём каждый его шкаф
    const s0 = detachUppers(marble, 'A', p0)
    const ups = (s0.manualUppers?.A ?? []).filter((k) => k.startsWith('u'))
    expect(ups.length).toBeGreaterThan(0)
    let tried = 0
    let placedOk = 0
    for (const u of ups)
      for (const cm of [45, 60, 75, 90, 100]) {
        const { state, fit } = placeAt(s0, u, 'B', cm, live, 0)
        tried++
        if (fit?.ok) placedOk++
        if (!fit?.ok) {
          expect(state).toBe(s0)
          continue
        }
        expect(Math.abs(hoodOff(live(state, [])))).toBeLessThanOrEqual(1)
      }
    expect(tried).toBeGreaterThan(0)
    // шкафы верха B уступают — перенос в свободную от вытяжки часть встаёт, а не только отказ
    expect(placedOk).toBeGreaterThan(0)
  })

  it('проверка проекта: вытяжка не над варочной → замечание, над ней — пункта нет', () => {
    const p0 = live(marble, [])
    expect(checkProject(p0).some((c) => c.id === 'hoodOffHob')).toBe(false)
    const moved: Plan = { ...p0, runs: p0.runs.map((r) => (r.id === 'B' ? { ...r, uppers: r.uppers.map((u) => (u.kind === 'hood' ? { ...u, x: u.x - 38 } : u)) } : r)) }
    const c = checkProject(moved).find((x) => x.id === 'hoodOffHob')
    expect(c).toMatchObject({ level: 'warn', off: 38 })
  })

  it('мойку тянут на шкаф 82 полной стены A (жест: мягкие соседи) → обмен, пустого места нет', () => {
    const pinned = pinWalls(marble, live(marble, []), ['A'])
    const soft = pinnedIds(marble, pinned)
    const row = (p: Plan) => run(p, 'A').modules.map((m) => `${m.item === 'sink' ? 'sink' : m.kind}:${Math.round(m.w)}@${Math.round(m.x)}`)
    // 82 стоит 100…182: палец левее и правее его середины
    for (const cm of [120, 130, 150, 165]) {
      const { state, fit } = placeAt(pinned, 'sink', 'A', cm, live, 0, { soft })
      expect(fit).toMatchObject({ ok: true, swap: expect.stringMatching(/^k\d+$/) })
      const p1 = live(state, [])
      expect(row(p1)).toEqual(['corner:100@0', 'sink:60@100', 'doors:82@160', 'doors:58@242'])
      expect(run(p1, 'A').gaps ?? []).toEqual([])
      expect(Object.keys(state.gaps ?? {}).filter((g) => (state.arrangement?.A ?? []).includes(g as ItemKey))).toEqual([])
      // предпросмотр — тот же вердикт
      const pv = previewMove(live(pinned, []), 'sink', 'A', cm, 0, { soft, trial: { state: pinned, planner: live } })
      expect(pv).toMatchObject({ fits: true, swap: fit!.swap, center: fit!.center })
    }
  })

  it('мойку тянут влево на 30…55 см: предпросмотр и отпускание — одно решение (обмен или уступка) и один центр', () => {
    const pinned = pinWalls(marble, live(marble, []), ['A'])
    const soft = pinnedIds(marble, pinned)
    const p0 = live(pinned, [])
    const c0 = itemPositions(p0).sink!.center
    const kinds = new Set<string>()
    for (let d = -30; d >= -55; d--) {
      const pv = previewMove(p0, 'sink', 'A', c0 + d, 0, { soft, trial: { state: pinned, planner: live } })!
      const { state, fit } = placeAt(pinned, 'sink', 'A', c0 + d, live, 0, { soft })
      expect({ d, fits: pv.fits, swap: pv.swap !== undefined }).toEqual({ d, fits: Boolean(fit?.ok), swap: fit?.swap !== undefined })
      if (fit?.ok) expect({ d, center: pv.center }).toEqual({ d, center: itemPositions(live(state, [])).sink!.center })
      kinds.add(pv.swap !== undefined ? 'swap' : 'yield')
    }
    // в диапазоне есть и то и другое — граница правда проверена
    expect([...kinds].sort()).toEqual(['swap', 'yield'])
  })

  it('жест: мойку на 40 см вправо — 58 уступает, остаток 18 < 30 не свой шкаф, а автозаполнение (бутылочница)', () => {
    const pinned = pinWalls(marble, live(marble, []), ['A'])
    const soft = pinnedIds(marble, pinned)
    // мойка 182…242 → 222…282: 58 (242…300) задет на 10 см — меньше четверти мойки, это уступка, не обмен
    const { state, fit } = placeAt(pinned, 'sink', 'A', 252, live, 0, { soft })
    expect(fit).toMatchObject({ ok: true, center: 252 })
    expect(fit!.swap).toBeUndefined()
    const p1 = live(state, [])
    expect(run(p1, 'A').modules.map((m) => `${m.item === 'sink' ? 'sink' : m.kind}:${Math.round(m.w)}@${Math.round(m.x)}`)).toEqual(['corner:100@0', 'doors:82@100', 'sink:60@222', 'bottle:18@282'])
    // своего шкафа шириной 18 нет — остаток отдан автозаполнению; освобождённое 182…222 — пустое место
    expect(Object.values(state.cabinets ?? {}).map((c) => c.w)).toEqual([82])
    expect((run(p1, 'A').gaps ?? []).map((g) => [Math.round(g.x), Math.round(g.w)])).toEqual([[182, 40]])
  })

  it('мойку только придвинули к 82 (на 30 см влево) — не обмен: 82 уступает ровно на сдвиг (P1 остаётся)', () => {
    const pinned = pinWalls(marble, live(marble, []), ['A'])
    const soft = pinnedIds(marble, pinned)
    // 181 — палец на сантиметр зашёл на 82 (пиксель пальца на телефоне)
    const { state, fit } = placeAt(pinned, 'sink', 'A', 181, live, 0, { soft })
    expect(fit).toMatchObject({ ok: true, center: 181 })
    expect(fit!.swap).toBeUndefined()
    expect(run(live(state, []), 'A').modules.map((m) => Math.round(m.w))).toEqual([100, 51, 60, 58])
  })
})
