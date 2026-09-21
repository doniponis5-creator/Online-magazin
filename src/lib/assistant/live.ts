import 'server-only'

/**
 * Каталог прямо из 1С, без пересборки сайта.
 *
 * 1С каждые 10 минут отправляет товары, цены и остатки на сервер SBonus.
 * Сайт до сих пор брал их из файла, который вшивается при сборке: поменялась
 * цена — надо пересобирать сайт. Для чата это не годится, он должен называть
 * сегодняшнюю цену.
 *
 * Поэтому раз в десять минут забираем каталог с сервера и держим в памяти.
 * Сервер не ответил, настройки не заданы, каталог пришёл пустым — работаем по
 * вшитому файлу. Чат не должен замолкать из-за того, что сервер моргнул.
 */

import { createHmac } from 'node:crypto'
import { productsFromOneC, type OneCCatalog } from '@/data/1c/adapter'
import { products as builtIn, type Product } from '@/data/products'
import { store } from '@/lib/store'

const PATH = '/api/v1/webhook/site/catalog'

/** Как часто спрашиваем сервер. 1С всё равно присылает не чаще, чем раз в 10 минут. */
const EVERY_MS = 10 * 60_000

type Cache = { at: number; list: Product[]; hash: string | null }

const cache = store<Cache>('catalog', () => ({ at: 0, list: builtIn, hash: null }))

export function liveCatalogConfigured(): boolean {
  return Boolean(process.env.SHOP_API_URL && process.env.SHOP_API_SECRET)
}

/** Сегодняшний каталог. Никогда не бросает исключение и никогда не пуст. */
export async function catalogNow(): Promise<Product[]> {
  if (!liveCatalogConfigured()) return builtIn
  if (Date.now() - cache.at < EVERY_MS) return cache.list

  // Время отмечаем до запроса: если сервер лежит, мы не будем долбить его
  // на каждое сообщение покупателя.
  cache.at = Date.now()

  const url = (process.env.SHOP_API_URL ?? '').replace(/\/+$/, '')
  const secret = process.env.SHOP_API_SECRET ?? ''
  try {
    const signature = createHmac('sha256', secret).update(PATH, 'utf8').digest('hex')
    const response = await fetch(`${url}${PATH}`, {
      headers: { 'X-Signature': signature },
      signal: AbortSignal.timeout(20_000),
    })
    if (!response.ok) {
      console.error('[assistant] каталог: сервер ответил', response.status)
      return cache.list
    }
    const data = (await response.json()) as OneCCatalog & { hash?: string | null }
    if (!Array.isArray(data.items) || data.items.length === 0) {
      console.error('[assistant] каталог: сервер прислал пустой список')
      return cache.list
    }
    if (data.hash && data.hash === cache.hash) return cache.list

    const list = productsFromOneC(data)
    if (list.length > 0) {
      cache.list = list
      cache.hash = data.hash ?? null
      console.info(`[assistant] каталог обновлён из 1С: ${list.length} товаров`)
    }
  } catch (error) {
    console.error('[assistant] каталог:', error instanceof Error ? error.message : error)
  }
  return cache.list
}

// ── Товары только для чата ────────────────────────────────────────────────────
// На складе есть, на сайте нет. Сайт их не показывает; чат видит и может
// продать — см. shop_catalog.py (chat-extra) и 1С ОтправитьТоварыДляЧата.

const EXTRA_PATH = '/api/v1/webhook/site/chat-extra'
type ExtraCache = { at: number; list: Product[] }
const extraCache = store<ExtraCache>('chat-extra', () => ({ at: 0, list: [] }))

async function chatExtraNow(): Promise<Product[]> {
  if (!liveCatalogConfigured()) return []
  if (Date.now() - extraCache.at < EVERY_MS) return extraCache.list
  extraCache.at = Date.now()
  const url = (process.env.SHOP_API_URL ?? '').replace(/\/+$/, '')
  const secret = process.env.SHOP_API_SECRET ?? ''
  try {
    const signature = createHmac('sha256', secret).update(EXTRA_PATH, 'utf8').digest('hex')
    const response = await fetch(`${url}${EXTRA_PATH}`, {
      headers: { 'X-Signature': signature },
      signal: AbortSignal.timeout(20_000),
    })
    // 404 — сервер ещё без этой части: просто нет таких товаров.
    if (!response.ok) return extraCache.list
    const data = (await response.json()) as OneCCatalog
    extraCache.list = productsFromOneC({ items: Array.isArray(data.items) ? data.items : [] }).map((p) => ({
      ...p,
      chatOnly: true,
    }))
  } catch (error) {
    console.error('[assistant] товары для чата:', error instanceof Error ? error.message : error)
  }
  return extraCache.list
}

/**
 * Каталог для продажи в чате: сайт + товары только для чата.
 * Товар сайта без цены заменяется своей версией «для чата» — с ценой из 1С.
 */
export async function salesCatalogNow(): Promise<Product[]> {
  const [site, extra] = await Promise.all([catalogNow(), chatExtraNow()])
  if (extra.length === 0) return site
  const extraById = new Map(extra.map((p) => [p.id, p]))
  const merged = site.map((p) => (p.price <= 0 && extraById.has(p.id) ? extraById.get(p.id)! : p))
  const onSite = new Set(site.map((p) => p.id))
  return [...merged, ...extra.filter((p) => !onSite.has(p.id))]
}

/** Поиск товара по адресу страницы — в том каталоге, который сейчас в работе. */
export function lookupIn(list: Product[]): (id: string) => Product | undefined {
  const byId = new Map(list.map((p) => [p.id, p]))
  return (id: string) => byId.get(id)
}
