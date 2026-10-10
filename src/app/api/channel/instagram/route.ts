import { createHmac, timingSafeEqual } from 'node:crypto'
import { defaultLang } from '@/lib/i18n/config'
import { readTurns, respond } from '@/lib/assistant/respond'
import { logQuestion } from '@/lib/assistant/log'
import { cleanName } from '@/lib/assistant/talk'

/**
 * Ответ продавца для Instagram (Direct).
 *
 * Как WhatsApp: сюда стучится только сервер SBonus. Он получает сообщения от
 * Instagram (webhook Meta), ждёт, не ответит ли сотрудник, и только потом
 * спрашивает здесь. Отправляет ответ в Instagram тоже сервер — ключ Meta живёт у него.
 *
 * Подпись — тот же SHOP_API_SECRET, что у заказов: без подписи ответ 404.
 *
 * Отличие от WhatsApp: номера телефона нет. Покупатель — просто id Instagram,
 * поэтому ни бонусов, ни заказов, ни рассрочки ему не называем. Для заказа или
 * звонка консультант спросит номер, как в чате на сайте без входа.
 */
export const dynamic = 'force-dynamic'

/** id покупателя в Instagram (IGSID) — только цифры. */
const IGSID = /^\d{5,32}$/

export async function POST(request: Request) {
  const secret = process.env.SHOP_API_SECRET ?? ''
  const body = await request.text()
  const signature = request.headers.get('x-signature') ?? ''
  const expected = createHmac('sha256', secret).update(body, 'utf8').digest('hex')
  if (
    !secret ||
    signature.length !== expected.length ||
    !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  ) {
    return new Response('Not found', { status: 404 })
  }

  let raw: { id?: unknown; name?: unknown; username?: unknown; messages?: unknown; shown?: unknown }
  try {
    raw = JSON.parse(body)
  } catch {
    return Response.json({ ok: false, error: 'bad-json' }, { status: 400 })
  }
  const id = typeof raw.id === 'string' && IGSID.test(raw.id) ? raw.id : ''
  if (!id) return Response.json({ ok: false, error: 'bad-id' }, { status: 400 })
  const turns = readTurns(raw.messages)
  if (turns.length === 0) return Response.json({ ok: false, error: 'empty' }, { status: 400 })
  const name = typeof raw.name === 'string' ? cleanName(raw.name) : undefined
  // Подпись для владельца в 🚨/💳: по нику он найдёт чат в Instagram, по имени — нет (ревью 04.10).
  const username = typeof raw.username === 'string' && /^[\w.]{1,30}$/.test(raw.username) ? raw.username : ''
  const label = username ? `Instagram @${username}` : `Instagram id ${id}`

  const reply = await respond(
    {
      key: `ig:${id}`,
      orderSource: 'Заказ из Instagram',
      leadChannel: 'instagram',
      known: { name },
      label,
    },
    turns,
    defaultLang,
    null,
    undefined,
    raw.shown,
  )

  void logQuestion({
    lang: defaultLang,
    q: turns[turns.length - 1]?.text ?? '',
    a: reply.text,
    found: reply.products.length > 0,
    source: reply.source,
    ch: 'instagram',
    jev: reply.jev,
  })

  return Response.json({
    ok: true,
    text: reply.text,
    // local — модель недоступна, ответ шаблонный: сервер его не шлёт, пусть ответит сотрудник.
    source: reply.source,
    why: reply.why ?? null,
    handoff: Boolean(reply.handoff),
    silent: Boolean(reply.silent),
    mute: Boolean(reply.mute),
    followAfter: reply.followAfter ?? null,
    products: reply.products.map((p) => ({
      id: p.id,
      name: p.name,
      priceLabel: p.priceLabel,
      href: p.href,
      image: p.image,
      inStock: p.inStock,
      preorder: p.preorder,
    })),
  })
}
