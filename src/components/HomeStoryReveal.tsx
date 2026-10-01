'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { oneCCategories } from '@/data/1c/categories'
import './home-story-reveal.css'
import { IconArrowDown, IconArrowUpRight } from './Icons'

/**
 * Сцена «Дом просыпается», новые варианты (классический — HomeStory). Один кадр кухни,
 * один ход прокрутки, разный «вход» в кадр:
 *  • reveal  — окно раскрывается во весь блок, камера идёт к стирке, на технике точки-ссылки;
 *  • collage — фото техники разбросаны, как снимки на столе, и слетаются в один кадр;
 *  • shutter — кадр собирается из шести полос, как жалюзи;
 *  • word    — огромное «ДОМ» с кухней внутри букв, камера пролетает сквозь слово;
 *  • marquee — бегущие названия разделов, карточка кадра растёт до полного блока.
 * Финальная раскладка, шрифты и кнопки — как у классической сцены.
 * Движутся только transform и opacity (дёшево для телефона); clip-path — только у reveal.
 */
export type StoryMode = 'reveal' | 'collage' | 'shutter' | 'word' | 'marquee'

/** Точки на технике: координаты в процентах исходного кадра 1672×941.
 * Холодильника нет: на desktop он стоит под заголовком. */
const SPOTS = [
  { id: 'oven', x: 39.6, y: 47.8, cat: 'kitchen', ru: 'Духовые шкафы', ky: 'Духовкалар', on: .32 },
  { id: 'coffee', x: 47.5, y: 36.4, cat: 'small-kitchen', ru: 'Кофемашины', ky: 'Кофе машиналары', on: .39 },
  { id: 'dishwasher', x: 63.2, y: 50.8, cat: 'kitchen', ru: 'Посудомоечные машины', ky: 'Идиш жуугучтар', on: .46 },
  { id: 'washer', x: 76.2, y: 44.6, cat: 'washers', ru: 'Стиральные машины', ky: 'Кир жуугуч машиналар', on: .53 },
  { id: 'robot', x: 27.7, y: 78.9, cat: 'care', ru: 'Роботы-пылесосы', ky: 'Робот чаң соргучтар', on: .6 },
] as const

const STRIPS = 6

/**
 * Коллаж: окна в кадр вокруг техники (проценты кадра 1672×941) и где каждое лежит на старте —
 * сдвиг в долях ширины сцены и поворот. Слетаются на свои места — кадр складывается без шва.
 */
const PIECES = [
  { x: 41.5, y: 29, w: 12, h: 16, dx: .12, dy: -.1, rot: -9, at: 0 },
  { x: 33, y: 39.5, w: 13.5, h: 17, dx: .2, dy: .12, rot: 7, at: .03 },
  { x: 58, y: 40, w: 11.5, h: 22, dx: .1, dy: .2, rot: -5, at: .06 },
  { x: 70, y: 34, w: 12.5, h: 22, dx: -.02, dy: -.06, rot: 8, at: .09 },
  { x: 21, y: 71, w: 13, h: 15, dx: .34, dy: -.08, rot: -6, at: .12 },
] as const

type Key = { p: number; s: number; x: number; y: number }
/** Опорные кадры камеры: прогресс → приближение и сдвиг (доля ширины сцены). */
const CAMERA: Record<StoryMode, Key[]> = {
  reveal: [
    { p: 0, s: 1.45, x: .08, y: .02 },
    { p: .3, s: 1.3, x: .07, y: 0 },
    { p: .62, s: 1.24, x: -.08, y: .01 },
    { p: .86, s: 1, x: 0, y: 0 },
    { p: 1, s: 1, x: 0, y: 0 },
  ],
  collage: [{ p: 0, s: 1, x: 0, y: 0 }, { p: 1, s: 1, x: 0, y: 0 }],
  shutter: [{ p: 0, s: 1.12, x: 0, y: 0 }, { p: .9, s: 1, x: 0, y: 0 }, { p: 1, s: 1, x: 0, y: 0 }],
  word: [{ p: 0, s: 1.25, x: 0, y: 0 }, { p: .8, s: 1, x: 0, y: 0 }, { p: 1, s: 1, x: 0, y: 0 }],
  marquee: [{ p: 0, s: 1.2, x: 0, y: 0 }, { p: .8, s: 1, x: 0, y: 0 }, { p: 1, s: 1, x: 0, y: 0 }],
}

