/**
 * «Память» онлайн-консультанта: то, что он знает о магазине.
 *
 * Здесь нет ни одного обращения к сети. Каталог уже лежит в коде сайта
 * (src/data/products.ts — он собран из выгрузки 1С), контакты — в
 * src/data/contacts.ts. Консультант отвечает по этим же данным, что и витрина,
 * поэтому цена в чате и цена на странице товара не могут разойтись.
 */

import { address, phones, since, yearsOnMarket } from '@/data/contacts'
import { categories, categoryName } from '@/data/categories'
import { products, type Product } from '@/data/products'
import { formatSom } from '@/lib/format'
import type { Lang } from '@/lib/i18n/config'

/** Товар в ответе консультанта: только то, что нужно показать карточкой. */
export type ProductHit = {
  id: string
  name: string
  brand: string
  price: number
  priceLabel: string
  inStock: boolean
  href: string
  image?: string
}

/**
 * Что консультант знает о вошедшем покупателе.
 *
 * Своё маленькое описание, а не тип из SBonus: в чат попадает только то, что
 * человеку и так показано в личном кабинете. Ни QR-кода, ни истории бонусов,
 * ни чужих телефонов здесь нет.
 */
export type CustomerBrief = {
  name: string
  /** бонусов на счету, сом */
  balance: number
  /** какую часть заказа можно закрыть бонусами, % */
  maxSpendPct: number
  orders: { id: string; status: string; total: number; createdAt: string | null }[]
  /**
   * Его рассрочка — цифры из 1С. null: долга нет или 1С их не прислала.
   * Попадает сюда только по телефону из входного cookie, поэтому это всегда
   * его собственный долг.
   */
  installment?: InstallmentBrief | null
}

export type InstallmentBrief = {
  debt: number
  overdue: number
  nextDate: string | null
  nextAmount: number
  monthsLeft: number
  /** на какой день цифры, «2026-09-21» */
  asOf: string | null
}

export function isInStock(product: Product): boolean {
  return product.variants.some((v) => v.stock > 0)
}

export function productName(product: Product, lang: Lang): string {
  return lang === 'ky' ? product.nameKy : product.nameRu
}

export function toHit(product: Product, lang: Lang): ProductHit {
  return {
    id: product.id,
    name: productName(product, lang),
    brand: product.brand,
    price: product.price,
    priceLabel: product.price > 0 ? formatSom(product.price) : lang === 'ky' ? 'Баасы суроо боюнча' : 'Цена по запросу',
    inStock: isInStock(product),
    href: `/${lang}/product/${product.id}`,
    image: product.image,
  }
}

/**
 * Синонимы: как покупатель называет товар и как он назван в 1С.
 *
 * В каталоге написано «Смартфон», а спрашивают «телефон»; написано
 * «Холодильник», а пишут «muzlatgich». Без этой таблицы поиск отвечал бы
 * «ничего не нашёл» на самые частые вопросы.
 */
const SYNONYMS: Record<string, string[]> = {
  телефон: ['смартфон'],
  телефондор: ['смартфон'],
  phone: ['смартфон'],
  telefon: ['смартфон'],
  ноут: ['ноутбук'],
  kompyuter: ['ноутбук'],
  компьютер: ['ноутбук'],
  televizor: ['телевизор'],
  телевизорлор: ['телевизор'],
  muzlatgich: ['холодильник'],
  муздаткыч: ['холодильник'],
  stiralka: ['стиральная'],
  стиралка: ['стиральная'],
  мошина: ['стиральная'],
  pylesos: ['пылесос'],
  changyutgich: ['пылесос'],
  наушник: ['наушники'],
  quloqchin: ['наушники'],
  soat: ['часы'],
  саат: ['часы'],
}

/**
 * Поиск по каталогу обычными словами.
 *
 * Без «умных» библиотек: слово запроса сравнивается с началом слов в названии,
 * бренде и разделе. Именно с началом, а не «где-то внутри»: иначе вопрос
 * «Вы чините велосипеды?» находил «Вытяжку» — потому что «вы» есть внутри
 * слова «вытяжка». Слова короче трёх букв не ищутся вовсе.
 */
export function searchProducts(query: string, lang: Lang, limit = 6, list: Product[] = products): Product[] {
  const words = expand(splitWords(query).filter((w) => w.length >= 3))
  if (words.length === 0) return []

  const scored = list.map((product) => {
    const name = splitWords(`${product.nameRu} ${product.nameKy} ${product.brand}`)
    const section = splitWords(`${categoryName(product.categoryId, 'ru')} ${categoryName(product.categoryId, 'ky')}`)
    const specs = splitWords(product.specs.map((s) => `${s.valueRu} ${s.valueKy}`).join(' '))
    let score = 0
    for (const word of words) {
      if (startsAny(name, word)) score += 5
      else if (startsAny(section, word)) score += 2
      else if (startsAny(specs, word)) score += 1
    }
    // Товар, которого нет на складе, показываем, но ниже: он всё же ответ на вопрос.
    if (score > 0 && isInStock(product)) score += 1
    return { product, score }
  })

  return scored
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || a.product.price - b.product.price)
    .slice(0, limit)
    .map((row) => row.product)
}

