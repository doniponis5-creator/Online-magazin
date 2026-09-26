import { thumbOf } from '@/lib/reviews/rules'
import { allReviews, hideReview, type StoredReview } from '@/lib/reviews/store'

/**
 * Страница «Отзывы» — для владельца.
 *
 * Адрес: /panel/reviews?key=…  Ключ тот же, что у «О чём спрашивают»
 * (ASSISTANT_LOG_KEY). Ключа нет — страницы нет (404).
 *
 * Отзывы появляются на сайте сразу, без проверки. Здесь владелец видит
 * каждый отзыв с номером заказа и может скрыть плохой одной кнопкой: отзыв
 * исчезает с главной, его фото стираются с диска.
 */
export const dynamic = 'force-dynamic'

function allowed(given: string | null): boolean {
  const key = process.env.ASSISTANT_LOG_KEY
  return Boolean(key) && given === key
}

export async function GET(request: Request) {
  const key = new URL(request.url).searchParams.get('key')
  if (!allowed(key)) return new Response('Not found', { status: 404 })
  const rows = await allReviews()
  return new Response(page(rows, key!), {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  })
}

/** Кнопка «Скрыть». После неё — обратно на страницу. */
export async function POST(request: Request) {
  const form = await request.formData().catch(() => null)
  const key = typeof form?.get('key') === 'string' ? (form!.get('key') as string) : null
  if (!allowed(key)) return new Response('Not found', { status: 404 })
  const id = form!.get('id')
  if (typeof id === 'string' && /^[a-f0-9]{16}$/.test(id)) await hideReview(id)
  // Адрес без домена: за nginx сайт видит себя как 0.0.0.0:3000.
  return new Response(null, { status: 303, headers: { Location: `/panel/reviews?key=${encodeURIComponent(key!)}` } })
}

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function when(at: string): string {
  const d = new Date(at)
  const two = (n: number) => String(n).padStart(2, '0')
  return `${two(d.getDate())}.${two(d.getMonth() + 1)}.${d.getFullYear()}`
}

function card(row: StoredReview, key: string): string {
  const stars = '★'.repeat(row.rating) + '☆'.repeat(5 - row.rating)
  const photos = row.photos
    .map((name) => `<a href="/api/reviews/photo/${esc(name)}" target="_blank"><img src="/api/reviews/photo/${esc(thumbOf(name))}" alt=""></a>`)
    .join('')
  const hide =
    row.status === 'published'
      ? `<form method="post" onsubmit="return confirm('Скрыть этот отзыв? Фото будут удалены.')">
          <input type="hidden" name="key" value="${esc(key)}">
          <input type="hidden" name="id" value="${esc(row.id)}">
          <button type="submit">Скрыть</button>
        </form>`
      : `<span class="state">${row.status === 'hidden' ? 'Скрыт вами' : 'Вытеснен новыми'}</span>`
  return `<article class="${row.status}">
    <div class="top"><b class="stars">${stars}</b><span>${when(row.createdAt)} · ${esc(row.name)} · заказ ${esc(row.orderId)}</span></div>
    <p>${esc(row.text).replace(/\n/g, '<br>')}</p>
    ${row.products.length ? `<p class="bought">Купил: ${esc(row.products.join(', '))}</p>` : ''}
    ${photos ? `<div class="photos">${photos}</div>` : ''}
    ${hide}
  </article>`
}

function page(rows: StoredReview[], key: string): string {
  const shown = rows.filter((r) => r.status === 'published')
  const hidden = rows.filter((r) => r.status === 'hidden')
  const archived = rows.filter((r) => r.status === 'archived').slice(0, 20)
  const average = shown.length ? (shown.reduce((s, r) => s + r.rating, 0) / shown.length).toFixed(1).replace('.', ',') : '—'
  return `<!doctype html>
<html lang="ru"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Отзывы — Smart Centr</title>
<style>
  body { font: 16px/1.5 -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
         margin: 0; padding: 16px; color: #142334; background: #fff; max-width: 820px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  h2 { font-size: 17px; margin: 28px 0 8px; }
  .lead { color: #6b7a90; margin: 0 0 20px; font-size: 14px; }
  .cards { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 8px; }
  .card { background: #f1f5ff; border-radius: 14px; padding: 12px 16px; min-width: 120px; }
  .card b { display: block; font-size: 24px; }
  .card span { color: #6b7a90; font-size: 13px; }
  article { border: 1px solid #dfe6f2; border-radius: 14px; padding: 14px 16px; margin: 0 0 10px; }
  article.hidden, article.archived { background: #f7f9fc; color: #6b7a90; }
  .top { display: flex; flex-wrap: wrap; gap: 4px 12px; align-items: baseline; font-size: 13px; color: #6b7a90; }
  .stars { color: #142334; font-size: 16px; letter-spacing: 1px; }
  p { margin: 8px 0 0; }
  .bought { font-size: 13px; color: #6b7a90; }
  .photos { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px; }
  .photos img { width: 84px; height: 84px; object-fit: cover; border-radius: 10px; display: block; }
  form { margin-top: 10px; }
  button { font: inherit; font-size: 14px; padding: 8px 16px; border-radius: 10px; border: 1px solid #e9c9c6; background: #fff; color: #b3261e; cursor: pointer; }
  .state { display: inline-block; margin-top: 10px; font-size: 13px; }
  .empty { color: #6b7a90; }
</style>
</head><body>
<h1>Отзывы покупателей</h1>
<p class="lead">Отзыв пишет только тот, кто купил на сайте, — по одному на заказ. На сайте сразу виден, без проверки. На главной — ${shown.length} из 20 последних: новый вытесняет самый старый. Плохой отзыв — кнопка «Скрыть».</p>

<div class="cards">
  <div class="card"><b>${shown.length}</b><span>на сайте</span></div>
  <div class="card"><b>${average}</b><span>средняя оценка</span></div>
  <div class="card"><b>${hidden.length}</b><span>скрыто вами</span></div>
</div>

<h2>На сайте</h2>
${shown.length ? shown.map((r) => card(r, key)).join('') : '<p class="empty">Пока ни одного отзыва.</p>'}

${hidden.length ? `<h2>Скрытые</h2>${hidden.map((r) => card(r, key)).join('')}` : ''}
${archived.length ? `<h2>Вытеснены новыми</h2>${archived.map((r) => card(r, key)).join('')}` : ''}
</body></html>`
}
