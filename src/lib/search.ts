/**
 * Поиск по каталогу так, как пишет покупатель (аудит 07.10: «муздаткыч», «халадильник», «стиралка», «мидеа»,
 * «телевизор 43», «газ плита», «рассрочка» — всё давало 0, хотя товары есть).
 *
 * Правила:
 *  • запрос — слова; товар подходит, если подошло КАЖДОЕ слово (в названии, бренде, разделе RU/KY, описании,
 *    характеристиках);
 *  • слово подходит по началу (холодильник / холодильники / холодильника), с одной-двумя опечатками
 *    (халадильник), через синоним (стиралка → стиральная, муздаткыч → холодильник) и через латиницу бренда
 *    (мидеа → midea);
 *  • «рассрочка», «насия», «бөлүп», «адал» — не слово для поиска, а просьба показать товары в рассрочку;
 *  • ничего не нашлось по всем словам — ищем по любому из них (looseScore) и честно говорим, что это похожие.
 * Чистые функции, без React. Порядок результатов — по весу совпадения: название и бренд важнее описания.
 */
import type { Product } from '@/data/products'

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/ё/g, 'е')
    // кыргызские буквы на телефоне без кыргызской раскладки пишут как русские
    .replace(/ү/g, 'у')
    .replace(/ө/g, 'о')
    .replace(/ң/g, 'н')
    .replace(/[^a-zа-я0-9]+/g, ' ')
    .trim()
}

/**
 * Словосочетания — до разбиения на слова: «кир жуугуч» одно понятие, не «кир» + «жуугуч».
 * Граница слова — пробел или начало строки: «\b» в JS кириллицу не видит.
 */
const PHRASES: [RegExp, string][] = [
  [/(^| )кир жуу\S*( машина\S*)?/g, '$1стиральная'],
  [/(^| )чан соргуч\S*/g, '$1пылесос'],
  [/(^| )микротолкун\S*( меш\S*)?/g, '$1микроволновая'],
  [/(^| )тигуу машина\S*/g, '$1швейная'],
  [/(^| )идиш жуу\S*( машина\S*)?/g, '$1посудомоечная'],
  [/(^| )газ плит\S*/g, '$1газовая'],
]

/** Разговорное и кыргызское слово → как его пишут в 1С (по началу слова). */
const SYNONYMS: Record<string, string[]> = {
  холодос: ['холодильник'],
  холодилник: ['холодильник'],
  муздаткыч: ['холодильник', 'морозил'],
  морозилка: ['морозил'],
  стиралка: ['стиральн'],
  стиралку: ['стиральн'],
  стиралки: ['стиральн'],
  телик: ['телевизор'],
  тв: ['телевизор', 'tv'],
  микроволновка: ['микроволнов'],
  микроволновку: ['микроволнов'],
  микроволновки: ['микроволнов'],
  пылик: ['пылесос'],
  кондей: ['кондиционер'],
  посудомойка: ['посудомоечн'],
  посудомойку: ['посудомоечн'],
  духовка: ['духов'],
  духовку: ['духов'],
  электрочайник: ['чайник', 'электрачайник'],
  чайнек: ['чайник', 'электрачайник'],
  чайник: ['чайник', 'электрачайник'],
  утук: ['утюг'],
  ысыткыч: ['обогреват'],
  жылыткыч: ['обогреват'],
  желдеткич: ['вентилятор'],
  мультиварка: ['мультиварк'],
  соковыжималка: ['соковыж'],
  кулер: ['кулер', 'куллер'],
  мясорубка: ['мясорубк'],
  швейка: ['швейн'],
  оверлок: ['оверлок', 'overlok'],
  казан: ['казан'],
  мантоварка: ['манты'],
  самокат: ['самокат'],
  мопед: ['мопед', 'мотоцикл', 'мототцикл'],
  мотоцикл: ['мотоцикл', 'мототцикл'],
}

/** Бренды кириллицей, как их произносят. Остальное — транслит (translit) ниже. */
const BRANDS: Record<string, string> = {
  мидеа: 'midea',
  мидея: 'midea',
  мидиа: 'midea',
  элджи: 'lg',
  элжи: 'lg',
  лджи: 'lg',
  лж: 'lg',
  самсунг: 'samsung',
  хайсенс: 'hisense',
  хисенс: 'hisense',
  хайсенз: 'hisense',
  артел: 'artel',
  артель: 'artel',
  лево: 'levo',
  тошиба: 'toshiba',
  хитачи: 'hitachi',
  филипс: 'philips',
  беко: 'beko',
  аско: 'asko',
  авангард: 'avangard',
  хантажи: 'hantaji',
  хантаджи: 'hantaji',
  велберг: 'velberg',
  чангхонг: 'changhong',
  чанхонг: 'changhong',
  джек: 'jack',
  джас: 'jass',
  джасс: 'jass',
  брюс: 'bruce',
  баою: 'baoyu',
  тефаль: 'tefal',
  редмонд: 'redmond',
  шиваки: 'shivaki',
  чиго: 'chigo',
  конка: 'konka',
  юакин: 'uakeen',
  уакин: 'uakeen',
  итимат: 'itimat',
  арника: 'arnica',
  янома: 'janome',
  джаноме: 'janome',
}

