'use client'

import Link from 'next/link'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { STYLES } from '@/lib/kitchen/styles'
import './kitchen-promo.css'

/**
 * Приглашение в 3D-конструктор кухни на главной. Картинка — настоящий кадр
 * из самого конструктора (public/kitchen/promo-*.webp), а не макет.
 */
export function KitchenPromo() {
  const { lang } = useI18n()
  const ky = lang === 'ky'
  return (
    <section className="section kitchen-promo" aria-labelledby="kitchen-promo-title" data-reveal>
      <Link href={`/${lang}/kitchen`} className="kitchen-promo__link">
        <div className="kitchen-promo__text">
          <h2 className="kitchen-promo__title" id="kitchen-promo-title">
            {ky ? 'Ашканаңызды 3D форматта чогултуңуз' : 'Соберите свою кухню в 3D'}
          </h2>
          <p className="kitchen-promo__lead">
            {ky
              ? 'Формасын, өлчөмүн жана стилин тандаңыз — ага биздин техниканы өз өлчөмүндө коюп көрүңүз. Мебелчи үчүн тизме да даяр болот.'
              : 'Выберите форму, размер стен и стиль — и примерьте нашу технику в её настоящем размере. Список для мебельщика получится сам.'}
          </p>
          <ul className="kitchen-promo__styles" aria-label={ky ? 'Стилдер' : 'Стили'}>
            {STYLES.map((s) => (
              <li key={s.id}>
                <span className="kitchen-promo__dot" style={{ background: s.tones[0].facade }} />
                {ky ? s.ky : s.ru}
              </li>
            ))}
          </ul>
          <span className="btn btn--primary kitchen-promo__cta">{ky ? 'Конструкторду ачуу' : 'Открыть конструктор'}</span>
        </div>
        <picture className="kitchen-promo__media">
          <source media="(max-width: 700px)" srcSet="/kitchen/promo-960.webp" />
          <img
            src="/kitchen/promo-1600.webp"
            width={1600}
            height={1000}
            loading="lazy"
            decoding="async"
            alt={ky ? 'Конструктордо чогултулган скандинав стилиндеги ашкана' : 'Кухня в скандинавском стиле, собранная в конструкторе'}
          />
        </picture>
      </Link>
    </section>
  )
}
