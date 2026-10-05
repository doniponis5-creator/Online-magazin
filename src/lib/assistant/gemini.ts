import 'server-only'

/**
 * Обращение к Gemini — «мозгу» консультанта.
 *
 * Библиотеки Google здесь нет намеренно: запрос простой, а лишняя зависимость
 * в package.json — это ещё один пакет, который надо обновлять и который может
 * сломать сборку сайта. Один fetch делает то же самое.
 *
 * Ключ берётся из GEMINI_API_KEY. Нет ключа — модуль не вызывается вообще,
 * и чат отвечает запасным режимом (reply.ts).
 */

import { createHash } from 'node:crypto'
import { fromJson } from './answer-json'
import { store } from '@/lib/store'
import { recordCache, recordCall } from './usage'

const API = 'https://generativelanguage.googleapis.com/v1beta'
const ENDPOINT = `${API}/models`

/**
 * Граница постоянной и переменной части промпта (prompt.ts). Всё до неё одинаково у всех
 * покупателей — Gemini хранит это в кэше (cachedContents) и берёт за кэш меньше, чем за обычный
 * ввод. Замер 04.10: 10 538 из 12–19 тыс. токенов каждого ответа — из кэша.
 */
export const NOW_MARK = 'СЕЙЧАС — ЭТОТ РАЗГОВОР'

/** Кэш живёт час; за минуту до конца создаём новый. GEMINI_CACHE=0 — без кэша. */
const CACHE_TTL_S = 3600
const cache = store('gemini-cache', () => ({ hash: '', name: '', until: 0, failedUntil: 0, pending: null as Promise<string | null> | null }))

function cacheOn(): boolean {
  return process.env.GEMINI_CACHE !== '0'
}

/** Имя кэша постоянной части или null (кэш выключен, не создался — тогда как раньше, без кэша). */
async function cacheFor(key: string, model: string, fixed: string): Promise<string | null> {
  if (!cacheOn() || fixed.length < 8000) return null
  const hash = createHash('sha256').update(`${model}|${fixed}`).digest('hex')
  const now = Date.now()
  if (cache.hash === hash && cache.name && now < cache.until - 60_000) return cache.name
  if (now < cache.failedUntil) return null
  if (cache.pending) return cache.pending
  cache.pending = (async () => {
    try {
      const response = await fetch(`${API}/cachedContents`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
        signal: AbortSignal.timeout(15_000),
        body: JSON.stringify({ model: `models/${model}`, displayName: 'smartcentr-consultant', systemInstruction: { parts: [{ text: fixed }] }, ttl: `${CACHE_TTL_S}s` }),
      })
      if (!response.ok) throw new Error(`${response.status} ${(await response.text().catch(() => '')).slice(0, 200)}`)
      const { name, usageMetadata } = (await response.json()) as { name?: string; usageMetadata?: { totalTokenCount?: number } }
      if (!name) throw new Error('нет имени кэша')
      recordCache(usageMetadata?.totalTokenCount ?? 0, CACHE_TTL_S / 3600)
      const old = cache.hash !== hash ? cache.name : ''
      Object.assign(cache, { hash, name, until: Date.now() + CACHE_TTL_S * 1000 })
      // Прежний кэш (правила или каталог поменялись) — удалить, чтобы не платить за хранение.
      if (old) void fetch(`${API}/${old}`, { method: 'DELETE', headers: { 'x-goog-api-key': key } }).catch(() => undefined)
      return name
    } catch (error) {
      // Не создался — 10 минут работаем без кэша, как раньше: ответ важнее экономии.
      cache.failedUntil = Date.now() + 10 * 60_000
      console.error('[assistant] кэш Gemini не создан:', error instanceof Error ? error.message : error)
      return null
    } finally {
      cache.pending = null
    }
  })()
  return cache.pending
}

/** Модель по умолчанию. Меняется через GEMINI_MODEL, пересборка не нужна. */
// 3.8 Flash: заметно умнее «lite» и дешевле 3.5 Flash; понимает голос и фото.
const DEFAULT_MODEL = 'gemini-3.8-flash'

export type ChatTurn = { role: 'user' | 'assistant'; text: string }

export class GeminiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
    this.name = 'GeminiError'
  }
}

