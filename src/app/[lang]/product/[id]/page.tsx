import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getProduct, products } from '@/data/products'
import { categoryName } from '@/data/categories'
import { ProductDetail } from '@/components/ProductDetail'
import { ProductCard } from '@/components/ProductCard'
import { Lang } from '@/lib/i18n/config'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { SITE_NAME, SITE_URL, canonical } from '@/lib/seo'

export function generateStaticParams() {
  return products.flatMap((p) => [
    { lang: 'ru', id: p.id },
    { lang: 'ky', id: p.id },
  ])
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>
}) {
  const { lang: rawLang, id } = await params
  if (rawLang !== 'ru' && rawLang !== 'ky') notFound()
  const lang = rawLang as Lang
  const dict = getDictionary(lang)
  const product = getProduct(id)
  if (!product) notFound()

  const similar = products
    .filter((p) => p.categoryId === product.categoryId && p.id !== product.id)
    .slice(0, 4)

  // Разметка товара: по ней Google рисует в выдаче цену, наличие и картинку.
  // Без неё страница товара выглядит для поиска как обычный текст.
  const inStock = product.variants.some((v) => v.stock > 0)
  const productJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: lang === 'ky' ? product.nameKy : product.nameRu,
    description: (lang === 'ky' ? product.descKy : product.descRu) || undefined,
    sku: product.oneCCode || product.id,
    brand: product.brand ? { '@type': 'Brand', name: product.brand } : undefined,
    image: (product.images ?? []).map((src) => (src.startsWith('http') ? src : `${SITE_URL}${src}`)),
    url: canonical(`/${lang}/product/${product.id}`),
    // Цена 0 означает «по запросу» — такой товар в магазине есть, но оферты нет.
    offers: product.price > 0 ? {
      '@type': 'Offer',
      price: product.price,
      priceCurrency: 'KGS',
      availability: inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      url: canonical(`/${lang}/product/${product.id}`),
      seller: { '@type': 'Store', name: SITE_NAME, '@id': `${SITE_URL}/#store` },
    } : undefined,
  }

  return (
    <div className="container">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />
      <nav className="breadcrumbs" aria-label={dict.nav.home}>
        <Link href={`/${lang}`}>{dict.nav.home}</Link>
        {'/'}
        <Link href={`/${lang}/catalog`}>{dict.catalog.title}</Link>
        {'/'}
        <Link href={`/${lang}/catalog?cat=${product.categoryId}`}>
          {categoryName(product.categoryId, lang)}
        </Link>
      </nav>

      <ProductDetail product={product} />

      <div className="details">
          {(lang === 'ky' ? product.descKy : product.descRu) && (
          <section className="details-card" aria-labelledby="desc-title">
            <h2 className="details-card__title" id="desc-title">
              {dict.product.description}
            </h2>
            <p style={{ color: 'var(--color-ink-soft)', fontSize: 15 }}>
              {lang === 'ky' ? product.descKy : product.descRu}
            </p>
          </section>
          )}

          <section className="details-card" aria-labelledby="specs-title">
            <h2 className="details-card__title" id="specs-title">
              {dict.product.specs}
            </h2>
            <table className="spec-table">
              <tbody>
                {product.specs.map((s) => (
                  <tr key={s.labelRu}>
                    <th scope="row">{lang === 'ky' ? s.labelKy : s.labelRu}</th>
                    <td>{lang === 'ky' ? s.valueKy : s.valueRu}</td>
                  </tr>
                ))}
                {product.warrantyMonths > 0 && (
                  <tr>
                    <th scope="row">{dict.product.warranty}</th>
                    <td>
                      {product.warrantyMonths} {dict.product.warrantyMonths}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>

          <section className="details-card" aria-labelledby="delivery-title">
            <h2 className="details-card__title" id="delivery-title">
              {dict.product.deliveryTitle}
            </h2>
            <ul className="delivery-list">
              <li>{dict.product.deliveryPickup}</li>
              <li>{dict.product.deliveryTaxi}</li>
              <li>{dict.product.deliveryNight}</li>
            </ul>
          </section>
      </div>

      {similar.length > 0 && (
        <section className="section" aria-labelledby="similar-title">
          <div className="section__head">
            <h2 className="section__title" id="similar-title">
              {dict.product.similar}
            </h2>
          </div>
          <div className="product-grid">
            {similar.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string; id: string }> }): Promise<Metadata> {
  const { lang, id } = await params
  const product = getProduct(id)
  if (!product) notFound()
  const name = lang === 'ky' ? product.nameKy : product.nameRu
  const text = (lang === 'ky' ? product.descKy : product.descRu)
    || (lang === 'ky'
      ? `${name} — Smart Centr (S MARKET) дүкөнүндө. Кыргызстан боюнча жеткирүү.`
      : `${name} — купить в Smart Centr (S MARKET). Доставка по всему Кыргызстану.`)
  const path = `/${lang}/product/${product.id}`
  return {
    title: `${name} — Smart Centr (S MARKET)`,
    description: text,
    alternates: {
      canonical: path,
      languages: {
        ru: `/ru/product/${product.id}`,
        ky: `/ky/product/${product.id}`,
      },
    },
    openGraph: {
      type: 'website',
      title: name,
      description: text,
      url: path,
      images: product.image ? [{ url: product.image, alt: name }] : undefined,
    },
  }
}
