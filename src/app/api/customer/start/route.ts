import { startLogin } from '@/lib/customer/gateway'
import { normalizePhone } from '@/lib/orders/order'
import { clientIp, errorResponse } from '../route-helpers'

/**
 * Шаг 1 входа: задан ли у номера пароль.
 * Есть пароль — сайт спросит его, код в WhatsApp не отправляется.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { phone?: string }
  const phone = normalizePhone(body.phone ?? '')
  if (!phone) return Response.json({ ok: false, error: 'phone' }, { status: 422 })
  try {
    const { hasPassword } = await startLogin(phone, clientIp(request))
    return Response.json({ ok: true, phone, hasPassword })
  } catch (error) {
    return errorResponse(error)
  }
}
