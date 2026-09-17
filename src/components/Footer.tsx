'use client'

import Link from 'next/link'
import { useI18n } from '@/lib/i18n/I18nProvider'
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
          </div>
          <div>
            <h3 className="footer__title">{t.footer.contacts}</h3>
            <p className="footer__note">{t.footer.contactsNote}</p>
            <Link href={`/${lang}/sources`} className="footer__sources-link">
              {t.footer.sourcesLink}
            </Link>
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
