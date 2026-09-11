import { describe, expect, it } from 'vitest'
import { products } from '@/data/products'
import {
  comboVariant,
  colorHexOf,
  defaultColorKey,
  defaultMemoryKey,
  getProduct,
} from '@/data/products'
import {
  colorExists,
  isComboPurchasable,
  memoryExists,
  suggestCombos,
  variantLabel,
} from '@/lib/cart/sku'

const tabslate = getProduct('tabslate-10')!
const aura = getProduct('aura-x5')!
const vega = getProduct('vega-pro')!

describe('comboVariant — вариант это конкретная комбинация, без fallback', () => {
  it('finds exact color+memory combination', () => {
    expect(comboVariant(tabslate, 'blue', '128')?.id).toBe('blue-128')
  })

  it('returns undefined for a missing combination — no silent substitute', () => {
    // «Тёмный · 256 ГБ» намеренно отсутствует в демо-каталоге
    expect(comboVariant(tabslate, 'ink', '256')).toBeUndefined()
    expect(comboVariant(tabslate, 'green', '128')).toBeUndefined()
  })

  it('single-dimension products match on the existing dimension only', () => {
    expect(comboVariant(aura, 'white', null)?.id).toBe('white')
    expect(comboVariant(aura, 'green', null)).toBeUndefined()
    expect(comboVariant(vega, null, '12-512')?.id).toBe('12-512')
    expect(comboVariant(vega, null, '64')).toBeUndefined()
  })
})

describe('suggestCombos — явные предложения вместо молчаливой подмены', () => {
  it('offers in-stock combos, prioritising the chosen color', () => {
    const suggestions = suggestCombos(tabslate, 'ink', '256')
    // ink+256 в наличии нет; первый предложенный — совпадает по цвету (ink) и в наличии
    expect(suggestions[0]?.colorKey).toBe('ink')
    expect(suggestions[0]?.stock).toBeGreaterThan(0)
    // предложения не включают выбранную (отсутствующую) комбинацию
    expect(suggestions.some((v) => v.colorKey === 'ink' && v.memoryKey === '256')).toBe(false)
  })

  it('never suggests out-of-stock combos', () => {
    for (const v of suggestCombos(tabslate, 'blue', '999')) {
      expect(v.stock).toBeGreaterThan(0)
    }
  })
})

describe('isComboPurchasable — недоступный SKU не продаётся', () => {
  it('out-of-stock combination is not purchasable', () => {
    expect(isComboPurchasable(tabslate, 'ink', '256')).toBe(false) // stock 0
    expect(isComboPurchasable(tabslate, 'blue', '128')).toBe(true)
  })

  it('aura ink variant has zero demo stock', () => {
    expect(isComboPurchasable(aura, 'ink', null)).toBe(false)
  })
})

describe('existence checks — чипы опций отключаются только для несуществующих', () => {
  it('ink color exists for tabslate even though one memory is out of stock', () => {
    expect(colorExists(tabslate, 'ink')).toBe(true)
    expect(memoryExists(tabslate, '256')).toBe(true)
    expect(colorExists(tabslate, 'red')).toBe(false)
    expect(memoryExists(tabslate, '512')).toBe(false)
  })
})

describe('defaults', () => {
  it('default color prefers in-stock variant', () => {
    expect(defaultColorKey(aura)).toBe('blue') // ink имеет stock 0
    expect(defaultMemoryKey(vega, null)).toBe('8-256')
  })
})

describe('labels and colors are localized data', () => {
  it('variantLabel joins color and memory in the requested language', () => {
    const v = comboVariant(tabslate, 'blue', '256')!
    expect(variantLabel(tabslate, v, 'ru')).toBe('Голубой · 256 ГБ')
    expect(variantLabel(tabslate, v, 'ky')).toBe('Көгүлтүр · 256 ГБ')
  })

  it('colorHexOf resolves option hex or base color', () => {
    const v = comboVariant(tabslate, 'ink', '128')!
    expect(colorHexOf(tabslate, v)).toBe('#1E2C3C')
    const std = getProduct('smartview-55')!.variants[0]
    expect(colorHexOf(getProduct('smartview-55')!, std)).toBe(getProduct('smartview-55')!.baseColor)
  })

  it('all demo products keep at least one purchasable variant', () => {
    for (const p of products) {
      expect(p.variants.some((v) => v.stock > 0), p.id).toBe(true)
    }
  })
})
