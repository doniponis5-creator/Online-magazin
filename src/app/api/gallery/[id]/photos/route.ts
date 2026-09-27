import { MAX_PHOTO_BYTES, MAX_REAL_PHOTOS, MAX_THUMB_BYTES } from '@/lib/gallery/rules'
import { addRealPhotos, getKitchen, type NewPhoto } from '@/lib/gallery/store'
import { KITCHEN_ID, done, fail, imageFrom, viewer } from '../../helpers'

/**
 * «Я сделал такую»: POST multipart photos[] (+ thumbs[] в том же порядке) →
 * { ok, realPhotos: string[] }. Только автор, всего до 5 фото (больше — too-many),
 * как фото отзывов; кончилось место под картинки — no-space (507).
 */
export const dynamic = 'force-dynamic'

export async function POST(request: Request, ctx: RouteContext<'/api/gallery/[id]/photos'>) {
  const session = await viewer()
  if (!session) return fail('login')
  const { id } = await ctx.params
  if (!KITCHEN_ID.test(id)) return fail('not-found')
  const form = await request.formData().catch(() => null)
  if (!form) return fail('bad-input')

  const files = form.getAll('photos').filter((item): item is File => item instanceof File && item.size > 0)
  if (files.length === 0) return fail('bad-input')
  if (files.length > MAX_REAL_PHOTOS) return fail('too-many', 'photos')
  const thumbs = form.getAll('thumbs')
  const photos: NewPhoto[] = []
  for (const [i, file] of files.entries()) {
    const photo = await imageFrom(file, MAX_PHOTO_BYTES)
    if (!photo) return fail('bad-input')
    // Нет маленькой копии или она другого формата — карточка покажет большое фото.
    const small = thumbs.length === files.length ? await imageFrom(thumbs[i], MAX_THUMB_BYTES) : null
    photos.push({ ...photo, thumb: small?.ext === photo.ext ? small.bytes : undefined })
  }

  try {
    const out = await addRealPhotos(id, session.phone, photos)
    if (out === 'too-many') return fail(out, 'photos')
    if (typeof out === 'string') return fail(out)
  } catch (error) {
    console.error('[gallery] не удалось сохранить фото:', error)
    return fail('save')
  }
  return done({ realPhotos: (await getKitchen(id))?.realPhotos ?? [] })
}
