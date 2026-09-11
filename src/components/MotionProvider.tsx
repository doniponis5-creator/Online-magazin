'use client'

import { useEffect } from 'react'

/**
 * Однократное мягкое появление секций [data-reveal] при попадании в вьюпорт.
 * Без JS весь контент виден сразу; при prefers-reduced-motion движение отключено.
 * Только opacity/transform — без layout shift.
 */
export function MotionProvider() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const elements = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'))
    if (elements.length === 0) return
    elements.forEach((el) => el.classList.add('reveal'))
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-in')
            observer.unobserve(entry.target)
          }
        }
      },
      { threshold: 0.1, rootMargin: '0px 0px -6% 0px' },
    )
    elements.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])
  return null
}
