'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { address, developer, phones, telHref, telegramHref, whatsappHref } from '@/data/contacts'
import { paymentMethods } from '@/data/payment-methods'
import { IconTelegram, IconWhatsApp } from './Icons'
import { InstagramLink } from './InstagramLink'
import { Brand } from './Brand'
import { APP_STORE_URL } from '@/lib/native/appStore'
import { inNativeApp } from '@/lib/native/bonusCard'

export function Footer() {
  const { t, lang } = useI18n()
  // Телефон и приложение: подвал (разделы, контакты, адрес) — только в кабинете,
  // на остальных страницах его заменяет нижнее меню (владелец, 28.09.2026).
  // Компьютер — подвал везде, как раньше: прячет его только CSS до 900px.
  const inCabinet = /\/account(\/|$)/.test(usePathname() ?? '')
  return (
    <footer className={`footer${inCabinet ? '' : ' footer--cabinet-only'}`}>
      <div className="container">
        <div className="footer__grid">
          <div>
            <span className="logo">
              <Brand />
            </span>
            <p className="footer__text">{t.footer.about}</p>
            <AppDownload />
          </div>
          {/* Средняя колонка: главные разделы. Раньше слева под описанием
              пустовало полэкрана, а юридические ссылки стояли в контактах. */}
          <nav aria-label={t.footer.navTitle}>
            <h3 className="footer__title">{t.footer.navTitle}</h3>
            <ul className="footer__nav">
              <li><Link href={`/${lang}/catalog`}>{t.nav.catalog}</Link></li>
              <li><Link href={`/${lang}/catalog?sale=1`}>{t.footer.saleLink}</Link></li>
              <li><Link href={`/${lang}/kitchen`}>{lang === 'ky' ? 'Ашкананын 3D-конструктору' : '3D-конструктор кухни'}</Link></li>
              <li><Link href={`/${lang}/kitchen/gallery`}>{t.nav.kitchenGallery}</Link></li>
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
          {/* Кто сделал сайт — только имя. Телефон убран по просьбе владельца. */}
          <span className="footer__author">
            {t.footer.madeBy}: <strong>{developer.name}</strong>
          </span>
        </div>
      </div>
    </footer>
  )
}

/**
 * «Скачайте приложение» в подвале: значок App Store и QR-код. На компьютере QR — главный путь:
 * навёл камеру iPhone — открылась страница приложения. Внутри приложения блока нет (appStore.ts: «внутри — нигде»).
 * Android — когда приложение откроется в Google Play для всех.
 */
function AppDownload() {
  const { t } = useI18n()
  const a = t.app
  const [inApp, setInApp] = useState(false)
  useEffect(() => setInApp(inNativeApp()), [])
  if (inApp) return null
  return (
    <div className="footer-app">
      <div className="footer-app__head">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="footer-app__icon" src="/icon.jpg" alt="" width={48} height={48} loading="lazy" />
        <span className="footer-app__text">
          <b>{a.barTitle}</b>
          <span>{a.barText}</span>
        </span>
      </div>
      <div className="footer-app__row">
        <a className="store-badge" href={APP_STORE_URL} target="_blank" rel="noopener" aria-label={a.orderCta}>
          <svg className="store-badge__logo" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
            <path
              fill="currentColor"
              d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"
            />
          </svg>
          <span className="store-badge__text">
            <small>{a.badgeTop}</small>
            <b>App Store</b>
          </span>
        </a>
        <span className="footer-app__qr">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/app-store-qr.svg" alt="" width={64} height={64} loading="lazy" />
          <span>{a.qrHint}</span>
        </span>
      </div>
    </div>
  )
}
