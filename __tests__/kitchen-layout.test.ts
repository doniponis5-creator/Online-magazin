import { describe, expect, it } from 'vitest'
import { checkProject, type Check } from '@/lib/kitchen/checks'
import { DEPTH, itemPositions, LIMITS, minA, needByWall, planKitchen, type Plan, type PlanInput, type Upper } from '@/lib/kitchen/layout'
import type { Arrangement, HobKind, ItemKey, KitchenAppliance, Shape, WallId } from '@/lib/kitchen/types'

/**
 * Раскладка и проверки: находки аудита C01, C03–C06, C09–C11, C14, C16, C18,
 * D02, D03, D14, D16 (`.autopilot/2026-09-26-kitchen-3d-audit-pro--wip/`).
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

const fridge = appliance({ slot: 'fridge' })
const hob = (w = 59, kind: HobKind = 'electric') => appliance({ slot: 'hob', w, h: 5, d: 52, builtIn: true, hob: kind })
const dwBuilt = appliance({ slot: 'dishwasher', w: 60, h: 82, d: 57, builtIn: true })
const opts = { shelves: false }
const base = { b: 0, c: 0, island: 0 }

const mods = (plan: Plan) => plan.runs.flatMap((r) => r.modules)
const run = (plan: Plan, id: WallId) => plan.runs.find((r) => r.id === id)!
const byId = <T extends Check['id']>(checks: Check[], id: T) => checks.filter((c): c is Extract<Check, { id: T }> => c.id === id)

/* ───────────── случайные кухни, как в аудите ───────────── */

function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const WALLS: Record<Shape, WallId[]> = { straight: ['A'], island: ['A', 'I'], corner: ['A', 'B'], u: ['A', 'B', 'C'] }
const KEYS: ItemKey[] = ['fridge', 'tall', 'sink', 'dishwasher', 'washer', 'hob', 'pantry', 'pantry2', 'oven']

function randomInput(r: () => number): PlanInput {
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(r() * xs.length)]
  const int = (lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1))
  const shape = pick<Shape>(['straight', 'corner', 'u', 'island'])
  const widths = r() < 0.5 ? { sink: int(40, 120), hob: int(60, 120) } : undefined
  let arrangement: Arrangement | undefined
  if (r() < 0.35) {
    arrangement = {}
    for (const k of [...KEYS].sort(() => r() - 0.5)) {
      if (r() < 0.2) continue
      const w = pick(WALLS[shape])
      ;(arrangement[w] ??= []).push(k)
    }
  }
  return {
    shape,
    a: int(minA(shape, widths), LIMITS.a.max),
    b: int(LIMITS.b.min, LIMITS.b.max),
    c: int(LIMITS.c.min, LIMITS.c.max),
    island: int(LIMITS.island.min, LIMITS.island.max),
    fridge: r() < 0.75 ? appliance({ slot: 'fridge', w: pick([55, 60, 70, 91]) }) : null,
    dishwasher: r() < 0.6 ? appliance({ slot: 'dishwasher', w: pick([45, 60]), h: pick([82, 85]), builtIn: r() < 0.7 }) : null,
    washer: r() < 0.35 ? appliance({ slot: 'washer', h: pick([82, 85]), d: 47.5 }) : null,
    microwave: r() < 0.3 ? appliance({ slot: 'microwave', w: 59.5, h: 38.5, builtIn: r() < 0.7 }) : null,
    hob: hob(pick([30, 45, 59, 77, 90]), pick<HobKind>(['gas', 'electric', 'induction'])),
    tallOven: r() < 0.3,
    ovenApart: r() < 0.2,
    noOven: r() < 0.1,
    pantries: int(0, 2),
    noWindow: r() < 0.2,
    windowW: r() < 0.5 ? int(60, 240) : undefined,
    fridgeOpen: r() < 0.3,
    widths,
    oven: r() < 0.5 ? { w: pick([59.5, 60, 89.5]), h: 59.5, d: 57 } : null,
    hood: r() < 0.5 ? { w: pick([50, 60, 90, 120]) } : null,
    arrangement,
  }
}

