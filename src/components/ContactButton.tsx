'use client'

import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { instagram, phones, telHref, telegramHref, whatsappHref } from '@/data/contacts'
import { getProduct } from '@/data/products'
import { formatSom } from '@/lib/format'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { IconClose, IconInstagram, IconPhone, IconTelegram, IconWhatsApp } from './Icons'

/**
 * Кнопка «Связаться» в углу экрана — на всех страницах.
 *
 * Покупатель, у которого вопрос, до этого должен был долистать до подвала или
 * найти страницу «О магазине». Чаще он просто уходил. Кнопка держит три номера
 * и мессенджеры на расстоянии одного нажатия, где бы человек ни находился.
 *
 * Мессенджеры сверху не случайно: писать людям проще, чем звонить, а нам
 * переписка удобнее — видно, о каком товаре речь.
 */
export function ContactButton() {
  const { t, lang } = useI18n()
  const c = t.contactWidget
  const pathname = usePathname() || ''
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  /**
   * На странице товара сообщение в WhatsApp уже набрано: название, цена и
   * ссылка. Это и есть наш «онлайн-чат» — покупатель пишет туда, где сидит
   * сам, а продавец сразу видит, о каком товаре речь.
   */
  const productAsk = (() => {
    const match = pathname.match(new RegExp(`^/${lang}/product/([^/]+)`))
    const product = match ? getProduct(decodeURIComponent(match[1])) : undefined
    if (!product) return null
    const name = lang === 'ky' ? product.nameKy : product.nameRu
    const price = product.price > 0 ? ` — ${formatSom(product.price)}` : ''
    const link = typeof window === 'undefined' ? '' : `
${window.location.href}`
    return `${c.askAbout} ${name}${price}${link}`
  })()

  const close = useCallback(() => setOpen(false), [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    // Клик мимо панели закрывает её: так ведут себя все всплывающие окна,
    // и человек не ищет крестик. Слушаем pointerdown, а не mousedown: на
    // телефоне часть касаний до mousedown не доходит, и панель не закрывалась.
    const onDown = (e: Event) => {
      if (box.current && !box.current.contains(e.target as Node)) close()
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onDown)
    }
  }, [open, close])

  return (
    <div className={`contact-fab${open ? ' is-open' : ''}`} ref={box}>
      {/* Подложка на весь экран: нажатие в любом пустом месте закрывает панель.
          Один слушатель события мог промахнуться мимо касания, эта — нет. */}
      {open && <div className="contact-fab__backdrop" onClick={close} aria-hidden="true" />}
      {open && (
        <div className="contact-fab__panel" role="dialog" aria-label={c.title}>
          <div className="contact-fab__head">
            <strong>{c.title}</strong>
            <button type="button" onClick={close} aria-label={c.close}>
              <IconClose size={18} />
            </button>
          </div>
          <p className="contact-fab__hint">{productAsk ? c.hintProduct : c.hint}</p>
          <ul className="contact-fab__list">
            {phones.map((phone) => (
              <li key={phone.raw}>
                <span className="contact-fab__number">{phone.display}</span>
                <span className="contact-fab__actions">
                  <a
                    href={whatsappHref(phone, productAsk ?? undefined)}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`WhatsApp ${phone.display}`}
                    title="WhatsApp"
                  >
                    <IconWhatsApp size={26} />
                  </a>
                  <a
                    href={telegramHref(phone)}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Telegram ${phone.display}`}
                    title="Telegram"
                  >
                    <IconTelegram size={26} />
                  </a>
                  <a
                    href={telHref(phone)}
                    className="contact-fab__call"
                    aria-label={`${c.call} ${phone.display}`}
                    title={c.call}
                  >
                    <IconPhone size={18} />
                  </a>
                </span>
              </li>
            ))}
          </ul>
          <a
            href={instagram.url}
            target="_blank"
            rel="noopener noreferrer"
            className="contact-fab__ig"
          >
            <IconInstagram size={22} />
            @{instagram.handle}
          </a>
        </div>
      )}
      <button
        type="button"
        className="contact-fab__button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={c.title}
      >
        <span className="contact-fab__icon">
          {open ? <IconClose size={22} /> : <IconPhone size={22} />}
        </span>
        <span className="contact-fab__label">{c.short}</span>
      </button>
    </div>
  )
}
