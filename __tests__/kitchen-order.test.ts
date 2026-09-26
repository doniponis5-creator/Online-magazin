import { describe, expect, it } from 'vitest'
import { planKitchen } from '@/lib/kitchen/layout'
import { cartAdditions, chosenItems, planInputOf, projectItems, projectTotal, whatsappText } from '@/lib/kitchen/order'
import { DEFAULT_STATE } from '@/lib/kitchen/share'
import { getStyle } from '@/lib/kitchen/styles'
import type { KitchenAppliance, KitchenState, SlotKind } from '@/lib/kitchen/types'

const mk = (id: string, slot: SlotKind, price: number, extra: Partial<KitchenAppliance> = {}): KitchenAppliance => ({
  id,
  slot,
  name: `Модель ${id}`,
  brand: 'Test',
  price,
  w: 60,
  h: slot === 'fridge' ? 200 : slot === 'hob' ? 5 : 60,
  d: 60,
  sizeKnown: true,
  builtIn: true,
  finish: 'inox',
  ...(slot === 'hob' ? { hob: 'electric' as const } : {}),
  ...extra,
})

// Каталог как в аудите C02: пять встраиваемых на 140 000 и отдельностоящая микроволновка за 8 000.
const FRIDGE = mk('fr1', 'fridge', 50_000)
const OVEN = mk('ov1', 'oven', 30_000)
const HOB = mk('hb1', 'hob', 20_000)
const HOOD = mk('hd1', 'hood', 15_000, { h: 40 })
const DISH = mk('dw1', 'dishwasher', 25_000, { h: 82 })
const MW = mk('mw1', 'microwave', 8_000, { builtIn: false, w: 45, h: 28, d: 35 })
const CATALOG = [FRIDGE, OVEN, HOB, HOOD, DISH, MW]

const withMw: KitchenState = { ...DEFAULT_STATE, picks: { microwave: 'mw1' } }
const planOf = (s: KitchenState, catalog = CATALOG) => planKitchen(planInputOf(s, chosenItems(s.picks, catalog)), { shelves: getStyle(s.style).shelves })
const bySlot = (items: ReturnType<typeof projectItems>, slot: SlotKind) => items.find((i) => i.slot === slot)