function* fuzz(n: number, seed: number) {
  const r = rng(seed)
  for (let i = 0; i < n; i++) {
    const input = randomInput(r)
    yield { input, plan: planKitchen(input, opts) }
  }
}

const TALL_KINDS = ['fridge', 'tall', 'pantry']
const overlaps = (a0: number, a1: number, b0: number, b1: number) => a0 < b1 - 0.01 && b0 < a1 - 0.01

/* ───────────── C01: мойка, плита и угол не пропадают молча ───────────── */

describe('C01: мойка, варочная и угол', () => {
  it('прямая 180, мойка 120, панель 90: мойка сужается, обе на месте', () => {
    // C01: раньше ряд целиком становился обычными шкафами — мойки и плиты не было
    const plan = planKitchen({ shape: 'straight', a: 180, ...base, hob: hob(90), widths: { sink: 120 } }, opts)
    const sink = mods(plan).find((m) => m.kind === 'sink')
    const hobM = mods(plan).find((m) => m.kind === 'hob')
    expect(sink).toBeDefined()
    expect(hobM).toBeDefined()
    expect(sink!.w).toBeGreaterThanOrEqual(40)
    expect(sink!.w).toBeLessThan(120)
    expect(hobM!.w).toBeGreaterThanOrEqual(90)
    expect(plan.dropped).toEqual([])
  })

  it('плита вытеснена — мойка своей ширины', () => {
    // остров 150: мойка 120 и панель 120 не влезают даже с мойкой 40 — панель уходит,
    // а мойка 120 одна влезает и не должна остаться суженной
    const plan = planKitchen({ shape: 'island', a: 300, b: 0, c: 0, island: 150, hob: hob(120), widths: { sink: 120 }, arrangement: { I: ['sink', 'hob'] } }, opts)
    expect(plan.dropped).toContainEqual(expect.objectContaining({ item: 'hob', wall: 'I' }))
    expect(run(plan, 'I').modules.find((m) => m.kind === 'sink')!.w).toBe(120)
  })

  it('minA учитывает свою ширину мойки и панели', () => {
    expect(minA('u', { sink: 120 })).toBeGreaterThanOrEqual(2 * 100 + 120)
    expect(minA('corner', { sink: 120 })).toBeGreaterThanOrEqual(100 + 120)
    expect(minA('straight', { sink: 120, hob: 120 })).toBeGreaterThanOrEqual(240)
    // без своих ширин — как раньше
    expect(minA('u')).toBe(280)
    expect(minA('corner')).toBe(200)
    expect(minA('straight')).toBe(LIMITS.a.min)
  })

  it('перебор 20 000 кухонь: мойка, панель и угол либо стоят, либо в «не поместилось» со стеной', () => {
    const bad: string[] = []
    for (const { input, plan } of fuzz(20000, 1)) {
      const all = mods(plan)
      const lost = (kind: string, item: ItemKey) => !all.some((m) => m.kind === kind) && !plan.dropped.some((d) => d.item === item)
      if (lost('sink', 'sink')) bad.push(`мойка ${JSON.stringify(input)}`)
      if (lost('hob', 'hob')) bad.push(`панель ${JSON.stringify(input)}`)
      const corners = run(plan, 'A').modules.filter((m) => m.kind === 'corner').length
      const want = input.shape === 'u' ? 2 : input.shape === 'corner' ? 1 : 0
      if (corners !== want) bad.push(`угол ${corners}/${want} ${JSON.stringify(input)}`)
      for (const d of plan.dropped) {
        if (!d.wall || !plan.runs.some((r) => r.id === d.wall)) bad.push(`без стены ${JSON.stringify(d)}`)
        if (!(d.need >= 1)) bad.push(`need ${JSON.stringify(d)}`)
      }
      if (bad.length > 5) break
    }
    expect(bad).toEqual([])
  })
})

/* ───────────── C03: духовка под варочной ───────────── */

