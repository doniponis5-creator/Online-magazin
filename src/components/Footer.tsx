'use client'

import Link from 'next/link'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { address, developer, phones, telHref, telegramHref, whatsappHref } from '@/data/contacts'
import { IconTelegram, IconWhatsApp } from './Icons'
import { InstagramLink } from './InstagramLink'
import { Brand } from './Brand'

export function Footer() {
  const { t, lang } = useI18n()
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer__grid">
          <div>
            <span className="logo">
              <Brand />
            </span>
            <p className="footer__text">{t.footer.about}</p>
            <Link href={`/${lang}/about`} className="footer__sources-link">
              {t.footer.aboutLink}
            </Link>
          </div>
          <div>
            <h3 className="footer__title">{t.footer.contacts}</h3>
            <p className="footer__note">{t.footer.contactsNote}</p>
            {/* Номер кликается, рядом мессенджеры: писать людям удобнее, чем звонить */}
            <ul className="footer__phones">
              {phones.map((phone) => (
                <li key={phone.raw}>
                  <a href={telHref(phone)} className="footer__phone">{phone.display}</a>
                  <span className="msg-links">
                    <a
                      href={whatsappHref(phone)}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`WhatsApp ${phone.display}`}
                      title="WhatsApp"
                    >
                      <IconWhatsApp size={20} />
                    </a>
                    <a
                      href={telegramHref(phone)}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Telegram ${phone.display}`}
                      title="Telegram"
                    >
                      <IconTelegram size={20} />
                    </a>
                  </span>
                </li>
              ))}
            </ul>
            <div className="footer__social">
              <InstagramLink compact />
            </div>
            <p className="footer__note footer__address">
              {t.footer.address}: {lang === 'ky' ? address.shortKy : address.shortRu}
            </p>
            <div className="footer__links">
              <Link href={`/${lang}/sources`} className="footer__sources-link">
                {t.footer.sourcesLink}
              </Link>
              {/* Политику требует App Store — ссылка должна быть на каждой странице */}
              <Link href={`/${lang}/privacy`} className="footer__sources-link">
                {t.footer.privacyLink}
              </Link>
            </div>
          </div>
        </div>
        <div className="footer__bottom">
          <span>© {new Date().getFullYear()} · {t.footer.rights}</span>
          <span>{t.footer.currency}</span>
          {/* Кто сделал сайт: по этому номеру обращаются за доработками */}
          <span className="footer__author">
            {t.footer.madeBy}: <strong>{developer.name}</strong>
            <a href={telHref(developer.phone)}>{developer.phone.display}</a>
          </span>
        </div>
      </div>
    </footer>
  )
}
