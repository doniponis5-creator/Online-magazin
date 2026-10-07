/**
 * Порядок «По популярности» (аудит 07.10). Раньше это был «сначала Хит, потом Новинка», а внутри — порядок
 * 1С, то есть по алфавиту: покупатель магазина техники первым видел беговую дорожку и гардероб.
 *
 * Теперь:
 *  1) ступени: Хит → Новинка → со скидкой → остальное, что можно купить → предзаказ и «нет в наличии» →
 *     «цена по запросу» и без фото (их нечем показать — в самый конец);
 *  2) внутри ступени разделы чередуются — холодильник, стиральная, телевизор, кухня… — и первый экран
 *     сразу показывает, чем торгует магазин; внутри раздела порядок 1С сохраняется.
 * Детерминированно: один и тот же каталог — один и тот же порядок (сервер и браузер рисуют одинаково).
 */
import type { Product } from '@/data/products'

/** Какие разделы показывать первыми, когда разделы чередуются. Остальные — после, в порядке появления. */
export const CATEGORY_PRIORITY = ['fridges', 'washers', 'tv', 'kitchen', 'small-kitchen', 'care', 'climate', 'power', 'sewing', 'sport', 'home']

const onSale = (p: Product) => Boolean(p.oldPrice && p.oldPrice > p.price)
const available = (p: Product) => !p.preorder && p.variants.some((v) => v.stock > 0)

export function tier(p: Product): number {
  if (!(p.price > 0) || !p.image) return 5
  if (!available(p)) return 4
  if (p.badge === 'hit' || p.dealOfDay) return 0
  if (p.badge === 'new') return 1
  if (onSale(p)) return 2
  return 3
}

/** Разделы по очереди: первый товар каждого раздела, потом второй… */
function interleave(list: Product[]): Product[] {
  const groups = new Map<string, Product[]>()
  for (const p of list) {
    const g = groups.get(p.categoryId)
    if (g) g.push(p)
    else groups.set(p.categoryId, [p])
  }
  const order = [...groups.keys()].sort((a, b) => {
    const ia = CATEGORY_PRIORITY.indexOf(a)
    const ib = CATEGORY_PRIORITY.indexOf(b)
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib)
  })
  const out: Product[] = []
  for (let i = 0; out.length < list.length; i++) {
    for (const key of order) {
      const p = groups.get(key)![i]
      if (p) out.push(p)
    }
  }
  return out
}

export function popularOrder(list: Product[]): Product[] {
  const tiers: Product[][] = [[], [], [], [], [], []]
  for (const p of list) tiers[tier(p)].push(p)
  return tiers.flatMap(interleave)
}
