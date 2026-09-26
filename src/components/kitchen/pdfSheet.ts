import { DRAWING_CSS, paperSize, printedScale } from './drawing'
import { A4, buildPdf, type PdfLink, type PdfPage } from './pdfFile'

/**
 * Лист для мастера файлом PDF: картинка кухни, развёртки стен, что где стоит
 * и таблицы. Страницы рисуются на холсте браузера (canvas) и складываются
 * в PDF картинками — так файл делается прямо в телефоне, без печати и без
 * сервера, и его можно сразу отправить в WhatsApp или Telegram.
 * Всё, что внутри, — наши же числа из спецификации.
 */

export type SheetTable = {
  title: string
  head: string[]
  rows: (string | number)[][]
  note?: string
  /** колонка, которая забирает остальную ширину и переносит слова (обычно первая) */
  grow?: number
}

export type SheetData = {
  title: string
  subtitle: string
  date: string
  /** ссылка на эту же кухню в 3D */
  url: string
  urlLabel: string
  /** картинка кухни, data: URL */
  image: string | null
  facts: { label: string; value: string }[]
  wallsTitle: string
  walls: { title: string; svg: string }[]
  /** общий масштаб развёрток 1:N (pickScale); подпись «М 1:N» — только если лист не ужал рисунки */
  wallsScale?: number
  /** подпись масштаба: n → «М 1:n» */
  scaleLabel: (n: number) => string
  list?: { title: string; text: string }
  /** план сверху: заголовок, SVG из planSvg и его масштаб 1:N */
  plan?: { title: string; svg: string; scale?: number }
  tables: SheetTable[]
  /** кому звонить по проекту: строка с телефоном магазина и ссылка WhatsApp */
  contacts: { text: string; url: string }
  note: string
  page: (n: number, total: number) => string
}

/** Лист A4 при 150 точках на дюйм: мелкие цифры чертежа читаются и на телефоне, и на бумаге. */
const PX = 1240
const PY = Math.round((PX * A4.h) / A4.w)
/** точек на миллиметр бумаги */
const PX_MM = PX / 210
/** поля ≈ 12 мм */
const M = 70
const CW = PX - 2 * M
/** снизу место под номер страницы */
const BOTTOM = PY - M - 40
const FONT = 'Manrope, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
const INK = '#263244'
const MUTED = '#5b6778'
const LINE = '#dfe4ea'
const RULE = '#e6eaef'
const LEMON = '#eaf500'
const BLUE = '#2563eb'

export async function sheetPdf(d: SheetData): Promise<Blob> {
  await fontsReady()
  const s = new Sheet()
  s.page()
  s.header(d)
  s.facts(d.facts)
  if (d.image) await s.picture(d.image, d.url)
  // короткий список — сразу под картинкой: мастер видит всю кухню на первом листе
  if (d.list) s.list(d.list.title, d.list.text)
  if (d.plan) s.plan(d.plan.title, d.plan.svg, d.plan.scale, d.scaleLabel)
  s.walls(d.wallsTitle, d.walls, d.wallsScale, d.scaleLabel)
  for (const tb of d.tables) s.table(tb)
  s.note(d.note)
  s.footers(d)

  const pages: PdfPage[] = []
  for (let i = 0; i < s.canvases.length; i++) {
    const c = s.canvases[i]
    const blob = await jpeg(c)
    pages.push({ jpeg: new Uint8Array(await blob.arrayBuffer()), width: PX, height: PY, links: s.links[i] })
    // память телефона: холст больше не нужен
    c.width = 0
    c.height = 0
  }
  return buildPdf(pages, d.title)
}

class Sheet {
  canvases: HTMLCanvasElement[] = []
  links: PdfLink[][] = []
  ctx!: CanvasRenderingContext2D
  y = M
  /** шрифт переносим на новый лист: у нового холста он свой, по умолчанию мелкий */
  curFont = `500 20px ${FONT}`

