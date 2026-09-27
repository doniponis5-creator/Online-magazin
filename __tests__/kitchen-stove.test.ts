import { describe, expect, it } from 'vitest'
import type { Product } from '@/data/products'
import { kitchenTexts } from '@/components/kitchen/texts'
import { checkProject } from '@/lib/kitchen/checks'
import { applianceFromProduct, defaultPick } from '@/lib/kitchen/catalog'
import { planKitchen, type Plan, type PlanInput } from '@/lib/kitchen/layout'
import { cartAdditions, chosenItems, planInputOf, projectItems, projectTotal, whatsappText } from '@/lib/kitchen/order'
import { DEFAULT_STATE, kitchenLinkFor } from '@/lib/kitchen/share'
import type { KitchenAppliance, KitchenState } from '@/lib/kitchen/types'

/**
 * Отдельностоящая плита в конструкторе кухни
 * (`.autopilot/2026-09-27-kitchen-stove/spec.md`, пункты 1–5).
 */

const spec = (label: string, value: string) => ({ labelRu: label, labelKy: label, valueRu: value, valueKy: value })

function product(name: string, specs: [string, string][], price = 20000): Product {
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
    variants: [{ id: 'std', stock: 1 }],
  }
}

/** Характеристики SHIVAKI 6401E со страницы товара (cb-00002487). */
const SHIVAKI = product(
  'Газовая плита SHIVAKI 6401E стеклокерамика 4 электро черный',
  [
    ['Тип', 'Отдельностоящая электрическая плита'],
    ['Варочная поверхность', 'Стеклокерамика Hi-Light'],
    ['Количество конфорок', '4 электрические'],
    ['Духовка', 'Электрическая, 65 л'],
    ['Габариты (Ш × В × Г)', '60 × 85 × 60 см'],
    ['Бренд', 'SHIVAKI'],
  ],
  24300,
)

describe('плита: распознавание (catalog.ts)', () => {
  it('SHIVAKI 6401E — плита слота «варочная», электрическая, 60 × 85 × 60, не встраиваемая', () => {
    expect(applianceFromProduct(SHIVAKI)).toMatchObject({ slot: 'hob', stove: true, builtIn: false, hob: 'electric', w: 60, h: 85, d: 60, sizeKnown: true })
  })

  it('без размеров — типовая плита 60 × 85 × 60; газ — из характеристик', () => {
    expect(applianceFromProduct(product('Плита ARTEL Apetito 01-G', [['Тип', 'Отдельностоящая газовая плита'], ['Духовка', 'Газовая']]))).toMatchObject({
      slot: 'hob',
      stove: true,
      hob: 'gas',
      w: 60,
      h: 85,
      d: 60,
      sizeKnown: false,
    })
  })

  it('настольная электроплитка и мини-плита — не для кухни', () => {
    expect(applianceFromProduct(product('Электроплитка настольная SAKURA 2 конфорки', [['Габариты', '50 × 10 × 30 см']]))).toBeNull()
    expect(applianceFromProduct(product('Мини-плита электрическая с духовкой SHIVAKI 36 л', [['Духовка', 'Электрическая, 36 л']]))).toBeNull()
  })

  it('«Встраиваемая поверхность» — по-прежнему варочная панель, без признака плиты', () => {
    const a = applianceFromProduct(product('Встраиваемая поверхность MIDEA MC-6T3401R216 (черный)', [['Ширина', '59 см']]))
    expect(a).toMatchObject({ slot: 'hob', builtIn: true, w: 59 })
    expect(a?.stove).toBeUndefined()
  })

  it('«Примерить в кухне» у плиты — тот же ключ слота, что у варочной (hb=)', () => {
    expect(kitchenLinkFor(SHIVAKI, 'ru')).toMatch(/[?&]hb=/)
  })

  it('по умолчанию в слот ставится варочная панель, а не плита', () => {
    const panel = applianceFromProduct(product('Варочная панель X', [['Ширина', '60 см']], 10000))!
    const stove = applianceFromProduct(SHIVAKI)!
    expect(defaultPick('hob', [panel, stove])).toBe(panel.id)
    expect(defaultPick('hob', [stove])).toBe(stove.id)
  })
})

/* ───────────── раскладка (layout.ts) ───────────── */

const STOVE = applianceFromProduct(SHIVAKI)!
const STOVE_SIZE = { w: 60, h: 85, d: 60 }
const hobModules = (plan: Plan) => plan.runs.flatMap((r) => r.modules).filter((m) => m.kind === 'hob')
const straight = (over: Partial<PlanInput> = {}): PlanInput => ({ shape: 'straight', a: 300, b: 0, c: 0, island: 0, hob: STOVE, stove: STOVE_SIZE, ...over })

