import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/seo'

// Без этого файла поисковик угадывает, что можно обходить. Служебные адреса
// (корзина, оформление, кабинет, API) в поиске не нужны: они у каждого свои.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/ru/checkout', '/ky/checkout', '/ru/cart', '/ky/cart',
                   '/ru/account', '/ky/account', '/ru/order/', '/ky/order/', '/ru/dev', '/ky/dev'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
