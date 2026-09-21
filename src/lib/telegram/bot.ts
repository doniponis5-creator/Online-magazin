import 'server-only'

/**
 * Тот же консультант, но в Telegram.
 *
 * «Мозг» один и тот же — src/lib/assistant. Здесь только то, чем Telegram
 * отличается от сайта: как получить сообщение, как отправить ответ и как
 * показать товары без карточек (ссылками).
 *
 * Разговор помним в памяти процесса: последние несколько реплик на каждого
 * собеседника. Перезапустили сайт — разговоры начались заново. Это не потеря:
 * покупатель спрашивает про товар, а не продолжает вчерашнюю беседу.
 */

import { answer } from '@/lib/assistant/reply'
import type { ChatTurn } from '@/lib/assistant/gemini'
import { logQuestion } from '@/lib/assistant/log'
import { SITE_URL } from '@/lib/seo'
import { defaultLang, isLang, type Lang } from '@/lib/i18n/config'
import { detectLang, type TalkLang } from '@/lib/assistant/talk'
import { searchProducts } from '@/lib/assistant/knowledge'
import { lookupIn, salesCatalogNow as catalogNow } from '@/lib/assistant/live'
import { CALL_INTENT, cancelLead, leadContext, leadStep, startLead } from '@/lib/assistant/leads'
import { tooOften } from '@/lib/assistant/limits'
import { AFFIRM, BUY_INTENT, OFFER, cancel, hasDraft, start, step } from './order'
import { store } from '@/lib/store'

const API = 'https://api.telegram.org/bot'

/** Сколько реплик разговора держим. Дальше платим за чужую историю. */
const MEMORY = 8

/** Разговоры: id собеседника → последние реплики. */
const talks = store('talks', () => new Map<number, ChatTurn[]>())

/** Что бот показал в прошлый раз: чтобы «беру» относилось к чему-то понятному. */
const shown = store('shown', () => new Map<number, string[]>())

/** Бот в прошлом ответе сам предложил оформить заказ — тогда «да» означает «да». */
const offered = store('offered', () => new Set<number>())

/**
 * Язык, на котором идёт разговор.
 *
 * Покупатель не меняет язык посреди беседы. Короткое «qachan keladi?» узнать
 * по словам трудно, и бот отвечал по-русски человеку, который весь разговор
 * писал по-узбекски. Поэтому помним язык и возвращаемся к нему, когда по
 * самому сообщению не понять.
 */
const langs = store('langs', () => new Map<number, TalkLang>())

export function telegramConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN)
}

export type TelegramUpdate = {
  message?: {
    chat?: { id?: number }
    from?: { language_code?: string }
    text?: string
  }
}

