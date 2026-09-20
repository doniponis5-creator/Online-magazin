import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { hideDigits, summarize, type LogRow } from '@/lib/assistant/log'

describe('hideDigits', () => {
  it('прячет телефон', () => {
    expect(hideDigits('мой номер +996 700 12 34 56, перезвоните')).toBe('мой номер …, перезвоните')
  })

  it('не трогает цену и объём', () => {
    expect(hideDigits('холодильник 29800 сом, 350 литров')).toBe('холодильник 29800 сом, 350 литров')
  })

  it('прячет номер заказа из цифр', () => {
    expect(hideDigits('заказ 1002345 где?')).toBe('заказ … где?')
  })
})

const row = (at: string, q: string, found: boolean): LogRow => ({
  at,
  lang: 'ru',
  q,
  a: 'ответ',
  found,
  source: 'gemini',
})

describe('summarize', () => {
  const rows = [
    row('2026-09-20T10:00:00.000Z', 'холодильник', false),
    row('2026-09-20T11:00:00.000Z', 'Холодильник ', false),
    row('2026-09-19T09:00:00.000Z', 'пылесос', true),
  ]

  it('считает всего и без товара', () => {
    const s = summarize(rows)
    expect(s.total).toBe(3)
    expect(s.notFound).toBe(2)
  })

  it('складывает одинаковые вопросы независимо от регистра и пробелов', () => {
    expect(summarize(rows).top).toEqual([{ q: 'холодильник', count: 2 }])
  })

  it('считает по дням, новые сверху', () => {
    expect(summarize(rows).byDay).toEqual([
      { day: '2026-09-20', count: 2 },
      { day: '2026-09-19', count: 1 },
    ])
  })

  it('в «не нашлось» попадают только они', () => {
    expect(summarize(rows).misses.every((r) => !r.found)).toBe(true)
    expect(summarize(rows).misses).toHaveLength(2)
  })
})
