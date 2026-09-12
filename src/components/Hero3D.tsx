'use client'

import Link from 'next/link'
import { useEffect, useRef } from 'react'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { IconChevronRight } from './Icons'

/**
 * Объёмный hero «LG F4X5ES5SB» (brief владельца 12.09, код F4X5ES5SB).
 *
 * Сцена — чистый CSS 3D (perspective + transform), без WebGL и библиотек:
 * короткий sticky-участок прокрутки управляет прогрессом --p (0…1) в rAF,
 * события wheel/touch не перехватываются. Фазы: машина 3/4 → TurboWash™360°
 * (барабан + четыре потока) → Inverter Direct Drive (схема привода) →
 * машина собирается снова. Подтверждены только характеристики с страницы LG;
 * цена/остаток/покупка для LG не имитируются — CTA ведёт в существующий
 * каталог техники для дома.
 *
 * prefers-reduced-motion или отсутствие JS: --p не задаётся, каскад
 * показывает собранную статичную машину со всеми текстами и CTA
 * (в конце globals.css reduce-блок фиксирует фазы и останавливает вращение).
 * Pointer-tilt — только тонкий указатель и только декоративная сцена;
 * текст и кнопки не наклоняются. На touch tilt выключен.
 */
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
      root.style.setProperty('--p', p.toFixed(4))
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
      root.style.removeProperty('--p')
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

          <div className="wm">
            {/* фаза 1 (0–~22%): машина в ракурсе 3/4 */}
            <div className="wm__scene wm__scene--intro">
              <div className="wm__machine">
                <span className="wm__shadow" />
                <span className="wm__top" />
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
                <span className="wm__side" />
              </div>
            </div>

            {/* фаза 2 (~22–52%): барабан крупно + четыре потока TurboWash™360° */}
            <div className="wm__scene wm__scene--turbo">
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
            </div>

            {/* фаза 3 (~54–80%): схема прямого привода сзади */}
            <div className="wm__scene wm__scene--drive">
              <span className="wm__drum-back" />
              <span className="wm__shaft" />
              <span className="wm__motor">
                <i />
                <i />
                <i />
              </span>
              <span className="wm__schem-line wm__schem-line--a" />
              <span className="wm__schem-line wm__schem-line--b" />
            </div>

            {/* фаза 4 (~80–100%): машина собрана, чистый ракурс */}
            <div className="wm__scene wm__scene--final">
              <div className="wm__machine wm__machine--final">
                <span className="wm__shadow" />
                <span className="wm__top" />
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
                <span className="wm__side" />
              </div>
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
