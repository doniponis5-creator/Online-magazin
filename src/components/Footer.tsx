'use client'

import { useI18n } from '@/lib/i18n/I18nProvider'

export function Footer() {
  const { t } = useI18n()
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer__grid">
          <div>
            <span className="logo">
              smart&nbsp;<span className="logo__dot">centr</span>
            </span>
            <p className="footer__text">{t.footer.about}</p>
            <p className="footer__text">{t.footer.integration}</p>
          </div>
          <div>
            <h3 className="footer__title">{t.footer.contacts}</h3>
            <p className="footer__note">{t.footer.contactsNote}</p>
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
