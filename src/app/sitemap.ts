import type { MetadataRoute } from 'next'
import { READY } from '@/data/kitchen-ready'
import { products } from '@/data/products'
import { publishedIndex } from '@/lib/gallery/store'
import { SITE_URL } from '@/lib/seo'

/**
 * Карта сайта: список всех страниц для поисковика.
 *
 * Товаров почти пятьсот, и сами по себе они находятся плохо — на них никто
 * не ссылается. Карта сайта единственный способ показать их Google целиком.
 * Каждая страница отдаётся на двух языках с указанием пары через alternates.
 *
 * Галерея кухонь живая: карта пересобирается раз в 5 минут — новая кухня
 * попадает в неё не позже чем через 5 минут. Скрытая кухня до пересборки ещё
 * в карте, но её страница уже отвечает 404, и поисковик её выбросит.
 */
export const revalidate = 300

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()
  const pages = ['', '/catalog', '/kitchen', '/about', '/kitchen/gallery']

  const entry = (path: string, priority: number, lastModified: Date = now): MetadataRoute.Sitemap[number] => ({
    url: `${SITE_URL}/ru${path}`,
    lastModified,
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
    ...READY.map((k) => entry(`/kitchen/gallery/ready-${k.id}`, 0.6)),
    ...(await publishedIndex()).map((k) => entry(`/kitchen/gallery/${k.id}`, 0.5, new Date(k.createdAt))),
  ]
}
