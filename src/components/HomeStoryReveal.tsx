'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useI18n } from '@/lib/i18n/I18nProvider'
import './home-story-reveal.css'
import { IconArrowDown, IconArrowUpRight } from './Icons'

/**
 * Сцена «Дом просыпается», новые варианты (классический — HomeStory, остаётся запасным):
 *  • reveal — окно раскрывается во весь экран, камера проходит по кухне к стирке,
 *    на технике загораются точки-ссылки;
 *  • glow — тот же кадр от утра к вечеру: тёплый свет, загораются лампы и подсветка.
 * Вид, шрифты и финальная раскладка — как у классической сцены.
 */
export type StoryMode = 'reveal' | 'glow'

/** Точки на технике: координаты в процентах исходного кадра 1672×941.
 * Холодильника нет: на desktop он стоит под заголовком. */
const SPOTS = [
  { id: 'oven', x: 39.6, y: 47.8, cat: 'kitchen', ru: 'Духовые шкафы', ky: 'Духовкалар', on: .32, off: 2 },
  { id: 'coffee', x: 47.5, y: 36.4, cat: 'small-kitchen', ru: 'Кофемашины', ky: 'Кофе машиналары', on: .39, off: 2 },
  { id: 'dishwasher', x: 63.2, y: 50.8, cat: 'kitchen', ru: 'Посудомоечные машины', ky: 'Идиш жуугучтар', on: .46, off: 2 },
  { id: 'washer', x: 76.2, y: 44.6, cat: 'washers', ru: 'Стиральные машины', ky: 'Кир жуугуч машиналар', on: .53, off: 2 },
  { id: 'robot', x: 27.7, y: 78.9, cat: 'care', ru: 'Роботы-пылесосы', ky: 'Робот чаң соргучтар', on: .6, off: 2 },
] as const

/** Опорные кадры камеры: прогресс → приближение и сдвиг (доля ширины сцены). */
const CAMERA_REVEAL = [
  { p: 0, s: 1.45, x: .08, y: .02 },
  { p: .3, s: 1.3, x: .07, y: 0 },
  { p: .62, s: 1.24, x: -.08, y: .01 },
  { p: .86, s: 1, x: 0, y: 0 },
  { p: 1, s: 1, x: 0, y: 0 },
]
/** «Утро → вечер»: медленный отъезд камеры, как в классической сцене. */
const CAMERA_GLOW = [
  { p: 0, s: 1.4, x: 0, y: 0 },
  { p: 1, s: 1, x: 0, y: 0 },
]

const clamp = (v: number) => Math.max(0, Math.min(1, v))
const smooth = (t: number) => t * t * (3 - 2 * t)

function camera(CAMERA: typeof CAMERA_REVEAL, p: number) {
  let i = 0
  while (i < CAMERA.length - 2 && p > CAMERA[i + 1].p) i++
  const a = CAMERA[i], b = CAMERA[i + 1]
  const t = smooth(clamp((p - a.p) / (b.p - a.p)))
  return { s: a.s + (b.s - a.s) * t, x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
}

/** Слова заголовка всплывают по очереди; key на фазе перезапускает анимацию. */
export function Words({ text }: { text: string }) {
  return <>{text.split(' ').map((w, i) => <span key={i} className="hr__word" style={{ animationDelay: `${i * 70}ms` }}>{w}{' '}</span>)}</>
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

  useEffect(() => {
    const el = root.current
    if (!el) return
    const media = matchMedia('(prefers-reduced-motion: reduce)')
    const spots = Array.from(el.querySelectorAll<HTMLElement>('.hr__spot'))
    let frame = 0
    const update = () => {
      frame = 0
      const header = document.querySelector('.header')?.getBoundingClientRect().height ?? 0
      el.style.setProperty('--story-top', `${header + 8}px`)
      const stage = el.querySelector<HTMLElement>('.hr__stage')!
      const travel = el.offsetHeight - stage.offsetHeight
      const p = media.matches ? 1 : clamp((header + 8 - el.getBoundingClientRect().top) / Math.max(1, travel))
      const glow = mode === 'glow'
      const cam = camera(glow ? CAMERA_GLOW : CAMERA_REVEAL, p)
      el.style.setProperty('--r', glow ? '1' : smooth(clamp(p / .3)).toFixed(4))
      // утро гаснет к середине, вечер разгорается во второй половине
      el.style.setProperty('--morning', (1 - smooth(clamp(p / .45))).toFixed(4))
      el.style.setProperty('--evening', smooth(clamp((p - .4) / .45)).toFixed(4))
      el.style.setProperty('--s', cam.s.toFixed(4))
      el.style.setProperty('--tx', `${(cam.x * 100).toFixed(3)}%`)
      el.style.setProperty('--ty', `${(cam.y * 100).toFixed(3)}%`)
      el.style.setProperty('--story-progress', p.toFixed(4))
      el.dataset.progress = p.toFixed(3)
      const ph = p < .3 ? 0 : p < .72 ? 1 : 2
      setPhase(ph)
      // Подпись видна у последней загоревшейся точки, пока идёт средняя фаза.
      let active = -1
      SPOTS.forEach((s, i) => { if (p >= s.on && p < s.off) active = i })
      spots.forEach((node, i) => {
        const s = SPOTS[i]
        node.toggleAttribute('data-on', p >= s.on && p < s.off)
        node.toggleAttribute('data-active', ph === 1 && i === active)
      })
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
      <div className="hr__scene">
        <div className="hr__cam" aria-hidden="true">
          <div className="hr__frame">
            <img className="hr__image" src="/home-story/home-awakens-1672.webp" srcSet="/home-story/home-awakens-640.webp 640w, /home-story/home-awakens-1024.webp 1024w, /home-story/home-awakens-1672.webp 1672w" sizes="(max-width: 600px) 150vw, (max-width: 900px) 150vw, 1672px" alt="" width="1672" height="941" fetchPriority="high" />
            {mode === 'glow' && <>
              <span className="hr__light hr__light--morning" />
              <span className="hr__light hr__light--sun" />
              <span className="hr__light hr__light--evening" />
              <span className="hr__light hr__light--lamp" style={{ left: '25.6%' }} />
              <span className="hr__light hr__light--lamp" style={{ left: '31.6%' }} />
              <span className="hr__light hr__light--strip" />
              <span className="hr__light hr__light--oven" />
            </>}
          </div>
        </div>
        <div className="hr__wash" aria-hidden="true" />
        <div className="hr__cam">
          <div className="hr__frame">
            {mode === 'reveal' && SPOTS.map((s) => <Link key={s.id} className="hr__spot" style={{ left: `${s.x}%`, top: `${s.y}%` }} href={`/${lang}/catalog?cat=${s.cat}`}>
              <span className="hr__dot" aria-hidden="true" />
              <span className="hr__label">{ky ? s.ky : s.ru}<IconArrowUpRight size={14} /></span>
            </Link>)}
          </div>
        </div>
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
