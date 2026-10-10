import 'server-only'

/**
 * «Кому позвонить сегодня» — для утренней сводки (Jev, 04.10). Каждое утро Jev читает вчерашние
 * разговоры WhatsApp и Instagram и отвечает: насколько человек был близок к покупке и что его
 * остановило. Владелец видит не «312 вопросов», а пять людей, которые почти купили, — и что им
 * предложить: рассрочку, похожий товар, напомнить после зарплаты.
 *
 * В Jev уходит только текст переписки (последние реплики, цепочки цифр — «…»): без номера и имени.
 * Номер или подпись «Instagram @ник» остаются на нашей стороне и попадают только в сводку владельцу.
 */

import { askJev } from './jev'
import { hideDigits } from './log'
import type { ChatTurn } from './gemini'

export type Stage = 'hot' | 'warm' | 'cold' | 'bought' | 'not_customer'
export type Why = 'price' | 'money' | 'family' | 'think' | 'delivery' | 'trust' | 'no_product' | 'waiting' | 'none'
export type Hot = { who: string; stage: Stage; why: Why; sure: number; last: string; product: string }

const QUESTIONS = {
  stage: {
    type: 'choice',
    instructions:
      'Переписка магазина электроники с человеком в поле `chat` (К — человек, Б — магазин). Насколько человек был близок к покупке и купил ли?',
    criteria: {
      hot: 'Был готов купить: выбрал товар, спрашивал оплату, доставку в свой город, адрес, рассрочку, «как заказать» — но заказ не оформлен и не оплачен',
      warm: 'Интересовался конкретным товаром, но отложил: подумает, спросит семью, нет денег сейчас, купит позже',
      cold: 'Только спросил цену или наличие и пропал, или ему ничего не подошло',
      bought: 'Оформил заказ, оплатил, договорился приехать и забрать',
      not_customer: 'Не покупатель нового товара: знакомый, работник, платёж по рассрочке, жалоба на старую покупку, спам, реклама',
    },
  },
  why: {
    type: 'choice',
    instructions: 'Что остановило человека из переписки `chat` от покупки (если не купил)?',
    criteria: {
      price: 'Дорого, ищет дешевле',
      money: 'Нет денег сейчас, ждёт зарплату',
      family: 'Хочет посоветоваться с семьёй',
      think: 'Хочет подумать или сравнить, причину не назвал',
      delivery: 'Доставка: далеко, платно, долго, не в его город',
      trust: 'Не доверяет: боится обмана, хочет платить при получении, хочет сначала увидеть',
      no_product: 'Нужного товара, цвета или размера нет',
      waiting: 'Ждал ответа магазина на свой вопрос и не дождался',
      none: 'Ничего не остановило, купил, или понять нельзя',
    },
  },
} as const

/** Бот спросил имя, номер или адрес — ответ покупателя в Jev не отдаём (ревью 04.10: туда уходили имя и улица). */
const ASKED_PERSONAL =
  /(как вас зовут|как к вам обращаться|ваше имя|атыңыз|атыныз|исмингиз|ismingiz|номер телефона|ваш номер|телефон номер|телефон ракам|улица и дом|адрес:|көчө жана үй|кочо жана уй|куча ва уй|кайда жеткирели|куда везти|куда привезти|каерга олиб|qayerga olib|улицу и номер дома|көчөнүн атын|куча номи)/i

/** Последние реплики разговора — коротко, без номеров и без ответов на «как вас зовут / адрес». */
export function chatOf(turns: ChatTurn[]): string {
  const recent = turns.slice(-12)
  return hideDigits(
    recent
      .map((t, i) => {
        const asked = i > 0 && recent[i - 1].role === 'assistant' && ASKED_PERSONAL.test(recent[i - 1].text)
        const text = t.role === 'user' && asked ? '[ответ скрыт]' : t.text.replace(/\s+/g, ' ').slice(0, 300)
        return `${t.role === 'user' ? 'К' : 'Б'}: ${text}`
      })
      .join('\n'),
  ).slice(-3500)
}

