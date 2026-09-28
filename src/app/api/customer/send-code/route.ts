import { sendCode } from '@/lib/customer/gateway'
import { normalizePhone } from '@/lib/orders/order'
import { verifyTurnstile } from '@/lib/security/turnstile'
import { clientIp, errorResponse } from '../route-helpers'

/** Отправить 4-значный код: сервер пробует Telegram, потом WhatsApp. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { phone?: string; turnstile?: unknown }
  const phone = normalizePhone(body.phone ?? '')
  if (!phone) return Response.json({ ok: false, error: 'phone' }, { status: 422 })
  const ip = clientIp(request)
  // Каждый код — платное сообщение: боту без «я не робот» не отправляем
  if ((await verifyTurnstile(body.turnstile, ip)) === 'fail') {
    return Response.json({ ok: false, error: 'captcha' }, { status: 403 })
  }
  try {
    const channel = await sendCode(phone, ip)
    return Response.json({ ok: true, phone, channel })
  } catch (error) {
    return errorResponse(error)
  }
}
