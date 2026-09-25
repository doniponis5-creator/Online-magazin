/**
 * Каталог для Meta (Commerce Manager → WhatsApp Business).
 *
 * Commerce Manager раз в сутки скачивает этот файл по адресу
 * https://smarket.kg/api/feed/meta и обновляет каталог, который видят в
 * WhatsApp магазина. Формат — CSV с полями из справки Meta: id, title,
 * description, availability, condition, price, link, image_link, brand.
 *
 * В файл попадают только товары, которые можно купить на сайте: с ценой,
 * фото и своей страницей. Товары «только для чата» не попадают.
 */
import type { Product } from '@/data/products'

export const COLUMNS = [
  'id',
  'title',
  'description',
  'availability',
  'condition',
  'price',
  'sale_price',
  'link',
  'image_link',
  'additional_image_link',
  'brand',
] as const

/** Поле CSV: кавычки удваиваем, переводы строк убираем — Meta их не любит. */
function cell(value: string): string {
  const flat = value.replace(/\s+/g, ' ').trim()
  return /[",]/.test(flat) ? `"${flat.replace(/"/g, '""')}"` : flat
}

function absolute(url: string, site: string): string {
  return url.startsWith('http') ? url : `${site}${url.startsWith('/') ? '' : '/'}${url}`
}

export function metaFeedRows(list: Product[], site: string, pages: Set<string>): string[][] {
  const rows: string[][] = []
  for (const p of list) {
    if (p.chatOnly || !p.price || p.price <= 0 || !p.image || !pages.has(p.id)) continue
    const inStock = p.variants.some((v) => v.stock > 0)
    const title = p.nameRu.slice(0, 150)
    const description = (p.descRu || p.nameRu).slice(0, 5000)
    // Скидка: обычная цена — прежняя, sale_price — сегодняшняя.
    const onSale = Boolean(p.oldPrice && p.oldPrice > p.price)
    const extra = (p.images ?? []).filter((img) => img !== p.image).slice(0, 9).map((img) => absolute(img, site))
    rows.push([
      p.id,
      title,
      description,
      inStock ? 'in stock' : 'out of stock',
      'new',
      `${onSale ? p.oldPrice : p.price} KGS`,
      onSale ? `${p.price} KGS` : '',
      `${site}/ru/product/${p.id}`,
      absolute(p.image, site),
      extra.join(','),
      p.brand || 'Smart Centr',
    ])
  }
  return rows
}

export function metaFeedCsv(list: Product[], site: string, pages: Set<string>): string {
  const lines = [COLUMNS.join(',')]
  for (const row of metaFeedRows(list, site, pages)) lines.push(row.map(cell).join(','))
  return lines.join('\n') + '\n'
}
