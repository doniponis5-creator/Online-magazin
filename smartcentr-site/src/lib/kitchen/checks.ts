import type { Module, Plan, Run } from './layout'

/**
 * Проверка проекта по правилам кухонных дизайнеров (NKBA и практика
 * мебельщиков): удобно ли готовить, не опасно ли, всё ли поместилось.
 * Возвращает список пунктов — тексты подставляет экран.
 */

export type CheckLevel = 'ok' | 'warn'

export type Check =
  | { id: 'triangle'; level: CheckLevel; legs: [number, number, number]; sum: number }
  | { id: 'hobSides'; level: CheckLevel; left: number; right: number }
  | { id: 'hobWindow'; level: CheckLevel }
  | { id: 'hobFridge'; level: CheckLevel; gap: number }
  | { id: 'sinkDw'; level: CheckLevel; gap: number }
  | { id: 'sinkWindow'; level: CheckLevel }
  | { id: 'fits'; level: CheckLevel; count: number }

/**
 * Правило треугольника: каждая сторона 120–270 см, сумма не больше 790 см.
 * Нижняя граница с запасом 5 см: точку «перед прибором» мы берём примерно.
 */
export const TRIANGLE = { legMin: 115, legMax: 270, sumMax: 790 }
/** Столешница по бокам плиты — не меньше 30 см. */
export const HOB_SIDE = 30

const TALL: Module['kind'][] = ['fridge', 'tall', 'pantry']

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
  const z = 60
  const cos = Math.cos(run.rot)
  const sin = Math.sin(run.rot)
  return [run.ox + x * cos + z * sin, run.oz - x * sin + z * cos]
}

const dist = (a: [number, number], b: [number, number]) => Math.round(Math.hypot(a[0] - b[0], a[1] - b[1]))

/** Свободная столешница подряд с одной стороны модуля: до конца ряда, высокого шкафа или мойки. */
function counterBeside(run: Run, i: number, step: 1 | -1): number {
  let sum = 0
  for (let j = i + step; j >= 0 && j < run.modules.length; j += step) {
    const m = run.modules[j]
    if (TALL.includes(m.kind) || m.kind === 'sink') break
    sum += m.w
  }
  return Math.round(sum)
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

export function checkProject(plan: Plan): Check[] {
  const out: Check[] = []
  const fridge = find(plan, 'fridge')
  const sink = find(plan, 'sink')
  const hob = find(plan, 'hob')
  const dw = find(plan, 'dishwasher')

  if (fridge && sink && hob) {
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
  out.push({ id: 'fits', level: plan.dropped.length === 0 ? 'ok' : 'warn', count: plan.dropped.length })
  return out
}
