'use client'

/**
 * Клиентские блоки главной. Сама страница (`page.tsx`) — серверная: между
 * `HomeTop` и `HomeRest` она вставляет «Готовые кухни в 3D» из галереи.
 */

import Link from 'next/link'
import { useState } from 'react'
import { categories } from '@/data/categories'
import categoryIcons from '@/data/category-icons.json'
import { categoryCover, getNew, getPopular, type ArtKind } from '@/data/products'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { useShuffle } from '@/lib/useShuffle'
import { DailySelection, CampaignBanner, HitMosaic, ReelsEntry, BrandStrip, SaleSection, SocialAndAccount } from '@/components/HomeMerchandising'
import { StorefrontHero } from '@/components/StorefrontHero'
import type { HeroVariant } from '@/lib/hero'
import type { SaleCard } from '@/lib/hero-sale'
import { Brand } from '@/components/Brand'
import { ProductArt } from '@/components/ProductArt'
import { PromoCarousel } from '@/components/PromoCarousel'
import { ProductCard } from '@/components/ProductCard'
import { BonusPromo } from '@/components/BonusPromo'
import { CustomerReviews } from '@/components/CustomerReviews'
import { KitchenPromo } from '@/components/kitchen/KitchenPromo'
import {
  IconCard,
  IconChevronRight,
  IconHeadset,
  IconClock24,
  IconShield,
  IconTruck,
} from '@/components/Icons'

/**
 * Обложки разделов, приведённые к одному виду (`scripts/category-icons.mjs`):
 * товар уже по центру белого квадрата и одного «веса» с соседями.
 */
const ICONS: Record<string, string> = categoryIcons
/** Мозаика клетки «Весь каталог»: разные по цвету и форме — видно, что там всё. */
const ALL_MOSAIC = ['tv', 'care', 'washers', 'home']

/**
 * Короткий союз или предлог — неразрывным пробелом к следующему слову: в узкой
 * колонке строка не кончается на «и» («Телевизоры и / ТВ» → «Телевизоры / и ТВ»).
 * Длинное слово, которое в клетку не влезает, переносится по частям слова
 * («Энерго-снабжение», а не «Энергоснабже-ние»): мягкий перенос виден только на изломе.
 */
const glue = (name: string) =>
  name.replace(/(^|\s)(и|в|с|к|у|о|для|жана)\s/giu, '$1$2\u00a0').replace(/Энергоснабжение/g, 'Энерго\u00adснабжение')

/**
 * Квадрат раздела. Готовая обложка — на весь квадрат; нового раздела в списке
 * нет — фото его товара из каталога; фото нет или не загрузилось — рисунок.
 */
function CategoryMedia({ id, art }: { id: string; art: ArtKind }) {
  const [broken, setBroken] = useState(false)
  const icon = ICONS[id]
  const src = icon ?? categoryCover(id)
  return (
    <span className="cat-icon__media" aria-hidden="true">
      {src && !broken ? (
        <img
          className={`cat-icon__photo${icon ? ' cat-icon__photo--fit' : ''}`}
          src={src}
          alt=""
          width={icon ? 320 : undefined}
          height={icon ? 320 : undefined}
          loading="lazy"
          decoding="async"
          onError={() => setBroken(true)}
        />
      ) : (
        <ProductArt kind={art} color="#245BEB" />
      )}
    </span>
  )
}

function CategoryTiles() {
  const { t, lang } = useI18n()
  return (
    <section className="section" aria-labelledby="cats-title" data-reveal>
      <div className="section__head">
        <h2 className="section__title" id="cats-title">
          {t.categories.title}
        </h2>
      </div>
      {/* Сетка «иконок», как в приложениях магазинов (владелец выбрал 28.09.2026):
          квадрат с нашим товаром раздела, подпись под ним. Последняя клетка —
          «Весь каталог»: 11 разделов + 1 закрывают ряды ровно. Число товаров не
          пишем — владелец против: «5 товаров» в разделе выглядит бедно. */}
      <ul className="cat-icons">
        {categories.map((c) => (
          <li key={c.id}>
            <Link href={`/${lang}/catalog?cat=${c.id}`} className="cat-icon">
              <CategoryMedia id={c.id} art={c.art} />
              <span className="cat-icon__name">{glue(lang === 'ky' ? c.nameKy : c.nameRu)}</span>
            </Link>
          </li>
        ))}
        <li>
          <Link href={`/${lang}/catalog`} className="cat-icon cat-icon--all">
            {/* «Весь каталог» — такой же белый квадрат, а в нём четыре раздела
                мозаикой: жёлтая плитка с значком выбивалась из ряда (владелец). */}
            <span className="cat-icon__media cat-icon__media--all" aria-hidden="true">
              {ALL_MOSAIC.filter((id) => ICONS[id]).map((id) => (
                <img key={id} src={ICONS[id]} alt="" width={320} height={320} loading="lazy" decoding="async" />
              ))}
            </span>
            <span className="cat-icon__name">{t.categories.all}</span>
          </Link>
        </li>
      </ul>
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

function NightBanner() {
  const { t } = useI18n()
  return (
    <section className="section" aria-labelledby="night-title" data-reveal>
      <div className="night-banner">
        <span className="night-banner__icon">
          <IconClock24 size={28} />
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

/** Верх главной: витрина, категории и рекламный баннер. */
export function HomeTop({ hero, sale }: { hero: HeroVariant; sale: SaleCard[] }) {
  return (
    <>
      <StorefrontHero variant={hero} sale={sale} />
      <CategoryTiles />
      {/* реклама: товар дня, новинка, хит и наш магазин парфюмерии (владелец 07.10) */}
      <PromoCarousel />
    </>
  )
}

/**
 * Всё, что ниже рекламного баннера. 3D-кухня — после первых товарных блоков (владелец 07.10): раньше она стояла
 * сразу под баннером, и на телефоне два больших промо подряд занимали почти два экрана до первого товара.
 */
export function HomeRest({ hero }: { hero: HeroVariant }) {
  const shuffle = useShuffle()
  return (
    <>
      <DailySelection />
      <CampaignBanner />
      <HitMosaic />
      {/* баннер «Готовые кухни в 3D» уже зовёт в конструктор — второй раз не повторяем */}
      {hero !== 'kitchens' && <KitchenPromo />}
      <ReelsEntry />
      <BrandStrip />
      <SaleSection />
      <BonusPromo />
      <NightBanner />
      <ProductSection titleKey="newList" ctaKey="newCta" products={getNew(shuffle)} />
      <CustomerReviews />
      <SocialAndAccount />
      <InfoStrip />
    </>
  )
}
