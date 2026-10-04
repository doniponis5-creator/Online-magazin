import 'server-only'

/**
 * Сортировка сообщения до Gemini (Jev, 04.10). На WhatsApp магазина пишут не только покупатели:
 * родные, рабочие, люди с рассрочкой шлют чеки, жалуются на старую покупку. Раньше каждое такое
 * сообщение сначала читал Gemini (10 тыс. токенов), и только потом бот молчал или звал руководство.
 * Jev — маленькая модель, которая только выбирает вариант, — делает это за доли цента:
 *
 *   shop      — вопрос о покупке → как раньше, отвечает Gemini;
 *   staff     — разговор с работником о своём → «уточню у руководства» + заявка, без Gemini;
 *   personal  — не про магазин → молчим;
 *   payment   — «оплатил», чек, квитанция → «рахмат, руководство проверит» + владельцу 💳;
 *   complaint — жалоба → владельцу 🚨 сразу, а отвечает покупателю по-прежнему Gemini.
 *
 * Сомнение — всегда shop: потерять покупателя хуже, чем потратить один ответ модели. Пороги — decide(). В Jev уходят только две фразы без имени; цепочки из 6+ цифр
 * (номера телефонов, карт) заменены «…».
 */

import { askJev } from './jev'
import { hideDigits } from './log'
import type { ChatTurn } from './gemini'

export type Sort = 'shop' | 'staff' | 'personal' | 'payment' | 'complaint'
/** Вероятность 0–1 по каждому виду — Jev отвечает на пять вопросов «да/нет» сразу. */
export type Triage = Record<Sort, number>

const CONTEXT =
  'Магазин электроники и бытовой техники переписывается с людьми в WhatsApp и Instagram. `client` — что человек написал сейчас ' +
  '(«[Голосовое] …» — расшифровка голосового, «[Фото] …» — описание фото), `bot` — что магазин написал перед этим (может быть пусто).'

// Пять вопросов «да/нет», а не один выбор из пяти: на настоящих сообщениях выбор давал верный вид
// с уверенностью 0,3–0,7 (порог не пройти), «да/нет» — 10 из 11 верно и с ясным отрывом (замер 04.10).
const QUESTIONS = {
  shop: { type: 'noul', instructions: `${CONTEXT} Человек спрашивает или говорит о ПОКУПКЕ нового товара (товар, цена, наличие, доставка, заказ, рассрочка, гарантия, адрес магазина)?` },
  complaint: { type: 'noul', instructions: `${CONTEXT} Человек ЖАЛУЕТСЯ или недоволен: купленный товар сломался, не работает, мастер или работник не пришёл, привезли не то, не везут вовремя, обидели?` },
  payment: { type: 'noul', instructions: `${CONTEXT} Человек сообщает, что уже ЗАПЛАТИЛ или перевёл деньги, или прислал чек, квитанцию, скриншот перевода?` },
  personal: { type: 'noul', instructions: `${CONTEXT} Сообщение НЕ про магазин и не про покупки: семья, гостинцы, стройка, футбол, личные дела, шутки?` },
  staff: { type: 'noul', instructions: `${CONTEXT} Человек пишет знакомому работнику магазина о своём деле (отвёз, установил, встретимся, передай), а не спрашивает о товаре?` },
} as const

/** Что написал человек после последнего ответа магазина и что магазин ответил перед этим. */
function lastExchange(turns: ChatTurn[]): { client: string; bot: string } {
  const client: string[] = []
  let i = turns.length - 1
  for (; i >= 0 && turns[i].role === 'user'; i--) client.unshift(turns[i].text)
  const bot = i >= 0 ? turns[i].text : ''
  return { client: hideDigits(client.join('\n')).slice(-700), bot: hideDigits(bot).slice(-300) }
}

/**
 * Имена → «Имя»: бот обращается к покупателю по имени («Азамат, есть…»), и без этого имя ушло бы
 * в Jev (ревью 04.10). Короче двух букв и пустые — не трогаем.
 */
export function withoutNames(text: string, names: (string | undefined | null)[]): string {
  let out = text
  for (const name of new Set(names.map((n) => n?.trim()).filter((n): n is string => Boolean(n && n.length >= 2)))) {
    const safe = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    out = out.replace(new RegExp(`(?<![\\p{L}])${safe}(?![\\p{L}])`, 'giu'), 'Имя')
  }
  return out
}

/** null — Jev не настроен, не ответил за 2,5 с или ответил непонятно: тогда всё как раньше. */
export async function triage(turns: ChatTurn[], names: (string | undefined | null)[] = []): Promise<Triage | null> {
  const raw = lastExchange(turns)
  if (!raw.client.trim()) return null
  const state = { client: withoutNames(raw.client, names), bot: withoutNames(raw.bot, names) }
  return parseTriage(await askJev(state, QUESTIONS))
}

export function parseTriage(data: unknown): Triage | null {
  const answers = (data as { answers?: Record<string, { noul?: unknown }> } | null)?.answers
  if (!answers) return null
  const out = {} as Triage
  for (const kind of Object.keys(QUESTIONS) as Sort[]) {
    const p = Number(answers[kind]?.noul)
    if (!Number.isFinite(p)) return null
    out[kind] = Math.min(1, Math.max(0, p))
  }
  return out
}

/**
 * Что делать с сообщением. Сомнение — всегда 'shop' (отвечает Gemini). complaint — это тревога владельцу
 * поверх ответа, поэтому отдельно: `alarm`. Пороги подобраны на настоящих сообщениях 26.09–03.10.
 */
export function decide(t: Triage, selling: boolean): { kind: Sort; alarm: boolean } {
  const alarm = t.complaint >= 0.6
  if (t.payment >= 0.8 && t.payment - t.shop >= 0.3) return { kind: 'payment', alarm }
  if (!selling && t.personal >= 0.85 && t.shop <= 0.2) return { kind: 'personal', alarm }
  if (!selling && t.staff >= 0.7 && t.shop <= 0.6 && t.staff - t.shop >= 0.2 && t.staff >= t.complaint) return { kind: 'staff', alarm }
  return { kind: 'shop', alarm }
}

/** Сумма из текста или описания чека: «5 500 сом», «на сумму 5500.00 KGS», «21000 so'm». */
export function paidAmount(text: string): number | null {
  // Тысячи через пробел, точку или запятую («5 500», «5.500», «5,500»), копейки — две цифры после
  // точки или запятой («5500.00»). «с» после кириллицы — без \b: он в JS только для латиницы (ревью 04.10).
  const m = text.match(/(?<![\d.,])(\d{1,3}(?:[  .,]\d{3})+|\d{3,7})(?:[.,]\d{2}(?!\d))?\s*(?:сом|som|so.?m|kgs|с(?![\p{L}]))/iu)
  if (!m) return null
  const n = Number(m[1].replace(/\D/g, ''))
  return Number.isFinite(n) && n > 0 ? n : null
}
