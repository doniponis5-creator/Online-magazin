import { timingSafeEqual } from 'node:crypto'
import { KITCHEN_ID, thumbOf } from '@/lib/gallery/rules'
import { allKitchens, hideComment, hideKitchen, hidePhoto, type StoredComment, type StoredKitchen } from '@/lib/gallery/store'

/**
 * Страница «Галерея кухонь» — для владельца.
 *
 * Адрес: /panel/gallery?key=…  Ключ тот же, что у отзывов (ASSISTANT_LOG_KEY).
 * Ключа нет или он не тот — страницы нет (404).
 *
 * Кухни и комментарии видны на сайте сразу. Здесь владелец видит последние,
 * с жалобами — сверху, и прячет плохое одной кнопкой: кухня пропадает из
 * галереи и её картинки стираются; комментарий или фото пропадают со страницы.
 * Телефонов здесь нет — только имя, как на сайте.
 */
export const dynamic = 'force-dynamic'

const SHOW = 60

function allowed(given: unknown): given is string {
  const key = process.env.ASSISTANT_LOG_KEY
  if (!key || typeof given !== 'string') return false
  const a = Buffer.from(given)
  const b = Buffer.from(key)
  return a.length === b.length && timingSafeEqual(a, b)
}

const HTML = { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' }

export async function GET(request: Request) {
  const key = new URL(request.url).searchParams.get('key')
  if (!allowed(key)) return new Response('Not found', { status: 404 })
  return new Response(page(await allKitchens(), key), { headers: HTML })
}

/** Кнопки «Скрыть»: кухню, комментарий (comment) или фото (photo). После — обратно на страницу. */
export async function POST(request: Request) {
  const form = await request.formData().catch(() => null)
  const key = form?.get('key')
  if (!allowed(key)) return new Response('Not found', { status: 404 })
  const kitchen = form!.get('kitchen')
  const comment = form!.get('comment')
  const photo = form!.get('photo')
  if (typeof kitchen === 'string' && KITCHEN_ID.test(kitchen)) {
    if (typeof comment === 'string' && comment) await hideComment(kitchen, comment)
    else if (typeof photo === 'string' && photo) await hidePhoto(kitchen, photo)
    else await hideKitchen(kitchen)
  }
  // Адрес без домена: за nginx сайт видит себя как 0.0.0.0:3000.
  return new Response(null, { status: 303, headers: { Location: `/panel/gallery?key=${encodeURIComponent(key)}` } })
}

function esc(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** Время по Бишкеку: сервер живёт в UTC. */
const BISHKEK = new Intl.DateTimeFormat('ru-RU', {
  timeZone: 'Asia/Bishkek',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

function when(at: string): string {
  return BISHKEK.format(new Date(at)).replace(',', '')
}

function hideButton(key: string, fields: Record<string, string>, question: string): string {
  const inputs = Object.entries({ key, ...fields })
    .map(([name, value]) => `<input type="hidden" name="${name}" value="${esc(value)}">`)
    .join('')
  return `<form method="post" onsubmit="return confirm('${question}')">${inputs}<button type="submit">Скрыть</button></form>`
}

function rating(row: StoredKitchen): string {
  const stars = Object.values(row.ratings)
  if (!stars.length) return 'оценок нет'
  const avg = stars.reduce((s, x) => s + x, 0) / stars.length
  return `★ ${avg.toFixed(1).replace('.', ',')} (${stars.length})`
}

function kitchenCard(row: StoredKitchen, key: string): string {
  const author = `${esc(row.authorName || 'без имени')}${row.role === 'master' ? ' · мастер' : ''}`
  const photos = row.photos
    .map(
      (name) => `<div class="ph"><a href="/api/gallery/image/${esc(name)}" target="_blank"><img src="/api/gallery/image/${esc(thumbOf(name))}" alt=""></a>
        ${row.status === 'published' ? hideButton(key, { kitchen: row.id, photo: name }, 'Скрыть это фото?') : ''}</div>`,
    )
    .join('')
  const pic =
    row.status === 'published'
      ? `<a href="/ru/kitchen/gallery/${esc(row.id)}" target="_blank"><img class="pic" src="/api/gallery/image/${esc(row.thumb)}" alt=""></a>`
      : ''
  return `<article class="${row.status}${row.reports ? ' flagged' : ''}">
    ${pic}
    <div class="body">
      <b>${esc(row.title)}</b>
      <div class="meta">${when(row.createdAt)} · ${author} · ${rating(row)} · комментариев ${row.comments.length}${row.reports ? ` · <span class="rep">жалоб: ${row.reports}</span>` : ''}</div>
      ${photos ? `<div class="photos">${photos}</div>` : ''}
      ${row.status === 'published' ? hideButton(key, { kitchen: row.id }, 'Скрыть эту кухню? Картинки будут удалены.') : '<span class="state">Скрыта вами</span>'}
    </div>
  </article>`
}

function commentCard(row: StoredKitchen, c: StoredComment, key: string): string {
  return `<article class="${c.reports ? 'flagged' : ''}">
    <div class="body">
      <div class="meta">${when(c.at)} · ${esc(c.authorName || 'без имени')} · к кухне «${esc(row.title)}»${c.reports ? ` · <span class="rep">жалоб: ${c.reports}</span>` : ''}</div>
      <p>${esc(c.text).replace(/\n/g, '<br>')}</p>
      ${hideButton(key, { kitchen: row.id, comment: c.id }, 'Скрыть этот комментарий?')}
    </div>
  </article>`
}

function page(rows: StoredKitchen[], key: string): string {
  const shown = rows.filter((r) => r.status === 'published')
  const hidden = rows.filter((r) => r.status === 'hidden')
  // жалобы сверху, внутри — новые первыми (rows уже новые сверху)
  const kitchens = [...shown].sort((a, b) => (b.reports > 0 ? 1 : 0) - (a.reports > 0 ? 1 : 0)).slice(0, SHOW)
  const comments = shown
    .flatMap((row) => row.comments.filter((c) => c.status === 'published').map((c) => ({ row, c })))
    .sort((x, y) => (y.c.reports > 0 ? 1 : 0) - (x.c.reports > 0 ? 1 : 0) || Date.parse(y.c.at) - Date.parse(x.c.at))
    .slice(0, SHOW)
  const flagged = shown.filter((r) => r.reports > 0).length + comments.filter((x) => x.c.reports > 0).length
  return `<!doctype html>
<html lang="ru"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Галерея кухонь — Smart Centr</title>
<style>
  body { font: 16px/1.5 -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
         margin: 0; padding: 16px; color: #142334; background: #fff; max-width: 860px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  h2 { font-size: 17px; margin: 28px 0 8px; }
  .lead { color: #6b7a90; margin: 0 0 20px; font-size: 14px; }
  .cards { display: flex; gap: 10px; flex-wrap: wrap; }
  .card { background: #f1f5ff; border-radius: 14px; padding: 12px 16px; min-width: 120px; }
  .card b { display: block; font-size: 24px; }
  .card span { color: #6b7a90; font-size: 13px; }
  article { display: flex; gap: 14px; border: 1px solid #dfe6f2; border-radius: 14px; padding: 14px 16px; margin: 0 0 10px; }
  article.flagged { border-color: #e9c9c6; background: #fff8f7; }
  article.hidden { background: #f7f9fc; color: #6b7a90; }
  .pic { width: 160px; height: 100px; object-fit: cover; border-radius: 10px; display: block; }
  .body { flex: 1; min-width: 0; }
  .meta { font-size: 13px; color: #6b7a90; }
  .rep { color: #b3261e; font-weight: 600; }
  p { margin: 6px 0 0; overflow-wrap: anywhere; }
  .photos { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px; }
  .photos img { width: 72px; height: 72px; object-fit: cover; border-radius: 8px; display: block; }
  form { margin-top: 8px; }
  button { font: inherit; font-size: 14px; padding: 6px 14px; border-radius: 10px; border: 1px solid #e9c9c6; background: #fff; color: #b3261e; cursor: pointer; }
  .state { display: inline-block; margin-top: 8px; font-size: 13px; }
  .empty { color: #6b7a90; }
  @media (max-width: 520px) { article { flex-direction: column; } .pic { width: 100%; height: auto; aspect-ratio: 16/10; } }
</style>
</head><body>
<h1>Галерея кухонь</h1>
<p class="lead">Кухню ставит в галерею вошедший покупатель или мастер — на сайте она видна сразу. Жалобы поднимают запись наверх, но сами ничего не скрывают. Плохое — кнопка «Скрыть».</p>

<div class="cards">
  <div class="card"><b>${shown.length}</b><span>на сайте</span></div>
  <div class="card"><b>${flagged}</b><span>с жалобами</span></div>
  <div class="card"><b>${hidden.length}</b><span>скрыто вами</span></div>
</div>

<h2>Кухни</h2>
${kitchens.length ? kitchens.map((r) => kitchenCard(r, key)).join('') : '<p class="empty">Пока ни одной кухни.</p>'}

<h2>Комментарии</h2>
${comments.length ? comments.map(({ row, c }) => commentCard(row, c, key)).join('') : '<p class="empty">Пока ни одного комментария.</p>'}

${hidden.length ? `<h2>Скрытые</h2>${hidden.slice(0, 20).map((r) => kitchenCard(r, key)).join('')}` : ''}
</body></html>`
}
