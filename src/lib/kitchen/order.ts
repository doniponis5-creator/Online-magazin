/**
 * Состав проекта и деньги: что из выбранной техники стоит в кухне, что встало
 * не так, как задумано, что не поместилось, сколько это стоит, что положить
 * в корзину и что написать в WhatsApp.
 *
 * Раньше это жило внутри экрана и не проверялось тестами — так в сумму не
 * попадала отдельностоящая микроволновка, духовка под плитой «пропадала»,
 * а «Добавить всё» клало второй экземпляр. Теперь экран берёт всё отсюда.
 */
import { kitchenTexts } from '@/components/kitchen/texts'
import { formatSom } from '@/lib/format'
import type { Lang } from '@/lib/i18n/config'
import { frontColor, frontLabel, type FrontColor } from './finishes'
import { defaultPick } from './catalog'
import type { Plan, PlanInput } from './layout'
import { getStyle } from './styles'
import { SLOTS, type ItemKey, type KitchenAppliance, type KitchenState, type SlotKind } from './types'

/** Без этих трёх кухня не кухня: если в каталоге пусто — в 3D типовая модель. */
export const CORE_SLOTS: readonly SlotKind[] = ['oven', 'hob', 'hood']

/**
 * Выбор по слотам для раскладки: модель; null — в кухне не стоит (не нужно
 * или в каталоге пусто, а слот необязательный); undefined — типовая модель
 * (обязательный слот без товара). Что из этого «не нужно», а что «нет в
 * наличии», говорит `projectItems`.
 */
export type Chosen = Partial<Record<SlotKind, KitchenAppliance | null>>

/**
 * placed — стоит в 3D; counter — отдельностоящая микроволновка, ставится на
 * столешницу; underHob — духовка уехала под варочную панель; inStove — выбрана
 * плита, духовка в ней: своей строки с ценой нет, не в сумме; dropped — не
 * поместилась; typical — товара нет, в 3D типовая модель; noStock — слот
 * нужен (покупатель его не выключал), но в каталоге пусто, в 3D его нет.
 */
export type ItemStatus = 'placed' | 'counter' | 'underHob' | 'inStove' | 'dropped' | 'typical' | 'noStock'
export type ProjectItem = { slot: SlotKind; appliance: KitchenAppliance | null; status: ItemStatus; inTotal: boolean }
export type OrderPlan = Pick<Plan, 'dropped' | 'ovenMovedUnderHob'>

export function chosenItems(picks: KitchenState['picks'], appliances: readonly KitchenAppliance[]): Chosen {
  const out: Chosen = {}
  for (const slot of SLOTS) {
    const pick = picks[slot]
    const found = pick ? appliances.find((a) => a.id === pick && a.slot === slot) : undefined
    if (pick === null) out[slot] = null
    else if (found) out[slot] = found
    else {
      const list = appliances.filter((a) => a.slot === slot)
      const id = defaultPick(slot, list)
      out[slot] = id ? list.find((a) => a.id === id) : CORE_SLOTS.includes(slot) ? undefined : null
    }
  }
  return out
}

/** Вход раскладки из состояния и выбранной техники; snap — какие места прилипают (см. layout). */
export function planInputOf(s: KitchenState, chosen: Chosen, snap?: ItemKey[]): PlanInput {
  const oven = chosen.oven
  const hood = chosen.hood
  const hob = chosen.hob
  return {
    shape: s.shape,
    a: s.a,
    b: s.b,
    c: s.c,
    island: s.island,
    fridge: chosen.fridge,
    dishwasher: chosen.dishwasher,
    washer: chosen.washer,
    microwave: chosen.microwave,
    hob: chosen.hob,
    arrangement: s.arrangement,
    tallOven: s.tallOven,
    pantries: s.pantries,
    noWindow: s.noWindow,
    windowW: s.windowW,
    fridgeOpen: s.fridgeOpen,
    ovenApart: s.ovenApart,
    noOven: oven === null,
    cabinets: s.cabinets,
    gaps: s.gaps,
    manualUppers: s.manualUppers,
    upperCabs: s.upperCabs,
    at: s.at,
    widths: s.widths,
    oven: oven ? { w: oven.w, h: oven.h, d: oven.d } : null,
    hood: hood ? { w: hood.w } : null,
    ...(hob?.stove ? { stove: { w: hob.w, h: hob.h, d: hob.d } } : {}),
    ...(snap ? { snap } : {}),
  }
}

