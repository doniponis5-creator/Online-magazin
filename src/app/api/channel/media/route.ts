import { createHmac, timingSafeEqual } from 'node:crypto'
import { geminiConfigured, readMedia, type MediaKind } from '@/lib/assistant/gemini'

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

  let raw: { url?: unknown; mime?: unknown; kind?: unknown }
  try {
    raw = JSON.parse(body)
  } catch {
    return Response.json({ ok: false, error: 'bad-json' }, { status: 400 })
  }
  const url = typeof raw.url === 'string' && /^https:\/\//.test(raw.url) ? raw.url : ''
  const kind: MediaKind | null = raw.kind === 'audio' || raw.kind === 'image' ? raw.kind : null
  if (!url || !kind) return Response.json({ ok: false, error: 'bad-request' }, { status: 400 })
  if (!geminiConfigured()) return Response.json({ ok: false, error: 'no-model' }, { status: 503 })

  try {
    const file = await fetch(url, { signal: AbortSignal.timeout(20_000) })
    if (!file.ok) return Response.json({ ok: false, error: `download-${file.status}` }, { status: 502 })
    const bytes = Buffer.from(await file.arrayBuffer())
    if (bytes.length === 0 || bytes.length > MAX_BYTES) {
      return Response.json({ ok: false, error: 'bad-size' }, { status: 413 })
    }
    const mime =
      (typeof raw.mime === 'string' && raw.mime.split(';')[0].trim()) ||
      file.headers.get('content-type')?.split(';')[0].trim() ||
      (kind === 'audio' ? 'audio/ogg' : 'image/jpeg')
    const text = await readMedia(kind, mime, bytes.toString('base64'))
    return Response.json({ ok: true, text })
  } catch (error) {
    console.error('[whatsapp] голосовое/фото:', error instanceof Error ? error.message : error)
    return Response.json({ ok: false, error: 'failed' }, { status: 502 })
  }
}
