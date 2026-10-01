import { afterEach, describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
process.env.SHOP_PAYMENT_MODE = 'mock'

import { products } from '@/data/products'
import { followAfter, isSureYes, objectionNote, parseIntent, type Intent } from '@/lib/assistant/jev'

const product = products.find((p) => p.price > 0 && p.variants.some((v) => v.stock > 0))!
const wa = (key: string) => ({ key, orderSource: 'Заказ из WhatsApp', leadChannel: 'whatsapp' as const, known: { phone: '+996555000070', name: 'Азамат' } })
const api = (kind: string, confidence: number, reason = 'other', when = 'unknown') => ({
  answers: { kind: { choice: kind, confidence }, reason: { choice: reason, confidence: 0.9 }, when: { choice: when, confidence: 0.9 } },
})
const intent = (kind: Intent['kind'], confidence = 0.95, reason: Intent['reason'] = 'other', when: Intent['when'] = 'unknown'): Intent => ({ kind, confidence, reason, when })

/** Jev отвечает `body` на любой запрос; остальные адреса сюда не ходят. */
function jevSays(body: unknown) {
  process.env.JEV_API_KEY = 'sk-or-test'
  const fetchMock = vi.fn(async (url: string | URL | Request) => {
    expect(String(url)).toBe('https://openrouter.ai/api/v1/systemone')
    return new Response(JSON.stringify(body), { status: 200 })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

/** Ответ модели подменён: проверяем, что дошло до неё (подсказка) и что вернулось. */
function modelSays(text: string) {
  const seen: { note?: string } = {}
  vi.doMock('@/lib/assistant/reply', async (orig) => ({
    ...(await orig<typeof import('@/lib/assistant/reply')>()),
    answer: async (...args: unknown[]) => {
      seen.note = String(args[6] ?? '')
      return { text, products: [], source: 'gemini' as const, audience: 'customer' as const }
    },
  }))
  return seen
}

afterEach(() => {
  delete process.env.JEV_API_KEY
  vi.unstubAllGlobals()
  vi.doUnmock('@/lib/assistant/reply')
  vi.resetModules()
})

describe('Jev: разбор ответа', () => {
  it('понятный ответ API → Intent; мусор → null', () => {
    expect(parseIntent(api('later', 0.93, 'money', 'payday'))).toEqual(intent('later', 0.93, 'money', 'payday'))
    expect(parseIntent({ answers: { kind: { choice: 'maybe' } } })).toBeNull()
    expect(parseIntent(null)).toBeNull()
    expect(parseIntent({})).toBeNull()
  })

  it('«да» — только уверенное и без «рахмат»', () => {
    expect(isSureYes(intent('agree', 0.95), 'Ладно давайте')).toBe(true)
    expect(isSureYes(intent('agree', 0.95), 'Яхши, рахмат')).toBe(false)
    expect(isSureYes(intent('agree', 0.7), 'Ага')).toBe(false)
    expect(isSureYes(intent('later', 0.99), 'Ага')).toBe(false)
    expect(isSureYes(null, 'Да')).toBe(false)
  })

  it('подсказка продавцу по причине; на вопрос — ничего', () => {
    expect(objectionNote(intent('later', 0.9, 'money'))).toMatch(/рассрочк/)
    expect(objectionNote(intent('later', 0.9, 'family'))).toMatch(/семь/)
    expect(objectionNote(intent('decline', 0.9, 'price'))).toMatch(/дешевле/)
    expect(objectionNote(intent('decline', 0.9, 'other'))).toMatch(/попрощайся/)
    expect(objectionNote(intent('question'))).toBe('')
    expect(objectionNote(intent('question', 0.82, 'price'))).toMatch(/дешевле/)
    expect(objectionNote(null)).toBe('')
  })

  it('когда напомнить: завтра, неделя, после зарплаты; иначе как обычно', () => {
    expect(followAfter(intent('later', 0.9, 'think', 'tomorrow'))).toBe(22 * 3600)
    expect(followAfter(intent('later', 0.9, 'other', 'week'))).toBe(6 * 24 * 3600)
    expect(followAfter(intent('later', 0.9, 'money', 'payday'))).toBe(7 * 24 * 3600)
    expect(followAfter(intent('later', 0.9, 'think', 'unknown'))).toBeNull()
    expect(followAfter(intent('agree', 0.9, 'other', 'tomorrow'))).toBeNull()
  })
})

describe('Jev в разговоре', () => {
  it('«Ладно давайте» на «Оформляем?» — заказ (списки этого не понимали)', async () => {
    jevSays(api('agree', 0.97))
    const { respond } = await import('@/lib/assistant/respond')
    const r = await respond(wa('wa:j1'), [{ role: 'assistant', text: `${product.nameRu}. Оформляем?` }, { role: 'user', text: 'Ладно давайте' }], 'ru', null, undefined, [product.id])
    expect(r.source).toBe('flow')
    expect(r.text).toMatch(/Куда привезти/)
  })

  it('«Яхши, рахмат» — не заказ, даже если Jev сказал «да»', async () => {
    jevSays(api('agree', 0.99))
    modelSays('Мархамат. Яна савол булса, ёзинг.')
    const { respond } = await import('@/lib/assistant/respond')
    const r = await respond(wa('wa:j2'), [{ role: 'assistant', text: 'Расмийлаштирамизми?' }, { role: 'user', text: 'Яхши, рахмат' }], 'ru', null, undefined, [product.id])
    expect(r.text).not.toMatch(/Куда привезти|Кайда|Каерга/)
  })

  it('«Макул, апама айтып көрөйүн»: Jev — «потом, семья» → не заказ; модель получает подсказку; напомнить через сутки', async () => {
    jevSays(api('later', 0.95, 'family', 'unknown'))
    const seen = modelSays('Макул, сүрөтү менен баасын жибердим — апаңызга көрсөтүңүз.')
    const { respond } = await import('@/lib/assistant/respond')
    const r = await respond(wa('wa:j3'), [{ role: 'assistant', text: 'Тариздейлиби?' }, { role: 'user', text: 'Макул, апама айтып көрөйүн' }], 'ky', null, undefined, [product.id])
    expect(r.source).toBe('gemini')
    expect(seen.note).toMatch(/семь/)
    expect(r.followAfter).toBe(24 * 3600)
  })

  it('«Пулим йук, ойликдан кейин» — подсказка про рассрочку, напомнить через неделю', async () => {
    jevSays(api('later', 0.92, 'money', 'payday'))
    const seen = modelSays('Хозир MIslamic оркали булиб тулаш мумкин.')
    const { respond } = await import('@/lib/assistant/respond')
    const r = await respond(wa('wa:j4'), [{ role: 'assistant', text: 'Расмийлаштирамизми?' }, { role: 'user', text: 'Хозир пулим йук, ойликдан кейин' }], 'ru', null, undefined, [product.id])
    expect(seen.note).toMatch(/рассрочк/)
    expect(r.followAfter).toBe(7 * 24 * 3600)
  })

  it('Jev недоступен — работают списки: «Ооба» на «Тариздейлиби?» — заказ', async () => {
    process.env.JEV_API_KEY = 'sk-or-test'
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('timeout') }))
    const { respond } = await import('@/lib/assistant/respond')
    const r = await respond(wa('wa:j5'), [{ role: 'assistant', text: 'Тариздейлиби?' }, { role: 'user', text: 'Ооба' }], 'ky', null, undefined, [product.id])
    expect(r.source).toBe('flow')
  })

  it('без ключа Jev не зовут вовсе', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const { respond } = await import('@/lib/assistant/respond')
    await respond(wa('wa:j6'), [{ role: 'assistant', text: 'Оформляем?' }, { role: 'user', text: 'Да' }], 'ru', null, undefined, [product.id])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('«Позвонить вам?» → «Позвоните завтра» (Jev: да) — заявка на звонок', async () => {
    jevSays(api('agree', 0.96))
    const { respond } = await import('@/lib/assistant/respond')
    const r = await respond(wa('wa:j7'), [{ role: 'assistant', text: 'Позвонить вам?' }, { role: 'user', text: 'Позвоните завтра утром' }], 'ru', null)
    expect(r.handoff).toBe(true)
  })
})