/** Сколько разговоров оцениваем и сколько секунд ждём: сервер ждёт ответа 150 с (ревью 04.10). */
const HOT_MAX = 80
const HOT_DEADLINE_MS = 90_000

export function parseHot(data: unknown, who: string, last: string, product: string): Hot | null {
  const a = (data as { answers?: Record<string, { choice?: unknown; confidence?: unknown }> } | null)?.answers
  const stage = a?.stage?.choice
  if (typeof stage !== 'string' || !(stage in QUESTIONS.stage.criteria)) return null
  const why = typeof a?.why?.choice === 'string' && a.why.choice in QUESTIONS.why.criteria ? (a.why.choice as Why) : 'none'
  const sure = Number(a?.stage?.confidence)
  return { who, stage: stage as Stage, why, sure: Number.isFinite(sure) ? sure : 0, last, product }
}

export async function rateHot(chats: { who: string; turns: ChatTurn[]; product: string }[], deadline = Date.now() + HOT_DEADLINE_MS): Promise<Hot[]> {
  const out: Hot[] = []
  // Сначала те, кому показывали товар, и длинные разговоры — среди них почти купившие.
  const asked = (c: { turns: ChatTurn[] }) => c.turns.filter((t) => t.role === 'user').length
  const queue = chats
    .filter((c) => asked(c) > 0)
    .sort((a, b) => Number(Boolean(b.product)) - Number(Boolean(a.product)) || asked(b) - asked(a))
    .slice(0, HOT_MAX)
  const worker = async () => {
    // Время вышло — новых не начинаем: лучше часть списка в сводке, чем пустая сводка.
    for (let next = queue.shift(); next && Date.now() < deadline; next = queue.shift()) {
      const data = await askJev({ chat: chatOf(next.turns) }, QUESTIONS, 8000)
      const last = [...next.turns].reverse().find((t) => t.role === 'user')?.text ?? ''
      const rated = data ? parseHot(data, next.who, last, next.product) : null
      if (rated) out.push(rated)
    }
  }
  await Promise.all(Array.from({ length: 6 }, worker))
  return out
}

/** Что предложить, по причине — только то, что есть в правилах магазина (рассрочка банка, похожий товар). */
const ADVICE: Record<Why, string> = {
  price: 'предложите дешевле или рассрочку MIslamic без переплаты',
  money: 'напомните про рассрочку или после зарплаты',
  family: 'спросите, что решили дома',
  think: 'спросите, что смущает',
  delivery: 'объясните доставку в его город',
  trust: 'позвоните голосом, пригласите в магазин',
  no_product: 'предложите похожий товар',
  waiting: 'ответьте на его вопрос',
  none: 'позвоните',
}

function clip(text: string, max: number): string {
  const one = text.replace(/^\[[^\]]*\]\s*/, '').replace(/\s+/g, ' ').trim()
  return one.length > max ? one.slice(0, max - 1) + '…' : one
}

/** Блок сводки: «🔥 Позвоните сегодня» и «⏳ Отложили». Никого нет — пустой массив. */
export function hotLines(rated: Hot[], limit = 8): string[] {
  const line = (h: Hot) =>
    `• ${h.who}${h.product ? ` — ${h.product}` : ''} — ${ADVICE[h.why]}\n  «${clip(h.last, 70)}»`
  const hot = rated.filter((h) => h.stage === 'hot').sort((a, b) => b.sure - a.sure)
  const warm = rated.filter((h) => h.stage === 'warm').sort((a, b) => b.sure - a.sure)
  const lines: string[] = []
  if (hot.length > 0) lines.push(`🔥 Позвоните сегодня — были готовы купить (${hot.length}):`, ...hot.slice(0, limit).map(line))
  if (warm.length > 0) {
    if (lines.length > 0) lines.push('')
    lines.push(`⏳ Отложили — напомнить (${warm.length}):`, ...warm.slice(0, limit).map(line))
  }
  if (lines.length > 0) lines.push('', 'Отбор делает Jev по переписке — это подсказка, а не точный список.')
  return lines
}
