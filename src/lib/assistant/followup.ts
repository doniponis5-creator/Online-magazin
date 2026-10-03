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
import { mentionsFreeDelivery } from './policy'

export type FollowUp = { text: string } | { skip: 'ordered' | 'no-product' | 'not-shown' }

export async function followUp(turns: ChatTurn[], shown: string[], lang: Lang, name?: string): Promise<FollowUp> {
  const lastAnswer = [...turns].reverse().find((t) => t.role === 'assistant')?.text ?? ''
  // Ссылка на оплату в последнем ответе — заказ уже оформлен, напоминать не о чем.
  // Карта магазина или склада (Google Maps, 2ГИС) — не оплата: напоминать можно.
  if (/https?:\/\/(?!2gis\.kg|maps\.app\.goo\.gl)/.test(lastAnswer)) return { skip: 'ordered' }
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
  // «Бесплатно» — только если покупатель назвал город из списка: Таласу и Нарыну
  // доставку считает руководство, обещать её даром нельзя (владелец, 21.09; аудит 03.10).
  const free = mentionsFreeDelivery(turns.filter((t) => t.role === 'user').map((t) => t.text).join(' '))
  // Не «оформим сегодня?» — человек замолчал, значит, что-то держит. Продавец спрашивает,
  // что смущает, а не торопит (владелец 03.10: «оформит қилайлик деб сўрамасин»).
  const say = {
    ru: `${who}${title} за ${price} — ещё думаете? Если что-то смущает, напишите — подскажу.`,
    ky: `${who}${title} ${price} — дагы ойлонуп жатасызбы? Суроо болсо жазыңыз, жардам берем.`,
    uz: `${who}${title} ${price} — хали уйлаяпсизми? Савол булса ёзинг, ёрдам бераман.`,
  }
  const freeLine = {
    ru: ' До центра района привезём бесплатно.',
    ky: ' Райондун борборуна чейин акысыз жеткиребиз.',
    uz: ' Район марказигача бепул олиб борамиз.',
  }
  const text = say[talk] + (free ? freeLine[talk] : '')
  return { text: text.charAt(0).toUpperCase() + text.slice(1) }
}
