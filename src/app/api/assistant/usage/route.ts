import { createHmac, timingSafeEqual } from 'node:crypto'
import { bishkekToday, costOf, spendLimit, usageLine, usageOf } from '@/lib/assistant/usage'

/**
 * Расход Gemini за сегодня — для сервера SBonus: он спрашивает раз в 15 минут и, если
 * перевалило за ASSISTANT_DAILY_USD (по умолчанию $3), один раз за день пишет владельцу
 * в WhatsApp. Подпись — та же, что у /api/assistant/digest. Тело — пустое или {}.
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

  const day = bishkekToday()
  const usd = costOf(usageOf(day), day)
  const limit = spendLimit()
  return Response.json({ ok: true, day, usd: Math.round(usd * 100) / 100, limit, over: usd > limit, line: usageLine(day) })
}
