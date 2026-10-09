import type { Product } from './products'

/**
 * «Лучшая цена» (владелец 09.10, перед рекламой): известные модели, у которых мы дешевле других магазинов.
 * Покупатель сравнит — и запомнит магазин как самый дешёвый. Конкурентов на сайте не называем.
 *
 * Отмечает владелец сам — галочка «Лучшая цена» в 1С (Онлайн магазин → карточка товара или колонка «Лучш.»
 * в списке) → поле `bestPrice` каталога. Цену конкурентов не храним (владелец 09.10: «ўзим энг арзон қилиб қўяман»).
 * Первый список перенёс в 1С `scripts/set_best_price.py`.
 */
export function isBestPrice(p: Pick<Product, 'bestPrice' | 'price'>): boolean {
  return p.bestPrice === true && p.price > 0
}

const onSale = (p: Product) => Boolean(p.price > 0 && (p.sale || (p.oldPrice && p.oldPrice > p.price)))
const inStock = (p: Product) => p.variants.some((v) => v.stock > 0)

/**
 * Раздел «Лучшая цена»: сначала отмеченные в 1С (дорогие вперёд — телевизор и стиральная заметнее чайника),
 * потом товары со скидкой. Только то, что можно купить сейчас: без цены и без остатка — не показываем.
 */
export function bestPriceProducts(all: Product[]): Product[] {
  const best = all.filter((p) => isBestPrice(p) && inStock(p)).sort((a, b) => b.price - a.price)
  const taken = new Set(best.map((p) => p.id))
  const sale = all.filter((p) => !taken.has(p.id) && onSale(p) && inStock(p))
  return [...best, ...sale]
}

/** Товар раздела: «Лучшая цена» или скидка — для фильтра каталога ?best=1. */
export function inBestPrice(p: Product): boolean {
  return (isBestPrice(p) || onSale(p)) && inStock(p)
}
