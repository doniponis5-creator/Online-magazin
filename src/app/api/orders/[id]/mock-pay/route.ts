import type { NextRequest } from 'next/server'
import { mockPay, paymentMode } from '@/lib/orders/gateway'

/** Только тестовый режим: имитация оплаты, чтобы пройти путь покупателя на localhost. */
export async function POST(request: NextRequest, ctx: RouteContext<'/api/orders/[id]/mock-pay'>) {
  if (paymentMode() !== 'mock') return Response.json({ ok: false }, { status: 404 })
  const { id } = await ctx.params
  const token = request.nextUrl.searchParams.get('token') ?? ''
  return Response.json({ ok: mockPay(id, token) })
}
