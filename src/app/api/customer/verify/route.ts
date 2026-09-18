import { verifyCode } from '@/lib/customer/gateway'
import { normalizePhone } from '@/lib/orders/order'
import { clientIp, errorResponse, startSession } from '../route-helpers'

/** Шаг 2 входа: проверить код. Известный клиент — сразу вход; новый — нужно имя (ticket). */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { phone?: string; code?: string }
  const phone = normalizePhone(body.phone ?? '')
  const code = String(body.code ?? '').trim()
  if (!phone) return Response.json({ ok: false, error: 'phone' }, { status: 422 })
  if (!/^\d{4}$/.test(code)) return Response.json({ ok: false, error: 'code' }, { status: 422 })
  try {
    const result = await verifyCode(phone, code, clientIp(request))
    if (result.needName) {
      return Response.json({ ok: true, needName: true, ticket: result.ticket, welcomeBonus: result.welcomeBonus })
    }
    await startSession(result.customer.phone, result.customer.name)
    // pwTicket — чтобы сразу предложить задать пароль и в следующий раз обойтись без кода
    return Response.json({ ok: true, needName: false, customer: result.customer, pwTicket: result.pwTicket })
  } catch (error) {
    return errorResponse(error)
  }
}
