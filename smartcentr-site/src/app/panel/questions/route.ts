import { readRows, summarize, type LogRow } from '@/lib/assistant/log'

/**
 * Страница «О чём спрашивают» — для владельца.
 *
 * Открывается по адресу с ключом: /panel/questions?key=…  Ключ владелец
 * вписывает сам в ASSISTANT_LOG_KEY. Ключа в настройках нет — страницы нет
 * вовсе (404), чтобы случайно не открыть её всему интернету.
 *
 * Отдаём готовую страницу, а не данные: её открывают с телефона и смотрят
 * глазами, а не разбирают программой.
 */
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const key = process.env.ASSISTANT_LOG_KEY
  const given = new URL(request.url).searchParams.get('key') ?? ''
  if (!key || given !== key) {
    return new Response('Not found', { status: 404 })
  }

  const rows = await readRows()
  const sum = summarize(rows)

  return new Response(page(sum), {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  })
}

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function when(at: string): string {
  return `${at.slice(8, 10)}.${at.slice(5, 7)} ${at.slice(11, 16)}`
}

function rowsTable(list: LogRow[]): string {
  if (list.length === 0) return '<p class="empty">Пока пусто.</p>'
  return `<table>
    <tr><th>Когда</th><th>Вопрос</th><th>Ответ</th></tr>
    ${list
      .map(
        (r) => `<tr class="${r.found ? '' : 'miss'}">
      <td class="when">${when(r.at)}</td>
      <td>${esc(r.q)}</td>
      <td class="answer">${esc(r.a)}</td>
    </tr>`,
      )
      .join('')}
  </table>`
}

function page(sum: ReturnType<typeof summarize>): string {
  return `<!doctype html>
<html lang="ru"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>О чём спрашивают — Smart Centr</title>
<style>
  body { font: 16px/1.5 -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
         margin: 0; padding: 16px; color: #142334; background: #fff; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  h2 { font-size: 17px; margin: 28px 0 8px; }
  .lead { color: #6b7a90; margin: 0 0 20px; font-size: 14px; }
  .cards { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 8px; }
  .card { background: #f1f5ff; border-radius: 14px; padding: 12px 16px; min-width: 120px; }
  .card b { display: block; font-size: 24px; }
  .card span { color: #6b7a90; font-size: 13px; }
  table { border-collapse: collapse; width: 100%; font-size: 14px; }
  th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #dfe6f2; vertical-align: top; }
  th { color: #6b7a90; font-weight: 600; font-size: 13px; }
  .when { white-space: nowrap; color: #6b7a90; }
  .answer { color: #46566b; }
  tr.miss td { background: #fff6f5; }
  .empty { color: #6b7a90; }
  .bar { display: inline-block; height: 10px; background: #245beb; border-radius: 5px; vertical-align: middle; }
</style>
</head><body>
<h1>О чём спрашивают в чате</h1>
<p class="lead">Имена, телефоны и номера заказов сюда не попадают. Розовым — вопросы, на которые товар не нашёлся.</p>

<div class="cards">
  <div class="card"><b>${sum.total}</b><span>всего вопросов</span></div>
  <div class="card"><b>${sum.notFound}</b><span>без товара в ответе</span></div>
</div>

<h2>По дням</h2>
${
  sum.byDay.length === 0
    ? '<p class="empty">Пока пусто.</p>'
    : `<table>${sum.byDay
        .map(
          (d) =>
            `<tr><td class="when">${d.day.slice(8, 10)}.${d.day.slice(5, 7)}</td><td><span class="bar" style="width:${Math.min(
              240,
              d.count * 12,
            )}px"></span> ${d.count}</td></tr>`,
        )
        .join('')}</table>`
}

<h2>Спрашивают чаще всего</h2>
${
  sum.top.length === 0
    ? '<p class="empty">Пока ни один вопрос не повторился.</p>'
    : `<table>${sum.top.map((t) => `<tr><td>${esc(t.q)}</td><td class="when">${t.count}</td></tr>`).join('')}</table>`
}

<h2>Товар не нашёлся — стоит посмотреть</h2>
${rowsTable(sum.misses)}

<h2>Последние вопросы</h2>
${rowsTable(sum.latest)}
</body></html>`
}
