'use client'

import Link from 'next/link'
import { categories } from '@/data/categories'
import { getNew, getPopular } from '@/data/products'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { Hero3D } from '@/components/Hero3D'
import { ProductArt } from '@/components/ProductArt'
import { ProductCard } from '@/components/ProductCard'
import { InstallmentDemo } from '@/components/InstallmentDemo'
import {
  IconCard,
  IconChevronRight,
  IconGift,
  IconHeadset,
  IconMoon,
  IconShield,
  IconTruck,
} from '@/components/Icons'

function CategoryTiles() {
  const { t, lang } = useI18n()
  return (
    <section className="section" aria-labelledby="cats-title" data-reveal>
      <div className="section__head">
        <h2 className="section__title" id="cats-title">
          {t.categories.title}
        </h2>
      </div>
      <div className="cat-tiles">
        {categories.map((c, i) => (
          <Link key={c.id} href={`/${lang}/catalog?cat=${c.id}`} className="cat-tile">
            <span className="cat-tile__icon">
              <ProductArt
                kind={
                  (['phone', 'laptop', 'tv', 'washer', 'tablet', 'headphones'] as const)[i]
                }
                color="#245BEB"
              />
            </span>
            {lang === 'ky' ? c.nameKy : c.nameRu}
          </Link>
        ))}
      </div>
    </section>
  )
}

function ProductSection({
  titleKey,
  ctaKey,
  products,
}: {
  titleKey: 'popular' | 'newList'
  ctaKey: 'popularCta' | 'newCta'
  products: ReturnType<typeof getPopular>
}) {
  const { t, lang } = useI18n()
  if (products.length === 0) return null
  return (
    <section className="section" aria-labelledby={`sec-${titleKey}`} data-reveal>
      <div className="section__head">
        <h2 className="section__title" id={`sec-${titleKey}`}>
          {t.home[titleKey]}
        </h2>
        <Link href={`/${lang}/catalog`} className="section__cta">
          {t.home[ctaKey]}
          <IconChevronRight size={16} />
        </Link>
      </div>
      <div className="product-grid">
        {products.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  )
}

function PromoSection() {
  const { t } = useI18n()
  return (
    <section className="section" aria-label={t.home.sbonusTitle} data-reveal>
      <div className="promo-grid">
        <div className="promo promo--lime">
          <h2 className="promo__title">
            <IconGift size={26} />
            {t.home.sbonusTitle}
          </h2>
          <p className="promo__note">{t.home.sbonusNote}</p>
          <span className="badge promo__tag">{t.common.demo} · SBonus</span>
          <span className="promo__art" aria-hidden="true">
            <ProductArt kind="phone" color="#ffffff" />
          </span>
        </div>
        <div className="promo promo--soft">
          <h2 className="promo__title">{t.home.installmentTitle}</h2>
          <p className="promo__note">{t.home.installmentNote}</p>
          <InstallmentDemo />
        </div>
      </div>
    </section>
  )
}

function NightBanner() {
  const { t } = useI18n()
  return (
    <section className="section" aria-labelledby="night-title" data-reveal>
      <div className="night-banner">
        <span className="night-banner__icon">
          <IconMoon size={26} />
        </span>
        <div>
          <h2 className="night-banner__title" id="night-title">
            {t.home.nightTitle}
          </h2>
          <p className="night-banner__text">{t.home.nightText}</p>
        </div>
      </div>
    </section>
  )
}

function InfoStrip() {
  const { t } = useI18n()
  const items = [
    { icon: <IconTruck size={22} />, title: t.home.delivery, note: t.home.deliveryNote },
    { icon: <IconCard size={22} />, title: t.home.payment, note: t.home.paymentNote },
    { icon: <IconShield size={22} />, title: t.home.trust, note: t.home.trustNote },
    { icon: <IconHeadset size={22} />, title: t.home.care, note: t.home.careNote },
  ]
  return (
    <section className="section" aria-label={t.home.delivery} data-reveal>
      <div className="info-strip">
        {items.map((item) => (
          <div className="info-item" key={item.title}>
            <span className="info-item__icon">{item.icon}</span>
            <div>
              <div className="info-item__title">{item.title}</div>
              <div className="info-item__note">{item.note}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

export default function HomePage() {
  return (
    <div className="container">
      <Hero3D />
      <CategoryTiles />
      <ProductSection titleKey="popular" ctaKey="popularCta" products={getPopular()} />
      <PromoSection />
      <NightBanner />
      <ProductSection titleKey="newList" ctaKey="newCta" products={getNew()} />
      <InfoStrip />
    </div>
  )
}
