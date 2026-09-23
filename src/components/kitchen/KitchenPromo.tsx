'use client'

import Link from 'next/link'
import { IconChevronRight } from '@/components/Icons'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { STYLES } from '@/lib/kitchen/styles'
import './kitchen-promo.css'

/**
 * Приглашение в 3D-конструктор кухни на главной.
 *
 * Картинка — рисунок в стиле сайта (public/kitchen/kitchen-iso.svg): угловая
 * кухня в изометрии, светлый дуб, белый верх, лимоны — как на первом экране
 * главной. Поверх — то, что человек увидит в конструкторе: размеры стен и
 * выбранный шкаф в синей рамке. Подписи — HTML, чтобы шрифт был сайтовый.
 * Рисунок строит скрипт (см. docs/HANDOFF.md, раздел про конструктор).
 *
 * Вместо облака из 15 названий стилей — три шага, как в самом конструкторе:
 * форма, стиль, техника. Так видно, что это просто и что получится в конце.
 */

const TEXT = {
  ru: {
    title: 'Соберите свою кухню в 3D',
    lead: 'Примерьте технику из наличия в её настоящем размере — до покупки и до заказа мебели.',
    steps: [
      ['Форма и размер', 'по вашим стенам, в сантиметрах'],
      ['Стиль и отделка', '15 стилей, фасады и столешницы'],
      ['Техника из наличия', 'в своём размере, с ценой'],
    ],
    cta: 'Открыть конструктор',
    bonus: 'Чертёж и список шкафов для мебельщика — бесплатно',
    alt: 'Угловая кухня в 3D-конструкторе: размеры стен подписаны, духовка выбрана',
  },
  ky: {
    title: 'Ашканаңызды 3D форматта чогултуңуз',
    lead: 'Дүкөндөгү техниканы өз өлчөмүндө коюп көрүңүз — сатып алуудан жана эмерек заказ кылуудан мурун.',
    steps: [
      ['Формасы жана өлчөмү', 'дубалдарыңызга жараша, сантиметр менен'],
      ['Стили жана жасалгасы', '15 стиль, фасаддар жана столешницалар'],
      ['Дүкөндөгү техника', 'өз өлчөмүндө, баасы менен'],
    ],
    cta: 'Конструкторду ачуу',
    bonus: 'Мебелчи үчүн чийме жана шкафтардын тизмеси — акысыз',
    alt: '3D-конструктордогу бурчтук ашкана: дубалдардын өлчөмдөрү жазылган, духовка тандалган',
  },
}

/** Пять стилей для образцов у второго шага: светлый, дерево, тёмный, цветной. */
const SWATCH_STYLES = ['hitech', 'modern', 'japandi', 'nero', 'provence']

function swatch(facade: string, texture?: string): string {
  return texture === 'wood' ? `repeating-linear-gradient(100deg, rgb(0 0 0 / 0%) 0 3px, rgb(0 0 0 / 12%) 3px 4px), ${facade}` : facade
}

export function KitchenPromo() {
  const { lang } = useI18n()
  const t = TEXT[lang === 'ky' ? 'ky' : 'ru']
  const swatches = SWATCH_STYLES.flatMap((id) => {
    const tone = STYLES.find((s) => s.id === id)?.tones[0]
    return tone ? [{ id, background: swatch(tone.facade, tone.texture) }] : []
  })
  return (
    <section className="section kitchen-promo" aria-labelledby="kitchen-promo-title" data-reveal>
      <Link href={`/${lang}/kitchen`} className="kitchen-promo__link">
        <div className="kitchen-promo__text">
          <h2 className="kitchen-promo__title" id="kitchen-promo-title">
            {t.title}
          </h2>
          <p className="kitchen-promo__lead">{t.lead}</p>
          <ol className="kitchen-promo__steps">
            {t.steps.map(([title, note], i) => (
              <li key={title} className="kitchen-promo__step">
                <span className="kitchen-promo__num" aria-hidden="true">
                  {i + 1}
                </span>
                <span className="kitchen-promo__step-text">
                  <span className="kitchen-promo__step-title">
                    {title}
                    {i === 1 && (
                      <span className="kitchen-promo__swatches" aria-hidden="true">
                        {swatches.map((sw) => (
                          <span key={sw.id} style={{ background: sw.background }} />
                        ))}
                      </span>
                    )}
                  </span>
                  <span className="kitchen-promo__step-note">{note}</span>
                </span>
              </li>
            ))}
          </ol>
          <div className="kitchen-promo__actions">
            <span className="btn btn--primary kitchen-promo__cta">
              {t.cta}
              <IconChevronRight size={18} />
            </span>
            <span className="kitchen-promo__bonus">
              <svg className="kitchen-promo__bonus-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5h-10.5A.5.5 0 0 1 6.5 20V4a.5.5 0 0 1 .5-.5ZM14 3.5v4h4M9.5 12.5h5M9.5 16h5" />
              </svg>
              {t.bonus}
            </span>
          </div>
        </div>
        <div className="kitchen-promo__media">
          <div className="kitchen-promo__art">
            <img src="/kitchen/kitchen-iso.svg?v=2" width={1200} height={960} loading="lazy" decoding="async" alt={t.alt} />
            {/* точки — из того же расчёта, что и рисунок (доли ширины и высоты) */}
            <span className="kitchen-promo__tag" style={{ left: '61.6%', top: '22.5%' }} aria-hidden="true">
              A · 420 см
            </span>
            <span className="kitchen-promo__tag" style={{ left: '28.3%', top: '15.2%' }} aria-hidden="true">
              B · 220 см
            </span>
            <span className="kitchen-promo__tag kitchen-promo__tag--sel" style={{ left: '49.2%', top: '47.2%' }} aria-hidden="true">
              60 см
            </span>
          </div>
        </div>
      </Link>
    </section>
  )
}
