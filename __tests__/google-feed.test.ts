import { describe, expect, it } from 'vitest'
import type { Product } from '@/data/products'
import { googleFeedXml } from '@/lib/feed/google'

const item = {
  id: 'x1',
  brand: 'LG & Co',
  categoryId: 'washers',
  nameRu: 'Стиральная машина <LG> 7 кг',
  nameKy: '',
  price: 20000,
  oldPrice: 25000,
  art: 'phone',
  image: 'https://api.smartcentr.store/p/1.jpg',
  images: ['https://api.smartcentr.store/p/1.jpg', '/products/2.jpg'],
  baseColor: '#fff',
  descRu: 'Тихая',
  descKy: '',
  specs: [],
  warrantyMonths: 12,
  variants: [{ stock: 0 }],
} as unknown as Product

describe('googleFeedXml', () => {
  const out = googleFeedXml([item], 'https://smarket.kg', new Set(['x1']))
  it('поля Google и экранирование', () => {
    expect(out).toContain('xmlns:g="http://base.google.com/ns/1.0"')
    expect(out).toContain('<title>Стиральная машина &lt;LG&gt; 7 кг</title>')
    expect(out).toContain('<g:brand>LG &amp; Co</g:brand>')
    expect(out).toContain('<g:availability>out of stock</g:availability>')
    expect(out).toContain('<g:price>25000 KGS</g:price><g:sale_price>20000 KGS</g:sale_price>')
    expect(out).toContain('<g:additional_image_link>https://smarket.kg/products/2.jpg</g:additional_image_link>')
    expect(out).toContain('<link>https://smarket.kg/ru/product/x1</link>')
  })
  it('без страницы — пустой список', () => {
    expect(googleFeedXml([item], 'https://smarket.kg', new Set())).not.toContain('<item>')
  })
})
