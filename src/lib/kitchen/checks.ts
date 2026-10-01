import { BASE_H, counterTop, hoodNorm, isTall, STOVE_LEVEL, UPPER_BOTTOM } from './dims'
import { DEPTH, needByWall, runWorld, type Dropped, type Module, type Plan, type Run } from './layout'
import { isCabinet, isGap, type KitchenState, type SlotKind } from './types'

/**
 * Проверка проекта по правилам кухонных дизайнеров (NKBA и практика
 * мебельщиков): удобно ли готовить, не опасно ли, всё ли поместилось.
 * Возвращает список пунктов — тексты подставляет экран.
 */

export type CheckLevel = 'ok' | 'warn'

export type Check =
  | { id: 'triangle'; level: CheckLevel; legs: [number, number, number]; sum: number }
  /** все три в одном ряду: order — порядок вдоль ряда, legs — путь между соседними, см */
  | { id: 'workLine'; level: CheckLevel; legs: [number, number]; order: WorkPoint[] }
  | { id: 'hobSides'; level: CheckLevel; left: number; right: number }
  | { id: 'hobWindow'; level: CheckLevel }
  | { id: 'hobFridge'; level: CheckLevel; gap: number }
  | { id: 'sinkDw'; level: CheckLevel; gap: number }
  | { id: 'sinkWindow'; level: CheckLevel }
  | { id: 'fits'; level: CheckLevel; count: number }
  | { id: 'tallUnderWindow'; level: CheckLevel }
  | { id: 'applianceWider'; level: CheckLevel; slot: 'oven' | 'hood'; w: number; room: number }
  | { id: 'underCounterHeight'; level: CheckLevel; slot: 'washer' | 'dishwasher'; h: number; max: number }
  | { id: 'hoodHeight'; level: CheckLevel; over: number; min: number; gas: boolean }
  /** отдельностоящая плита против верха столешницы: h — плита, top — столешница, см */
  | { id: 'stoveHeight'; level: CheckLevel; h: number; top: number }
  /** верхний ряд поднят встроенной вытяжкой: over — его низ над столешницей, см; только пояснение */
  | { id: 'upperRaised'; level: CheckLevel; over: number }
  /** вытяжка не над варочной (P5): off — на сколько см середина вытяжки ушла от середины панели */
  | { id: 'hoodOffHob'; level: CheckLevel; off: number }
  /** пустая комната: шкаф стены A в углу закрыт шкафом соседней стены — нужен угловой */
  | { id: 'cornerBlocked'; level: CheckLevel; wall: 'B' | 'C' }

/**
 * Правило треугольника: каждая сторона 120–270 см, сумма не больше 790 см.
 * Нижняя граница с запасом 5 см: точку «перед прибором» мы берём примерно.
 * Только когда приборы на разных рядах: в одном ряду пункта нет.
 */
export const TRIANGLE = { legMin: 115, legMax: 270, sumMax: 790 }
/** Три точки рабочей зоны: и в треугольнике, и на линии. */
export type WorkPoint = 'fridge' | 'sink' | 'hob'
/** Столешница по бокам плиты — не меньше 30 см. */
export const HOB_SIDE = 30

/** Под столешницей место до низа столешницы (цоколь + корпус), см. */
export const UNDER_COUNTER = BASE_H

type Found = { run: Run; i: number; m: Module }

function find(plan: Plan, kind: Module['kind']): Found | null {
  for (const run of plan.runs) {
    const i = run.modules.findIndex((m) => m.kind === kind)
    if (i >= 0) return { run, i, m: run.modules[i] }
  }
  return null
}

/** Точка перед модулем на плане комнаты, см: там стоит человек. */
function front(f: Found): [number, number] {
  const { run, m } = f
  const x = m.x + m.w / 2
  const p = runWorld(run, x, 60)
  return [p.x, p.z]
}

const dist = (a: [number, number], b: [number, number]) => Math.round(Math.hypot(a[0] - b[0], a[1] - b[1]))

/**
 * Свободная столешница подряд с одной стороны модуля: до конца ряда, высокого
 * шкафа, мойки или пустого места (в пустой комнате столешница там кончается).
 */
function counterBeside(run: Run, i: number, step: 1 | -1): number {
  let sum = 0
  let prev = run.modules[i]
  for (let j = i + step; j >= 0 && j < run.modules.length; j += step) {
    const m = run.modules[j]
    const edge = step > 0 ? m.x - (prev.x + prev.w) : prev.x - (m.x + m.w)
    if (isTall(m.kind) || m.kind === 'sink' || m.stove || edge > 0.5) break
    sum += m.w
    prev = m
  }
  return Math.round(sum)
}

/**
 * Пустая комната: в углу у стены A стоит обычный шкаф, а соседняя стена (B или
 * C) начинается вплотную к нему — его дверцу не открыть. Нужен угловой шкаф или
 * пустой угол.
 */
