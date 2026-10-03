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
import { shortName } from '@/lib/telegram/order'
import { mentionsFreeDelivery } from './policy'

export type FollowUp = { text: string } | { skip: 'ordered' | 'no-product' | 'not-shown' | 'declined' }

/** Покупатель уехал или отказался: «Россияга кетем», «жок рахмат», «керакмас». */
const GONE = /(росси|кетем|кетип жатам|кетаман|кетяпман|уезжаю|уеду|жок,? рахмат|йук,? рахмат|нет,? спасибо|не надо|керек эмес|керакмас|kerak emas)/iu
/** Бот уже попрощался: напоминание после «жакшы барып келиңиз» выглядит как рассылка. */
const BYE = /(барып келиңиз|ден соолук|всего доброго|саломат булинг|хайр|до свидания|сапарыңыз|яхши бориб келинг)/iu

export async function followUp(turns: ChatTurn[], shown: string[], lang: Lang, name?: string): Promise<FollowUp> {
  const lastAnswer = [...turns].reverse().find((t) => t.role === 'assistant')?.text ?? ''
  // Ссылка на оплату в последнем ответе — заказ уже оформлен, напоминать не о чем.
  // Карта магазина или склада (Google Maps, 2ГИС) — не оплата: напоминать можно.
  if (/https?:\/\/(?!2gis\.kg|maps\.app\.goo\.gl)/.test(lastAnswer)) return { skip: 'ordered' }
  if (shown.length === 0) return { skip: 'not-shown' }
  // «Мен эртең Россияга кетем» — бот попрощался «жакшы барып келиңиз», а через два часа
  // спросил «дагы керекпи?» (переписка 30.09). Отказался или уехал — не напоминаем.
  const lastAsk = [...turns].reverse().find((t) => t.role === 'user')?.text ?? ''
  if (GONE.test(lastAsk) || BYE.test(lastAnswer)) return { skip: 'declined' }

  const find = lookupIn(await salesCatalogNow())
  const product = shown.map(find).find((p) => p && p.price > 0)
  if (!product) return { skip: 'no-product' }

  const talk = talkLang(turns, lang)
  // Без имени: в телефоне владельца оно записано как «Жанатим. Онам», «Ааааааа»,
  // «Ойбек ака налог», а в профиле WhatsApp — «Dilshadakanvaliyeva». Обращаться так нельзя.
  void name
  const who = ''
  // Как товар называют люди: «Электро Эндуро», «FLAGMAN», а не код модели «WN-A10». Цену не повторяем:
  // её уже назвали в разговоре (владелец 03.10: «WN-A10 15 900 сом — дагы ойлонуп жатасызбы?» — не так).
  const title = spokenName(product.nameRu)
  const said = turns.filter((t) => t.role === 'assistant').map((t) => t.text).join(' ')
  // «Бесплатно» — только если покупатель назвал город из списка (Таласу и Нарыну доставку считает
  // руководство) и только если об этом ещё не говорили: повтор — это рассылка, а не продавец.
  const free = mentionsFreeDelivery(turns.filter((t) => t.role === 'user').map((t) => t.text).join(' ')) && !/(акысыз|бесплатн|бепул)/iu.test(said)
  // Не «оформим сегодня?» и не «ещё думаете?» — человек мог и не думать. Продавец спрашивает,
  // остались ли вопросы, и предлагает помощь (владелец 03.10: «оформит қилайлик деб сўрамасин»).
  const say = {
    ru: `${who}Остались вопросы по ${title}? Пишите — подскажу.`,
    ky: `${who}${title} боюнча суроо калдыбы? Жазыңыз, жардам берем.`,
    uz: `${who}${title} буйича савол колдими? Ёзинг, ёрдам бераман.`,
  }
  const freeLine = {
    ru: ' К вам привезём бесплатно.',
    ky: ' Сиз жакка акысыз жеткиребиз.',
    uz: ' Сизга бепул олиб борамиз.',
  }
  const text = say[talk] + (free ? freeLine[talk] : '')
  return { text: text.charAt(0).toUpperCase() + text.slice(1) }
}

/**
 * Название, как его говорят люди. Код модели (есть цифра: «WN-A10», «AV-80MXLB(BG)») — вон.
 * Есть марка латиницей («FLAGMAN», «AVEST») — марка; нет — русские слова («Электро Эндуро»).
 */
export function spokenName(name: string): string {
  const words = name.replace(/\*/g, '').split(/\s+/).filter((w) => w && !/\d/.test(w))
  const brand = words.find((w) => /^[A-Z][A-Z-]{2,}$/.test(w))
  if (brand) return brand
  const plain = words.filter((w) => /^[А-ЯЁа-яё-]+$/.test(w)).join(' ')
  return plain || shortName(name)
}
