import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { defaultLang, isLang, type Lang } from '@/lib/i18n/config'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { IconTelegram, IconWhatsApp } from '@/components/Icons'
import { InstagramCard } from '@/components/InstagramLink'
import {
  address,
  phones,
  since,
  telHref,
  telegramHref,
  whatsappHref,
  yearsOnMarket,
} from '@/data/contacts'

export const metadata: Metadata = {
  title: 'О магазине — Смарт Центр',
  description:
    'Smart Centr — магазин электроники и бытовой техники в Араванском районе Ошской области. Работаем с 2011 года. Официальная гарантия, доставка по Кыргызстану.',
}

/**
 * Страница «О магазине»: стаж, гарантия, доставка, оплата и контакты.
 *
 * До этого покупатель не находил на сайте ни телефона, ни адреса — в подвале
 * стояло «будут опубликованы после запуска». Для магазина техники это главный
 * вопрос доверия: где вы находитесь и что будет, если техника сломается.
 */
export default async function AboutPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: raw } = await params
  if (!isLang(raw)) notFound()
  const lang: Lang = (isLang(raw) ? raw : defaultLang) as Lang
  const t = getDictionary(lang).about
  const years = yearsOnMarket()

  return (
    <section className="section about-page">
      <div className="container">
        <h1 className="section__title">{t.title}</h1>
        <p className="about-page__lead">{t.lead}</p>

        <div className="about-page__grid">
          <article className="about-card">
            <h2>{t.experienceTitle.replace('{years}', String(years))}</h2>
            <p>{t.experienceText.replace('{since}', String(since))}</p>
          </article>

          <article className="about-card">
            <h2>{t.warrantyTitle}</h2>
            <p>{t.warrantyText}</p>
            <p className="about-card__note">{t.warrantyNote}</p>
          </article>

          <article className="about-card">
            <h2>{t.deliveryTitle}</h2>
            <p>{t.deliveryText}</p>
          </article>

          <article className="about-card">
            <h2>{t.payTitle}</h2>
            <p>{t.payText}</p>
          </article>
        </div>

        <div className="about-page__grid">
          <article className="about-card">
            <h2>{t.contactsTitle}</h2>
            <p>{t.contactsText}</p>
            <ul className="about-phones">
              {phones.map((phone) => (
                <li key={phone.raw}>
                  <a href={telHref(phone)} className="about-phones__number">{phone.display}</a>
                  <span className="msg-links">
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
                  </span>
                </li>
              ))}
            </ul>
          </article>

          <article className="about-card">
            <h2>{t.addressTitle}</h2>
            <p className="about-card__address">{lang === 'ky' ? address.ky : address.ru}</p>
          </article>
        </div>

        <article className="about-card about-card--wide">
          <h2>{t.namesTitle}</h2>
          <p>{t.namesText1}</p>
          <p>{t.namesText2}</p>
          <p>{t.namesText3}</p>
        </article>

        <InstagramCard />
      </div>
    </section>
  )
}