/** fetch оборвал `AbortSignal.timeout` — «The operation was aborted due to timeout». */
export function isTimeout(error: unknown): boolean {
  const name = (error as { name?: unknown } | null)?.name
  return name === 'TimeoutError' || name === 'AbortError'
}

/** Почему модель не ответила — словом, для тревоги владельцу (без текста ошибки: в нём бывает ключ). */
export type DownWhy = 'timeout' | 'busy' | 'key' | 'limit' | 'error'
export function downWhy(error: unknown): DownWhy {
  if (isTimeout(error)) return 'timeout'
  const status = error instanceof GeminiError ? error.status : 0
  if (status === 429 || status === 503 || status === 500) return 'busy'
  if (status === 400 || status === 401 || status === 403) return 'key'
  return 'error'
}

export function geminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY)
}

/** channel — для учёта расхода по каналам (usage.ts): сайт, WhatsApp, Instagram, Telegram. */
export async function askGemini(system: string, turns: ChatTurn[], channel = 'site'): Promise<string> {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new GeminiError('no-key', 500)

  try {
    return await once(key, system, turns, channel)
  } catch (error) {
    // 429 и 503 — «сейчас много народу» у самого Google. Это проходит за
    // секунду-другую, поэтому один раз пробуем ещё. Остальные ошибки
    // повторять бессмысленно: неверный ключ вторым разом верным не станет.
    const status = error instanceof GeminiError ? error.status : 0
    // Google молчал 12 секунд (05.10, 06:31: покупатель Instagram остался без ответа) — в WhatsApp и
    // Instagram ещё раз: там 20 секунд ожидания никто не заметит. На сайте человек смотрит на крутилку.
    const slow = isTimeout(error) && channel !== 'site'
    if (status !== 429 && status !== 503 && !slow) throw error
    await new Promise((resolve) => setTimeout(resolve, 1500))
    return await once(key, system, turns, channel)
  }
}

async function once(key: string, system: string, turns: ChatTurn[], channel: string): Promise<string> {
  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL
  const at = system.indexOf(NOW_MARK)
  const name = at > 0 ? await cacheFor(key, model, system.slice(0, at)) : null
  if (!name) return await request(key, model, { systemInstruction: { parts: [{ text: system }] } }, turns, '', channel)
  try {
    // Постоянная часть — из кэша; «СЕЙЧАС…» (канал, язык, покупатель, товары) — первой частью разговора.
    return await request(key, model, { cachedContent: name }, turns, system.slice(at), channel)
  } catch (error) {
    // Кэш пропал раньше срока (удалили, истёк) — забываем его и отвечаем без кэша.
    const status = error instanceof GeminiError ? error.status : 0
    if (status !== 400 && status !== 403 && status !== 404) throw error
    // И 10 минут не создаём новый: если модель кэш не принимает вовсе (сменили GEMINI_MODEL), каждый
    // ответ создавал бы платный кэш и всё равно шёл бы без него — дороже, чем без кэша (ревью 04.10).
    if (cache.name === name) Object.assign(cache, { name: '', until: 0, failedUntil: Date.now() + 10 * 60_000 })
    return await request(key, model, { systemInstruction: { parts: [{ text: system }] } }, turns, '', channel)
  }
}