/** Слово покупателя + его синонимы из таблицы выше. */
function expand(words: string[]): string[] {
  const out = new Set<string>()
  for (const word of words) {
    out.add(word)
    for (const alias of SYNONYMS[word] ?? []) out.add(alias)
  }
  return [...out]
}

function splitWords(value: string): string[] {
  return normalize(value).split(' ').filter(Boolean)
}

/**
 * Слово запроса совпало, если с него начинается слово товара (или наоборот:
 * «холодильники» и «холодильник» — одно и то же). Слова короче трёх букв в
 * расчёт не берутся.
 */
function startsAny(haystack: string[], word: string): boolean {
  return haystack.some((w) => w.length >= 3 && (w.startsWith(word) || word.startsWith(w)))
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-z0-9а-яңөү]+/gi, ' ')
    .trim()
}

/** Сколько товаров по вопросу модель видит целиком, со всеми характеристиками. */
const FOCUS_LIMIT = 25
/** Сколько товаров влезает в короткий список всего каталога. */
const BRIEF_LIMIT = 1500
const DESC_CHARS = 400

/**
 * Каталог для модели в два слоя.
 *
 * Раньше модель видела первые 400 товаров и у каждого 4 характеристики: товар
 * из конца каталога для неё не существовал, а сравнить две стиральные машины
 * было не по чему. Теперь:
 *   1) ПО ВОПРОСУ — до 25 товаров, найденных по последним репликам покупателя,
 *      со всеми характеристиками и описанием: из них она сравнивает и советует;
 *   2) ВЕСЬ КАТАЛОГ — каждый товар одной короткой строкой: цена и наличие.
 *      Этого хватает, чтобы ответить «а есть ли у вас…» про что угодно.
 */
export function catalogForQuestion(list: Product[], question: string, lang: Lang): string {
  const focus = searchProducts(question, lang, FOCUS_LIMIT, list)
  const focusIds = new Set(focus.map((p) => p.id))

  const detailed = focus.map((product) => {
    const specs = product.specs.map((s) => `${s.labelRu}: ${s.valueRu}`).join('; ')
    const desc = product.descRu.replace(/\s+/g, ' ').trim()
    return [
      productLine(product),
      `доставка: ${product.deliveryPrice ? `${product.deliveryPrice} сом` : 'бесплатно'}`,
      specs ? `характеристики: ${specs}` : '',
      desc ? `описание: ${desc.slice(0, DESC_CHARS)}${desc.length > DESC_CHARS ? '…' : ''}` : '',
    ]
      .filter(Boolean)
      .join(' | ')
  })

  const rest = list.filter((p) => !focusIds.has(p.id))
  const brief = rest.slice(0, BRIEF_LIMIT).map(productLine)
  const cut = rest.length > BRIEF_LIMIT ? `\n(показаны ${BRIEF_LIMIT} из ${rest.length})` : ''

  return [
    detailed.length > 0
      ? `ПО ВОПРОСУ ПОКУПАТЕЛЯ — подробно, отсюда сравнивай и советуй:\n${detailed.join('\n')}`
      : 'ПО ВОПРОСУ ПОКУПАТЕЛЯ: по словам вопроса ничего не нашлось — ищи в общем списке ниже.',
    `ВЕСЬ КАТАЛОГ — коротко (характеристики у этих товаров есть, но здесь не показаны; спросят — скажи, что уточнишь, и дай телефон):\n${brief.join('\n')}${cut}`,
  ].join('\n\n')
}

function productLine(product: Product): string {
  const price = product.price > 0 ? `${product.price} сом` : 'цена по запросу'
  const old = product.oldPrice ? `, было ${product.oldPrice} сом` : ''
  const stock = isInStock(product) ? 'есть' : 'нет в наличии'
  return [
    `id=${product.id}`,
    `${product.brand} ${product.nameRu}`,
    categoryName(product.categoryId, 'ru'),
    `${price}${old}`,
    stock,
    // Гарантию и акцию пишем и в короткой строке: про них спрашивают чаще всего.
    product.warrantyMonths > 0 ? `гарантия ${product.warrantyMonths} мес.` : '',
    ...promoMarks(product),
  ]
    .filter(Boolean)
    .join(' | ')
}