/** Ответить на одно сообщение из Telegram. */
export async function handleUpdate(update: TelegramUpdate): Promise<void> {
  const chatId = update.message?.chat?.id
  const text = (update.message?.text ?? '').trim()
  if (!chatId || !text) return

  const lang = siteLangOf(update.message?.from?.language_code)

  // Двадцать сообщений за десять минут — это уже не покупка, а развлечение.
  // Отвечаем коротко и перестаём тратить на человека ответы модели.
  if (tooOften(`tg:${chatId}`, 20, 10 * 60_000)) {
    if (!tooOften(`tg-warn:${chatId}`, 1, 10 * 60_000)) {
      await send(chatId, tooMany(langs.get(chatId) ?? lang))
    }
    return
  }

  const talk = detectLang(text, langs.get(chatId) ?? lang)
  langs.set(chatId, talk)
  if (langs.size > 2000) langs.clear()

  if (text.startsWith('/start')) {
    talks.delete(chatId)
    shown.delete(chatId)
    offered.delete(chatId)
    langs.delete(chatId)
    cancel(chatId)
    await send(chatId, hello(lang))
    return
  }
  if (text.startsWith('/')) return

  // Передумал посреди оформления — выходим из него, не доспрашивая.
  if (/^(отмена|стоп|bekor|токтот|жок|cancel)$/i.test(text)) {
    cancel(chatId)
    cancelLead(chatId)
    await send(chatId, backToChat(talk))
    return
  }

  // Ждём номер для «перезвоните».
  const lead = await leadStep(chatId, text, talk)
  if (lead) {
    remember(chatId, text, lead)
    await send(chatId, lead)
    return
  }

  // Заказ в работе: шаги идут строго по порядку, без участия модели.
  const ongoing = await step(chatId, text, talk, lang)
  if (ongoing) {
    // Шаги оформления тоже попадают в разговор: иначе после «Готово! Заказ
    // TEST-…» консультант о заказе не знает и на «когда привезёте?» начинает
    // объяснять, как класть товар в корзину.
    remember(chatId, text, ongoing)
    await send(chatId, ongoing)
    return
  }

  // «Перезвоните», «дайте менеджера» — номер и пересказ разговора сотруднику.
  if (!hasDraft(chatId) && CALL_INTENT.test(text)) {
    const questions = [...(talks.get(chatId) ?? []).filter((t) => t.role === 'user').map((t) => t.text), text]
    const find = lookupIn(await catalogNow())
    const seen = (shown.get(chatId) ?? []).map((id) => find(id)?.nameRu).filter((x): x is string => Boolean(x))
    const reply = await startLead(chatId, talk, leadContext(questions, seen), {}, 'telegram')
    remember(chatId, text, reply)
    await send(chatId, reply)
    return
  }

  // «Беру», «куда платить», а также «да» в ответ на «оформляем?» —
  // начинаем оформление того, о чём шла речь.
  if (!hasDraft(chatId) && (BUY_INTENT.test(text) || (AFFIRM.test(text) && offered.has(chatId)))) {
    offered.delete(chatId)
    await send(chatId, await start(chatId, await wanted(chatId, text, lang), talk))
    return
  }

  const turns: ChatTurn[] = [
    ...(talks.get(chatId) ?? []),
    { role: 'user' as const, text: text.slice(0, 800) },
  ].slice(-MEMORY)

  const reply = await answer(turns, lang, null)

  const next: ChatTurn[] = [...turns, { role: 'assistant' as const, text: reply.text }]
  talks.set(chatId, next.slice(-MEMORY))

  if (talks.size > 2000) talks.clear()

  void logQuestion({
    lang,
    q: text,
    a: reply.text,
    found: reply.products.length > 0,
    source: reply.source,
    ch: 'telegram',
  })

  shown.set(chatId, reply.products.map((p) => p.id))
  if (shown.size > 2000) shown.clear()

  // Запоминаем, предложил ли бот оформить заказ: от этого зависит, что значит
  // следующее «да».
  if (OFFER.test(reply.text)) offered.add(chatId)
  else offered.delete(chatId)
  if (offered.size > 2000) offered.clear()

  const withPhoto = reply.products.flatMap((p) => (isPhoto(p.image) ? [{ ...p, image: p.image }] : []))
  const noPhoto = reply.products.filter((p) => !isPhoto(p.image))

  // Сначала ответ словами (и товары без фотографии — ссылками), потом сами
  // фотографии. Так покупатель сперва читает ответ, а не листает картинки.
  await send(chatId, withProducts(reply.text, noPhoto))
  await sendPhotos(chatId, withPhoto)
}

/**
 * Товары дописываем ссылками: в Telegram нет наших карточек, а человеку нужно
 * попасть на страницу товара, а не переписывать название в поиск.
 */
function withProducts(text: string, products: { name: string; priceLabel: string; href: string }[]): string {
  if (products.length === 0) return text
  // Товар «только для чата» страницы не имеет — без ссылки, «беру» оформит его здесь.
  const lines = products.map((p) => `• ${p.name} — ${p.priceLabel}${p.href ? `\n${SITE_URL}${p.href}` : ''}`)
  return [text, '', ...lines].join('\n')
}

/** Фотография годится, только если её видно из интернета: Telegram скачивает её сам. */
function isPhoto(url: string | undefined): url is string {
  return typeof url === 'string' && /^https?:\/\//.test(url)
}

function photoCaption(p: { name: string; priceLabel: string; href: string }): string {
  return `${p.name} — ${p.priceLabel}${p.href ? `\n${SITE_URL}${p.href}` : ''}`.slice(0, 1000)
}

/**
 * Фотографии товаров.
 *
 * Одна — обычным снимком, две и больше — альбомом: Telegram показывает их
 * вместе, и переписка не превращается в ленту картинок. Подпись у каждой своя:
 * название, цена и ссылка.
 */
async function sendPhotos(
  chatId: number,
  products: { name: string; priceLabel: string; href: string; image: string }[],
): Promise<void> {
  const list = products.slice(0, 3)
  if (list.length === 0) return

  if (list.length === 1) {
    await call('sendPhoto', { chat_id: chatId, photo: list[0].image, caption: photoCaption(list[0]) })
    return
  }

  await call('sendMediaGroup', {
    chat_id: chatId,
    media: list.map((p) => ({ type: 'photo', media: p.image, caption: photoCaption(p) })),
  })
}

