import { sendCode } from '@/lib/customer/gateway'
import { normalizePhone } from '@/lib/orders/order'
import { clientIp, errorResponse } from '../route-helpers'

/** Шаг 1 входа: отправить 4-значный код в WhatsApp. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { phone?: string }
  const phone = normalizePhone(body.phone ?? '')
  if (!phone) return Response.json({ ok: false, error: 'phone' }, { status: 422 })
  try {
    await sendCode(phone, clientIp(request))
    return Response.json({ ok: true, phone })
  } catch (error) {
    return errorResponse(error)
  }
}
