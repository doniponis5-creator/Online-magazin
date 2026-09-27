import { tooOften } from '@/lib/assistant/limits'
import { RATES_PER_MINUTE } from '@/lib/gallery/rules'
import { rateKitchen } from '@/lib/gallery/store'
import { KITCHEN_ID, done, fail, readJson, viewer } from '../../helpers'

/**
 * POST { stars: 1..5 } → { ok, avg, count }. Вошедший, не автор; одна оценка от
 * человека, можно поменять. Не больше 30 оценок в минуту с телефона — от перебора.
 */
export const dynamic = 'force-dynamic'

export async function POST(request: Request, ctx: RouteContext<'/api/gallery/[id]/rate'>) {
  const session = await viewer()
  if (!session) return fail('login')
  const { id } = await ctx.params
  if (!KITCHEN_ID.test(id)) return fail('not-found')
  if (tooOften(`gallery-rate:${session.phone}`, RATES_PER_MINUTE, 60_000)) return fail('too-many', 'often')
  const body = await readJson(request)
  const out = await rateKitchen(id, session.phone, Number(body?.stars))
  return typeof out === 'string' ? fail(out) : done(out)
}
