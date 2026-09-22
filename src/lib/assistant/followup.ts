import 'server-only'

/**
 * «Ещё актуально?» — одно напоминание покупателю, который посмотрел товар и
 * замолчал. Так делает живой продавец; робот делал вид, что разговора не было.
 *
 * Без модели: текст один и тот же, только с названием товара и на языке
 * покупателя. Когда слать и кому — решает сервер SBonus (он видит, кто молчит
 * и сколько), здесь только текст.
 */

import type { ChatTurn } from './gemini'
import type { Lang } from '@/lib/i18n/config'
import { lookupIn, salesCatalogNow } from './live'
import { talkLang } from './reply'
import { formatSom } from '@/lib/format'

export type FollowUp = { text: string } | { skip: 'ordered' | 'no-product' | 'not-shown' }

export async function followUp(turns: ChatTurn[], shown: string[], lang: Lang, name?: string): Promise<FollowUp> {
  const lastAnswer = [...turns].reverse().find((t) => t.role === 'assistant')?.text ?? ''
  // Ссылка на оплату в последнем ответе — заказ уже оформлен, напоминать не о чем.
  if (/https?:\/\//.test(lastAnswer)) return { skip: 'ordered' }
  if (shown.length === 0) return { skip: 'not-shown' }

  const find = lookupIn(await salesCatalogNow())
  const product = shown.map(find).find((p) => p && p.price > 0)
  if (!product) return { skip: 'no-product' }

  const talk = talkLang(turns, lang)
  const who = name?.trim() ? `${name.trim().slice(0, 40)}, ` : ''
  const item = `${product.nameRu} — ${formatSom(product.price)}`
  const say = {
    ru: `${who}вы смотрели ${item}. Ещё актуально? Если остались вопросы — отвечу здесь. Оформить можно прямо в этом чате: напишите «беру».`,
    ky: `${who}${item} караган элеңиз. Дагы керекпи? Суроо болсо ушул жерде жооп берем. Заказды ушул чатта эле берсеңиз болот: «алам» деп жазыңыз.`,
    uz: `${who}${item} курган эдингиз. Хали керакми? Савол булса шу ерда жавоб бераман. Буюртмани шу чатда бериш мумкин: «оламан» деб ёзинг.`,
  }
  const text = say[talk]
  return { text: text.charAt(0).toUpperCase() + text.slice(1) }
}
