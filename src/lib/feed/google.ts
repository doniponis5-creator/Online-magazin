/**
 * Каталог для Google Merchant Center — бесплатный показ товаров в Google.
 *
 * Merchant Center раз в сутки скачивает https://smarket.kg/api/feed/google.
 * Товары те же, что в файле для Meta (src/lib/feed/meta.ts): с ценой, фото и
 * своей страницей. Формат — RSS 2.0 с полями g:*, его Google читает без
 * настроек. Штрихкодов (GTIN) в 1С нет, поэтому identifier_exists = no.
 */
import type { Product } from '@/data/products'
import { COLUMNS, metaFeedRows } from './meta'

function xml(value: string): string {
  return value
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function googleFeedXml(list: Product[], site: string, pages: Set<string>): string {
  const items = metaFeedRows(list, site, pages).map((row) => {
    const field = Object.fromEntries(COLUMNS.map((name, i) => [name, row[i]])) as Record<(typeof COLUMNS)[number], string>
    const tags = [
      `<g:id>${xml(field.id)}</g:id>`,
      `<title>${xml(field.title)}</title>`,
      `<description>${xml(field.description)}</description>`,
      `<link>${xml(field.link)}</link>`,
      `<g:image_link>${xml(field.image_link)}</g:image_link>`,
      ...field.additional_image_link.split(',').filter(Boolean).map((url) => `<g:additional_image_link>${xml(url)}</g:additional_image_link>`),
      `<g:availability>${field.availability}</g:availability>`,
      `<g:condition>new</g:condition>`,
      `<g:price>${field.price}</g:price>`,
      ...(field.sale_price ? [`<g:sale_price>${field.sale_price}</g:sale_price>`] : []),
      `<g:brand>${xml(field.brand)}</g:brand>`,
      `<g:identifier_exists>no</g:identifier_exists>`,
    ]
    return `<item>${tags.join('')}</item>`
  })
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">',
    '<channel>',
    '<title>Smart Centr — smarket.kg</title>',
    `<link>${site}</link>`,
    '<description>Техника и электроника, Кыргызстан</description>',
    ...items,
    '</channel>',
    '</rss>',
    '',
  ].join('\n')
}
