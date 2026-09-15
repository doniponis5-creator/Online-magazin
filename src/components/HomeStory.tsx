'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useI18n } from '@/lib/i18n/I18nProvider'
import './home-story.css'

/** Одна шкала прокрутки управляет приближением и смысловыми окнами. */
export function HomeStory() {
  const { lang } = useI18n()
  const root = useRef<HTMLElement>(null)
  const [phase, setPhase] = useState(0)
  const ky = lang === 'ky'
  const titles = ky
    ? ['Үй ойгонот.', 'Ар бир ишке — өз жардамчысы.', 'Ыңгайлуулук үйдөн башталат.']
    : ['Дом просыпается.', 'Для каждого дела — свой помощник.', 'Комфорт начинается дома.']
  const notes = ky
    ? ['Жыпар жыттуу кофе. Жылуу эртең менен.', 'Ашканада, кир жууганда жана тазалыкта.', 'Үйүңүзгө керектүү техниканы тандаңыз.']
    : ['Аромат кофе. Тепло нового утра.', 'На кухне, в стирке и в заботе о чистоте.', 'Выберите технику для вашего ритма жизни.']

  useEffect(() => {
    const el = root.current
    if (!el) return
    const media = matchMedia('(prefers-reduced-motion: reduce)')
    let frame = 0
    const update = () => {
      frame = 0
      const header = document.querySelector('.header')?.getBoundingClientRect().height ?? 0
      el.style.setProperty('--story-top', `${header + 8}px`)
      const stage = el.querySelector<HTMLElement>('.home-story__stage')!
      const travel = el.offsetHeight - stage.offsetHeight
      const p = media.matches ? 1 : Math.max(0, Math.min(1, (header + 8 - el.getBoundingClientRect().top) / Math.max(1, travel)))
      el.style.setProperty('--story-scale', String(1.48 - p * .48))
      el.style.setProperty('--story-progress', String(p))
      el.dataset.progress = p.toFixed(3)
      setPhase(p < .32 ? 0 : p < .7 ? 1 : 2)
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update) }
    el.dataset.enhanced = 'true'
    const observer = new ResizeObserver(schedule)
    observer.observe(el)
    const header = document.querySelector('.header')
    if (header) observer.observe(header)
    addEventListener('scroll', schedule, { passive: true })
    addEventListener('resize', schedule)
    media.addEventListener('change', schedule)
    update()
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      removeEventListener('scroll', schedule)
      removeEventListener('resize', schedule)
      media.removeEventListener('change', schedule)
      delete el.dataset.enhanced
    }
  }, [])

  return <section ref={root} className="home-story" aria-label={ky ? 'Үйүңүз үчүн техника' : 'Техника для вашего дома'}>
    <div className="home-story__stage">
      <div className="home-story__scene" aria-hidden="true">
        <img className="home-story__image" src="/home-story/home-awakens.png" alt="" width="1672" height="941" fetchPriority="high" />
      </div>
      <div className="home-story__wash" aria-hidden="true" />
      <div className="home-story__copy">
        <h1>{titles[phase]}</h1>
        <p>{notes[phase]}</p>
        <Link className="btn btn--primary home-story__cta" href={`/${lang}/catalog?cat=home`}>{ky ? 'Техниканы тандоо' : 'Выбрать технику'} <span aria-hidden="true">↗</span></Link>
        <span className="home-story__hint">{ky ? 'Үйүңүздү жаңыча көрүңүз' : 'Откройте дом по-новому'} <span aria-hidden="true">↓</span></span>
      </div>
      <div className="home-story__footer"><span>{ky ? 'Интерьердин концепциясы' : 'Концепция интерьера'}</span><span aria-hidden="true">0{phase + 1} / 03</span></div>
      <div className="home-story__progress" aria-hidden="true" />
    </div>
  </section>
}
