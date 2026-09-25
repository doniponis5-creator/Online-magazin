import 'server-only'

/**
 * Один ответ консультанта: сначала Gemini, при любой осечке — запасной режим.
 *
 * Правило простое: чат никогда не остаётся без ответа. Кончился лимит у
 * Gemini, пропал интернет на сервере, ключ не вписан — покупатель всё равно
 * получит поиск по каталогу и телефон магазина.
 */

import { lookupIn, salesCatalogNow } from './live'
import { ownerNotes } from './notes'
import { cheaperThan } from './budget'
import type { Product } from '@/data/products'
import type { Lang } from '@/lib/i18n/config'
import { askGemini, geminiConfigured, type ChatTurn } from './gemini'
import { dayBudgetLeft } from './limits'
import { toHit, type CustomerBrief, type ProductHit } from './knowledge'
import { localAnswer, parseAnswer, type Audience } from './local'
import { detectLang, type TalkLang } from './talk'
import { systemInstruction } from './prompt'

export type AssistantReply = {
  text: string
  products: ProductHit[]
  /** gemini — отвечала модель; local — запасной режим по каталогу */
  source: 'gemini' | 'local'
  /** кому адресовано сообщение покупателя — решает модель (WhatsApp) */
  audience?: Audience
}

export async function answer(
  turns: ChatTurn[],
  lang: Lang,
  customer: CustomerBrief | null = null,
  /** id товара, страница которого сейчас открыта у покупателя */
  page?: string,
  /** имя, которое уже известно (WhatsApp: из телефона владельца или профиля) */
  knownName?: string,
): Promise<AssistantReply> {
  const lastQuestion = [...turns].reverse().find((t) => t.role === 'user')?.text ?? ''
  // Каталог берём сегодняшний: из 1С, если сервер настроен, иначе вшитый.
  const [list, notes] = await Promise.all([salesCatalogNow(), ownerNotes()])
  const viewing = page ? (lookupIn(list)(page) ?? null) : null
  // Товары ищем по трём последним вопросам: «а какой из них тише?» без
  // прошлого вопроса про стиральные машины ничего не найдёт.
  const recent = turns
    .filter((t) => t.role === 'user')
    .slice(-3)
    .map((t) => t.text)
    .join(' ')

  if (geminiConfigured() && dayBudgetLeft()) {
    try {
      const lastAnswer = [...turns].reverse().find((t) => t.role === 'assistant')?.text ?? ''
      const ceiling = cheaperThan(lastQuestion, lastAnswer)
      const raw = await askGemini(systemInstruction(lang, customer, talkLang(turns, lang), list, recent, notes, ceiling, viewing, knownName), turns)
      const parsed = parseAnswer(raw)
      const talk = talkLang(turns, lang)
      return { text: houseStyle(parsed.text, talk), products: hits(parsed.productIds, lang, list), source: 'gemini', audience: parsed.audience }
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
export function talkLang(turns: ChatTurn[], lang: Lang) {
  const said = turns
    .filter((t) => t.role === 'user')
    .slice(-2)
    .map((t) => ownWords(t.text))
    .join(' ')
  return detectLang(said, lang)
}

/**
 * Слова самого покупателя. Описание фото пишет модель по-русски — по нему
 * язык не определить; считаются только подпись под фото и голосовое.
 */
function ownWords(text: string): string {
  if (!text.startsWith('[Фото]')) return text.replace(/^\[Голосовое\]\s*/, '')
  const caption = text.split('Подпись покупателя:')[1]
  return caption?.trim() ?? ''
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

/**
 * Правила дома, которые модель иногда нарушает, — правим на выходе:
 *  • узбекский — без ў, ғ, қ, ҳ (так здесь пишут все);
 *  • кто перезвонит — «руководство», не «сотрудник», «кызматкер», «ходим», «рахбарият», «жетекчилик».
 */
const RU_ENDING: Record<string, string> = {
  '': 'о', у: 'у', а: 'а', ом: 'ом', е: 'е', и: 'о', ы: 'о', ами: 'ом', ам: 'у', ах: 'е', ов: 'а',
}
const KY_ENDING: Record<string, string> = {
  '': '', ке: 'го', ге: 'го', га: 'го', тен: 'дон', ден: 'дон', дан: 'дон', тин: 'нун', дин: 'нун', нин: 'нун', ти: 'ну', ди: 'ну', ни: 'ну',
}
const UZ_ENDING: Record<string, string> = { '': '', га: 'га', ни: 'ни', нинг: 'нинг', дан: 'дан' }

function keepCase(sample: string, word: string): string {
  return /^[А-ЯЁ]/.test(sample) ? word.charAt(0).toUpperCase() + word.slice(1) : word
}

export function houseStyle(text: string, talk: TalkLang): string {
  let out = text
  if (talk === 'uz') {
    const map: Record<string, string> = { ў: 'у', ғ: 'г', қ: 'к', ҳ: 'х', Ў: 'У', Ғ: 'Г', Қ: 'К', Ҳ: 'Х' }
    out = out.replace(/[ўғқҳЎҒҚҲ]/g, (ch) => map[ch] ?? ch)
  }
  out = out.replace(/(?<![\p{L}])(сотрудник|менеджер|оператор)(ами|ам|ах|ов|ом|у|а|е|и|ы)?(?![\p{L}])/giu, (m, _w, end = '') =>
    keepCase(m, 'руководств' + (RU_ENDING[end.toLowerCase()] ?? 'о')),
  )
  out = out.replace(/(?<![\p{L}])(жетекчилик|кызматкер(?:лер)?(?:ибиз)?)(ке|ге|га|тен|ден|дан|тин|дин|нин|ти|ди|ни)?(?![\p{L}])/giu, (m, _w, end = '') =>
    keepCase(m, 'руководство' + (KY_ENDING[end.toLowerCase()] ?? '')),
  )
  out = out.replace(/(?<![\p{L}])(рахбарият|ходим(?:лар)?(?:имиз)?)(нинг|га|ни|дан)?(?![\p{L}])/giu, (m, _w, end = '') =>
    keepCase(m, 'руководство' + (UZ_ENDING[end.toLowerCase()] ?? '')),
  )
  return out
}
