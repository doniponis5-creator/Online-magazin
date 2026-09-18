import { loginWithPassword } from '@/lib/customer/gateway'
import { normalizePhone } from '@/lib/orders/order'
import { clientIp, errorResponse, startSession } from '../route-helpers'

/** Вход по телефону и паролю — без кода в WhatsApp. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { phone?: string; password?: string }
  const phone = normalizePhone(body.phone ?? '')
  const password = String(body.password ?? '')
  if (!phone) return Response.json({ ok: false, error: 'phone' }, { status: 422 })
  if (!password) return Response.json({ ok: false, error: 'password' }, { status: 422 })
  try {
    const customer = await loginWithPassword(phone, password, clientIp(request))
    await startSession(customer.phone, customer.name)
    return Response.json({ ok: true, customer })
  } catch (error) {
    return errorResponse(error)
  }
}
