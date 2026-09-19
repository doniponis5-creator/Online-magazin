'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { phones, telHref, whatsappHref } from '@/data/contacts'
import { formatSom } from '@/lib/format'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { Brand } from './Brand'
import { IconPhone, IconWhatsApp } from './Icons'

/**
 * Две карточки на главной: бонусы SBonus и рассрочка.
 *
 * Раньше здесь стоял демо-блок: «программа лояльности будет подключена позже,
 * балансы не реальные» и выбор «новый клиент / уже клиент», который никуда не
 * отправлялся. Бонусы давно работают по-настоящему, а выдуманная форма заявки
 * на рассрочку вредна: человек её заполнял и ждал звонка, которого не будет.
 *
 * Числа берём с сервера: владелец меняет их в 1С, «Панель сайта» → настройки.
 */
export function BonusPromo() {
  const { t, lang } = useI18n()
  const p = t.promo
  const [welcome, setWelcome] = useState<number | null>(null)
  const [maxPct, setMaxPct] = useState<number | null>(null)

  useEffect(() => {
    let alive = true
    fetch('/api/site-settings', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (!alive || !d?.ok) return
        setWelcome(Number(d.welcomeBonus) || 0)
        setMaxPct(Number(d.bonusMaxPct) || 0)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  const phone = phones[0]

  return (
    <section className="section" aria-label={p.bonusTitle} data-reveal>
      <div className="promo-grid">
        <div className="promo promo--lime">
          <h2 className="promo__title">
            <Brand bonus />
          </h2>
          <h3 className="promo__subheading">{p.bonusTitle}</h3>
          <p className="promo__note">{p.bonusText}</p>

          {/* Пока числа не пришли, строки не показываем: пустое «0 сом» хуже,
              чем их отсутствие — обещание должно быть точным или никаким. */}
          {welcome !== null && maxPct !== null && (
            <ul className="promo-facts">
              {welcome > 0 && (
                <li>
                  <strong>{formatSom(welcome)}</strong>
                  <span>{p.factWelcome}</span>
                </li>
              )}
              {maxPct > 0 && (
                <li>
                  <strong>{maxPct}%</strong>
                  <span>{p.factMaxPct}</span>
                </li>
              )}
              <li>
                <strong>1</strong>
                <span>{p.factOneAccount}</span>
              </li>
            </ul>
          )}

          <Link href={`/${lang}/account`} className="btn btn--primary promo__cta">
            {p.bonusCta}
          </Link>
        </div>

        <div className="promo promo--soft">
          <h2 className="promo__title">{p.installmentTitle}</h2>
          <p className="promo__note">{p.installmentText}</p>
          <ol className="promo-steps">
            <li>{p.installmentStep1}</li>
            <li>{p.installmentStep2}</li>
            <li>{p.installmentStep3}</li>
          </ol>
          <div className="promo__actions">
            <a
              href={whatsappHref(phone)}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn--outline promo__cta"
            >
              <IconWhatsApp size={20} />
              {p.askWhatsapp}
            </a>
            <a href={telHref(phone)} className="btn btn--outline promo__cta">
              <IconPhone size={18} />
              {phone.display}
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
