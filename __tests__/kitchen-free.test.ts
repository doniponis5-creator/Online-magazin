import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import './helpers/canvas'
import { PlanSketch } from '@/components/kitchen/PlanSketch'
import { buildKitchen, type BuildInput } from '@/components/kitchen/three/build'
import { elevationSvg, islandOverhang, makerList, planSvg, windowFor, type DrawingLabels } from '@/components/kitchen/drawing'
import { kitchenTexts } from '@/components/kitchen/texts'
import { products } from '@/data/products'
import { kitchenAppliances } from '@/lib/kitchen/catalog'
import { checkProject } from '@/lib/kitchen/checks'
import { cutParts, nest } from '@/lib/kitchen/cutting'
import { WINDOW } from '@/lib/kitchen/dims'
import { baseKey, upperKey } from '@/lib/kitchen/fronts'
import {
  carryCornerFronts,
  emptyRoom,
  freeAdd,
  freeAddUpper,
  freeCorner,
  freeFill,
  freeMoveUpper,
  freePlaceUpper,
  freeReflow,
  freeRemove,
  freeResizeUpper,
  freeRemoveUpper,
  freeUppersOverLower,
  leaveRoom,
  lowerGaps,
  reshapeRoom,
  roomFromKitchen,
  type FreeAdd,
} from '@/lib/kitchen/free'
import { CORNER_W, DEPTH, freeRunRange, itemPositions, planKitchen, wallsOf, type Plan } from '@/lib/kitchen/layout'
import { estimate, emptyMaster } from '@/lib/kitchen/master'
import { chosenItems, planInputOf, projectItems, projectTotal } from '@/lib/kitchen/order'
import { DEFAULT_STATE, queryFromState, stateFromQuery } from '@/lib/kitchen/share'
import { getStyle, getTone, STYLES } from '@/lib/kitchen/styles'
import { SLOTS, type BaseFront, type FixedItem, type FreeWall, type KitchenAppliance, type KitchenState, type Shape, type WallId } from '@/lib/kitchen/types'
import live from './fixtures/kitchen-live-appliances.json'

/**
 * «Пустая комната» (PRO, docs/PLAN_KITCHEN_EMPTY_ROOM.md): раскладка planFree,
 * действия free.ts, ссылка, 3D-спецификация, чертёж, список мастеру, раскрой и
 * смета — на 400 случайных комнатах, собранных теми же действиями, что и экран.
 */

const liveList = live.appliances as KitchenAppliance[]
const liveIds = new Set(liveList.map((a) => a.id))
const catalog: KitchenAppliance[] = [...kitchenAppliances(products).filter((a) => !liveIds.has(a.id)), ...liveList]
const known = new Map(catalog.map((a) => [a.id, a]))

const planOf = (s: KitchenState, snap: string[] = []): Plan =>
  planKitchen(planInputOf(s, chosenItems(s.picks, catalog), snap as never), { shelves: getStyle(s.style).shelves })

const room = (shape: Shape, over: Partial<KitchenState> = {}): KitchenState => emptyRoom({ ...DEFAULT_STATE, shape, a: 320, b: 260, c: 240, island: 200, ...over })

const add = (s: KitchenState, wall: WallId, what: FreeAdd): KitchenState => {
  const r = freeAdd(s, planOf(s), planOf, wall, what)
  if ('fail' in r) throw new Error(`${wall}: ${JSON.stringify(what)} → ${JSON.stringify(r)}`)
  return r.state
}
const cab = (w: number, front: BaseFront = 'doors'): FreeAdd => ({ kind: 'cabinet', w, front })
const item = (key: FixedItem): FreeAdd => ({ kind: 'item', key })

/** Модули ряда не пересекаются и стоят в пределах ряда. */
function assertLaid(plan: Plan, label: string) {
  for (const run of plan.runs) {
    const mods = [...run.modules].sort((p, q) => p.x - q.x)
    const [lo, hi] = freeRunRange(run)
    for (let i = 0; i < mods.length; i++) {
      const m = mods[i]
      expect(Number.isFinite(m.x) && Number.isFinite(m.w), `${label} ${run.id}: число`).toBe(true)
      expect(m.x, `${label} ${run.id}: ${m.kind} левее ряда`).toBeGreaterThanOrEqual((m.kind === 'corner' ? 0 : lo) - 0.01)
      expect(m.x + m.w, `${label} ${run.id}: ${m.kind} правее ряда`).toBeLessThanOrEqual((m.kind === 'corner' ? run.length : hi) + 0.01)
      if (i > 0) expect(m.x, `${label} ${run.id}: ${mods[i - 1].kind} и ${m.kind} пересеклись`).toBeGreaterThanOrEqual(mods[i - 1].x + mods[i - 1].w - 0.01)
    }
    const ups = [...run.uppers].sort((p, q) => p.x - q.x)
    for (let i = 1; i < ups.length; i++) expect(ups[i].x, `${label} ${run.id}: верх пересёкся`).toBeGreaterThanOrEqual(ups[i - 1].x + ups[i - 1].w - 0.01)
  }
}

function labelsFor(lang: 'ru' | 'ky'): DrawingLabels {
  const t = kitchenTexts(lang)
  return { cm: t.cm, appliance: (slot) => t.techShort[slot as keyof typeof t.techShort] ?? slot, ...t.drawing }
}

function built(state: KitchenState) {
  const style = getStyle(state.style)
  const plan = planOf(state)
  const project = projectItems(state, plan, catalog)
  const items: BuildInput['items'] = {}
  for (const slot of SLOTS) items[slot] = null
  for (const i of project) {
    if (i.status === 'placed' || i.status === 'underHob') items[i.slot] = i.appliance
    else if (i.status === 'typical') items[i.slot] = undefined
  }
  const b = buildKitchen({
    plan,
    style,
    tone: getTone(style, state.tone),
    items,
    photos: new Map(),
    evening: false,
    room: { ceiling: state.ceiling ?? 270, toCeiling: !state.lowUppers },
    fronts: state.fronts ?? {},
    columns: state.heights,
    tallBase: state.tallBase,
    doorsRight: state.doorsRight,
    detail: 0.5,
  })
  const spec = b.spec
  const hoodOver = b.hoodOver
  b.dispose()
  return { plan, project, items, spec, hoodOver }
}

