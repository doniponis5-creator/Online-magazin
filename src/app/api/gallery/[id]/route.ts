import { getKitchen, removeOwn, viewerOf } from '@/lib/gallery/store'
import { KITCHEN_ID, done, fail, viewer } from '../helpers'

/**
 * Одна кухня.
 *
 * GET    → { ok, kitchen: GalleryKitchen, viewer: { mine, stars } | null } (viewer — если вошёл)
 * DELETE → { ok } — «Убрать из галереи», только автор.
 * Скрытая владельцем или убранная кухня — 404.
 */
export const dynamic = 'force-dynamic'

export async function GET(_request: Request, ctx: RouteContext<'/api/gallery/[id]'>) {
  const { id } = await ctx.params
  const kitchen = KITCHEN_ID.test(id) ? await getKitchen(id) : null
  if (!kitchen) return fail('not-found')
  const session = await viewer()
  return done({ kitchen, viewer: session ? await viewerOf(id, session.phone) : null })
}

export async function DELETE(_request: Request, ctx: RouteContext<'/api/gallery/[id]'>) {
  const session = await viewer()
  if (!session) return fail('login')
  const { id } = await ctx.params
  if (!KITCHEN_ID.test(id)) return fail('not-found')
  const out = await removeOwn(id, session.phone)
  return out === 'ok' ? done() : fail(out)
}