describe('C03: духовка уезжает под варочную', () => {
  const tight = { shape: 'straight' as const, a: 240, ...base, fridge, dishwasher: dwBuilt, hob: hob() }

  it('пенал с духовкой не встал — духовка под панелью и не «не поместилась»', () => {
    const plan = planKitchen({ ...tight, tallOven: true }, opts)
    expect(mods(plan).find((m) => m.kind === 'hob')?.oven).toBe(true)
    expect(plan.dropped.some((d) => d.slot === 'oven')).toBe(false)
    expect(plan.ovenMovedUnderHob).toBe(true)
  })

  it('отдельный шкаф духовки не встал — то же', () => {
    const plan = planKitchen({ ...tight, ovenApart: true }, opts)
    expect(mods(plan).find((m) => m.kind === 'hob')?.oven).toBe(true)
    expect(plan.dropped.some((d) => d.slot === 'oven')).toBe(false)
    expect(plan.ovenMovedUnderHob).toBe(true)
  })

  it('духовка и так под панелью — признака переезда нет', () => {
    const plan = planKitchen({ ...tight, a: 400 }, opts)
    expect(plan.ovenMovedUnderHob).toBeFalsy()
    const roomy = planKitchen({ ...tight, a: 450, tallOven: true }, opts)
    expect(mods(roomy).find((m) => m.kind === 'tall')?.oven).toBe(true)
    expect(roomy.ovenMovedUnderHob).toBeFalsy()
  })
})

/* ───────────── C04: нехватка по стенам ───────────── */

describe('C04: нехватка считается по каждой стене', () => {
  it('угловая: на A и B не хватает разного — у каждой стены своя нехватка', () => {
    const plan = planKitchen(
      {
        shape: 'corner',
        a: 280,
        b: 180,
        fridge,
        dishwasher: dwBuilt,
        washer: appliance({ slot: 'washer' }),
        hob: hob(),
        pantries: 2,
        arrangement: { A: ['sink', 'dishwasher', 'washer', 'fridge'], B: ['hob', 'pantry', 'pantry2'] },
        c: 0,
        island: 0,
      },
      opts,
    )
    const need = needByWall(plan)
    expect(Object.keys(need).sort()).toEqual(['A', 'B'])
    for (const d of plan.dropped) expect(need[d.wall]).toBeGreaterThanOrEqual(d.need)
  })

  it('перебор: удлинили стену на её нехватку — на этой стене всё встало', () => {
    const bad: string[] = []
    const field = { A: 'a', B: 'b', C: 'c' } as const
    for (const { input, plan } of fuzz(3000, 4)) {
      if (input.shape === 'island') continue
      const need = needByWall(plan)
      for (const wall of ['A', 'B', 'C'] as const) {
        const n = need[wall]
        if (!n || plan.dropped.every((d) => d.wall !== wall || d.slot === 'hood')) continue
        const key = field[wall]
        const len = input[key] + n
        if (len > LIMITS[key].max) continue
        const next = planKitchen({ ...input, [key]: len }, opts)
        const still = next.dropped.filter((d) => d.wall === wall && d.slot !== 'hood')
        if (still.length) bad.push(`${wall}+${n}: ${JSON.stringify(still)} ${JSON.stringify(input)}`)
      }
      if (bad.length > 5) break
    }
    expect(bad).toEqual([])
  })
})

/* ───────────── C05/C06: верхний ряд ───────────── */

