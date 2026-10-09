import { describe, expect, it } from 'vitest'
import type { Product } from '@/data/products'
import { indexOf, looseScore, parseQuery, score, typos } from '@/lib/search'
import { popularOrder, tier } from '@/lib/catalogOrder'

function item(id: string, name: string, extra: Partial<Product> = {}): Product {
  return {
    id,
    brand: '',
    categoryId: 'home',
    nameRu: name,
    nameKy: name,
    price: 10000,
    art: 'box',
    image: '/p.jpg',
    baseColor: '#fff',
    descRu: '',
    descKy: '',
    specs: [],
    warrantyMonths: 0,
    variants: [{ id: 'std', stock: 1 }],
    ...extra,
  } as Product
}

const CATS: Record<string, string[]> = {
  fridges: ['Холодильники', 'Муздаткычтар'],
  washers: ['Стиральные машины', 'Кир жуугуч машиналар'],
  tv: ['Телевизоры и ТВ', 'Телевизорлор жана ТВ'],
  climate: ['Климат', 'Климат'],
  'small-kitchen': ['Мелкая техника', 'Майда техника'],
}

const catalog = [
  item('f1', 'Холодильник MIDEA MDRB489FGE020 (INOX)', { brand: 'MIDEA', categoryId: 'fridges' }),
  item('w1', 'Стиральная машина LG F2Y1HS3W 7кг белый', { brand: 'LG', categoryId: 'washers' }),
  item('t1', "Телевизор SMART 43' SMART", { categoryId: 'tv' }),
  item('t2', 'Телевизор CHANGHONG 32D6P ANDROID', { brand: 'CHANGHONG', categoryId: 'tv' }),
  item('c1', 'Кондиционер CHIGO KFR-09AC', { brand: 'CHIGO', categoryId: 'climate' }),
  item('k1', 'Кофе Машина MIDEA MA-FACM1001', {
    brand: 'MIDEA',
    categoryId: 'small-kitchen',
    descRu: 'Удаляет конденсат после приготовления.',
  }),
  item('g1', 'Газовая плита SHIVAKI 6401E', { brand: 'SHIVAKI', categoryId: 'small-kitchen' }),
  item('cheap', 'Чайник ARTEL', { brand: 'ARTEL', categoryId: 'small-kitchen', price: 1900 }),
  item('dear', 'Холодильник AVANGARD BCD-532G', { brand: 'AVANGARD', categoryId: 'fridges', price: 74500 }),
]
const index = catalog.map((p) => ({ p, i: indexOf(p, CATS[p.categoryId] ?? []) }))
const found = (q: string) => {
  const query = parseQuery(q)
  return index.filter(({ i }) => score(query, i) > 0).map(({ p }) => p.id)
}

describe('поиск как пишет покупатель (аудит 07.10: всё это давало 0)', () => {
  it('по-кыргызски, с опечаткой, разговорно, кириллицей бренда', () => {
    expect(found('муздаткыч')).toEqual(['f1', 'dear'])
    expect(found('халадильник')).toEqual(['f1', 'dear'])
    expect(found('стиралка')).toEqual(['w1'])
    expect(found('кир жуугуч')).toEqual(['w1'])
    expect(found('мидеа')).toEqual(['f1', 'k1'])
    expect(found('лж')).toEqual(['w1'])
  })

  it('пишут, как слышат: «а» вместо «о» и без «ь» — не ошибка (аудит 09.10: «халадилник» давал 0)', () => {
    expect(found('халадилник')).toEqual(['f1', 'dear'])
    expect(found('халадилники')).toEqual(['f1', 'dear'])
    expect(found('тилевизор')).toEqual(['t1', 't2'])
    expect(found('кандиционер')).toEqual(['c1'])
    // лишнего не находим
    expect(found('халадилник lg')).toEqual([])
    expect(found('газавая')).toEqual(['g1'])
  })

  it('несколько слов — каждое должно найтись; число — целым', () => {
    expect(found('телевизор 43')).toEqual(['t1'])
    expect(found('телевизор 4')).toEqual([])
    expect(found('газ плита')).toEqual(['g1'])
    expect(found('холодильник lg')).toEqual([])
  })

  it('опечатку прощаем в названии, но не в описании: «кондей» — кондиционер, не «конденсат» кофемашины', () => {
    expect(found('кондей')).toEqual(['c1'])
    expect(found('кондиционер')).toEqual(['c1'])
  })

  it('«рассрочка» и «насия» — не слова поиска, а просьба показать товары в рассрочку', () => {
    expect(parseQuery('рассрочка')).toEqual({ words: [], installment: true })
    expect(parseQuery('насия холодильник')).toEqual({ words: ['холодильник'], installment: true })
    expect(parseQuery('Бөлүп')).toEqual({ words: [], installment: true })
  })

  it('название весит больше раздела; мягкий счёт — для «похожих»', () => {
    const query = parseQuery('холодильник lg')
    const f1 = indexOf(catalog[0], CATS.fridges)
    const w1 = indexOf(catalog[1], CATS.washers)
    expect(looseScore(query, f1)).toBe(1)
    expect(looseScore(query, w1)).toBe(1)
    expect(score(parseQuery('холодильник'), f1)).toBe(3)
  })

  it('Дамерау–Левенштейн: перестановка соседних букв — одна ошибка', () => {
    expect(typos('холодильник', 'халадильник')).toBe(2)
    expect(typos('утюг', 'утгю')).toBe(1)
  })
})