function cornersBlocked(plan: Plan): ('B' | 'C')[] {
  const a = plan.runs.find((r) => r.id === 'A')
  if (!plan.free || !a) return []
  const out: ('B' | 'C')[] = []
  const inA = (x0: number, x1: number) => a.modules.some((m) => m.kind !== 'corner' && m.x < x1 - 0.5 && m.x + m.w > x0 + 0.5)
  const b = plan.runs.find((r) => r.id === 'B')
  // у B ряд перевёрнут: угол — в конце ряда
  if (b && inA(0, DEPTH) && b.modules.some((m) => m.x + m.w > b.length - DEPTH - 0.5)) out.push('B')
  const c = plan.runs.find((r) => r.id === 'C')
  if (c && inA(a.length - DEPTH, a.length) && c.modules.some((m) => m.x < DEPTH + 0.5)) out.push('C')
  return out
}

/**
 * Промежуток между двумя модулями, см (0 — стоят вплотную). В одном ряду —
 * точно; на соседних стенах — примерно, по точкам перед модулями.
 */
function gapBetween(a: Found, b: Found): number {
  if (a.run !== b.run) return Math.max(0, dist(front(a), front(b)) - Math.round((a.m.w + b.m.w) / 2))
  const [l, r] = a.m.x < b.m.x ? [a.m, b.m] : [b.m, a.m]
  return Math.max(0, Math.round(r.x - (l.x + l.w)))
}

function underWindow(plan: Plan, f: Found): boolean {
  const win = plan.window
  if (!win || win.wall !== 'back' || f.run.id !== 'A') return false
  return f.m.x < win.at + win.w / 2 && f.m.x + f.m.w > win.at - win.w / 2
}

/**
 * Высокий модуль под окном: у задней стены — по месту на стене; у левой —
 * крайний шкаф ряда A закрывает окно, если оно начинается ближе глубины ряда.
 */
function tallUnderWindow(plan: Plan): boolean {
  const win = plan.window
  if (!win) return false
  const a = plan.runs.find((r) => r.id === 'A')
  if (!a) return false
  const from = win.at - win.w / 2
  const to = win.at + win.w / 2
  return a.modules.some((m, i) => {
    if (!isTall(m.kind)) return false
    if (win.wall === 'back') return m.x < to - 0.01 && m.x + m.w > from + 0.01
    return i === 0 && m.x < 0.01 && from < DEPTH - 0.01
  })
}

/**
 * Что известно не из раскладки: фактический низ вытяжки над панелью (из 3D),
 * толщина столешницы стиля (`Style.topCm`) и низ верхнего ряда от пола
 * (`upperBottomOf` в layout.ts), см.
 */
export type CheckFacts = { hoodOver?: number; topCm?: number; upperBottom?: number }

