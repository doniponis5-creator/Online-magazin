import { modulesOf, type DimsKind, type SpecBox, type SpecData, type SpecFront, type SpecModule, type SpecRun } from '@/lib/kitchen/spec'

/**
 * Развёртка стены — чертёж, как у мебельщика: шкафы и фасады в масштабе,
 * стрелки открывания дверец, цепочка ширин снизу и высоты сбоку.
 * Возвращает готовый SVG строкой: он же идёт на страницу и в PDF.
 * Единицы чертежа — сантиметры.
 */

const CARCASS: DimsKind[] = [
  'base',
  'drawers',
  'sinkBase',
  'hobBase',
  'ovenBase',
  'corner',
  'bottle',
  'filler',
  'openBase',
  'tall',
  'pantry',
  'upper',
  'vitrine',
  'lift',
  'antresol',
  'overFridge',
  'shelf',
]

export type DrawingLabels = {
  cm: string
  /** подпись техники по её месту */
  appliance: (slot: string) => string
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string)
const n = (v: number) => (Math.round(v * 10) / 10).toString()
const fmt = (v: number) => (Math.abs(v - Math.round(v)) < 0.05 ? String(Math.round(v)) : v.toFixed(1).replace('.', ','))

export function elevationSvg(
  run: SpecRun,
  heights: SpecData['heights'],
  labels: DrawingLabels,
  window?: { at: number; w: number; sill: number; top: number } | null,
): string {
  const L = run.length
  const H = heights.ceiling
  const fs = Math.max(7, (L + 120) / 52)
  const pad = { l: 12, r: 26 + fs * 3, t: 10, b: 30 + fs * 3.4 }
  const Y = (y: number) => H - y
  const out: string[] = []
  const line = (x1: number, y1: number, x2: number, y2: number, cls: string) =>
    out.push(`<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" class="${cls}"/>`)
  const text = (x: number, y: number, s: string, cls: string, rotate = false) =>
    out.push(
      `<text x="${n(x)}" y="${n(y)}" class="${cls}" text-anchor="middle" dominant-baseline="central"${rotate ? ` transform="rotate(-90 ${n(x)} ${n(y)})"` : ''}>${esc(s)}</text>`,
    )

  // стена, пол, потолок
  out.push(`<rect x="0" y="0" width="${n(L)}" height="${n(H)}" class="el-wall"/>`)
  line(-6, Y(0), L + 6, Y(0), 'el-floor')
  if (window) {
    const x0 = window.at - window.w / 2
    out.push(`<rect x="${n(x0)}" y="${n(Y(window.top))}" width="${n(window.w)}" height="${n(window.top - window.sill)}" class="el-window"/>`)
  }

  // рамки: столешница, корпуса, техника
  const boxes = run.boxes
  for (const b of boxes.filter((b) => b.kind === 'top' || b.kind === 'island')) {
    out.push(`<rect x="${n(b.x)}" y="${n(Y(b.y + b.h))}" width="${n(b.w)}" height="${n(b.h)}" class="el-top"/>`)
  }
  for (const b of boxes.filter((b) => b.kind === 'panel')) {
    out.push(`<rect x="${n(b.x)}" y="${n(Y(b.y + b.h))}" width="${n(b.w)}" height="${n(b.h)}" class="el-panel"/>`)
  }
  for (const b of boxes.filter((b) => CARCASS.includes(b.kind))) {
    out.push(`<rect x="${n(b.x)}" y="${n(Y(b.y + b.h))}" width="${n(b.w)}" height="${n(b.h)}" class="el-box"/>`)
  }
  for (const f of run.fronts) front(out, f, Y)
  for (const b of boxes.filter((b) => b.kind === 'appliance')) appliance(out, b, Y, labels, fs)

  // ширины: нижний ряд под полом (места под шкафы и технику), общая длина — ниже
  const { upper } = modulesOf(run)
  const chainY = Y(0) + fs * 1.6
  const chain = (list: SpecModule[], y: number) => {
    const cuts = [...new Set(list.flatMap((b) => [Math.round(b.x * 10) / 10, Math.round((b.x + b.w) * 10) / 10]))].sort((a, b) => a - b)
    if (cuts.length < 2) return
    line(cuts[0], y, cuts[cuts.length - 1], y, 'el-dim')
    for (const c of cuts) line(c, y - fs * 0.45, c, y + fs * 0.45, 'el-dim')
    for (let i = 0; i < cuts.length - 1; i++) {
      const w = cuts[i + 1] - cuts[i]
      if (w >= fs * 1.6) text((cuts[i] + cuts[i + 1]) / 2, y - fs * 0.6, fmt(w), 'el-num')
    }
  }
  chain(run.modules, chainY)
  const totalY = chainY + fs * 1.9
  line(0, totalY, L, totalY, 'el-dim')
  for (const c of [0, L]) line(c, totalY - fs * 0.45, c, totalY + fs * 0.45, 'el-dim')
  text(L / 2, totalY - fs * 0.6, `${fmt(L)} ${labels.cm}`, 'el-num el-num--total')

  // ширины верхних шкафов — внутри рамок, над их низом
  for (const b of upper) {
    if (b.w < fs * 2.2 || b.kind === 'antresol') continue
    text(b.x + b.w / 2, Y(b.y) - fs * 0.9, fmt(b.w), 'el-num el-num--in')
  }

  // высоты справа: цоколь, низ, фартук, верх, антресоль, до потолка
  const hx = L + fs * 1.4
  const marks = [0, heights.plinth, heights.counter, heights.upperBottom, heights.upperTop]
  if (heights.mezzTop) marks.push(heights.mezzTop)
  if (H - marks[marks.length - 1] > 1) marks.push(H)
  line(hx, Y(0), hx, Y(marks[marks.length - 1]), 'el-dim')
  marks.forEach((m) => line(hx - fs * 0.45, Y(m), hx + fs * 0.45, Y(m), 'el-dim'))
  for (let i = 0; i < marks.length - 1; i++) {
    const h = marks[i + 1] - marks[i]
    if (h >= fs * 1.3) text(hx + fs * 0.9, Y((marks[i] + marks[i + 1]) / 2), fmt(h), 'el-num', true)
  }

  const vb = `${-pad.l} ${-pad.t} ${n(L + pad.l + pad.r)} ${n(H + pad.t + pad.b)}`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" class="el" style="--el-fs:${n(fs)}px" role="img">${out.join('')}</svg>`
}