describe('«По популярности»', () => {
  it('Хит → Новинка → скидка → остальное → нет в наличии → без цены или фото', () => {
    expect(tier(item('a', 'x', { badge: 'hit' }))).toBe(0)
    expect(tier(item('a', 'x', { badge: 'new' }))).toBe(1)
    expect(tier(item('a', 'x', { oldPrice: 12000 }))).toBe(2)
    expect(tier(item('a', 'x'))).toBe(3)
    expect(tier(item('a', 'x', { variants: [{ id: 'std', stock: 0 }] }))).toBe(4)
    expect(tier(item('a', 'x', { price: 0 }))).toBe(5)
    expect(tier(item('a', 'x', { image: undefined }))).toBe(5)
  })

  it('внутри ступени разделы чередуются, холодильники первыми; порядок 1С внутри раздела сохраняется', () => {
    const list = [
      item('s1', 'Беговая дорожка', { categoryId: 'sport', badge: 'hit' }),
      item('s2', 'Беговая дорожка 2', { categoryId: 'sport', badge: 'hit' }),
      item('h1', 'Гардероб', { categoryId: 'home', badge: 'hit' }),
      item('f1', 'Холодильник A', { categoryId: 'fridges', badge: 'hit' }),
      item('f2', 'Холодильник B', { categoryId: 'fridges', badge: 'hit' }),
      item('w1', 'Стиральная', { categoryId: 'washers', badge: 'hit' }),
      item('z', 'Без цены', { categoryId: 'fridges', price: 0 }),
    ]
    expect(popularOrder(list).map((p) => p.id)).toEqual(['f1', 'w1', 's1', 'h1', 'f2', 's2', 'z'])
  })
})

describe('рекламный баннер (07.10)', () => {
  it('новинка, парфюмерия, хит; «Товар дня» не повторяем — он стоит блоком сразу под баннером', async () => {
    const { promoSlides } = await import('@/components/PromoCarousel')
    const list = [
      item('d', 'Товар дня', { badge: 'hit', dealOfDay: true }),
      item('n', 'Новинка', { badge: 'new' }),
      item('h', 'Хит', { badge: 'hit' }),
    ]
    const slides = promoSlides(list).map((s) => (s.kind === 'product' ? `${s.mark}:${s.product.id}` : s.kind))
    expect(slides).toEqual(['new:n', 'perfume', 'hit:h'])
    // хита нет — самая большая скидка
    const noHit = promoSlides([item('n', 'Новинка', { badge: 'new' }), item('s', 'Скидка', { oldPrice: 20000 })])
    expect(noHit.map((s) => (s.kind === 'product' ? `${s.mark}:${s.product.id}` : s.kind))).toEqual(['new:n', 'perfume', 'sale:s'])
  })
})

describe('баннеры из 1С (src/lib/banners.ts)', () => {
  it('ссылка 1С → адрес сайта на языке покупателя; чужое — без ссылки', async () => {
    const { bannerHref } = await import('@/lib/banners')
    expect(bannerHref('cat:tv', 'ky')).toEqual({ href: '/ky/catalog?cat=tv', external: false })
    expect(bannerHref('cat:Холодильники', 'ru')).toEqual({ href: '/ru/catalog?cat=fridges', external: false })
    expect(bannerHref('cat:Нет такого', 'ru').href).toBeNull()
    expect(bannerHref('product:ЦБ-00001882', 'ru').href).toMatch(/^\/ru\/product\/[a-z0-9-]+$/)
    expect(bannerHref('/ru/catalog?sale=1', 'ky')).toEqual({ href: '/ky/catalog?sale=1', external: false })
    expect(bannerHref('https://kemalusman.kg/', 'ru')).toEqual({ href: 'https://kemalusman.kg/', external: true })
    expect(bannerHref('javascript:alert(1)', 'ru').href).toBeNull()
    expect(bannerHref('//evil.com', 'ru').href).toBeNull()
    expect(bannerHref('', 'ru').href).toBeNull()
  })

  it('картинка — только с нашего сервера; без картинки для компьютера баннер не показываем', async () => {
    const { cleanBanners } = await import('@/lib/banners')
    const ok = { url: 'https://api.smartcentr.store/api/v1/shop/photos/banner/1-desktop-' + 'a'.repeat(32) + '.jpg', w: 2400, h: 1000 }
    const list = cleanBanners([
      { id: 1, title: 'Скидки', link: 'cat:tv', desktop: ok, mobile: null },
      { id: 2, title: 'Чужая', link: '', desktop: { ...ok, url: 'https://evil.com/x.jpg' } },
      { id: 3, title: 'Без картинки', link: '' },
      'мусор',
    ])
    expect(list.map((b) => b.id)).toEqual([1])
    expect(cleanBanners(null)).toEqual([])
  })
})