describe('C05/C06: верхний угловой и узкие верхние', () => {
  it('угловая по умолчанию: верх над углом с глухой частью 35 см со стороны угла', () => {
    // C05: раньше над углом стоял обычный двустворчатый шкаф
    const plan = planKitchen({ shape: 'corner', a: 300, b: 240, c: 0, island: 0, fridge, dishwasher: dwBuilt, hob: hob() }, opts)
    expect(run(plan, 'A').uppers[0]).toMatchObject({ kind: 'corner', x: 0, blind: 35, blindAt: 'start' })
  })

  it('П-образная: оба угла сверху с глухой частью', () => {
    const plan = planKitchen({ shape: 'u', a: 360, b: 240, c: 240, island: 0, noWindow: true, hob: hob() }, opts)
    const up = run(plan, 'A').uppers
    expect(up[0]).toMatchObject({ kind: 'corner', blindAt: 'start', blind: 35 })
    expect(up[up.length - 1]).toMatchObject({ kind: 'corner', blindAt: 'end', blind: 35 })
  })

  it('прямая 185: над узкой планкой — панель, а не корпус', () => {
    // C06: раньше над планкой 1 см стоял «шкаф» 1 см
    const plan = planKitchen({ shape: 'straight', a: 185, ...base, hob: hob() }, opts)
    const narrow = run(plan, 'A').uppers.filter((u) => u.w < 20)
    expect(narrow.length).toBeGreaterThan(0)
    for (const u of narrow) expect(u.kind === 'filler' || u.kind === 'none').toBe(true)
  })

  it('перебор: нет верхних корпусов уже 20 см, ряд без нахлёстов', () => {
    const bad: string[] = []
    const cabinetLike = (u: Upper) => ['doors', 'shelf', 'hood', 'fridge'].includes(u.kind)
    for (const { input, plan } of fuzz(8000, 2)) {
      for (const r of plan.runs) {
        const ups = [...r.uppers].sort((p, q) => p.x - q.x)
        ups.forEach((u, i) => {
          if (u.w <= 0.001) bad.push(`пусто ${r.id} ${JSON.stringify(u)}`)
          if (cabinetLike(u) && u.w < 20 - 0.01) bad.push(`узкий ${r.id} ${JSON.stringify(u)} ${JSON.stringify(input)}`)
          if (u.kind === 'corner' && u.w - (u.blind ?? 0) < 20 - 0.01) bad.push(`угол без дверцы ${JSON.stringify(u)}`)
          const next = ups[i + 1]
          if (next && u.x + u.w > next.x + 0.01) bad.push(`нахлёст ${r.id} ${JSON.stringify(u)} ${JSON.stringify(next)} ${JSON.stringify(input)}`)
        })
      }
      if (bad.length > 5) break
    }
    expect(bad).toEqual([])
  })
})

/* ───────────── C10: ширина духовки и вытяжки ───────────── */

describe('C10: духовка и вытяжка шире своего места', () => {
  const wide = { shape: 'straight' as const, a: 300, ...base, hob: hob(59), oven: { w: 89.5, h: 59.5, d: 57 }, hood: { w: 90 } }

  it('прямая 300, панель 59, духовка 89,5, вытяжка 90: шкаф и место вытяжки раздвинуты', () => {
    const plan = planKitchen(wide, opts)
    const hobM = mods(plan).find((m) => m.kind === 'hob')!
    expect(hobM.oven).toBe(true)
    expect(hobM.w).toBeGreaterThanOrEqual(90)
    const hood = run(plan, 'A').uppers.find((u) => u.kind === 'hood')!
    expect(hood.w).toBeGreaterThanOrEqual(90)
    expect(hood.x + hood.w / 2).toBeCloseTo(hobM.x + hobM.w / 2, 2)
    expect(byId(checkProject(plan), 'applianceWider')).toEqual([])
  })

  it('колонна и отдельный шкаф не уже духовки', () => {
    const tall = planKitchen({ ...wide, a: 450, tallOven: true }, opts)
    expect(mods(tall).find((m) => m.kind === 'tall')!.w).toBeGreaterThanOrEqual(90)
    const apart = planKitchen({ ...wide, a: 450, ovenApart: true }, opts)
    expect(mods(apart).find((m) => m.kind === 'oven')!.w).toBeGreaterThanOrEqual(90)
  })

  it('пенал не встал, духовка 89,5 уехала под панель 60 — проверка «техника шире места»', () => {
    const plan = planKitchen({ shape: 'straight', a: 240, ...base, fridge, dishwasher: dwBuilt, hob: hob(), tallOven: true, oven: { w: 89.5, h: 59.5, d: 57 } }, opts)
    const wider = byId(checkProject(plan), 'applianceWider')
    expect(wider).toHaveLength(1)
    expect(wider[0]).toMatchObject({ level: 'warn', slot: 'oven' })
  })

  it('перебор: духовка и вытяжка либо в своём месте, либо есть проверка', () => {
    const bad: string[] = []
    for (const { input, plan } of fuzz(6000, 3)) {
      const wider = byId(checkProject(plan), 'applianceWider')
      const hoodUp = plan.runs.flatMap((r) => r.uppers).find((u) => u.kind === 'hood')
      if (input.hood && hoodUp && hoodUp.w < input.hood.w - 0.01 && !wider.some((c) => c.slot === 'hood'))
        bad.push(`вытяжка ${JSON.stringify(hoodUp)} ${JSON.stringify(input)}`)
      const home = mods(plan).find((m) => m.oven && (m.kind === 'hob' || m.kind === 'tall')) ?? mods(plan).find((m) => m.kind === 'oven')
      if (input.oven && !input.noOven && home && home.w < input.oven.w - 0.01 && !wider.some((c) => c.slot === 'oven'))
        bad.push(`духовка ${JSON.stringify(home)} ${JSON.stringify(input)}`)
      if (bad.length > 5) break
    }
    expect(bad).toEqual([])
  })
})

