import { isLang, defaultLang, type Lang } from '@/lib/i18n/config'
import { customerBrief, readTurns, respond } from '@/lib/assistant/respond'
import { currentSession } from '@/app/api/customer/route-helpers'
import { logQuestion } from '@/lib/assistant/log'
import { geminiConfigured, readMedia } from '@/lib/assistant/gemini'

/**
 * Чат с консультантом.
 *
 * Отвечает всегда, даже когда языковая модель недоступна: подробности в
 * src/lib/assistant/reply.ts. Ответ не кэшируется — у каждого покупателя
 * свой разговор.
 */
export const dynamic = 'force-dynamic'

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

  const raw = body as { lang?: unknown; messages?: unknown; sid?: unknown; buy?: unknown; shown?: unknown; image?: unknown; page?: unknown }
  const lang: Lang = typeof raw.lang === 'string' && isLang(raw.lang) ? raw.lang : defaultLang
  const turns = readTurns(raw.messages)
  if (turns.length === 0) {
    return Response.json({ ok: false, error: 'empty' }, { status: 400 })
  }

  // Фото товара: модель описывает, что на нём, и описание становится последней
  // репликой покупателя — «[Фото] …», как и в WhatsApp. Подпись сохраняем.
  let heard = ''
  const image = readImage(raw.image)
  if (image && geminiConfigured()) {
    try {
      const seen = await readMedia('image', image.mime, image.data)
      if (seen) {
        heard = `[Фото] ${seen}` + (image.caption ? `\nПодпись покупателя: ${image.caption}` : '')
        turns[turns.length - 1].text = heard
      }
    } catch (error) {
      console.error('[assistant] фото:', error instanceof Error ? error.message : error)
    }
  }

  // Покупатель — только из входного cookie: номер, присланный браузером или
  // написанный в чате, ничего не открывает.
  const session = await currentSession()
  const customer = await customerBrief(session?.phone)

  // Оформление заказа и «перезвоните мне» идут по шагам, без модели: там
  // деньги и телефон. Нужен ключ вкладки — его присылает браузер; без него —
  // только консультант.
  const sid = typeof raw.sid === 'string' && /^[a-z0-9-]{8,40}$/i.test(raw.sid) ? raw.sid : ''
  const reply = await respond(
    {
      key: sid ? `web:${sid}` : `web:none-${Date.now()}`,
      orderSource: 'Заказ из чата на сайте',
      leadChannel: 'site',
      known: { name: customer?.name, phone: session?.phone },
    },
    turns,
    lang,
    customer,
    sid ? raw.buy : undefined,
    sid ? raw.shown : undefined,
    typeof raw.page === 'string' && /^[a-z0-9-]{1,80}$/i.test(raw.page) ? raw.page : undefined,
  )

  // Записываем вопрос в журнал владельца. Ждать запись не нужно — ответ уходит
  // покупателю сразу, а журнал дописывается следом.
  void logQuestion({
    lang,
    q: turns[turns.length - 1]?.text ?? '',
    a: reply.text,
    found: reply.products.length > 0,
    source: reply.source,
  })

  return Response.json({ ok: true, text: reply.text, products: reply.products, source: reply.source, heard: heard || undefined })
}

/** Фото из браузера: JPEG/PNG/WebP в base64, не больше 2 МБ. */
const IMAGE_MAX = 2 * 1024 * 1024

function readImage(value: unknown): { mime: string; data: string; caption: string } | null {
  if (!value || typeof value !== 'object') return null
  const { mime, data, caption: rawCaption } = value as { mime?: unknown; data?: unknown; caption?: unknown }
  const caption = typeof rawCaption === 'string' ? rawCaption.trim().slice(0, 300) : ''
  if (typeof mime !== 'string' || !/^image\/(jpeg|png|webp)$/.test(mime)) return null
  if (typeof data !== 'string' || data.length === 0 || data.length > IMAGE_MAX * 1.4) return null
  if (!/^[A-Za-z0-9+/=]+$/.test(data)) return null
  return { mime, data, caption }
}
