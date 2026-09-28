'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/**
 * Окно конструктора («Заменить?», «В галерею»). Рисуется в `document.body`:
 * у родителей в полном экране бывает transform, и `position: fixed` внутри
 * него уехал бы вместе с ними. Escape и нажатие мимо окна закрывают, фокус —
 * внутри окна, после закрытия возвращается на прежнюю кнопку.
 */
export function Modal({
  label,
  labelledBy,
  alert = false,
  small = false,
  locked = false,
  className,
  onClose,
  children,
}: {
  label?: string
  labelledBy?: string
  /** вопрос с выбором («Заменить?») — role="alertdialog" */
  alert?: boolean
  small?: boolean
  /** идёт отправка — Escape и щелчок мимо окна его не закрывают */
  locked?: boolean
  /** своё оформление окна поверх общего (окно товара — без внутренних отступов) */
  className?: string
  onClose: () => void
  children: ReactNode
}) {
  const boxRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  const lockedRef = useRef(locked)
  useEffect(() => {
    closeRef.current = onClose
    lockedRef.current = locked
  }, [onClose, locked])
  const [host, setHost] = useState<HTMLElement | null>(null)
  // куда вернуть фокус — кнопка, с которой открыли окно (до autoFocus внутри)
  const [before] = useState(() => (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement ? document.activeElement : null))

  useEffect(() => setHost(document.body), [])

  useEffect(() => {
    if (!host) return
    const box = boxRef.current
    // кнопка с autoFocus уже в фокусе — не перебиваем
    if (box && !box.contains(document.activeElement)) box.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        if (!lockedRef.current) closeRef.current()
      }
      // Tab не уходит из окна за его пределы
      if (e.key === 'Tab' && box) {
        const items = [...box.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])')]
        if (items.length === 0) return
        const first = items[0]
        const last = items[items.length - 1]
        if (e.shiftKey && (document.activeElement === first || document.activeElement === box)) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      before?.focus({ preventScroll: true })
    }
  }, [host, before])

  if (!host) return null
  return createPortal(
    <div className="kp-dialog" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && !locked && onClose()}>
      <div
        className={`kp-dialog__box${small ? ' kp-dialog__box--small' : ''}${className ? ` ${className}` : ''}`}
        role={alert ? 'alertdialog' : 'dialog'}
        aria-modal="true"
        aria-label={label}
        aria-labelledby={labelledBy}
        tabIndex={-1}
        ref={boxRef}
      >
        {children}
      </div>
    </div>,
    host,
  )
}
