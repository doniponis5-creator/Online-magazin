'use client'

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import type { Preview } from '@/lib/kitchen/drag'
import { DEPTH, type Plan, type Run } from '@/lib/kitchen/layout'
import { isGap, type GapId, type WallId } from '@/lib/kitchen/types'
import { cellCm, cellX, chainOf, hitRun, planCells, planFrame, rectOf, runWorld, WALL_T, type PlanCell, type PlanTarget } from './planGeom'
import type { DragPhase } from './three/engine'

/**
 * План сверху — интерактивный SVG в той же сцене, что 3D (спецификация §4,
 * R16i). Стены с длинами, низ заливкой, верх контуром, техника подписью,
 * пустые места пунктиром с «+», цепочки размеров. Жесты — те же, что в 3D:
 * нажать — выбрать; тянуть выбранный — двигать (с точкой захвата); тянуть
 * пусто — панорама; щипок или колесо — масштаб. Предпросмотр приходит снаружи
 * (`preview` из `previewMove`): план только переводит палец в «стена + см» и
 * рисует, что вернула модель.
 */

export type { PlanTarget } from './planGeom'
export type PlanNames = Record<'sink' | 'hob' | 'fridge' | 'dishwasher' | 'washer' | 'oven' | 'tall' | 'pantry' | 'hood', string>

export type PlanViewProps = {
  plan: Plan
  /** ключ выбранного — как в сцене (sink, k1, g1, A120, a120) */
  selected: string | null
  /** предпросмотр перемещения — общий с 3D */
  preview: Preview | null
  onPick: (key: string | null) => void
  onDrag: (phase: DragPhase, key: string, wall: WallId, cm: number, grab: number) => void
  /** «+»: на пустом месте или в точке ряда; null — кнопка «+» в углу (родитель выбирает место). at — где нажали, px экрана */
  onAdd: (target: PlanTarget | null, at: { x: number; y: number }) => void
  labels: { a: string; b?: string; c?: string }
  /** цвет фасада низа — заливка нижних модулей */
  facade?: string
  names: PlanNames
  cm: string
  addLabel: string
  ariaLabel: string
  className?: string
}

type Tf = { k: number; tx: number; ty: number }
const TF0: Tf = { k: 1, tx: 0, ty: 0 }
const ZOOM = { min: 0.6, max: 5 }
const TAP_MS = 400
const THRESH = (type: string) => (type === 'mouse' ? 5 : 10)
const FIXED_KINDS = new Set(['corner'])

type Down = {
  id: number
  key: string | null
  cell: PlanCell | null
  /** нажали на «+» пустого места */
  add: GapId | null
  x0: number
  y0: number
  t0: number
  type: string
  tf0: Tf
  mode: 'idle' | 'pan' | 'drag' | 'pinch' | 'done'
  grab: number
  /** последняя цель под пальцем; null — мимо кухни */
  last: { wall: WallId; cm: number } | null
}
type Pinch = { d0: number; k0: number; w0: { x: number; y: number } }

/** Числа плана — с запятой, как всё на сайте («56,5»). */
const fmt = (v: number) => String(Math.round(v * 10) / 10).replace('.', ',')

