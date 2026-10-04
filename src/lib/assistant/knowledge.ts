/**
 * «Память» онлайн-консультанта: то, что он знает о магазине.
 *
 * Здесь нет ни одного обращения к сети. Каталог уже лежит в коде сайта
 * (src/data/products.ts — он собран из выгрузки 1С), контакты — в
 * src/data/contacts.ts. Консультант отвечает по этим же данным, что и витрина,
 * поэтому цена в чате и цена на странице товара не могут разойтись.
 */

import { productFacts } from '@/data/product-facts'
import { address, phones, since, yearsOnMarket } from '@/data/contacts'
import { categories, categoryName } from '@/data/categories'
import { products, type Product } from '@/data/products'
import { formatSom } from '@/lib/format'
import { budgetFrom } from './budget'
import type { Lang } from '@/lib/i18n/config'

/** Товар в ответе консультанта: только то, что нужно показать карточкой. */
export type ProductHit = {
  id: string
  name: string
  brand: string
  price: number
  priceLabel: string
  inStock: boolean
  /** скоро поступит: купить можно только предзаказом */
  preorder?: boolean
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
  /** бонусами за один заказ — не больше, сом; 0 — без предела */
  maxSpendCap?: number
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
    preorder: product.preorder || undefined,
    // У товара «только для чата» страницы нет — карточка без ссылки.
    href: product.chatOnly ? '' : `/${lang}/product/${product.id}`,
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
  // Как пишут на самом деле (переписки 26.09–03.10): «Пилисоска», «стиралкаларды», «эндура».
  пилисос: ['пылесос'],
  пилесос: ['пылесос'],
  музлаткич: ['холодильник'],
  жуугуч: ['стиральная'],
  эндура: ['эндуро'],
  // Каталог больше не едет целиком (04.10) — что не нашёл поиск, модель уже не видит: «Kir mashina kerak», «Мотолор келдиби».
  kir: ['стиральная'],
  кир: ['стиральная'],
  мото: ['мотоцикл', 'мототцикл', 'эндуро'],
  moto: ['мотоцикл', 'мототцикл', 'эндуро'],
  велик: ['велосипед', 'велик'],
  велосипед: ['велик'],
  velosiped: ['велик', 'велосипед'],
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
// «Идиш жууган машинка», «idish yuvadigan mashina» — посудомоечная, а не стиральная: «жуу…», «кир», «машина»
// по отдельности тянут к стиральным (переписка 04.10: бот сказал «посудомоечных нет» при четырёх в наличии
// и предложил стиралки). «Идиш» без «мыть» — просто посуда (казан, контейнер) — не трогаем.
const DISH = /^(идиш|idish|idsh)/
const DISH_WORD = /^(посудомо|посудомой|posudomo)/
const WASH = /^(жуу|жуг|юв|yuv|кир|kir|мошин|машин|mashin|стирал|мойк|моеч|моющ)/

export function dishwasherWords(words: string[]): string[] {
  const dish = words.some((w) => DISH_WORD.test(w)) || (words.some((w) => DISH.test(w)) && words.some((w) => WASH.test(w)))
  if (!dish) return words
  return [...words.filter((w) => !DISH.test(w) && !DISH_WORD.test(w) && !WASH.test(w)), 'посудомоечная']
}

export function searchProducts(query: string, lang: Lang, limit = 6, list: Product[] = products): Product[] {
  const words = expand(dishwasherWords(splitWords(query).filter((w) => w.length >= 3)))
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

/** Слова рекламных подписей, которые ничего не говорят о товаре: «литр» дал «Казан 6 литр» на «Мини печь 38 литр». */
const POST_NOISE = new Set([
  'литр', 'литра', 'литров', 'литрлик', 'доставка', 'доставкой', 'бесплатная', 'бесплатно', 'акция', 'акциясы', 'скидка', 'скидкой',
  'товар', 'дня', 'новинка', 'новый', 'новая', 'менен', 'арзандатуу', 'чегирма', 'жаңы', 'келди', 'кайрадан', 'поступление', 'болду',
  'бар', 'бор', 'есть', 'наличии', 'цена', 'баасы', 'нархи', 'сом', 'som', 'для', 'это', 'все', 'шашылыңыз', 'успейте', 'только',
])

/**
 * Один товар по подписи поста Instagram — или null, если уверенности нет.
 *
 * searchProducts здесь не годится: в подписи «Эндура мотоцикл мини электрический кайрадан
 * поступление болду» она нашла «Парту МИНИ за 500 сом» (слово «мини» и характеристики), и человек
 * получил бы в Direct чужую цену (замер 04.10). Здесь — только название, и редкое слово весит
 * больше частого: «эндуро» есть у одного товара (вес 1), «мини» — у пяти (вес 0,2 каждому).
 * Победитель должен быть явным: не меньше 0,6 и в полтора раза больше второго.
 */
export function bestNameMatch(text: string, list: Product[]): Product | null {
  // Слово подписи вместе с его синонимами — одно слово: «мотоцикл» (→ «мототцикл», «эндуро») не должен
  // давать очки сразу и Эндуро, и спортивному мотоциклу как два разных слова.
  // Числа — только от трёх цифр: «940» из «ZL-940» отличает модель; «8 кг», «38 литр» — нет (короче).
  // Цена «15900» в названия не входит и очков не даёт.
  const words = [...new Set(splitWords(text).filter((w) => w.length >= 3 && !POST_NOISE.has(w)))]
  if (words.length === 0) return null
  const names = list.map((p) => splitWords(`${p.nameRu} ${p.nameKy} ${p.brand}`))
  const scores = list.map(() => 0)
  const score = (word: string, among: (i: number) => boolean) => {
    const forms = expand([word])
    const hits = names.map((name, i) => (among(i) && forms.some((f) => startsAny(name, f)) ? i : -1)).filter((i) => i >= 0)
    for (const i of hits) scores[i] += 1 / hits.length
  }
  // Сначала слова, потом числа — и числа только среди тех, кого уже нашли по словам: «322 литр»
  // у холодильника AVEST иначе дал «Духовку UAKEEN UK-322» (замер 04.10).
  for (const word of words.filter((w) => !/^\d+$/.test(w))) score(word, () => true)
  for (const word of words.filter((w) => /^\d+$/.test(w))) score(word, (i) => scores[i] > 0)
  const order = scores.map((s, i) => [s, i] as const).sort((a, b) => b[0] - a[0])
  const [first, second] = order
  if (!first || first[0] < 0.6 || (second && second[0] * 1.5 > first[0])) return null
  const winner = list[first[1]]
  // Одного общего слова мало (ревью 04.10: «Ламинат для пола» → «Парта МИНИ Ламинат» за 500,
  // «Спорт костюм» → мотоцикл): нужно два слова подписи в названии — или одно, но марка/модель
  // (латиница или с цифрой: «UAKEEN», «AV-80MXLB», «940»).
  const name = names[first[1]]
  const matched = words.filter((w) => expand([w]).some((f) => startsAny(name, f)))
  const distinctive = matched.some((w) => /[a-z0-9]/.test(w) && w.length >= 3)
  // Цена в подписи. Число — тысячи группами по три («13 900», «13.900») или подряд («13900»);
  // «ZL-940 13 900 сом» — 13 900, не 94013900.
  const prices = [...text.matchAll(/(?<![\d.,])(\d{1,3}(?:[  .,]\d{3})+|\d{3,7})\s*(?:сом|som|с(?![\p{L}]))/giu)].map((m) => Number(m[1].replace(/\D/g, '')))
  const samePrice = prices.some((p) => Math.abs(p - winner.price) <= winner.price * 0.03)
  // Цена есть, а у товара другая — это не он (новый товар, которого ещё нет в каталоге).
  if (prices.length > 0 && !samePrice) return null
  // Одно слово + та же цена («Эндура мини 15 900 сом гана!») — достаточно.
  if (matched.length < 2 && !distinctive && !samePrice) return null
  return winner
}

/** Слово покупателя + его синонимы из таблицы выше. */
function expand(words: string[]): string[] {
  const out = new Set<string>()
  for (const word of words) {
    out.add(word)
    // С окончанием тоже: «стиралкаларды», «муздаткычтар», «пилисоска» — по началу слова.
    for (const [key, aliases] of Object.entries(SYNONYMS)) {
      // «мошинага батабы» — это про автомобиль, не про стиральную: «мошина» только целым словом.
      if (word === key || (key.length >= 4 && key !== 'мошина' && word.startsWith(key))) for (const alias of aliases) out.add(alias)
    }
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
// 12, а не 25: «электро» находило и чайники, и велосипеды — каждый ответ вёз их подробно (замер 04.10)
const FOCUS_LIMIT = 12
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
export function catalogForQuestion(list: Product[], question: string, lang: Lang, ceiling: number | null = null, pinned: string[] = []): string {
  // Товары, о которых уже идёт разговор (показанные в чате), — всегда подробно: «канча кг?»,
  // «машинага батабы?» после фото без названия иначе не находили карточку, и бот отвечал
  // «уточню», хотя характеристики в каталоге были.
  const byId = new Map(list.map((p) => [p.id, p]))
  const talked = pinned.map((id) => byId.get(id)).filter((p): p is Product => Boolean(p))
  const found = [...talked, ...searchProducts(question, lang, FOCUS_LIMIT, list).filter((p) => !pinned.includes(p.id))].slice(0, FOCUS_LIMIT)

  // Бюджет назван — дороже не показываем вовсе: слабая модель иначе первой
  // предлагала то, что не по карману. Ничего не влезло — показываем три
  // самых дешёвых из найденного, и модель честно говорит про разницу.
  // ceiling — «дорого» после предложения: дешевле того, что уже назвали.
  const budget = ceiling ?? budgetFrom(question)
  const fits = (p: Product) => p.price > 0 && (budget === null || p.price <= budget)
  let focus = found.filter(fits)
  let budgetNote = budget ? `Покупатель назвал бюджет: до ${budget} сом. Ниже — только то, что в него укладывается.\n` : ''
  if (budget && focus.length === 0 && found.length > 0) {
    focus = [...found].filter((p) => p.price > 0).sort((a, b) => a.price - b.price).slice(0, 3)
    budgetNote = `Покупатель назвал бюджет: до ${budget} сом. В него ничего не укладывается — ниже самые дешёвые варианты; честно скажи, на сколько они дороже.\n`
  }
  if (!budget) focus = found
  else focus = [...talked, ...focus.filter((p) => !pinned.includes(p.id))]
  const focusIds = new Set(focus.map((p) => p.id))

  const detailed = focus.map((product) => {
    const specs = product.specs.map((s) => `${s.labelRu}: ${s.valueRu}`).join('; ')
    const desc = product.descRu.replace(/\s+/g, ' ').trim()
    return [
      productLine(product),
      // 0 в 1С — «доставка не стоит денег» только до городов из списка ДОСТАВКА; модель читала «бесплатно» как «везде».
      `доставка: ${product.deliveryPrice ? `${product.deliveryPrice} сом` : 'бесплатно до центра городов из списка «ДОСТАВКА»'}`,
      specs ? `характеристики: ${specs}` : '',
      productFacts(product.id),
      desc ? `описание: ${desc.slice(0, DESC_CHARS)}${desc.length > DESC_CHARS ? '…' : ''}` : '',
    ]
      .filter(Boolean)
      .join(' | ')
  })

  // Весь каталог строкой на товар — 36 000 из 46 000 токенов каждого ответа (замер 04.10, 544 товара):
  // за него платили на каждое «Салам». Теперь строкой — только разделы, о которых идёт речь
  // (разделы найденного и показанного); остальные — сводкой «раздел: сколько, цены от–до».
  const rest = list.filter((p) => !focusIds.has(p.id))
  // Разделы — показанных в разговоре и трёх самых подходящих: не всех найденных по одному слову.
  const near = new Set([...talked, ...focus.slice(0, talked.length + 3)].map((p) => p.categoryId))
  const brief = rest
    .filter((p) => near.has(p.categoryId))
    .slice(0, BRIEF_LIMIT)
    .map((p) => productLine(p) + (budget && p.price > budget ? ' | дороже бюджета — не предлагай' : ''))

  return [
    detailed.length > 0
      ? `ПО ВОПРОСУ ПОКУПАТЕЛЯ — подробно, отсюда сравнивай и советуй:\n${budgetNote}${detailed.join('\n')}`
      : 'ПО ВОПРОСУ ПОКУПАТЕЛЯ: по словам вопроса ничего не нашлось — посмотри разделы ниже и спроси, что именно нужно.',
    brief.length > 0
      ? `ЕЩЁ В ЭТИХ ЖЕ РАЗДЕЛАХ — коротко (характеристики у них есть, но здесь не показаны; спросят — скажи, что уточнишь):\n${brief.join('\n')}`
      : '',
  ]
    .filter(Boolean)
    .join('\n\n')
}

/**
 * Все разделы магазина сводкой — постоянная часть промпта (кэш Gemini): меняется, только когда
 * меняется каталог. Модели строкой — в «КАТАЛОГ» в конце, по вопросу.
 */
export function catalogSections(list: Product[]): string {
  return `РАЗДЕЛЫ МАГАЗИНА — сводка (модели здесь не перечислены). Спросят про товар раздела, которого нет в «КАТАЛОГ» в конце, —
скажи, что такие есть, назови цены «обычно от … до …» и уточни одним вопросом, что именно нужно (объём, размер, бюджет):
по следующему вопросу ты увидишь модели подробно. «Нет» про раздел из этого списка не говори.
${sectionIndex(list)}`
}

/** Сводка раздела: «Холодильники: 23 (в наличии 19), обычно 13 700–40 000 сом». */
function sectionIndex(list: Product[]): string {
  const groups = new Map<string, Product[]>()
  for (const p of list) groups.set(p.categoryId, [...(groups.get(p.categoryId) ?? []), p])
  // Это постоянная часть промпта (кэш Gemini): любая цифра, которая меняется с остатками
  // («в наличии 19»), пересоздавала бы кэш каждые 10 минут (выгрузка 1С) — и экономия уходила бы
  // на создание кэша. Поэтому без количества, цены — грубо: от (вниз до тысячи) — до (вверх до 5 тысяч).
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, items]) => {
      // От 10-го до 90-го процента цен: «от 200 сом» за запчасть в разделе стиральных машин
      // звучало как цена машины (имтихон 04.10).
      const prices = items.map((p) => p.price).filter((n) => n > 0).sort((a, b) => a - b)
      const at = (q: number) => prices[Math.min(prices.length - 1, Math.floor(q * prices.length))]
      const low = Math.max(1000, Math.floor(at(0.1) / 1000) * 1000)
      const high = Math.max(low, Math.ceil(at(0.9) / 5000) * 5000)
      const span = prices.length > 0 ? `обычно ${low}–${high} сом` : 'цены уточнить'
      return `${categoryName(id, 'ru')}: ${span}`
    })
    .join('\n')
}

function productLine(product: Product): string {
  const price = product.price > 0 ? `${product.price} сом` : 'цена по запросу'
  const old = product.oldPrice ? `, было ${product.oldPrice} сом` : ''
  // Предзаказ — не «есть»: модель пообещала бы забрать сегодня.
  const stock = product.preorder
    ? 'скоро поступит — только предзаказ: оплата сейчас, отдадим, когда привезут; срок уточнит сотрудник'
    : isInStock(product) ? 'есть' : 'нет в наличии'
  return [
    `id=${product.id}`,
    // Бренд уже в названии из 1С — не дублируем: «FLAGMAN Стиральная машина FLAGMAN» модель
    // так и повторяла покупателю.
    product.nameRu.toLowerCase().includes(product.brand.toLowerCase()) ? product.nameRu : `${product.brand} ${product.nameRu}`,
    categoryName(product.categoryId, 'ru'),
    `${price}${old}`,
    stock,
    // Гарантию и акцию пишем и в короткой строке: про них спрашивают чаще всего.
    product.warrantyMonths > 0 ? `гарантия ${product.warrantyMonths} мес.` : '',
    ...promoMarks(product),
    product.chatOnly ? 'есть в магазине, на сайте ещё не выложен (нет фото) — продаёшь здесь, в чате' : '',
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
    'Куда и как возим — в «ПРАВИЛА МАГАЗИНА» ниже (список городов, где доставка до центра бесплатная).',
    'Если у товара в каталоге ниже указана цена доставки — назови её, она за этот товар.',
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
    'ЧЕГО ТЫ НЕ ЗНАЕШЬ — И НЕ ВЫДУМЫВАЙ (если этого нет в «ПРАВИЛА МАГАЗИНА» и «ЗНАНИЯ ОТ ВЛАДЕЛЬЦА»; там написано — отвечай по написанному)',
    'Свойства товара, которых нет в его характеристиках. Не дописывай «инверторный мотор», «класс А+++», «есть пар» — этого может не быть.',
    'Спорный случай с браком или возвратом — посочувствуй и позови сотрудника, сверх правил не обещай.',
    '',
    // Язык ответа задаёт «ЯЗЫК ОТВЕТА» в начале (по словам покупателя). Здесь был язык сайта —
    // в WhatsApp всегда «русский», и он спорил с узбекским покупателем (аудит 03.10).
    `Разделы каталога: ${sections}.`,
  ].join('\n')
}
