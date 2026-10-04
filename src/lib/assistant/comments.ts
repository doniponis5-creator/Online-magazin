import 'server-only'

/**
 * Комментарии под постами и рилсами Instagram (владелец 04.10: «инстадан комментларни ҳам ёздирса
 * бўладими»). Отвечаем без Gemini — шаблоном: комментарий публичный, ошибку модели увидят все,
 * а под рекламой их сотни. Дорогой разговор начинается, только если человек ответит в Direct.
 *
 *   ask       — «канча?», «цена», «+», «Ошко барабы?» → под комментарием «Директке жаздык 📩»,
 *               в Direct (личный ответ на комментарий) — товар из подписи поста, цена и один вопрос;
 *   complaint — жалоба → под комментарием извинение и «написали в Direct», в Direct — «что случилось?»,
 *               владельцу 🚨; разбор — не при всех;
 *   spam      — чужая реклама, ставки, мат → скрыть;
 *   praise    — «🔥», «супер», отметка друга → ничего (бесплатно и не навязчиво).
 *
 * Сортирует Jev (маленькая модель, много дешевле Gemini): четыре вопроса «да/нет». Нет Jev — по словам.
 * В Jev уходят комментарий и подпись поста — без ника; цепочки из 6+ цифр — «…».
 */

import { askJev, jevConfigured } from './jev'
import { hideDigits } from './log'
import { detectLangScored, type TalkLang } from './talk'
import { bestNameMatch, isInStock } from './knowledge'
import { formatSom } from '@/lib/format'
import type { Product } from '@/data/products'

export type CommentScores = { ask: number; praise: number; complaint: number; spam: number }
export type CommentAction = 'answer' | 'alert' | 'hide' | 'skip'
export type CommentPlan = { action: CommentAction; public: string; private: string; productId: string | null; lang: TalkLang }

const CONTEXT =
  'Комментарий под постом магазина электроники и бытовой техники в Instagram. `comment` — сам комментарий, `post` — подпись поста.'

const QUESTIONS = {
  ask: { type: 'noul', instructions: `${CONTEXT} Человек интересуется товаром: спрашивает цену, наличие, доставку, размер, цвет — или пишет «+», «цена», «канча», «баасы», «нархи», «мага да», «директ»?` },
  praise: { type: 'noul', instructions: `${CONTEXT} Это похвала или эмоция без вопроса: эмодзи, «супер», «класс», «зор», отметка друга через @?` },
  complaint: { type: 'noul', instructions: `${CONTEXT} Это жалоба или негатив о магазине: обманули, сломалось, не привезли, плохое качество, грубость?` },
  spam: { type: 'noul', instructions: `${CONTEXT} Это спам: реклама чужого магазина или услуги, ссылки, ставки, казино, заработок, оскорбления или мат?` },
} as const

/** Вопрос о цене — такой комментарий не скрываем, даже если Jev счёл спамом. «Пиши в директ» — частый спам, его тут нет. */
const PRICE_WORDS = /(^\s*\+\s*$|цена|сколько|почём|почем|канча|баасы|нарх|qancha|narx|price)/iu

/** Слова интереса — запасной путь без Jev и страховка от его ошибки: «+» под рекламой — это всегда «сколько?». */
const ASK_WORDS =
  /(^\s*\+\s*$|цена|сколько|почём|почем|стоимост|канча|баасы|нарх|qancha|narx|price|барбы|бар бы|борми|bormi|директ|direct|(?<![\p{L}])(?:в\s)?лс(?![\p{L}])|жеткир|доставк|yetkaz|етказ)/iu

export async function scoreComment(text: string, caption: string): Promise<CommentScores | null> {
  if (!jevConfigured()) return null
  // Чужие @ники — не в Jev: отметить друга — это его ник, не наш.
  const clean = (s: string) => hideDigits(s.replace(/@[\w.]+/g, '@друг'))
  const data = await askJev({ comment: clean(text).slice(0, 500), post: clean(caption).slice(0, 400) }, QUESTIONS)
  const answers = (data as { answers?: Record<string, { noul?: unknown }> } | null)?.answers
  if (!answers) return null
  const out = {} as CommentScores
  for (const key of Object.keys(QUESTIONS) as (keyof CommentScores)[]) {
    const p = Number(answers[key]?.noul)
    if (!Number.isFinite(p)) return null
    out[key] = Math.min(1, Math.max(0, p))
  }
  return out
}

/**
 * Товар поста — по названию в подписи («Эндура мотоцикл мини…» → Электро Эндуро). Не уверены —
 * null: тогда в Direct спрашиваем «какой товар?», чужую цену не называем никогда.
 */
