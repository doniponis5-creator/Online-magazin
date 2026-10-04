import { createHmac, timingSafeEqual } from 'node:crypto'
import { readTurns } from '@/lib/assistant/respond'
import { hotLines, rateHot } from '@/lib/assistant/hot'
import { jevConfigured } from '@/lib/assistant/jev'
import { lookupIn, salesCatalogNow } from '@/lib/assistant/live'
import { spokenName } from '@/lib/assistant/followup'

/**
 * «Кому позвонить сегодня» — для утренней сводки сервера SBonus (shop_wa_bot.send_digest).
 * Подпись — та же, что у /api/assistant/digest.
 *
 * Тело: {"chats": [{"who": "+996…" | "Instagram @ник", "messages": [{role, text}], "shown": ["cb-…"]}]}
 * Ответ: {"ok": true, "lines": ["🔥 …", "• …"]} — пустой список, если звонить некому.
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
  if (!jevConfigured()) return Response.json({ ok: true, lines: [], skip: 'no-jev' })

  let raw: { chats?: unknown }
  try {
    raw = JSON.parse(body)
  } catch {
    return Response.json({ ok: false, error: 'bad-json' }, { status: 400 })
  }
  const find = lookupIn(await salesCatalogNow())
  const chats = (Array.isArray(raw.chats) ? raw.chats : [])
    .slice(0, 300)
    .map((c) => {
      const chat = c as { who?: unknown; messages?: unknown; shown?: unknown }
      const shown = Array.isArray(chat.shown) ? chat.shown.filter((x): x is string => typeof x === 'string') : []
      const product = shown.map(find).find(Boolean)
      return {
        who: typeof chat.who === 'string' ? chat.who.slice(0, 60) : '',
        turns: readTurns(chat.messages),
        product: product ? spokenName(product.nameRu) : '',
      }
    })
    .filter((c) => c.who && c.turns.length > 0)
  const rated = await rateHot(chats)
  return Response.json({ ok: true, count: rated.length, lines: hotLines(rated) })
}
