import type { NextRequest } from 'next/server'
import { getProfile } from '@/lib/customer/gateway'
import { currentSession, endSession, errorResponse } from '../route-helpers'

/** Профиль вошедшего покупателя: баланс, максимум списания для ?amount=, история (?full=1). */
export async function GET(request: NextRequest) {
  const session = await currentSession()
  if (!session) return Response.json({ ok: false, error: 'login' }, { status: 401 })
  const amount = Number(request.nextUrl.searchParams.get('amount') ?? 0)
  const full = request.nextUrl.searchParams.get('full') === '1'
  try {
    const customer = await getProfile(session.phone, Number.isFinite(amount) ? amount : 0, full)
    if (!customer) {
      await endSession()
      return Response.json({ ok: false, error: 'login' }, { status: 401 })
    }
    return Response.json({ ok: true, customer })
  } catch (error) {
    return errorResponse(error)
  }
}

/** Выход. */
export async function DELETE() {
  await endSession()
  return Response.json({ ok: true })
}
