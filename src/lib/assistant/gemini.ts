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

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models'

/** Модель по умолчанию. Меняется через GEMINI_MODEL, пересборка не нужна. */
const DEFAULT_MODEL = 'gemini-3.5-flash-lite'

export type ChatTurn = { role: 'user' | 'assistant'; text: string }

export class GeminiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
    this.name = 'GeminiError'
  }
}

export function geminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY)
}

export async function askGemini(system: string, turns: ChatTurn[]): Promise<string> {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new GeminiError('no-key', 500)

  try {
    return await once(key, system, turns)
  } catch (error) {
    // 429 и 503 — «сейчас много народу» у самого Google. Это проходит за
    // секунду-другую, поэтому один раз пробуем ещё. Остальные ошибки
    // повторять бессмысленно: неверный ключ вторым разом верным не станет.
    const status = error instanceof GeminiError ? error.status : 0
    if (status !== 429 && status !== 503) throw error
    await new Promise((resolve) => setTimeout(resolve, 1500))
    return await once(key, system, turns)
  }
}

async function once(key: string, system: string, turns: ChatTurn[]): Promise<string> {
  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL

  // 12 секунд — предел ожидания. Обычный ответ приходит за одну-две секунды;
  // если Google молчит дольше, он, скорее всего, не ответит вовсе, и лучше
  // показать запасной ответ с телефоном, чем крутилку.
  const abort = AbortSignal.timeout(12_000)

  const response = await fetch(`${ENDPOINT}/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
    signal: abort,
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: turns.map((turn) => ({
        role: turn.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: turn.text }],
      })),
      generationConfig: {
        // Низкая температура — меньше выдумок про цены.
        temperature: 0.3,
        // Предел щедрый не от расточительности: новые модели сначала «думают»
        // про себя, и эти размышления тратят тот же лимит. При 600 ответ
        // обрывался на полуслове или не приходил вовсе.
        maxOutputTokens: 2400,
        thinkingConfig: { thinkingLevel: 'low' },
      },
    }),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new GeminiError(body.slice(0, 300) || `http-${response.status}`, response.status)
  }

  const data = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[]
  }
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
  if (!text.trim()) throw new GeminiError(`empty-answer:${data.candidates?.[0]?.finishReason ?? '?'}`, 502)
  return text.trim()
}
