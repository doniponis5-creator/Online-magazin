import { DRAWING_CSS } from './drawing'

/**
 * Лист для мастера: картинка кухни, развёртки стен и таблицы. Открывается
 * отдельной страницей — её можно распечатать или сохранить в PDF
 * (в меню печати: «Сохранить как PDF»). Всё, что внутри, — наши же числа.
 */

export type SheetTable = { title: string; head: string[]; rows: (string | number)[][]; note?: string }

export type SheetData = {
  lang: string
  title: string
  subtitle: string
  date: string
  url: string
  image: string | null
  facts: { label: string; value: string }[]
  walls: { title: string; svg: string }[]
  tables: SheetTable[]
  note: string
  printLabel: string
  wallsTitle: string
}

const esc = (s: string | number) =>
  String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string)

export function sheetHtml(d: SheetData): string {
  const facts = d.facts.map((f) => `<div class="fact"><span>${esc(f.label)}</span><b>${esc(f.value)}</b></div>`).join('')
  const walls = d.walls.map((w) => `<figure class="wall"><figcaption>${esc(w.title)}</figcaption>${w.svg}</figure>`).join('')
  const tables = d.tables
    .filter((t) => t.rows.length)
    .map(
      (t) => `<section class="tbl"><h2>${esc(t.title)}</h2><table><thead><tr>${t.head.map((h, i) => `<th${i ? ' class="num"' : ''}>${esc(h)}</th>`).join('')}</tr></thead><tbody>${t.rows
        .map((r) => `<tr>${r.map((c, i) => `<td${i ? ' class="num"' : ''}>${esc(c)}</td>`).join('')}</tr>`)
        .join('')}</tbody></table>${t.note ? `<p class="note">${esc(t.note)}</p>` : ''}</section>`,
    )
    .join('')
  return `<!doctype html>
<html lang="${esc(d.lang)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(d.title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Manrope:wght@500;650;700;800&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box}
body{margin:0;background:#eef0f3;color:#263244;font:500 13px/1.45 Manrope,system-ui,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.page{max-width:1000px;margin:0 auto;padding:28px 32px 48px;background:#fff}
.bar{position:sticky;top:0;z-index:2;display:flex;justify-content:flex-end;gap:8px;padding:10px 16px;background:rgba(238,240,243,.92);backdrop-filter:blur(6px)}
.bar button{height:44px;padding:0 20px;border:0;border-radius:12px;background:#eaf500;color:#263244;font:800 14px Manrope,system-ui,sans-serif;cursor:pointer}
header{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;padding-bottom:14px;border-bottom:2px solid #263244}
.brand{font-weight:800;font-size:13px;letter-spacing:.02em}
.brand i{display:inline-block;width:10px;height:10px;margin-right:6px;border-radius:3px;background:#eaf500;box-shadow:inset 0 0 0 1px #c9d200}
h1{margin:6px 0 2px;font-size:24px;line-height:1.2;letter-spacing:-.02em}
.sub{margin:0;color:#5b6778;font-size:13px}
.meta{text-align:right;font-size:12px;color:#5b6778}
.meta a{color:#2563eb;word-break:break-all}
.facts{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:16px 0}
.fact{padding:9px 11px;border:1px solid #dfe4ea;border-radius:10px}
.fact span{display:block;font-size:11px;color:#5b6778}
.fact b{font-size:14px;font-weight:800}
.shot{display:block;width:100%;border-radius:12px;margin:4px 0 18px}
h2{margin:22px 0 8px;font-size:16px;letter-spacing:-.01em}
.walls{display:grid;gap:14px}
.wall{margin:0;padding:12px 12px 6px;border:1px solid #dfe4ea;border-radius:12px;break-inside:avoid}
.wall figcaption{font-weight:800;font-size:14px;margin-bottom:6px}
table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}
th,td{padding:6px 8px;border-bottom:1px solid #e6eaef;text-align:left}
th{font-size:11px;font-weight:700;color:#5b6778;text-transform:uppercase;letter-spacing:.03em}
.num{text-align:right;white-space:nowrap}
.tbl{break-inside:avoid}
.note{margin:6px 0 0;font-size:12px;color:#5b6778}
footer{margin-top:24px;padding-top:12px;border-top:1px solid #dfe4ea;font-size:12px;color:#5b6778}
@media (max-width:640px){.page{padding:18px 14px 32px}.facts{grid-template-columns:1fr 1fr}header{flex-direction:column}.meta{text-align:left}}
@media print{body{background:#fff}.bar{display:none}.page{padding:0;max-width:none}@page{size:A4;margin:12mm}}
${DRAWING_CSS}
</style></head><body>
<div class="bar"><button type="button" onclick="window.print()">${esc(d.printLabel)}</button></div>
<main class="page">
<header><div><div class="brand"><i></i>Smart Centr · smarket.kg</div><h1>${esc(d.title)}</h1><p class="sub">${esc(d.subtitle)}</p></div>
<div class="meta">${esc(d.date)}<br><a href="${esc(d.url)}">${esc(d.url)}</a></div></header>
<div class="facts">${facts}</div>
${d.image ? `<img class="shot" src="${d.image}" alt="">` : ''}
<h2>${esc(d.wallsTitle)}</h2>
<div class="walls">${walls}</div>
${tables}
<footer>${esc(d.note)}</footer>
</main></body></html>`
}
