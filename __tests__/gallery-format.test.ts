import { describe, expect, it } from 'vitest'
import { galleryDate, galleryNumber } from '@/lib/gallery/format'

// 20:30 UTC = 02:30 следующего дня в Бишкеке (UTC+6): дата — бишкекская, не сервера и не браузера.
const LATE = '2026-09-27T20:30:00Z'

describe('даты и числа галереи — одинаково на сервере и в браузере', () => {
  it('коротко: 28.09.2026 на обоих языках', () => {
    expect(galleryDate(LATE, 'ru')).toBe('28.09.2026')
    expect(galleryDate(LATE, 'ky')).toBe('28.09.2026')
    expect(galleryDate('2026-01-05T03:00:00Z', 'ky')).toBe('05.01.2026')
  })

  it('длинно: RU «28 сентября 2026 г.», KY «2026-ж., 28-сентябрь»', () => {
    expect(galleryDate(LATE, 'ru', 'long')).toBe('28 сентября 2026 г.')
    expect(galleryDate(LATE, 'ky', 'long')).toBe('2026-ж., 28-сентябрь')
    expect(galleryDate('2026-05-01T10:00:00Z', 'ru', 'long')).toBe('1 мая 2026 г.')
    expect(galleryDate('2026-05-01T10:00:00Z', 'ky', 'long')).toBe('2026-ж., 1-май')
  })

  it('от часового пояса процесса не зависит', () => {
    const was = process.env.TZ
    process.env.TZ = 'America/Los_Angeles'
    try {
      expect(galleryDate(LATE, 'ky')).toBe('28.09.2026')
    } finally {
      process.env.TZ = was
    }
  })

  it('битая дата — пустая строка, не «Invalid Date»', () => {
    expect(galleryDate('не дата', 'ru')).toBe('')
  })

  it('средняя оценка: запятая, без лишних нулей', () => {
    expect(galleryNumber(4.5)).toBe('4,5')
    expect(galleryNumber(4.33)).toBe('4,33')
    expect(galleryNumber(5)).toBe('5')
  })
})
