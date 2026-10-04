import { createHmac, timingSafeEqual } from 'node:crypto'
import { ImageResponse } from 'next/og'
import sharp, { type Sharp } from 'sharp'
import { CoverCard, FORMATS, POST_KINDS, PostCard, photoAllowed, postFonts, type PostData, type PostFormat, type PostKind } from '@/lib/instagram/postImage'

/**
 * Картинка поста Instagram для сервера SBonus (shop_ig_post.py): он присылает данные товара
 * из своего каталога, сайт рисует пост в оформлении smarket.kg и отдаёт JPEG —
 * Instagram принимает только JPEG.
 *
 * Подпись — та же, что у /api/channel/instagram (HMAC тела секретом SHOP_API_SECRET).
 * Тело: {"format": "post" | "story", "kind": "sale" | "new" | "deal" | "hit" | "foryou" | "plain", "name": "…", "price": 15900, "oldPrice": 18900,
 *        "photo": "https://api.smartcentr.store/…jpg", "cta": "reply" — у истории Instagram внизу «ответьте — пришлём ссылку»}
 * Ответ: image/jpeg 1080 × 1350 (пост) или 1080 × 1920 (история).
 * Фото просили, а скачать не вышло — 502: пост с заглушкой вместо товара не публикуем.
 */
export const dynamic = 'force-dynamic'

const KINDS = new Set<PostKind>(POST_KINDS)
const PHOTO_MAX = 8 * 1024 * 1024

function signed(body: string, signature: string): boolean {
  const secret = process.env.SHOP_API_SECRET ?? ''
  const expected = Buffer.from(createHmac('sha256', secret).update(body, 'utf8').digest('hex'))
  const given = Buffer.from(signature)
  // Длины — в байтах: подпись из не-ASCII букв той же длины в знаках уронила бы timingSafeEqual (500 вместо 404).
  return Boolean(secret) && given.length === expected.length && timingSafeEqual(given, expected)
}

/** Цвет углов фото, если они одного цвета (обычно белый фон товара); иначе null. */
async function cornerColor(image: Sharp): Promise<string | null> {
  const { data, info } = await image.clone().resize(32, 32, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const at = (x: number, y: number) => {
    const i = (y * info.width + x) * info.channels
    return [data[i], data[i + 1], data[i + 2]]
  }
  const corners = [at(0, 0), at(info.width - 1, 0), at(0, info.height - 1), at(info.width - 1, info.height - 1)]
  const spread = Math.max(...[0, 1, 2].map((c) => Math.max(...corners.map((p) => p[c])) - Math.min(...corners.map((p) => p[c]))))
  // Светлый и ровный фон — продолжаем его в рамку. Тёмный или пёстрый — облачный фон сайта.
  if (spread > 12 || corners.some((p) => Math.min(...p) < 200)) return null
  const avg = [0, 1, 2].map((c) => Math.round(corners.reduce((sum, p) => sum + p[c], 0) / corners.length))
  return `rgb(${avg.join(',')})`
}

async function loadPhoto(url: string): Promise<Pick<PostData, 'photo' | 'photoW' | 'photoH' | 'photoBg'>> {
  const none = { photo: null, photoW: 0, photoH: 0, photoBg: null }
  if (!url || !photoAllowed(url)) return none
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(10_000) })
    if (!response.ok) return none
    const bytes = Buffer.from(await response.arrayBuffer())
    if (bytes.length > PHOTO_MAX) return none
    // Больше 1000 px в рамке не нужно, а лишние мегабайты замедляют рисование.
    const image = sharp(bytes).rotate().resize(1000, 1000, { fit: 'inside', withoutEnlargement: true }).flatten({ background: '#ffffff' })
    const { data, info } = await image.clone().jpeg({ quality: 92 }).toBuffer({ resolveWithObject: true })
    return {
      photo: `data:image/jpeg;base64,${data.toString('base64')}`,
      photoW: info.width,
      photoH: info.height,
      photoBg: await cornerColor(image),
    }
  } catch {
    return none
  }
}

export async function POST(request: Request) {
  const body = await request.text()
  if (!signed(body, request.headers.get('x-signature') ?? '')) return new Response('Not found', { status: 404 })

  let raw: {
    format?: unknown; kind?: unknown; name?: unknown; price?: unknown; oldPrice?: unknown; photo?: unknown; cta?: unknown
    count?: unknown; maxPct?: unknown; week?: unknown
  }
  try {
    raw = JSON.parse(body)
  } catch {
    return Response.json({ ok: false, error: 'bad-json' }, { status: 400 })
  }
  // Обложка карусели «Скидки недели»: {"kind": "cover", "count": 7, "maxPct": 25, "week": "04.10 – 10.10"}.
  if (raw.kind === 'cover') {
    const count = typeof raw.count === 'number' && raw.count > 0 ? Math.min(Math.round(raw.count), 99) : 0
    const maxPct = typeof raw.maxPct === 'number' && raw.maxPct > 0 ? Math.min(Math.round(raw.maxPct), 99) : 0
    const week = typeof raw.week === 'string' ? raw.week.slice(0, 40) : ''
    if (!count) return Response.json({ ok: false, error: 'bad-request' }, { status: 400 })
    return jpegOf(<CoverCard data={{ count, maxPct, week }} />, 'post', false)
  }
  const kind = typeof raw.kind === 'string' && KINDS.has(raw.kind as PostKind) ? (raw.kind as PostKind) : null
  const name = typeof raw.name === 'string' ? raw.name.trim().slice(0, 200) : ''
  const price = typeof raw.price === 'number' && Number.isFinite(raw.price) ? Math.round(raw.price) : 0
  const oldPrice = typeof raw.oldPrice === 'number' && Number.isFinite(raw.oldPrice) ? Math.round(raw.oldPrice) : 0
  // Без названия и цены поста нет: цену на картинке не выдумываем.
  if (!kind || !name || price <= 0) return Response.json({ ok: false, error: 'bad-request' }, { status: 400 })

  const format: PostFormat = raw.format === 'story' ? 'story' : 'post'
  const photoUrl = typeof raw.photo === 'string' ? raw.photo : ''
  const photo = await loadPhoto(photoUrl)
  if (photoUrl && !photo.photo) return Response.json({ ok: false, error: 'photo' }, { status: 502 })
  const data: PostData = {
    format,
    cta: format === 'story' && raw.cta === 'reply',
    kind,
    name,
    price,
    oldPrice: oldPrice > price ? oldPrice : 0,
    ...photo,
  }
  return jpegOf(<PostCard data={data} />, format, Boolean(data.photo))
}

async function jpegOf(element: React.ReactElement, format: PostFormat, withPhoto: boolean): Promise<Response> {
  try {
    const png = new ImageResponse(element, { width: FORMATS[format].w, height: FORMATS[format].h, fonts: await postFonts() })
    const jpeg = await sharp(Buffer.from(await png.arrayBuffer())).jpeg({ quality: 90, mozjpeg: true }).toBuffer()
    return new Response(new Uint8Array(jpeg), {
      headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'no-store', 'X-Photo': withPhoto ? '1' : '0' },
    })
  } catch (error) {
    console.error('instagram post-image:', error instanceof Error ? error.message : error)
    return Response.json({ ok: false, error: 'render' }, { status: 500 })
  }
}