const TRANSLIT: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n',
  о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sh', ъ: '', ы: 'y',
  ь: '', э: 'e', ю: 'yu', я: 'ya',
}
const translit = (word: string) => [...word].map((c) => TRANSLIT[c] ?? c).join('')

/** Слова о рассрочке: не ищем их в названиях, а включаем «только в рассрочку». */
const INSTALLMENT = /^(рассрочк[а-я]*|насия[а-я]*|насыя[а-я]*|болуп|адал[а-я]*|кредит[а-я]*)$/

export type Query = { words: string[]; installment: boolean }

export function parseQuery(raw: string): Query {
  let text = normalize(raw)
  for (const [from, to] of PHRASES) text = text.replace(from, to)
  const words: string[] = []
  let installment = false
  for (const w of text.split(' ').filter(Boolean)) {
    if (INSTALLMENT.test(w)) installment = true
    else words.push(w)
  }
  return { words, installment }
}

/** Расстояние Дамерау–Левенштейна (перестановка соседних букв — одна ошибка). */
export function typos(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
    }
  }
  return d[a.length][b.length]
}

/** Слово «как слышится»: о → а, без ь и ъ. Только для сравнения с опечаткой. */
const spoken = (w: string) => w.replace(/о/g, 'а').replace(/[ьъ]/g, '')

/** Подходит ли слово запроса к слову товара. typo — прощать опечатку (только в названии, бренде и разделе:
 * в описании слов много, и «кондей» с опечаткой находил «конденсат» у кофемашины). */
function wordFits(q: string, t: string, typo: boolean): boolean {
  if (/^\d/.test(q)) {
    // число: «43» к «43», «43s», но не к «430»; одна цифра — только целиком
    if (t === q) return true
    return q.length >= 2 && t.startsWith(q) && !/^\d/.test(t.slice(q.length))
  }
  if (q.length <= 2) return t === q
  // начало слова: холодильник ↔ холодильники, стиральн ↔ стиральная
  const stem = q.length <= 4 ? q : q.slice(0, Math.max(4, q.length - 2))
  if (t.startsWith(stem)) return true
  // опечатка: длинное слово — до двух, среднее — одна; сравниваем с началом слова товара той же длины
  if (typo && q.length >= 5 && t.length >= q.length - 1) {
    const limit = q.length >= 8 ? 2 : 1
    if (typos(q, t.slice(0, q.length)) <= limit) return true
    // пишут, как слышат: «а» вместо безударной «о», без «ь» — «халадилник» (аудит 09.10).
    // Это не считаем ошибкой: сравниваем слова, где о → а и нет ь/ъ.
    const fq = spoken(q)
    const ft = spoken(t)
    if (fq.length >= 5 && ft.startsWith(fq.slice(0, Math.max(4, fq.length - 2)))) return true
    return fq.length >= 5 && typos(fq, ft.slice(0, fq.length)) <= limit
  }
  return false
}

/** Варианты слова запроса: само слово, синонимы, бренд латиницей, транслит. */
function variants(word: string): string[] {
  // слово из словаря ищем только его синонимами: «кондей» — это «кондиционер», а не «конденсат»
  const out = new Set(SYNONYMS[word] ?? [word])
  if (BRANDS[word]) out.add(BRANDS[word])
  if (/[а-я]/.test(word) && word.length >= 3) out.add(translit(word))
  return [...out]
}

/** Где искать и с каким весом: название и бренд важнее раздела, раздел — описания и характеристик. */
export type SearchIndex = { name: string[]; brand: string[]; category: string[]; text: string[] }

export function indexOf(p: Product, categoryNames: string[]): SearchIndex {
  const words = (s: string) => normalize(s).split(' ').filter(Boolean)
  return {
    name: words(`${p.nameRu} ${p.nameKy}`),
    brand: words(p.brand),
    category: words(categoryNames.join(' ')),
    text: words(`${p.descRu} ${p.descKy} ${p.specs.map((s) => `${s.labelRu} ${s.valueRu}`).join(' ')}`),
  }
}

function wordScore(word: string, idx: SearchIndex): number {
  const options = variants(word)
  const hit = (list: string[], typo: boolean) => list.some((t) => options.some((q) => wordFits(q, t, typo)))
  if (hit(idx.name, true) || hit(idx.brand, true)) return 3
  if (hit(idx.category, true)) return 2
  if (hit(idx.text, false)) return 1
  return 0
}

/** Вес товара по запросу: 0 — не подходит (хоть одно слово не нашлось). Пустой запрос — 1. */
export function score(query: Query, idx: SearchIndex): number {
  let total = 0
  for (const w of query.words) {
    const s = wordScore(w, idx)
    if (!s) return 0
    total += s
  }
  return query.words.length ? total : 1
}

/** Мягкий вес: сколько слов запроса нашлось (для «показываем похожие», когда по всем словам пусто). */
export function looseScore(query: Query, idx: SearchIndex): number {
  return query.words.reduce((sum, w) => sum + (wordScore(w, idx) ? 1 : 0), 0)
}
