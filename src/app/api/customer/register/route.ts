import { register } from '@/lib/customer/gateway'
import { errorResponse, startSession } from '../route-helpers'

/** Шаг 3 входа (только новый номер): имя → клиент в SBonus + приветственный бонус. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { ticket?: string; name?: string }
  const name = String(body.name ?? '').replace(/\s+/g, ' ').trim()
  if (name.length < 2 || name.length > 100) return Response.json({ ok: false, error: 'name' }, { status: 422 })
  if (!body.ticket) return Response.json({ ok: false, error: 'ticket' }, { status: 422 })
  try {
    const result = await register(body.ticket, name)
    await startSession(result.customer.phone, result.customer.name)
    return Response.json({ ok: true, customer: result.customer, welcomeBonus: result.welcomeBonus })
  } catch (error) {
    return errorResponse(error)
  }
}
