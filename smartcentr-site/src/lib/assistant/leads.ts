import 'server-only'

/**
 * «Перезвоните мне» — живой человек вместо робота.
 *
 * Покупатель просит менеджера, хочет, чтобы ему позвонили, или уходит, так и
 * не купив. Такого человека терять нельзя: он уже почти покупатель. Берём
 * номер (вошёл на сайт — номер уже есть, не спрашиваем) и отправляем владельцу
 * в WhatsApp вместе с пересказом разговора — чтобы не переспрашивать «а что вы
 * хотели?».
 *
 * Как и заказ, это делается без языковой модели: номер телефона — не то место,
 * где можно что-то придумать.
 */

import { callServer, paymentMode } from '@/lib/orders/gateway'
import { store } from '@/lib/store'
import type { ChatKey } from '@/lib/telegram/order'
import type { TalkLang } from './talk'

type Say = { ru: string; ky: string; uz: string }
const pick = (say: Say, lang: TalkLang) => say[lang]

/** Просит живого человека или звонок. Три языка, как пишут на самом деле. */
export const CALL_INTENT =
  /(перезвон|позвоните мне|позвонить мне|свяжитесь со мной|свяжитесь|менеджер|оператор|живой человек|живым человеком|с человеком|консультант.{0,10}человек|чалып кой|мага чал|чалыңыз мага|менеджер менен|qo.?ng.?iroq qiling menga|menga qo.?ng.?iroq|menga tel|qo.?ng.?iroq qilib|odam bilan|operator|menejer|телефон қилинг|менга қўнғироқ|телефон килинг|менга кунгирок|кунгирок килинг|одам билан|менежер|оператор билан)/i

type Draft = { context: string; name?: string; channel: 'site' | 'telegram' | 'whatsapp' }
const drafts = store('lead-drafts', () => new Map<ChatKey, Draft>())

const ASK_PHONE: Say = {
  ru: 'Конечно, руководство вам перезвонит. Напишите номер телефона, например 0555 123456.',
  ky: 'Албетте, руководство сизге чалат. Телефон номериңизди жазыңыз, мисалы 0555 123456.',
  uz: 'Албатта, руководство сизга кунгирок килади. Телефон ракамингизни ёзинг, масалан 0555 123456.',
}

const BAD_PHONE: Say = {
  ru: 'Номер не похож на настоящий. Напишите ещё раз, например 0555 123456 — или «отмена».',
  ky: 'Номер туура эмес окшойт. Кайра жазыңыз, мисалы 0555 123456 — же «жок».',
  uz: 'Ракам тугри эмасга ухшайди. Кайтадан ёзинг, масалан 0555 123456 — ёки «бекор».',
}

const SENT: Say = {
  ru: 'Готово — передал руководству, вам перезвонят в рабочее время. Пока можно продолжать спрашивать здесь.',
  ky: 'Даяр — руководствого айтып койдум, иш убагында сизге чалат. Азырынча бул жерден сурай бериңиз.',
  uz: 'Тайёр — руководствога айтдим, иш вактида сизга кунгирок килишади. Хозирча шу ерда сурашда давом этишингиз мумкин.',
}

const FAILED: Say = {
  ru: 'Не получилось передать. Позвоните нам сами, пожалуйста: +996 557 100 505.',
  ky: 'Өткөрүү болбой калды. Өзүңүз чалыңызчы: +996 557 100 505.',
  uz: 'Етказиб булмади. Узингиз кунгирок килинг, илтимос: +996 557 100 505.',
}

export function hasLead(key: ChatKey): boolean {
  return drafts.has(key)
}

export function cancelLead(key: ChatKey): void {
  drafts.delete(key)
}

/**
 * Начать заявку. context — пересказ разговора для сотрудника.
 * Номер известен (вошёл на сайте) — отправляем сразу.
 */
export async function startLead(
  key: ChatKey,
  lang: TalkLang,
  context: string,
  known: { name?: string; phone?: string } = {},
  channel: 'site' | 'telegram' | 'whatsapp' = 'site',
): Promise<string> {
  if (known.phone) {
    return (await sendLead({ name: known.name, phone: known.phone, context, channel })) ? pick(SENT, lang) : pick(FAILED, lang)
  }
  drafts.set(key, { context, name: known.name, channel })
  return pick(ASK_PHONE, lang)
}

/** Покупатель прислал номер. null — заявки в работе нет. */
export async function leadStep(key: ChatKey, text: string, lang: TalkLang): Promise<string | null> {
  const draft = drafts.get(key)
  if (!draft) return null
  const digits = text.replace(/\D/g, '')
  if (digits.length < 9 || digits.length > 12) return pick(BAD_PHONE, lang)
  drafts.delete(key)
  const ok = await sendLead({ name: draft.name, phone: text.trim(), context: draft.context, channel: draft.channel })
  return ok ? pick(SENT, lang) : pick(FAILED, lang)
}

async function sendLead(lead: { name?: string; phone: string; context: string; channel: string }): Promise<boolean> {
  if (paymentMode() === 'mock') {
    console.info('[lead] тестовый режим, заявка:', lead.phone, lead.context.slice(0, 200))
    return true
  }
  try {
    await callServer('/api/v1/webhook/site/lead', {
      method: 'POST',
      body: { name: lead.name ?? '', phone: lead.phone, text: lead.context, channel: lead.channel },
    })
    return true
  } catch (error) {
    console.error('[lead] не отправлено:', error instanceof Error ? error.message : error)
    return false
  }
}

/** Пересказ для сотрудника: что спрашивал и какие товары ему показали. */
export function leadContext(questions: string[], products: string[]): string {
  const asked = questions
    .map((q) => q.trim())
    .filter(Boolean)
    .slice(-4)
    .map((q) => `• ${q.slice(0, 200)}`)
  const lines = asked.length > 0 ? ['Спрашивал:', ...asked] : []
  if (products.length > 0) lines.push('', `Смотрел: ${products.slice(0, 3).join(', ')}`)
  return lines.join('\n') || 'Попросил перезвонить.'
}
