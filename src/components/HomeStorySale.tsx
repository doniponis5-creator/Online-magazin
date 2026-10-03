'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { formatSom } from '@/lib/format'
import { discountPct, type SaleCard } from '@/lib/hero-sale'
import { deckTravel, useFanDeck } from './HomeStoryKitchens'
import './home-story-reveal.css'
import './home-story-kitchens.css'
import './home-story-sale.css'
import { IconArrowDown, IconArrowUpRight } from './Icons'

/**
 * Баннер «Скидки»: колода товаров со скидкой из каталога 1С раскрывается веером,
 * как «Готовые кухни в 3D». У передней карточки цена «сбегает» со старой до новой,
 * старая зачёркивается, выскакивает значок скидки. Карточка ведёт на товар.
 */

/** Цена передней карточки: от старой к новой за ~0,9 с. Без анимации — сразу новая. */
function Ticker({ from, to, run }: { from: number; to: number; run: boolean }) {
  const [value, setValue] = useState(to)
  // до первого кадра: передняя карточка начинает со старой цены, без мигания новой
  useLayoutEffect(() => {
    if (run && !matchMedia('(prefers-reduced-motion: reduce)').matches) setValue(from)
  }, [from, run])
  useEffect(() => {
    if (!run || matchMedia('(prefers-reduced-motion: reduce)').matches) { setValue(to); return }
    let raf = 0
    const t0 = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / 900)
      const e = 1 - (1 - t) ** 3
      // шаг 100 сом — цифры не мельтешат
      setValue(t < 1 ? Math.round((from + (to - from) * e) / 100) * 100 : to)
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [from, to, run])
  return <>{formatSom(value)}</>
}

/** Число в заголовке («34%») набирается от нуля, когда фраза появляется. */
function CountUp({ value }: { value: number }) {
  const [n, setN] = useState(value)
  useLayoutEffect(() => {
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) setN(0)
  }, [value])
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { setN(value); return }
    let raf = 0
    const t0 = performance.now() + 250
    const tick = (now: number) => {
      const t = Math.max(0, Math.min(1, (now - t0) / 700))
      setN(Math.round(value * (1 - (1 - t) ** 3)))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value])
  return <>{n}</>
}

/**
 * Заголовок по словам: слова всплывают по очереди; в слове с номером mark число (count)
 * набирается от нуля. key на фазе перезапускает анимацию.
 */
function SaleTitle({ text, mark, count }: { text: string; mark: number; count?: number }) {
  return <>{text.split(' ').map((w, i) => {
    const num = count !== undefined && i === mark ? /^(\D*)(\d+)(.*)$/.exec(w) : null
    const body = num ? <>{num[1]}<CountUp value={count!} />{num[3]}</> : w
    return <span key={i} className="hr__word" style={{ animationDelay: `${i * 70}ms` }}>{body}{' '}</span>
  })}</>
}