/* ───────────── C09: окно и высокие шкафы ───────────── */

describe('C09: окно не встаёт над холодильником и пеналом', () => {
  it('угловая 300×240, окно 240: окно сужается и не задевает холодильник', () => {
    // C09: раньше окно [15; 255] висело над холодильником [235; 300]
    const plan = planKitchen({ shape: 'corner', a: 300, b: 240, c: 0, island: 0, fridge, dishwasher: dwBuilt, hob: hob(), windowW: 240 }, opts)
    const win = plan.window!
    const fr = run(plan, 'A').modules.find((m) => m.kind === 'fridge')!
    expect(win.w).toBeGreaterThanOrEqual(60)
    expect(overlaps(win.at - win.w / 2, win.at + win.w / 2, fr.x, fr.x + fr.w)).toBe(false)
    expect(byId(checkProject(plan), 'tallUnderWindow')).toEqual([])
  })

  it('прямая, окно 240 на левой стене: начало окна не ближе глубины ряда', () => {
    const plan = planKitchen({ shape: 'straight', a: 300, ...base, fridge, hob: hob(), windowW: 240 }, opts)
    expect(plan.window!.wall).toBe('left')
    expect(plan.window!.at - plan.window!.w / 2).toBeGreaterThanOrEqual(DEPTH)
  })

  it('высокий шкаф под окном — проверка', () => {
    const plan = planKitchen({ shape: 'corner', a: 300, b: 240, c: 0, island: 0, fridge, hob: hob() }, opts)
    const fr = run(plan, 'A').modules.find((m) => m.kind === 'fridge')!
    const under = checkProject({ ...plan, window: { wall: 'back', at: fr.x + fr.w / 2, w: 100 } })
    expect(byId(under, 'tallUnderWindow')).toHaveLength(1)
    expect(byId(under, 'tallUnderWindow')[0].level).toBe('warn')
  })

  it('перебор: высокое под окном только вместе с проверкой, левое окно — за глубиной ряда', () => {
    const bad: string[] = []
    for (const { input, plan } of fuzz(8000, 5)) {
      const win = plan.window
      if (!win) continue
      if (win.wall === 'left') {
        if (win.at - win.w / 2 < DEPTH - 0.01) bad.push(`левое ${JSON.stringify(win)} ${JSON.stringify(input)}`)
        continue
      }
      const hit = run(plan, 'A').modules.some((m) => TALL_KINDS.includes(m.kind) && overlaps(win.at - win.w / 2, win.at + win.w / 2, m.x, m.x + m.w))
      if (hit && byId(checkProject(plan), 'tallUnderWindow').length === 0) bad.push(`под окном ${JSON.stringify(win)} ${JSON.stringify(input)}`)
      if (bad.length > 5) break
    }
    expect(bad).toEqual([])
  })
})

