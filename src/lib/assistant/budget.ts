/**
 * Бюджет покупателя из его слов: «до 30 тысяч», «30000 гача», «30 mingacha»,
 * «бюджет 25к», «30 миңге чейин».
 *
 * Считаем в коде, а не надеемся на модель: слабая модель слышала «до 30
 * тысяч» и первой предлагала машину за 33 500. Когда бюджет известен, модели
 * просто не показываются товары дороже — предложить их она не может.
 */

// После числа — не единица измерения: «до 8 кг» — это вес, а не 8 тысяч сом.
// (?!\d) — число берётся целиком: иначе из «55 дюймов» выходило «5».
const NOT_UNIT = String.raw`(?!\d)(?!\s*(?:кг|kg|л\b|литр|чел|kishi|киши|дюйм|"|см|мм|вт|w\b|ватт|об|мин|kv|м2|м²|%))`
const NUMBER = String.raw`(\d{1,3}(?:[\s.,]\d{3})+|\d+(?:[.,]\d+)?)` + NOT_UNIT + String.raw`\s*`
// Основа слова «тысяча» без окончания: «ming|acha», «миң|ге чейин» — окончание
// ловит уже следующая часть шаблона.
const THOUSAND = String.raw`(тыс\S*|к\b|k\b|ming|минг|миң|мың)?`

// Слова, после/перед которыми число — это потолок цены, а не «8 кг» или «5 человек».
const PATTERNS = [
  new RegExp(String.raw`(?:до|не дороже|максимум|макс\.?|бюджет\w*|в пределах|около|примерно|budjet\w*|byudjet\w*)\s*` + NUMBER + THOUSAND, 'i'),
  new RegExp(NUMBER + THOUSAND + String.raw`\s*(?:сом\S*|som\S*)?\s*(?:gacha|гача|acha|ача|га\s*чейин|ге\s*чейин|чейин|dan oshmasin|дан ошмасин)`, 'i'),
]

/** Потолок цены в сомах или null, если бюджет не назван. */
export function budgetFrom(text: string): number | null {
  for (const pattern of PATTERNS) {
    const match = pattern.exec(text)
    if (!match) continue
    let value = Number(match[1].replace(/[\s]/g, '').replace(/[.,](?=\d{3}\b)/g, '').replace(',', '.'))
    if (!Number.isFinite(value) || value <= 0) continue
    if (match[2] || value < 1000) value *= 1000
    // Меньше тысячи сом или больше десяти миллионов — это не бюджет на технику.
    if (value < 1000 || value > 10_000_000) continue
    return Math.round(value)
  }
  return null
}
