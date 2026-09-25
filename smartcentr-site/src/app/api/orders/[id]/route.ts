import type { NextRequest } from 'next/server'
import { getOrder } from '@/lib/orders/gateway'

/** Статус заказа для страницы заказа. Без токена из ссылки заказ не показывается. */
export async function GET(request: NextRequest, ctx: RouteContext<'/api/orders/[id]'>) {
  const { id } = await ctx.params
  const token = request.nextUrl.searchParams.get('token') ?? ''
  const order = token ? await getOrder(id, token) : null
  if (!order) return Response.json({ ok: false }, { status: 404 })
  return Response.json({ ok: true, order }, { headers: { 'Cache-Control': 'no-store' } })
}
