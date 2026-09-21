import { waLoginCheck } from '@/lib/customer/gateway'
import { errorResponse, startSession } from '../../route-helpers'

/** «Сообщение пришло?» — сайт спрашивает раз в несколько секунд, пока ждёт. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { code?: string }
  const code = String(body.code ?? '').trim()
  if (!/^\d{6}$/.test(code)) return Response.json({ ok: false, error: 'code' }, { status: 422 })
  try {
    const result = await waLoginCheck(code)
    if ('pending' in result) return Response.json({ ok: true, pending: true })
    if (result.needName) {
      return Response.json({ ok: true, needName: true, ticket: result.ticket, welcomeBonus: result.welcomeBonus })
    }
    await startSession(result.customer.phone, result.customer.name)
    return Response.json({ ok: true, needName: false, customer: result.customer })
  } catch (error) {
    return errorResponse(error)
  }
}
