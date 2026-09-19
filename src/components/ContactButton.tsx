'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { instagram, phones, telHref, telegramHref, whatsappHref } from '@/data/contacts'
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
  const { t } = useI18n()
  const c = t.contactWidget
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  const close = useCallback(() => setOpen(false), [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    // Клик мимо панели закрывает её: так ведут себя все всплывающие окна,
    // и человек не ищет крестик.
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) close()
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onDown)
    }
  }, [open, close])

  return (
    <div className="contact-fab" ref={box}>
      {open && (
        <div className="contact-fab__panel" role="dialog" aria-label={c.title}>
          <div className="contact-fab__head">
            <strong>{c.title}</strong>
            <button type="button" onClick={close} aria-label={c.close}>
              <IconClose size={18} />
            </button>
          </div>
          <p className="contact-fab__hint">{c.hint}</p>
          <ul className="contact-fab__list">
            {phones.map((phone) => (
              <li key={phone.raw}>
                <span className="contact-fab__number">{phone.display}</span>
                <span className="contact-fab__actions">
                  <a
                    href={whatsappHref(phone)}
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
        {open ? <IconClose size={22} /> : <IconPhone size={22} />}
        <span className="contact-fab__label">{c.short}</span>
      </button>
    </div>
  )
}
