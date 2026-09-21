import { createHmac, timingSafeEqual } from 'node:crypto'
import { readRows } from '@/lib/assistant/log'
import { dailyDigest, rowsForDay, yesterday } from '@/lib/assistant/digest'

/**
 * Сводка консультанта за день — для сервера SBonus, который шлёт её владельцу
 * в WhatsApp каждое утро. Подпись — та же, что у /api/channel/whatsapp.
 *
 * Тело: {"day": "ГГГГ-ММ-ДД"} — или пустое, тогда вчера по Бишкеку.
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

  let day = yesterday()
  try {
    const raw = body ? (JSON.parse(body) as { day?: unknown }) : {}
    if (typeof raw.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.day)) day = raw.day
  } catch {
    return Response.json({ ok: false, error: 'bad-json' }, { status: 400 })
  }

  const rows = rowsForDay(await readRows(2), day)
  return Response.json({ ok: true, day, count: rows.length, text: dailyDigest(rows, day) })
}
