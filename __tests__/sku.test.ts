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
  isComboPurchasable,
  pickColorForMemory,
  pickMemoryForColor,
  variantLabel,
} from '@/lib/cart/sku'

const tabslate = getProduct('tabslate-10')!
const aura = getProduct('aura-x5')!
const vega = getProduct('vega-pro')!

describe('comboVariant — вариант это конкретная комбинация, без fallback', () => {
  it('finds exact color+memory combination', () => {
    expect(comboVariant(tabslate, 'blue', '128')?.id).toBe('blue-128')
    expect(comboVariant(tabslate, 'ink', '256')?.id).toBe('ink-256')
  })

  it('returns undefined for a combination that does not exist (no silent substitute)', () => {
    // комбинация существует, но в данных её нет — подменять нельзя
    const ghost = { ...tabslate, variants: tabslate.variants.filter((v) => v.id !== 'ink-256') }
    expect(comboVariant(ghost, 'ink', '256')).toBeUndefined()
  })

  it('single-dimension products match on the existing dimension only', () => {
    expect(comboVariant(aura, 'white', null)?.id).toBe('white')
    expect(comboVariant(aura, 'green', null)).toBeUndefined()
    expect(comboVariant(vega, null, '12-512')?.id).toBe('12-512')
    expect(comboVariant(vega, null, '64')).toBeUndefined()
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

describe('pickMemoryForColor / pickColorForMemory — согласование выбора', () => {
  it('keeps preferred memory when the combination exists', () => {
    expect(pickMemoryForColor(tabslate, 'blue', '256')).toBe('256')
  })

  it('falls back to an existing memory for the color when combination is missing', () => {
    // blue + 512 не существует → вернём существующую память для blue
    expect(pickMemoryForColor(tabslate, 'blue', '512')).toBe('128')
  })

  it('prefers in-stock fallback', () => {
    expect(pickMemoryForColor(tabslate, 'ink', '256')).toBe('128') // ink+256 stock 0 → 128
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
