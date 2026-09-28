import { waLoginStart } from '@/lib/customer/gateway'
import { verifyTurnstile } from '@/lib/security/turnstile'
import { clientIp, errorResponse } from '../../route-helpers'

/**
 * Вход через WhatsApp: сервер даёт код и номер магазина, сайт открывает
 * wa.me с готовым текстом. Магазин ничего не отправляет — блокировать нечего.
 * «Я не робот» всё равно спрашиваем: иначе бот наплодит кодов на сервере.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { turnstile?: unknown } | null
  const ip = clientIp(request)
  if ((await verifyTurnstile(body?.turnstile, ip)) === 'fail') {
    return Response.json({ ok: false, error: 'captcha' }, { status: 403 })
  }
  try {
    const result = await waLoginStart(ip)
    return Response.json({ ok: true, ...result })
  } catch (error) {
    return errorResponse(error)
  }
}
