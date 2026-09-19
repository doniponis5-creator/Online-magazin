'use client'

import Link from 'next/link'
import { brands, products, getDailyProduct, getHits, getRecommended, getSale } from '@/data/products'
import { categories } from '@/data/categories'
import { storefront } from '@/data/storefront'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { InstagramPhone } from './InstagramLink'
import { ProductCard } from './ProductCard'
import { ProductArt } from './ProductArt'
import { BrandLogo, hasBrandImage } from './BrandLogo'
import { IconArrowUpRight, IconChevronRight, IconInstagram, IconUser } from './Icons'
import './home-merchandising.css'

function Heading({ title, href, id, extra }: { title: string; href?: string; id: string; extra?: React.ReactNode }) {
  const { lang } = useI18n()
  return <div className="section__head"><h2 className="section__title" id={id}>{title}</h2>
    {extra}
    {href && <Link className="section__cta" href={href}>{lang === 'ky' ? 'Баарын көрүү' : 'Смотреть все'}<IconChevronRight size={16} /></Link>}
  </div>
}

export function DailySelection() {
  const { lang } = useI18n()
  const ky = lang === 'ky'
  const daily = getDailyProduct(storefront.dailyProduct)
  if (!daily) return null
  const recommended = getRecommended(storefront.recommended, [daily])
  return <div className="daily-selection section">
    <section aria-labelledby="daily-title" className="daily-selection__day">
      <Heading id="daily-title" title={ky ? 'Күндүн товары' : 'Товар дня'} />
      <ProductCard product={daily} />
    </section>
    <section aria-labelledby="personal-title" className="daily-selection__personal">
      <Heading id="personal-title" title={ky ? 'Сиз үчүн атайын' : 'Специально для вас'} href={`/${lang}/catalog`} />
      <div className="daily-selection__cards">{recommended.map(product => <ProductCard key={product.id} product={product} />)}</div>
    </section>
  </div>
}

export function CampaignBanner() {
  const { lang } = useI18n()
  const ky = lang === 'ky'
  const campaign = storefront.campaign
  const campaignCategory = categories.some(c => c.id === campaign.category) ? campaign.category : categories[0]?.id
  return <section className="campaign-band section" aria-labelledby="campaign-title">
    <div>
      <h2 id="campaign-title">{ky ? campaign.titleKy : campaign.titleRu}</h2>
      <p>{ky ? campaign.textKy : campaign.textRu}</p></div>
    <Link className="btn btn--primary" href={`/${lang}/catalog?cat=${campaignCategory}`}>{ky ? 'Тандоо' : 'Выбрать технику'}<IconChevronRight size={18} /></Link>
  </section>
}

export function HitMosaic() {
  const { lang } = useI18n()
  const ky = lang === 'ky'
  const hits = getHits(storefront.hits)
  const rails = categories.slice(0, 4)
  if (hits.length === 0) return null
  return <section className="section hits-section" aria-labelledby="hits-title">
    <Heading id="hits-title" title={ky ? 'Көп сатылган товарлар' : 'Хиты продаж'} href={`/${lang}/catalog`} />
    <div className="hit-mosaic">
      {hits.map((product, i) => <div className={`hit-mosaic__item hit-mosaic__item--${i}`} key={product.id}><ProductCard product={product} /></div>)}
      <nav className="hit-mosaic__rail" aria-label={ky ? 'Популярдуу категориялар' : 'Популярные категории'}>
        {rails.map(category => <Link key={category.id} href={`/${lang}/catalog?cat=${category.id}`}>
          <ProductArt kind={category.art} color="#2563eb" /><span>{ky ? category.nameKy : category.nameRu}</span>
        </Link>)}
      </nav>
    </div>
  </section>
}

/** 12 брендов для витрины: сначала с логотипом, затем по числу товаров. */
function brandsForStrip(): string[] {
  const count = new Map<string, number>()
  for (const p of products) if (p.brand) count.set(p.brand, (count.get(p.brand) ?? 0) + 1)
  return [...brands]
    .sort((a, b) => Number(hasBrandImage(b)) - Number(hasBrandImage(a)) || (count.get(b) ?? 0) - (count.get(a) ?? 0))
    .slice(0, 12)
}

export function BrandStrip() {
  const { lang } = useI18n()
  return <section className="section brand-strip" aria-labelledby="brands-title">
    <Heading id="brands-title" title={lang === 'ky' ? 'Бренддер' : 'Бренды'} />
    <div className="brand-strip__grid">{brandsForStrip().map(brand => <Link key={brand} href={`/${lang}/catalog?brand=${encodeURIComponent(brand)}`}><BrandLogo brand={brand} /></Link>)}</div>
  </section>
}

export function SaleSection() {
  const { lang } = useI18n()
  const sale = getSale()
  if (sale.length === 0) return null
  return <section className="section sale-section" aria-labelledby="sale-title">
    <Heading id="sale-title" title={lang === 'ky' ? 'Арзандатылган товарлар' : 'Распродажа'} />
    <div className="sale-section__grid">{sale.map(product => <div key={product.id} className="sale-section__item">
      {product.oldPrice && product.oldPrice > product.price && <span className="sale-section__discount">−{Math.round((1-product.price/product.oldPrice)*100)}%</span>}<ProductCard product={product} />
    </div>)}</div>
  </section>
}

export function SocialAndAccount() {
  const { lang } = useI18n()
  const ky = lang === 'ky'
  return <section className="section social-account" aria-label={ky ? 'Байланышта болуңуз' : 'Оставайтесь на связи'}>
    <div className="instagram-panel">
      <div className="instagram-panel__text">
        <IconInstagram size={38} />
        <h2>{ky ? 'Биз Instagram’дабыз' : 'Мы в Instagram'}</h2>
        <p>{ky ? 'Жаңылыктар, арзандатуулар жана техника жөнүндө видео — 73 миң жазылуучу.' : 'Новинки, распродажи и видео о технике — 73 тысячи подписчиков.'}</p>
        <a href={storefront.instagram} target="_blank" rel="noopener noreferrer" className="instagram-panel__handle">{storefront.instagramHandle}<IconArrowUpRight size={18} /></a>
        <a href={storefront.instagram} target="_blank" rel="noopener noreferrer" className="btn btn--outline">{ky ? 'Instagram’ды ачуу' : 'Открыть Instagram'}</a>
      </div>
      {/* Живой профиль в рамке телефона: наведение гасит экран и показывает QR */}
      <InstagramPhone />
    </div>
    <div className="account-panel"><IconUser size={36} /><h2>{ky ? 'Жеке кабинет' : 'Личный кабинет'} <span>SBonus</span></h2>
      <p>{ky ? 'Бонустар, буйрутмалар жана сатып алуулардын тарыхы — бир жерде.' : 'Бонусы, заказы и история покупок — в одном месте.'}</p>
      <Link href={`/${lang}/account`} className="btn btn--primary">{ky ? 'Кабинетке өтүү' : 'Перейти в кабинет'}<IconChevronRight size={18}/></Link>
    </div>
  </section>
}
