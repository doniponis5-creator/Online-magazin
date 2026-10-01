'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { READY } from '@/data/kitchen-ready'
import { Words } from './HomeStoryReveal'
import './home-story-reveal.css'
import './home-story-kitchens.css'
import { IconArrowDown, IconArrowUpRight } from './Icons'

/**
 * Баннер «Готовые кухни в 3D»: колода кадров из конструктора раскрывается веером,
 * прокрутка проводит каждую кухню вперёд. Карточка открывает проект в конструкторе.
 * Шапка, шрифты и кнопки — как у сцены «Дом просыпается» (общие классы hr__*).
 */

/** Порядок в колоде: вторая (индекс 1) лежит сверху, с неё веер и начинается. */
const DECK = ['straight-300-scandi', 'island-380-quiet', 'corner-310x180-japandi', 'u-360x270-artdeco', 'corner-360x300-english', 'straight-320-loft', 'island-450-gold']
  .map((id) => READY.find((k) => k.id === id))
  .filter((k): k is (typeof READY)[number] => Boolean(k))

const clamp = (v: number) => Math.max(0, Math.min(1, v))
const smooth = (t: number) => t * t * (3 - 2 * t)

export function HomeStoryKitchens() {
  const { lang } = useI18n()
  const root = useRef<HTMLElement>(null)
  const [phase, setPhase] = useState(0)
  const [focus, setFocus] = useState(1)
  const ky = lang === 'ky'
  const titles = ky
    ? ['Ашканаңызды 3D форматта чогултуңуз.', 'Өз стилиңизди тандаңыз.', 'Ыңгайлуулук үйдөн башталат.']
    : ['Соберите кухню в 3D.', 'Выберите свой стиль.', 'Комфорт начинается дома.']
  const notes = ky
    ? ['Дүкөндөгү техника менен даяр долбоорлор.', 'Сканди, лофт, классика, арт-деко жана башкалар.', 'Долбоорду ачып, дубалдарыңызга ылайыкташтырыңыз.']
    : ['Готовые проекты с техникой из нашего магазина.', 'Сканди, лофт, классика, арт-деко и другие.', 'Откройте проект и подгоните под свои стены.']

  useEffect(() => {
    const el = root.current
    if (!el) return
    const media = matchMedia('(prefers-reduced-motion: reduce)')
    const cards = Array.from(el.querySelectorAll<HTMLElement>('.hk__card'))
    let frame = 0
    const update = () => {
      frame = 0
      const header = document.querySelector('.header')?.getBoundingClientRect().height ?? 0
      el.style.setProperty('--story-top', `${header + 8}px`)
      const stage = el.querySelector<HTMLElement>('.hr__stage')!
      const travel = el.offsetHeight - stage.offsetHeight
      const p = media.matches ? 1 : clamp((header + 8 - el.getBoundingClientRect().top) / Math.max(1, travel))
      el.style.setProperty('--story-progress', p.toFixed(4))
      el.dataset.progress = p.toFixed(3)
      // 0–0.3 колода раскрывается в веер; 0.3–0.95 веер проходит с кухни 1 до кухни 5
      const fan = smooth(clamp(p / .3))
      const k = 1 + 4 * smooth(clamp((p - .3) / .65))
      const w = cards[0]?.offsetWidth ?? 400
      cards.forEach((card, i) => {
        const d = i - k
        const a = Math.abs(d)
        const stack = { x: d * 7, y: -Math.min(a, 3) * 7, r: d * 1.6, s: 1 - Math.min(a, 3) * .03, o: a > 3 ? 0 : 1 }
        const open = { x: d * w * .46, y: d * d * w * .035, r: d * 7, s: 1 - Math.min(a, 3) * .09, o: clamp(3.1 - a) }
        const mix = (from: number, to: number) => from + (to - from) * fan
        card.style.setProperty('--x', `${mix(stack.x, open.x).toFixed(1)}px`)
        card.style.setProperty('--y', `${mix(stack.y, open.y).toFixed(1)}px`)
        card.style.setProperty('--rot', `${mix(stack.r, open.r).toFixed(2)}deg`)
        card.style.setProperty('--sc', mix(stack.s, open.s).toFixed(3))
        card.style.opacity = mix(stack.o, open.o).toFixed(3)
        card.style.zIndex = String(100 - Math.round(a * 10))
        card.toggleAttribute('data-front', a < .5)
        // за веером карточка не должна ловить нажатия и фокус
        card.tabIndex = a < 2.6 ? 0 : -1
      })
      setFocus(Math.round(k))
      setPhase(p < .3 ? 0 : p < .72 ? 1 : 2)
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

  const front = DECK[focus]
  return <section ref={root} className="hr hr--kitchens" aria-label={ky ? '3D форматтагы даяр ашканалар' : 'Готовые кухни в 3D'}>
    <div className="hr__stage">
      <div className="hk__glow" aria-hidden="true" />
      <div className="hk__deck">
        {DECK.map((k, i) => <Link key={k.id} className="hk__card" href={`/${lang}/kitchen?${k.q}`} aria-label={ky ? k.ky : k.ru}
          style={{ zIndex: 100 - Math.abs(i - 1) * 10, opacity: Math.abs(i - 1) > 3 ? 0 : 1 }}>
          <img src={k.image} srcSet={`${k.thumb} 480w, ${k.image} 1200w`} sizes="(max-width: 900px) 72vw, 520px" alt="" width="1200" height="750"
            loading={i === 1 ? 'eager' : 'lazy'} fetchPriority={i === 1 ? 'high' : 'auto'} />
          <span className="hk__badge" aria-hidden="true">3D</span>
        </Link>)}
        {front && <p className="hk__caption" key={front.id}>{ky ? front.ky : front.ru}<IconArrowUpRight size={14} /></p>}
      </div>
      <div className="hr__copy">
        <h1 key={`t${phase}`}><Words text={titles[phase]} /></h1>
        <p key={`n${phase}`} className="hr__note">{notes[phase]}</p>
        <Link className="btn btn--primary hr__cta" href={`/${lang}/kitchen`}>{ky ? 'Ашкана чогултуу' : 'Собрать кухню'}<IconArrowUpRight size={18} /></Link>
        <Link className="hr__hint hk__more" href={`/${lang}/kitchen/gallery`}>{ky ? 'Бардык даяр ашканалар' : 'Все готовые кухни'}<IconArrowDown size={16} /></Link>
      </div>
      <div className="hr__footer"><span>{ky ? '3D форматтагы даяр ашканалар' : 'Готовые кухни в 3D'}</span><span aria-hidden="true">0{focus + 1} / 0{DECK.length}</span></div>
      <div className="hr__progress" aria-hidden="true" />
    </div>
  </section>
}