/** Фасад и его знак открывания: вершина угла — там, где петли. */
function front(out: string[], f: SpecFront, Y: (y: number) => number) {
  const x0 = f.x
  const x1 = f.x + f.w
  const y0 = Y(f.y)
  const y1 = Y(f.y + f.h)
  out.push(`<rect x="${n(x0)}" y="${n(y1)}" width="${n(f.w)}" height="${n(f.h)}" class="el-front${f.glass ? ' el-front--glass' : ''}"/>`)
  const path = (d: string) => out.push(`<path d="${d}" class="el-swing"/>`)
  const my = (y0 + y1) / 2
  if (f.hinge === 'left') path(`M${n(x1)} ${n(y1)}L${n(x0)} ${n(my)}L${n(x1)} ${n(y0)}`)
  else if (f.hinge === 'right') path(`M${n(x0)} ${n(y1)}L${n(x1)} ${n(my)}L${n(x0)} ${n(y0)}`)
  else if (f.hinge === 'top') path(`M${n(x0)} ${n(y0)}L${n((x0 + x1) / 2)} ${n(y1)}L${n(x1)} ${n(y0)}`)
  else if (f.hinge === 'fold') path(`M${n(x0)} ${n(y1)}L${n((x0 + x1) / 2)} ${n(y0)}L${n(x1)} ${n(y1)}`)
  else if (f.hinge === 'drawer' && f.w > 8) {
    const cx = (x0 + x1) / 2
    const hy = y1 + Math.min(4, f.h / 3)
    out.push(`<line x1="${n(cx - Math.min(8, f.w / 5))}" y1="${n(hy)}" x2="${n(cx + Math.min(8, f.w / 5))}" y2="${n(hy)}" class="el-handle"/>`)
  }
}

function appliance(out: string[], b: SpecBox, Y: (y: number) => number, labels: DrawingLabels, fs: number) {
  if (!b.slot || b.slot === 'hob') return
  out.push(`<rect x="${n(b.x)}" y="${n(Y(b.y + b.h))}" width="${n(b.w)}" height="${n(b.h)}" class="el-tech"/>`)
  if (b.w < fs * 3) return
  const cx = b.x + b.w / 2
  const cy = Y(b.y + b.h / 2)
  const name = labels.appliance(b.slot)
  out.push(
    `<text x="${n(cx)}" y="${n(cy - fs * 0.55)}" class="el-tech-name" text-anchor="middle" dominant-baseline="central">${esc(name)}</text>` +
      `<text x="${n(cx)}" y="${n(cy + fs * 0.65)}" class="el-num" text-anchor="middle" dominant-baseline="central">${fmt(b.w)}×${fmt(b.h)}</text>`,
  )
}

/** Стили чертежа — общие для страницы и для PDF. */
export const DRAWING_CSS = `
.el{display:block;width:100%;height:auto;font-family:Manrope,system-ui,sans-serif}
.el-wall{fill:#f7f8fa;stroke:#c9d1dc;stroke-width:.6}
.el-floor{stroke:#263244;stroke-width:1.6}
.el-window{fill:#e4efff;stroke:#7fa6e6;stroke-width:.8;stroke-dasharray:3 2}
.el-top{fill:#ddd6cb;stroke:#8c8478;stroke-width:.5}
.el-panel{fill:#ebe6de;stroke:#8c8478;stroke-width:.5}
.el-box{fill:#fff;stroke:#263244;stroke-width:.7}
.el-front{fill:#fff;stroke:#263244;stroke-width:.45}
.el-front--glass{fill:#eef5ff}
.el-swing{fill:none;stroke:#8a97a9;stroke-width:.4;stroke-dasharray:2.4 1.6}
.el-handle{stroke:#263244;stroke-width:.9;stroke-linecap:round}
.el-tech{fill:#e7effc;stroke:#2563eb;stroke-width:.6}
.el-tech-name{font-size:var(--el-fs);font-weight:700;fill:#1d4ed8}
.el-dim{stroke:#263244;stroke-width:.45}
.el-num{font-size:var(--el-fs);font-weight:700;fill:#263244}
.el-num--total{font-weight:800}
.el-num--in{fill:#5b6778;font-weight:650}
`
