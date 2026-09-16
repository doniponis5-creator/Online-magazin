'use client'

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import './filter-select.css'

type Option = { value: string; label: string }

/** Выбор с ограниченной высотой, клавиатурой и сохранением фокуса. */
export function FilterSelect({ label, value, options, onChange }: {
  label: string; value: string; options: Option[]; onChange: (value: string) => void
}) {
  const id = useId()
  const root = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const selected = Math.max(0, options.findIndex(option => option.value === value))
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(selected)
  const [above, setAbove] = useState(false)
  const [height, setHeight] = useState(264)
  const search = useRef({ text: '', time: 0 })

  function show() {
    const rect = button.current?.getBoundingClientRect()
    if (rect) {
      const bottom = window.innerHeight - rect.bottom - 84
      const top = rect.top - (document.querySelector('.header')?.getBoundingClientRect().bottom ?? 0) - 12
      const flip = bottom < 180 && top > bottom
      setAbove(flip)
      setHeight(Math.min(264, Math.max(88, flip ? top : bottom)))
    }
    setActive(selected)
    setOpen(true)
  }
  function choose(index: number) {
    onChange(options[index].value)
    setOpen(false)
    button.current?.focus({ preventScroll: true })
  }
  useEffect(() => {
    if (!open) return
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    const resize = () => setOpen(false)
    document.addEventListener('pointerdown', close)
    window.addEventListener('resize', resize)
    return () => {
      document.removeEventListener('pointerdown', close)
      window.removeEventListener('resize', resize)
    }
  }, [open])
  useEffect(() => {
    if (!open) return
    const option = list.current?.children[active] as HTMLElement | undefined
    if (option && list.current) {
      const menu = list.current
      if (option.offsetTop < menu.scrollTop) menu.scrollTop = option.offsetTop
      else if (option.offsetTop + option.offsetHeight > menu.scrollTop + menu.clientHeight)
        menu.scrollTop = option.offsetTop + option.offsetHeight - menu.clientHeight
    }
  }, [active, open])

  function keyboard(event: KeyboardEvent<HTMLButtonElement>) {
    const key = event.key
    if (key === 'Tab') { setOpen(false); return }
    if (key === 'Escape') { event.preventDefault(); setOpen(false); return }
    if (['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', ' '].includes(key)) {
      event.preventDefault()
      if (!open) { show(); return }
      if (key === 'Enter' || key === ' ') { choose(active); return }
      setActive(index => key === 'Home' ? 0 : key === 'End' ? options.length - 1
        : Math.max(0, Math.min(options.length - 1, index + (key === 'ArrowDown' ? 1 : -1))))
    } else if (key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault()
      if (!open) show()
      const now = Date.now()
      search.current = { text: (now - search.current.time < 700 ? search.current.text : '') + key.toLowerCase(), time: now }
      const index = options.findIndex(option => option.label.toLowerCase().startsWith(search.current.text))
      if (index >= 0) setActive(index)
    }
  }

  return <div ref={root} className={`filter-select${open ? ' is-open' : ''}`}>
    <span id={`${id}-label`} className="filter-select__label">{label}</span>
    <button ref={button} type="button" role="combobox" className="filter-select__trigger"
      aria-labelledby={`${id}-label`} aria-expanded={open} aria-haspopup="listbox"
      aria-controls={open ? `${id}-list` : undefined}
      aria-activedescendant={open ? `${id}-option-${active}` : undefined}
      onClick={() => open ? setOpen(false) : show()} onKeyDown={keyboard}
      onBlur={() => setOpen(false)}>
      <span>{options[selected].label}</span>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
    </button>
    {open && <ul ref={list} id={`${id}-list`} role="listbox" aria-labelledby={`${id}-label`}
      className={`filter-select__menu${above ? ' is-above' : ''}`} style={{ maxHeight: height }}>
      {options.map((option, index) => <li key={option.value} id={`${id}-option-${index}`}
        role="option" aria-selected={option.value === value}
        className={`filter-select__option${active === index ? ' is-active' : ''}`}
        onPointerDown={event => event.preventDefault()} onClick={() => choose(index)}>
        <span>{option.label}</span>
        {option.value === value && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>}
      </li>)}
    </ul>}
  </div>
}
