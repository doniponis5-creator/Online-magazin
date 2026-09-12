'use client'

import Link from 'next/link'
import { useEffect, useRef } from 'react'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { IconChevronRight } from './Icons'

/**
 * Объёмный hero «LG F4X5ES5SB» (brief владельца 12.09, код F4X5ES5SB).
 *
 * Одна CSS-3D модель машины вращается реальными ракурсами от прокрутки
 * (без WebGL и библиотек): короткий sticky-участок задаёт прогресс --p
 * в rAF; из него в том же кадре считаются кусочные величины —
 *   --spin    поворот корпуса: ¾ → фас (TurboWash™360°, корпус
 *             полупрозрачный, камера приближается к барабану) → вид сзади
 *             (схема Inverter Direct Drive) → собранный чистый ракурс;
 *   --body-op прозрачность корпуса, --zoom наезд на барабан,
 *   --flow-op четыре потока, --schem-op задняя схема.
 * События wheel/touch не перехватываются; амплитуда ограничена.
 *
 * prefers-reduced-motion или отсутствие JS: переменные не заданы —
 * каскад показывает собранную статичную машину со всеми текстами и CTA
 * (reduce-блок в конце globals.css фиксирует модель и глушит вращение).
 * Pointer-tilt — только тонкий указатель и только декоративная сцена;
 * текст и кнопки не наклоняются. На touch tilt выключен.
 * Подтверждены только характеристики с официальной страницы LG; цена,
 * остаток и покупка для LG не имитируются — CTA ведёт в существующий
 * каталог техники для дома.
 */

/** отрезок [a,b] → 0..1 */
const seg = (p: number, a: number, b: number) =>
  Math.min(1, Math.max(0, (p - a) / (b - a)))
/** сглаживание рампы */
const smooth = (t: number) => t * t * (3 - 2 * t)

