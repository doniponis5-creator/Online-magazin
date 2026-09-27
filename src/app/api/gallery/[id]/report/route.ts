import { tooOften } from '@/lib/assistant/limits'
import { reportItem } from '@/lib/gallery/store'
import { DAY_MS, KITCHEN_ID, done, fail, readJson, viewer } from '../../helpers'

/**
 * POST { commentId? } → { ok } или { ok, already: true }. «Пожаловаться» на кухню
 * или комментарий: вошедший, одна жалоба от человека на запись. Сама ничего не
 * скрывает — поднимает запись в панели владельца.
 */
export const dynamic = 'force-dynamic'

export async function POST(request: Request, ctx: RouteContext<'/api/gallery/[id]/report'>) {
  const session = await viewer()
  if (!session) return fail('login')
  const { id } = await ctx.params
  if (!KITCHEN_ID.test(id)) return fail('not-found')
  const body = await readJson(request)
  const commentId = body?.commentId
  if (commentId !== undefined && (typeof commentId !== 'string' || !KITCHEN_ID.test(commentId))) return fail('bad-input')
  if (tooOften(`gallery-report:${session.phone}`, 30, DAY_MS)) return fail('too-many', 'often')
  const out = await reportItem(id, session.phone, commentId)
  if (out === 'not-found') return fail(out)
  return done(out === 'already' ? { already: true } : {})
}
