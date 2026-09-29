import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import './helpers/canvas'
import { buildKitchen, type BuildInput } from '@/components/kitchen/three/build'
import { elevationSvg, islandOverhang, makerList, windowFor, type DrawingLabels } from '@/components/kitchen/drawing'
import { kitchenTexts } from '@/components/kitchen/texts'
import { READY } from '@/data/kitchen-ready'
import { products } from '@/data/products'
import { kitchenAppliances } from '@/lib/kitchen/catalog'
import { checkProject } from '@/lib/kitchen/checks'
import { cutParts, edgeTotals, nest } from '@/lib/kitchen/cutting'
import { WINDOW } from '@/lib/kitchen/dims'
import { LIMITS, planKitchen, type Plan } from '@/lib/kitchen/layout'
import { chosenItems, planInputOf, projectItems, projectTotal } from '@/lib/kitchen/order'
import { queryFromState, stateFromQuery } from '@/lib/kitchen/share'
import { getStyle, getTone, STYLES } from '@/lib/kitchen/styles'
import { ITEM_KEYS, SLOTS, type BaseFront, type CabinetId, type ItemKey, type KitchenAppliance, type KitchenState, type Shape, type SlotKind } from '@/lib/kitchen/types'
import live from './fixtures/kitchen-live-appliances.json'

/**
 * Страховка перед «Пустой комнатой» (docs/PLAN_KITCHEN_EMPTY_ROOM.md, этап 0):
 * снимок того, что конструктор считает сегодня, — раскладка, 3D-спецификация,
 * развёртки, список для мебельщика, проверка проекта, состав и сумма, раскрой,
 * ссылка туда-обратно. Обычные кухни после любых правок обязаны давать те же
 * числа. Снимок — короткие отпечатки (sha256), чтобы файл был маленьким, а
 * расхождение показывало, какая именно кухня изменилась.
 */

/** Числа — до тысячных: дробный шум видеокарты и Math.cos не должен менять отпечаток. */
const digest = (v: unknown) =>
  createHash('sha256')
    .update(JSON.stringify(v, (_k, x: unknown) => (typeof x === 'number' ? Math.round(x * 1000) / 1000 : x)))
    .digest('hex')
    .slice(0, 16)

/** Каталог — как на живом сайте (та же фикстура, что у kitchen-ready). */
const liveList = live.appliances as KitchenAppliance[]
const liveIds = new Set(liveList.map((a) => a.id))
const catalog: KitchenAppliance[] = [...kitchenAppliances(products).filter((a) => !liveIds.has(a.id)), ...liveList]
const known = new Map(catalog.map((a) => [a.id, a]))

function labelsFor(lang: 'ru' | 'ky'): DrawingLabels {
  const t = kitchenTexts(lang)
  return { cm: t.cm, appliance: (slot) => t.techShort[slot as keyof typeof t.techShort] ?? slot, ...t.drawing }
}

/** Всё, что экран считает из состояния, — как в KitchenPlanner.tsx. */
function everything(state: KitchenState, lang: 'ru' | 'ky' = 'ru') {
  const style = getStyle(state.style)
  const tone = getTone(style, state.tone)
  const chosen = chosenItems(state.picks, catalog)
  const plan: Plan = planKitchen(planInputOf(state, chosen, []), { shelves: style.shelves })
  const project = projectItems(state, plan, catalog)
  const items: BuildInput['items'] = {}
  for (const slot of SLOTS) items[slot] = null
  for (const i of project) {
    if (i.status === 'placed' || i.status === 'underHob') items[i.slot] = i.appliance
    else if (i.status === 'typical') items[i.slot] = undefined
  }
  const ceiling = state.ceiling ?? 270
  const built = buildKitchen({
    plan,
    style,
    tone,
    items,
    photos: new Map(),
    evening: false,
    room: { ceiling, toCeiling: !state.lowUppers },
    fronts: state.fronts ?? {},
    columns: state.heights,
    tallBase: state.tallBase,
    doorsRight: state.doorsRight,
    detail: 0.5,
  })
  const spec = built.spec
  built.dispose()
  const t = kitchenTexts(lang)
  const inProject = project.flatMap((i) => (i.inTotal && i.appliance ? [i.appliance] : []))
  const svgs = spec.runs.map((r) =>
    elevationSvg(r, spec.heights, labelsFor(lang), windowFor(plan, r.id, ceiling, WINDOW), { overhang: islandOverhang(spec.runs) }),
  )
  const parts = cutParts(spec, { facade: state.facade, upperFacade: state.upperFacade, tone, lang, tier: t.xl.tier })
  const nested = nest(parts)
  return {
    plan: digest(plan),
    spec: digest(spec),
    svg: digest(svgs),
    maker: digest(makerList(plan, items, t, inProject)),
    checks: digest(checkProject(plan, { hoodOver: built.hoodOver })),
    project: `${digest(project)} ${projectTotal(project).sum}`,
    cut: digest({ parts, sheets: nested.map((r) => r.sheets.length), edges: edgeTotals(parts) }),
  }
}

