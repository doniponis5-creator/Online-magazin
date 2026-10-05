import { createHmac, timingSafeEqual } from 'node:crypto'
import { choicesOfPost, planComment, productOfPost, scoreComment } from '@/lib/assistant/comments'
import { salesCatalogNow } from '@/lib/assistant/live'

/**
 * Комментарий под постом Instagram → что сделать (shop_ig_bot.py это выполняет).
 * Подпись — та же, что у /api/channel/instagram.
 *
 * Тело: {"id": "<id комментария>", "text": "…", "caption": "подпись поста"}
 * Ответ: {"ok": true, "action": "answer" | "alert" | "hide" | "skip", "public": "…", "private": "…", "productId": "cb-…" | null}
 */
export const dynamic = 'force-dynamic'

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

  let raw: { id?: unknown; text?: unknown; caption?: unknown }
  try {
    raw = JSON.parse(body)
  } catch {
    return Response.json({ ok: false, error: 'bad-json' }, { status: 400 })
  }
  const id = typeof raw.id === 'string' && /^\d{5,30}$/.test(raw.id) ? raw.id : ''
  const text = typeof raw.text === 'string' ? raw.text.trim().slice(0, 500) : ''
  if (!id || !text) return Response.json({ ok: false, error: 'bad-request' }, { status: 400 })
  const caption = typeof raw.caption === 'string' ? raw.caption.slice(0, 1000) : ''

  const [scores, list] = await Promise.all([scoreComment(text, caption), salesCatalogNow()])
  const product = productOfPost(caption, list)
  const plan = planComment(text, scores, product, product ? [] : choicesOfPost(caption, list))
  // Жалобу владельцу шлёт сервер — и только после того, как ответ в Direct правда ушёл (ревью 04.10):
  // иначе «ему ответили в Direct» приходило и тогда, когда ответа не было.
  return Response.json({ ok: true, ...plan })
}
