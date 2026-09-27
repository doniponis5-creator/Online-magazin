import { tooOften } from '@/lib/assistant/limits'
import { MAX_IMAGE_BYTES, MAX_PREVIEW_BYTES, ROLES, SHAPES, type Role } from '@/lib/gallery/rules'
import { listKitchens, publishKitchen } from '@/lib/gallery/store'
import type { Shape } from '@/lib/kitchen/types'
import { DAY_MS, done, fail, imageFrom, ipOf, viewer } from './helpers'

/**
 * Галерея кухонь.
 *
 * GET  ?sort=new|top &shape= &author=<authorId> &real=1 &mine=1 &page=
 *      → { ok, items: GalleryCard[], total, page, pages }. Смотреть может любой; mine=1 — вошедшему.
 * POST multipart: q, title?, role (buyer|master), image (кадр 3D ≤ 400 КБ), thumb (превью ≤ 80 КБ)
 *      → { ok, id }. Только вошедшему, не больше 5 в сутки с телефона.
 */
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const shape = SHAPES.find((s) => s === params.get('shape')) as Shape | undefined
  const author = params.get('author') ?? ''
  let phone: string | undefined
  if (params.get('mine') === '1') {
    const session = await viewer()
    if (!session) return fail('login')
    phone = session.phone
  }
  const result = await listKitchens({
    sort: params.get('sort') === 'top' ? 'top' : 'new',
    shape,
    authorId: /^[a-f0-9]{12}$/.test(author) ? author : undefined,
    phone,
    real: params.get('real') === '1',
    page: Number(params.get('page')) || 1,
  })
  return done(result)
}

export async function POST(request: Request) {
  const session = await viewer()
  if (!session) return fail('login')

  const form = await request.formData().catch(() => null)
  if (!form) return fail('bad-input')
  const role = ROLES.find((r) => r === form.get('role')) as Role | undefined
  const image = await imageFrom(form.get('image'), MAX_IMAGE_BYTES)
  const thumbItem = form.get('thumb')
  const thumb = thumbItem ? await imageFrom(thumbItem, MAX_PREVIEW_BYTES) : undefined
  const q = form.get('q')
  const title = form.get('title')
  if (!role || !image || thumb === null || typeof q !== 'string' || (title !== null && typeof title !== 'string')) {
    return fail('bad-input')
  }

  // Много аккаунтов с одного адреса — тоже предел; без адреса (разработка) не считаем.
  const ip = ipOf(request)
  if (ip && tooOften(`gallery-publish-ip:${ip}`, 20, DAY_MS)) return fail('too-many', 'often')

  try {
    const out = await publishKitchen({ q, title, role, phone: session.phone, name: session.name, image, thumb })
    // day — пять кухонь за сутки с одного телефона: экран так и пишет, а не «слишком часто»
    return out === 'too-many' ? fail(out, 'day') : typeof out === 'string' ? fail(out) : done(out)
  } catch (error) {
    console.error('[gallery] не удалось сохранить кухню:', error)
    return fail('save')
  }
}
