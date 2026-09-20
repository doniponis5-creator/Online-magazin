import 'server-only'

/**
 * Пределы: чтобы один человек не съел чат для всех остальных.
 *
 * Чат отвечает бесплатно, но каждый ответ стоит денег и места в дневной норме
 * Google. Один скучающий человек, пишущий сотню сообщений, может выбрать
 * дневную норму до обеда — и настоящий покупатель останется без ответа.
 *
 * Поэтому два предела. Первый — на человека: слишком частые сообщения просто
 * не доходят до модели. Второй — на день: когда норма выбрана, чат не молчит,
 * а переходит на поиск по каталогу и телефон магазина.
 */

import { store } from '@/lib/store'

const hits = store('limit-hits', () => new Map<string, number[]>())
const day = store('limit-day', () => ({ date: '', used: 0 }))

/** Слишком часто? Заодно засчитывает попытку. */
export function tooOften(key: string, max: number, windowMs: number): boolean {
  const now = Date.now()
  const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs)
  list.push(now)
  hits.set(key, list)
  if (hits.size > 5000) hits.clear()
  return list.length > max
}

/** Сколько ответов модели в день позволяем. */
function dailyLimit(): number {
  const value = Number(process.env.ASSISTANT_DAILY_LIMIT)
  return Number.isFinite(value) && value > 0 ? value : 1500
}

/** Есть ли ещё дневная норма. Засчитывает обращение. */
export function dayBudgetLeft(): boolean {
  const today = new Date().toISOString().slice(0, 10)
  if (day.date !== today) {
    day.date = today
    day.used = 0
  }
  if (day.used >= dailyLimit()) return false
  day.used += 1
  return true
}