describe('состав проекта (order.ts)', () => {
  it('C02: отдельностоящая микроволновка — «на столешницу», в сумме: 6 товаров, 148 000', () => {
    const items = projectItems(withMw, planOf(withMw), CATALOG)
    expect(bySlot(items, 'microwave')).toMatchObject({ status: 'counter', inTotal: true, appliance: { id: 'mw1' } })
    expect(projectTotal(items)).toEqual({ count: 6, sum: 148_000 })
  })

  it('C03: прямая 240 с пеналом — духовка под варочной, в сумме', () => {
    const s: KitchenState = { ...DEFAULT_STATE, shape: 'straight', a: 240, tallOven: true }
    const plan = planOf(s)
    const items = projectItems(s, plan, CATALOG)
    expect(bySlot(items, 'oven')).toMatchObject({ status: 'underHob', inTotal: true })
    // встали духовка, панель и вытяжка; холодильник и посудомойка не поместились
    expect(projectTotal(items).sum).toBe(65_000)
  })

  it('C18: вытяжка, которую не повесить (плита под окном), — не в сумме', () => {
    const plan = { ...planOf(withMw), dropped: [{ item: 'hob' as const, slot: 'hood' as const, need: 0, wall: 'A' as const }] }
    const items = projectItems(withMw, plan, CATALOG)
    expect(bySlot(items, 'hood')).toMatchObject({ status: 'dropped', inTotal: false })
    expect(projectTotal(items)).toEqual({ count: 5, sum: 133_000 })
  })

  it('типовая модель (в каталоге нет духовок) — в списке, но не в сумме', () => {
    const catalog = CATALOG.filter((a) => a.slot !== 'oven')
    const items = projectItems(withMw, planOf(withMw, catalog), catalog)
    expect(bySlot(items, 'oven')).toEqual({ slot: 'oven', appliance: null, status: 'typical', inTotal: false })
    expect(projectTotal(items)).toEqual({ count: 5, sum: 118_000 })
  })

  it('U03 (истории 37, 42): пустой слот — «нет в наличии», выключенный покупателем — «не нужно» и не в WhatsApp', () => {
    const catalog = CATALOG.filter((a) => a.slot !== 'fridge' && a.slot !== 'washer')
    const s: KitchenState = { ...DEFAULT_STATE, picks: {} }
    const items = projectItems(s, planOf(s, catalog), catalog)
    expect(bySlot(items, 'fridge')).toEqual({ slot: 'fridge', appliance: null, status: 'noStock', inTotal: false })
    // стиральная по умолчанию не ставится — её отсутствие в каталоге ни о чём не спрашивает
    expect(bySlot(items, 'washer')).toBeUndefined()
    expect(whatsappText(items, s, 'https://x.kg/ru/kitchen', 'ru')).toMatch(/Холодильник: нет в наличии, подскажите/)

    const off: KitchenState = { ...s, picks: { fridge: null } }
    const offItems = projectItems(off, planOf(off, catalog), catalog)
    expect(bySlot(offItems, 'fridge')).toBeUndefined()
    expect(whatsappText(offItems, off, 'https://x.kg/ru/kitchen', 'ru')).not.toMatch(/Холодильник/)
  })

  it('типовая вытяжка, которую не повесить, — «не поместилась», а не в 3D', () => {
    const catalog = CATALOG.filter((a) => a.slot !== 'hood')
    const plan = { ...planOf(withMw, catalog), dropped: [{ item: 'hob' as const, slot: 'hood' as const, need: 0, wall: 'A' as const }] }
    expect(bySlot(projectItems(withMw, plan, catalog), 'hood')).toEqual({ slot: 'hood', appliance: null, status: 'dropped', inTotal: false })
  })

  it('U04: «Добавить всё» кладёт только недостающее, второй раз — ничего', () => {
    const items = projectItems(withMw, planOf(withMw), CATALOG)
    expect(cartAdditions(items, []).map((a) => a.id).sort()).toEqual(['dw1', 'fr1', 'hb1', 'hd1', 'mw1', 'ov1'])
    const cart = CATALOG.map((a) => ({ productId: a.id, variantId: 'std', qty: 1 }))
    expect(cartAdditions(items, cart)).toEqual([])
    expect(cartAdditions(items, cart.filter((l) => l.productId !== 'hd1')).map((a) => a.id)).toEqual(['hd1'])
  })

  it('WhatsApp (RU): форма, стены, стиль, техника с ценами, итог, ссылка; без мебели', () => {
    const plan = { ...planOf(withMw), dropped: [{ item: 'hob' as const, slot: 'hood' as const, need: 0, wall: 'A' as const }] }
    const catalog = CATALOG.filter((a) => a.slot !== 'oven')
    const items = projectItems(withMw, plan, catalog)
    const text = whatsappText(items, withMw, 'https://x.kg/ru/kitchen?f=corner', 'ru')
    expect(text).toContain('Угловая')
    expect(text).toMatch(/A 300 см/)
    expect(text).toMatch(/B 240 см/)
    expect(text).toContain('Мрамор')
    expect(text).toMatch(/Модель fr1 — 50\s000 сом/)
    expect(text).toMatch(/Модель mw1 — 8\s000 сом \(на столешницу\)/)
    expect(text).toMatch(/Духовка: нет в наличии, подскажите/)
    // вытяжка — отдельным списком «не поместилось», не в итоге: 50+20+25+8 = 103 000, 4 товара
    expect(text).toMatch(/Не поместилось[^\n]*\n[^\n]*Модель hd1/)
    expect(text).toMatch(/4 товара[^\n]*103\s000 сом/)
    expect(text.trim().endsWith('https://x.kg/ru/kitchen?f=corner')).toBe(true)
    expect(text).not.toMatch(/Пенал|Шкаф/)
  })

  it('WhatsApp (KY): по-кыргызски, те же суммы', () => {
    const items = projectItems(withMw, planOf(withMw), CATALOG)
    const text = whatsappText(items, withMw, 'https://x.kg/ky/kitchen?f=corner', 'ky')
    expect(text).toContain('Саламатсызбы')
    expect(text).toMatch(/Модель mw1 — 8\s000 сом \(столешницанын үстүнө\)/)
    expect(text).toMatch(/148\s000 сом/)
    expect(text).toContain('https://x.kg/ky/kitchen?f=corner')
    expect(text).not.toContain('Здравствуйте')
  })
})
