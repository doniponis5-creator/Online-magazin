import { createHmac, timingSafeEqual } from 'node:crypto'
import { defaultLang } from '@/lib/i18n/config'
import { customerBrief, readTurns, respond } from '@/lib/assistant/respond'
import { logQuestion } from '@/lib/assistant/log'
import { cleanName } from '@/lib/assistant/talk'
import { isDemoPhone } from '@/lib/customer/gateway'

/**
 * Ответ продавца для WhatsApp.
 *
 * Сюда стучится только сервер SBonus: он принимает сообщения из WhatsApp
 * (Green API), ждёт, не ответит ли сотрудник, и только потом спрашивает здесь.
 * Отправляет ответ в WhatsApp тоже сервер — ключи Green API живут у него.
 *
 * Запрос подписан тем же секретом, что и заказы (SHOP_API_SECRET): без
 * подписи ответ 404, как будто адреса нет.
 *
 * Номер покупателя — тот, с которого он пишет: его подтвердил сам WhatsApp.
 * Поэтому здесь можно назвать ему его бонусы, заказы и рассрочку.
 */
export const dynamic = 'force-dynamic'

const PHONE = /^\+(?:996\d{9}|7\d{10})$/

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

  let raw: { phone?: unknown; name?: unknown; messages?: unknown; shown?: unknown }
  try {
    raw = JSON.parse(body)
  } catch {
    return Response.json({ ok: false, error: 'bad-json' }, { status: 400 })
  }
  const turns = readTurns(raw.messages)
  if (turns.length === 0) return Response.json({ ok: false, error: 'empty' }, { status: 400 })

  // Номер вне Кыргызстана и России — не покупатель магазина; отвечаем без личных данных.
  // Демо-номер для проверки Apple — не покупатель: его «профиль» в WhatsApp не показываем.
  const phone = typeof raw.phone === 'string' && PHONE.test(raw.phone) && !isDemoPhone(raw.phone) ? raw.phone : undefined
  const name = typeof raw.name === 'string' ? cleanName(raw.name) : undefined
  const customer = await customerBrief(phone)

  const reply = await respond(
    {
      key: `wa:${phone ?? 'unknown'}`,
      orderSource: 'Заказ из WhatsApp',
      leadChannel: 'whatsapp',
      known: { name: customer?.name ?? name, phone },
    },
    turns,
    defaultLang,
    customer,
    undefined,
    raw.shown,
  )

  void logQuestion({
    lang: defaultLang,
    q: turns[turns.length - 1]?.text ?? '',
    a: reply.text,
    found: reply.products.length > 0,
    source: reply.source,
    ch: 'whatsapp',
  })

  return Response.json({
    ok: true,
    text: reply.text,
    // local — модель недоступна, ответ шаблонный. В WhatsApp такой лучше не
    // слать: пусть отвечает сотрудник (сервер смотрит на это поле).
    source: reply.source,
    handoff: Boolean(reply.handoff),
    // Сообщение не для магазина (рабочие, родные владельца) — сервер ничего не шлёт.
    silent: Boolean(reply.silent),
    products: reply.products.map((p) => ({
      id: p.id,
      name: p.name,
      priceLabel: p.priceLabel,
      href: p.href,
      image: p.image,
      inStock: p.inStock,
    })),
  })
}
