import 'server-only'

/**
 * Сколько стоит консультант: токены Gemini за день и цена в долларах.
 *
 * Владелец 04.10: «канча бўлсаҳам пул тугаб коляпти» — он узнал о расходе только по
 * графику Google. Теперь каждый ответ и каждая расшифровка голосового считаются здесь;
 * итог дня — в утренней сводке (digest), а перерасход — сразу в WhatsApp (сервер
 * спрашивает /api/assistant/usage).
 *
 * Хранится в data/state/gemini-usage.json (durableMap) — переживает перезапуск сайта.
 */

import { durableMap } from '@/lib/durable'

export type Usage = {
  /** запросов к модели (ответы + голосовые/фото) */
  calls: number
  /** токенов ввода всего, в том числе из кэша */
  input: number
  /** из них из кэша (в 10 раз дешевле) */
  cached: number
  /** токенов ответа вместе с «мыслями» модели */
  output: number
  /** из них «мысли» (модель думает перед ответом; оплачиваются как ответ). Нет в старых днях — 0 */
  thoughts?: number
  /** сколько раз создан кэш */
  caches: number
  /** хранение кэша, токено-часов */
  storage: number
  /** то же по каналам: site, whatsapp, instagram, telegram, media (голосовые и фото) */
  ch?: Record<string, Part>
  /** запросов к Jev (OpenRouter/TypeSafe; цена в счёт Gemini не входит) */
  jev?: number
}

/** Расход одного канала. */
type Part = { calls: number; input: number; cached: number; output: number }

const empty = (): Usage => ({ calls: 0, input: 0, cached: 0, output: 0, caches: 0, storage: 0 })
const days = durableMap<string, Usage>('gemini-usage', 40 * 24 * 3600 * 1000)

/** День по Бишкеку (UTC+6), ГГГГ-ММ-ДД. */
export function bishkekToday(now = new Date()): string {
  return new Date(now.getTime() + 6 * 3600_000).toISOString().slice(0, 10)
}

type Counts = Omit<Usage, 'ch' | 'jev'>

function add(patch: Partial<Counts>, channel = '', now = new Date()): void {
  const day = bishkekToday(now)
  const prev = days.get(day) ?? empty()
  const next: Usage = { ...prev, ch: { ...(prev.ch ?? {}) } }
  // `?? 0`: в днях, записанных до 06.10, поля «мысли» нет — undefined + N дало бы NaN
  for (const [key, value] of Object.entries(patch) as [keyof Counts, number][]) next[key] = (next[key] ?? 0) + Math.max(0, value || 0)
  if (channel) {
    const part = { ...(next.ch![channel] ?? { calls: 0, input: 0, cached: 0, output: 0 }) }
    for (const key of ['calls', 'input', 'cached', 'output'] as const) part[key] += Math.max(0, patch[key] || 0)
    next.ch![channel] = part
  }
  days.set(day, next)
}

/** Один ответ модели — usageMetadata из ответа Gemini. */
export function recordCall(
  meta: { promptTokenCount?: number; cachedContentTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number } = {},
  channel = 'site',
): void {
  add(
    {
      calls: 1,
      input: meta.promptTokenCount ?? 0,
      cached: meta.cachedContentTokenCount ?? 0,
      output: (meta.candidatesTokenCount ?? 0) + (meta.thoughtsTokenCount ?? 0),
      thoughts: meta.thoughtsTokenCount ?? 0,
    },
    channel,
  )
}

/** Один запрос к Jev. */
export function recordJev(now = new Date()): void {
  const day = bishkekToday(now)
  const prev = days.get(day) ?? empty()
  days.set(day, { ...prev, jev: (prev.jev ?? 0) + 1 })
}

/** Создан кэш: его токены оплачиваются как обычный ввод, плюс хранение на срок жизни. */
export function recordCache(tokens: number, hours: number): void {
  add({ caches: 1, input: tokens, storage: tokens * hours })
}

export function usageOf(day: string): Usage {
  return days.get(day) ?? empty()
}

/**
 * Цены Gemini 3.8 Flash, $ за 1 млн токенов (ai.google.dev/gemini-api/docs/pricing, 04.10.2026):
 * до 31.12.2026 — ввод 0,75, кэш 0,075, ответ 3,75, хранение 0,50 в час; с 01.01.2027 — вдвое дороже.
 * Другая модель (GEMINI_MODEL) — цены надо поправить здесь.
 */
