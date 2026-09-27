import 'server-only'
import { currentSession } from '@/app/api/customer/route-helpers'
import { sizeOk, stripMeta } from '@/lib/gallery/image'
import { imageType, type GalleryError, type TooManyReason } from '@/lib/gallery/rules'

export { DAY_MS, KITCHEN_ID } from '@/lib/gallery/rules'

/**
 * Общее для /api/gallery/*: ответы, сессия, адрес, картинки из формы.
 *
 * Ошибки — короткими кодами, тексты на экране делает страница:
 *   login 401 · too-many 429 · bad-input 400 · not-found 404 · forbidden 403 ·
 *   no-space 507 (кончилось место под картинки) · save 500
 * У too-many есть reason: photos (больше 5 фото), comments (300 на кухне),
 * often (слишком часто).
 */

const STATUS: Record<GalleryError | 'save', number> = {
  login: 401,
  'too-many': 429,
  'bad-input': 400,
  'not-found': 404,
  forbidden: 403,
  'no-space': 507,
  save: 500,
}

const NO_STORE = { 'Cache-Control': 'no-store' }

export function fail(error: GalleryError | 'save', reason?: TooManyReason): Response {
  return Response.json({ ok: false, error, ...(reason ? { reason } : {}) }, { status: STATUS[error], headers: NO_STORE })
}

export function done(body: Record<string, unknown> = {}): Response {
  return Response.json({ ok: true, ...body }, { headers: NO_STORE })
}

/** Вошедший покупатель: телефон и имя — из подписанной cookie, не из формы. */
export const viewer = currentSession

/**
 * Адрес для пределов — из X-Real-IP: его ставит наш nginx. Первый адрес в
 * X-Forwarded-For пишет сам клиент, по нему предел обходится подменой.
 */
export function ipOf(request: Request): string {
  return (request.headers.get('x-real-ip') ?? '').trim().slice(0, 45)
}

export async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  const body = (await request.json().catch(() => null)) as unknown
  return body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : null
}

/**
 * Картинка из формы: файл, не пустой, не больше предела по байтам, JPEG/PNG/WebP
 * по байтам, стороны ≤ 4000 px по заголовку. Метаданные (EXIF, XMP, текст) срезаются.
 */
export async function imageFrom(
  item: FormDataEntryValue | null | undefined,
  max: number,
): Promise<{ bytes: Uint8Array; ext: 'jpg' | 'png' | 'webp' } | null> {
  if (!(item instanceof File) || item.size === 0 || item.size > max) return null
  const raw = new Uint8Array(await item.arrayBuffer())
  const ext = imageType(raw)
  if (!ext || !sizeOk(raw)) return null
  const bytes = stripMeta(raw, ext)
  return bytes ? { bytes, ext } : null
}