export function productOfPost(caption: string, list: Product[]): Product | null {
  const text = caption.replace(/[#@]\S+/g, ' ').trim()
  if (text.length < 3) return null
  return bestNameMatch(text, list)
}

// Под постом — только кыргызский или русский (владелец 04.10: «комментта узбекча ёзмасин»).
// Узбеку под постом — кыргызский, в Direct — по-узбекски.
const PUBLIC_DM = { ky: 'Директке жаздык 📩', ru: 'Написали вам в Direct 📩' }
const PUBLIC_SORRY = { ky: 'Кечиресиз! Директке жаздык 📩', ru: 'Извините! Написали вам в Direct 📩' }
// Старые узбекские ответы тоже свои: такой мог уже висеть под постом.
const OWN_REPLIES = new Set([...Object.values(PUBLIC_DM), ...Object.values(PUBLIC_SORRY), 'Директга ёздик 📩', 'Кечирасиз! Директга ёздик 📩'])
const CITY = { ky: 'Кайсы шаардан болосуз?', ru: 'Вы из какого города?', uz: 'Кайси шахардансиз?' }
const WHICH = {
  ky: 'Ассаламу алейкум! Кайсы товар кызыктырды? Жазыңыз — баасын айтып берем.',
  ru: 'Ассаламу алейкум! Какой товар заинтересовал? Напишите — скажу цену.',
  uz: 'Ассаламу алейкум! Кайси товар кизиктирди? Ёзинг — нархини айтиб бераман.',
}
const NONE = {
  ky: (n: string) => `Ассаламу алейкум! ${n} азыр жок. Окшошун сунуштайынбы?`,
  ru: (n: string) => `Ассаламу алейкум! ${n} сейчас нет в наличии. Предложить похожий?`,
  uz: (n: string) => `Ассаламу алейкум! ${n} хозир йук. Ухшашини таклиф килайми?`,
}
const SORRY_DM = {
  ky: 'Ассаламу алейкум! Кечиресиз, ушундай болуп калганына. Эмне болгонун жазыңызчы — руководство дароо карайт.',
  ru: 'Ассаламу алейкум! Извините, что так вышло. Напишите, пожалуйста, что случилось — руководство сразу разберётся.',
  uz: 'Ассаламу алейкум! Кечирасиз, шундай булиб колганига. Нима булганини ёзинг — руководство дарров куради.',
}

/** Язык комментария. «+» и «🔥» языка не имеют — по умолчанию кыргызский: большинство покупателей. */
export function commentLang(text: string): TalkLang {
  const scored = detectLangScored(text, 'ky')
  return scored.strong ? scored.lang : 'ky'
}

/**
 * Что делать с комментарием. Сомнение — ничего (skip): лишний ответ под постом хуже пропущенного,
 * а интерес по словам («канча», «+») ловим и без Jev.
 */
export function planComment(text: string, scores: CommentScores | null, product: Product | null): CommentPlan {
  const lang = commentLang(text)
  const shown = lang === 'ru' ? 'ru' : 'ky'
  const plan = (action: CommentAction, pub = '', priv = ''): CommentPlan => ({ action, public: pub, private: priv, productId: product?.id ?? null, lang })
  // Наш же ответ «Директке жаздык 📩» вернулся webhook'ом: в нём «директ» — без этой проверки
  // робот отвечал бы сам себе по кругу. Сервер ещё и помнит id своих ответов — это вторая защита.
  if (OWN_REPLIES.has(text.trim())) return plan('skip')
  const wordsAsk = ASK_WORDS.test(text)
  const s = scores ?? { ask: wordsAsk ? 1 : 0, praise: 0, complaint: 0, spam: 0 }

  // Жалоба — всегда владельцу, даже с матом (ревью 04.10: злой покупатель с матом уходил в «спам» и
  // молча скрывался). Скрываем только спам без жалобы и без интереса к товару.
  if (s.complaint >= 0.6) return plan('alert', PUBLIC_SORRY[shown], SORRY_DM[lang])
  if (s.spam >= 0.8 && s.ask < 0.3 && !PRICE_WORDS.test(text)) return plan('hide')
  if (s.ask >= 0.5 || wordsAsk) {
    if (!product) return plan('answer', PUBLIC_DM[shown], WHICH[lang])
    // Полное название, а не одна марка: «UAKEEN — 30 000 сом» непонятно, и ошибку покупатель не заметит.
    const name = product.nameRu.replace(/\*+/g, '').replace(/\s+/g, ' ').trim().slice(0, 70)
    if (!isInStock(product) || product.price <= 0) return plan('answer', PUBLIC_DM[shown], NONE[lang](name))
    return plan('answer', PUBLIC_DM[shown], `Ассаламу алейкум! ${name} — ${formatSom(product.price)}. ${CITY[lang]}`)
  }
  return plan('skip')
}
