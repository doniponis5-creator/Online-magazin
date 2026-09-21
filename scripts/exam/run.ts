/**
 * Имтихон консультанта: задаём вопросы из questions.txt и печатаем ответы.
 *
 * Зачем: перед выкаткой смотреть глазами, как продавец отвечает на настоящие
 * вопросы покупателей. Плохой ответ — правим правила (policy.ts, prompt.ts),
 * запускаем снова.
 *
 * Запуск: npm run exam. Модель настоящая — GEMINI_API_KEY из .env.local; без
 * ключа отвечает запасной режим, и это тоже видно (source=local).
 * Запускается через vitest, потому что он умеет «@/…» и server-only.
 */
import { readFileSync } from 'node:fs'
import { it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

try {
  process.loadEnvFile('.env.local')
} catch {
  // нет файла — отвечает запасной режим
}
process.env.SHOP_PAYMENT_MODE ??= 'mock'

it('имтихон', async () => {
  const { respond } = await import('@/lib/assistant/respond')
  const lines = readFileSync('scripts/exam/questions.txt', 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))

  const out: string[] = []
  // Строка, начинающаяся с «> », продолжает предыдущий разговор (бот помнит ответ).
  let turns: { role: 'user' | 'assistant'; text: string }[] = []
  let key = ''
  let shown: string[] = []
  for (const line of lines) {
    const follow = line.startsWith('> ')
    const q = follow ? line.slice(2) : line
    if (!follow) {
      turns = []
      shown = []
      key = `exam:${Math.random()}`
    }
    turns.push({ role: 'user', text: q })
    const started = Date.now()
    const reply = await respond(
      { key, orderSource: 'Имтихон', leadChannel: 'whatsapp', known: {} },
      turns,
      'ru',
      null,
      undefined,
      shown,
    )
    turns.push({ role: 'assistant', text: reply.text })
    if (reply.products.length) shown = reply.products.map((p) => p.id)
    out.push(`\n${follow ? '  >' : '?'} ${q}\n[${reply.source}, ${((Date.now() - started) / 1000).toFixed(1)} с]\n${reply.text}`)
    if (reply.products.length) out.push('  → ' + reply.products.map((p) => `${p.name} (${p.priceLabel})`).join('; '))
  }
  process.stdout.write(out.join('\n') + '\n')
})