export function checkProject(plan: Plan, facts: CheckFacts = {}): Check[] {
  const out: Check[] = []
  const fridge = find(plan, 'fridge')
  const sink = find(plan, 'sink')
  const hob = find(plan, 'hob')
  const dw = find(plan, 'dishwasher')

  // Все три в одном ряду — «рабочая линия»: точки перед ними на одной прямой,
  // треугольник вырожден (одна сторона = сумме двух), правило к ней не мерило.
  // Мерило то же — сторона не длиннее TRIANGLE.legMax, — но по пути: приборы
  // стоят вдоль ряда по порядку, и мерить надо отрезки между соседними.
  if (fridge && sink && hob && fridge.run === sink.run && sink.run === hob.run) {
    const line = (
      [
        ['fridge', fridge],
        ['sink', sink],
        ['hob', hob],
      ] as [WorkPoint, Found][]
    ).sort((p, q) => p[1].m.x - q[1].m.x)
    const legs: [number, number] = [dist(front(line[0][1]), front(line[1][1])), dist(front(line[1][1]), front(line[2][1]))]
    const good = legs.every((l) => l <= TRIANGLE.legMax)
    out.push({ id: 'workLine', level: good ? 'ok' : 'warn', legs, order: line.map((p) => p[0]) })
  } else if (fridge && sink && hob) {
    const legs: [number, number, number] = [dist(front(fridge), front(sink)), dist(front(sink), front(hob)), dist(front(hob), front(fridge))]
    const sum = legs[0] + legs[1] + legs[2]
    const good = legs.every((l) => l >= TRIANGLE.legMin && l <= TRIANGLE.legMax) && sum <= TRIANGLE.sumMax
    out.push({ id: 'triangle', level: good ? 'ok' : 'warn', legs, sum })
  }
  if (hob) {
    const left = counterBeside(hob.run, hob.i, -1)
    const right = counterBeside(hob.run, hob.i, 1)
    out.push({ id: 'hobSides', level: left >= HOB_SIDE && right >= HOB_SIDE ? 'ok' : 'warn', left, right })
    if (underWindow(plan, hob)) out.push({ id: 'hobWindow', level: 'warn' })
    // вытяжка — над варочной, середина в середину (±1 см); пункт только когда ушла
    const hood = hob.run.uppers.find((u) => u.kind === 'hood')
    const off = hood ? Math.round(Math.abs(hood.x + hood.w / 2 - (hob.m.x + hob.m.w / 2)) * 10) / 10 : 0
    if (off > 1) out.push({ id: 'hoodOffHob', level: 'warn', off })
    if (fridge) {
      const gap = gapBetween(hob, fridge)
      if (gap < HOB_SIDE) out.push({ id: 'hobFridge', level: 'warn', gap })
    }
  }
  if (sink && dw) {
    const gap = gapBetween(sink, dw)
    out.push({ id: 'sinkDw', level: gap <= 60 ? 'ok' : 'warn', gap })
  }
  if (sink && plan.window && underWindow(plan, sink)) out.push({ id: 'sinkWindow', level: 'ok' })
  if (tallUnderWindow(plan)) out.push({ id: 'tallUnderWindow', level: 'warn' })
  for (const wall of cornersBlocked(plan)) out.push({ id: 'cornerBlocked', level: 'warn', wall })
  for (const t of plan.tooWide ?? []) out.push({ id: 'applianceWider', level: 'warn', slot: t.slot, w: t.w, room: Math.round(t.room * 10) / 10 })
  for (const u of plan.underCounter ?? [])
    if (u.h > UNDER_COUNTER + 0.01) out.push({ id: 'underCounterHeight', level: 'warn', slot: u.slot, h: u.h, max: UNDER_COUNTER })
  // Высота вытяжки: норма из раскладки против того, как вытяжка висит на самом
  // деле. Пока фактической высоты нет — пункта нет и в счёт он не входит.
  if (plan.hoodHeight && facts.hoodOver !== undefined && Number.isFinite(facts.hoodOver)) {
    const { gas } = plan.hoodHeight
    const min = hoodNorm(gas)
    const over = Math.round(facts.hoodOver * 10) / 10
    out.push({ id: 'hoodHeight', level: over >= min ? 'ok' : 'warn', over, min, gas })
  }
  // Плита стоит на полу своей высотой: верх вровень со столешницей — ножками.
  // Без толщины столешницы пункта нет — как и без фактической высоты вытяжки.
  if (plan.stove && facts.topCm !== undefined && Number.isFinite(facts.topCm)) {
    const top = Math.round(counterTop(facts.topCm) * 10) / 10
    const h = Math.round(plan.stove.h * 10) / 10
    out.push({ id: 'stoveHeight', level: Math.abs(h - top) <= STOVE_LEVEL + 1e-9 ? 'ok' : 'warn', h, top })
  }
  // Встроенная вытяжка подняла весь верхний ряд — покупателю объяснить почему.
  if (facts.upperBottom !== undefined && facts.topCm !== undefined && Number.isFinite(facts.upperBottom) && facts.upperBottom > UPPER_BOTTOM + 0.05) {
    out.push({ id: 'upperRaised', level: 'ok', over: Math.round(facts.upperBottom - counterTop(facts.topCm)) })
  }
  // выпавшее пустое место gN — не потеря: его ужимает сама раскладка (ревью C1)
  const lost = plan.dropped.filter((d) => !isGap(d.item)).length
  out.push({ id: 'fits', level: lost === 0 ? 'ok' : 'warn', count: lost })
  return out
}

/** Подписи для «не поместилось» — тот срез `KitchenTexts`, который здесь нужен. */
export type DroppedNames = { slots: Record<SlotKind, string>; cabName: (w: number) => string; tallName: string; pantryName: string; emptyPlace: string }

/**
 * Есть ли покупателю что сказать о выпавшем: духовка под варочной, вытяжка без места
 * или нехватка стены. Выпало только пустое место — молчим (иначе пустая рамка `Dropped`, P2).
 */
export function droppedNotice(plan: Pick<Plan, 'dropped' | 'ovenMovedUnderHob'>): boolean {
  if (plan.ovenMovedUnderHob) return true
  if (plan.dropped.some((d) => d.slot === 'hood')) return true
  return Object.keys(needByWall(plan)).length > 0
}

/** Как назвать выпавшее покупателю: техника — по слоту, свой шкаф — по ширине, пустое место — «пустое место», пеналы — по виду. */
export function droppedName(d: Dropped, state: Pick<KitchenState, 'cabinets'>, t: DroppedNames): string {
  if (d.slot) return t.slots[d.slot]
  if (isGap(d.item)) return t.emptyPlace
  if (isCabinet(d.item)) return t.cabName(Math.round(state.cabinets?.[d.item]?.w ?? 60))
  return d.item === 'tall' ? t.tallName : t.pantryName
}
