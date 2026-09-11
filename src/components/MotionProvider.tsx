'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

/**
 * Однократное мягкое появление секций [data-reveal] при попадании в вьюпорт.
 * Работает и при клиентских переходах: наблюдатель пересоздаётся на каждый
 * маршрут (usePathname), поэтому секции следующей страницы регистрируются
 * заново; после ухода с маршрута всё показанное остаётся видимым
 * (класс снимается только с непоказанных элементов при размонтировании).
 * prefers-reduced-motion отслеживается живьём — смена системной настройки
 * применяется без перезагрузки. Только opacity/transform, без layout shift.
 */
export function MotionProvider() {
  const pathname = usePathname()

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const reduce = () => mq.matches
    if (reduce()) return

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

    // переключение системной настройки после загрузки:
    // либо включаем движение, либо мгновенно показываем всё
    const onChange = () => {
      if (!reduce()) return
      observer.disconnect()
      document
        .querySelectorAll<HTMLElement>('.reveal:not(.is-in)')
        .forEach((el) => el.classList.add('is-in'))
    }
    mq.addEventListener('change', onChange)

    return () => {
      mq.removeEventListener('change', onChange)
      observer.disconnect()
      // непоказанные элементы возвращаем в видимое состояние, чтобы контент
      // не оставался скрытым после ухода с маршрута (в т.ч. StrictMode)
      document
        .querySelectorAll<HTMLElement>('.reveal:not(.is-in)')
        .forEach((el) => el.classList.add('is-in'))
    }
  }, [pathname])

  return null
}
