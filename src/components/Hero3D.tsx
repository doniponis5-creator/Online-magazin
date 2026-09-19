'use client'

import Link from 'next/link'
import { useEffect, useRef } from 'react'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { IconChevronRight } from './Icons'
import { IconArrowDown } from './Icons'

/**
 * Hero «LG F4X5ES5SB» — скролл-анимация из настоящих 3D-рендеров (TASK_05).
 *
 * Blender-сцена v7 (без изменений модели) отрендерена в 60 кадров
 * поворота ¾ → фронт → противоположные ¾ (assets-src/lg-f4x5es5sb/
 * render_turntable.py); оптимизированные серии WebP лежат в public/lg/.
 *
 * Поведение:
 * - постер (первый кадр) — обычный <img> из серверного HTML: страница,
 *   тексты и CTA работают без JavaScript;
 * - возле вьюпорта постепенно загружается ОДНА серия — mobile или desktop
 * (по ширине экрана; смена точки перехода подгружает другую серию);
 * - прокрутка обычная (wheel/touch не перехватываются, без scrollTo):
 *   sticky-участок ~210vh задаёт прогресс --p, из него берётся кадр;
 * - на быстром скролле показывается ближайший готовый кадр, пока не
 *   декодируется нужный; после декодирования кадр обновляется;
 * - canvas перерисовывается только при смене кадра; rAF — только по
 *   событию скролла; внутреннее разрешение ограничено 2×DPR;
 * - prefers-reduced-motion: серия не загружается, остаётся статичный
 *   постер (reduce-блок в globals.css убирает скролл-диапазон);
 * - ошибка загрузки кадров оставляет постер, тексты и кнопку на месте.
 * Цена/остаток/покупка для LG не имитируются: CTA — в существующий каталог.
 */

const FRAMES = 60
const MOBILE_DIR = '/lg/turntable/mobile'
const DESKTOP_DIR = '/lg/turntable/desktop'
const MOBILE_W = 900

const frameUrl = (dir: string, i: number) =>
  `${dir}/f${String(i).padStart(3, '0')}.webp`