function siteLangOf(code: string | undefined): Lang {
  const short = (code ?? '').slice(0, 2).toLowerCase()
  return isLang(short) ? short : defaultLang
}

function hello(lang: Lang): string {
  return lang === 'ky'
    ? 'Саламатсызбы! Мен Smart Centr дүкөнүнүн кеңешчисимин. Товарлар, баалар, жеткирүү жана бонустар боюнча сураңыз. Орусча, кыргызча жана өзбекче жооп берем.'
    : 'Здравствуйте! Я консультант магазина Smart Centr. Спрашивайте про товары, цены, доставку и бонусы. Отвечаю по-русски, по-кыргызски и по-узбекски.'
}

/**
 * О каком товаре речь, когда человек говорит «беру».
 *
 * Обычно это то, что бот показал в прошлом ответе. Но память живёт в процессе:
 * сайт перезапустили — и бот «забыл», что показывал. Тогда ищем по словам из
 * самого разговора, а не отвечаем «какой товар?» человеку, который только что
 * смотрел фотографию.
 */
async function wanted(chatId: number, text: string, lang: Lang): Promise<string[]> {
  const ids = shown.get(chatId) ?? []
  if (ids.length > 0) return ids

  // Смотрим и свои прошлые ответы тоже: название товара («UAKEEN ZL-940»)
  // чаще написал бот, а не покупатель.
  const said = [text, ...(talks.get(chatId) ?? []).map((t) => t.text).reverse()].slice(0, 4).join(' ')
  return searchProducts(said, lang, 3, await catalogNow()).map((p) => p.id)
}

/** Дописать пару реплик в разговор. */
function remember(chatId: number, asked: string, answered: string): void {
  const next: ChatTurn[] = [
    ...(talks.get(chatId) ?? []),
    { role: 'user' as const, text: asked },
    { role: 'assistant' as const, text: answered },
  ]
  talks.set(chatId, next.slice(-MEMORY))
}

function tooMany(lang: 'ru' | 'ky' | 'uz'): string {
  if (lang === 'ky') return 'Азырынча ушунча. Бир аздан кийин жазыңыз же чалыңыз: +996 557 100 505.'
  if (lang === 'uz') return "Hozircha shuncha. Birozdan keyin yozing yoki qo'ng'iroq qiling: +996 557 100 505."
  return 'На сегодня пока хватит. Напишите чуть позже или позвоните: +996 557 100 505.'
}

function backToChat(lang: 'ru' | 'ky' | 'uz'): string {
  if (lang === 'ky') return 'Макул, токтоттум. Дагы бир нерсе керек болсо жазыңыз.'
  if (lang === 'uz') return "Mayli, to'xtatdim. Yana biror narsa kerak bo'lsa yozing."
  return 'Хорошо, остановил. Если что-то ещё понадобится — напишите.'
}

/** Отправить сообщение. Ошибку не поднимаем: Telegram переспросит сам. */
export async function send(chatId: number, text: string): Promise<void> {
  // Разметку не включаем намеренно: в названиях товаров бывают звёздочки и
  // подчёркивания, и Telegram отказывался присылать такое сообщение целиком.
  await call('sendMessage', { chat_id: chatId, text: text.slice(0, 4000), disable_web_page_preview: true })
}

/**
 * Один запрос к Telegram, с повтором при обрыве связи.
 *
 * Повторяем только тогда, когда запрос вообще не дошёл: интернет в Кыргызстане
 * пропадает на секунду, и однажды из-за этого до покупателя не дошла ссылка на
 * оплату — заказ был создан, а человек об этом не узнал. Ответ Telegram с
 * ошибкой (например «чат не найден») не повторяем: второй раз будет то же.
 */
async function call(method: string, body: unknown): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(`${API}${token}/${method}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: AbortSignal.timeout(15_000),
        body: JSON.stringify(body),
      })
      if (!response.ok) {
        console.error(`[telegram] ${method}:`, (await response.text().catch(() => '')).slice(0, 200))
      }
      return
    } catch (error) {
      const why = error instanceof Error ? error.message : String(error)
      if (attempt === 3) {
        console.error(`[telegram] ${method} не ушло после трёх попыток:`, why)
        return
      }
      console.error(`[telegram] ${method}, попытка ${attempt}:`, why)
      await new Promise((resolve) => setTimeout(resolve, attempt * 1000))
    }
  }
}
