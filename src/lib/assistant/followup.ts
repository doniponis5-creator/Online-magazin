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
import { shortName } from '@/lib/telegram/order'

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
  // Без имени: в телефоне владельца оно записано как «Жанатим. Онам», «Ааааааа»,
  // «Ойбек ака налог», а в профиле WhatsApp — «Dilshadakanvaliyeva». Обращаться так нельзя.
  void name
  const who = ''
  const title = shortName(product.nameRu)
  const price = formatSom(product.price)
  const say = {
    ru: `${who}${title} за ${price} ещё актуальна? Могу оформить сегодня — до центра района привезём бесплатно.`,
    ky: `${who}${title} ${price} дагы керекпи? Бүгүн эле тариздеп берейин — райондун борборуна чейин акысыз.`,
    uz: `${who}${title} ${price} хали керакми? Бугун расмийлаштириб берайми — туман марказигача бепул.`,
  }
  const text = say[talk]
  return { text: text.charAt(0).toUpperCase() + text.slice(1) }
}
