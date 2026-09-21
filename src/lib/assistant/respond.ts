import 'server-only'

/**
 * Один ответ продавца — для любого канала: чат на сайте и WhatsApp.
 *
 * Сначала шаги без модели (оформление заказа, «перезвоните»), потом
 * консультант. Каналы отличаются только тем, откуда известен покупатель: на
 * сайте — из входного cookie, в WhatsApp — из номера, с которого он пишет
 * (номер подтверждён самим WhatsApp).
 */

import type { Lang } from '@/lib/i18n/config'
import { answer, talkLang } from './reply'
import { AFFIRM, BUY_INTENT, OFFER, cancel, hasDraft, start, step } from '@/lib/telegram/order'
import { CALL_INTENT, cancelLead, hasLead, leadContext, leadStep, startLead } from './leads'
import { lookupIn, salesCatalogNow } from './live'
import type { ChatTurn } from './gemini'
import type { CustomerBrief, ProductHit } from './knowledge'
import { getInstallment, getProfile } from '@/lib/customer/gateway'

export type Reply = {
  text: string
  products: ProductHit[]
  source: 'gemini' | 'local' | 'flow'
  /** покупатель попросил живого человека — заявка ушла сотруднику */
  handoff?: boolean
}

export type Channel = {
  /** ключ разговора: «web:<вкладка>», «wa:<телефон>» */
  key: string
  /** пишется в комментарий заказа */
  orderSource: string
  leadChannel: 'site' | 'telegram' | 'whatsapp'
  /** что точно известно о покупателе */
  known: { name?: string; phone?: string }
}

export async function respond(
  channel: Channel,
  turns: ChatTurn[],
  lang: Lang,
  customer: CustomerBrief | null,
  buy?: unknown,
  shown?: unknown,
): Promise<Reply> {
  const flow = await salesFlow(channel, turns, lang, customer, buy, shown)
  if (flow) return flow
  return await answer(turns, lang, customer)
}

/**
 * Продавец доводит до покупки: «Заказать» у карточки, «беру», «да» на
 * «оформим?» — и заказ оформляется прямо в разговоре; «перезвоните» — номер
 * уходит сотруднику. null — это обычный вопрос, отвечает консультант.
 */
async function salesFlow(
  channel: Channel,
  turns: ChatTurn[],
  lang: Lang,
  customer: CustomerBrief | null,
  buy: unknown,
  shownRaw: unknown,
): Promise<Reply | null> {
  const { key, known, orderSource } = channel
  const text = turns[turns.length - 1]?.text ?? ''
  const talk = talkLang(turns, lang)
  const only = (reply: string, handoff = false): Reply => ({ text: reply, products: [], source: 'flow', handoff })
  const who = { name: known.name ?? customer?.name, phone: known.phone }

  // Передумал посреди шагов — выходим, не доспрашивая.
  if (/^(отмена|стоп|bekor|токтот|жок|cancel|не надо)$/i.test(text.trim()) && (hasDraft(key) || hasLead(key))) {
    cancel(key)
    cancelLead(key)
    return only(
      talk === 'ky' ? 'Макул, токтоттук. Дагы эмне керек?' : talk === 'uz' ? "Mayli, to'xtatdik. Yana nima kerak?" : 'Хорошо, отменил. Чем ещё помочь?',
    )
  }

  const lead = await leadStep(key, text, talk)
  if (lead) return only(lead, true)

  const ongoing = await step(key, text, talk, lang)
  if (ongoing) return only(ongoing)

  const shown = Array.isArray(shownRaw) ? shownRaw.filter((x): x is string => typeof x === 'string').slice(0, 3) : []
  const find = lookupIn(await salesCatalogNow())
  const shownNames = shown.map((id) => find(id)?.nameRu).filter((x): x is string => Boolean(x))

  if (typeof buy === 'string' && find(buy)) {
    cancelLead(key)
    return only(await start(key, [buy], talk, orderSource, who))
  }

  if (CALL_INTENT.test(text)) {
    cancel(key)
    const questions = turns.filter((t) => t.role === 'user').map((t) => t.text)
    const reply = await startLead(key, talk, leadContext(questions, shownNames), who, channel.leadChannel)
    // Номер уже известен — заявка ушла сразу, дальше разговор ведёт человек.
    return only(reply, Boolean(who.phone))
  }

  // «беру», «куда платить» — или «да» сразу после того, как консультант предложил оформить.
  const lastAnswer = [...turns].reverse().find((t) => t.role === 'assistant')?.text ?? ''
  if (shown.length > 0 && (BUY_INTENT.test(text) || (AFFIRM.test(text) && OFFER.test(lastAnswer)))) {
    return only(await start(key, shown, talk, orderSource, who))
  }
  return null
}

/**
 * Что консультант знает о покупателе — имя, бонусы, заказы, рассрочка.
 *
 * phone — ТОЛЬКО подтверждённый: из входного cookie сайта или номер, с
 * которого человек пишет в WhatsApp. Номер, написанный в тексте, сюда не
 * попадает никогда: иначе любой узнал бы чужие заказы и долг.
 */
export async function customerBrief(phone: string | undefined): Promise<CustomerBrief | null> {
  if (!phone) return null
  try {
    const [profile, installment] = await Promise.all([
      getProfile(phone, 0, true),
      // Рассрочка — отдельный запрос: сервер без неё не должен ломать чат.
      getInstallment(phone).catch((error) => {
        console.error('[assistant] рассрочка:', error instanceof Error ? error.message : error)
        return null
      }),
    ])
    if (!profile) return null
    return {
      installment: installment && {
        debt: installment.debt,
        overdue: installment.overdue,
        nextDate: installment.nextDate,
        nextAmount: installment.nextAmount,
        monthsLeft: installment.monthsLeft,
        asOf: installment.asOf ? installment.asOf.slice(0, 10) : null,
      },
      name: profile.name,
      balance: profile.balance,
      maxSpendPct: profile.maxSpendPct,
      orders: (profile.orders ?? []).map((o) => ({
        id: o.orderId,
        status: o.status,
        total: o.total,
        createdAt: o.createdAt,
      })),
    }
  } catch (error) {
    console.error('[assistant] профиль покупателя:', error instanceof Error ? error.message : error)
    return null
  }
}

/** Сколько сообщений разговора отдаём модели. Дальше платим за чужую историю. */
const MAX_TURNS = 12
const MAX_CHARS = 800

export function readTurns(value: unknown): ChatTurn[] {
  if (!Array.isArray(value)) return []
  const turns: ChatTurn[] = []
  for (const item of value.slice(-MAX_TURNS)) {
    if (!item || typeof item !== 'object') continue
    const row = item as { role?: unknown; text?: unknown }
    const text = typeof row.text === 'string' ? row.text.trim().slice(0, MAX_CHARS) : ''
    if (!text) continue
    turns.push({ role: row.role === 'assistant' ? 'assistant' : 'user', text })
  }
  // Модель ждёт разговор, который начинается с вопроса покупателя.
  while (turns.length > 0 && turns[0].role !== 'user') turns.shift()
  return turns
}