describe('пустая комната: раскладка', () => {
  it('пустые стены каждой формы: ряды есть, модулей нет, комната как у обычной', () => {
    for (const shape of ['straight', 'corner', 'u', 'island'] as Shape[]) {
      const s = room(shape)
      const plan = planOf(s)
      expect(plan.free).toBe(true)
      expect(plan.runs.map((r) => r.id)).toEqual(shape === 'island' ? ['A', 'I'] : wallsOf(shape))
      expect(plan.runs.every((r) => r.modules.length === 0 && r.uppers.length === 0)).toBe(true)
      const rules = planOf(leaveRoom(s))
      expect(plan.room).toEqual(rules.room)
      expect(plan.dropped).toEqual([])
      // техники на стенах нет — варочная, вытяжка, духовка не в сумме
      expect(plan.unplaced).toEqual(expect.arrayContaining(['hob', 'hood', 'oven']))
      expect(projectTotal(projectItems(s, plan, catalog)).sum).toBe(0)
    }
  })

  it('одинокий холодильник: без столешницы; в сумме — только он', () => {
    const s = add(room('straight'), 'A', item('fridge'))
    const { plan, project, spec } = built(s)
    expect(plan.runs[0].modules.map((m) => m.kind)).toEqual(['fridge'])
    expect(spec.runs[0].tops).toEqual([])
    const fridge = project.find((i) => i.slot === 'fridge')!
    expect(fridge.status).toBe('placed')
    expect(projectTotal(project).sum).toBe(fridge.appliance!.price)
    expect(plan.unplaced).toEqual(expect.arrayContaining(['hob', 'oven', 'hood']))
  })

  it('духовка: свой шкаф → колонна → под варочной; некуда — не в кухне', () => {
    let s = add(room('straight'), 'A', item('hob'))
    let plan = planOf(s)
    expect(plan.runs[0].modules.find((m) => m.kind === 'hob')!.oven).toBe(true)
    s = add(s, 'A', item('tall'))
    plan = planOf(s)
    expect(plan.runs[0].modules.find((m) => m.kind === 'tall')!.oven).toBe(true)
    expect(plan.runs[0].modules.find((m) => m.kind === 'hob')!.oven).toBe(false)
    s = add(s, 'A', item('oven'))
    plan = planOf(s)
    expect(plan.runs[0].modules.some((m) => m.kind === 'oven')).toBe(true)
    expect(plan.runs[0].modules.find((m) => m.kind === 'tall')!.oven).toBe(false)
    const bare = freeRemove(freeRemove(freeRemove(s, 'hob'), 'tall'), 'oven')
    expect(planOf(bare).unplaced).toContain('oven')
  })

  it('два предмета на одно место: второй встаёт вплотную; не влезло — «не поместилось» с нехваткой', () => {
    let s = room('straight', { a: 200 })
    s = add(s, 'A', cab(60))
    s = add(s, 'A', cab(60))
    const plan = planOf(s)
    const [m1, m2] = plan.runs[0].modules
    expect(m2.x).toBeCloseTo(m1.x + m1.w, 5)
    // свободно 80 — шкаф 90 не встаёт
    const fail = freeAdd(s, plan, planOf, 'A', cab(90))
    expect(fail).toEqual({ fail: 'noRoom', free: 80 })
    // та же середина у двух: второй — в ближайшем свободном месте
    const same = { ...s, at: { ...s.at, k2: s.at!.k1 } }
    const p2 = planOf(same)
    assertLaid(p2, 'same')
    expect(p2.dropped).toEqual([])
    // стена стала короче: шкафы не пропадают молча — «не поместилось»
    const short = planOf({ ...s, a: 180, at: { k1: 30, k2: 150 } })
    assertLaid(short, 'short')
    expect(short.runs[0].modules.length + short.dropped.length).toBe(2)
  })

  it('пустое место заполняется полками ровно по ширине; шире 120 — несколькими; уже 15 — нельзя', () => {
    let s = room('straight', { a: 300 })
    s = add(s, 'A', cab(60))
    s = { ...s, at: { k1: 30 } }
    s = add(s, 'A', cab(60))
    s = { ...s, at: { ...s.at, k2: 110 } } // между шкафами 20 см: 60–80
    const gap = lowerGaps(s, planOf(s), 'A').find(([a]) => a < 100)!
    expect(gap).toEqual([60, 80])
    const one = freeFill(s, planOf, 'A', gap)
    expect('state' in one).toBe(true)
    const p1 = planOf((one as { state: KitchenState }).state)
    assertLaid(p1, 'fill20')
    expect(p1.runs[0].modules.find((m) => m.x === 60)).toMatchObject({ w: 20, front: 'open' })
    // хвост стены 140..300 = 160 см → два шкафа по 80
    const tail = freeFill(s, planOf, 'A', [140, 300])
    const p2 = planOf((tail as { state: KitchenState }).state)
    assertLaid(p2, 'fill160')
    expect(p2.runs[0].modules.filter((m) => m.x >= 140).map((m) => m.w)).toEqual([80, 80])
    expect(freeFill(s, planOf, 'A', [60, 70])).toEqual({ fail: 'noRoom', free: 10 })
  })

  it('шире — растёт на месте, соседи отодвигаются; места нет — не меняется (не перескакивает)', () => {
    let s = room('straight', { a: 200 })
    s = add(s, 'A', cab(60))
    s = add(s, 'A', cab(25, 'open'))
    s = add(s, 'A', cab(60))
    // 0–60, 60–85, 85–145; свободно 145–200
    const plan = planOf(s)
    const centers = freeReflow({ ...s, cabinets: { ...s.cabinets, k2: { w: 30, front: 'open' } } }, plan, 'A', { key: 'k2', w: 30 })!
    expect(centers).toEqual({ k1: 30, k2: 75, k3: 120 })
    const grown = planOf({ ...s, cabinets: { ...s.cabinets, k2: { w: 30, front: 'open' } }, at: { ...s.at, ...centers } })
    assertLaid(grown, 'grown')
    expect(grown.runs[0].modules.map((m) => [m.item, m.x, m.w])).toEqual([
      ['k1', 0, 60],
      ['k2', 60, 30],
      ['k3', 90, 60],
    ])
    // стена кончилась: 60 + 90 + 60 > 200 — не помещается, ничего не двигаем
    expect(freeReflow({ ...s, cabinets: { ...s.cabinets, k2: { w: 90, front: 'open' } } }, plan, 'A', { key: 'k2', w: 90 })).toBeNull()
    // угловой шире — ряд у угла отодвигается
    let c = freeCorner(room('corner', { a: 300 }), 'start', true)
    c = add(c, 'A', cab(60))
    const pc = planOf(c)
    expect(pc.runs[0].modules[1].x).toBe(100)
    const wide = { ...c, free: { ...c.free, cornerW: { start: 120 } } }
    expect(freeReflow(wide, pc, 'A')).toEqual({ k1: 150 })
  })

  it('двигают кнопкой на 5 см — не прилипает обратно; ближе 3 см к соседу — встаёт вплотную', () => {
    let s = room('straight', { a: 300 })
    s = add(s, 'A', cab(60))
    s = add(s, 'A', cab(60))
    const [k1, k2] = planOf(s).runs[0].modules
    expect(k2.x).toBeCloseTo(k1.x + k1.w, 5)
    // k2 отодвинули на 5 см — так и стоит
    const c2 = k2.x + k2.w / 2
    const away = planOf({ ...s, at: { ...s.at, k2: c2 + 5 } }, ['k2']).runs[0].modules[1]
    expect(away.x).toBeCloseTo(k1.x + k1.w + 5, 5)
    // поставили в 2 см от соседа — прилип
    const near = planOf({ ...s, at: { ...s.at, k2: c2 + 2 } }, ['k2']).runs[0].modules[1]
    expect(near.x).toBeCloseTo(k1.x + k1.w, 5)
    // двигаемый уступает стоящему: k2 на место k1 — встаёт рядом, k1 не сдвигается
    const onTop = planOf({ ...s, at: { ...s.at, k2: s.at!.k1 } }, ['k2']).runs[0].modules
    expect(onTop.find((m) => m.item === 'k1')!.x).toBeCloseTo(k1.x, 5)
    assertLaid(planOf({ ...s, at: { ...s.at, k2: s.at!.k1 } }, ['k2']), 'onTop')
  })

  it('угол: угловой шкаф на A, B начинается за глубиной ряда; шкаф в углу без углового — предупреждение', () => {
    let s = room('corner')
    s = freeCorner(s, 'start', true)
    s = add(s, 'B', cab(60))
    let plan = planOf(s)
    expect(plan.runs[0].modules[0]).toMatchObject({ kind: 'corner', x: 0, w: CORNER_W, blindAt: 'start' })
    expect(plan.runs[0].uppers[0]).toMatchObject({ kind: 'corner' })
    const b = plan.runs.find((r) => r.id === 'B')!
    expect(b.modules[0].x + b.modules[0].w).toBeLessThanOrEqual(b.length - DEPTH + 0.01)
    expect(checkProject(plan).some((c) => c.id === 'cornerBlocked')).toBe(false)
    // без углового: шкаф A в углу + шкаф B вплотную — дверцу A не открыть
    s = freeCorner(s, 'start', false)
    s = add(s, 'A', cab(60))
    plan = planOf({ ...s, at: { ...s.at, k2: 30 } })
    expect(checkProject(plan).find((c) => c.id === 'cornerBlocked')).toMatchObject({ level: 'warn', wall: 'B' })
  })

  it('окно режет верх над угловым, как у обычной кухни: верх не заходит в окно', () => {
    let s = freeCorner(room('corner', { a: 300 }), 'start', true)
    s = add(s, 'A', item('sink'))
    s = { ...s, at: { sink: 130 } }
    const plan = planOf(s)
    const win = plan.window!
    const [w0, w1] = [win.at - win.w / 2, win.at + win.w / 2]
    expect(w0).toBeLessThan(CORNER_W)
    const ups = plan.runs[0].uppers
    for (const u of ups) expect(u.x + u.w <= w0 + 0.01 || u.x >= w1 - 0.01, `${u.kind} ${u.x}+${u.w} в окне ${w0}–${w1}`).toBe(true)
    expect(ups[0]).toMatchObject({ kind: 'corner', x: 0, blindAt: 'start' })
    expect(ups[0].w).toBeCloseTo(w0, 5)
  })

  it('угловой шкаф: своя ширина 90–130 (и в ссылке), фасады по выбору, глухая часть без соседа закрыта', () => {
    let s = freeCorner(room('corner', { a: 300 }), 'start', true)
    s = { ...s, free: { ...s.free, cornerW: { start: 120 } } }
    let plan = planOf(s)
    expect(plan.runs[0].modules[0]).toMatchObject({ kind: 'corner', x: 0, w: 120 })
    s = add(s, 'A', cab(60))
    expect(planOf(s).runs[0].modules[1].x).toBeGreaterThanOrEqual(120 - 0.01)
    const q = queryFromState(s)
    expect(q).toMatch(/fk=s120/)
    expect(stateFromQuery(new URLSearchParams(q), known).free?.cornerW).toEqual({ start: 120 })
    expect(stateFromQuery(new URLSearchParams(q.replace('fk=s120', 'fk=s200')), known).free?.cornerW).toEqual({ start: 130 })
    // глухая часть: у стены B ничего — закрыта фасадом-панелью; поставили шкаф на B вплотную к углу — панели нет
    const fronts = (st: KitchenState) => built(st).spec.runs.find((r) => r.id === 'A')!.fronts.filter((f) => f.x < 60).length
    const open = fronts(s)
    const b = add(s, 'B', cab(60))
    const bAt = planOf(b).runs.find((r) => r.id === 'B')!.modules[0]
    expect(bAt.x + bAt.w).toBeCloseTo(planOf(b).runs.find((r) => r.id === 'B')!.length - DEPTH, 5)
    expect(fronts(b)).toBe(open - 1)
    // фасады углового — как у обычного шкафа: ящики вместо дверцы (и у обычной кухни тоже)
    plan = planOf(s)
    const key = `A${Math.round(plan.runs[0].modules[0].x)}`
    const drawers = built({ ...s, fronts: { [key]: 'drawers3' } }).spec.runs[0].fronts.filter((f) => f.hinge === 'drawer' && f.x < 120)
    expect(drawers).toHaveLength(3)
    const rules: KitchenState = { ...DEFAULT_STATE, fronts: { A0: 'drawers3' } }
    expect(built(rules).spec.runs[0].fronts.filter((f) => f.hinge === 'drawer' && f.x < 100)).toHaveLength(3)
  })

  it('колонна с духовкой: нижний шкаф ниже — духовка ниже, колонна той же высоты; «tb=» в ссылке', () => {
    const base: KitchenState = { ...DEFAULT_STATE, tallOven: true }
    const ovenBox = (st: KitchenState) => built(st).spec.runs.flatMap((r) => r.boxes).find((b) => b.slot === 'oven')!
    const tallBox = (st: KitchenState) => built(st).spec.runs.flatMap((r) => r.boxes).find((b) => b.kind === 'tall')!
    expect(ovenBox(base).y).toBeCloseTo(83, 1)
    const low: KitchenState = { ...base, tallBase: 60 }
    expect(ovenBox(low).y).toBeCloseTo(60, 1)
    expect(tallBox(low).h).toBeCloseTo(tallBox(base).h, 1)
    const q = queryFromState(low)
    expect(q).toMatch(/tb=60/)
    expect(stateFromQuery(new URLSearchParams(q), known).tallBase).toBe(60)
    expect(queryFromState(base)).not.toMatch(/tb=/)
    expect(stateFromQuery(new URLSearchParams(q.replace('tb=60', 'tb=5')), known).tallBase).toBe(40)
    // низ колонны — ящиками или полками; в ссылке «fx=tallh»
    const lowFronts = (st: KitchenState) => {
      const run = built(st).spec.runs.find((r) => r.boxes.some((b) => b.kind === 'tall'))!
      const col = run.boxes.find((b) => b.kind === 'tall')!
      return run.fronts.filter((f) => f.y < 60 && f.x >= col.x - 0.5 && f.x + f.w <= col.x + col.w + 0.5)
    }
    const drawers: KitchenState = { ...low, fronts: { tall: 'drawers3' } }
    expect(lowFronts(drawers).filter((f) => f.hinge === 'drawer')).toHaveLength(3)
    expect(lowFronts({ ...low, fronts: { tall: 'open' } })).toHaveLength(0)
    const fq = queryFromState(drawers)
    expect(fq).toMatch(/fx=tallh/)
    expect(stateFromQuery(new URLSearchParams(fq), known).fronts).toEqual({ tall: 'drawers3' })
    // верх колонны — свой выбор: стекло наверху, низ остаётся дверцей («fx=tallupg»)
    const glassTop: KitchenState = { ...low, fronts: { tallup: 'glass' } }
    const colFronts = (st: KitchenState) => {
      const run = built(st).spec.runs.find((r) => r.boxes.some((b) => b.kind === 'tall'))!
      const col = run.boxes.find((b) => b.kind === 'tall')!
      return run.fronts.filter((f) => f.x >= col.x - 0.5 && f.x + f.w <= col.x + col.w + 0.5)
    }
    expect(colFronts(glassTop).some((f) => f.glass && f.y > 100)).toBe(true)
    expect(colFronts(glassTop).filter((f) => f.y < 60)).toEqual(colFronts(low).filter((f) => f.y < 60))
    expect(queryFromState(glassTop)).toMatch(/fx=tallupg/)
    expect(stateFromQuery(new URLSearchParams(queryFromState(glassTop)), known).fronts).toEqual({ tallup: 'glass' })
    // один большой ящик — у колонны («talle») и у своего шкафа («60e»)
    const one: KitchenState = { ...low, fronts: { tall: 'drawers1' } }
    expect(lowFronts(one).filter((f) => f.hinge === 'drawer')).toHaveLength(1)
    expect(queryFromState(one)).toMatch(/fx=talle/)
    let s = add(room('straight', { a: 300 }), 'A', cab(60, 'drawers1'))
    expect(queryFromState(s)).toMatch(/o=60e_030/)
    s = stateFromQuery(new URLSearchParams(queryFromState(s)), known)
    expect(s.cabinets?.k1?.front).toBe('drawers1')
    const fronts = built(s).spec.runs[0].fronts.filter((f) => f.hinge === 'drawer')
    expect(fronts).toHaveLength(1)
  })

  it('другая форма: добавили остров — стена A та же, остров пустой и на него ставят; сняли стену — её шкафы ушли, техника ждёт', () => {
    let s = add(room('straight', { a: 400 }), 'A', item('tall'))
    s = add(s, 'A', item('sink'))
    s = add(s, 'A', cab(60, 'drawers3'))
    s = add(s, 'A', item('fridge'))
    const up = freeAddUpper(s, planOf(s), 'A', 60)
    if ('fail' in up) throw new Error('верх')
    s = up.state
    s = { ...s, fronts: { ...s.fronts, tallup: 'mirror' } }
    const before = planOf(s)
    const { state: isl, dropped } = reshapeRoom(s, 'island')
    expect(dropped).toBe(0)
    expect(isl.shape).toBe('island')
    const after = planOf(isl)
    const lay = (p: Plan, id: string) => {
      const run = p.runs.find((r) => r.id === id)!
      return { mods: run.modules.map((m) => [m.kind, m.item, m.x, m.w]), ups: run.uppers.map((u) => [u.kind, u.x, u.w]) }
    }
    expect(lay(after, 'A')).toEqual(lay(before, 'A'))
    expect(isl.fronts).toEqual(s.fronts)
    expect(after.runs.find((r) => r.id === 'I')?.modules.filter((m) => m.item) ?? []).toHaveLength(0)
    // на остров — шкаф и варочная
    let withI = add(isl, 'I', cab(80, 'drawers3'))
    withI = add(withI, 'I', item('hob'))
    const i = planOf(withI).runs.find((r) => r.id === 'I')!
    expect(i.modules.filter((m) => m.item)).toHaveLength(2)
    assertLaid(planOf(withI), 'остров')
    expect(stateFromQuery(new URLSearchParams(queryFromState(withI)), known).arrangement).toEqual(withI.arrangement)
    // остров убрали — снова прямая: остров ушёл, варочная выбрана, но не стоит
    const back = reshapeRoom(withI, 'straight')
    expect(back.dropped).toBe(2)
    expect(back.state.arrangement?.I).toBeUndefined()
    expect(Object.keys(back.state.cabinets ?? {})).toHaveLength(Object.keys(s.cabinets ?? {}).length)
    expect(lay(planOf(back.state), 'A')).toEqual(lay(before, 'A'))
    // угловая → прямая: угловой шкаф и стена B уходят, фасады стены B — тоже
    let c = freeCorner(room('corner', { a: 320, b: 260 }), 'start', true)
    c = add(c, 'B', cab(60))
    const bKey = baseKey('B', planOf(c).runs.find((r) => r.id === 'B')!.modules.find((m) => m.item)!.x)
    c = { ...c, fronts: { ...c.fronts, [bKey]: 'drawers1' } }
    const flat = reshapeRoom(c, 'straight')
    expect(flat.dropped).toBe(1)
    expect(flat.state.free?.corners).toBeUndefined()
    expect(flat.state.fronts?.[bKey]).toBeUndefined()
    expect(planOf(flat.state).runs.flatMap((r) => r.modules).some((m) => m.kind === 'corner')).toBe(false)
  })

  it('обеденный стол на 4/6/8: не лезет на шкафы и остров, комната вмещает, в ссылке «dn», в раскрой не идёт', () => {
    /** прямоугольник на полу, см: [x0, z0, x1, z1] */
    const footprint = (p: Plan) =>
      p.runs.flatMap((run) =>
        run.modules.map((m) => {
          const cos = Math.cos(run.rot)
          const sin = Math.sin(run.rot)
          const pts = [[m.x, 0], [m.x + m.w, 0], [m.x + m.w, DEPTH], [m.x, DEPTH]].map(([x, z]) => [run.ox + x * cos + z * sin, run.oz - x * sin + z * cos])
          return [Math.min(...pts.map((q) => q[0])), Math.min(...pts.map((q) => q[1])), Math.max(...pts.map((q) => q[0])), Math.max(...pts.map((q) => q[1]))]
        }),
      )
    const kitchens: KitchenState[] = [
      DEFAULT_STATE,
      { ...DEFAULT_STATE, shape: 'straight', a: 300 },
      { ...DEFAULT_STATE, shape: 'island', a: 400, island: 180 },
      { ...DEFAULT_STATE, shape: 'u', a: 320, b: 260, c: 240 },
      add(room('corner', { a: 320, b: 260 }), 'B', cab(60)),
      add(room('island', { a: 360 }), 'I', cab(80)),
    ]
    for (const k of kitchens)
      for (const [seats, turn] of [[4, 0], [6, 0], [8, 0], [4, 30], [6, 90], [8, 135], [8, 359]] as const) {
        const st: KitchenState = { ...k, dining: seats, ...(turn ? { diningTurn: turn } : {}) }
        const p = planOf(st)
        const d = p.dining!
        expect(d.seats).toBe(seats)
        expect(d.turn).toBe(turn)
        const a = (d.rot * Math.PI) / 180
        const [sw, sd] = [d.w + 2 * d.ends * 55, d.d + 110]
        const wx = (sw * Math.abs(Math.cos(a)) + sd * Math.abs(Math.sin(a))) / 2
        const dz = (sw * Math.abs(Math.sin(a)) + sd * Math.abs(Math.cos(a))) / 2
        const set = [d.x - wx, d.z - dz, d.x + wx, d.z + dz]
        for (const f of footprint(p)) {
          const apart = set[0] >= f[2] || set[2] <= f[0] || set[1] >= f[3] || set[3] <= f[1]
          expect(apart, `${k.shape} ${seats}: стол на шкафу ${JSON.stringify(f)} / ${JSON.stringify(set)}`).toBe(true)
        }
        // у острова стулья: стол дальше их (70 см за спинкой острова)
        if (p.island && p.runs.find((r) => r.id === 'I')?.modules.length) expect(set[1]).toBeGreaterThanOrEqual(p.island.z + 70)
        expect(p.room.d).toBeGreaterThanOrEqual(set[3])
        // без стола — всё как было; стол в раскрой и в фасады не идёт
        expect(planOf(k).dining).toBeUndefined()
        expect(p.runs).toEqual(planOf(k).runs)
        const back = stateFromQuery(new URLSearchParams(queryFromState(st)), known)
        expect(back.dining).toBe(seats)
        expect(back.diningTurn).toBe(turn || undefined)
      }
    const withTable = built({ ...DEFAULT_STATE, dining: 8 }).spec
    const without = built(DEFAULT_STATE).spec
    expect(cutParts(withTable, { tone: getTone(getStyle(DEFAULT_STATE.style), 0) })).toEqual(cutParts(without, { tone: getTone(getStyle(DEFAULT_STATE.style), 0) }))
    expect(new URLSearchParams(queryFromState(DEFAULT_STATE)).has('dn')).toBe(false)
    expect(stateFromQuery(new URLSearchParams('f=corner&dn=5'), known).dining).toBeUndefined()
    // поворот стола без стола — не пишется и не читается
    expect(queryFromState({ ...DEFAULT_STATE, diningTurn: 30 })).not.toMatch(/dt=/)
    expect(stateFromQuery(new URLSearchParams('f=corner&dt=30'), known).diningTurn).toBeUndefined()
    expect(() => built({ ...DEFAULT_STATE, dining: 6, diningTurn: 45 })).not.toThrow()
  })

  it('ссылка пустой комнаты не затирает холодильник («fr» — холодильник, комната — «er»); старые «fr=1» открываются', () => {
    const fridge = liveList.find((a) => a.slot === 'fridge')!
    const s = { ...add(room('straight', { a: 300 }), 'A', item('fridge')), picks: { fridge: fridge.id } }
    const q = queryFromState(s)
    expect(new URLSearchParams(q).get('fr')).toBe(fridge.id)
    const back = stateFromQuery(new URLSearchParams(q), known)
    expect(back.picks.fridge).toBe(fridge.id)
    expect(back.free).toBeDefined()
    // без холодильника («-») — тоже переживает ссылку
    expect(stateFromQuery(new URLSearchParams(queryFromState({ ...s, picks: { fridge: null } })), known).picks.fridge).toBeNull()
    // ссылка, сделанная до переименования
    const legacy = stateFromQuery(new URLSearchParams('f=straight&a=300&s=marble&o=f-0150&fr=1'), known)
    expect(legacy.free).toBeDefined()
    expect(legacy.arrangement?.A).toEqual(['fridge'])
  })

  it('поворот острова: ряд I крутится вокруг своей середины, места модулей те же; 360° = 0; в ссылке «it», чертёж — без NaN', () => {
    let s = add(room('island', { a: 400, island: 200 }), 'I', cab(80, 'drawers3'))
    s = add(s, 'I', item('sink'))
    s = add(s, 'A', item('fridge'))
    const flat = planOf(s)
    const iOf = (p: Plan) => p.runs.find((r) => r.id === 'I')!
    const center = (p: Plan) => {
      const run = iOf(p)
      const isl = p.island!
      // середина острова со свесом — в координатах ряда: вдоль ряда w/2, вглубь DEPTH - d/2
      const x = isl.w / 2
      const z = DEPTH - isl.d / 2
      return [run.ox + x * Math.cos(run.rot) + z * Math.sin(run.rot), run.oz - x * Math.sin(run.rot) + z * Math.cos(run.rot)]
    }
    for (const deg of [1, 45, 90, 180, 271]) {
      const p = planOf({ ...s, islandTurn: deg })
      expect(p.island?.turn).toBe(deg)
      expect(iOf(p).rot).toBeCloseTo(iOf(flat).rot + (deg * Math.PI) / 180, 6)
      expect(iOf(p).modules).toEqual(iOf(flat).modules)
      const [cx, cz] = center(p)
      const [fx, fz] = center(flat)
      expect(cx).toBeCloseTo(fx, 6)
      expect(cz).toBeCloseTo(fz, 6)
      expect(p.runs.filter((r) => r.wall)).toEqual(flat.runs.filter((r) => r.wall))
      const q = queryFromState({ ...s, islandTurn: deg })
      expect(q).toMatch(new RegExp(`it=${deg}$`))
      expect(stateFromQuery(new URLSearchParams(q), known).islandTurn).toBe(deg)
      const svg = planSvg(p, { cm: 'см', ...kitchenTexts('ru').plan }, { runs: built({ ...s, islandTurn: deg }).spec.runs })
      expect(svg).not.toMatch(/NaN/)
      expect(svg).toContain('<polygon')
      expect(() => checkProject(p, {})).not.toThrow()
      expect(() => built({ ...s, islandTurn: deg })).not.toThrow()
    }
    expect(planOf({ ...s, islandTurn: 360 }).runs).toEqual(flat.runs)
    expect(stateFromQuery(new URLSearchParams(`${queryFromState(s)}&it=-90`), known).islandTurn).toBe(270)
    // не остров — поворота нет ни в ссылке, ни в раскладке
    const straight = { ...room('straight', { a: 300 }), islandTurn: 45 }
    expect(queryFromState(straight)).not.toMatch(/it=/)
    expect(planOf(straight).runs).toEqual(planOf({ ...straight, islandTurn: undefined }).runs)
  })

  it('свой верх переехал (сдвиг, перенос, ширина) — фасад и сторона открывания едут за ним; убрали — его фасад забыт', () => {
    let s = room('straight', { a: 320, noWindow: true })
    const r = freeAddUpper(s, planOf(s), 'A', 60)
    if ('fail' in r) throw new Error('верх')
    s = r.state
    const keyOf = (st: KitchenState) => {
      const run = planOf(st).runs.find((x) => x.id === 'A')!
      const u = run.uppers.find((x) => x.kind === 'doors')!
      return upperKey('A', u.x)
    }
    const k0 = keyOf(s)
    s = { ...s, fronts: { [k0]: 'glass' }, doorsRight: [k0] }
    const po = (st: KitchenState) => planOf(st)
    // сдвиг на 5 см
    const moved = freeMoveUpper(s, planOf(s), 'A', 0, 5, po)!
    const k1 = keyOf(moved)
    expect(k1).not.toBe(k0)
    expect(moved.fronts).toEqual({ [k1]: 'glass' })
    expect(moved.doorsRight).toEqual([k1])
    expect(built(moved).spec.runs.flatMap((x) => x.fronts).filter((f) => f.glass)).toHaveLength(built(s).spec.runs.flatMap((x) => x.fronts).filter((f) => f.glass).length)
    // перенесли мышью
    const placed = freePlaceUpper(moved, planOf(moved), 'A', 0, 'A', 250, po)
    if ('fail' in placed) throw new Error('перенос')
    expect(placed.state.fronts).toEqual({ [keyOf(placed.state)]: 'glass' })
    // шире — начало сдвинулось
    const wide = freeResizeUpper(placed.state, planOf(placed.state), 'A', 0, 80, po)
    if ('fail' in wide) throw new Error('ширина')
    expect(wide.state.fronts).toEqual({ [keyOf(wide.state)]: 'glass' })
    // без planOf — как раньше (ключи не трогаются)
    expect(freeMoveUpper(s, planOf(s), 'A', 0, 5)!.fronts).toEqual(s.fronts)
    // убрали — запись о фасаде не остаётся следующему шкафу на этом месте
    const gone = freeRemoveUpper(wide.state, 'A', 0, planOf(wide.state))
    expect(gone.fronts).toBeUndefined()
    expect(gone.doorsRight).toBeUndefined()
  })

  it('угловой у конца стены A шире / стена длиннее — фасад углового едет за ним', () => {
    const s0 = freeCorner(room('u', { a: 320 }), 'end', true)
    const cornerKey = (st: KitchenState) => {
      const m = planOf(st).runs.find((r) => r.id === 'A')!.modules.find((x) => x.kind === 'corner' && x.blindAt === 'end')!
      return baseKey('A', m.x)
    }
    const k0 = cornerKey(s0)
    const s = { ...s0, fronts: { [k0]: 'drawers3' as const } }
    const wider = { ...s, free: { ...s.free, cornerW: { end: 110 } } }
    const carried = carryCornerFronts(s, wider, planOf(s), planOf(wider))
    expect(cornerKey(wider)).not.toBe(k0)
    expect(carried.fronts).toEqual({ [cornerKey(wider)]: 'drawers3' })
    const longer = { ...s, a: 360 }
    expect(carryCornerFronts(s, longer, planOf(s), planOf(longer)).fronts).toEqual({ [cornerKey(longer)]: 'drawers3' })
  })

  it('вышли из пустой комнаты — стена A не короче, чем нужно форме по правилам', () => {
    const short = reshapeRoom(room('straight', { a: 200 }), 'u').state
    expect(short.a).toBe(200)
    const back = leaveRoom(short)
    expect(back.a).toBeGreaterThanOrEqual(280)
    expect(stateFromQuery(new URLSearchParams(queryFromState(back)), known).a).toBe(back.a)
  })

  it('эскиз сверху: повёрнутый остров — повёрнутой группой, без NaN; прямой — как раньше', () => {
    let s = add(room('island', { a: 400, island: 200 }), 'I', cab(80, 'drawers3'))
    s = add(s, 'I', item('sink'))
    const svg = (st: KitchenState) => renderToStaticMarkup(createElement(PlanSketch, { plan: planOf(st), labels: { a: 'A' }, showWidths: true }))
    const flat = svg(s)
    expect(flat).not.toMatch(/NaN|<polygon|rotate\(-?\d/)
    const turned = svg({ ...s, islandTurn: 30 })
    expect(turned).not.toMatch(/NaN/)
    expect(turned).toContain('<polygon')
    expect(turned).toMatch(/rotate\(-?\d/)
  })

  it('зеркальный фасад: верхний шкаф и верх колонны — зеркало, в раскрое — в цех, в ссылке «r»', () => {
    const base: KitchenState = { ...DEFAULT_STATE, tallOven: true }
    const run = planOf(base).runs.find((r) => r.uppers.some((u) => u.kind === 'doors'))!
    const key = upperKey(run.id, run.uppers.find((u) => u.kind === 'doors')!.x)
    const st: KitchenState = { ...base, fronts: { [key]: 'mirror', tallup: 'mirror' } }
    const spec = built(st).spec
    const mirrors = spec.runs.flatMap((r) => r.fronts).filter((f) => f.mirror)
    expect(mirrors.length).toBeGreaterThanOrEqual(2)
    expect(built(base).spec.runs.flatMap((r) => r.fronts).some((f) => f.mirror)).toBe(false)
    const parts = cutParts(spec, { tone: getTone(getStyle(st.style), 0) })
    const cut = parts.filter((p) => p.name === 'mirror')
    expect(cut.length).toBeGreaterThan(0)
    expect(cut.every((p) => p.material.kind === 'shop')).toBe(true)
    const q = queryFromState(st)
    expect(q).toContain(`${key}r`)
    expect(q).toContain('tallupr')
    expect(stateFromQuery(new URLSearchParams(q), known).fronts).toEqual(st.fronts)
  })

  it('вытяжка — над варочной, не шире места; под окном — «не повесить»', () => {
    let s = room('corner', { a: 340 })
    s = add(s, 'A', item('hob'))
    let plan = planOf(s)
    const a = plan.runs[0]
    const hob = a.modules.find((m) => m.kind === 'hob')!
    // окно встаёт мимо панели: окно по середине ряда, панель у угла
    const hood = a.uppers.find((u) => u.kind === 'hood')
    if (plan.window && hob.x < plan.window.at + plan.window.w / 2 && hob.x + hob.w > plan.window.at - plan.window.w / 2) {
      expect(hood).toBeUndefined()
      expect(plan.dropped.some((d) => d.slot === 'hood')).toBe(true)
    } else {
      expect(hood).toBeDefined()
      expect(hood!.x + hood!.w / 2).toBeCloseTo(hob.x + hob.w / 2, 5)
    }
    // панель прямо под окном
    const win = plan.window!
    s = { ...s, at: { hob: win.at } }
    plan = planOf(s)
    expect(plan.dropped.some((d) => d.slot === 'hood')).toBe(true)
  })

  it('свои верхние шкафы: режутся окном, вытяжкой и колонной; узкий кусок — добор', () => {
    let s = room('straight', { a: 300, noWindow: true })
    s = add(s, 'A', item('tall'))
    const tall = itemPositions(planOf(s)).tall!
    // шкаф верха ровно над колонной — от него ничего не остаётся
    s = { ...s, free: { ...s.free, uppers: { A: [{ c: tall.center, w: 60 }] } } }
    expect(planOf(s).runs[0].uppers.filter((u) => u.kind === 'doors')).toEqual([])
    // шкаф наполовину над колонной: кусок 18 см — добор
    s = { ...s, free: { ...s.free, uppers: { A: [{ c: tall.center + 24, w: 48 }] } } }
    const ups = planOf(s).runs[0].uppers.filter((u) => u.kind !== 'none')
    expect(ups.map((u) => [u.kind, Math.round(u.w)])).toEqual([['filler', 18]])
  })

  it('действия с верхом: повесить, сдвинуть, ширина, убрать, «верх над низом»', () => {
    let s = room('straight', { a: 300, noWindow: true })
    s = add(s, 'A', cab(60))
    s = add(s, 'A', cab(80))
    s = freeUppersOverLower(s, planOf(s), 'A')
    let plan = planOf(s)
    expect(plan.runs[0].uppers.map((u) => Math.round(u.w))).toEqual([60, 80])
    const r1 = freeAddUpper(s, plan, 'A', 40)
    expect('state' in r1).toBe(true)
    s = (r1 as { state: KitchenState }).state
    plan = planOf(s)
    assertLaid(plan, 'upper')
    const moved = freeMoveUpper(s, plan, 'A', 2, 20)
    expect(moved).not.toBeNull()
    const grown = freeResizeUpper(moved!, planOf(moved!), 'A', 2, 60)
    expect('state' in grown).toBe(true)
    s = freeRemoveUpper((grown as { state: KitchenState }).state, 'A', 0)
    expect(s.free?.uppers?.A).toHaveLength(2)
    assertLaid(planOf(s), 'upper2')
  })

  it('свой верх упёрся в соседа — перескакивает; перетащили на другую стену — там в ближайшем месте', () => {
    let s = room('corner', { a: 300, noWindow: true })
    s = add(s, 'A', item('tall'))
    s = { ...s, at: { tall: 30 }, free: { uppers: { A: [{ c: 90, w: 60 }, { c: 150, w: 60 }] } } }
    // вправо: сосед мешает — встаёт сразу за ним
    let m = freeMoveUpper(s, planOf(s), 'A', 0, 5)!
    expect(m.free!.uppers!.A![0].c).toBe(210)
    // влево: место у колонны освободилось — туда
    m = freeMoveUpper(m, planOf(m), 'A', 0, -5)!
    expect(m.free!.uppers!.A![0].c).toBe(90)
    // над колонной верх не встаёт: тащим туда — ближайшее свободное
    const same = freePlaceUpper(m, planOf(m), 'A', 1, 'A', 30)
    expect('state' in same && same.state.free!.uppers!.A![1].c).toBe(150)
    // на стену B, серединой в 100 см от угла
    const other = freePlaceUpper(m, planOf(m), 'A', 1, 'B', 100)
    expect('state' in other).toBe(true)
    const next = (other as { state: KitchenState; index: number }).state
    expect(next.free!.uppers!.A).toHaveLength(1)
    expect(next.free!.uppers!.B).toEqual([{ c: 100, w: 60 }])
    assertLaid(planOf(next), 'placed')
    expect(planOf(next).runs.find((r) => r.id === 'B')!.uppers).toHaveLength(1)
  })

  it('«Взять эту кухню»: всё на тех же местах, шкафы — свои', () => {
    for (const shape of ['straight', 'corner', 'u', 'island'] as Shape[]) {
      const rules: KitchenState = { ...DEFAULT_STATE, shape, a: 340, b: 260, c: 240, island: 200, lowUppers: true }
      const before = planOf(rules)
      const s = roomFromKitchen(rules, before)
      const after = planOf(s)
      assertLaid(after, shape)
      expect(after.dropped).toEqual([])
      for (const run of before.runs) {
        const next = after.runs.find((r) => r.id === run.id)!
        // всё, что шире планки, — на своём месте (±0,5 см: места хранятся с шагом 0,5)
        for (const m of run.modules.filter((x) => x.w >= 15)) {
          expect(
            next.modules.some((n) => Math.abs(n.x - m.x) <= 0.51 && Math.abs(n.w - m.w) <= 0.51),
            `${shape} ${run.id}: ${m.kind} ${m.x}+${m.w}`,
          ).toBe(true)
        }
      }
      expect(projectTotal(projectItems(s, after, catalog)).sum).toBe(projectTotal(projectItems(rules, before, catalog)).sum)
    }
  })
})

describe('пустая комната: ссылка', () => {
  it('er / fk / up — туда и обратно; обычная кухня — без них', () => {
    let s = freeCorner(room('u'), 'end', true)
    s = add(s, 'B', cab(45, 'drawers3'))
    s = { ...s, free: { ...s.free, uppers: { A: [{ c: 150.5, w: 60 }], C: [{ c: 100, w: 45 }] } } }
    const q = queryFromState(s)
    expect(q).toMatch(/er=1/)
    expect(q).toMatch(/fk=e/)
    expect(q).toMatch(/up=c-1505w60\.\.c100w45/)
    const back = stateFromQuery(new URLSearchParams(q), known)
    expect(queryFromState(back)).toBe(q)
    expect(back.free).toEqual(s.free)
    expect(queryFromState(leaveRoom(s))).not.toMatch(/er=|fk=|up=/)
  })

  it('мусор в fk и up отбрасывается; стена A короче правил — можно', () => {
    const q = new URLSearchParams('f=u&a=200&b=260&c=240&s=marble&fr=1&fk=zz&up=c050w999.cxx..' + 'c'.repeat(500))
    const s = stateFromQuery(q, known)
    expect(s.free).toEqual({})
    expect(s.a).toBe(200)
    const wide = stateFromQuery(new URLSearchParams('f=straight&a=300&s=marble&fr=1&up=c050w999'), known)
    expect(wide.free?.uppers?.A?.[0].w).toBe(120)
  })
})

/* ───────────── 400 случайных комнат ───────────── */

function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let x = s
    x = Math.imul(x ^ (x >>> 15), x | 1)
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61)
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296
  }
}

