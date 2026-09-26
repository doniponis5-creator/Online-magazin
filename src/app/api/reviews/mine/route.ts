import type { NextRequest } from 'next/server'
import { reviewedOrders } from '@/lib/reviews/store'
import { currentSession } from '../../customer/route-helpers'

/**
 * Какие заказы покупателя уже с отзывом — для кнопок в «Личном кабинете».
 * Номера заказов кабинет уже знает, поэтому к серверу SBonus не ходим.
 */
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  if (!(await currentSession())) return Response.json({ ok: false, error: 'login' }, { status: 401 })
  const ids = (request.nextUrl.searchParams.get('ids') ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter((id) => /^[A-Za-z0-9-]{3,40}$/.test(id))
    .slice(0, 30)
  const reviewed = await reviewedOrders(ids)
  return Response.json({ ok: true, reviewed }, { headers: { 'Cache-Control': 'no-store' } })
}
