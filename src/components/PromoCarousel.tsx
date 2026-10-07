'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { products, type Product } from '@/data/products'
import { formatSom } from '@/lib/format'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { PERFUME } from '@/lib/partners'
import { IconArrowUpRight, IconChevronRight } from './Icons'
import './ad-band.css'

/**
 * Рекламный баннер под разделами (владелец 07.10: «бошқа баннер — товарлар рекламаси ва Kemal Usman»).
 * Слайды: «Новинка», «Хит» (или самая большая скидка) из меток 1С — разные товары — и наш магазин парфюмерии
 * вторым слайдом. Сам листается раз в 5 с; палец, мышь над баннером, фокус клавиатуры и «меньше движения»
 * в настройках телефона останавливают. Лента — обычная прокрутка вбок с привязкой: палец на телефоне работает сам.
 */
type Mark = 'sale' | 'new' | 'hit'
export type PromoSlide = { kind: 'product'; mark: Mark; product: Product } | { kind: 'perfume' }

const purchasable = (p: Product) => p.price > 0 && Boolean(p.image) && p.variants.some((v) => v.stock > 0)

/**
 * Слайды по меткам 1С: новинка, хит, иначе самая большая скидка — без повторов; парфюмерия — второй.
 * «Товар дня» сюда не берём: блок «Товар дня» стоит сразу под баннером, и один товар шёл два раза подряд (07.10).
 */
export function promoSlides(list: Product[]): PromoSlide[] {
  const taken = new Set<string>()
  const pick = (mark: Mark, test: (p: Product) => boolean): PromoSlide[] => {
    const p = list.find((x) => purchasable(x) && !x.dealOfDay && !taken.has(x.id) && test(x))
    if (!p) return []
    taken.add(p.id)
    return [{ kind: 'product', mark, product: p }]
  }
  const found = [...pick('new', (p) => p.badge === 'new'), ...pick('hit', (p) => p.badge === 'hit')]
  if (found.length < 2) {
    const sale = [...list].sort((a, b) => discount(b) - discount(a)).find((p) => discount(p) > 0 && purchasable(p) && !p.dealOfDay && !taken.has(p.id))
    if (sale) found.push({ kind: 'product', mark: 'sale', product: sale })
  }
  return [...found.slice(0, 1), { kind: 'perfume' }, ...found.slice(1)]
}

const discount = (p: Product) => (p.oldPrice && p.oldPrice > p.price && p.price > 0 ? (p.oldPrice - p.price) / p.oldPrice : 0)

const WORDS = {
  ru: { sale: 'Скидка', new: 'Новинка', hit: 'Хит продаж', more: 'Подробнее', label: 'Реклама', slide: 'Слайд',
    perfumeChip: 'Наш магазин', perfumeTitle: 'Парфюмерия Kemal Usman', perfumeText: 'Оригинальные ароматы на разлив', perfumeCta: 'Перейти на сайт' },
  ky: { sale: 'Арзандатуу', new: 'Жаңы', hit: 'Хит', more: 'Кененирээк', label: 'Жарнама', slide: 'Слайд',
    perfumeChip: 'Биздин дүкөн', perfumeTitle: 'Kemal Usman парфюмериясы', perfumeText: 'Түп нуска жыттар, куюп сатылат', perfumeCta: 'Сайтка өтүү' },
}

export function PromoCarousel() {
  const { lang } = useI18n()
  const w = WORDS[lang === 'ky' ? 'ky' : 'ru']
  const [slides] = useState(() => promoSlides(products))
  const track = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)
  const hold = useRef(false)

  // какой слайд сейчас на экране — по прокрутке ленты (палец, колесо, точки — всё сюда)
  useEffect(() => {
    const el = track.current
    if (!el) return
    const onScroll = () => setActive(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)))
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  const go = (i: number) => {
    const el = track.current
    if (!el) return
    const calm = matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollTo({ left: i * el.clientWidth, behavior: calm ? 'auto' : 'smooth' })
  }

  useEffect(() => {
    if (slides.length < 2 || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const id = window.setInterval(() => {
      const el = track.current
      // не листаем, пока человек читает (мышь, палец, фокус) и пока баннер не на экране / вкладка скрыта
      if (!el || hold.current || document.hidden) return
      const box = el.getBoundingClientRect()
      if (box.bottom < 0 || box.top > innerHeight) return
      go((Math.round(el.scrollLeft / Math.max(1, el.clientWidth)) + 1) % slides.length)
    }, 5000)
    return () => window.clearInterval(id)
  }, [slides.length])

  if (slides.length === 0) return null
  const stop = () => { hold.current = true }
  const run = () => { hold.current = false }

  return (
    <section className="adband section" aria-roledescription="carousel" aria-label={w.label}
      onMouseEnter={stop} onMouseLeave={run} onFocus={stop} onBlur={run} onTouchStart={stop} onTouchEnd={run}>
      <div className="adband__track" ref={track}>
        {slides.map((s, i) => {
          const label = `${w.slide} ${i + 1} / ${slides.length}`
          if (s.kind === 'perfume') {
            return (
              <a key="perfume" className="adband__slide adband__slide--perfume" href={PERFUME.url} target="_blank" rel="noopener"
                aria-roledescription="slide" aria-label={`${label}: ${w.perfumeTitle}`}>
                <span className="adband__text">
                  <span className="adband__chip">{w.perfumeChip}</span>
                  <span className="adband__title">{w.perfumeTitle}</span>
                  <span className="adband__sub">{w.perfumeText}</span>
                  <span className="btn btn--outline btn--sm adband__cta">{w.perfumeCta}<IconArrowUpRight size={16} /></span>
                </span>
                <span className="adband__media adband__media--logo" aria-hidden="true">
                  <img src={PERFUME.logo} alt="" width={180} height={180} loading="lazy" decoding="async" />
                </span>
              </a>
            )
          }
          const p = s.product
          const name = lang === 'ky' ? p.nameKy : p.nameRu
          return (
            <Link key={p.id} className={`adband__slide adband__slide--${s.mark}`} href={`/${lang}/product/${p.id}`}
              aria-roledescription="slide" aria-label={`${label}: ${w[s.mark]}, ${name}, ${formatSom(p.price)}`}>
              <span className="adband__text">
                <span className="adband__chip">{w[s.mark]}</span>
                <span className="adband__title adband__title--name">{name}</span>
                <span className="adband__price">
                  <b>{formatSom(p.price)}</b>
                  {p.oldPrice ? <s>{formatSom(p.oldPrice)}</s> : null}
                </span>
                <span className="btn btn--primary btn--sm adband__cta">{w.more}<IconChevronRight size={16} /></span>
              </span>
              <span className="adband__media" aria-hidden="true">
                <img src={p.image} alt="" loading={i < 2 ? 'eager' : 'lazy'} decoding="async" />
              </span>
            </Link>
          )
        })}
      </div>
      {slides.length > 1 && (
        <div className="adband__dots">
          {slides.map((s, i) => (
            <button key={s.kind === 'perfume' ? 'perfume' : s.product.id} type="button" className="adband__dot"
              aria-label={`${w.slide} ${i + 1}`} aria-current={i === active || undefined} onClick={() => go(i)} />
          ))}
        </div>
      )}
    </section>
  )
}