describe('плита: раскладка (layout.ts)', () => {
  it('место плиты — ровно её ширина, без духовки под ней, помечено как плита', () => {
    const plan = planKitchen(straight({ stove: { w: 50, h: 85, d: 60 }, hob: { ...STOVE, w: 50 }, oven: { w: 59.5, h: 59.5, d: 56 } }), { shelves: false })
    const [m] = hobModules(plan)
    expect(m).toMatchObject({ w: 50, oven: false, stove: true })
    expect(plan.stove).toMatchObject({ w: 50, h: 85, d: 60, wall: 'A' })
  })

  it('своя ширина шкафа плиты не действует: плита 60 см — место 60 см', () => {
    const plan = planKitchen(straight({ widths: { hob: 90 } }), { shelves: false })
    expect(hobModules(plan)[0].w).toBe(60)
  })

  it('пенал с духовкой и отдельная духовка при плите не нужны и не «не поместились»', () => {
    for (const over of [{ tallOven: true }, { ovenApart: true }] as Partial<PlanInput>[]) {
      const plan = planKitchen(straight({ a: 180, ...over }), { shelves: false })
      const all = plan.runs.flatMap((r) => r.modules)
      expect(all.some((m) => m.kind === 'tall' || m.kind === 'oven' || m.oven)).toBe(false)
      expect(plan.dropped.filter((d) => d.slot === 'oven')).toEqual([])
      expect(plan.ovenMovedUnderHob).toBeUndefined()
      expect(plan.tooWide ?? []).toEqual([])
    }
  })

  it('без плиты варочная и духовка — как раньше', () => {
    const plan = planKitchen({ shape: 'straight', a: 300, b: 0, c: 0, island: 0, oven: { w: 59.5, h: 59.5, d: 56 } }, { shelves: false })
    expect(hobModules(plan)[0]).toMatchObject({ w: 60, oven: true })
    expect(hobModules(plan)[0].stove).toBeUndefined()
    expect(plan.stove).toBeUndefined()
  })

  it('над газовой плитой — вытяжка по газовой норме', () => {
    const plan = planKitchen(straight({ hob: { ...STOVE, hob: 'gas' }, hood: { w: 60 } }), { shelves: false })
    expect(plan.hoodHeight).toEqual({ over: 75, gas: true })
  })
})

/* ───────────── состав проекта (order.ts) ───────────── */

const OVEN: KitchenAppliance = { ...STOVE, id: 'ov1', slot: 'oven', name: 'Духовка X', price: 30_000, w: 59.5, h: 59.5, d: 56, builtIn: true, stove: undefined, hob: undefined, burners: undefined }
const HOOD: KitchenAppliance = { ...OVEN, id: 'hd1', slot: 'hood', name: 'Вытяжка X', price: 15_000, w: 60, h: 40, d: 50 }
const CATALOG = [OVEN, STOVE, HOOD]

describe('плита: состав проекта (order.ts)', () => {
  const s: KitchenState = { ...DEFAULT_STATE, shape: 'straight', a: 300, picks: { hob: STOVE.id, oven: OVEN.id } }
  const chosen = chosenItems(s.picks, CATALOG)
  const plan = planKitchen(planInputOf(s, chosen), { shelves: false })
  const items = projectItems(s, plan, CATALOG)

  it('в раскладку плита уходит своими габаритами', () => {
    expect(planInputOf(s, chosen).stove).toEqual({ w: 60, h: 85, d: 60 })
    const panel: KitchenAppliance = { ...STOVE, id: 'hb1', h: 5, d: 52, builtIn: true, stove: undefined }
    expect(planInputOf(s, { ...chosen, hob: panel }).stove).toBeUndefined()
  })

  it('плита — одна позиция в сумме; духовка «в плите» — не в сумме и не в корзине', () => {
    expect(items.find((i) => i.slot === 'hob')).toMatchObject({ status: 'placed', inTotal: true, appliance: { id: STOVE.id } })
    expect(items.find((i) => i.slot === 'oven')).toEqual({ slot: 'oven', appliance: null, status: 'inStove', inTotal: false })
    expect(projectTotal(items)).toEqual({ count: 2, sum: 24_300 + 15_000 })
    expect(cartAdditions(items, []).map((a) => a.id)).toEqual([STOVE.id, HOOD.id])
  })

  it('WhatsApp: «Плита: … — цена», духовки отдельной строкой нет (RU/KY)', () => {
    for (const lang of ['ru', 'ky'] as const) {
      const text = whatsappText(items, s, 'https://smarket.kg/k', lang)
      expect(text).toContain(`• Плита: ${STOVE.name} — `)
      expect(text.split('\n').filter((l) => /Духовка/.test(l))).toEqual([])
    }
  })
})