/** Псевдослучайные числа с зерном — как в kitchen-drawing: перебор одинаковый при каждом прогоне. */
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

const SHAPES: Shape[] = ['straight', 'corner', 'u', 'island']
const FRONTS: BaseFront[] = ['doors', 'drawers2', 'drawers3', 'drawers4', 'mix', 'open']
const idsOf = (slot: SlotKind) => catalog.filter((a) => a.slot === slot).map((a) => a.id)

/**
 * Случайная обычная кухня: форма, стены, техника из каталога, стиль, пеналы,
 * окно, свои шкафы и свои места предметов — всё, что покупатель может задать.
 */
function randomState(r: () => number): KitchenState {
  const pick = <T,>(list: readonly T[]) => list[Math.floor(r() * list.length)]
  const span = (k: keyof typeof LIMITS) => Math.round(LIMITS[k].min + r() * (LIMITS[k].max - LIMITS[k].min))
  const shape = pick(SHAPES)
  const picks: KitchenState['picks'] = {}
  for (const slot of SLOTS) {
    const ids = idsOf(slot)
    const roll = r()
    if (roll < 0.15) picks[slot] = null
    else if (roll < 0.85 && ids.length) picks[slot] = pick(ids)
  }
  const state: KitchenState = {
    shape,
    a: Math.max(span('a'), shape === 'u' ? 300 : shape === 'corner' ? 240 : 180),
    b: span('b'),
    c: span('c'),
    island: span('island'),
    style: pick(STYLES).id,
    tone: Math.floor(r() * 3) % 2,
    picks,
    ...pick<Partial<KitchenState>>([{}, { tallOven: true }, { ovenApart: true }, { pantries: 1 }, { pantries: 2 }, { noWindow: true }, { windowW: 60 }, { windowW: 200 }, { fridgeOpen: true }]),
    ...(r() < 0.4 ? { lowUppers: true } : {}),
    ...(r() < 0.3 ? { ceiling: 240 + 10 * Math.floor(r() * 9) } : {}),
  }
  // свои шкафы и места: как после перетаскивания в 3D
  if (r() < 0.5) {
    const walls = shape === 'u' ? (['A', 'B', 'C'] as const) : shape === 'corner' ? (['A', 'B'] as const) : shape === 'island' ? (['A', 'I'] as const) : (['A'] as const)
    const cabinets: Record<CabinetId, { w: number; front: BaseFront }> = {}
    const arrangement: Partial<Record<'A' | 'B' | 'C' | 'I', ItemKey[]>> = {}
    const at: Partial<Record<ItemKey, number>> = {}
    const keys: ItemKey[] = [...ITEM_KEYS.filter(() => r() < 0.6)]
    const n = Math.floor(r() * 4)
    for (let i = 1; i <= n; i++) {
      const id = `k${i}` as CabinetId
      cabinets[id] = { w: 15 + Math.floor(r() * 106), front: pick(FRONTS) }
      keys.push(id)
    }
    for (const k of keys) {
      const w = pick(walls)
      ;(arrangement[w] ??= []).push(k)
      if (r() < 0.5) at[k] = Math.round(r() * 1000) / 2
    }
    Object.assign(state, { arrangement, ...(n ? { cabinets } : {}), ...(Object.keys(at).length ? { at } : {}) })
  }
  return state
}

describe('страховка: обычные кухни считаются как раньше', () => {
  it('12 готовых кухонь: раскладка, 3D, чертёж, список, проверка, сумма, раскрой, ссылка', { timeout: 120_000 }, () => {
    const out: Record<string, unknown> = {}
    for (const k of READY) {
      const state = stateFromQuery(new URLSearchParams(k.q), known)
      out[k.id] = { ...everything(state, 'ru'), ky: everything(state, 'ky').maker, q: queryFromState(state) === k.q }
    }
    expect(out).toMatchSnapshot()
  })

  it('300 случайных кухонь со своими шкафами и местами', { timeout: 300_000 }, () => {
    const r = rng(20260929)
    const out: string[] = []
    for (let i = 0; i < 300; i++) {
      const state = randomState(r)
      const q = queryFromState(state)
      const back = queryFromState(stateFromQuery(new URLSearchParams(q), known))
      const all = everything(state, i % 2 ? 'ky' : 'ru')
      out.push(`${i} ${state.shape} ${digest(all)} q:${digest(q)}${back === q ? '' : ` back:${digest(back)}`}`)
    }
    expect(out).toMatchSnapshot()
  })
})
