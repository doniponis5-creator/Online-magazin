'use client'

import Link from 'next/link'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { address, developer, phones, telHref, telegramHref, whatsappHref } from '@/data/contacts'
import { paymentMethods } from '@/data/payment-methods'
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
          </div>
          {/* Средняя колонка: главные разделы. Раньше слева под описанием
              пустовало полэкрана, а юридические ссылки стояли в контактах. */}
          <nav aria-label={t.footer.navTitle}>
            <h3 className="footer__title">{t.footer.navTitle}</h3>
            <ul className="footer__nav">
              <li><Link href={`/${lang}/catalog`}>{t.nav.catalog}</Link></li>
              <li><Link href={`/${lang}/catalog?sale=1`}>{t.footer.saleLink}</Link></li>
              <li><Link href={`/${lang}/kitchen`}>{lang === 'ky' ? 'Ашкананын 3D-конструктору' : '3D-конструктор кухни'}</Link></li>
              <li><Link href={`/${lang}/favorites`}>{t.nav.favorites}</Link></li>
              <li><Link href={`/${lang}/account`}>{t.footer.accountLink}</Link></li>
              <li><Link href={`/${lang}/about`}>{t.footer.aboutLink}</Link></li>
            </ul>
          </nav>
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
          </div>
        </div>
        {/* Чем платят: те же значки, что на оплате. Покупатель видит своё
            банковское приложение ещё до заказа и не думает, что нужен
            именно кошелёк O!Деньги. */}
        <div className="footer__pay">
          <span className="footer__pay-label">
            {t.footer.payTitle}: <span>{t.footer.payNote}</span>
          </span>
          <ul className="footer__pay-row">
            {paymentMethods.map((method) => (
              <li key={method.name}>
                {method.logo ? (
                  <img src={method.logo} alt={method.name} title={method.name} width={64} height={64} loading="lazy" />
                ) : (
                  <span>{method.name}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
        <div className="footer__bottom">
          <span>© {new Date().getFullYear()} · {t.footer.rights}</span>
          <span>{t.footer.currency}</span>
          {/* Юридические ссылки — в нижней строке, как принято; там их не
              закрывает плавающая кнопка «Спросить». Политику требует App Store —
              ссылка должна быть на каждой странице. */}
          <span className="footer__legal">
            <Link href={`/${lang}/privacy`}>{t.footer.privacyLink}</Link>
          </span>
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
