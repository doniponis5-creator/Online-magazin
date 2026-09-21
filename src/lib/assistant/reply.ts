import 'server-only'

/**
 * Один ответ консультанта: сначала Gemini, при любой осечке — запасной режим.
 *
 * Правило простое: чат никогда не остаётся без ответа. Кончился лимит у
 * Gemini, пропал интернет на сервере, ключ не вписан — покупатель всё равно
 * получит поиск по каталогу и телефон магазина.
 */

import { catalogNow, lookupIn } from './live'
import { ownerNotes } from './notes'
import type { Product } from '@/data/products'
import type { Lang } from '@/lib/i18n/config'
import { askGemini, geminiConfigured, type ChatTurn } from './gemini'
import { dayBudgetLeft } from './limits'
import { toHit, type CustomerBrief, type ProductHit } from './knowledge'
import { localAnswer, parseAnswer } from './local'
import { detectLang } from './talk'
import { systemInstruction } from './prompt'

export type AssistantReply = {
  text: string
  products: ProductHit[]
  /** gemini — отвечала модель; local — запасной режим по каталогу */
  source: 'gemini' | 'local'
}

export async function answer(
  turns: ChatTurn[],
  lang: Lang,
  customer: CustomerBrief | null = null,
): Promise<AssistantReply> {
  const lastQuestion = [...turns].reverse().find((t) => t.role === 'user')?.text ?? ''
  // Каталог берём сегодняшний: из 1С, если сервер настроен, иначе вшитый.
  const [list, notes] = await Promise.all([catalogNow(), ownerNotes()])
  // Товары ищем по трём последним вопросам: «а какой из них тише?» без
  // прошлого вопроса про стиральные машины ничего не найдёт.
  const recent = turns
    .filter((t) => t.role === 'user')
    .slice(-3)
    .map((t) => t.text)
    .join(' ')

  if (geminiConfigured() && dayBudgetLeft()) {
    try {
      const raw = await askGemini(systemInstruction(lang, customer, talkLang(turns, lang), list, recent, notes), turns)
      const parsed = parseAnswer(raw)
      return { text: parsed.text, products: hits(parsed.productIds, lang, list), source: 'gemini' }
    } catch (error) {
      // Ошибку пишем в журнал сервера, покупателю её не показываем.
      console.error('[assistant] gemini:', error instanceof Error ? error.message : error)
    }
  }

  const fallback = localAnswer(lastQuestion, lang, customer, list)
  return { text: fallback.text, products: hits(fallback.productIds, lang, list), source: 'local' }
}

/**
 * Язык разговора — по двум последним репликам покупателя, а не по одной.
 *
 * Короткое «qachan keladi?» по одному сообщению узнать трудно, а вместе с
 * прошлым вопросом — уже легко. Человек не меняет язык посреди разговора.
 */
function talkLang(turns: ChatTurn[], lang: Lang) {
  const said = turns
    .filter((t) => t.role === 'user')
    .slice(-2)
    .map((t) => t.text)
    .join(' ')
  return detectLang(said, lang)
}

/**
 * id → карточка товара. Несуществующий id молча выбрасывается: если модель
 * выдумала товар, покупатель хотя бы не увидит ссылку в никуда.
 */
function hits(ids: string[], lang: Lang, list: Product[]): ProductHit[] {
  const find = lookupIn(list)
  return ids
    .map((id) => find(id))
    .filter((product): product is NonNullable<typeof product> => Boolean(product))
    .map((product) => toHit(product, lang))
}