export function PlanView({ plan, selected, preview, onPick, onDrag, onAdd, labels, facade, names, cm, addLabel, ariaLabel, className }: PlanViewProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [size, setSize] = useState({ w: 320, h: 240 })
  const [tf, setTf] = useState<Tf>(TF0)
  const tfRef = useRef(tf)
  tfRef.current = tf
  const downRef = useRef<Down | null>(null)
  const ptrs = useRef(new Map<number, { x: number; y: number }>())
  const pinchRef = useRef<Pinch | null>(null)
  const lastTap = useRef(0)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const ro = new ResizeObserver(([e]) => {
      const r = e.contentRect
      if (r.width > 0 && r.height > 0) setSize({ w: r.width, h: r.height })
    })
    ro.observe(host)
    return () => ro.disconnect()
  }, [])

  const cells = useMemo(() => planCells(plan), [plan])
  const frame = useMemo(() => planFrame(plan), [plan])

  // масштаб под контейнер: шрифт — 11 px на экране при масштабе 1, поля под цепочки — от шрифта
  const geo = useMemo(() => {
    const fw = frame.x1 - frame.x0
    const fh = frame.y1 - frame.y0
    const px0 = Math.min(size.w / (fw + 80), size.h / (fh + 60))
    const fs = Math.min(40, Math.max(3, 11 / Math.max(px0, 1e-3)))
    const u = plan.shape === 'u'
    const isl = Boolean(plan.island)
    const ml = 4.8 * fs
    const mt = 4.8 * fs
    const mr = (u ? 4.8 : 2.2) * fs
    const mb = (isl ? 4.4 : 1.6) * fs
    const vb = { x: frame.x0 - ml, y: frame.y0 - mt, w: fw + ml + mr, h: fh + mt + mb }
    const px = Math.min(size.w / vb.w, size.h / vb.h)
    return { fs, vb, lw: 1 / Math.max(px, 1e-3) }
  }, [frame, size, plan.shape, plan.island])
  const { fs, vb, lw } = geo

  /** экран → пользовательские координаты SVG (viewBox) */
  const toUser = (cx: number, cy: number) => {
    const svg = svgRef.current
    const m = svg?.getScreenCTM()
    if (!svg || !m) return { x: 0, y: 0 }
    const p = new DOMPoint(cx, cy).matrixTransform(m.inverse())
    return { x: p.x, y: p.y }
  }
  /** экран → мир плана, см */
  const toWorld = (cx: number, cy: number) => {
    const u = toUser(cx, cy)
    const t = tfRef.current
    return { x: (u.x - t.tx) / t.k, y: (u.y - t.ty) / t.k }
  }
  const clampK = (k: number) => Math.min(ZOOM.max, Math.max(ZOOM.min, k))
  /** приблизить вокруг точки экрана */
  const zoomAt = (cx: number, cy: number, k1: number) => {
    const u = toUser(cx, cy)
    const t = tfRef.current
    const k = clampK(k1)
    const wx = (u.x - t.tx) / t.k
    const wy = (u.y - t.ty) / t.k
    setTf({ k, tx: u.x - wx * k, ty: u.y - wy * k })
  }

  // колесо — масштаб; страница под планом не листается (нужен непассивный слушатель)
  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      zoomAt(e.clientX, e.clientY, tfRef.current.k * Math.exp(-e.deltaY * 0.0015))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const endDrag = (d: Down, phase: 'end' | 'cancel') => {
    if (d.mode !== 'drag' || !d.key) return
    const at = d.last
    if (phase === 'end' && at) onDrag('end', d.key, at.wall, at.cm, d.grab)
    else onDrag('cancel', d.key, at?.wall ?? d.cell?.wall ?? 'A', at?.cm ?? 0, d.grab)
  }

  const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return
    const svg = svgRef.current
    if (!svg) return
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    try {
      svg.setPointerCapture(e.pointerId)
    } catch {
      /* старый браузер — жест и так дойдёт */
    }
    if (ptrs.current.size === 2) {
      // второй палец — щипок; идущее перетаскивание отменяется (как в 3D)
      const d = downRef.current
      if (d) {
        endDrag(d, 'cancel')
        d.mode = 'pinch'
      }
      const [a, b] = [...ptrs.current.values()]
      const mid = toWorld((a.x + b.x) / 2, (a.y + b.y) / 2)
      pinchRef.current = { d0: Math.hypot(a.x - b.x, a.y - b.y), k0: tfRef.current.k, w0: mid }
      return
    }
    if (ptrs.current.size > 2) return
    const target = e.target as Element
    const addEl = target.closest('[data-add]')
    const cellEl = target.closest('[data-key]')
    const key = cellEl?.getAttribute('data-key') ?? null
    const cell = key ? (cells.find((c) => c.key === key) ?? null) : null
    downRef.current = {
      id: e.pointerId,
      key,
      cell,
      add: (addEl?.getAttribute('data-add') as GapId | null) ?? null,
      x0: e.clientX,
      y0: e.clientY,
      t0: performance.now(),
      type: e.pointerType,
      tf0: tfRef.current,
      mode: 'idle',
      grab: 0,
      last: null,
    }
  }

  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!ptrs.current.has(e.pointerId)) return
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const pinch = pinchRef.current
    if (pinch && ptrs.current.size >= 2) {
      const [a, b] = [...ptrs.current.values()]
      const d = Math.hypot(a.x - b.x, a.y - b.y)
      const k = clampK((pinch.k0 * d) / Math.max(pinch.d0, 1))
      const u = toUser((a.x + b.x) / 2, (a.y + b.y) / 2)
      setTf({ k, tx: u.x - pinch.w0.x * k, ty: u.y - pinch.w0.y * k })
      return
    }
    const d = downRef.current
    if (!d || d.id !== e.pointerId || d.mode === 'pinch' || d.mode === 'done') return
    const dx = e.clientX - d.x0
    const dy = e.clientY - d.y0
    if (d.mode === 'idle') {
      if (Math.hypot(dx, dy) < THRESH(d.type)) return
      // тянуть выбранный — двигать; невыбранный или пусто — панорама
      if (d.key && d.cell?.pick && d.key === selected && !FIXED_KINDS.has(d.cell.kind)) {
        const w0 = toWorld(d.x0, d.y0)
        const hit0 = hitRun(plan, w0.x, w0.y)
        // всё в см от угла (runCm): на стене B это length − x, как в раскладке и движке
        const run = plan.runs.find((r) => r.id === d.cell!.wall)
        const center = run ? cellCm(run, d.cell) : d.cell.x + d.cell.w / 2
        d.grab = hit0 && hit0.wall === d.cell.wall ? Math.round((hit0.cm - center) * 10) / 10 : 0
        d.mode = 'drag'
        d.last = hit0 ?? { wall: d.cell.wall, cm: center + d.grab }
        onDrag('start', d.key, d.last.wall, d.last.cm, d.grab)
      } else d.mode = 'pan'
    }
    if (d.mode === 'pan') {
      const m = svgRef.current?.getScreenCTM()
      const s = m ? m.a : 1
      setTf({ k: d.tf0.k, tx: d.tf0.tx + dx / s, ty: d.tf0.ty + dy / s })
      return
    }
    if (d.mode === 'drag' && d.key) {
      const w = toWorld(e.clientX, e.clientY)
      const hit = hitRun(plan, w.x, w.y)
      d.last = hit
      if (hit) onDrag('move', d.key, hit.wall, hit.cm, d.grab)
    }
  }

  const onPointerUp = (e: ReactPointerEvent<SVGSVGElement>) => {
    ptrs.current.delete(e.pointerId)
    if (ptrs.current.size < 2) pinchRef.current = null
    const d = downRef.current
    if (!d || d.id !== e.pointerId) return
    downRef.current = null
    if (d.mode === 'drag') {
      endDrag(d, e.type === 'pointercancel' ? 'cancel' : 'end')
      return
    }
    if (d.mode !== 'idle' || e.type === 'pointercancel') return
    if (performance.now() - d.t0 > TAP_MS) return
    // тап: «+» пустого места — меню; уже выбранное пустое место — тоже меню; иначе выбор
    const now = performance.now()
    const dbl = now - lastTap.current < 320
    lastTap.current = now
    if (d.add || (d.key && isGap(d.key) && d.key === selected && d.cell)) {
      const gap = (d.add ?? d.key) as GapId
      const cell = cells.find((c) => c.key === gap)
      const run = cell && plan.runs.find((r) => r.id === cell.wall)
      if (cell && run) onAdd({ wall: cell.wall, cm: cellCm(run, cell), gap }, { x: e.clientX, y: e.clientY })
      return
    }
    if (d.key && d.cell?.pick) {
      onPick(d.key)
      return
    }
    if (dbl) {
      setTf(TF0)
      return
    }
    onPick(null)
  }

  // выбранное сняли снаружи — идущее перетаскивание теряет смысл
  useEffect(() => {
    const d = downRef.current
    if (d && d.mode === 'drag' && d.key !== selected) {
      endDrag(d, 'cancel')
      d.mode = 'done'
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected])

  /* ───────── рисование ───────── */

  const W = plan.room.w
  const D = frame.y1
  const T = WALL_T
  const u = plan.shape === 'u'
  const win = plan.window
  const isl = plan.island
  const runOf = (id: string) => plan.runs.find((r) => r.id === id)

  // тянуть можно только выбранный (onPointerMove: d.key === selected), а сняли выбор — перетаскивание отменено; ref в рендере не читаем
  const dragKey = preview ? selected : null
  const dragCell = dragKey ? cells.find((c) => c.key === dragKey) : undefined
  const prun = preview ? runOf(preview.wall) : undefined

  const vertText = (r: { x: number; y: number; w: number; h: number }, vertical: boolean) =>
    vertical ? `rotate(-90 ${r.x + r.w / 2} ${r.y + r.h / 2})` : undefined

  const chain = (run: Run, label: string | undefined) => {
    const cuts = chainOf(run)
    const z = run.wall ? -T - 1.2 * fs : DEPTH + 1.2 * fs
    const a = runWorld(run, cuts[0], z)
    const b = runWorld(run, cuts[cuts.length - 1], z)
    const vertical = Math.abs(Math.sin(run.rot)) > 0.5
    const side = run.wall ? -1 : 1
    const items: ReactNode[] = []
    items.push(<line key="l" x1={a.x} y1={a.z} x2={b.x} y2={b.z} className="kp-plan__dim" strokeWidth={lw} />)
    for (const c of cuts) {
      const p0 = runWorld(run, c, z - 0.45 * fs)
      const p1 = runWorld(run, c, z + 0.45 * fs)
      items.push(<line key={`t${c}`} x1={p0.x} y1={p0.z} x2={p1.x} y2={p1.z} className="kp-plan__dim" strokeWidth={lw} />)
    }
    for (let i = 0; i < cuts.length - 1; i++) {
      const len = cuts[i + 1] - cuts[i]
      if (len < 1.6 * fs) continue
      const p = runWorld(run, (cuts[i] + cuts[i + 1]) / 2, z + side * 0.55 * fs)
      items.push(
        <text key={`n${i}`} x={p.x} y={p.z} fontSize={fs * 0.85} className="kp-plan__num" textAnchor="middle" dominantBaseline="central" transform={vertical ? `rotate(-90 ${p.x} ${p.z})` : undefined}>
          {fmt(len)}
        </text>,
      )
    }
    const tp = runWorld(run, run.length / 2, z + side * 2.1 * fs)
    items.push(
      <text key="total" x={tp.x} y={tp.z} fontSize={fs} className="kp-plan__total" textAnchor="middle" dominantBaseline="central" transform={vertical ? `rotate(-90 ${tp.x} ${tp.z})` : undefined}>
        {label ?? `${fmt(run.length)} ${cm}`}
      </text>,
    )
    return <g key={`chain-${run.id}`}>{items}</g>
  }

  const cellNode = (c: PlanCell) => {
    const r = c.rect
    const sel = c.key === selected
    const dragging = c.key === dragKey
    const cls = `kp-plan__cell kp-plan__cell--${c.row}${sel ? ' is-sel' : ''}${c.pick ? ' is-pick' : ''}${dragging ? ' is-drag' : ''}`
    const sw = sel ? 2.5 * lw : lw
    if (c.row === 'upper') {
      const dash = c.kind === 'hood' ? `${3 * lw} ${2 * lw}` : undefined
      return (
        <g key={`${c.wall}:${c.row}:${c.key}`} data-key={c.pick ? c.key : undefined} data-wall={c.wall} data-row="upper" className={cls}>
          <rect x={r.x} y={r.y} width={r.w} height={r.h} fill="none" stroke="transparent" strokeWidth={8 * lw} pointerEvents={c.pick ? 'stroke' : 'none'} />
          <rect x={r.x} y={r.y} width={r.w} height={r.h} className="kp-plan__upper" strokeWidth={sw} strokeDasharray={dash} pointerEvents="none" />
          {c.kind === 'hood' && r.w >= 3 * fs && r.h >= 1.2 * fs && (
            <text x={r.x + r.w / 2} y={r.y + r.h / 2} fontSize={fs * 0.7} className="kp-plan__cap" textAnchor="middle" dominantBaseline="central" transform={vertText(r, c.vertical)} pointerEvents="none">
              {names.hood}
            </text>
          )}
        </g>
      )
    }
    if (c.row === 'gap') {
      const rr = Math.min(14, Math.max(4, Math.min(r.w, r.h) / 2 - 2))
      return (
        <g key={`${c.wall}:${c.row}:${c.key}`} data-key={c.key} data-wall={c.wall} data-row="gap" className={cls}>
          <rect x={r.x} y={r.y} width={r.w} height={r.h} rx={2} className="kp-plan__gap" strokeWidth={sw} strokeDasharray={`${3 * lw} ${2.5 * lw}`} />
          <g data-add={c.key} className="kp-plan__plus" role="button" aria-label={addLabel}>
            <circle cx={r.x + r.w / 2} cy={r.y + r.h / 2} r={rr} strokeWidth={lw} />
            <line x1={r.x + r.w / 2 - rr * 0.5} y1={r.y + r.h / 2} x2={r.x + r.w / 2 + rr * 0.5} y2={r.y + r.h / 2} strokeWidth={Math.max(1.6 * lw, rr * 0.16)} />
            <line x1={r.x + r.w / 2} y1={r.y + r.h / 2 - rr * 0.5} x2={r.x + r.w / 2} y2={r.y + r.h / 2 + rr * 0.5} strokeWidth={Math.max(1.6 * lw, rr * 0.16)} />
          </g>
        </g>
      )
    }
    const tech = c.kind === 'fridge' || c.kind === 'dishwasher' || c.kind === 'washer' || c.kind === 'oven' || c.kind === 'tall' || c.kind === 'pantry'
    const fill = tech ? 'var(--kp-sk-tech)' : c.kind === 'sink' ? 'var(--kp-sk-sink)' : c.kind === 'hob' ? 'var(--kp-sk-hob)' : c.kind === 'filler' ? 'var(--kp-sk-filler)' : facade ?? 'var(--kp-sk-cab)'
    // ширины шкафов прячутся, пока идёт жест: ярлыки «до соседа» ложатся в тот же ряд (P1)
    const label = c.kind === 'sink' ? names.sink : c.kind === 'hob' ? names.hob : tech ? names[c.kind as keyof PlanNames] : c.w >= 25 && !preview ? fmt(c.w) : ''
    const cap = label && r.w >= 1.4 * fs && r.h >= 1.4 * fs
    return (
      <g key={`${c.wall}:${c.row}:${c.key}`} data-key={c.pick ? c.key : undefined} data-wall={c.wall} data-row="base" className={cls}>
        <rect x={r.x + 0.4} y={r.y + 0.4} width={Math.max(0, r.w - 0.8)} height={Math.max(0, r.h - 0.8)} rx={2} fill={fill} fillOpacity={tech || c.kind === 'sink' || c.kind === 'hob' || c.kind === 'filler' ? 1 : 0.45} className="kp-plan__base" strokeWidth={sw} />
        {c.kind === 'sink' && <rect x={r.x + r.w * 0.18} y={r.y + r.h * 0.2} width={r.w * 0.64} height={r.h * 0.6} rx={5} fill="var(--kp-sk-sink-bowl)" pointerEvents="none" />}
        {c.kind === 'hob' &&
          [0.3, 0.7].flatMap((fx) =>
            [0.32, 0.7].map((fy) => <circle key={`${fx}${fy}`} cx={r.x + r.w * fx} cy={r.y + r.h * fy} r={Math.min(r.w, r.h) * 0.13} fill="none" stroke="var(--kp-sk-hob-ring)" strokeWidth={1.5 * lw} pointerEvents="none" />),
          )}
        {cap && c.kind !== 'hob' && (
          <text x={r.x + r.w / 2} y={r.y + r.h / 2} fontSize={Math.min(fs * 0.85, (c.vertical ? r.h : r.w) / Math.max(3, label.length * 0.6))} className={tech || c.kind === 'sink' ? 'kp-plan__cap' : 'kp-plan__w'} textAnchor="middle" dominantBaseline="central" transform={vertText(r, c.vertical)} pointerEvents="none">
            {label}
          </text>
        )}
      </g>
    )
  }

  const previewNode = () => {
    if (!preview || !prun) return null
    const depth = dragCell?.depth ?? DEPTH
    // preview.center и подписи — в см от угла; рисуем вдоль ряда через cellX (на B — зеркально)
    const r = rectOf(prun, cellX(prun, preview.center) - preview.width / 2, preview.width, 0, depth)
    const bad = !preview.fits
    const side: 'left' | 'right' = preview.labels.left <= preview.labels.right ? 'left' : 'right'
    const edge = cellX(prun, side === 'left' ? preview.center - preview.width / 2 : preview.center + preview.width / 2)
    const s0 = runWorld(prun, edge, -8)
    const s1 = runWorld(prun, edge, depth + 8)
    const vertical = Math.abs(Math.sin(prun.rot)) > 0.5
    const lab = (v: number, at: number) => {
      const p = runWorld(prun, cellX(prun, at), depth / 2)
      return (
        <text x={p.x} y={p.z} fontSize={fs * 0.85} className="kp-plan__drag" textAnchor="middle" dominantBaseline="central" transform={vertical ? `rotate(-90 ${p.x} ${p.z})` : undefined} pointerEvents="none">
          {fmt(v)} {cm}
        </text>
      )
    }
    return (
      <g className={`kp-plan__preview${bad ? ' is-bad' : ''}`} pointerEvents="none" data-preview={bad ? 'bad' : 'ok'}>
        <rect x={r.x} y={r.y} width={r.w} height={r.h} rx={2} strokeWidth={2.5 * lw} />
        {preview.snap && <line x1={s0.x} y1={s0.z} x2={s1.x} y2={s1.z} className="kp-plan__snap" strokeWidth={1.5 * lw} strokeDasharray={`${3 * lw} ${2 * lw}`} />}
        {preview.labels.left > 0.5 && lab(preview.labels.left, preview.center - preview.width / 2 - preview.labels.left / 2)}
        {preview.labels.right > 0.5 && lab(preview.labels.right, preview.center + preview.width / 2 + preview.labels.right / 2)}
      </g>
    )
  }

  const wallLabelOf = (id: string) => (id === 'A' ? labels.a : id === 'B' ? labels.b : id === 'C' ? labels.c : undefined)

  return (
    <div ref={hostRef} className={`kp-plan${className ? ` ${className}` : ''}`} data-plan-view="">
      <svg
        ref={svgRef}
        viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
        preserveAspectRatio="xMidYMid meet"
        role="application"
        aria-label={ariaLabel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onContextMenu={(e) => e.preventDefault()}
      >
        <g transform={`translate(${tf.tx} ${tf.ty}) scale(${tf.k})`}>
          {/* стены и окно — как на чертеже */}
          <rect x={-T} y={-T} width={W + T + (u ? T : 0)} height={T} className="kp-plan__wall" />
          <rect x={-T} y={0} width={T} height={D} className="kp-plan__wall" />
          {u && <rect x={W} y={0} width={T} height={D} className="kp-plan__wall" />}
          {win?.wall === 'back' && <rect x={win.at - win.w / 2} y={-T} width={win.w} height={T} className="kp-plan__win" />}
          {win?.wall === 'left' && <rect x={-T} y={win.at - win.w / 2} width={T} height={win.w} className="kp-plan__win" />}
          {isl && <rect x={isl.x} y={isl.z - 62} width={isl.w} height={92} rx={3} className="kp-plan__top" />}
          {plan.runs.map((run) => chain(run, wallLabelOf(run.id)))}
          {cells.filter((c) => c.row === 'base').map(cellNode)}
          {cells.filter((c) => c.row === 'gap').map(cellNode)}
          {cells.filter((c) => c.row === 'upper').map(cellNode)}
          {previewNode()}
        </g>
      </svg>
      <button type="button" className="kp-plan__add" aria-label={addLabel} title={addLabel} onClick={(e) => onAdd(null, { x: e.clientX, y: e.clientY })}>
        +
      </button>
    </div>
  )
}
