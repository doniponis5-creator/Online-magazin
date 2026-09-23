import type { MetadataRoute } from 'next'
import { products } from '@/data/products'
import { SITE_URL } from '@/lib/seo'

/**
 * Карта сайта: список всех страниц для поисковика.
 *
 * Товаров почти пятьсот, и сами по себе они находятся плохо — на них никто
 * не ссылается. Карта сайта единственный способ показать их Google целиком.
 * Каждая страница отдаётся на двух языках с указанием пары через alternates.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  const pages = ['', '/catalog', '/kitchen', '/about', '/sources']

  const entry = (path: string, priority: number): MetadataRoute.Sitemap[number] => ({
    url: `${SITE_URL}/ru${path}`,
    lastModified: now,
    changeFrequency: path === '' || path === '/catalog' ? 'daily' : 'monthly',
    priority,
    alternates: {
      languages: {
        ru: `${SITE_URL}/ru${path}`,
        ky: `${SITE_URL}/ky${path}`,
      },
    },
  })

  return [
    ...pages.map((path, index) => entry(path, index === 0 ? 1 : 0.8 - index * 0.1)),
    ...products.map((product) => entry(`/product/${product.id}`, 0.7)),
  ]
}