export function Hero3D() {
  const { t, lang } = useI18n()
  const rootRef = useRef<HTMLElement>(null)
  const stickyRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const root = rootRef.current
    const sticky = stickyRef.current
    const canvas = canvasRef.current
    if (!root || !sticky || !canvas) return
    const reduceMq = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (reduceMq.matches) return
    if (!canvas.getContext('2d')) return

    const ctx = canvas.getContext('2d')!
    // кэш серий: смена mobile↔desktop не перекачивает уже загруженное
    const cache = new Map<string, (HTMLImageElement | null)[]>()
    let series = window.innerWidth <= MOBILE_W ? MOBILE_DIR : DESKTOP_DIR
    let loadingSeries = ''
    let destroyed = false
    let raf = 0
    let drawn = -1 // индекс кадра на canvas

    // ---- геометрия canvas: CSS-размер × min(DPR, 2) ----
    const sizeCanvas = () => {
      const r = canvas.getBoundingClientRect()
      if (r.width === 0) return
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = Math.max(1, Math.round(r.width * dpr))
      if (canvas.width !== w) {
        canvas.width = w
        canvas.height = w // кадры квадратные
        drawn = -1 // перерисовать текущий кадр в новом размере
      }
    }

    const drawFrame = (idx: number) => {
      const imgs = cache.get(series)
      const img = imgs?.[idx]
      if (!img || idx === drawn) return
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      drawn = idx
      canvas.dataset.frame = String(idx)
      canvas.classList.add('is-live')
    }

    // ближайший готовый кадр к целевому (для быстрого скролла)
    const nearestReady = (target: number): number => {
      const imgs = cache.get(series)
      if (!imgs) return -1
      for (let d = 0; d < FRAMES; d++) {
        if (target - d >= 0 && imgs[target - d]) return target - d
        if (target + d < FRAMES && imgs[target + d]) return target + d
      }
      return -1
    }

    // ---- прогресс sticky-участка → кадр (в rAF, только по скроллу) ----
    const update = () => {
      raf = 0
      const top = root.getBoundingClientRect().top
      const range = Math.max(1, root.offsetHeight - sticky.offsetHeight)
      const p = Math.min(1, Math.max(0, -top / range))
      root.style.setProperty('--p', p.toFixed(4))
      const target = Math.round(p * (FRAMES - 1))
      const imgs = cache.get(series)
      drawFrame(imgs?.[target] ? target : nearestReady(target))
    }
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }

    // ---- постепенная загрузка серии возле вьюпорта ----
    const loadSeries = (dir: string) => {
      if (loadingSeries === dir || cache.has(dir)) return
      loadingSeries = dir
      const imgs: (HTMLImageElement | null)[] = new Array(FRAMES).fill(null)
      cache.set(dir, imgs)
      // 4 кадра параллельно: постер и первый кадр не ждут всей серии
      let next = 0
      const worker = async () => {
        while (!destroyed) {
          const i = next++
          if (i >= FRAMES) return
          const img = new Image()
          img.decoding = 'async'
          img.src = frameUrl(dir, i)
          try {
            await img.decode()
          } catch {
            continue // кадр недоступен: остаётся ближайший готовый/постер
          }
          if (destroyed) return
          imgs[i] = img
          schedule() // после декодирования обновить кадр под текущий скролл
        }
      }
      void Promise.all([worker(), worker(), worker(), worker()]).then(() => {
        if (loadingSeries === dir) loadingSeries = ''
      })
    }

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          loadSeries(series)
          io.disconnect()
        }
      },
      { rootMargin: '300px' },
    )
    io.observe(sticky)

    // sticky-бокс прилипает НИЖЕ шапки: высоту шапки измеряем фактически —
    // на 390px поиск переносится и шапка выше --header-h
    const measureHeader = () => {
      const header = document.querySelector('.header') as HTMLElement | null
      root.style.setProperty('--hero-pin-top', `${header?.offsetHeight ?? 0}px`)
    }

    const narrowMq = window.matchMedia(`(max-width: ${MOBILE_W}px)`)
    const onNarrowChange = () => {
      const next = narrowMq.matches ? MOBILE_DIR : DESKTOP_DIR
      if (next === series) return
      series = next
      drawn = -1 // кадры другой серии могут отличаться размером
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      canvas.classList.remove('is-live')
      if (cache.has(series)) {
        schedule()
      } else {
        loadSeries(series)
      }
    }
    const onResize = () => {
      measureHeader()
      sizeCanvas()
      schedule()
    }

    sizeCanvas()
    measureHeader()
    update()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', onResize, { passive: true })
    narrowMq.addEventListener('change', onNarrowChange)
    return () => {
      destroyed = true
      io.disconnect()
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', onResize)
      narrowMq.removeEventListener('change', onNarrowChange)
      if (raf) cancelAnimationFrame(raf)
      root.style.removeProperty('--p')
      root.style.removeProperty('--hero-pin-top')
      cache.clear()
    }
  }, [])

  return (
    <section className="hero3d" ref={rootRef} aria-labelledby="hero-title">
      <div className="hero3d__sticky" ref={stickyRef}>
        {/* декоративная сцена: фон и кадры машины, клики не перехватывает */}
        <div className="hero3d__stage" aria-hidden="true">
          <div className="hero3d__sky" />
          <div className="hero3d__grid" />
          <div className="hero3d__orb hero3d__orb--lime" />
          <div className="hero3d__orb hero3d__orb--blue" />

          {/* постер = первый кадр серии (¾): без JS и до готовности canvas */}
          <div className="hero3d__frame">
            <img
              className="hero3d__poster"
              src="/lg/poster-960.webp"
              srcSet="/lg/poster-640.webp 640w, /lg/poster-960.webp 960w"
              sizes="(max-width: 900px) 88vw, 460px"
              alt=""
              width={960}
              height={960}
              decoding="async"
              fetchPriority="high"
            />
            <canvas ref={canvasRef} className="hero3d__canvas" />
          </div>
        </div>

        <div className="hero3d__content">
          <span className="hero3d__eyebrow">{t.hero.badge}</span>
          <h1 className="hero3d__title" id="hero-title">
            {t.hero.title}
          </h1>

          {/* фазы занимают одну ячейку стека и меняются кроссфейдом;
              intro — один блок: подзаголовок и подсказка не перекрываются */}
          <div className="hero3d__phases">
            <div className="hero3d__ph hero3d__ph--intro">
              <p className="hero3d__subtitle">{t.hero.subtitle}</p>
              <p className="hero3d__hint">{t.hero.scrollHint}<IconArrowDown size={16} /></p>
            </div>

            <div className="hero3d__ph hero3d__ph--front">
              <p className="hero3d__phase-label">{t.hero.frontLabel}</p>
              <p className="hero3d__phase-note">{t.hero.frontNote}</p>
            </div>

            <p className="hero3d__subtitle hero3d__ph hero3d__ph--final">
              {t.hero.finalNote}
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
