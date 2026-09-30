import { describe, expect, it } from 'vitest'
import { keepOnLink, openQuery, sizeBand, techSum, topOfGallery, wallLength } from '@/components/kitchen/ready'
import { DEFAULT_STATE } from '@/lib/kitchen/share'
import type { KitchenAppliance, SlotKind } from '@/lib/kitchen/types'

const mk = (id: string, slot: SlotKind, price: number, extra: Partial<KitchenAppliance> = {}): KitchenAppliance => ({
  id,
  slot,
  name: `Модель ${id}`,
  brand: 'Test',
  price,
  w: 60,
  h: slot === 'fridge' ? 200 : slot === 'hob' ? 5 : 60,
  d: 60,
  sizeKnown: true,
  builtIn: true,
  finish: 'inox',
  ...(slot === 'hob' ? { hob: 'electric' as const } : {}),
  ...extra,
})
// пять встраиваемых на 140 000 — та же сумма, что в аудите C02 (kitchen-order)
const CATALOG = [
  mk('fr1', 'fridge', 50_000),
  mk('ov1', 'oven', 30_000),
  mk('hb1', 'hob', 20_000),
  mk('hd1', 'hood', 15_000, { h: 40 }),
  mk('dw1', 'dishwasher', 25_000, { h: 82 }),
]

describe('полоса «Готовые кухни»: размер — сумма стен, остров не в счёт', () => {
  it('длина стен по форме', () => {
    expect(wallLength({ shape: 'straight', a: 240, b: 200, c: 200 })).toBe(240)
    expect(wallLength({ shape: 'corner', a: 300, b: 180, c: 200 })).toBe(480)
    expect(wallLength({ shape: 'u', a: 260, b: 180, c: 160 })).toBe(600)
    expect(wallLength({ shape: 'island', a: 320, b: 200, c: 200 })).toBe(320)
  })
  it('«до 2,7 м» / «2,7–4 м» / «больше 4 м»', () => {
    expect(sizeBand(240)).toBe('small')
    expect(sizeBand(270)).toBe('small')
    expect(sizeBand(271)).toBe('mid')
    expect(sizeBand(400)).toBe('mid')
    expect(sizeBand(401)).toBe('big')
  })
})

describe('лучшие из галереи в полосе', () => {
  it('оценка ≥ 4 и оценок ≥ 3, не больше шести, порядок сервера', () => {
    const items = [
      { id: 'a', avg: 5, count: 2 },
      { id: 'b', avg: 4.5, count: 3 },
      { id: 'c', avg: 3.9, count: 10 },
      ...['d', 'e', 'f', 'g', 'h', 'i'].map((id) => ({ id, avg: 4, count: 4 })),
    ]
    expect(topOfGallery(items).map((i) => i.id)).toEqual(['b', 'd', 'e', 'f', 'g', 'h'])
  })
})

describe('открыть готовую кухню', () => {
  it('сумма техники — по текущим ценам каталога', () => {
    const { state } = openQuery('f=straight&a=360&fr=fr1&ov=ov1&hb=hb1&hd=hd1&dw=dw1', CATALOG)
    expect(techSum(state, CATALOG)).toBe(140_000)
  })
  it('модели нет в каталоге — слот пустой, его видно в missing; остальное как в ссылке', () => {
    const { state, missing } = openQuery('f=corner&a=300&b=200&fr=gone&ov=ov1&hb=hb1&hd=hd1&dw=dw1', CATALOG)
    expect(missing).toEqual(['fridge'])
    expect(state.picks.fridge).toBeNull()
    expect(state.picks.oven).toBe('ov1')
    expect(state.shape).toBe('corner')
    expect(techSum(state, CATALOG)).toBe(90_000)
  })
})

describe('кухня по ссылке не стирает свою несохранённую', () => {
  const mine = { ...DEFAULT_STATE, shape: 'u' as const, a: 320, b: 200, c: 180 }
  const link = { ...DEFAULT_STATE, shape: 'straight' as const, a: 300 }
  it('в автосохранении своя другая кухня — сохранить в «Мои варианты»', () => {
    expect(keepOnLink(mine, link)).toBe(true)
  })
  it('автосохранения нет, в нём кухня по умолчанию или та же, что по ссылке — не сохранять', () => {
    expect(keepOnLink(null, link)).toBe(false)
    expect(keepOnLink({ ...DEFAULT_STATE }, link)).toBe(false)
    expect(keepOnLink({ ...link }, link)).toBe(false)
  })
})