  page() {
    const c = document.createElement('canvas')
    c.width = PX
    c.height = PY
    const ctx = c.getContext('2d')
    if (!ctx) throw new Error('canvas')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, PX, PY)
    ctx.font = this.curFont
    this.canvases.push(c)
    this.links.push([])
    this.ctx = ctx
    this.y = M
  }

  /** Не влезает до низа листа — переходим на новый. */
  room(h: number) {
    if (this.y + h > BOTTOM && this.y > M) this.page()
  }

  font(size: number, weight = 500) {
    this.curFont = `${weight} ${size}px ${FONT}`
    this.ctx.font = this.curFont
  }

  write(s: string, x: number, y: number, color = INK, align: CanvasTextAlign = 'left') {
    const ctx = this.ctx
    ctx.fillStyle = color
    ctx.textAlign = align
    ctx.textBaseline = 'alphabetic'
    fillText(ctx, s, x, y)
  }

  link(x: number, y: number, w: number, h: number, url: string) {
    this.links[this.links.length - 1].push({ x: x / PX, y: y / PY, w: w / PX, h: h / PY, url })
  }

  header(d: SheetData) {
    const ctx = this.ctx
    // бренд слева, дата справа
    ctx.fillStyle = LEMON
    box(ctx, M, this.y, 22, 22, 6)
    ctx.fill()
    ctx.strokeStyle = '#c9d200'
    ctx.lineWidth = 1.5
    ctx.stroke()
    this.font(20, 800)
    this.write('Smart Centr · smarket.kg', M + 34, this.y + 19)
    this.font(19)
    this.write(d.date, PX - M, this.y + 19, MUTED, 'right')
    this.y += 66
    this.font(40, 800)
    for (const line of wrap(ctx, d.title, CW)) {
      this.write(line, M, this.y)
      this.y += 50
    }
    this.font(22)
    for (const line of wrap(ctx, d.subtitle, CW)) {
      this.write(line, M, this.y - 8, MUTED)
      this.y += 30
    }
    // ссылка на эту же кухню в 3D — нажимается прямо в PDF
    this.font(21, 700)
    // стрелку «↗» рисуем линиями: в Manrope её нет, чужой шрифт выглядит заплаткой
    const w = ctx.measureText(d.urlLabel).width
    this.write(d.urlLabel, M, this.y + 6, BLUE)
    ctx.fillStyle = BLUE
    ctx.fillRect(M, this.y + 11, w, 2)
    arrow(ctx, M + w + 8, this.y + 4, 13)
    this.link(M - 6, this.y - 20, w + 34, 40, d.url)
    this.y += 34
    ctx.fillStyle = INK
    ctx.fillRect(M, this.y, CW, 3)
    this.y += 24
  }

  facts(list: { label: string; value: string }[]) {
    const cols = 3
    const gap = 12
    const cw = (CW - gap * (cols - 1)) / cols
    for (let i = 0; i < list.length; i += cols) {
      const row = list.slice(i, i + cols).map((f) => {
        this.font(17)
        const label = wrap(this.ctx, f.label, cw - 28)
        this.font(22, 800)
        const value = wrap(this.ctx, f.value, cw - 28)
        return { label, value }
      })
      const h = Math.max(...row.map((c) => 16 + c.label.length * 22 + 6 + c.value.length * 29 + 12))
      this.room(h)
      const ctx = this.ctx
      row.forEach((c, j) => {
        const x = M + j * (cw + gap)
        ctx.strokeStyle = LINE
        ctx.lineWidth = 1.5
        box(ctx, x, this.y, cw, h, 12)
        ctx.stroke()
        let y = this.y + 16
        this.font(17)
        for (const l of c.label) {
          this.write(l, x + 14, y + 16, MUTED)
          y += 22
        }
        y += 6
        this.font(22, 800)
        for (const l of c.value) {
          this.write(l, x + 14, y + 22)
          y += 29
        }
      })
      this.y += h + gap
    }
    this.y += 10
  }

  async picture(src: string, url: string) {
    const img = await loadImage(src)
    if (!img || !img.width) return
    const h = (CW * img.height) / img.width
    this.room(h)
    const ctx = this.ctx
    ctx.save()
    box(ctx, M, this.y, CW, h, 16)
    ctx.clip()
    ctx.drawImage(img, M, this.y, CW, h)
    ctx.restore()
    // нажали на картинку в PDF — открывается эта кухня в 3D
    this.link(M, this.y, CW, h, url)
    this.y += h + 30
  }

  /** Заголовок раздела; next — сколько места нужно сразу под ним, чтобы он не остался один внизу листа. */
  heading(title: string, next = 120) {
    const ctx = this.ctx
    this.font(26, 800)
    const lines = wrap(ctx, title, CW)
    this.room(lines.length * 34 + 12 + next)
    for (const line of lines) {
      this.write(line, M, this.y + 24)
      this.y += 34
    }
    this.y += 12
  }

  walls(title: string, walls: { title: string; svg: string }[], scale: number | undefined, label: (n: number) => string) {
    const pad = 16
    const cap = 40
    // две стены на лист: иначе каждая шла на свой лист и полстраницы пустовало
    const maxH = 660
    // общий масштаб листа: все стены 1:N, шкаф одного размера на всех. Не влезает
    // хоть одна — ужимаем все одинаково, а «М 1:N» не пишем: он был бы неправдой.
    const room = { w: (CW - 2 * pad) / PX_MM, h: maxH / PX_MM }
    const honest = scale ? printedScale(walls.map((w) => w.svg), scale, room) : null
    const k = scale ? Math.min(1, ...walls.map((w) => Math.min(room.w / paperSize(w.svg, scale).w, room.h / paperSize(w.svg, scale).h))) : 1
    const sized = walls.map((w) => {
      const vb = viewBox(w.svg)
      const aspect = vb[3] / vb[2]
      if (scale) {
        const dw = paperSize(w.svg, scale).w * PX_MM * k
        const dh = dw * aspect
        return { ...w, dw, dh, h: cap + dh + 2 * pad }
      }
      let dw = CW - 2 * pad
      let dh = dw * aspect
      if (dh > maxH) {
        dh = maxH
        dw = dh / aspect
      }
      return { ...w, dw, dh, h: cap + dh + 2 * pad }
    })
    if (!sized.length) return
    this.heading(honest ? `${title} · ${label(honest)}` : title, sized[0].h)
    for (const w of sized) {
      // после room() холст мог смениться на новый лист — берём текущий
      this.room(w.h)
      const ctx = this.ctx
      ctx.strokeStyle = LINE
      ctx.lineWidth = 1.5
      box(ctx, M, this.y, CW, w.h, 14)
      ctx.stroke()
      this.font(22, 800)
      this.write(w.title, M + pad, this.y + pad + 22)
      drawSvg(ctx, w.svg, M + (CW - w.dw) / 2, this.y + pad + cap, w.dw, w.dh)
      this.y += w.h + 14
    }
    this.y += 16
  }

  /** План сверху на своём листе, в масштабе из SVG. */
  plan(title: string, svg: string, scale: number | undefined, label: (n: number) => string) {
    const vb = viewBox(svg)
    let dw = scale ? paperSize(svg, scale).w * PX_MM : CW
    let dh = (dw * vb[3]) / vb[2]
    const maxH = BOTTOM - M - 60
    // ужали, чтобы влез, — масштаб уже не 1:N, и подписи нет
    const honest = scale ? printedScale([svg], scale, { w: CW / PX_MM, h: maxH / PX_MM }) : null
    if (dw > CW || dh > maxH) {
      const k = Math.min(CW / dw, maxH / dh)
      dw *= k
      dh *= k
    }
    this.heading(honest ? `${title} · ${label(honest)}` : title, dh + 20)
    drawSvg(this.ctx, svg, M + (CW - dw) / 2, this.y, dw, dh)
    this.y += dh + 30
  }

  list(title: string, text: string) {
    this.heading(title, 120)
    const ctx = this.ctx
    for (const raw of text.split('\n')) {
      if (!raw.trim()) {
        this.y += 12
        continue
      }
      const indent = raw.startsWith('  ') ? 30 : 0
      this.font(20, indent ? 500 : 800)
      for (const line of wrap(ctx, raw.trim(), CW - indent)) {
        this.room(30)
        this.font(20, indent ? 500 : 800)
        this.write(line, M + indent, this.y + 22)
        this.y += 30
      }
    }
    this.y += 24
  }

  table(tb: SheetTable) {
    if (!tb.rows.length) return
    const ctx = this.ctx
    const grow = tb.grow ?? 0
    const padX = 12
    const headSize = 16
    const cellSize = 19
    const lineH = 26
    // ширины: у обычных колонок — по самому длинному тексту, остальное — растущей
    const widths = tb.head.map((h, i) => {
      if (i === grow) return 0
      this.font(headSize, 700)
      let w = ctx.measureText(h.toUpperCase()).width
      this.font(cellSize)
      for (const r of tb.rows) w = Math.max(w, ctx.measureText(String(r[i] ?? '')).width)
      return Math.ceil(w) + 2 * padX
    })
    widths[grow] = Math.max(160, CW - widths.reduce((a, b) => a + b, 0))
    const xs = widths.map((_, i) => M + widths.slice(0, i).reduce((a, b) => a + b, 0))
    const right = (i: number) => i !== grow && i !== 0
    const cellLines = (r: (string | number)[]) => {
      this.font(cellSize)
      return r.map((c, i) => (i === grow ? wrap(ctx, String(c), widths[i] - 2 * padX) : [String(c)]))
    }
    const rows = tb.rows.map(cellLines)
    const rowH = (lines: string[][]) => Math.max(...lines.map((l) => l.length)) * lineH + 14
    const headH = 40

    const drawHead = () => {
      const c = this.ctx
      this.font(headSize, 700)
      tb.head.forEach((h, i) => {
        const text = h.toUpperCase()
        if (right(i)) this.write(text, xs[i] + widths[i] - padX, this.y + 26, MUTED, 'right')
        else this.write(text, xs[i] + padX, this.y + 26, MUTED)
      })
      c.fillStyle = LINE
      c.fillRect(M, this.y + headH - 2, CW, 2)
      this.y += headH
    }

    this.heading(tb.title, headH + rowH(rows[0]))
    drawHead()
    for (const lines of rows) {
      const h = rowH(lines)
      if (this.y + h > BOTTOM) {
        this.page()
        drawHead()
      }
      this.font(cellSize)
      lines.forEach((cell, i) => {
        cell.forEach((l, k) => {
          const y = this.y + 7 + lineH * k + 19
          if (right(i)) this.write(l, xs[i] + widths[i] - padX, y, INK, 'right')
          else this.write(l, xs[i] + padX, y, INK)
        })
      })
      this.ctx.fillStyle = RULE
      this.ctx.fillRect(M, this.y + h - 1, CW, 1)
      this.y += h
    }
    if (tb.note) {
      this.font(18)
      for (const l of wrap(this.ctx, tb.note, CW)) {
        this.room(26)
        this.font(18)
        this.write(l, M, this.y + 24, MUTED)
        this.y += 26
      }
    }
    this.y += 28
  }

  note(text: string) {
    this.font(18)
    const lines = wrap(this.ctx, text, CW)
    this.room(lines.length * 26 + 20)
    this.ctx.fillStyle = LINE
    this.ctx.fillRect(M, this.y, CW, 1.5)
    this.y += 12
    for (const l of lines) {
      this.write(l, M, this.y + 20, MUTED)
      this.y += 26
    }
  }

  footers(d: SheetData) {
    const total = this.canvases.length
    this.canvases.forEach((c, i) => {
      const ctx = c.getContext('2d')
      if (!ctx) return
      this.ctx = ctx
      this.font(16)
      this.write(`Smart Centr · smarket.kg · ${d.date}`, M, PY - M + 14, MUTED)
      this.write(d.page(i + 1, total), PX - M, PY - M + 14, MUTED, 'right')
      // телефон и WhatsApp магазина — нажимается прямо в PDF
      this.font(16, 700)
      const w = this.ctx.measureText(d.contacts.text).width
      this.write(d.contacts.text, M, PY - M + 38, INK)
      this.link(M - 4, PY - M + 20, w + 8, 26, d.contacts.url)
    })
  }
}

