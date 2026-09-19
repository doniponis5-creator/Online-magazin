import type { NextRequest } from 'next/server'
import { getProfile, getSiteSettings } from '@/lib/customer/gateway'
import { currentSession, endSession, errorResponse, startSession } from '../route-helpers'

/** Профиль вошедшего покупателя: баланс, максимум списания для ?amount=, история (?full=1). */
export async function GET(request: NextRequest) {
  // guestCheckout нужен и невошедшему: иначе страница оформления не знает,
  // можно ли вообще заказывать без входа, и на всякий случай запрещает.
  const guestCheckout = (await getSiteSettings()).guestCheckout
  const session = await currentSession()
  if (!session) return Response.json({ ok: false, error: 'login', guestCheckout }, { status: 401 })
  const amount = Number(request.nextUrl.searchParams.get('amount') ?? 0)
  const full = request.nextUrl.searchParams.get('full') === '1'
  try {
    const customer = await getProfile(session.phone, Number.isFinite(amount) ? amount : 0, full)
    if (!customer) {
      await endSession()
      return Response.json({ ok: false, error: 'login', guestCheckout }, { status: 401 })
    }
    // Продлеваем вход: пока покупатель заходит, код у него больше не спрашивают
    await startSession(customer.phone, customer.name)
    return Response.json({ ok: true, customer, guestCheckout })
  } catch (error) {
    return errorResponse(error)
  }
}

/** Выход. */
export async function DELETE() {
  await endSession()
  return Response.json({ ok: true })
}
