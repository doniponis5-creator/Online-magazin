import { describe, expect, it } from 'vitest'
import { detectLang, localAnswer, parseAnswer } from '@/lib/assistant/local'
import { catalogDigest, searchProducts } from '@/lib/assistant/knowledge'
import { products } from '@/data/products'

describe('parseAnswer', () => {
  it('вырезает служебную строку с товарами', () => {
    const { text, productIds } = parseAnswer('Есть вот такие.\nTOVAR: aura-x5, vega-pro')
    expect(text).toBe('Есть вот такие.')
    expect(productIds).toEqual(['aura-x5', 'vega-pro'])
  })

  it('без строки TOVAR оставляет текст как есть', () => {
    const { text, productIds } = parseAnswer('Доставляем по всему Кыргызстану.')
    expect(text).toBe('Доставляем по всему Кыргызстану.')
    expect(productIds).toEqual([])
  })

  it('не отдаёт больше трёх товаров', () => {
    const { productIds } = parseAnswer('...\nTOVAR: a, b, c, d, e')
    expect(productIds).toHaveLength(3)
  })
})

describe('detectLang', () => {
  it('узбекская латиница', () => {
    expect(detectLang('Salom, muzlatgich qancha turadi?', 'ru')).toBe('uz')
  })

  it('узбекская кириллица', () => {
    expect(detectLang('Ассалому алайкум, нархи қанча?', 'ru')).toBe('uz')
  })

  it('кыргызский по буквам ң ө ү', () => {
    expect(detectLang('Телефондун баасы канча? Жеткирүү барбы?', 'ru')).toBe('ky')
  })

  it('русский', () => {
    expect(detectLang('Сколько стоит доставка?', 'ky')).toBe('ru')
  })

  it('ничего не понял — язык сайта', () => {
    expect(detectLang('?!', 'ky')).toBe('ky')
  })
})

describe('localAnswer', () => {
  it('отвечает про доставку на языке вопроса', () => {
    expect(localAnswer('Доставка есть?', 'ru').text).toMatch(/Возим по всему Кыргызстану/)
    expect(localAnswer('Yetkazib berasizmi?', 'ru').text).toMatch(/olib boramiz/i)
    expect(localAnswer('Жеткирүү барбы?', 'ru').text).toMatch(/жеткиребиз/i)
  })

  it('про срок доставки обещает звонок сотрудника, а не день', () => {
    const { text } = localAnswer('Доставка есть?', 'ru')
    expect(text).toMatch(/сотрудник свяжется/)
    expect(text).not.toMatch(/\b\d+\s*(дн|дня|дней)\b/)
  })

  it('на непонятный вопрос даёт телефон магазина', () => {
    const { text, productIds } = localAnswer('Вы чините велосипеды?', 'ru')
    expect(text).toMatch(/\+996/)
    expect(productIds).toEqual([])
  })

  it('находит товар по слову из названия', () => {
    const sample = products[0]
    const word = sample.nameRu.split(' ').filter((w) => w.length > 3)[0]
    const { productIds } = localAnswer(word, 'ru')
    expect(productIds.length).toBeGreaterThan(0)
  })
})

describe('searchProducts', () => {
  it('пустой запрос ничего не находит', () => {
    expect(searchProducts('', 'ru')).toEqual([])
    expect(searchProducts('   ', 'ru')).toEqual([])
  })

  it('не выдаёт больше запрошенного', () => {
    expect(searchProducts(products.map((p) => p.brand).join(' '), 'ru', 2).length).toBeLessThanOrEqual(2)
  })
})

describe('catalogDigest', () => {
  it('в списке столько же строк, сколько товаров', () => {
    expect(catalogDigest().split('\n')).toHaveLength(products.length)
  })

  it('не содержит себестоимости и служебных полей', () => {
    expect(catalogDigest()).not.toMatch(/oneCId|GUID/)
  })
})

const customer = {
  name: 'Азамат',
  balance: 1200,
  maxSpendPct: 30,
  orders: [
    { id: 'SC-1001', status: 'paid', total: 24900, createdAt: '2026-09-01T10:00:00' },
    { id: 'SC-1002', status: 'awaiting_payment', total: 5900, createdAt: null },
  ],
}

describe('вошедший покупатель', () => {
  it('здоровается по имени', () => {
    expect(localAnswer('Салам', 'ru', customer).text).toContain('Азамат')
  })

  it('называет остаток бонусов', () => {
    const { text } = localAnswer('сколько у меня бонусов?', 'ru', customer)
    expect(text).toContain('1200')
    expect(text).toContain('30')
  })

  it('показывает заказы человеческими словами', () => {
    const { text } = localAnswer('где мой заказ?', 'ru', customer)
    expect(text).toContain('SC-1001')
    expect(text).toContain('оплачен')
    expect(text).not.toContain('awaiting_payment')
  })

  it('не вошёл — зовёт войти, а не выдумывает заказы', () => {
    const { text } = localAnswer('где мой заказ?', 'ru', null)
    expect(text).toMatch(/Кабинет|\+996/)
  })
})

describe('рассрочка', () => {
  it('не называет число месяцев ни на одном языке', () => {
    for (const q of ['Сколько месяцев осталось по рассрочке?', 'Nasiyam necha oy qoldi?', 'Бөлүп төлөө канча ай калды?']) {
      const { text } = localAnswer(q, 'ru', customer)
      expect(text).toMatch(/\+996/)
      expect(text).not.toMatch(/\b\d{1,2}\s*(мес|ай|oy)\b/)
    }
  })
})