/**
 * Слот ставится в кухню, если его выбрали, — или по умолчанию: будь товар в
 * каталоге, `defaultPick` взял бы его (микроволновку и стиральную не берёт).
 */
const wanted = (slot: SlotKind, pick: string | null | undefined): boolean =>
  typeof pick === 'string' || defaultPick(slot, [{ id: '?', slot, w: 60, h: 200, d: 60, price: 0 } as KitchenAppliance]) !== null

export function projectItems(state: KitchenState, plan: OrderPlan, appliances: readonly KitchenAppliance[]): ProjectItem[] {
  const chosen = chosenItems(state.picks, appliances)
  const dropped = new Set(plan.dropped.map((d) => d.slot).filter(Boolean))
  const out: ProjectItem[] = []
  const stove = Boolean(chosen.hob?.stove)
  for (const slot of SLOTS) {
    // Плита: духовка внутри неё — отдельного товара нет, цену несёт плита.
    if (slot === 'oven' && stove) {
      out.push({ slot, appliance: null, status: 'inStove', inTotal: false })
      continue
    }
    const a = chosen[slot]
    if (a === null) {
      // выключен покупателем или по умолчанию не ставится — «не нужно»;
      // а нужный слот без товара — честное «нет в наличии» (истории 37, 42)
      if (state.picks[slot] !== null && wanted(slot, state.picks[slot]) && !appliances.some((x) => x.slot === slot))
        out.push({ slot, appliance: null, status: 'noStock', inTotal: false })
      continue
    }
    if (a === undefined) {
      // типовую модель, которой нет места (вытяжка над панелью у окна), в 3D не ставим
      out.push({ slot, appliance: null, status: dropped.has(slot) ? 'dropped' : 'typical', inTotal: false })
      continue
    }
    const status: ItemStatus =
      slot === 'microwave' && !a.builtIn
        ? 'counter'
        : slot === 'oven' && plan.ovenMovedUnderHob
          ? 'underHob'
          : dropped.has(slot)
            ? 'dropped'
            : 'placed'
    out.push({ slot, appliance: a, status, inTotal: status !== 'dropped' })
  }
  return out
}

export function projectTotal(items: readonly ProjectItem[]): { count: number; sum: number } {
  let count = 0
  let sum = 0
  for (const i of items) {
    if (!i.inTotal || !i.appliance) continue
    count++
    sum += i.appliance.price
  }
  return { count, sum }
}

/** Что положить в корзину: то, что в сумме, и чего там ещё нет. */
export function cartAdditions(items: readonly ProjectItem[], cart: readonly { productId: string }[]): KitchenAppliance[] {
  const have = new Set(cart.map((l) => l.productId))
  const out: KitchenAppliance[] = []
  for (const i of items) {
    if (!i.inTotal || !i.appliance || have.has(i.appliance.id)) continue
    have.add(i.appliance.id)
    out.push(i.appliance)
  }
  return out
}

/** Стены по форме кухни: «A 300 см · B 240 см». */
export function wallsText(s: KitchenState, lang: Lang): string {
  const t = kitchenTexts(lang)
  const parts = [`A ${s.a} ${t.cm}`]
  if (s.shape === 'corner' || s.shape === 'u') parts.push(`B ${s.b} ${t.cm}`)
  if (s.shape === 'u') parts.push(`C ${s.c} ${t.cm}`)
  if (s.shape === 'island') parts.push(`${t.walls.island} ${s.island} ${t.cm}`)
  return parts.join(' · ')
}

export type FacadeTier = 'lower' | 'upper' | 'island'

/**
 * Какого цвета фасады низа, верха и острова — только там, где цвет выбран, а не «как в стиле»
 * (у стиля нет кода, мастер берёт его из стиля). Верх без своего цвета — как низ,
 * остров без своего — как низ (те же правила, что в 3D и раскрое). Для WhatsApp и PDF мастеру.
 */
