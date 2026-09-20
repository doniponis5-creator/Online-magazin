import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { isLang, type Lang } from '@/lib/i18n/config'
import { getPrivacy, PRIVACY_UPDATED, SHOP_CONTACT } from '@/data/privacy'

export const metadata: Metadata = {
  title: 'Политика конфиденциальности — Смарт Центр',
  description:
    'Какие данные собирают сайт smarket.kg и приложение «S Маркет», зачем они нужны и кому передаются.',
}

/**
 * Статическая страница политики конфиденциальности.
 *
 * Открыта всем без входа: ссылку на неё мы даём Apple в App Store Connect,
 * а проверяющий открывает её в обычном браузере.
 */
export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ lang: string }>
}) {
  const { lang: raw } = await params
  if (!isLang(raw)) notFound()
  const lang: Lang = raw
  const t = getPrivacy(lang)

  return (
    <section className="section legal-page">
      <div className="container">
        <h1 className="section__title">{t.title}</h1>
        <p className="legal-page__updated">
          {t.updatedLabel}: {PRIVACY_UPDATED}
        </p>
        {t.intro.map((p) => (
          <p key={p} className="legal-page__text">
            {p}
          </p>
        ))}

        {t.sections.map((s) => (
          <div key={s.title} className="legal-page__block">
            <h2 className="legal-page__heading">{s.title}</h2>
            {s.text?.map((p) => (
              <p key={p} className="legal-page__text">
                {p}
              </p>
            ))}
            {s.items && (
              <ul className="legal-page__list">
                {s.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
          </div>
        ))}

        <div className="legal-page__block">
          <h2 className="legal-page__heading">{t.contactTitle}</h2>
          <p className="legal-page__text">{t.contactText}</p>
          <ul className="legal-page__list">
            {SHOP_CONTACT.phones.map((p) => (
              <li key={p.number}>
                {t.contactPhoneLabel}:{' '}
                <a href={`tel:${p.number.replace(/[^\d+]/g, '')}`}>{p.number}</a>
                {' · '}
                {p.messengers.join(' · ')}
              </li>
            ))}
            {SHOP_CONTACT.email && (
              <li>
                {t.contactEmailLabel}:{' '}
                <a href={`mailto:${SHOP_CONTACT.email}`}>{SHOP_CONTACT.email}</a>
              </li>
            )}
            <li>
              {t.contactAddressLabel}:{' '}
              {lang === 'ky' ? SHOP_CONTACT.addressKy : SHOP_CONTACT.addressRu}
            </li>
            <li>
              {t.contactInstagramLabel}:{' '}
              <a
                href={SHOP_CONTACT.instagram}
                target="_blank"
                rel="noopener noreferrer"
              >
                @smartcentrr
              </a>
            </li>
          </ul>
        </div>
      </div>
    </section>
  )
}
