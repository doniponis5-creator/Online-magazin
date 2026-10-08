// Перед рекламой: прогреть кэш Cloudflare фотографиями товаров (08.10).
//
// Фото в браузере идут через сайт (/p/…, src/lib/photoSrc.ts), Cloudflare хранит каждое год. Но первый
// покупатель с рекламы, пришедший к ещё «холодному» фото, тянет его с сервера SBonus — а сотни сразу
// упрутся в его предел 200 запросов за 10 с. Этот скрипт заранее, медленно (5 в секунду), запрашивает
// все фото каталога один раз — дальше их отдаёт Cloudflare.
// Запуск (после выкладки сайта и включения правила кэша в Cloudflare, docs/LOAD_UZ.md):
//   node scripts/warm-photos.mjs

const BASE = 'https://smarket.kg'
const ORIGIN = 'https://api.smartcentr.store/api/v1/shop/photos/'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36 smarket-warm'

const snapshot = await (await fetch(`${BASE}/api/catalog/snapshot`, { headers: { 'user-agent': UA } })).json()
const photos = [...new Set(snapshot.items.map((i) => i.img).filter((u) => typeof u === 'string' && u.startsWith(ORIGIN)))]
console.log(`Фото в каталоге: ${photos.length}. Гружу через сайт по 5 в секунду…`)

const tally = { HIT: 0, MISS: 0, other: 0, failed: 0 }
for (const [i, url] of photos.entries()) {
  const path = `/p/${url.slice(ORIGIN.length)}`
  try {
    const r = await fetch(`${BASE}${path}`, { headers: { 'user-agent': UA } })
    await r.arrayBuffer()
    const cf = r.headers.get('cf-cache-status') ?? ''
    if (!r.ok) tally.failed++
    else if (cf === 'HIT' || cf === 'MISS') tally[cf]++
    else tally.other++
  } catch {
    tally.failed++
  }
  if ((i + 1) % 50 === 0) console.log(`  ${i + 1}/${photos.length}`)
  await new Promise((r) => setTimeout(r, 200))
}
console.log(`\nГотово: уже были в Cloudflare ${tally.HIT}, положил сейчас ${tally.MISS}, без кэша ${tally.other}, ошибок ${tally.failed}.`)
console.log('«без кэша» больше нуля — правило кэша в Cloudflare не включено (docs/LOAD_UZ.md).')
