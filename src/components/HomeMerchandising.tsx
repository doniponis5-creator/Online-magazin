'use client'

import Link from 'next/link'
import { products, brands, getProduct } from '@/data/products'
import { categories } from '@/data/categories'
import { storefront } from '@/data/storefront'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { ProductCard } from './ProductCard'
import { ProductArt } from './ProductArt'
import { IconChevronRight, IconUser } from './Icons'
import './home-merchandising.css'

function Heading({ title, href, id }: { title: string; href?: string; id: string }) {
  const { lang } = useI18n()
  return <div className="section__head"><h2 className="section__title" id={id}>{title}</h2>
    {href && <Link className="section__cta" href={href}>{lang === 'ky' ? 'Баарын көрүү' : 'Смотреть все'}<IconChevronRight size={16} /></Link>}
  </div>
}

export function DailySelection() {
  const { lang } = useI18n()
  const ky = lang === 'ky'
  const daily = getProduct(storefront.dailyProduct)!
  return <div className="daily-selection section">
    <section aria-labelledby="daily-title" className="daily-selection__day">
      <Heading id="daily-title" title={ky ? 'Күндүн товары' : 'Товар дня'} />
      <ProductCard product={daily} />
    </section>
    <section aria-labelledby="personal-title" className="daily-selection__personal">
      <Heading id="personal-title" title={ky ? 'Сиз үчүн атайын' : 'Специально для вас'} href={`/${lang}/catalog`} />
      <div className="daily-selection__cards">{storefront.recommended.map(id => <ProductCard key={id} product={getProduct(id)!} />)}</div>
    </section>
  </div>
}

export function CampaignBanner() {
  const { lang } = useI18n()
  const ky = lang === 'ky'
  const campaign = storefront.campaign
  return <section className="campaign-band section" aria-labelledby="campaign-title">
    <div>
      <h2 id="campaign-title">{ky ? campaign.titleKy : campaign.titleRu}</h2>
      <p>{ky ? campaign.textKy : campaign.textRu}</p></div>
    <Link className="btn btn--primary" href={`/${lang}/catalog?cat=${campaign.category}`}>{ky ? 'Тандоо' : 'Выбрать технику'}<IconChevronRight size={18} /></Link>
  </section>
}

export function HitMosaic() {
  const { lang } = useI18n()
  const ky = lang === 'ky'
  const rails = [{cat:'home',kind:'washer'}, {cat:'smartphones',kind:'phone'}, {cat:'tv',kind:'tv'}, {cat:'laptops',kind:'laptop'}] as const
  return <section className="section hits-section" aria-labelledby="hits-title">
    <Heading id="hits-title" title={ky ? 'Көп сатылган товарлар' : 'Хиты продаж'} href={`/${lang}/catalog`} />
    <p className="merch-note">{ky ? 'Демо-каталогдон тандоо' : 'Подборка из демо-каталога'}</p>
    <div className="hit-mosaic">
      {storefront.hits.map((id, i) => <div className={`hit-mosaic__item hit-mosaic__item--${i}`} key={id}><ProductCard product={getProduct(id)!} /></div>)}
      <nav className="hit-mosaic__rail" aria-label={ky ? 'Популярдуу категориялар' : 'Популярные категории'}>
        {rails.map(({cat,kind}) => { const category = categories.find(c=>c.id===cat)!; return <Link key={cat} href={`/${lang}/catalog?cat=${cat}`}>
          <ProductArt kind={kind} color="#2563eb" /><span>{ky ? category.nameKy : category.nameRu}</span>
        </Link> })}
      </nav>
    </div>
  </section>
}

export function BrandStrip() {
  const { lang } = useI18n()
  return <section className="section brand-strip" aria-labelledby="brands-title">
    <Heading id="brands-title" title={lang === 'ky' ? 'Бренддер' : 'Бренды'} />
    <p className="merch-note">{lang === 'ky' ? 'Азыр демо-каталогдун бренддери көрсөтүлгөн.' : 'Пока представлены бренды демонстрационного каталога.'}</p>
    <div className="brand-strip__grid">{brands.slice(0,12).map(brand => <Link key={brand} href={`/${lang}/catalog?brand=${encodeURIComponent(brand)}`}>{brand}</Link>)}</div>
  </section>
}

export function SaleSection() {
  const { lang } = useI18n()
  const sale = products.filter(p => p.oldPrice && p.oldPrice > p.price)
  return <section className="section sale-section" aria-labelledby="sale-title">
    <Heading id="sale-title" title={lang === 'ky' ? 'Арзандатылган товарлар' : 'Распродажа'} />
    <div className="sale-section__grid">{sale.map(product => <div key={product.id} className="sale-section__item">
      <span className="sale-section__discount">−{Math.round((1-product.price/product.oldPrice!)*100)}%</span><ProductCard product={product} />
    </div>)}</div>
  </section>
}

export function SocialAndAccount() {
  const { lang } = useI18n()
  const ky = lang === 'ky'
  return <section className="section social-account" aria-label={ky ? 'Байланышта болуңуз' : 'Оставайтесь на связи'}>
    <div className="instagram-panel">
      <svg className="instagram-panel__icon" width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r=".8" fill="currentColor" /></svg>
      <h2>{ky ? 'Биз Instagram’дабыз' : 'Мы в Instagram'}</h2><p>{ky ? 'Дүкөндүн жаңылыктары жана товарлары — биздин баракчада.' : 'Новости магазина и знакомство с техникой — на нашей странице.'}</p>
      <a href={storefront.instagram} target="_blank" rel="noopener noreferrer" className="instagram-panel__handle">{storefront.instagramHandle}<span aria-hidden="true">↗</span></a>
      <a href={storefront.instagram} target="_blank" rel="noopener noreferrer" className="btn btn--outline">{ky ? 'Instagram’ды ачуу' : 'Открыть Instagram'}</a>
    </div>
    <div className="account-panel"><IconUser size={36} /><h2>{ky ? 'Жеке кабинет' : 'Личный кабинет'} <span>SBonus</span></h2>
      <p>{ky ? 'Бонустар жана сатып алуулар тууралуу маалымат бир жерде. Кабинет жакында ачылат.' : 'Бонусы и информация о покупках в одном месте. Вход в кабинет скоро откроется.'}</p>
      <Link href={`/${lang}/account`} className="btn btn--primary">{ky ? 'Кабинетке өтүү' : 'Перейти в кабинет'}<IconChevronRight size={18}/></Link>
    </div>
  </section>
}
