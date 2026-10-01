import { afterEach, describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))

import { chatText, parseRating, qualityText, rateChats, type Rated } from '@/lib/assistant/quality'

afterEach(() => {
  delete process.env.JEV_API_KEY
  vi.unstubAllGlobals()
})

const r = (phone: string, outcome: Rated['outcome'], reason: Rated['reason'] = 'other', botOk = 0.9, last = 'Канча турат?'): Rated => ({ phone, outcome, reason, botOk, last })

describe('недельная оценка качества', () => {
  it('переписка для Jev: К/Б, без лишних пробелов, не длиннее 3500', () => {
    const text = chatText([{ role: 'user', text: 'Кир  машина\nбарбы' }, { role: 'assistant', text: 'Бар, 21 400 сом.' }])
    expect(text).toBe('К: Кир машина барбы\nБ: Бар, 21 400 сом.')
    expect(chatText(Array.from({ length: 40 }, () => ({ role: 'user' as const, text: 'а'.repeat(500) }))).length).toBeLessThanOrEqual(3500)
  })

  it('ответ Jev разбирается; мусор — null', () => {
    expect(parseRating({ answers: { outcome: { choice: 'left' }, reason: { choice: 'price' }, bot_ok: { noul: 0.2 } } }, '996700', 'Кымбат')).toEqual(r('996700', 'left', 'price', 0.2, 'Кымбат'))
    expect(parseRating({ answers: { outcome: { choice: 'maybe' } } }, '1', '')).toBeNull()
    expect(parseRating(null, '1', '')).toBeNull()
  })

  it('итог: доли, причины, кого посмотреть; знакомые отдельно', () => {
    const text = qualityText([
      r('996700000001', 'ordered'),
      r('996700000002', 'left', 'price'),
      r('996700000003', 'left', 'price'),
      r('996700000004', 'later', 'money'),
      r('996700000005', 'left', 'bot_error', 0.1, 'Мен эмне дедим?'),
      r('996700000006', 'not_customer'),
      r('996700000007', 'unclear', 'price'),
    ], '24.09', '30.09')
    expect(text).toContain('Покупателей в WhatsApp: 6')
    expect(text).toContain('✅ Оформили: 1 (17%)')
    expect(text).toMatch(/дорого — 3/)
    expect(text).toContain('+996700000005 — «Мен эмне дедим?»')
    expect(text).toContain('Не покупатели (знакомые, рассрочка, жалобы): 1')
  })

  it('без ключа Jev ничего не оценивается; номер в Jev не уходит', async () => {
    expect(await rateChats([{ phone: '996700', turns: [{ role: 'user', text: 'Салам' }] }])).toEqual([])
    process.env.JEV_API_KEY = 'sk-or-test'
    const bodies: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (_u: unknown, init: { body: string }) => {
      bodies.push(init.body)
      return new Response(JSON.stringify({ answers: { outcome: { choice: 'ordered' }, reason: { choice: 'other' }, bot_ok: { noul: 0.9 } } }), { status: 200 })
    }))
    const out = await rateChats([{ phone: '996771168989', turns: [{ role: 'user', text: 'Кир машина барбы' }] }])
    expect(out[0].outcome).toBe('ordered')
    expect(bodies[0]).not.toContain('996771168989')
  })
})
