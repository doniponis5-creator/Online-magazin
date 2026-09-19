/**
 * Всё, что нужно поисковикам: адрес сайта, оба названия и разметка о магазине.
 *
 * До этого сайт не отдавал ни robots.txt, ни карты сайта, ни разметки — Google
 * не знал ни адреса магазина, ни телефонов, ни того, что «Смарт Центр» и
 * «S MARKET» это одно и то же. Поэтому по запросу «смарт центр» находилось
 * что угодно, только не мы.
 */

import { address, developer, instagram, phones, since } from '@/data/contacts'

/** Боевой адрес. Меняется только вместе с доменом. */
export const SITE_URL = 'https://smarket.kg'

/** Как магазин называют люди. Оба имени должны находиться поиском. */
export const SITE_NAME = 'Smart Centr'
export const SITE_ALT_NAMES = ['S MARKET', 'Смарт Центр', 'smarket', 'smartcentr', 'СМАРТ ЦЕНТР']

export const canonical = (path: string) => `${SITE_URL}${path}`

/**
 * Разметка организации для Google: это она показывает карточку магазина
 * с адресом и телефоном сбоку от результатов поиска.
 *
 * alternateName перечисляет все написания — так поиск связывает «смарт центр»,
 * «smarket» и сайт в одно.
 */
export function storeJsonLd(lang: 'ru' | 'ky') {
  return {
    '@context': 'https://schema.org',
    '@type': 'Store',
    '@id': `${SITE_URL}/#store`,
    name: SITE_NAME,
    alternateName: SITE_ALT_NAMES,
    url: SITE_URL,
    image: `${SITE_URL}/brand/smart-centr-mark.jpg`,
    foundingDate: String(since),
    description:
      lang === 'ky'
        ? 'Ош облусунун Араван районундагы электроника жана тиричилик техникасы дүкөнү. Бүт Кыргызстан боюнча жеткирүү.'
        : 'Магазин электроники и бытовой техники в Араванском районе Ошской области. Доставка по всему Кыргызстану.',
    telephone: phones.map((p) => `+${p.raw}`),
    address: {
      '@type': 'PostalAddress',
      streetAddress: lang === 'ky' ? 'Ош-3000 көчөсү, 86' : 'улица Ош-3000, 86',
      addressLocality: lang === 'ky' ? 'Араван району' : 'Араванский район',
      addressRegion: lang === 'ky' ? 'Ош облусу' : 'Ошская область',
      addressCountry: 'KG',
    },
    areaServed: { '@type': 'Country', name: 'Кыргызстан' },
    currenciesAccepted: 'KGS',
    paymentAccepted: lang === 'ky' ? 'Нак акча, карта, онлайн төлөм' : 'Наличные, карта, онлайн-оплата',
    sameAs: [instagram.url],
  }
}

/** Разметка сайта: даёт поиску знать про второе имя и строку поиска по каталогу. */
export function websiteJsonLd(lang: 'ru' | 'ky') {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE_URL}/#website`,
    url: SITE_URL,
    name: SITE_NAME,
    alternateName: SITE_ALT_NAMES,
    inLanguage: lang === 'ky' ? 'ky-KG' : 'ru-RU',
    publisher: { '@id': `${SITE_URL}/#store` },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE_URL}/${lang}/catalog?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  }
}

/** Полный адрес магазина одной строкой — для описаний страниц. */
export const addressLine = (lang: 'ru' | 'ky') => (lang === 'ky' ? address.ky : address.ru)

export const siteAuthor = developer.name
