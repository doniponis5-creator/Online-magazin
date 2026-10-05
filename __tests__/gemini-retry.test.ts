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
    expect(downWhy(new GeminiError('quota', 429))).toBe('busy')
    expect(downWhy(new GeminiError('bad key', 403))).toBe('key')
    expect(downWhy(new Error('ECONNRESET'))).toBe('error')
  })
})