const ITEMS: FixedItem[] = ['sink', 'hob', 'oven', 'dishwasher', 'washer', 'fridge', 'tall', 'pantry', 'pantry2']
const WIDTHS = [30, 40, 45, 50, 60, 80, 90]
const FRONTS: BaseFront[] = ['doors', 'drawers3', 'drawers2', 'mix', 'open']

/** Случайная пустая комната — теми же действиями, что и палитра экрана. */
function randomRoom(r: () => number): KitchenState {
  const pick = <T,>(list: readonly T[]) => list[Math.floor(r() * list.length)]
  const shape = pick(['straight', 'corner', 'u', 'island'] as Shape[])
  let s = room(shape, {
    a: 200 + Math.round(r() * 400),
    b: 180 + Math.round(r() * 270),
    c: 150 + Math.round(r() * 300),
    island: 120 + Math.round(r() * 160),
    style: pick(STYLES).id,
    ...(r() < 0.3 ? { noWindow: true } : {}),
    ...(r() < 0.4 ? { lowUppers: true } : {}),
    ...(r() < 0.3 ? { fridgeOpen: true } : {}),
  })
  const walls = wallsOf(shape)
  const ops = 10 + Math.floor(r() * 30)
  for (let i = 0; i < ops; i++) {
    const roll = r()
    const plan = planOf(s)
    const wall = pick(walls)
    if (roll < 0.45) {
      const res = freeAdd(s, plan, planOf, wall, r() < 0.4 ? item(pick(ITEMS)) : cab(pick(WIDTHS), pick(FRONTS)))
      if ('state' in res) s = res.state
    } else if (roll < 0.55) {
      const keys = Object.keys(itemPositions(plan)) as FixedItem[]
      if (keys.length) s = freeRemove(s, pick(keys))
    } else if (roll < 0.65) {
      // двигают рукой: середина — куда угодно на стене, раскладка найдёт место
      const keys = Object.keys(itemPositions(plan)) as FixedItem[]
      if (keys.length) {
        const k = pick(keys)
        s = { ...s, at: { ...s.at, [k]: Math.round(r() * 1200) / 2 } }
      }
    } else if (roll < 0.72) {
      s = freeCorner(s, pick(['start', 'end'] as const), r() < 0.7)
    } else if (wall !== 'I') {
      const w = wall as FreeWall
      const u = roll < 0.82 ? freeAddUpper(s, plan, w, pick([30, 40, 60, 80])) : roll < 0.88 ? { state: freeUppersOverLower(s, plan, w) } : null
      if (u && 'state' in u) s = u.state
      const list = s.free?.uppers?.[w] ?? []
      if (list.length && roll >= 0.88) {
        const idx = Math.floor(r() * list.length)
        const moved = freeMoveUpper(s, planOf(s), w, idx, pick([-15, -5, 5, 15]))
        if (moved) s = moved
        if (r() < 0.3) {
          const g = freeResizeUpper(s, planOf(s), w, idx, pick([30, 60, 90]))
          if ('state' in g) s = g.state
        }
        if (r() < 0.2) s = freeRemoveUpper(s, w, idx)
      }
    }
  }
  return s
}

