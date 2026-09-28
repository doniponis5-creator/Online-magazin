import type { NextRequest } from 'next/server'
import { cancelOrder } from '@/lib/orders/gateway'

/**
 * Покупатель отменяет свой неоплаченный заказ со страницы заказа.
 * Право — тот же токен из ссылки, что открывает страницу и кнопку «Оплатить»:
 * у заказов без входа другого признака владельца нет.
 * 409 — заказ уже оплачен или в работе: отменить его можно только через магазин.
 */
export async function POST(request: NextRequest, ctx: RouteContext<'/api/orders/[id]/cancel'>) {
  const { id } = await ctx.params
  const body = await request.json().catch(() => null)
  const token = typeof body?.token === 'string' ? body.token : ''
  if (!token) return Response.json({ ok: false, error: 'failed' }, { status: 400 })
  const result = await cancelOrder(id, token)
  if (result.ok) return Response.json({ ok: true, order: result.order }, { headers: { 'Cache-Control': 'no-store' } })
  return Response.json({ ok: false, error: result.reason }, { status: result.reason === 'paid' ? 409 : 502 })
}
