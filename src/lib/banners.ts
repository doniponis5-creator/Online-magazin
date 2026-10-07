/**
 * Баннеры главной из 1С (владелец 07.10): «Панель сайта» → «Баннеры» → сервер (/webhook/site/banners) → сайт.
 * Здесь — без сети и React: что пришло с сервера превращаем в то, что рисует PromoCarousel, и отбрасываем
 * подозрительное (картинка не с нашего сервера, ссылка непонятного вида). Сервер проверяет то же самое.
 *
 * Ссылка из 1С: '' — никуда; product:<код 1С>; cat:<раздел>; /ru/… (язык подставится текущий); https://… —
 * другой сайт, откроется в новой вкладке.
 */
import { slugFromCode } from '@/data/1c/adapter'
import { categoryForSection } from '@/data/1c/categories'

export type BannerImage = { url: string; w: number; h: number }
export type HomeBanner = {
  id: number
  title: string
  /** ссылка как в 1С (product:, cat:, /ru/…, https://…); путь сайта на нужном языке — bannerHref */
  link: string
  desktop: BannerImage
  mobile: BannerImage | null
}

/** Картинки баннеров отдаёт только наш сервер: next/image разрешён ровно для этого адреса (next.config.ts). */
const IMAGE_PREFIX = 'https://api.smartcentr.store/api/v1/shop/photos/banner/'

function image(raw: unknown): BannerImage | null {
  if (!raw || typeof raw !== 'object') return null
  const { url, w, h } = raw as Record<string, unknown>
  if (typeof url !== 'string' || !url.startsWith(IMAGE_PREFIX)) return null
  if (typeof w !== 'number' || typeof h !== 'number' || w <= 0 || h <= 0) return null
  return { url, w, h }
}

export function bannerHref(link: string, lang: 'ru' | 'ky'): { href: string | null; external: boolean } {
  const value = link.trim()
  if (!value) return { href: null, external: false }
  if (value.startsWith('product:')) {
    const slug = slugFromCode(value.slice(8).trim())
    return slug ? { href: `/${lang}/product/${slug}`, external: false } : { href: null, external: false }
  }
  if (value.startsWith('cat:')) {
    // раздел: код сайта (fridges) или название как в 1С («Холодильники»)
    const cat = categoryForSection(value.slice(4))
    return cat ? { href: `/${lang}/catalog?cat=${cat}`, external: false } : { href: null, external: false }
  }
  if (value.startsWith('https://')) return { href: value, external: true }
  if (value.startsWith('/') && !value.startsWith('//')) {
    // страница сайта на языке, который сейчас открыт у покупателя
    return { href: value.replace(/^\/(ru|ky)(?=\/|$|\?)/, `/${lang}`), external: false }
  }
  return { href: null, external: false }
}

/** Ответ сервера → баннеры для главной. Мусор и баннеры без картинки для компьютера отбрасываем. */
export function cleanBanners(raw: unknown): HomeBanner[] {
  if (!Array.isArray(raw)) return []
  const out: HomeBanner[] = []
  for (const item of raw.slice(0, 10)) {
    if (!item || typeof item !== 'object') continue
    const b = item as Record<string, unknown>
    const desktop = image(b.desktop)
    if (!desktop || typeof b.id !== 'number') continue
    out.push({
      id: b.id,
      title: typeof b.title === 'string' ? b.title.slice(0, 80) : '',
      link: typeof b.link === 'string' ? b.link.slice(0, 300) : '',
      desktop,
      mobile: image(b.mobile),
    })
  }
  return out
}
