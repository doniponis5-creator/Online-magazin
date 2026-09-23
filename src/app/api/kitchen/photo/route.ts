import { store } from '@/lib/store'

/**
 * Фото товара для 3D-конструктора кухни.
 *
 * Браузер не даёт наложить на 3D-модель картинку с чужого адреса, а фото
 * лежат на сервере каталога (api.smartcentr.store). Поэтому сайт отдаёт их
 * от своего имени. Пропускаем только фото товаров — больше ничего: иначе
 * через этот адрес можно было бы скачивать что угодно.
 */

const HOST = 'https://api.smartcentr.store/api/v1/shop/photos/'
const KEY = /^[a-z0-9-]{8,120}\.jpg$/i
const MAX_BYTES = 4 * 1024 * 1024
const KEEP = 80

type Entry = { body: ArrayBuffer; type: string }
const cache = store('kitchen-photo-cache', () => new Map<string, Entry>())

function reply(entry: Entry) {
  return new Response(entry.body, {
    headers: {
      'Content-Type': entry.type,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}

export async function GET(request: Request) {
  const src = new URL(request.url).searchParams.get('src') ?? ''
  if (!src.startsWith(HOST) || !KEY.test(src.slice(HOST.length))) {
    return new Response('Not a product photo', { status: 400 })
  }
  const hit = cache.get(src)
  if (hit) return reply(hit)

  const upstream = await fetch(src, { signal: AbortSignal.timeout(10_000) }).catch(() => null)
  if (!upstream?.ok) return new Response(null, { status: 502 })
  const type = upstream.headers.get('content-type') ?? ''
  if (!type.startsWith('image/')) return new Response(null, { status: 502 })
  const body = await upstream.arrayBuffer()
  if (body.byteLength > MAX_BYTES) return new Response(null, { status: 502 })

  const entry = { body, type }
  cache.set(src, entry)
  // Держим в памяти только последние фото, чтобы сервер не распухал.
  if (cache.size > KEEP) cache.delete(cache.keys().next().value as string)
  return reply(entry)
}
