import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/seo'

// Без этого файла поисковик угадывает, что можно обходить. Служебные адреса
// (корзина, оформление, кабинет, API) в поиске не нужны: они у каждого свои.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        // /api/site-settings открыт нарочно: главная страница спрашивает у него
        // приветственный бонус и процент. Пока он был закрыт, робот Google
        // рисовал блок SBonus+ без чисел — и в поиске от него не было толку.
        allow: ['/', '/api/site-settings'],
        disallow: ['/api/', '/ru/checkout', '/ky/checkout', '/ru/cart', '/ky/cart',
                   '/ru/account', '/ky/account', '/ru/order/', '/ky/order/', '/ru/dev', '/ky/dev'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
