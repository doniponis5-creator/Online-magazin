/**
 * Утренняя сводка для владельца: чем вчера занимался консультант.
 *
 * Зачем: бот учится только через владельца. Он видит, на что бот ответил
 * «спрошу у сотрудника» и чего не нашёл в каталоге, — и вписывает ответ в
 * «Знания для чата» (1С → Панель сайта). Назавтра бот это знает.
 *
 * Сводку забирает сервер SBonus раз в день и отправляет владельцу в WhatsApp —
 * туда же, куда приходят «перезвоните» и оплаченные заказы.
 */

import type { LogRow } from './log'

/** Ответ, в котором бот сдался: отправил к сотруднику или сказал «не знаю». */
export const GAVE_UP =
  /(перезвон|сотрудник|не знаю|уточн|позвоните|чалыңыз|кызматкер|билбейм|тактап|xodim|bilmayman|qo.?ng.?iroq|aniqla)/i

const CHANNEL: Record<string, string> = { site: 'сайт', telegram: 'Telegram', whatsapp: 'WhatsApp' }

/** Строки за день `day` (ГГГГ-ММ-ДД) по Бишкеку (UTC+6). */
export function rowsForDay(rows: LogRow[], day: string): LogRow[] {
  return rows.filter((r) => bishkekDay(r.at) === day)
}

export function bishkekDay(iso: string): string {
  const t = new Date(iso).getTime()
  return Number.isFinite(t) ? new Date(t + 6 * 3600_000).toISOString().slice(0, 10) : ''
}

/** Вчера по Бишкеку. */
export function yesterday(now = new Date()): string {
  return new Date(now.getTime() + 6 * 3600_000 - 24 * 3600_000).toISOString().slice(0, 10)
}

const MAX_CHARS = 3500

export function dailyDigest(rows: LogRow[], day: string): string {
  const [y, m, d] = day.split('-')
  const title = `🤖 Консультант за ${d}.${m}.${y}`
  if (rows.length === 0) return `${title}\n\nВопросов не было.`

  const byChannel = new Map<string, number>()
  for (const r of rows) {
    const ch = CHANNEL[r.ch ?? 'site'] ?? r.ch ?? 'сайт'
    byChannel.set(ch, (byChannel.get(ch) ?? 0) + 1)
  }
  const channels = [...byChannel.entries()].map(([ch, n]) => `${ch} ${n}`).join(', ')
  const local = rows.filter((r) => r.source === 'local').length

  const gaveUp = rows.filter((r) => GAVE_UP.test(r.a))
  const misses = rows.filter((r) => !r.found && !GAVE_UP.test(r.a))

  const lines = [
    title,
    '━━━━━━━━━━━━━━━━━━━',
    `Вопросов: ${rows.length} (${channels}).`,
    local > 0 ? `⚠ ${local} раз модель была недоступна — отвечал запасной режим.` : '',
    '',
  ]

  if (gaveUp.length > 0) {
    lines.push(`🙋 Отправил к сотруднику или не знал — ${gaveUp.length}:`)
    for (const r of dedupe(gaveUp).slice(0, 8)) lines.push(`• ${clip(r.q, 90)}\n  → ${clip(r.a, 110)}`)
    lines.push('')
  }
  if (misses.length > 0) {
    lines.push(`🔍 Товар не нашёлся — ${misses.length}:`)
    for (const r of dedupe(misses).slice(0, 8)) lines.push(`• ${clip(r.q, 90)}`)
    lines.push('')
  }

  const top = frequent(rows).slice(0, 5)
  if (top.length > 0) {
    lines.push('🔁 Спрашивали чаще всего:')
    for (const [q, n] of top) lines.push(`• ${clip(q, 80)} — ${n}`)
    lines.push('')
  }

  lines.push('Ответы на эти вопросы впишите в 1С → Панель сайта → Знания для чата: завтра бот будет знать.')
  const text = lines.filter((l, i) => l !== '' || lines[i - 1] !== '').join('\n')
  return text.length > MAX_CHARS ? text.slice(0, MAX_CHARS - 1) + '…' : text
}

function clip(text: string, max: number): string {
  const one = text.replace(/\s+/g, ' ').trim()
  return one.length > max ? one.slice(0, max - 1) + '…' : one
}

function dedupe(rows: LogRow[]): LogRow[] {
  const seen = new Set<string>()
  return rows.filter((r) => {
    const key = r.q.toLowerCase().replace(/\s+/g, ' ').trim()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function frequent(rows: LogRow[]): [string, number][] {
  const count = new Map<string, number>()
  for (const r of rows) {
    const key = r.q.toLowerCase().replace(/\s+/g, ' ').trim()
    if (key) count.set(key, (count.get(key) ?? 0) + 1)
  }
  return [...count.entries()].filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1])
}
