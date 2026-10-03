import { createHmac, timingSafeEqual } from 'node:crypto'
import { geminiConfigured, readMedia, type MediaKind } from '@/lib/assistant/gemini'
import { mediaMime } from '@/lib/assistant/media-mime'

/**
 * Голосовое или фото из WhatsApp → текст.
 *
 * Сервер SBonus присылает ссылку на файл (её даёт Green API) — сайт сам
 * скачивает файл и отдаёт модели. Ответ — расшифровка голосового или
 * описание фото; сервер кладёт его в разговор как обычную реплику покупателя.
 *
 * Подпись — та же, что у /api/channel/whatsapp. Без неё 404.
 */
export const dynamic = 'force-dynamic'

/** Больше не качаем: минутное голосовое — сотни килобайт, фото — до пары мегабайт. */
const MAX_BYTES = 12 * 1024 * 1024

export async function POST(request: Request) {
  const secret = process.env.SHOP_API_SECRET ?? ''
  const body = await request.text()
  const signature = request.headers.get('x-signature') ?? ''
  const expected = createHmac('sha256', secret).update(body, 'utf8').digest('hex')
  if (
    !secret ||
    signature.length !== expected.length ||
    !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  ) {
    return new Response('Not found', { status: 404 })
  }

  let raw: { url?: unknown; mime?: unknown; kind?: unknown; data?: unknown }
  try {
    raw = JSON.parse(body)
  } catch {
    return Response.json({ ok: false, error: 'bad-json' }, { status: 400 })
  }
  const url = typeof raw.url === 'string' && /^https:\/\//.test(raw.url) ? raw.url : ''
  const kind: MediaKind | null = raw.kind === 'audio' || raw.kind === 'image' ? raw.kind : null
  // Маленькая картинка из цитаты (ответ на статус) приходит сразу байтами, без ссылки.
  const inline = typeof raw.data === 'string' && /^[A-Za-z0-9+/=]+$/.test(raw.data) && raw.data.length <= 400_000 ? raw.data : ''
  if ((!url && !inline) || !kind) return Response.json({ ok: false, error: 'bad-request' }, { status: 400 })
  if (!geminiConfigured()) return Response.json({ ok: false, error: 'no-model' }, { status: 503 })

  if (inline) {
    try {
      const text = await readMedia(kind, 'image/jpeg', inline)
      return Response.json({ ok: true, text })
    } catch (error) {
      console.error('[whatsapp] картинка из цитаты:', error instanceof Error ? error.message : error)
      return Response.json({ ok: false, error: 'failed' }, { status: 502 })
    }
  }

  // Хост — для журнала: в самой ссылке подпись, её не пишем.
  const host = (() => {
    try {
      return new URL(url).host
    } catch {
      return '?'
    }
  })()
  try {
    // Instagram отдаёт файл с lookaside.fbsbx.com — без обычного User-Agent CDN может отказать.
    const file = await fetch(url, { signal: AbortSignal.timeout(20_000), headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SmartCentrBot/1.0)' } })
    if (!file.ok) {
      // Раньше молча: «голосовое не получилось разобрать» в Instagram, а в журнале пусто (03.10).
      console.error(`[channel] ${kind}: не скачалось ${host} — HTTP ${file.status}`)
      return Response.json({ ok: false, error: `download-${file.status}` }, { status: 502 })
    }
    const bytes = Buffer.from(await file.arrayBuffer())
    if (bytes.length === 0 || bytes.length > MAX_BYTES) {
      console.error(`[channel] ${kind}: размер ${bytes.length} байт с ${host}`)
      return Response.json({ ok: false, error: 'bad-size' }, { status: 413 })
    }
    const given =
      (typeof raw.mime === 'string' && raw.mime.split(';')[0].trim()) ||
      file.headers.get('content-type')?.split(';')[0].trim() ||
      ''
    const mime = mediaMime(kind, given, bytes)
    const text = await readMedia(kind, mime, bytes.toString('base64'))
    if (!text.trim()) console.error(`[channel] ${kind}: модель вернула пустой текст (${mime}, ${bytes.length} байт, ${host})`)
    return Response.json({ ok: true, text })
  } catch (error) {
    console.error('[whatsapp] голосовое/фото:', error instanceof Error ? error.message : error)
    return Response.json({ ok: false, error: 'failed' }, { status: 502 })
  }
}

