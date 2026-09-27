import { readImage } from '@/lib/gallery/store'

/**
 * Картинка кухни: кадр 3D, превью или фото «я сделал такую». Имя строгое
 * (24 hex, -s у маленькой копии, jpg/png/webp); отдаём только картинки видимых
 * кухонь — у скрытой и убранной 404. Кеш — 5 минут: скрытая картинка стёрта с
 * диска, и в кеше браузера и Cloudflare живёт не дольше 5 минут.
 */
export const dynamic = 'force-dynamic'

export async function GET(_request: Request, ctx: RouteContext<'/api/gallery/image/[name]'>) {
  const { name } = await ctx.params
  const image = await readImage(name)
  if (!image) return new Response('Not found', { status: 404, headers: { 'X-Content-Type-Options': 'nosniff' } })
  return new Response(new Uint8Array(image.bytes), {
    headers: {
      'Content-Type': image.type,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'public, max-age=300',
    },
  })
}