/* ───────── чертёж стены: SVG рисуем на холсте сами ───────── */

/*
  Чертёж приходит строкой SVG (тот же, что на странице). Картинкой его в холст
  не кладём: Safari на iPhone такой холст иногда не отдаёт в файл, а шрифт
  внутри SVG-картинки не грузится. Поэтому разбираем SVG и рисуем линии,
  рамки и цифры сами — стили берём из тех же DRAWING_CSS.
*/

type Rule = { cls: string; props: Record<string, string> }
const RULES: Rule[] = [...DRAWING_CSS.matchAll(/\.([\w-]+)\{([^}]*)\}/g)].map(([, cls, body]) => ({
  cls,
  props: Object.fromEntries(
    body
      .split(';')
      .filter((p) => p.includes(':'))
      .map((p) => {
        const i = p.indexOf(':')
        return [p.slice(0, i).trim(), p.slice(i + 1).trim()]
      }),
  ),
}))

function viewBox(svg: string): [number, number, number, number] {
  const m = /viewBox="([^"]+)"/.exec(svg)
  const v = (m?.[1] ?? '0 0 100 50').split(/[\s,]+/).map(Number)
  return [v[0] || 0, v[1] || 0, v[2] || 100, v[3] || 50]
}

export function drawSvg(ctx: CanvasRenderingContext2D, svg: string, x: number, y: number, w: number, h: number) {
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml')
  const root = doc.documentElement
  if (root.nodeName !== 'svg') return
  const [vx, vy, vw] = viewBox(svg)
  const fs = parseFloat(/--el-fs:\s*([\d.]+)/.exec(root.getAttribute('style') ?? '')?.[1] ?? '10')
  const k = w / vw
  ctx.save()
  ctx.beginPath()
  ctx.rect(x, y, w, h)
  ctx.clip()
  ctx.translate(x - vx * k, y - vy * k)
  ctx.scale(k, k)
  for (const el of Array.from(root.children)) drawElement(ctx, el, fs)
  ctx.restore()
}

