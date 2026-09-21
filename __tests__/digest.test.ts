import { describe, expect, it } from 'vitest'
import { GAVE_UP, bishkekDay, dailyDigest, rowsForDay, yesterday } from '@/lib/assistant/digest'
import type { LogRow } from '@/lib/assistant/log'

const row = (q: string, a: string, found = true, ch: LogRow['ch'] = 'whatsapp', at = '2026-09-21T05:00:00.000Z'): LogRow => ({
  at, lang: 'ru', q, a, found, source: 'gemini', ch,
})

describe('утренняя сводка', () => {
  it('день считается по Бишкеку', () => {
    // 20:00 UTC 20 сентября — это 02:00 21 сентября в Бишкеке.
    expect(bishkekDay('2026-09-20T20:00:00.000Z')).toBe('2026-09-21')
    expect(yesterday(new Date('2026-09-22T03:05:00.000Z'))).toBe('2026-09-21')
  })

  it('узнаёт ответы «спрошу у сотрудника»', () => {
    expect(GAVE_UP.test('Напишите «перезвоните» — сотрудник свяжется')).toBe(true)
    expect(GAVE_UP.test('Кызматкерибиз тактап берет')).toBe(true)
    expect(GAVE_UP.test('Стиральная машина Midea — 22 300 сом. Оформим?')).toBe(false)
  })

  it('собирает: сколько, где сдался, что не нашёл, что чаще', () => {
    const rows = [
      row('Доставка в Талас?', 'По доставке свяжется менеджер, напишите «перезвоните»'),
      row('Endura mini бор?', 'Сейчас нет. Посмотрите на сайте smarket.kg', false),
      row('Сколько стоит Midea?', 'Midea — 22 300 сом', true, 'site'),
      row('сколько стоит midea?', 'Midea — 22 300 сом', true, 'site'),
      row('Вчерашний', 'ответ', true, 'site', '2026-09-20T05:00:00.000Z'),
    ]
    const day = rowsForDay(rows, '2026-09-21')
    expect(day).toHaveLength(4)
    const text = dailyDigest(day, '2026-09-21')
    expect(text).toContain('за 21.09.2026')
    expect(text).toMatch(/Вопросов: 4 \(WhatsApp 2, сайт 2\)/)
    expect(text).toContain('Отправил к сотруднику или не знал — 1')
    expect(text).toContain('• Доставка в Талас?')
    expect(text).toContain('Товар не нашёлся — 1')
    expect(text).toContain('• Endura mini бор?')
    expect(text).toMatch(/сколько стоит midea\? — 2/)
    expect(text).toContain('Знания для чата')
  })

  it('пустой день — короткая строка', () => {
    expect(dailyDigest([], '2026-09-21')).toContain('Вопросов не было')
  })
})
