'use client'

import { useEffect, useRef, useState, type RefObject } from 'react'
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

/**
 * Шапка сайта. Пока она грузится, на её месте заглушка в 1 px, а бывает и скрытая копия нулевой высоты —
 * берём ту, что занимает место в потоке. Иначе сцена считает шапку пустой и встаёт не туда.
 */
export function siteHeader() {
  const all = document.querySelectorAll<HTMLElement>('.header')
  for (const h of all) if (h.offsetHeight > 1) return h
  return all[0] ?? null
}

/** Место шапки в потоке (+8 px воздуха) — от этой линии считается ход сцены. */
export function storyTop() {
  return (siteHeader()?.offsetHeight ?? 0) + 8
}

/**
 * Сколько пикселей прокрутки сцена стоит на месте (--travel в home-story-kitchens.css).
 * Ход не зависит от шапки: уехала она или вернулась — карточки не прыгают.
 */
export function deckTravel(el: HTMLElement) {
  return parseFloat(getComputedStyle(el).getPropertyValue('--travel')) || 1
}

/**
 * Колода карточек на прокрутке (общая для «Готовых кухонь» и «Скидок»).
 * 0–0.3 хода колода раскрывается в веер; 0.3–0.95 веер проходит с карточки start до end.
 * spread — шаг веера в долях ширины карточки. Двигаются только transform и opacity.
 * Пока сцена стоит, она растягивается на весь экран (--fill от 0 до 1): по бокам и сверху
 * не остаётся пустого белого места, а когда шапка уезжает — сцена поднимается к верху экрана.
 */
export function useFanDeck(root: RefObject<HTMLElement | null>, { start, end, spread }: { start: number; end: number; spread: number }) {
  const [phase, setPhase] = useState(0)
  const [focus, setFocus] = useState(start)
  useEffect(() => {
    const el = root.current
    if (!el) return
    const media = matchMedia('(prefers-reduced-motion: reduce)')
    const cards = Array.from(el.querySelectorAll<HTMLElement>('.hk__card'))
    const stage = el.querySelector<HTMLElement>('.hr__stage')!
    let frame = 0
    const update = () => {
      frame = 0
      const head = siteHeader()?.getBoundingClientRect()
      // место шапки в потоке страницы — не меняется, когда она уезжает (она сдвигается, а не прячется)
      const top = (head?.height ?? 0) + 8
      el.style.setProperty('--story-top', `${top}px`)
      const box = el.getBoundingClientRect()
      const d = top - box.top
      // без «залипания» (меньше движения, низкий телефон боком) сцена — обычная карточка
      const sticky = !media.matches && getComputedStyle(stage).position === 'sticky'
      // первые 160 px прокрутки сцена разворачивается на весь экран
      const fill = sticky ? smooth(clamp(d / 160)) : 0
      el.style.setProperty('--fill', fill.toFixed(3))
      el.style.setProperty('--bleed-l', `${Math.max(0, box.left).toFixed(1)}px`)
      el.style.setProperty('--bleed-r', `${Math.max(0, document.documentElement.clientWidth - box.right).toFixed(1)}px`)
      el.style.setProperty('--w0', `${el.clientWidth}px`)
      // сцена встаёт под низ шапки; уехала шапка — к самому верху экрана. У покупателя с бонусами под шапкой
      // прилипает полоска «У вас N бонусов» (BonusReminder): шапка уехала — полоска остаётся, сцена встаёт под неё
      const bonus = document.querySelector('.bonus-bar')?.getBoundingClientRect()
      const line = Math.max(0, head?.bottom ?? 0, bonus?.height ? bonus.bottom : 0)
      el.style.setProperty('--stick', `${sticky ? line + 8 * (1 - fill) : top}px`)
      const p = media.matches || !sticky ? 1 : clamp(d / deckTravel(el))
      el.style.setProperty('--story-progress', p.toFixed(4))
      el.dataset.progress = p.toFixed(3)
      const fan = smooth(clamp(p / .3))
      const k = start + (end - start) * smooth(clamp((p - .3) / .65))
      const w = cards[0]?.offsetWidth ?? 400
      cards.forEach((card, i) => {
        const d = i - k
        const a = Math.abs(d)
        const stack = { x: d * 7, y: -Math.min(a, 3) * 7, r: d * 1.6, s: 1 - Math.min(a, 3) * .03, o: a > 3 ? 0 : 1 }
        const open = { x: d * w * spread, y: d * d * w * .035, r: d * 7, s: 1 - Math.min(a, 3) * .09, o: clamp(3.1 - a) }
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
    const header = siteHeader()
    if (header) observer.observe(header)
    let follow = 0
    let until = 0
    // шапка уезжает плавно (~0,26 с) и после того, как палец остановился, — сцена едет за ней каждый кадр
    const chase = () => {
      cancelAnimationFrame(frame)
      update()
      follow = performance.now() < until ? requestAnimationFrame(chase) : 0
    }
    // слушаем документ, а не саму шапку: настоящая шапка может прийти позже заглушки
    const headerMoves = (e: TransitionEvent) => {
      if (!(e.target instanceof Element) || !e.target.classList.contains('header')) return
      // сцена не на экране — следить не за чем
      const box = el.getBoundingClientRect()
      if (box.bottom < 0 || box.top > innerHeight) return
      until = performance.now() + 340
      if (!follow) follow = requestAnimationFrame(chase)
    }
    document.addEventListener('transitionrun', headerMoves)
    // полоска бонусов появляется через пару секунд после загрузки и исчезает по крестику — сцена переезжает под неё
    const bars = new MutationObserver(schedule)
    bars.observe(document.body, { childList: true })
    addEventListener('scroll', schedule, { passive: true })
    addEventListener('resize', schedule)
    media.addEventListener('change', schedule)
    update()
    return () => {
      cancelAnimationFrame(frame)
      cancelAnimationFrame(follow)
      observer.disconnect()
      document.removeEventListener('transitionrun', headerMoves)
      bars.disconnect()
      removeEventListener('scroll', schedule)
      removeEventListener('resize', schedule)
      media.removeEventListener('change', schedule)
      delete el.dataset.enhanced
    }
  }, [root, start, end, spread])
  return { phase, focus }
}

export function HomeStoryKitchens() {
  const { lang } = useI18n()
  const root = useRef<HTMLElement>(null)
  const ky = lang === 'ky'
  const titles = ky
    ? ['Ашканаңызды 3D форматта чогултуңуз.', 'Өз стилиңизди тандаңыз.', 'Ыңгайлуулук үйдөн башталат.']
    : ['Соберите кухню в 3D.', 'Выберите свой стиль.', 'Комфорт начинается дома.']
  const notes = ky
    ? ['Дүкөндөгү техника менен даяр долбоорлор.', 'Сканди, лофт, классика, арт-деко жана башкалар.', 'Долбоорду ачып, дубалдарыңызга ылайыкташтырыңыз.']
    : ['Готовые проекты с техникой из нашего магазина.', 'Сканди, лофт, классика, арт-деко и другие.', 'Откройте проект и подгоните под свои стены.']

  const { phase, focus } = useFanDeck(root, { start: 1, end: 5, spread: .46 })

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