function drawElement(ctx: CanvasRenderingContext2D, el: Element, fs: number) {
  const classes = (el.getAttribute('class') ?? '').split(/\s+/)
  const st: Record<string, string> = {}
  for (const r of RULES) if (classes.includes(r.cls)) Object.assign(st, r.props)
  const size = (v: string | undefined, dflt: number) => (!v ? dflt : v.startsWith('var(') ? fs : parseFloat(v) || dflt)
  const a = (name: string) => parseFloat(el.getAttribute(name) ?? '0') || 0
  // как в SVG: заливка по умолчанию чёрная, обводки нет
  const fill = st.fill === 'none' ? null : (st.fill ?? '#000')
  const stroke = st.stroke && st.stroke !== 'none' ? st.stroke : null
  ctx.lineWidth = size(st['stroke-width'], 1)
  ctx.setLineDash(st['stroke-dasharray'] ? st['stroke-dasharray'].split(/[\s,]+/).map(Number) : [])
  ctx.lineCap = st['stroke-linecap'] === 'round' ? 'round' : 'butt'
  ctx.lineJoin = 'miter'
  switch (el.nodeName) {
    case 'rect': {
      const [x, y, w, h] = [a('x'), a('y'), a('width'), a('height')]
      if (fill) {
        ctx.fillStyle = fill
        ctx.fillRect(x, y, w, h)
      }
      if (stroke) {
        ctx.strokeStyle = stroke
        ctx.strokeRect(x, y, w, h)
      }
      return
    }
    case 'line': {
      if (!stroke) return
      ctx.strokeStyle = stroke
      ctx.beginPath()
      ctx.moveTo(a('x1'), a('y1'))
      ctx.lineTo(a('x2'), a('y2'))
      ctx.stroke()
      return
    }
    case 'path': {
      ctx.beginPath()
      for (const [, cmd, px, py] of (el.getAttribute('d') ?? '').matchAll(/([MLml])\s*(-?[\d.]+)[\s,]+(-?[\d.]+)/g)) {
        if (cmd === 'M' || cmd === 'm') ctx.moveTo(+px, +py)
        else ctx.lineTo(+px, +py)
      }
      if (fill) {
        ctx.fillStyle = fill
        ctx.fill()
      }
      if (stroke) {
        ctx.strokeStyle = stroke
        ctx.stroke()
      }
      return
    }
    case 'text': {
      const weight = Math.round((parseFloat(st['font-weight'] ?? '400') || 400) / 100) * 100
      const own = /font-size:\s*([\d.]+)px/.exec(el.getAttribute('style') ?? '')
      ctx.font = `${weight} ${own ? parseFloat(own[1]) : size(st['font-size'], fs)}px ${FONT}`
      const anchor = el.getAttribute('text-anchor')
      ctx.textAlign = anchor === 'middle' ? 'center' : anchor === 'end' ? 'right' : 'left'
      ctx.textBaseline = el.getAttribute('dominant-baseline') === 'central' ? 'middle' : 'alphabetic'
      ctx.fillStyle = fill ?? INK
      const x = a('x')
      const y = a('y')
      const rot = /rotate\(\s*(-?[\d.]+)[\s,]+(-?[\d.]+)[\s,]+(-?[\d.]+)\s*\)/.exec(el.getAttribute('transform') ?? '')
      ctx.save()
      if (rot) {
        ctx.translate(+rot[2], +rot[3])
        ctx.rotate((+rot[1] * Math.PI) / 180)
        ctx.translate(-rot[2], -rot[3])
      }
      fillText(ctx, el.textContent ?? '', x, y)
      ctx.restore()
      return
    }
  }
}

