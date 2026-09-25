import type { NextRequest } from 'next/server'
import { mockSpend } from '@/lib/customer/gateway'
import { mockPay, paymentMode } from '@/lib/orders/gateway'

/** Только тестовый режим: имитация оплаты, чтобы пройти путь покупателя на localhost. */
export async function POST(request: NextRequest, ctx: RouteContext<'/api/orders/[id]/mock-pay'>) {
  if (paymentMode() !== 'mock') return Response.json({ ok: false }, { status: 404 })
  const { id } = await ctx.params
  const token = request.nextUrl.searchParams.get('token') ?? ''
  const order = mockPay(id, token)
  if (order?.bonus) mockSpend(order.customer.phone, order.bonus)
  return Response.json({ ok: Boolean(order) })
}