/* ───────────── проверки (checks.ts) ───────────── */

describe('плита: высота против столешницы (checks.ts)', () => {
  const stoveHeight = (plan: Plan, topCm?: number) => checkProject(plan, topCm === undefined ? {} : { topCm }).filter((c) => c.id === 'stoveHeight')

  it('плита 85 см, столешница 87 см (82 + 5) — разница 2 см: выровнять ножками', () => {
    expect(stoveHeight(planKitchen(straight(), { shelves: false }), 5)).toEqual([{ id: 'stoveHeight', level: 'warn', h: 85, top: 87 }])
  })

  it('столешница 84 см (82 + 2) — разница 1 см, в пределах 1,5: вровень', () => {
    expect(stoveHeight(planKitchen(straight(), { shelves: false }), 2)).toEqual([{ id: 'stoveHeight', level: 'ok', h: 85, top: 84 }])
  })

  it('ровно 1,5 см — ещё вровень; без плиты или без толщины столешницы — пункта нет', () => {
    expect(stoveHeight(planKitchen(straight({ stove: { w: 60, h: 85.5, d: 60 } }), { shelves: false }), 2)[0]).toMatchObject({ level: 'ok' })
    expect(stoveHeight(planKitchen(straight(), { shelves: false }))).toEqual([])
    expect(stoveHeight(planKitchen(straight({ stove: null, hob: undefined }), { shelves: false }), 5)).toEqual([])
  })

  it('тексты: RU и KY называют обе высоты', () => {
    expect(kitchenTexts('ru').stove.heightWarn(85, 87)).toBe('Плита 85 см, столешница 87 см — выровняйте ножками плиты.')
    expect(kitchenTexts('ky').stove.heightWarn(85, 87)).toMatch(/Плита 85 см.*87 см/)
  })
})

/* ───────────── дозапрос оркестратора ───────────── */

describe('плита: распознавание — границы', () => {
  it('только по названию, без «Тип» и без характеристик — плита, типовые 60 × 85 × 60, вид из названия', () => {
    expect(applianceFromProduct(product('Плита газовая ARTEL Apetito', []))).toMatchObject({ slot: 'hob', stove: true, hob: 'gas', w: 60, h: 85, d: 60, sizeKnown: false })
  })

  it('«мини» — только отдельным словом: «алюминиевая крышка» плиту не отменяет', () => {
    const a = applianceFromProduct(product('Газовая плита ARTEL 4 конфорки алюминиевая крышка', [['Тип', 'Отдельностоящая газовая плита']]))
    expect(a).toMatchObject({ slot: 'hob', stove: true, hob: 'gas' })
  })

  it('настольная и мини-плита — ни в какой слот, даже с духовкой и характеристиками', () => {
    expect(applianceFromProduct(product('Плита электрическая с духовкой', [['Тип', 'Настольная электроплита'], ['Духовка', '30 л']]))).toBeNull()
    expect(applianceFromProduct(product('Настольная плита газовая 2 конфорки', [['Габариты', '50 × 10 × 30 см'], ['Количество конфорок', '2 газовые']]))).toBeNull()
    expect(applianceFromProduct(product('Мини-плита SHIVAKI', []))).toBeNull()
  })

  it('«чугунные решётки» вид плиты не решают: «Газовая плита» — газовая, вытяжка по норме 75', () => {
    const a = applianceFromProduct(product('Газовая плита ARTEL', [['Тип', 'Отдельностоящая плита'], ['Варочная поверхность', 'Эмаль, чугунные решетки']]))!
    expect(a).toMatchObject({ stove: true, hob: 'gas' })
    expect(planKitchen(straight({ hob: a, hood: { w: 60 } }), { shelves: false }).hoodHeight).toEqual({ over: 75, gas: true })
  })
})

describe('плита: верх и столешница рядом', () => {
  it('над плитой в верхнем ряду — только вытяжка или ничего', () => {
    for (const hood of [{ w: 60 }, null]) {
      const plan = planKitchen(straight({ hood }), { shelves: true })
      const r = plan.runs.find((x) => x.modules.some((m) => m.stove))!
      const m = r.modules.find((x) => x.stove)!
      const over = r.uppers.filter((u) => u.x < m.x + m.w - 0.01 && u.x + u.w > m.x + 0.01)
      expect(over.length).toBeGreaterThan(0)
      expect(over.filter((u) => u.kind !== 'hood' && u.kind !== 'none')).toEqual([])
    }
  })

  it('«у плиты столешница с обеих сторон»: мойка 0–60, плита 120–180, стена 300 — слева 60, справа 120', () => {
    const plan = planKitchen(straight({ at: { sink: 30, hob: 150 } }), { shelves: false })
    expect(checkProject(plan).filter((c) => c.id === 'hobSides')).toEqual([{ id: 'hobSides', level: 'ok', left: 60, right: 120 }])
  })
})

