import { hideDigits } from '@/lib/assistant/log'
import { getProfile } from '@/lib/customer/gateway'
import { getOrder } from '@/lib/orders/gateway'
import { MAX_PHOTO_BYTES, MAX_THUMB_BYTES, checkReview, displayName, imageType, isBought } from '@/lib/reviews/rules'
import { addReview, publishedReviews, toPublic, type NewPhoto } from '@/lib/reviews/store'
import { currentSession, errorResponse } from '../customer/route-helpers'

/**
 * Отзывы покупателей.
 *
 * GET  — 20 последних отзывов для главной.
 * POST — новый отзыв из «Личного кабинета» (форма с фото).
 *
 * Кто может написать: вошедший покупатель, у которого этот заказ есть в
 * SBonus и оплачен. Телефон берётся из подписанной cookie, а не из формы —
 * подставить чужой заказ нельзя.
 */
export const dynamic = 'force-dynamic'

export async function GET() {
  const reviews = await publishedReviews()
  return Response.json({ ok: true, reviews }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: Request) {
  const session = await currentSession()
  if (!session) return Response.json({ ok: false, error: 'login' }, { status: 401 })

  const form = await request.formData().catch(() => null)
  if (!form) return Response.json({ ok: false, error: 'form' }, { status: 400 })

  const files = form.getAll('photos').filter((item): item is File => item instanceof File && item.size > 0)
  const check = checkReview({ orderId: form.get('orderId'), rating: form.get('rating'), text: form.get('text') }, files.length)
  if (!check.ok) return Response.json({ ok: false, error: check.error }, { status: 400 })

  // Маленькие копии для карточек идут в том же порядке, что и фото. Нет копии
  // или она не того формата — карточка покажет большое фото, отзыв не теряем.
  const thumbs = form.getAll('thumbs').filter((item): item is File => item instanceof File && item.size > 0)
  const photos: NewPhoto[] = []
  for (const [i, file] of files.entries()) {
    if (file.size > MAX_PHOTO_BYTES) return Response.json({ ok: false, error: 'photo-size' }, { status: 400 })
    const bytes = new Uint8Array(await file.arrayBuffer())
    const ext = imageType(bytes)
    if (!ext) return Response.json({ ok: false, error: 'photo-type' }, { status: 400 })
    let thumb: Uint8Array | undefined
    const small = thumbs.length === files.length ? thumbs[i] : undefined
    if (small && small.size <= MAX_THUMB_BYTES) {
      const smallBytes = new Uint8Array(await small.arrayBuffer())
      if (imageType(smallBytes) === ext) thumb = smallBytes
    }
    photos.push({ bytes, ext, thumb })
  }

  // Купил ли на сайте: заказ этого телефона, и деньги за него пришли.
  let profile
  try {
    profile = await getProfile(session.phone, 0, true)
  } catch (error) {
    return errorResponse(error)
  }
  if (!profile) return Response.json({ ok: false, error: 'login' }, { status: 401 })
  const order = profile.orders?.find((o) => o.orderId === check.value.orderId)
  if (!order || !isBought(order.status)) return Response.json({ ok: false, error: 'not-bought' }, { status: 403 })

  // Что купил — для подписи «Купил: …». Не ответил сервер — отзыв всё равно сохраняем.
  const details = await getOrder(order.orderId, order.token)
  const products = (details?.lines ?? []).map((line) => line.name).filter(Boolean).slice(0, 3)

  try {
    const saved = await addReview(
      {
        orderId: order.orderId,
        name: displayName(profile.name) || displayName(session.name),
        rating: check.value.rating,
        // Свой телефон покупатель мог написать прямо в тексте — прячем цифры.
        text: hideDigits(check.value.text),
        products,
      },
      photos,
    )
    if (saved === 'duplicate') return Response.json({ ok: false, error: 'already' }, { status: 409 })
    return Response.json({ ok: true, review: toPublic(saved) })
  } catch (error) {
    console.error('[reviews] не удалось сохранить отзыв:', error)
    return Response.json({ ok: false, error: 'save' }, { status: 500 })
  }
}
