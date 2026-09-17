import { getProduct } from '@/data/products'
import { getProfile } from '@/lib/customer/gateway'
import { createOrder } from '@/lib/orders/gateway'
import { applyBonus, validateOrder, type OrderRequest } from '@/lib/orders/order'
import { currentSession, errorResponse } from '../customer/route-helpers'

/**
 * Создать заказ: вход покупателя → проверка корзины по каталогу → бонусы SBonus
 * → сервер заказов → ссылка на оплату O!Деньги.
 * Телефон берётся из подписанной сессии, а не из формы: бонусы списываются только со своего счёта.
 */
export async function POST(request: Request) {
  let body: OrderRequest
  try {
    body = (await request.json()) as OrderRequest
  } catch {
    return Response.json({ ok: false, errors: ['bad-request'] }, { status: 400 })
  }

  const session = await currentSession()
  if (!session) return Response.json({ ok: false, errors: ['login'] }, { status: 401 })

  const result = validateOrder({ ...body, customer: { name: body.customer?.name ?? session.name, phone: session.phone } }, getProduct)
  if (!result.ok) {
    return Response.json({ ok: false, errors: result.errors, details: result.details }, { status: 422 })
  }

  let order = result.order
  if (Number(body.bonus) > 0) {
    try {
      const profile = await getProfile(session.phone, order.total)
      const withBonus = applyBonus(order, body.bonus, profile?.maxSpend ?? 0)
      if (!withBonus) {
        return Response.json({ ok: false, errors: ['bonus'], maxSpend: profile?.maxSpend ?? 0 }, { status: 422 })
      }
      order = withBonus
    } catch (error) {
      return errorResponse(error)
    }
  }

  try {
    const created = await createOrder(order)
    return Response.json({ ok: true, ...created, total: order.total, payAmount: order.total - order.bonus })
  } catch (error) {
    console.error('[orders] не удалось создать заказ:', error)
    return Response.json({ ok: false, errors: ['server-unavailable'] }, { status: 502 })
  }
}