/* ───────── мелочи ───────── */

/**
 * Текст на холсте. В Manrope нет «ң» и «Ң»: браузер взял бы их из другого
 * шрифта, и буква выглядела бы чужой. Рисуем «н»/«Н» того же шрифта и
 * дорисовываем хвостик справа внизу — как у настоящей «ң».
 */
function fillText(ctx: CanvasRenderingContext2D, s: string, x: number, y: number) {
  if (!/[ңҢ]/.test(s)) {
    ctx.fillText(s, x, y)
    return
  }
  const plain = s.replace(/ң/g, 'н').replace(/Ң/g, 'Н')
  const total = ctx.measureText(plain).width
  const align = ctx.textAlign
  let at = align === 'center' ? x - total / 2 : align === 'right' || align === 'end' ? x - total : x
  ctx.textAlign = 'left'
  for (const part of s.split(/([ңҢ])/)) {
    if (!part) continue
    if (part === 'ң' || part === 'Ң') {
      const base = part === 'ң' ? 'н' : 'Н'
      const m = ctx.measureText(base)
      ctx.fillText(base, at, y)
      // хвостик: от низа правой ножки вниз, толщиной со штрих буквы
      const size = parseFloat(/(\d+(?:\.\d+)?)px/.exec(ctx.font)?.[1] ?? '16')
      const stem = Math.max(1, size * 0.11)
      const right = at + m.actualBoundingBoxRight
      const bottom = y + m.actualBoundingBoxDescent
      ctx.fillRect(right - stem * 0.9, bottom - stem * 0.2, stem * 0.9 + size * 0.06, size * 0.22)
      at += m.width
      continue
    }
    ctx.fillText(part, at, y)
    at += ctx.measureText(part).width
  }
  ctx.textAlign = align
}

