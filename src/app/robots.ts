import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/seo'

/**
 * Кто и что может обходить.
 *
 * Без этого файла поисковик угадывает сам. Служебные адреса (корзина,
 * оформление, кабинет, API) в поиске не нужны: они у каждого свои.
 *
 * Отдельно разделены два разных дела, которые часто путают:
 *
 *  • Помощник отвечает человеку здесь и сейчас — ChatGPT, Gemini, Perplexity
 *    заходят на страницу, читают цену и дают ссылку на магазин. Это нам нужно:
 *    так нас находят и к нам приходят.
 *
 *  • Обучение модели — каталог целиком скачивают один раз и вшивают в память
 *    модели. Это нам вредно: цены и остатки меняются каждый день, а в памяти
 *    останется сегодняшняя. Через полгода помощник назовёт покупателю цену,
 *    которой давно нет, и виноват будет магазин.
 *
 * Поэтому помощникам — да, сборщикам для обучения — нет.
 */

/** Заходят на сайт, чтобы ответить человеку сейчас, и дают ссылку на нас. */
const ASSISTANTS = [
  'ChatGPT-User',
  'OAI-SearchBot',
  'Google-Extended',
  'Google-NotebookLM',
  'Google-CloudVertexBot',
  'Perplexity-User',
  'PerplexityBot',
  'Claude-User',
  'Claude-SearchBot',
  'MistralAI-User',
]

/** Качают содержимое в обучающие наборы. Цены в их памяти устареют. */
const TRAINERS = [
  'GPTBot',
  'CCBot',
  'ClaudeBot',
  'anthropic-ai',
  'Applebot-Extended',
  'Bytespider',
  'Amazonbot',
  'meta-externalagent',
  'Diffbot',
  'omgili',
  'cohere-ai',
  'MistralAI-Training',
]

/** Личные страницы: у каждого покупателя свои, поиску там делать нечего. */
const PRIVATE = [
  '/api/',
  '/ru/checkout',
  '/ky/checkout',
  '/ru/cart',
  '/ky/cart',
  '/ru/account',
  '/ky/account',
  '/ru/order/',
  '/ky/order/',
  '/ru/dev',
  '/ky/dev',
]

// /api/site-settings открыт нарочно: главная страница спрашивает у него
// приветственный бонус и процент. Пока он был закрыт, робот Google рисовал
// блок SBonus+ без чисел — и в поиске от него не было толку.
const ALLOW = ['/', '/api/site-settings']

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: ALLOW, disallow: PRIVATE },
      { userAgent: ASSISTANTS, allow: ALLOW, disallow: PRIVATE },
      { userAgent: TRAINERS, disallow: '/' },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