function prices(day: string) {
  const k = day >= '2027-01-01' ? 2 : 1
  return { input: 0.75 * k, cached: 0.075 * k, output: 3.75 * k, storage: 0.5 * k }
}

export function costOf(u: Partial<Usage> & Part, day: string): number {
  const p = prices(day)
  return ((u.input - u.cached) * p.input + u.cached * p.cached + u.output * p.output + (u.storage ?? 0) * p.storage) / 1_000_000
}

/** Предел расхода в день, $: ASSISTANT_DAILY_USD, по умолчанию 3. Больше — владельцу в WhatsApp. */
export function spendLimit(): number {
  const value = Number(process.env.ASSISTANT_DAILY_USD)
  return Number.isFinite(value) && value > 0 ? value : 3
}

const money = (usd: number) => `$${usd.toFixed(2).replace('.', ',')}`
const NAMES: Record<string, string> = { whatsapp: 'WhatsApp', instagram: 'Instagram', site: 'сайт', telegram: 'Telegram', media: 'голосовые и фото' }
const millions = (n: number) => (n >= 100_000 ? `${(n / 1_000_000).toFixed(1).replace('.', ',')} млн` : `${Math.round(n / 1000)} тыс.`)

/** Строка для сводки: «💰 Gemini: 312 запросов, 4,1 млн токенов (78 % из кэша) — ≈ $1,24». */
export function usageLine(day: string): string {
  const u = usageOf(day)
  if (u.calls === 0) return `💰 Gemini: запросов не было — $0.${u.jev ? ` Jev: запросов ${u.jev}.` : ''}`
  const share = u.input > 0 ? Math.round((u.cached / u.input) * 100) : 0
  const head = `💰 Gemini: запросов ${u.calls}, ${millions(u.input + u.output)} токенов (${share} % из кэша) — ≈ ${money(costOf(u, day))}.`
  // По каналам — дорогие первыми; «кэш» — создание и хранение общей части промпта, ни к какому каналу.
  const parts = Object.entries(u.ch ?? {})
    .map(([ch, part]) => ({ name: NAMES[ch] ?? ch, calls: part.calls, usd: costOf(part, day) }))
    .sort((a, b) => b.usd - a.usd)
    .map((x) => `${x.name} ${money(x.usd)} (${x.calls})`)
  const shared = costOf({ calls: 0, input: 0, cached: 0, output: 0, storage: u.storage }, day) + creation(u, day)
  if (shared >= 0.005) parts.push(`кэш ${money(shared)}`)
  if (u.jev) parts.push(`Jev: запросов ${u.jev}`)
  const lines = [head]
  if (parts.length > 0) lines.push(`   ${parts.join(' · ')}`)
  lines.push(`   ${spentOn(u, day)}`)
  return lines.join('\n')
}

/**
 * На что ушли деньги (владелец 06.10: «5 $ 2 кунга етмаяпти» — прежде чем урезать, смотрим, что дорого):
 * «вопрос» — ввод без кэша (разговор, товары по вопросу, создание кэша), «из кэша» — общая часть правил,
 * «мысли» — модель думает перед ответом, «ответ» — сам текст, «хранение» — кэш живёт час. И сколько в среднем за ответ.
 */
function spentOn(u: Usage, day: string): string {
  const p = prices(day)
  const thoughts = Math.min(u.output, u.thoughts ?? 0)
  const usd = (tokens: number, price: number) => (tokens * price) / 1_000_000
  const items: [string, number][] = [
    ['вопрос', usd(u.input - u.cached, p.input)],
    ['из кэша', usd(u.cached, p.cached)],
    ['мысли', usd(thoughts, p.output)],
    ['ответ', usd(u.output - thoughts, p.output)],
    ['хранение кэша', usd(u.storage, p.storage)],
  ]
  const shown = items.filter(([, v]) => v >= 0.005).sort((a, b) => b[1] - a[1]).map(([name, v]) => `${name} ${money(v)}`)
  return `На что: ${shown.join(' · ') || 'меньше цента'} · в среднем ${money(costOf(u, day) / u.calls)} за запрос`
}

/** Создание кэша: его ввод не попал ни в один канал. */
function creation(u: Usage, day: string): number {
  const inChannels = Object.values(u.ch ?? {}).reduce((sum, p) => sum + p.input, 0)
  return Math.max(0, u.input - inChannels) * prices(day).input / 1_000_000
}