/* ───────────── C11: техника выше низа столешницы ───────────── */

describe('C11: стиральная и отдельная посудомойка под столешницей', () => {
  const straight = { shape: 'straight' as const, a: 400, ...base, hob: hob() }

  it('стиральная 85 см — предупреждение с высотой', () => {
    const plan = planKitchen({ ...straight, washer: appliance({ slot: 'washer', h: 85, d: 47.5 }) }, opts)
    const c = byId(checkProject(plan), 'underCounterHeight')
    expect(c).toHaveLength(1)
    expect(c[0]).toMatchObject({ level: 'warn', slot: 'washer', h: 85, max: 82 })
  })

  it('стиральная 82 см и встраиваемая посудомойка — молчит', () => {
    const plan = planKitchen({ ...straight, washer: appliance({ slot: 'washer', h: 82 }), dishwasher: appliance({ slot: 'dishwasher', h: 87, builtIn: true }) }, opts)
    expect(byId(checkProject(plan), 'underCounterHeight')).toEqual([])
  })

  it('отдельностоящая посудомойка 85 см — предупреждение', () => {
    const plan = planKitchen({ ...straight, dishwasher: appliance({ slot: 'dishwasher', h: 85, builtIn: false }) }, opts)
    expect(byId(checkProject(plan), 'underCounterHeight')[0]).toMatchObject({ slot: 'dishwasher', h: 85 })
  })
})

/* ───────────── C14: остров ───────────── */

describe('C14: остров не длиннее стены A', () => {
  it('a=180, остров 280 → остров 180', () => {
    const plan = planKitchen({ shape: 'island', a: 180, b: 0, c: 0, island: 280, hob: hob() }, opts)
    expect(plan.island!.w).toBeLessThanOrEqual(180)
    expect(run(plan, 'I').length).toBeLessThanOrEqual(180)
    expect(plan.island!.x).toBeGreaterThanOrEqual(0)
  })
})

/* ───────────── C16: заморозка мест ───────────── */

describe('C16: ничего не двигали — ничего не сдвинулось', () => {
  it('прямая 183: заморозили места — раскладка та же', () => {
    const input: PlanInput = { shape: 'straight', a: 183, ...base, hob: hob() }
    const plan = planKitchen(input, opts)
    const at = Object.fromEntries(Object.entries(itemPositions(plan)).map(([k, p]) => [k, p!.center]))
    const again = planKitchen({ ...input, at, snap: [] }, opts)
    expect(again.runs[0].modules).toEqual(plan.runs[0].modules)
  })

  it('перебор 5 000 кухонь', () => {
    const bad: string[] = []
    const shape = (p: Plan) => p.runs.map((r) => r.modules.map((m) => `${m.kind}@${m.x.toFixed(2)}+${m.w.toFixed(2)}`).join(' ')).join(' | ')
    for (const { input, plan } of fuzz(5000, 6)) {
      const at = Object.fromEntries(Object.entries(itemPositions(plan)).map(([k, p]) => [k, p!.center]))
      const again = planKitchen({ ...input, at, snap: [] }, opts)
      if (shape(again) !== shape(plan)) bad.push(`${shape(plan)}\n→ ${shape(again)}\n${JSON.stringify(input)}`)
      if (bad.length > 3) break
    }
    expect(bad).toEqual([])
  })

  it('поставленный рукой предмет по-прежнему прилипает к краю', () => {
    const input: PlanInput = { shape: 'straight', a: 400, ...base, hob: hob(), arrangement: { A: ['hob', 'sink'] } }
    const plan = planKitchen({ ...input, at: { sink: 367 }, snap: ['sink'] }, opts)
    expect(itemPositions(plan).sink!.center).toBe(370)
  })
})

/* ───────────── C18 и высота вытяжки ───────────── */

