import type { Product } from '@/data/products'

/** Карточка баннера «Скидки»: только то, что нужно колоде, — без всего товара. */
export type SaleCard = {
  id: string
  nameRu: string
  nameKy: string
  image: string
  price: number
  oldPrice: number
}

/** Меньше — колода не складывается: баннер «Скидки» уступает место «Готовым кухням в 3D». */
export const SALE_MIN = 3
const SALE_MAX = 7

export const discountPct = (c: Pick<SaleCard, 'price' | 'oldPrice'>) => Math.round((1 - c.price / c.oldPrice) * 100)

/**
 * Товары для баннера — прямо из каталога 1С: есть старая цена выше новой, есть фото, есть на складе.
 * Самая большая скидка — сверху колоды. Владелец ставит скидку в 1С — баннер меняется сам.
 */
export function saleDeck(products: readonly Product[]): SaleCard[] {
  return products
    .filter((p) => p.price > 0 && p.oldPrice && p.oldPrice > p.price && p.image && p.variants.some((v) => v.stock > 0))
    .map((p) => ({ id: p.id, nameRu: p.nameRu, nameKy: p.nameKy, image: p.image!, price: p.price, oldPrice: p.oldPrice! }))
    .sort((a, b) => discountPct(b) - discountPct(a) || b.oldPrice - b.price - (a.oldPrice - a.price))
    .slice(0, SALE_MAX)
}
