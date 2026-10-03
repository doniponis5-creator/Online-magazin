import { afterEach, describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { mentionsFreeDelivery } from '@/lib/assistant/policy'
import { systemInstruction } from '@/lib/assistant/prompt'
import { durableMap } from '@/lib/durable'
import { products } from '@/data/products'

describe('бесплатная доставка — только туда, куда правда бесплатно (аудит 03.10)', () => {
  it('узнаёт города из списка на трёх языках и с окончаниями', () => {
    for (const text of ['Ошко жеткиресизби', 'я из Оша', 'Бишкекке канча', 'Өзгөндөн жазып жатам', 'Кызыл Кияга', 'Жалал-Абадда', 'Ноокатка', 'Osh'])
      expect(mentionsFreeDelivery(text), text).toBe(true)
  })
  it('не путает «ошибка» с Ошем и не обещает Таласу и Нарыну', () => {
    for (const text of ['ошибка в заказе', 'Таластан болом', 'Нарынга жеткиресизби', 'Каракол', 'хорошо'])
      expect(mentionsFreeDelivery(text), text).toBe(false)
  })
})

describe('модель знает, где пишет', () => {
  const at = (where: 'site' | 'whatsapp' | 'instagram' | 'telegram') =>
    systemInstruction('ru', null, 'ru', products, '', '', null, null, undefined, false, [], where)
  it('WhatsApp — не «чат на сайте»', () => {
    expect(at('whatsapp')).toContain('Ты отвечаешь в WhatsApp магазина')
    expect(at('whatsapp')).not.toContain('Ты отвечаешь в чате на сайте')
  })
  it('Instagram: номера нет', () => expect(at('instagram')).toContain('Номера телефона покупателя у нас нет'))
  it('по умолчанию — сайт', () => expect(at('site')).toContain('Ты отвечаешь в чате на сайте магазина'))
  it('язык сайта больше не спорит с языком покупателя', () => expect(at('whatsapp')).not.toContain('Язык покупателя сейчас'))
})

describe('durableMap — память, которая переживает перезапуск', () => {
  afterEach(() => vi.useRealTimers())
  it('запись старше ttl забывается: недельный черновик не перехватит новый разговор', () => {
    vi.useFakeTimers()
    const map = durableMap<string, number>(`test-${Math.random()}`, 1000)
    map.set('a', 1)
    expect(map.get('a')).toBe(1)
    vi.advanceTimersByTime(1500)
    expect(map.has('a')).toBe(false)
    expect(map.get('a')).toBeUndefined()
  })
  it('ключ-число остаётся числом (чат Telegram)', () => {
    const map = durableMap<number | string, string>(`test-${Math.random()}`, 60_000)
    map.set(42, 'x')
    expect(map.get(42)).toBe('x')
    expect(map.get('42')).toBeUndefined()
  })
})

describe('durableMap на диске', () => {
  it('после «перезапуска» (пустая память процесса) черновик читается из файла', async () => {
    const { mkdtempSync, rmSync } = await import('node:fs')
    const { tmpdir } = await import('node:os')
    const { join } = await import('node:path')
    const dir = mkdtempSync(join(tmpdir(), 'durable-'))
    const saved = { VITEST: process.env.VITEST, STATE_DIR: process.env.STATE_DIR }
    delete process.env.VITEST
    process.env.STATE_DIR = dir
    try {
      const before = durableMap<number | string, { step: string }>('restart', 60_000)
      before.set(777, { step: 'address' })
      await new Promise((r) => setTimeout(r, 1300))
      // Перезапуск сайта: память процесса пустая.
      ;(globalThis as { __smartcentr?: Record<string, unknown> }).__smartcentr = {}
      const after = durableMap<number | string, { step: string }>('restart', 60_000)
      expect(after).not.toBe(before)
      expect(after.get(777)).toEqual({ step: 'address' })
    } finally {
      process.env.VITEST = saved.VITEST
      if (saved.STATE_DIR === undefined) delete process.env.STATE_DIR
      else process.env.STATE_DIR = saved.STATE_DIR
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('продавец, а не реклама (владелец 03.10: «звучит не как человек»)', () => {
  const text = systemInstruction('ru', null, 'ky', products)
  it('не вываливает всё сразу и не пишет по шаблону', () => {
    expect(text).toContain('НЕ ВЫВАЛИВАЙ ВСЁ СРАЗУ')
    expect(text).toContain('Не пиши каждый ответ по одному шаблону')
    expect(text).toContain('Не два и не три вопроса сразу')
  })
  it('пишет в тон покупателю и его словами', () => expect(text).toContain('Пиши в тон покупателю'))
  it('имя покупателя не выспрашивает', () => {
    expect(text).toContain('не выспрашивай')
    expect(text).not.toMatch(/в первом или втором ответе спроси, как зовут/)
  })
  it('в образцах нет обещания «до центра района бесплатно» всем подряд и нет настоящих цен', () => {
    expect(text).not.toContain('Привезём бесплатно до центра района.')
    expect(text).not.toContain('до центра района или области — бесплатно')
    expect(text).toContain('Не знаешь, откуда он, — не обещай')
    const samples = text.slice(text.indexOf('ОБРАЗЦЫ'), text.indexOf('ЧЕГО НЕЛЬЗЯ'))
    expect(samples).not.toMatch(/15 900|18 800/)
  })
  it('правила не задублированы: «Здоровайся один раз» — одна строка', () => {
    expect(text.split('Здоровайся один раз').length - 1).toBe(1)
    expect(text.split('НЕ ТОРОПИ С ОФОРМЛЕНИЕМ').length - 1).toBe(1)
  })
})
