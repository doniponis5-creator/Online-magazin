import 'server-only'

/**
 * Из чего состоит запрос к Gemini и что из него модель берёт (владелец 10.10: «пулни тежаш, лекин сифатга
 * зарар етмасин»). Прежде чем что-то урезать, считаем 2–3 дня: сколько знаков у каждой части промпта и из
 * какой части модель называет товары. Поведение бота это не меняет — только счётчик.
 *
 * Части: fixed — общая часть до «СЕЙЧАС» (в кэше Gemini, в 10 раз дешевле); focus — «ПО ВОПРОСУ ПОКУПАТЕЛЯ»
 * (товары подробно); brief — «ЕЩЁ В ЭТИХ ЖЕ РАЗДЕЛАХ» (строкой на товар); place — подсказка о месте; viewing —
 * открытая страница товара; other — канал, язык, покупатель, рассрочка; turns — сам разговор.
 * Читать: /panel/questions?key=…&format=cost.
 */

import { durableMap } from '@/lib/durable'
import { NOW_MARK, type ChatTurn } from './gemini'
import { bishkekToday } from './usage'

export type Parts = { fixed: number; focus: number; brief: number; place: number; viewing: number; other: number; turns: number }
export type Meter = Parts & {
  calls: number
  /** сколько товаров было в focus и brief (всего за день) */
  focusItems: number
  briefItems: number
  /** товары, которые модель назвала (productIds), — откуда они */
  used: { talked: number; focus: number; brief: number; elsewhere: number }
  /** ответов без единого товара */
  noProducts: number
}

const FOCUS = 'ПО ВОПРОСУ ПОКУПАТЕЛЯ'
const BRIEF = 'ЕЩЁ В ЭТИХ ЖЕ РАЗДЕЛАХ'
const PLACE = 'МЕСТО, КОТОРОЕ НАЗВАЛ'
const VIEWING = 'СЕЙЧАС У ПОКУПАТЕЛЯ ОТКРЫТА'
const CATALOG = 'КАТАЛОГ (единственный источник'

const ids = (text: string) => [...text.matchAll(/id=([^\s|]+)/g)].map((m) => m[1])

/** Знаки каждой части промпта и id товаров в focus и brief. Чистая функция — её проверяет тест. */
export function promptParts(system: string, turns: ChatTurn[]): Parts & { focusIds: string[]; briefIds: string[] } {
  const at = system.indexOf(NOW_MARK)
  const fixed = at >= 0 ? at : system.length
  const after = at >= 0 ? system.slice(at) : ''
  const find = (mark: string) => after.indexOf(mark)
  const catalogAt = find(CATALOG)
  const focusAt = find(FOCUS)
  const briefAt = find(BRIEF)
  const end = after.length
  const focusText = focusAt >= 0 ? after.slice(focusAt, briefAt > focusAt ? briefAt : end) : ''
  const briefText = briefAt >= 0 ? after.slice(briefAt) : ''
  const placeAt = find(PLACE)
  const viewAt = find(VIEWING)
  const stop = catalogAt >= 0 ? catalogAt : end
  const place = placeAt >= 0 ? stop - placeAt : 0
  const viewing = viewAt >= 0 ? (placeAt > viewAt ? placeAt : stop) - viewAt : 0
  // Всё, что в каталоге, но не focus/brief (заголовок, пометка о бюджете), — к focus
  const catalog = catalogAt >= 0 ? end - catalogAt : 0
  const focus = Math.max(0, catalog - briefText.length)
  const other = Math.max(0, after.length - catalog - place - viewing)
  const turnsChars = turns.reduce((sum, t) => sum + t.text.length, 0)
  return {
    fixed, focus, brief: briefText.length, place, viewing, other, turns: turnsChars,
    focusIds: ids(focusText), briefIds: ids(briefText),
  }
}

/** Откуда модель взяла названные товары. */
export function usedFrom(productIds: string[], talked: string[], focusIds: string[], briefIds: string[]): Meter['used'] {
  const used = { talked: 0, focus: 0, brief: 0, elsewhere: 0 }
  for (const id of productIds) {
    if (talked.includes(id)) used.talked += 1
    else if (focusIds.includes(id)) used.focus += 1
    else if (briefIds.includes(id)) used.brief += 1
    else used.elsewhere += 1
  }
  return used
}

const empty = (): Meter => ({
  calls: 0, fixed: 0, focus: 0, brief: 0, place: 0, viewing: 0, other: 0, turns: 0, focusItems: 0, briefItems: 0,
  used: { talked: 0, focus: 0, brief: 0, elsewhere: 0 }, noProducts: 0,
})
const days = durableMap<string, Meter>('prompt-meter', 40 * 24 * 3600 * 1000)

/** Один удачный ответ модели. Ошибка счётчика ответу не мешает. */
export function recordMeter(system: string, turns: ChatTurn[], productIds: string[], talked: string[], now = new Date()): void {
  try {
    const p = promptParts(system, turns)
    const day = bishkekToday(now)
    const m = days.get(day) ?? empty()
    const used = usedFrom(productIds, talked, p.focusIds, p.briefIds)
    days.set(day, {
      calls: m.calls + 1,
      fixed: m.fixed + p.fixed, focus: m.focus + p.focus, brief: m.brief + p.brief, place: m.place + p.place,
      viewing: m.viewing + p.viewing, other: m.other + p.other, turns: m.turns + p.turns,
      focusItems: m.focusItems + p.focusIds.length, briefItems: m.briefItems + p.briefIds.length,
      used: {
        talked: m.used.talked + used.talked, focus: m.used.focus + used.focus,
        brief: m.used.brief + used.brief, elsewhere: m.used.elsewhere + used.elsewhere,
      },
      noProducts: m.noProducts + (productIds.length === 0 ? 1 : 0),
    })
  } catch (error) {
    console.error('[assistant] счётчик промпта:', error instanceof Error ? error.message : error)
  }
}

export function meterOf(day: string): Meter | null {
  return days.get(day) ?? null
}