export function facadeTiers(state: KitchenState): { tier: FacadeTier; color: FrontColor }[] {
  const lower = frontColor(state.facade)
  const upper = state.upperFacade === 'style' ? undefined : state.upperFacade ? frontColor(state.upperFacade) : lower
  const island = state.shape !== 'island' ? undefined : state.islandFacade ? frontColor(state.islandFacade) : lower
  const out: { tier: FacadeTier; color: FrontColor }[] = []
  if (lower) out.push({ tier: 'lower', color: lower })
  if (upper) out.push({ tier: 'upper', color: upper })
  if (island) out.push({ tier: 'island', color: island })
  return out
}

/**
 * Фасады одной строкой — одно правило для WhatsApp и PDF мастеру (кто какого цвета — `facadeTiers`).
 * У всех частей кухни (низ, верх, остров — если он есть) один цвет — просто «RAL 7016 …»;
 * иначе «низ — …, верх — …, остров — …». Часть «как в стиле» пишется как `asStyle`
 * (PDF: «Модерн · Графит»), без него пропускается (WhatsApp); ничего нет — ''.
 * `label` — как назвать цвет (PDF добавляет материал), по умолчанию `frontLabel`.
 */
export function frontsText(
  state: KitchenState,
  lang: Lang,
  opts: { asStyle?: string; label?: (c: FrontColor) => string } = {},
): string {
  const t = kitchenTexts(lang)
  const tiers = facadeTiers(state)
  const label = opts.label ?? ((c: FrontColor) => frontLabel(c, lang))
  const all: FacadeTier[] = state.shape === 'island' ? ['lower', 'upper', 'island'] : ['lower', 'upper']
  const rows: { tier: FacadeTier; key: string; text: string }[] = []
  for (const tier of all) {
    const c = tiers.find((x) => x.tier === tier)?.color
    if (c) rows.push({ tier, key: c.id, text: label(c) })
    else if (opts.asStyle) rows.push({ tier, key: 'style', text: opts.asStyle })
  }
  if (!rows.length) return ''
  if (rows.length === all.length && rows.every((r) => r.key === rows[0].key)) return rows[0].text
  return rows.map((r) => `${t.frontTier[r.tier]} — ${r.text}`).join(', ')
}

/**
 * Сообщение консультанту: форма и стены, стиль, фасады с кодами (`frontsText`); каждая
 * единица техники с ценой («на столешницу» у отдельностоящей микроволновки); «не поместилось» —
 * отдельно, без цены в итоге; типовая модель — «нет в наличии, подскажите»; итог; ссылка.
 * Мебель и модули сюда не идут — они в ссылке и в PDF.
 */
export function whatsappText(items: readonly ProjectItem[], state: KitchenState, url: string, lang: Lang): string {
  const t = kitchenTexts(lang)
  const style = getStyle(state.style)
  const lines = [t.waHello, '', `${t.shapes[state.shape][0]}: ${wallsText(state, lang)}`, `${t.waStyle}: ${style[lang]}`]
  // цвета с кодами («RAL 7016 …», «Egger H1145 ST10 …») — продавец и мастер видят, что заказано
  const fronts = frontsText(state, lang)
  if (fronts) lines.push(`${t.waFronts}: ${fronts}`)
  lines.push('')
  const nameOf = (i: ProjectItem) => (i.slot === 'hob' && i.appliance?.stove ? t.stove.name : t.slots[i.slot])
  for (const i of items) {
    if (i.status === 'inStove') continue
    const name = nameOf(i)
    if (i.status === 'typical' || !i.appliance) lines.push(`• ${name}: ${t.waAsk}`)
    else if (i.inTotal) {
      const note = i.status === 'counter' ? ` (${t.waCounter})` : i.status === 'underHob' ? ` (${t.ovenPlace.hob.toLowerCase()})` : ''
      lines.push(`• ${name}: ${i.appliance.name} — ${formatSom(i.appliance.price)}${note}`)
    }
  }
  const out = items.filter((i) => i.status === 'dropped' && i.appliance)
  if (out.length) {
    lines.push('', t.waDropped)
    for (const i of out) lines.push(`• ${nameOf(i)}: ${i.appliance!.name}`)
  }
  const total = projectTotal(items)
  lines.push('', `${t.total}: ${t.pieces(total.count)} · ${formatSom(total.sum)}`, url)
  return lines.join('\n')
}
