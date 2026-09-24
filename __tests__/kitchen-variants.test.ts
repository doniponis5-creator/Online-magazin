import { describe, expect, it } from 'vitest'
import { parseVariants, type Variant } from '@/lib/kitchen/variants'

const good: Variant = { id: 'v1', name: 'Кухня', label: 'L · Модерн', q: 'shape=l&style=modern', img: '', at: 1 }

describe('parseVariants — «мои варианты» из localStorage', () => {
  it('битая строка → пустой список, без исключения', () => {
    expect(parseVariants('{')).toEqual([])
  })

  it('мусор в массиве отсеивается', () => {
    expect(parseVariants('[1,{"q":1}]')).toEqual([])
  })

  it('нет записи → пустой список', () => {
    expect(parseVariants(null)).toEqual([])
  })

  it('правильный список возвращается как есть', () => {
    expect(parseVariants(JSON.stringify([good]))).toEqual([good])
  })

  it('в смешанном списке остаются только варианты', () => {
    expect(parseVariants(JSON.stringify([good, 1, { q: 1 }]))).toEqual([good])
  })

  it('один объект вместо списка → пустой список', () => {
    expect(parseVariants('{"q":"a","name":"b"}')).toEqual([])
  })
})
