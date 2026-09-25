import { waLoginStart } from '@/lib/customer/gateway'
import { clientIp, errorResponse } from '../../route-helpers'

/**
 * Вход через WhatsApp: сервер даёт код и номер магазина, сайт открывает
 * wa.me с готовым текстом. Магазин ничего не отправляет — блокировать нечего.
 */
export async function POST(request: Request) {
  try {
    const result = await waLoginStart(clientIp(request))
    return Response.json({ ok: true, ...result })
  } catch (error) {
    return errorResponse(error)
  }
}
