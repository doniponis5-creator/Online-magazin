import type { Lang } from './i18n/config'

/**
 * Внутренние ссылки только вида /ru/... и /ky/....
 * Никогда не создаёт //... (protocol-relative), хост не меняется.
 */
export function buildLangHref(pathname: string, search: string, next: Lang): string {
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length === 0) return `/${next}${search}`
  const [, ...rest] = segments // первый сегмент — текущий язык
  const tail = rest.filter(Boolean).join('/')
  return `/${next}${tail ? `/${tail}` : ''}${search}`
}

/** /{lang}/catalog с фильтрами; пустые/дефолтные значения не пишутся в URL. */
export function buildCatalogHref(
  lang: Lang,
  params: { q?: string; cat?: string; brand?: string; sort?: string },
): string {
  const sp = new URLSearchParams()
  if (params.q?.trim()) sp.set('q', params.q.trim())
  if (params.cat && params.cat !== 'all') sp.set('cat', params.cat)
  if (params.brand && params.brand !== 'all') sp.set('brand', params.brand)
  if (params.sort && params.sort !== 'popular') sp.set('sort', params.sort)
  const qs = sp.toString()
  return `/${lang}/catalog${qs ? `?${qs}` : ''}`
}
