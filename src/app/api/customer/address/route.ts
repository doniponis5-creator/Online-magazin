import { getAddress, removeAddress, setAddress } from '@/lib/customer/addresses'
import { currentSession } from '../route-helpers'

/**
 * Постоянный адрес доставки вошедшего покупателя: кабинет и оформление заказа.
 * GET — прочитать (address: null — ещё не указан), PUT — сохранить, DELETE — стереть.
 * Без входа — 401: у гостя адрес помнит только его браузер (LOCAL_ADDRESS_KEY).
 */

const noStore = { 'Cache-Control': 'no-store' }

export async function GET() {
  const session = await currentSession()
  if (!session) return Response.json({ ok: false, error: 'login' }, { status: 401, headers: noStore })
  return Response.json({ ok: true, address: await getAddress(session.phone) }, { headers: noStore })
}

export async function PUT(request: Request) {
  const session = await currentSession()
  if (!session) return Response.json({ ok: false, error: 'login' }, { status: 401 })
  const body = await request.json().catch(() => null)
  try {
    const address = await setAddress(session.phone, body)
    if (!address) return Response.json({ ok: false, error: 'address' }, { status: 400 })
    return Response.json({ ok: true, address })
  } catch (error) {
    console.error('[address] не сохранился', error)
    return Response.json({ ok: false, error: 'server' }, { status: 500 })
  }
}

export async function DELETE() {
  const session = await currentSession()
  if (!session) return Response.json({ ok: false, error: 'login' }, { status: 401 })
  try {
    await removeAddress(session.phone)
    return Response.json({ ok: true })
  } catch (error) {
    console.error('[address] не стёрся', error)
    return Response.json({ ok: false, error: 'server' }, { status: 500 })
  }
}
