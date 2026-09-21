import { isLang, defaultLang, type Lang } from '@/lib/i18n/config'
import { answer } from '@/lib/assistant/reply'
import type { ChatTurn } from '@/lib/assistant/gemini'
import type { CustomerBrief } from '@/lib/assistant/knowledge'
import { getInstallment, getProfile } from '@/lib/customer/gateway'
import { currentSession } from '@/app/api/customer/route-helpers'
import { logQuestion } from '@/lib/assistant/log'

/**
 * Чат с консультантом.
 *
 * Отвечает всегда, даже когда языковая модель недоступна: подробности в
 * src/lib/assistant/reply.ts. Ответ не кэшируется — у каждого покупателя
 * свой разговор.
 */
export const dynamic = 'force-dynamic'

/** Сколько сообщений разговора отдаём модели. Дальше платим за чужую историю. */
const MAX_TURNS = 12
const MAX_CHARS = 800

/** Ограничение частоты: столько вопросов с одного адреса за окно. */
const LIMIT = 20
const WINDOW_MS = 5 * 60_000

// Счётчик живёт в памяти процесса. Он не переживает перезапуск сайта и не
// общий на несколько серверов — но сайт крутится в одном контейнере, и от
// простого перебора этого достаточно. Настоящая защита — лимит у Gemini.
const seen = new Map<string, number[]>()

function tooOften(ip: string): boolean {
  const now = Date.now()
  const hits = (seen.get(ip) ?? []).filter((t) => now - t < WINDOW_MS)
  hits.push(now)
  seen.set(ip, hits)
  if (seen.size > 5000) seen.clear()
  return hits.length > LIMIT
}

function ipOf(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? ''
  return forwarded.split(',')[0].trim().slice(0, 45) || 'local'
}

export async function POST(request: Request) {
  if (tooOften(ipOf(request))) {
    return Response.json({ ok: false, error: 'too-many' }, { status: 429 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ ok: false, error: 'bad-json' }, { status: 400 })
  }

  const raw = body as { lang?: unknown; messages?: unknown }
  const lang: Lang = typeof raw.lang === 'string' && isLang(raw.lang) ? raw.lang : defaultLang
  const turns = readTurns(raw.messages)
  if (turns.length === 0) {
    return Response.json({ ok: false, error: 'empty' }, { status: 400 })
  }

  const reply = await answer(turns, lang, await customerBrief())

  // Записываем вопрос в журнал владельца. Ждать запись не нужно — ответ уходит
  // покупателю сразу, а журнал дописывается следом.
  void logQuestion({
    lang,
    q: turns[turns.length - 1]?.text ?? '',
    a: reply.text,
    found: reply.products.length > 0,
    source: reply.source,
  })

  return Response.json({ ok: true, ...reply })
}

/**
 * Данные вошедшего покупателя — имя, бонусы, его заказы.
 *
 * Берём их по телефону из входного печенья (cookie), а не из того, что
 * прислал браузер: иначе любой мог бы спросить чужие заказы, подставив чужой
 * номер. Не вошёл или сервер SBonus молчит — консультант работает без них.
 */
async function customerBrief(): Promise<CustomerBrief | null> {
  const session = await currentSession()
  if (!session) return null
  try {
    const [profile, installment] = await Promise.all([
      getProfile(session.phone, 0, true),
      // Рассрочка — отдельный запрос: сервер без неё не должен ломать чат.
      getInstallment(session.phone).catch((error) => {
        console.error('[assistant] рассрочка:', error instanceof Error ? error.message : error)
        return null
      }),
    ])
    if (!profile) return null
    return {
      installment: installment && {
        debt: installment.debt,
        overdue: installment.overdue,
        nextDate: installment.nextDate,
        nextAmount: installment.nextAmount,
        monthsLeft: installment.monthsLeft,
        asOf: installment.asOf ? installment.asOf.slice(0, 10) : null,
      },
      name: profile.name,
      balance: profile.balance,
      maxSpendPct: profile.maxSpendPct,
      orders: (profile.orders ?? []).map((o) => ({
        id: o.orderId,
        status: o.status,
        total: o.total,
        createdAt: o.createdAt,
      })),
    }
  } catch (error) {
    console.error('[assistant] профиль покупателя:', error instanceof Error ? error.message : error)
    return null
  }
}

function readTurns(value: unknown): ChatTurn[] {
  if (!Array.isArray(value)) return []
  const turns: ChatTurn[] = []
  for (const item of value.slice(-MAX_TURNS)) {
    if (!item || typeof item !== 'object') continue
    const row = item as { role?: unknown; text?: unknown }
    const text = typeof row.text === 'string' ? row.text.trim().slice(0, MAX_CHARS) : ''
    if (!text) continue
    turns.push({ role: row.role === 'assistant' ? 'assistant' : 'user', text })
  }
  // Модель ждёт разговор, который начинается с вопроса покупателя.
  while (turns.length > 0 && turns[0].role !== 'user') turns.shift()
  return turns
}
