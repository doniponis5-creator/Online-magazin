import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getProduct, products } from '@/data/products'
import { categoryName } from '@/data/categories'
import { ProductDetail } from '@/components/ProductDetail'
import { ProductCard } from '@/components/ProductCard'
import { Lang } from '@/lib/i18n/config'
import { getDictionary } from '@/lib/i18n/dictionaries'

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

  return (
    <div className="container">
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
          <section className="details-card" aria-labelledby="desc-title">
            <h2 className="details-card__title" id="desc-title">
              {dict.product.description}
            </h2>
            <p style={{ color: 'var(--color-ink-soft)', fontSize: 15 }}>
              {lang === 'ky' ? product.descKy : product.descRu}
            </p>
          </section>

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
                <tr>
                  <th scope="row">{dict.product.warranty}</th>
                  <td>
                    {product.warrantyMonths} {dict.product.warrantyMonths}
                  </td>
                </tr>
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
  return {
    title: `${lang === 'ky' ? product.nameKy : product.nameRu} — Smart Centr`,
    description: lang === 'ky' ? product.descKy : product.descRu,
  }
}