async function request(key: string, model: string, head: Record<string, unknown>, turns: ChatTurn[], now = '', channel = 'site'): Promise<string> {

  // 12 секунд — предел ожидания. Обычный ответ приходит за одну-две секунды;
  // если Google молчит дольше, он, скорее всего, не ответит вовсе, и лучше
  // показать запасной ответ с телефоном, чем крутилку.
  const abort = AbortSignal.timeout(12_000)

  const response = await fetch(`${ENDPOINT}/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
    signal: abort,
    body: JSON.stringify({
      ...head,
      contents: turns.map((turn, i) => ({
        role: turn.role === 'assistant' ? 'model' : 'user',
        parts: i === 0 && now ? [{ text: now }, { text: turn.text }] : [{ text: turn.text }],
      })),
      generationConfig: {
        // Низкая температура — меньше выдумок про цены.
        temperature: 0.3,
        // Предел щедрый не от расточительности: новые модели сначала «думают»
        // про себя, и эти размышления тратят тот же лимит. При 600 ответ
        // обрывался на полуслове или не приходил вовсе.
        maxOutputTokens: 2400,
        thinkingConfig: { thinkingLevel: 'low' },
        // Ответ строго в двух полях. Без этого модель изредка писала покупателю
        // свои размышления: «Покупатель прислал нечитаемые символы… Отвечу
        // вежливо…» — и уже потом сам ответ. В поле reply попадает только то,
        // что читает покупатель.
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            reply: { type: 'STRING', description: 'Готовый ответ покупателю, слово в слово' },
            productIds: { type: 'ARRAY', items: { type: 'STRING' }, description: 'id названных товаров, не больше трёх' },
            audience: {
              type: 'STRING',
              enum: ['customer', 'staff', 'personal'],
              description: 'кому адресовано сообщение: customer — покупатель спрашивает магазин; staff — покупатель говорит с сотрудником (передать); personal — не про магазин (молчать)',
            },
          },
          required: ['reply', 'audience'],
        },
      },
    }),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new GeminiError(body.slice(0, 300) || `http-${response.status}`, response.status)
  }

  const data = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[]
    usageMetadata?: { promptTokenCount?: number; cachedContentTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number }
  }
  recordCall(data.usageMetadata, channel)
  // GEMINI_LOG_USAGE=1 — в журнал сколько токенов ушло и сколько из них из кэша (проверка экономии).
  if (process.env.GEMINI_LOG_USAGE === '1') {
    const u = data.usageMetadata ?? {}
    console.info(`[assistant] токены: ввод ${u.promptTokenCount ?? '?'}, из кэша ${u.cachedContentTokenCount ?? 0}, ответ ${u.candidatesTokenCount ?? '?'}, мысли ${u.thoughtsTokenCount ?? 0}`)
  }
  // Части с thought — размышления модели; покупателю их не отдаём никогда.
  const text =
    data.candidates?.[0]?.content?.parts
      ?.filter((p) => !p.thought)
      .map((p) => p.text ?? '')
      .join('') ?? ''
  if (!text.trim()) throw new GeminiError(`empty-answer:${data.candidates?.[0]?.finishReason ?? '?'}`, 502)
  return fromJson(text.trim())
}

/** Что прислал покупатель вместо текста. */
export type MediaKind = 'audio' | 'image'

const MEDIA_TASK: Record<MediaKind, string> = {
  audio: `Это голосовое сообщение покупателя магазина электроники в Кыргызстане.
Расшифруй его дословно, на том языке, на котором говорят: русский, кыргызский или узбекский.
Узбекский пиши латиницей, кыргызский и русский — кириллицей. Числа — цифрами.
Верни только текст сообщения, без пояснений, без кавычек. Не разобрал ни слова — верни пустую строку.`,
  image: `Это фото или скриншот, который прислал покупатель магазина электроники.
Опиши коротко по-русски, что на нём: вид товара (холодильник, телевизор…), марка и модель, если видны,
любой видимый текст — название, цена, надписи. Скриншот переписки или сайта — перескажи, что там написано.
Только описание, одним-двумя предложениями. Без советов и без вопросов.`,
}

/**
 * Голосовое → текст, фото → описание. Дальше это обычная реплика покупателя,
 * и отвечает на неё тот же продавец, что и на текст.
 */
export async function readMedia(kind: MediaKind, mime: string, base64: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new GeminiError('no-key', 500)
  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL

  const response = await fetch(`${ENDPOINT}/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
    // Минута голосового расшифровывается дольше, чем пишется текстовый ответ.
    signal: AbortSignal.timeout(25_000),
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ inlineData: { mimeType: mime, data: base64 } }, { text: MEDIA_TASK[kind] }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 1200, thinkingConfig: { thinkingLevel: 'low' } },
    }),
  })
  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new GeminiError(body.slice(0, 300) || `http-${response.status}`, response.status)
  }
  const data = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[]
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number }
  }
  recordCall(data.usageMetadata, 'media')
  return (
    data.candidates?.[0]?.content?.parts
      ?.filter((p) => !p.thought)
      .map((p) => p.text ?? '')
      .join('')
      .trim() ?? ''
  )
}