describe('плита: распознавание — второй дозапрос', () => {
  it('«плиты», «плитами» и мелкая техника — не плита; «Тип» не про плиту — не плита', () => {
    expect(applianceFromProduct(product('Вафельница со сменными плитами REDMOND', []))).toBeNull()
    expect(applianceFromProduct(product('Электрогриль контактный, антипригарные плиты', [['Тип', 'Контактный гриль']]))).toBeNull()
    expect(applianceFromProduct(product('Плита запекательная ARTEL', [['Тип', 'Электрическая печь']]))).toBeNull()
    expect(applianceFromProduct(SHIVAKI)).toMatchObject({ slot: 'hob', stove: true })
    expect(applianceFromProduct(product('Газовая плита ARTEL 4 конфорки алюминиевая крышка', [['Тип', 'Отдельностоящая газовая плита']]))).toMatchObject({ slot: 'hob', stove: true })
  })

  it('электроплитка — ни в какой слот, даже с духовкой', () => {
    expect(applianceFromProduct(product('Электроплитка настольная с духовкой', []))).toBeNull()
  })
})

describe('плита: распознавание — вид решает «Тип», иначе первое слово-вид названия', () => {
  it('«Вытяжка мини для плиты» — вытяжка: «мини» и «для плиты» вид не меняют', () => {
    const a = applianceFromProduct(product('Вытяжка мини для плиты 50 см', [['Ширина', '50 см']]))
    expect(a).toMatchObject({ slot: 'hood', w: 50 })
    expect(a?.stove).toBeUndefined()
  })

  it('«Газовая плита … функция гриль» с «Тип» = «Отдельностоящая газовая плита» — газовая плита', () => {
    const a = applianceFromProduct(product('Газовая плита ARTEL 4 конфорки функция гриль', [['Тип', 'Отдельностоящая газовая плита']]))
    expect(a).toMatchObject({ slot: 'hob', stove: true, hob: 'gas', builtIn: false })
  })

  it('«Тип» = «Газовая с духовкой» вид не называет — решает название «Газовая плита …»', () => {
    const a = applianceFromProduct(product('Газовая плита ARTEL Apetito', [['Тип', 'Газовая с духовкой']]))
    expect(a).toMatchObject({ slot: 'hob', stove: true, hob: 'gas' })
  })

  it('«Тип» без вида, но «Настольная» — это про плиту из названия: не для кухни', () => {
    expect(applianceFromProduct(product('Плита газовая ARTEL 2 конфорки', [['Тип', 'Настольная']]))).toBeNull()
    expect(applianceFromProduct(product('Плита газовая ARTEL', [['Тип', 'Отдельностоящая']]))).toMatchObject({ slot: 'hob', stove: true })
  })

  it('варочная панель с «Тип» «… плита» без «отдельностоящ» — по-прежнему встроенная панель, не плита', () => {
    const gas = applianceFromProduct(product('Варочная панель X', [['Тип', 'Газовая плита']]))
    expect(gas).toMatchObject({ slot: 'hob', builtIn: true, hob: 'gas' })
    expect(gas?.stove).toBeUndefined()
    const el = applianceFromProduct(product('Встраиваемая поверхность X', [['Тип', 'Электрическая плита']]))
    expect(el).toMatchObject({ slot: 'hob', builtIn: true, hob: 'electric' })
    expect(el?.stove).toBeUndefined()
  })
})

describe('распознавание: холодильник и морозильник по первому слову-виду', () => {
  it('«Холодильник-морозильник» и холодильник «с нижней морозильной камерой» — холодильник; морозильник и ларь — не для кухни', () => {
    expect(applianceFromProduct(product('Холодильник-морозильник X', []))).toMatchObject({ slot: 'fridge' })
    expect(applianceFromProduct(product('Холодильник X с нижней морозильной камерой', []))).toMatchObject({ slot: 'fridge' })
    expect(applianceFromProduct(product('Морозильник X', []))).toBeNull()
    expect(applianceFromProduct(product('Морозильный ларь X', []))).toBeNull()
  })
})
