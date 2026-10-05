import { afterEach, describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
vi.mock('@/lib/assistant/usage', () => ({ recordCall: () => {}, recordCache: () => {} }))
import { askGemini, downWhy, GeminiError } from '@/lib/assistant/gemini'

const timeout = () => Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' })
const ok = () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"reply":"Бар","audience":"customer"}' }] } }] }))

describe('Gemini молчит 12 секунд (05.10, 06:31)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('Instagram и WhatsApp — пробуем ещё раз; сайт — сразу запасной ответ', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'test')
    const fetchMock = vi.fn().mockRejectedValueOnce(timeout()).mockResolvedValueOnce(ok())
    vi.stubGlobal('fetch', fetchMock)
    // Без NOW_MARK кэш не создаётся — каждый вызов fetch это один запрос ответа.
    expect(await askGemini('правила', [{ role: 'user', text: 'Канча?' }], 'instagram')).toContain('Бар')
    expect(fetchMock).toHaveBeenCalledTimes(2)

    const siteFetch = vi.fn().mockRejectedValueOnce(timeout()).mockResolvedValueOnce(ok())
    vi.stubGlobal('fetch', siteFetch)
    await expect(askGemini('правила', [{ role: 'user', text: 'Канча?' }], 'site')).rejects.toThrow(/timeout/)
    expect(siteFetch).toHaveBeenCalledTimes(1)
  })

  it('причина словом — владельцу, без текста ошибки', () => {
    expect(downWhy(timeout())).toBe('timeout')
    expect(downWhy(new GeminiError('This model is currently experiencing high demand.', 503))).toBe('busy')
    expect(downWhy(new GeminiError('Resource has been exhausted (e.g. check quota).', 429))).toBe('busy') // так же пишет и минутный предел — это пройдёт
    expect(downWhy(new GeminiError('You exceeded your current quota, please check your plan and billing details.', 429))).toBe('money')
    expect(downWhy(new GeminiError('Your prepayment credits are depleted.', 429))).toBe('money')
    expect(downWhy(new GeminiError('Too many requests', 429))).toBe('busy')
    expect(downWhy(new GeminiError('bad key', 403))).toBe('key')
    expect(downWhy(new GeminiError('API key not valid. Please pass a valid API key.', 400))).toBe('key')
    expect(downWhy(new GeminiError('Requests ending with a model turn are not supported.', 400))).toBe('error')
    expect(downWhy(new Error('ECONNRESET'))).toBe('error')
  })
})

describe('разговор кончается репликой магазина (05.10, 400 от Gemini)', () => {
  const u = (text: string) => ({ role: 'user' as const, text })
  const a = (text: string) => ({ role: 'assistant' as const, text })
  it('дописал, пока бот думал — ответ встаёт перед последним вопросом', async () => {
    const { endWithCustomer } = await import('@/lib/assistant/respond')
    expect(endWithCustomer([a('Директке жаздык'), u('Канча?'), u('Жеткирүү барбы?'), a('23 900 сом')]))
      .toEqual([a('Директке жаздык'), u('Канча?'), a('23 900 сом'), u('Жеткирүү барбы?')])
    expect(endWithCustomer([u('Салам'), u('Канча?'), a('Бар')])).toEqual([u('Салам'), a('Бар'), u('Канча?')])
    // На единственный вопрос уже ответили — молчим, второй раз не отвечаем.
    expect(endWithCustomer([a('Салам'), u('Канча?'), a('23 900 сом')])).toBeNull()
    expect(endWithCustomer([u('Канча?'), a('23 900 сом')])).toBeNull()
    expect(endWithCustomer([a('Ассаламу алейкум')])).toBeNull()
    // Обычный разговор — как есть.
    const fine = [a('Салам'), u('Канча?')]
    expect(endWithCustomer(fine)).toBe(fine)
  })
})
