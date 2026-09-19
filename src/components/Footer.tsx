'use client'

import Link from 'next/link'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { SHOP_CONTACT } from '@/data/privacy'
import { Brand } from './Brand'

export function Footer() {
  const { t, lang } = useI18n()
  const address = lang === 'ky' ? SHOP_CONTACT.addressKy : SHOP_CONTACT.addressRu
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer__grid">
          <div>
            <span className="logo">
              <Brand />
            </span>
            <p className="footer__text">{t.footer.about}</p>
          </div>
          <div>
            <h3 className="footer__title">{t.footer.contacts}</h3>
            <ul className="footer__phones">
              {SHOP_CONTACT.phones.map((phone) => (
                <li key={phone.number}>
                  <a
                    className="footer__phone"
                    href={`tel:${phone.number.replace(/[^\d+]/g, '')}`}
                  >
                    {phone.number}
                  </a>
                </li>
              ))}
            </ul>
            <p className="footer__note">{t.footer.contactsNote}</p>
            <p className="footer__note">
              {t.footer.address}: {address}
            </p>
            <div className="footer__links">
              <Link href={`/${lang}/sources`} className="footer__sources-link">
                {t.footer.sourcesLink}
              </Link>
              <Link href={`/${lang}/privacy`} className="footer__sources-link">
                {t.footer.privacyLink}
              </Link>
            </div>
          </div>
        </div>
        <div className="footer__bottom">
          <span>© {new Date().getFullYear()} · {t.footer.rights}</span>
          <span>KGS · Asia/Bishkek</span>
        </div>
      </div>
    </footer>
  )
}
