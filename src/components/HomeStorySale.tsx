'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { formatSom } from '@/lib/format'
import { discountPct, type SaleCard } from '@/lib/hero-sale'
import { deckTravel, storyTop, useFanDeck } from './HomeStoryKitchens'
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
  // последняя карточка колоды — «Все скидки» (ведёт в каталог), поэтому веер идёт на одну дальше товаров
  const end = deck.length
  const last = deck.length - 1
  const { phase, focus } = useFanDeck(root, { start: 0, end, spread: .6 })
  // на карточке «Все скидки» огромного «−N%» нет
  const front = deck[focus]

  /**
   * Положение колоды одним числом s: 0…end — какая карточка впереди (дробное — между карточками),
   * −OPEN…0 — колода ещё раскрывается в веер. Прокрутка страницы и палец двигают одно и то же s.
   */
  const OPEN = .5
  const smooth = (t: number) => t * t * (3 - 2 * t)
  const clampS = (v: number) => Math.max(-OPEN, Math.min(end, v))
  /** s → ход сцены p (обратная к useFanDeck: k = end · smooth((p − 0.3) / 0.65)) */
  const progressOf = (v: number) => {
    if (v < 0 || !end) return .3 * (1 + Math.min(0, v) / OPEN)
    const u = Math.min(1, v / end)
    let lo = 0, hi = 1
    for (let n = 0; n < 20; n++) { const t = (lo + hi) / 2; if (smooth(t) < u) lo = t; else hi = t }
    return .3 + .65 * lo
  }
  const geometry = () => {
    const el = root.current!
    // линию шапки меряем заново: переменная сцены обновляется только на прокрутке, а палец мог прийти раньше
    return { el, header: storyTop(), travel: deckTravel(el), top: el.getBoundingClientRect().top }
  }
  const scrollToS = (v: number, behavior: ScrollBehavior) => {
    if (!root.current) return
    const g = geometry()
    scrollTo({ top: g.top + scrollY - g.header + progressOf(v) * g.travel, behavior })
  }
  const nowS = () => {
    const g = geometry()
    const p = Math.max(0, Math.min(1, (g.header - g.top) / g.travel))
    return p < .3 ? OPEN * (p / .3 - 1) : end * smooth(Math.min(1, (p - .3) / .65))
  }
  const calm = () => (matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth')

  /** Миниатюра под кнопкой: прокрутить ровно к моменту, когда эта карточка впереди. */
  const goTo = (i: number) => scrollToS(i, calm())

  /**
   * Телефон: колоду можно вести пальцем вбок, как прокрутку. Палец влево — веер едет за ним к следующим скидкам,
   * вправо — назад; передняя карточка идёт ровно под пальцем. Отпустили — колода докатывается до ближайшей
   * карточки (быстрый взмах — на следующую). Двигаем ту же прокрутку страницы, поэтому листать вниз можно как раньше.
   */
  type Drag = { x: number; y: number; s0: number; s: number; on: boolean; w: number; lastX: number; lastT: number; vx: number }
  const drag = useRef<Drag | null>(null)
  const swiped = useRef(false)
  const onDeckDown = (e: React.PointerEvent<HTMLDivElement>) => {
    swiped.current = false
    if (e.pointerType === 'mouse' || !root.current) { drag.current = null; return }
    const card = root.current.querySelector<HTMLElement>('.hk__card')
    const s0 = nowS()
    drag.current = { x: e.clientX, y: e.clientY, s0, s: s0, on: false, w: Math.max(40, (card?.offsetWidth ?? 160) * .6),
      lastX: e.clientX, lastT: e.timeStamp, vx: 0 }
  }
  const onDeckMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d) return
    const dx = e.clientX - d.x, dy = e.clientY - d.y
    if (!d.on) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return
      // больше вниз, чем вбок — это прокрутка страницы, её ведёт браузер
      if (Math.abs(dx) < Math.abs(dy) * 1.2) { drag.current = null; return }
      d.on = true
      // палец ушёл с колоды — движения всё равно приходят сюда (если браузер не дал захватить — не беда)
      try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* без захвата */ }
    }
    const dt = e.timeStamp - d.lastT
    // скорость пальца, px/мс; слишком частые события и рывки не считаем — не больше ±2 px/мс
    if (dt >= 4) {
      d.vx = Math.max(-2, Math.min(2, .7 * ((e.clientX - d.lastX) / dt) + .3 * d.vx))
      d.lastX = e.clientX
      d.lastT = e.timeStamp
    }
    const next = clampS(d.s0 - dx / d.w)
    if (next === d.s) return
    d.s = next
    scrollToS(next, 'instant')
  }
  const onDeckEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    drag.current = null
    if (!d?.on) return
    swiped.current = true
    const dx = e.clientX - d.x
    // в начале колоды палец вправо — оставляем как есть, страницу назад не дёргаем
    if (d.s <= 0 && dx > 0) return
    // взмах: колода докатывается по инерции (~0,12 с полёта — до трёх карточек)
    const target = Math.max(0, Math.min(end, Math.round(d.s - (d.vx * 120) / d.w)))
    scrollToS(target, calm())
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
      <div className="hk__deck" onPointerDown={onDeckDown} onPointerMove={onDeckMove} onPointerUp={onDeckEnd} onPointerCancel={onDeckEnd}
        onClickCapture={(e) => { if (swiped.current) { e.preventDefault(); swiped.current = false } }}>
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
        {/* конец колоды — не тупик: дошли до края, а тут все скидки каталога */}
        <Link className="hk__card hs__card hs__more" href={`/${lang}/catalog?sale=1`} aria-label={ky ? 'Бардык арзандатуулар' : 'Все скидки'}
          style={{ zIndex: 100 - deck.length * 10, opacity: deck.length > 3 ? 0 : 1 }}>
          <span className="hs__media hs__grid" aria-hidden="true">
            {deck.slice(0, 4).map((c) => <img key={c.id} src={c.image} alt="" width="200" height="200" loading="lazy"
              onError={(e) => { e.currentTarget.style.visibility = 'hidden' }} />)}
          </span>
          <span className="hs__name">{ky ? 'Бардык арзандатуулар' : 'Все скидки'}</span>
          {/* невидимые цены держат высоту ровно как у соседних карточек; поверх — «Смотреть в каталоге» */}
          <span className="hs__prices hs__go" aria-hidden="true">
            <b className="hs__ghost">{formatSom(deck[0].price)}</b><s className="hs__ghost">{formatSom(deck[0].oldPrice)}</s>
            <span className="hs__go-text">{ky ? 'Каталогдон көрүү' : 'Смотреть в каталоге'}<IconArrowUpRight size={16} /></span>
          </span>
        </Link>
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
          <span className="hs__dots">{deck.map((c, i) => <i key={c.id} data-on={i === Math.min(focus, last) || undefined} />)}</span>
        </span>
        <span className="hs__count" aria-hidden="true">0{Math.min(focus, last) + 1} / 0{deck.length}</span></div>
      <div className="hr__progress" aria-hidden="true" />
    </div>
  </section>
}