describe('пустая комната: 400 случайных комнат', () => {
  it('ничего не пересекается, всё конечно; ссылка, 3D, чертёж, список, раскрой, смета, проверка', { timeout: 600_000 }, () => {
    const r = rng(20260930)
    for (let n = 0; n < 400; n++) {
      const s = randomRoom(r)
      const label = `#${n} ${queryFromState(s)}`
      const plan = planOf(s)
      assertLaid(plan, label)
      // ссылка туда и обратно — та же комната
      // (свои шкафы в ссылке нумеруются заново по порядку — сравниваем без их номеров)
      const back = stateFromQuery(new URLSearchParams(queryFromState(s)), known)
      const norm = (p: Plan) => JSON.stringify(p.runs).replace(/"item":"k\d+"/g, '"item":"k"')
      expect(norm(planOf(back)), label).toBe(norm(plan))
      const { spec, items, project, hoodOver } = built(s)
      const json = JSON.stringify(spec)
      expect(json.includes('null') && /":null/.test(json.replace(/"mezzTop":null/g, '')), `${label}: NaN в спецификации`).toBe(false)
      // столешница — только над модулями
      for (const sr of spec.runs) {
        const run = plan.runs.find((x) => x.id === sr.id)!
        for (const top of sr.tops) {
          const mid = (top.x0 + top.x1) / 2
          expect(
            run.modules.some((m) => m.x <= mid + 0.5 && m.x + m.w >= mid - 0.5),
            `${label}: столешница ${sr.id} ${top.x0}–${top.x1} над пустотой`,
          ).toBe(true)
        }
      }
      // развёртка: без NaN
      for (const sr of spec.runs) {
        const svg = elevationSvg(sr, spec.heights, labelsFor('ru'), windowFor(plan, sr.id, s.ceiling ?? 270, WINDOW), { overhang: islandOverhang(spec.runs) })
        expect(svg.includes('NaN'), `${label}: NaN на развёртке ${sr.id}`).toBe(false)
      }
      // список мастеру: низ каждой стены сходится с её длиной (по 1 см на округление)
      const t = kitchenTexts('ru')
      const text = makerList(plan, items, t, project.flatMap((i) => (i.inTotal && i.appliance ? [i.appliance] : [])))
      const blocks = text.split('\n\n')
      for (const run of plan.runs) {
        const block = blocks.find((b) => b.startsWith(t.wall(run.id, Math.round(run.length))))
        expect(block, `${label}: нет стены ${run.id}`).toBeDefined()
        const low = block!.split('\n').find((l) => l.startsWith(`  ${t.lower}:`))!
        const nums = low.split(' · ').map((x) => Number(/(\d+)$/.exec(x)?.[1] ?? NaN))
        expect(nums.every(Number.isFinite), `${label}: ${low}`).toBe(true)
        const sum = nums.reduce((a, b) => a + b, 0)
        expect(Math.abs(sum - run.length), `${label}: ${low}`).toBeLessThanOrEqual(nums.length)
      }
      // раскрой и смета — конечные числа
      const parts = cutParts(spec, { tone: getTone(getStyle(s.style), 0) })
      const nested = nest(parts)
      const e = estimate(parts, nested, spec, emptyMaster().prices)
      expect(Number.isFinite(e.total), `${label}: смета`).toBe(true)
      for (const c of checkProject(plan, { hoodOver })) expect(JSON.stringify(c).includes('null'), `${label}: проверка ${c.id}`).toBe(false)
    }
  })
})
