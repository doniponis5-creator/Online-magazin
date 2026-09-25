import { products } from '@/data/products'
import { store } from '@/lib/store'

/**
 * Фото товара для 3D-конструктора кухни.
 *
 * Браузер не даёт наложить на 3D-модель картинку с чужого адреса, а фото
 * лежат на сервере каталога (api.smartcentr.store). Поэтому сайт отдаёт их
 * от своего имени. Пропускаем только фото товаров — больше ничего: иначе
 * через этот адрес можно было бы скачивать что угодно.
 *
 * Белый список, а не только форма ключа. Каталог собран заранее
 * (`src/data/products.ts`), значит все допустимые адреса фото известны.
 * Без списка любой выдуманный ключ подходящей формы уходил бы запросом на
 * сервер каталога нашими руками — чужой скрипт мог бы гонять его без конца.
 * Ключ не из списка отбрасывается сразу, наружу запрос не идёт.
 */

const HOST = 'https://api.smartcentr.store/api/v1/shop/photos/'
// Вторая линия: даже адрес из каталога должен выглядеть как ключ фото.
const KEY = /^[a-z0-9-]{8,120}\.jpg$/i
const MAX_BYTES = 2 * 1024 * 1024
const KEEP = 40
// Сервер каталога мог бы отдать svg со скриптом — такое в 3D не нужно.
const TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

type Entry = { body: ArrayBuffer; type: string }
const cache = store('kitchen-photo-cache', () => new Map<string, Entry>())
const allowed = store(
  'kitchen-photo-allow',
  () => new Set(products.map((p) => p.image ?? '').filter((src) => src.startsWith(HOST))),
)

function reply(entry: Entry) {
  return new Response(entry.body, {
    headers: {
      'Content-Type': entry.type,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}

export async function GET(request: Request) {
  const src = new URL(request.url).searchParams.get('src') ?? ''
  if (!allowed.has(src) || !src.startsWith(HOST) || !KEY.test(src.slice(HOST.length))) {
    return new Response('Not a product photo', { status: 400 })
  }
  const hit = cache.get(src)
  if (hit) return reply(hit)

  const upstream = await fetch(src, { signal: AbortSignal.timeout(10_000) }).catch(() => null)
  if (!upstream?.ok) return new Response(null, { status: 502 })
  const type = (upstream.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase()
  if (!TYPES.has(type)) return new Response(null, { status: 502 })
  const body = await upstream.arrayBuffer()
  if (body.byteLength > MAX_BYTES) return new Response(null, { status: 502 })

  const entry = { body, type }
  cache.set(src, entry)
  // Держим в памяти только последние фото, чтобы сервер не распухал.
  if (cache.size > KEEP) cache.delete(cache.keys().next().value as string)
  return reply(entry)
}
