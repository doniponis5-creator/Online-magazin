// Проверка, сколько людей сайт выдерживает сразу (08.10, перед рекламой).
//
// Ходит по сайту как покупатели: главная, каталог, товар, «кто я» (/api/customer/me), настройки.
// Ступени: 10 → 25 → 50 → 100 → 150 → 200 одновременных «покупателей», по 20 с каждая.
// Сам останавливается, если ошибок больше 5 % или 95 % ответов медленнее 3 с — сайт не роняем.
// Запускать только ночью, когда магазин закрыт:
//   node scripts/load-test.mjs
//   node scripts/load-test.mjs --max 100        (потолок ступеней)
//   node scripts/load-test.mjs --base https://smarket.kg
// Ничего не покупает и не пишет: только чтение страниц.

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1]]] : acc), []),
)
const BASE = (args.base ?? 'https://smarket.kg').replace(/\/+$/, '')
const MAX = Number(args.max ?? 200)
const STEP_SECONDS = Number(args.seconds ?? 20)
const STEPS = [10, 25, 50, 100, 150, 200].filter((n) => n <= MAX)
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36 smarket-load-test'

async function productIds() {
  try {
    const r = await fetch(`${BASE}/api/catalog/snapshot`, { headers: { 'user-agent': UA } })
    const d = await r.json()
    return d.items.filter((i) => i.p > 0).slice(0, 60).map((i) => i.id)
  } catch {
    return []
  }
}

function pathsFor(ids) {
  const product = () => (ids.length ? `/ru/product/${ids[Math.floor(Math.random() * ids.length)]}` : '/ru/catalog')
  // как ходит покупатель: страница + «кто я» + изредка настройки
  return () => {
    const roll = Math.random()
    if (roll < 0.2) return '/ru'
    if (roll < 0.35) return '/ky/catalog'
    if (roll < 0.6) return product()
    if (roll < 0.9) return '/api/customer/me'
    return '/api/site-settings'
  }
}

async function hit(path) {
  const start = performance.now()
  try {
    const r = await fetch(`${BASE}${path}`, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(15_000) })
    await r.arrayBuffer()
    // 401 у «кто я» для гостя — нормальный ответ
    const ok = r.ok || (path === '/api/customer/me' && r.status === 401)
    return { ms: performance.now() - start, ok, status: r.status, cf: r.headers.get('cf-cache-status') ?? '' }
  } catch {
    return { ms: performance.now() - start, ok: false, status: 0, cf: '' }
  }
}

async function step(users, next) {
  const until = Date.now() + STEP_SECONDS * 1000
  const results = []
  await Promise.all(
    Array.from({ length: users }, async () => {
      while (Date.now() < until) {
        results.push(await hit(next()))
        await new Promise((r) => setTimeout(r, 200 + Math.random() * 600)) // человек не жмёт без пауз
      }
    }),
  )
  const times = results.map((r) => r.ms).sort((a, b) => a - b)
  const p95 = times[Math.floor(times.length * 0.95)] ?? 0
  const errors = results.filter((r) => !r.ok)
  const statuses = {}
  for (const r of errors) statuses[r.status] = (statuses[r.status] ?? 0) + 1
  const cached = results.filter((r) => r.cf === 'HIT').length
  return { users, total: results.length, rps: results.length / STEP_SECONDS, p95, errorRate: errors.length / Math.max(1, results.length), statuses, cached }
}

const ids = await productIds()
const next = pathsFor(ids)
console.log(`Сайт: ${BASE}; ступени: ${STEPS.join(' → ')} одновременно, по ${STEP_SECONDS} с\n`)
console.log('людей | запросов/с | 95% быстрее | ошибки | из кэша Cloudflare')
for (const users of STEPS) {
  const s = await step(users, next)
  const err = `${(s.errorRate * 100).toFixed(1)}%${Object.keys(s.statuses).length ? ' ' + JSON.stringify(s.statuses) : ''}`
  console.log(`${String(users).padStart(5)} | ${s.rps.toFixed(0).padStart(10)} | ${(s.p95 / 1000).toFixed(2).padStart(9)} с | ${err.padEnd(6)} | ${Math.round((100 * s.cached) / Math.max(1, s.total))}%`)
  if (s.errorRate > 0.05 || s.p95 > 3000) {
    console.log(`\nСТОП на ${users}: ошибок ${(s.errorRate * 100).toFixed(1)}%, 95% ответов медленнее ${(s.p95 / 1000).toFixed(1)} с. Дальше не нагружаю.`)
    break
  }
  await new Promise((r) => setTimeout(r, 5000)) // передышка между ступенями
}
console.log('\nГотово. Пришлите эту таблицу в чат.')
