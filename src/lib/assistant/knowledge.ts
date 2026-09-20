/**
 * «Память» онлайн-консультанта: то, что он знает о магазине.
 *
 * Здесь нет ни одного обращения к сети. Каталог уже лежит в коде сайта
 * (src/data/products.ts — он собран из выгрузки 1С), контакты — в
 * src/data/contacts.ts. Консультант отвечает по этим же данным, что и витрина,
 * поэтому цена в чате и цена на странице товара не могут разойтись.
 */

import { address, phones, since, yearsOnMarket } from '@/data/contacts'
import { categories, categoryName } from '@/data/categories'
import { products, type Product } from '@/data/products'
import { formatSom } from '@/lib/format'
import type { Lang } from '@/lib/i18n/config'

/** Товар в ответе консультанта: только то, что нужно показать карточкой. */
export type ProductHit = {
  id: string
  name: string
  brand: string
  price: number
  priceLabel: string
  inStock: boolean
  href: string
  image?: string
}

export function isInStock(product: Product): boolean {
  return product.variants.some((v) => v.stock > 0)
}

export function productName(product: Product, lang: Lang): string {
  return lang === 'ky' ? product.nameKy : product.nameRu
}

export function toHit(product: Product, lang: Lang): ProductHit {
  return {
    id: product.id,
    name: productName(product, lang),
    brand: product.brand,
    price: product.price,
    priceLabel: product.price > 0 ? formatSom(product.price) : lang === 'ky' ? 'Баасы суроо боюнча' : 'Цена по запросу',
    inStock: isInStock(product),
    href: `/${lang}/product/${product.id}`,
    image: product.image,
  }
}

/**
 * Поиск по каталогу обычными словами.
 *
 * Без «умных» библиотек: слово запроса ищется в названии, бренде и разделе.
 * Совпадение в названии весит больше, чем в разделе, — иначе на запрос
 * «телефон» первыми выпадали бы чехлы из раздела «Аксессуары».
 */
export function searchProducts(query: string, lang: Lang, limit = 6): Product[] {
  const words = normalize(query).split(' ').filter((w) => w.length >= 2)
  if (words.length === 0) return []

  const scored = products.map((product) => {
    const name = normalize(`${product.nameRu} ${product.nameKy} ${product.brand}`)
    const section = normalize(`${categoryName(product.categoryId, 'ru')} ${categoryName(product.categoryId, 'ky')}`)
    const specs = normalize(product.specs.map((s) => `${s.valueRu} ${s.valueKy}`).join(' '))
    let score = 0
    for (const word of words) {
      if (name.includes(word)) score += 5
      else if (section.includes(word)) score += 2
      else if (specs.includes(word)) score += 1
    }
    // Товар, которого нет на складе, показываем, но ниже: он всё же ответ на вопрос.
    if (score > 0 && isInStock(product)) score += 1
    return { product, score }
  })

  return scored
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || a.product.price - b.product.price)
    .slice(0, limit)
    .map((row) => row.product)
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-z0-9а-яңөү]+/gi, ' ')
    .trim()
}

/**
 * Весь каталог одной простынёй для языковой модели.
 *
 * Товаров сейчас несколько десятков, поэтому список отдаётся целиком: модель
 * видит настоящие цены и наличие и не придумывает их. Предел стоит на случай,
 * если 1С однажды выгрузит тысячи позиций, — тогда простыня станет слишком
 * дорогой, и понадобится поиск по запросу.
 */
export function catalogDigest(lang: Lang, limit = 400): string {
  const lines = products.slice(0, limit).map((product) => {
    const price = product.price > 0 ? `${product.price} сом` : 'цена по запросу'
    const old = product.oldPrice ? `, было ${product.oldPrice} сом` : ''
    const stock = isInStock(product) ? 'есть' : 'нет в наличии'
    const section = categoryName(product.categoryId, 'ru')
    const specs = product.specs.slice(0, 4).map((s) => `${s.labelRu}: ${s.valueRu}`).join('; ')
    return [
      `id=${product.id}`,
      `${product.brand} ${product.nameRu}`,
      `раздел: ${section}`,
      `цена: ${price}${old}`,
      `наличие: ${stock}`,
      `гарантия: ${product.warrantyMonths} мес.`,
      specs ? `характеристики: ${specs}` : '',
    ]
      .filter(Boolean)
      .join(' | ')
  })
  const cut = products.length > limit ? `\n(показаны первые ${limit} из ${products.length})` : ''
  return lines.join('\n') + cut
}

/** Всё, что консультант должен знать о самом магазине. */
export function storeFacts(lang: Lang): string {
  const numbers = phones.map((p) => p.display).join(', ')
  const sections = categories.map((c) => `${c.nameRu} (id=${c.id})`).join(', ')
  return [
    'Магазин: Smart Centr, он же S MARKET. Электроника и бытовая техника.',
    `Адрес: ${address.ru}. Работает с ${since} года (${yearsOnMarket()} лет).`,
    `Телефоны (они же WhatsApp и Telegram): ${numbers}.`,
    'Доставка по всему Кыргызстану. Оплата онлайн через O!Деньги или при получении.',
    'Есть бонусы SBonus: часть заказа можно закрыть бонусами после входа по номеру телефона.',
    'Заказать можно и без входа; вход нужен только для оплаты бонусами.',
    `Разделы каталога: ${sections}.`,
    `Язык покупателя сейчас: ${lang === 'ky' ? 'кыргызский' : 'русский'}.`,
  ].join('\n')
}
