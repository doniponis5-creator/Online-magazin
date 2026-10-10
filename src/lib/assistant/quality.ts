/**
 * Недельная оценка качества: Jev читает каждый разговор WhatsApp за неделю и
 * отвечает, чем он кончился, почему не купили и ошибся ли бот. Владелец в
 * понедельник получает короткий итог — как в колл-центре, где каждую неделю
 * слушают звонки и считают, сколько людей ушло и почему.
 *
 * В Jev уходит только текст переписки (последние реплики), без номера и имени.
 * Нет ключа JEV_API_KEY — отчёта нет.
 */
import 'server-only'
import { askJev } from './jev'
import type { ChatTurn } from './gemini'
import { chatOf } from './hot'

export type Outcome = 'ordered' | 'later' | 'left' | 'not_customer' | 'unclear'
export type Reason = 'price' | 'money' | 'no_product' | 'delivery' | 'trust' | 'bot_error' | 'waited' | 'other'
export type Rated = { phone: string; outcome: Outcome; reason: Reason; botOk: number; last: string }

const QUESTIONS = {
  outcome: {
    type: 'choice',
    instructions: 'Переписка магазина электроники с человеком в WhatsApp в поле `chat` (К — покупатель, Б — продавец). Чем она кончилась?',
    criteria: {
      ordered: 'Покупатель оформил заказ, оплатил или договорился о покупке',
      later: 'Покупатель интересовался, но отложил: подумает, посоветуется, купит позже',
      left: 'Покупатель спрашивал о товаре, но перестал отвечать или отказался',
      not_customer: 'Это не покупатель нового товара: знакомый, платёж по рассрочке, жалоба на старую покупку, спам',
      unclear: 'Понять нельзя',
    },
  },
  reason: {
    type: 'choice',
    instructions: 'Если покупатель из переписки `chat` не купил — главная причина?',
    criteria: {
      price: 'Дорого',
      money: 'Нет денег сейчас, ждёт зарплату',
      no_product: 'Нужного товара, цвета или модели нет',
      delivery: 'Доставка: далеко, долго, платно, не в его город',
      trust: 'Не доверяет: боится обмана, хочет платить при получении',
      bot_error: 'Продавец ответил неправильно, не понял вопрос, не на том языке, повторялся или торопил',
      waited: 'Покупателю долго не отвечали или не ответили на вопрос',
      other: 'Другая причина, или покупатель купил',
    },
  },
  bot_ok: {
    type: 'noul',
    instructions: 'Отвечал ли продавец (Б) в переписке `chat` правильно и вежливо: по существу вопроса, на языке покупателя, без повторов и без давления?',
  },
} as const

type Answer = { choice?: unknown; noul?: unknown }

/**
 * Переписка → строка для Jev: последние реплики, коротко. Та же, что у «Кому позвонить» (hot.ts chatOf): без
 * номеров и без ответов на «как вас зовут / улица и дом» — раньше в недельный отчёт уходили телефоны и адреса из анкет.
 */
export function chatText(turns: ChatTurn[]): string {
  return chatOf(turns)
}

export function parseRating(data: unknown, phone: string, last: string): Rated | null {
  const a = (data as { answers?: Record<string, Answer> } | null)?.answers
  const outcome = a?.outcome?.choice
  if (typeof outcome !== 'string' || !(outcome in QUESTIONS.outcome.criteria)) return null
  const reason = typeof a?.reason?.choice === 'string' && a.reason.choice in QUESTIONS.reason.criteria ? (a.reason.choice as Reason) : 'other'
  const botOk = Number(a?.bot_ok?.noul)
  return { phone, outcome: outcome as Outcome, reason, botOk: Number.isFinite(botOk) ? botOk : 0.5, last }
}

export async function rateChats(chats: { phone: string; turns: ChatTurn[] }[]): Promise<Rated[]> {
  const out: Rated[] = []
  const queue = chats.filter((c) => c.turns.some((t) => t.role === 'user'))
  const worker = async () => {
    for (let next = queue.shift(); next; next = queue.shift()) {
      const data = await askJev({ chat: chatText(next.turns) }, QUESTIONS, 8000)
      const last = [...next.turns].reverse().find((t) => t.role === 'user')?.text ?? ''
      const rated = data ? parseRating(data, next.phone, last) : null
      if (rated) out.push(rated)
    }
  }
  await Promise.all(Array.from({ length: 6 }, worker))
  return out
}

const REASON: Record<Reason, string> = {
  price: 'дорого',
  money: 'нет денег сейчас',
  no_product: 'нет нужного товара',
  delivery: 'доставка',
  trust: 'не доверяют',
  bot_error: 'бот ответил не так',
  waited: 'долго не отвечали',
  other: 'другое',
}

function clip(text: string, max: number): string {
  const one = text.replace(/^\[[^\]]*\]\s*/, '').replace(/\s+/g, ' ').trim()
  return one.length > max ? one.slice(0, max - 1) + '…' : one
}

/** Итог недели для WhatsApp владельца. */
export function qualityText(all: Rated[], from: string, to: string): string {
  // «Непонятно, чем кончилось», но причина есть («кымбат экен…») — это покупатель, который ушёл.
  const rated = all.map((r) => (r.outcome === 'unclear' && r.reason !== 'other' ? { ...r, outcome: 'left' as const } : r))
  const buyers = rated.filter((r) => r.outcome !== 'not_customer' && r.outcome !== 'unclear')
  const count = (o: Outcome) => buyers.filter((r) => r.outcome === o).length
  const lost = buyers.filter((r) => r.outcome !== 'ordered')
  const reasons = new Map<Reason, number>()
  for (const r of lost) if (r.reason !== 'other') reasons.set(r.reason, (reasons.get(r.reason) ?? 0) + 1)
  const top = [...reasons.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
  const botBad = rated.filter((r) => r.outcome !== 'not_customer' && (r.botOk < 0.4 || r.reason === 'bot_error' || r.reason === 'waited'))
  const pct = (n: number) => (buyers.length ? Math.round((n / buyers.length) * 100) : 0)

  const lines = [
    `📊 Консультант за неделю (${from} – ${to})`,
    '━━━━━━━━━━━━━━━━━━━',
    `Покупателей в WhatsApp: ${buyers.length}`,
    `✅ Оформили: ${count('ordered')} (${pct(count('ordered'))}%)`,
    `⏳ Отложили: ${count('later')}`,
    `🚪 Ушли: ${count('left')}`,
  ]
  if (top.length > 0) lines.push('', 'Почему не купили:', ...top.map(([r, n]) => `• ${REASON[r]} — ${n}`))
  if (botBad.length > 0) {
    lines.push('', `🤖 Бот ошибся или долго не отвечали — ${botBad.length}:`)
    for (const r of botBad.slice(0, 8)) lines.push(`• +${r.phone} — «${clip(r.last, 70)}»`)
  }
  const others = rated.filter((r) => r.outcome === 'not_customer').length
  if (others > 0) lines.push('', `Не покупатели (знакомые, рассрочка, жалобы): ${others}`)
  lines.push('', 'Оценку делает Jev по переписке — это подсказка, а не точный счёт.')
  return lines.join('\n')
}
