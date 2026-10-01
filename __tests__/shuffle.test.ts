import { describe, expect, it } from 'vitest'
import { shuffleWithSeed } from '@/lib/useShuffle'

const ten = Array.from({ length: 10 }, (_, i) => `товар-${i}`)

describe('shuffleWithSeed — порядок витрин главной', () => {
  it('не теряет и не дублирует товары', () => {
    const out = shuffleWithSeed(ten, 12345)
    expect(out).toHaveLength(ten.length)
    expect([...out].sort()).toEqual([...ten].sort())
  })

  it('одно зерно — один порядок: баннер распродажи не тасует соседей', () => {
    expect(shuffleWithSeed(ten, 777)).toEqual(shuffleWithSeed(ten, 777))
  })

  it('не меняет исходный список', () => {
    const copy = [...ten]
    shuffleWithSeed(ten, 42)
    expect(ten).toEqual(copy)
  })

  it('из 10 отмеченных первыми выходят разные товары', () => {
    // «Специально для вас» берёт первые три — на разных открытиях они должны меняться
    const firsts = new Set(Array.from({ length: 50 }, (_, seed) => shuffleWithSeed(ten, seed + 1).slice(0, 3).join()))
    expect(firsts.size).toBeGreaterThan(40)
    const leaders = new Set(Array.from({ length: 200 }, (_, seed) => shuffleWithSeed(ten, seed + 1)[0]))
    expect(leaders.size).toBe(ten.length)
  })
})