export function Hero3D() {
  const { t, lang } = useI18n()
  const rootRef = useRef<HTMLElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = rootRef.current
    const stage = stageRef.current
    if (!root || !stage) return
    const reduceMq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const coarseMq = window.matchMedia('(pointer: coarse)')
    if (reduceMq.matches) return

    let raf = 0
    const update = () => {
      raf = 0
      // прогресс sticky-участка: 0 — начало, 1 — сцена прокручена
      const top = root.getBoundingClientRect().top
      const range = Math.max(1, root.offsetHeight - stage.offsetHeight)
      const p = Math.min(1, Math.max(0, -top / range))

      // непрерывное вращение одной модели: ¾(-26°) → фас(0°) → зад(180°) → ¾(334°)
      let spin = -26
      spin += smooth(seg(p, 0, 0.22)) * 26
      spin += smooth(seg(p, 0.52, 0.8)) * 180
      spin += smooth(seg(p, 0.8, 1)) * 154

      // корпус: полупрозрачен, пока «внутри» (турбо) и на виде сзади
      const bodyOp = 1 - 0.86 * smooth(seg(p, 0.2, 0.3)) * (1 - smooth(seg(p, 0.78, 0.86)))
      // наезд камеры на барабан
      const zoom = 1 + 1.05 * smooth(seg(p, 0.2, 0.34)) * (1 - smooth(seg(p, 0.5, 0.62)))
      // внутренний барабан и потоки — фаза TurboWash™360°
      const coreOp = smooth(seg(p, 0.2, 0.3)) * (1 - smooth(seg(p, 0.5, 0.6)))
      const flowOp = smooth(seg(p, 0.22, 0.32)) * (1 - smooth(seg(p, 0.5, 0.58)))
      // задняя схема привода
      const schemOp = smooth(seg(p, 0.58, 0.68)) * (1 - smooth(seg(p, 0.78, 0.82)))

      root.style.setProperty('--p', p.toFixed(4))
      root.style.setProperty('--spin', spin.toFixed(2))
      root.style.setProperty('--body-op', bodyOp.toFixed(3))
      root.style.setProperty('--zoom', zoom.toFixed(3))
      root.style.setProperty('--core-op', coreOp.toFixed(3))
      root.style.setProperty('--flow-op', flowOp.toFixed(3))
      root.style.setProperty('--schem-op', schemOp.toFixed(3))
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }
    const onMove = (e: PointerEvent) => {
      const r = stage.getBoundingClientRect()
      if (r.width === 0) return
      stage.style.setProperty('--mx', ((e.clientX - r.left) / r.width - 0.5).toFixed(3))
      stage.style.setProperty('--my', ((e.clientY - r.top) / r.height - 0.5).toFixed(3))
    }
    const resetVars = () => {
      for (const v of ['--p', '--spin', '--body-op', '--zoom', '--core-op', '--flow-op', '--schem-op']) {
        root.style.removeProperty(v)
      }
      stage.style.removeProperty('--mx')
      stage.style.removeProperty('--my')
    }
    const onReduceChange = () => {
      if (reduceMq.matches) resetVars()
    }

    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    let tiltBound = false
    if (!coarseMq.matches) {
      stage.addEventListener('pointermove', onMove, { passive: true })
      tiltBound = true
    }
    reduceMq.addEventListener('change', onReduceChange)
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (tiltBound) stage.removeEventListener('pointermove', onMove)
      reduceMq.removeEventListener('change', onReduceChange)
      if (raf) cancelAnimationFrame(raf)
      resetVars()
    }
  }, [])

  return (
    <section className="hero3d" ref={rootRef} aria-labelledby="hero-title">
      <div className="hero3d__sticky">
        {/* декоративная сцена: не перехватывает клики */}
        <div className="hero3d__stage" ref={stageRef} aria-hidden="true">
          <div className="hero3d__sky" />
          <div className="hero3d__grid" />
          <div className="hero3d__orb hero3d__orb--lime" />
          <div className="hero3d__orb hero3d__orb--blue" />

          {/* одна модель: корпус + внутренний барабан + задняя схема */}
          <div className="wm">
            <div className="wm__machine">
              <span className="wm__shadow" />
              <span className="wm__top" />
              <span className="wm__side" />
              <span className="wm__front">
                <span className="wm__panel">
                  <i />
                  <i />
                  <i />
                </span>
                <span className="wm__door">
                  <span className="wm__door-ring" />
                  <span className="wm__glass">
                    <span className="wm__drum" />
                  </span>
                </span>
              </span>

              {/* барабан изнутри: виден, когда корпус прозрачен */}
              <span className="wm__core">
                <span className="wm__drum-big">
                  <span className="wm__laundry">
                    <i />
                    <i />
                    <i />
                  </span>
                </span>
                <span className="wm__flows">
                  <i />
                  <i />
                  <i />
                  <i />
                </span>
              </span>

              {/* вид сзади: схематичный прямой привод (не заводской CAD) */}
              <span className="wm__back">
                <span className="wm__drum-back" />
                <span className="wm__shaft" />
                <span className="wm__motor">
                  <i />
                  <i />
                  <i />
                </span>
                <span className="wm__schem-line wm__schem-line--a" />
                <span className="wm__schem-line wm__schem-line--b" />
              </span>
            </div>
          </div>
        </div>

        <div className="hero3d__content">
          <span className="hero3d__eyebrow">{t.hero.badge}</span>
          <h1 className="hero3d__title" id="hero-title">
            {t.hero.title}
          </h1>

          {/* фазы занимают одну ячейку стека и меняются кроссфейдом */}
          <div className="hero3d__phases">
            <p className="hero3d__subtitle hero3d__ph hero3d__ph--intro">{t.hero.subtitle}</p>
            <p className="hero3d__hint hero3d__ph hero3d__ph--intro">{t.hero.scrollHint} ↓</p>

            <div className="hero3d__ph hero3d__ph--turbo">
              <p className="hero3d__phase-label">{t.hero.turboLabel}</p>
              <p className="hero3d__phase-note">{t.hero.turboNote}</p>
            </div>

            <div className="hero3d__ph hero3d__ph--drive">
              <p className="hero3d__phase-label">{t.hero.driveLabel}</p>
              <p className="hero3d__phase-note">{t.hero.driveNote}</p>
            </div>

            <p className="hero3d__subtitle hero3d__ph hero3d__ph--final">{t.hero.finalNote}</p>
            <p className="hero3d__schematic hero3d__ph hero3d__ph--schematic">
              {t.hero.schematic}
            </p>
          </div>

          <Link href={`/${lang}/catalog?cat=home`} className="btn btn--primary hero3d__cta">
            {t.hero.cta}
            <IconChevronRight size={18} />
          </Link>
          <p className="hero3d__demo">{t.hero.demoNote}</p>
        </div>
      </div>
    </section>
  )
}