describe('C18: вытяжка над панелью под окном', () => {
  const underWin: PlanInput = { shape: 'corner', a: 300, b: 240, c: 0, island: 0, hob: hob(), windowW: 240, arrangement: { A: ['sink', 'hob'], B: [] } }

  it('вытяжку не повесить — она в «не поместилось» со слотом hood', () => {
    const plan = planKitchen({ ...underWin, hood: { w: 60 } }, opts)
    expect(byId(checkProject(plan), 'hobWindow')).toHaveLength(1)
    expect(run(plan, 'A').uppers.some((u) => u.kind === 'hood')).toBe(false)
    expect(plan.dropped).toContainEqual(expect.objectContaining({ item: 'hob', slot: 'hood', wall: 'A' }))
  })

  it('над плитой у окна — только вытяжка или пусто, навесного шкафа над конфоркой нет', () => {
    // ревью: кусок верха над плитой за окном становился шкафом doors/планкой
    for (const hood of [{ w: 60 }, null]) {
      const plan = planKitchen({ ...underWin, hood }, opts)
      const a = run(plan, 'A')
      const h = a.modules.find((m) => m.kind === 'hob')!
      const over = a.uppers.filter((u) => overlaps(u.x, u.x + u.w, h.x, h.x + h.w))
      expect(over.length).toBeGreaterThan(0)
      for (const u of over) expect(['hood', 'none']).toContain(u.kind)
    }
  })

  it('перебор: над варочной панелью в верхнем ряду только вытяжка или пусто', () => {
    const bad: string[] = []
    for (const { input, plan } of fuzz(8000, 7)) {
      for (const r of plan.runs)
        for (const h of r.modules.filter((m) => m.kind === 'hob'))
          for (const u of r.uppers)
            if (overlaps(u.x, u.x + u.w, h.x, h.x + h.w) && u.kind !== 'hood' && u.kind !== 'none')
              bad.push(`${r.id} ${JSON.stringify(u)} над ${JSON.stringify(h)} ${JSON.stringify(input)}`)
      if (bad.length > 5) break
    }
    expect(bad).toEqual([])
  })

  it('вытяжку не выбирали — записи нет', () => {
    const plan = planKitchen(underWin, opts)
    expect(plan.dropped.some((d) => d.slot === 'hood')).toBe(false)
  })
})

describe('D16: высота вытяжки над панелью', () => {
  const straight = { shape: 'straight' as const, a: 300, ...base, hood: { w: 60 } }

  it('фактической высоты нет — проверки нет (и в счёт она не входит)', () => {
    const plan = planKitchen({ ...straight, hob: hob(59, 'gas') }, opts)
    expect(byId(checkProject(plan), 'hoodHeight')).toEqual([])
  })

  it('фактически 55 см над газовой — предупреждение, 76 см — хорошо', () => {
    const plan = planKitchen({ ...straight, hob: hob(59, 'gas') }, opts)
    expect(byId(checkProject(plan, { hoodOver: 55 }), 'hoodHeight')).toEqual([expect.objectContaining({ level: 'warn', over: 55, min: 75, gas: true })])
    expect(byId(checkProject(plan, { hoodOver: 76 }), 'hoodHeight')).toEqual([expect.objectContaining({ level: 'ok', over: 76 })])
  })

  it('над индукционной норма 65 см', () => {
    const plan = planKitchen({ ...straight, hob: hob(59, 'induction') }, opts)
    expect(byId(checkProject(plan, { hoodOver: 60 }), 'hoodHeight')).toEqual([expect.objectContaining({ level: 'warn', min: 65, gas: false })])
    expect(byId(checkProject(plan, { hoodOver: 65 }), 'hoodHeight')).toEqual([expect.objectContaining({ level: 'ok' })])
  })

  it('без вытяжки проверки нет', () => {
    const plan = planKitchen({ ...straight, hood: null, hob: hob() }, opts)
    expect(byId(checkProject(plan, { hoodOver: 70 }), 'hoodHeight')).toEqual([])
  })
})
