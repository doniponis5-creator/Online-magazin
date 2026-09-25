'use client'

import { useRef, type ReactNode } from 'react'

/**
 * Приближение фото двумя пальцами прямо на странице — как в галерее iPhone.
 *
 * Пока фото не приближено, один палец листает страницу как обычно
 * (touch-action: pan-y), а щипок ловим сами через pointer-события.
 * Приближено — один палец двигает фото, страница стоит. Двойное нажатие
 * приближает в 2,5 раза к этой точке, ещё раз — возвращает.
 * На компьютере компонент ничего не делает: там мышь и лупа.
 */
const MAX = 4

export function PinchZoom({ children, className }: { children: ReactNode; className?: string }) {
  const box = useRef<HTMLSpanElement>(null)
  const inner = useRef<HTMLSpanElement>(null)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const state = useRef({ scale: 1, tx: 0, ty: 0 })
  const pinch = useRef<{ dist: number; mid: { x: number; y: number }; scale: number; tx: number; ty: number } | null>(null)
  const last = useRef<{ x: number; y: number } | null>(null)
  const lastTap = useRef(0)
  // был ли в этом жесте щипок: отпустили пальцы — фото плавно возвращается,
  // как в Instagram. Двойное нажатие держит приближение до следующего.
  const didPinch = useRef(false)

  const apply = (animated = false) => {
    const el = inner.current
    const wrap = box.current
    if (!el || !wrap) return
    const s = state.current
    // не выпускаем фото за края рамки
    const w = wrap.clientWidth
    const h = wrap.clientHeight
    s.tx = Math.min(0, Math.max(w - w * s.scale, s.tx))
    s.ty = Math.min(0, Math.max(h - h * s.scale, s.ty))
    el.style.transition = animated ? 'transform 180ms ease-out' : 'none'
    el.style.transform = `translate(${s.tx}px, ${s.ty}px) scale(${s.scale})`
    wrap.style.touchAction = s.scale > 1.01 ? 'none' : 'pan-y'
  }

  const reset = () => {
    state.current = { scale: 1, tx: 0, ty: 0 }
    apply(true)
  }

  const zoomTo = (scale: number, at: { x: number; y: number }) => {
    // точка под пальцем остаётся на месте
    const s = state.current
    const px = (at.x - s.tx) / s.scale
    const py = (at.y - s.ty) / s.scale
    s.scale = Math.min(MAX, Math.max(1, scale))
    s.tx = at.x - px * s.scale
    s.ty = at.y - py * s.scale
    apply(true)
  }

  const local = (e: { clientX: number; clientY: number }) => {
    const r = box.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse') return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const pts = [...pointers.current.values()]
    try {
      box.current?.setPointerCapture(e.pointerId)
    } catch {
      // палец уже ушёл — захватывать нечего
    }
    if (pts.length === 2) {
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
      const midClient = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 }
      const s = state.current
      pinch.current = { dist, mid: local({ clientX: midClient.x, clientY: midClient.y }), scale: s.scale, tx: s.tx, ty: s.ty }
      last.current = null
    } else if (pts.length === 1) {
      last.current = { x: e.clientX, y: e.clientY }
    }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' || !pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const pts = [...pointers.current.values()]
    const s = state.current
    if (pts.length === 2 && pinch.current) {
      const p = pinch.current
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
      const midClient = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 }
      const mid = local({ clientX: midClient.x, clientY: midClient.y })
      const scale = Math.min(MAX, Math.max(1, (p.scale * dist) / Math.max(1, p.dist)))
      // точка между пальцами в координатах фото — та же, что в начале щипка
      const px = (p.mid.x - p.tx) / p.scale
      const py = (p.mid.y - p.ty) / p.scale
      s.scale = scale
      s.tx = mid.x - px * scale
      s.ty = mid.y - py * scale
      didPinch.current = true
      apply()
    } else if (pts.length === 1 && s.scale > 1.01 && last.current) {
      s.tx += e.clientX - last.current.x
      s.ty += e.clientY - last.current.y
      last.current = { x: e.clientX, y: e.clientY }
      apply()
    }
  }

  const onPointerUp = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse') return
    const moved = last.current && Math.hypot(e.clientX - last.current.x, e.clientY - last.current.y) > 8
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinch.current = null
    if (pointers.current.size === 0) {
      last.current = null
      if (didPinch.current) {
        didPinch.current = false
        reset()
        lastTap.current = 0
        return
      }
      if (state.current.scale < 1.05) reset()
      // двойное нажатие: приблизить к точке или вернуть
      const now = Date.now()
      if (!moved && now - lastTap.current < 320) {
        lastTap.current = 0
        if (state.current.scale > 1.01) reset()
        else zoomTo(2.5, local(e))
      } else {
        lastTap.current = moved ? 0 : now
      }
    }
  }

  // span, а не div: обёртка живёт внутри <button>, куда блочные теги нельзя
  return (
    <span
      ref={box}
      className={className}
      style={{ display: 'block', overflow: 'hidden', touchAction: 'pan-y', userSelect: 'none' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <span ref={inner} style={{ display: 'block', transformOrigin: '0 0', width: '100%', height: '100%' }}>
        {children}
      </span>
    </span>
  )
}
