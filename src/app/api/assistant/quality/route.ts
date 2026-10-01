import { createHmac, timingSafeEqual } from 'node:crypto'
import { readTurns } from '@/lib/assistant/respond'
import { qualityText, rateChats } from '@/lib/assistant/quality'
import { jevConfigured } from '@/lib/assistant/jev'

/**
 * Недельная оценка разговоров WhatsApp — для сервера SBonus, который шлёт её владельцу
 * по понедельникам. Подпись — та же, что у /api/assistant/digest.
 *
 * Тело: {"from": "01.10", "to": "07.10", "chats": [{"phone": "996…", "messages": [{role, text}]}]}
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 120

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
  if (!jevConfigured()) return Response.json({ ok: true, skip: 'no-jev' })

  let raw: { from?: unknown; to?: unknown; chats?: unknown }
  try {
    raw = JSON.parse(body)
  } catch {
    return Response.json({ ok: false, error: 'bad-json' }, { status: 400 })
  }
  const chats = (Array.isArray(raw.chats) ? raw.chats : [])
    .slice(0, 400)
    .map((c) => {
      const chat = c as { phone?: unknown; messages?: unknown }
      return { phone: typeof chat.phone === 'string' ? chat.phone.replace(/\D/g, '') : '', turns: readTurns(chat.messages) }
    })
    .filter((c) => c.phone && c.turns.length > 0)
  const rated = await rateChats(chats)
  if (rated.length === 0) return Response.json({ ok: true, skip: 'empty' })
  const from = typeof raw.from === 'string' ? raw.from : ''
  const to = typeof raw.to === 'string' ? raw.to : ''
  return Response.json({ ok: true, count: rated.length, text: qualityText(rated, from, to) })
}