/**
 * Отметки акции из карточки товара в 1С. Истёкшую акцию не показываем:
 * отметку в 1С могли забыть снять, а обещать прошедшую скидку нельзя.
 */
function promoMarks(product: Product, now = Date.now()): string[] {
  const until = product.promoUntil ? Date.parse(product.promoUntil + '+06:00') : NaN
  if (Number.isFinite(until) && until < now) return []
  const marks: string[] = []
  if (product.sale) marks.push('распродажа')
  if (product.dealOfDay) marks.push('товар дня')
  if (Number.isFinite(until)) marks.push(`акция до ${product.promoUntil!.slice(0, 10)} ${product.promoUntil!.slice(11, 16)}`)
  return marks
}

/** Всё, что консультант должен знать о самом магазине. */
export function storeFacts(lang: Lang): string {
  const numbers = phones.map((p) => p.display).join(', ')
  const sections = categories.map((c) => `${c.nameRu} (id=${c.id})`).join(', ')
  return [
    'Магазин: Smart Centr, он же S MARKET. Электроника и бытовая техника.',
    `Адрес: ${address.ru}. Работает с ${since} года (${yearsOnMarket()} лет).`,
    `Телефоны (они же WhatsApp и Telegram): ${numbers}.`,
    '',
    'ДОСТАВКА',
    'Возим по всему Кыргызстану — в любой город и любое село, куда скажет покупатель.',
    'До центра района или области доставка бесплатная. Назвал свой город (Манас, Талас, Каракол, Нарын, Баткен, Джалал-Абад, Бишкек, Ош) — отвечай прямо: «привезём, доставка бесплатная».',
    'Если у товара в каталоге ниже указана цена доставки — назови её, она за этот товар.',
    'В село или отдалённое место довозим тоже.',
    'КОГДА ПРИВЕЗЁМ: точный день и час не называй никогда. Отвечай так: «оплатите заказ — и наш сотрудник свяжется с вами и договорится, когда привезти». Это и есть ответ на «за сколько дней», «когда будет», «во сколько».',
    '',
    'КАК ЗАКАЗАТЬ И КАК ЗАПЛАТИТЬ',
    'Спросили «как купить», «куда перевести деньги», «куда скинуть» — объясни по шагам:',
    '1) открыть страницу товара на сайте и нажать «В корзину»;',
    '2) оформить заказ — имя, телефон, куда везти;',
    '3) сайт сам откроет страницу оплаты, там QR и список банков.',
    'Платят из приложения своего банка (MBANK, O!Bank, Bakai, Optima, KICB, MegaPay и другие) — деньги идут в кассу магазина через O!Деньги.',
    'Можно приехать и купить в самом магазине — самовывоз.',
    'ВАЖНО: никакого номера карты и никакого личного счёта ты не даёшь и не обещаешь. Денег «на карту сотруднику» магазин не принимает.',
    'Оплаты при получении на сайте нет — не обещай её.',
    'Есть бонусы SBonus: часть заказа закрывается бонусами после входа по номеру телефона.',
    'Заказать можно и без входа; вход нужен только для оплаты бонусами.',
    '',
    'ЕСЛИ ПОКУПАТЕЛЬ БОИТСЯ ЗАКАЗЫВАТЬ',
    'Не уговаривай и не дави. Просто скажи правду, из-за которой бояться нечего:',
    `магазин настоящий и работает с ${since} года (${yearsOnMarket()} лет), у него есть адрес и три телефона;`,
    'можно приехать и забрать самому; можно сначала позвонить и поговорить с живым сотрудником;',
    'заказ и его состояние видны в личном кабинете на сайте.',
    'Никогда не проси прислать деньги на чей-то личный счёт или карту — оплата только через сайт или в магазине.',
    '',
    'ЧЕГО ТЫ НЕ ЗНАЕШЬ — И НЕ ВЫДУМЫВАЙ (если этого нет в «ЗНАНИЯ ОТ ВЛАДЕЛЬЦА»; там написано — отвечай по написанному)',
    'Часы работы магазина. Не пиши «работаем ежедневно» или «с 9 до 18» от себя — скажи, что время работы уточнят по телефону.',
    'Срок гарантии, если он не указан у товара в каталоге ниже. Не говори «0 месяцев» и не называй своё число — скажи, что срок подтвердит сотрудник.',
    'Возврат, обмен и брак: решение принимает сотрудник магазина. Посочувствуй и позови к телефону, но сам ничего не обещай сверх написанного владельцем.',
    'Свойства товара, которых нет в его характеристиках. Не дописывай «инверторный мотор», «класс А+++», «есть пар» — этого может не быть.',
    '',
    `Разделы каталога: ${sections}.`,
    `Язык покупателя сейчас: ${lang === 'ky' ? 'кыргызский' : 'русский'}.`,
  ].join('\n')
}