export function HomeStorySale({ cards }: { cards: SaleCard[] }) {
  const { lang } = useI18n()
  const root = useRef<HTMLElement>(null)
  // самая большая скидка — сверху колоды, веер идёт к концу списка
  const deck = cards
  const end = Math.max(0, deck.length - 1)
  const { phase, focus } = useFanDeck(root, { start: 0, end, spread: .6 })
  const front = deck[Math.min(focus, end)]

  /** Миниатюра под кнопкой: прокрутить ровно к моменту, когда эта карточка впереди. */
  const goTo = (i: number) => {
    const el = root.current
    if (!el) return
    // обратная к useFanDeck: k = end · smooth((p − 0.3) / 0.65)
    const u = end ? i / end : 0
    let lo = 0, hi = 1
    for (let n = 0; n < 20; n++) { const t = (lo + hi) / 2; if (t * t * (3 - 2 * t) < u) lo = t; else hi = t }
    const p = .3 + .65 * lo
    const header = parseFloat(el.style.getPropertyValue('--story-top')) || 0
    const top = el.getBoundingClientRect().top + scrollY - header + p * deckTravel(el)
    scrollTo({ top, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  }
  const ky = lang === 'ky'
  const max = discountPct(cards[0])
  const titles = ky
    ? ['Техникага арзандатуулар.', `${max}% чейин үнөмдөңүз.`, 'Кампада бар кезде үлгүрүңүз.']
    : ['Скидки на технику.', `Экономия до ${max}%.`, 'Успейте, пока есть на складе.']
  // в каком слове второй фразы число скидки — оно набирается от нуля
  const marks = ky ? [0, 0, 0] : [0, 2, 0]
  const notes = ky
    ? ['Дүкөндө бар техниканын баасы түштү.', 'Эң чоң арзандатуу — биринчи.', 'Карточканы басыңыз — товар ачылат.']
    : ['Цены снижены на технику, которая есть в магазине.', 'Самая большая скидка — первой.', 'Нажмите на карточку — откроется товар.']

  return <section ref={root} className="hr hr--kitchens hr--sale" lang={ky ? 'ky' : 'ru'} aria-label={ky ? 'Арзандатуулар' : 'Скидки'}>
    <div className="hr__stage">
      <div className="hk__deck">
        {/* огромная скидка передней карточки позади колоды — меняется вместе с карточкой */}
        {front && <span className="hs__big" key={front.id} aria-hidden="true">−{discountPct(front)}%</span>}
        {deck.map((c, i) => {
          const name = ky ? c.nameKy : c.nameRu
          return <Link key={c.id} className="hk__card hs__card" href={`/${lang}/product/${c.id}`} aria-label={`${name}, ${formatSom(c.price)}`}
            style={{ zIndex: 100 - i * 10, opacity: i > 3 ? 0 : 1 }}>
            <span className="hs__badge" aria-hidden="true">−{discountPct(c)}%</span>
            <span className="hs__media">
              <img className="hs__photo" src={c.image} alt="" width="600" height="600" loading={i < 3 ? 'eager' : 'lazy'}
                onError={(e) => { e.currentTarget.style.visibility = 'hidden' }} />
            </span>
            <span className="hs__name">{name}</span>
            <span className="hs__prices" aria-hidden="true">
              <b><Ticker from={c.oldPrice} to={c.price} run={i === focus} /></b>
              <s>{formatSom(c.oldPrice)}</s>
            </span>
          </Link>
        })}
      </div>
      <div className="hr__copy">
        <h1 key={`t${phase}`}><SaleTitle text={titles[phase]} mark={marks[phase]} count={phase === 1 ? max : undefined} /></h1>
        <p key={`n${phase}`} className="hr__note">{notes[phase]}</p>
        <Link className="btn btn--primary hr__cta" href={`/${lang}/catalog?sale=1`}>{ky ? 'Бардык арзандатуулар' : 'Все скидки'}<IconArrowUpRight size={18} /></Link>
        <span className="hr__hint">{ky ? 'Сыдырыңыз — карточкалар алмашат' : 'Листайте — карточки сменятся'}<IconArrowDown size={16} /></span>
        <div className="hs__rail">
          {deck.map((c, i) => <button key={c.id} type="button" className="hs__thumb" data-current={i === focus || undefined}
            aria-label={ky ? c.nameKy : c.nameRu} onClick={() => goTo(i)}>
            <img src={c.image} alt="" width="96" height="96" loading="lazy" onError={(e) => { e.currentTarget.style.visibility = 'hidden' }} />
          </button>)}
        </div>
      </div>
      <div className="hr__footer"><span className="hs__tag"><i aria-hidden="true" />Акция · {ky ? `${deck.length} товар` : `${deck.length} ${deck.length < 5 ? 'товара' : 'товаров'}`}</span>
        {/* только на телефоне: подсказки под кнопкой там нет. Тёмная плашка «↓ Листайте вниз» и точки — сколько скидок
            и какая сейчас впереди; на последней карточке надпись прячется, остаются точки */}
        <span className="hs__scroll" aria-hidden="true" data-last={focus >= end || undefined}>
          <span className="hs__scroll-say"><IconArrowDown size={14} />{ky ? 'Ылдый сыдырыңыз' : 'Листайте вниз'}</span>
          <span className="hs__dots">{deck.map((c, i) => <i key={c.id} data-on={i === focus || undefined} />)}</span>
        </span>
        <span className="hs__count" aria-hidden="true">0{focus + 1} / 0{deck.length}</span></div>
      <div className="hr__progress" aria-hidden="true" />
    </div>
  </section>
}
