import { addComment } from '@/lib/gallery/store'
import { KITCHEN_ID, done, fail, readJson, viewer } from '../../helpers'

/**
 * POST { text } → { ok, comment: GalleryComment }. Вошедший; 2–500 знаков;
 * телефоны и ссылки в тексте прячутся; не чаще раза в 30 с и 20 в сутки, 300 на
 * кухню. Текст и пределы проверяет хранилище: слот тратится только на принятый.
 */
export const dynamic = 'force-dynamic'

export async function POST(request: Request, ctx: RouteContext<'/api/gallery/[id]/comments'>) {
  const session = await viewer()
  if (!session) return fail('login')
  const { id } = await ctx.params
  if (!KITCHEN_ID.test(id)) return fail('not-found')
  const body = await readJson(request)
  if (typeof body?.text !== 'string') return fail('bad-input')
  const out = await addComment(id, session.phone, session.name, body.text)
  if (out === 'too-many') return fail(out, 'often')
  if (out === 'full') return fail('too-many', 'comments')
  return typeof out === 'string' ? fail(out) : done({ comment: out })
}
