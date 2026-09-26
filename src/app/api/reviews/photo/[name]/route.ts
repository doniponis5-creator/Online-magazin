import { readPhoto } from '@/lib/reviews/store'

/**
 * Фото из отзыва. Имя файла случайное и не меняется, поэтому браузер и
 * Cloudflare держат фото у себя. Срок — сутки, не год: фото, которое скрыл
 * владелец, стёрто с диска, и через сутки по старой ссылке тоже будет 404.
 */
export const dynamic = 'force-dynamic'

export async function GET(_request: Request, ctx: RouteContext<'/api/reviews/photo/[name]'>) {
  const { name } = await ctx.params
  const photo = await readPhoto(name)
  if (!photo) return new Response('Not found', { status: 404 })
  return new Response(new Uint8Array(photo.bytes), {
    headers: {
      'Content-Type': photo.type,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'public, max-age=86400',
    },
  })
}