/** Стрелка «открыть» (↗) линиями, в цвет текста. */
function arrow(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.save()
  ctx.strokeStyle = ctx.fillStyle
  ctx.lineWidth = Math.max(1.5, size * 0.16)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(x + size, y - size)
  ctx.moveTo(x + size * 0.35, y - size)
  ctx.lineTo(x + size, y - size)
  ctx.lineTo(x + size, y - size * 0.35)
  ctx.stroke()
  ctx.restore()
}

/** Скруглённая рамка: свой путь — ctx.roundRect есть не во всех телефонах. */
function box(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

/** Разбивает текст на строки по ширине; слово длиннее строки режется по буквам. */
export function wrap(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  const out: string[] = []
  const fits = (s: string) => ctx.measureText(s).width <= width
  for (const para of text.split('\n')) {
    let line = ''
    for (const word of para.split(' ')) {
      const next = line ? `${line} ${word}` : word
      if (fits(next)) {
        line = next
        continue
      }
      if (line) out.push(line)
      line = word
      while (!fits(line) && line.length > 1) {
        let cut = line.length - 1
        while (cut > 1 && !fits(line.slice(0, cut))) cut--
        out.push(line.slice(0, cut))
        line = line.slice(cut)
      }
    }
    out.push(line)
  }
  return out
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

function jpeg(c: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('jpeg'))), 'image/jpeg', 0.9))
}

/** Ждём шрифт сайта, но не дольше полутора секунд: без него лист всё равно нарисуется системным. */
async function fontsReady() {
  try {
    const fonts = document.fonts
    if (!fonts) return
    await Promise.race([
      Promise.all(['500 20px Manrope', '700 20px Manrope', '800 20px Manrope'].map((f) => fonts.load(f))),
      new Promise((r) => setTimeout(r, 1500)),
    ])
  } catch {
    // шрифт не загрузился — рисуем системным
  }
}
