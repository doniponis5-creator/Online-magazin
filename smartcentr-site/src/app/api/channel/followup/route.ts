import { createHmac, timingSafeEqual } from 'node:crypto'
import { defaultLang } from '@/lib/i18n/config'
import { readTurns } from '@/lib/assistant/respond'
import { followUp } from '@/lib/assistant/followup'

/**
 * Текст напоминания «ещё актуально?» для WhatsApp. Сервер SBonus решает,
 * кому и когда, и присылает разговор; сайт отвечает текстом или «не надо».
 * Подпись — та же, что у /api/channel/whatsapp.
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

  let raw: { name?: unknown; messages?: unknown; shown?: unknown }
  try {
    raw = JSON.parse(body)
  } catch {
    return Response.json({ ok: false, error: 'bad-json' }, { status: 400 })
  }
  const turns = readTurns(raw.messages)
  const shown = Array.isArray(raw.shown) ? raw.shown.filter((x): x is string => typeof x === 'string').slice(0, 3) : []
  const name = typeof raw.name === 'string' ? raw.name : undefined
  const result = await followUp(turns, shown, defaultLang, name)
  return Response.json('text' in result ? { ok: true, text: result.text } : { ok: true, skip: result.skip })
}
