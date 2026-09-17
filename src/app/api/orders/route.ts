import { getProduct } from '@/data/products'
import { createOrder } from '@/lib/orders/gateway'
import { validateOrder, type OrderRequest } from '@/lib/orders/order'

/** Создать заказ: проверка корзины по каталогу → сервер заказов → ссылка на оплату O!Деньги. */
export async function POST(request: Request) {
  let body: OrderRequest
  try {
    body = (await request.json()) as OrderRequest
  } catch {
    return Response.json({ ok: false, errors: ['bad-request'] }, { status: 400 })
  }

  const result = validateOrder(body, getProduct)
  if (!result.ok) {
    return Response.json({ ok: false, errors: result.errors, details: result.details }, { status: 422 })
  }

  try {
    const created = await createOrder(result.order)
    return Response.json({ ok: true, ...created, total: result.order.total })
  } catch (error) {
    console.error('[orders] не удалось создать заказ:', error)
    return Response.json({ ok: false, errors: ['server-unavailable'] }, { status: 502 })
  }
}
