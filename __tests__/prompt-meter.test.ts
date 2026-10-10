import { describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { products } from '@/data/products'
import { systemInstruction } from '@/lib/assistant/prompt'
import { promptParts, usedFrom } from '@/lib/assistant/meter'

describe('счётчик частей промпта (10.10)', () => {
  const turns = [{ role: 'user' as const, text: 'Холодильник барбы? Ошко жеткиресизби' }]
  // вопрос — название товара из вшитого каталога (в нём нет холодильников): focus не пустой
  const named = products.find((p) => p.price > 0)!.nameRu
  const system = systemInstruction('ru', null, 'ky', products, `${named} Ош`, '', null, null, undefined, false, [], 'whatsapp', 'Ошко жеткиресизби')
  const p = promptParts(system, turns)

  it('части в сумме — весь промпт, разговор отдельно', () => {
    expect(p.fixed + p.focus + p.brief + p.place + p.viewing + p.other).toBe(system.length)
    expect(p.turns).toBe(turns[0].text.length)
    expect(p.fixed).toBeGreaterThan(1000)
    expect(p.focus).toBeGreaterThan(0)
  })

  it('id товаров focus и brief, откуда модель взяла товар', () => {
    expect(p.focusIds.length).toBeGreaterThan(0)
    const [a] = p.focusIds
    expect(usedFrom([a, 'x', 'talked1'], ['talked1'], p.focusIds, p.briefIds)).toEqual({ talked: 1, focus: 1, brief: 0, elsewhere: 1 })
  })

  it('без «СЕЙЧАС» — всё общая часть', () => {
    expect(promptParts('просто текст', [])).toMatchObject({ fixed: 12, focus: 0, brief: 0, other: 0 })
  })
})