const clamp = (v: number) => Math.max(0, Math.min(1, v))
const smooth = (t: number) => t * t * (3 - 2 * t)
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

function camera(keys: Key[], p: number) {
  let i = 0
  while (i < keys.length - 2 && p > keys[i + 1].p) i++
  const a = keys[i], b = keys[i + 1]
  const t = smooth(clamp((p - a.p) / (b.p - a.p)))
  return { s: lerp(a.s, b.s, t), x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) }
}

/** Слова заголовка всплывают по очереди; key на фазе перезапускает анимацию. */
export function Words({ text }: { text: string }) {
  return <>{text.split(' ').map((w, i) => <span key={i} className="hr__word" style={{ animationDelay: `${i * 70}ms` }}>{w}{' '}</span>)}</>
}

function Photo({ priority = true }: { priority?: boolean }) {
  return <div className="hr__frame">
    <img className="hr__image" src="/home-story/home-awakens-1672.webp" srcSet="/home-story/home-awakens-640.webp 640w, /home-story/home-awakens-1024.webp 1024w, /home-story/home-awakens-1672.webp 1672w" sizes="(max-width: 900px) 150vw, 1672px" alt="" width="1672" height="941" fetchPriority={priority ? 'high' : 'auto'} />
  </div>
}

export function HomeStoryReveal({ mode = 'reveal' }: { mode?: StoryMode }) {
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
  const rows = oneCCategories.slice(0, 9).map((c) => (ky ? c.nameKy : c.nameRu))

  useEffect(() => {
    const el = root.current
    if (!el) return
    const media = matchMedia('(prefers-reduced-motion: reduce)')
    const spots = Array.from(el.querySelectorAll<HTMLElement>('.hr__spot'))
    const strips = Array.from(el.querySelectorAll<HTMLElement>('.hr__strip'))
    const pieces = Array.from(el.querySelectorAll<HTMLElement>('.hr__piece'))
    const keys = CAMERA[mode]
    let frame = 0
    let lastPhase = -1
    const set = (name: string, value: number | string) => el.style.setProperty(name, typeof value === 'number' ? value.toFixed(4) : value)
    const update = () => {
      frame = 0
      const header = document.querySelector('.header')?.getBoundingClientRect().height ?? 0
      const stage = el.querySelector<HTMLElement>('.hr__stage')!
      const travel = el.offsetHeight - stage.offsetHeight
      const p = media.matches ? 1 : clamp((header + 8 - el.getBoundingClientRect().top) / Math.max(1, travel))
      set('--story-top', `${header + 8}px`)
      const cam = camera(keys, p)
      set('--s', cam.s)
      set('--tx', `${(cam.x * 100).toFixed(3)}%`)
      set('--ty', `${(cam.y * 100).toFixed(3)}%`)
      set('--story-progress', p)
      // вход в кадр: 0 — ещё не вошли, 1 — кадр во весь блок
      const enter = smooth(clamp(p / (mode === 'shutter' ? .42 : mode === 'word' ? .4 : mode === 'collage' ? .5 : .32)))
      set('--r', enter)
      if (mode === 'collage') {
        // снимки слетаются за первые 40 % хода, потом вокруг них проявляется вся комната
        const w = stage.offsetWidth
        pieces.forEach((node, i) => {
          const c = PIECES[i]
          const t = 1 - smooth(clamp((p - c.at) / .36))
          node.style.transform = `translate3d(${(c.dx * w * t).toFixed(1)}px, ${(c.dy * w * t).toFixed(1)}px, 0) rotate(${(c.rot * t).toFixed(2)}deg) scale(${(1 + .08 * t).toFixed(3)})`
          node.style.setProperty('--paper', t.toFixed(3))
        })
        set('--room', smooth(clamp((p - .3) / .2)))
      }
      if (mode === 'word') set('--k', lerp(1, 7, enter ** 1.6))
      if (mode === 'marquee') set('--row', p)
      strips.forEach((strip, i) => {
        // соседние полосы приходят с разных сторон. На старте все выглядывают на треть —
        // ровная «шахматка»; в середине хода — волна с задержкой по полосам; в конце кадр цельный.
        const run = clamp(p / .42)
        const t = smooth(clamp(.3 + .7 * run - i * .07 * Math.sin(Math.PI * run)))
        strip.style.transform = `translate3d(0, ${((i % 2 ? -1 : 1) * (1 - t) * 104).toFixed(2)}%, 0)`
      })
      el.dataset.progress = p.toFixed(3)
      const ph = p < .3 ? 0 : p < .72 ? 1 : 2
      if (ph !== lastPhase) { lastPhase = ph; setPhase(ph) }
      if (spots.length) {
        // подпись видна у последней загоревшейся точки, пока идёт средняя фаза
        let active = -1
        SPOTS.forEach((s, i) => { if (p >= s.on) active = i })
        spots.forEach((node, i) => {
          node.toggleAttribute('data-on', p >= SPOTS[i].on)
          node.toggleAttribute('data-active', ph === 1 && i === active)
        })
      }
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
  }, [mode])

  return <section ref={root} className={`hr hr--${mode}`} aria-label={ky ? 'Үйүңүз үчүн техника' : 'Техника для вашего дома'}>
    <div className="hr__stage">
      {mode === 'marquee' && <div className="hr__rows" aria-hidden="true">
        {[0, 1, 2].map((r) => <div key={r} className="hr__row">{[...rows.slice(r * 3), ...rows, ...rows].join(' · ')}</div>)}
      </div>}
      <div className="hr__scene">
        <div className="hr__clip">
          {mode === 'shutter'
            ? <div className="hr__cam" aria-hidden="true">
              {Array.from({ length: STRIPS }, (_, i) => <div key={i} className="hr__strip" style={{ left: `${(i * 100) / STRIPS}%` }}>
                <div className="hr__strip-in" style={{ left: `${-i * 100}%` }}><Photo priority={i === 0} /></div>
              </div>)}
            </div>
            : <div className="hr__cam hr__room" aria-hidden="true"><Photo /></div>}
          {mode === 'collage' && <div className="hr__cam" aria-hidden="true">
            <div className="hr__frame">
              {PIECES.map((c, i) => <div key={i} className="hr__piece" style={{ left: `${c.x}%`, top: `${c.y}%`, width: `${c.w}%`, height: `${c.h}%` }}>
                <img src="/home-story/home-awakens-1024.webp" alt="" style={{ width: `${10000 / c.w}%`, height: `${10000 / c.h}%`, left: `${(-100 * c.x) / c.w}%`, top: `${(-100 * c.y) / c.h}%` }} />
              </div>)}
            </div>
          </div>}
          <div className="hr__wash" aria-hidden="true" />
          {mode === 'reveal' && <div className="hr__cam">
            <div className="hr__frame">
              {SPOTS.map((s) => <Link key={s.id} className="hr__spot" style={{ left: `${s.x}%`, top: `${s.y}%` }} href={`/${lang}/catalog?cat=${s.cat}`}>
                <span className="hr__dot" aria-hidden="true" />
                <span className="hr__label">{ky ? s.ky : s.ru}<IconArrowUpRight size={14} /></span>
              </Link>)}
            </div>
          </div>}
        </div>
        {mode === 'word' && <div className="hr__knock" aria-hidden="true"><span>{ky ? 'ҮЙ' : 'ДОМ'}</span></div>}
      </div>
      <div className="hr__copy">
        <h1 key={`t${phase}`}><Words text={titles[phase]} /></h1>
        <p key={`n${phase}`} className="hr__note">{notes[phase]}</p>
        <Link className="btn btn--primary hr__cta" href={`/${lang}/catalog?cat=home`}>{ky ? 'Техниканы тандоо' : 'Выбрать технику'}<IconArrowUpRight size={18} /></Link>
        <span className="hr__hint">{ky ? 'Үйүңүздү жаңыча көрүңүз' : 'Откройте дом по-новому'}<IconArrowDown size={16} /></span>
      </div>
      <div className="hr__footer"><span>{ky ? 'Интерьердин концепциясы' : 'Концепция интерьера'}</span><span aria-hidden="true">0{phase + 1} / 03</span></div>
      <div className="hr__progress" aria-hidden="true" />
    </div>
  </section>
}
