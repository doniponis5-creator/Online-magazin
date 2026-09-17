/**
 * Разделы сайта для каталога из 1С и правила раскладки товаров.
 *
 * Товар попадает в раздел по группе 1С (Родитель / Родитель.Родитель).
 * Товары без группы раскладываются по словам в названии. Правила идут
 * по порядку: первое совпадение побеждает, поэтому узкие правила выше
 * общих («морозильн» раньше «холодил», «стирал» раньше «сушил»).
 */

export type OneCCategory = {
  id: string
  nameRu: string
  nameKy: string
  /** иконка раздела и плейсхолдер товара без фото */
  art: 'fridge' | 'washer' | 'tv' | 'stove' | 'coffee' | 'robot' | 'fan' | 'battery' | 'box'
}

export const oneCCategories: OneCCategory[] = [
  { id: 'fridges', nameRu: 'Холодильники', nameKy: 'Муздаткычтар', art: 'fridge' },
  { id: 'washers', nameRu: 'Стиральные машины', nameKy: 'Кир жуугуч машиналар', art: 'washer' },
  { id: 'tv', nameRu: 'Телевизоры и ТВ', nameKy: 'Телевизорлор жана ТВ', art: 'tv' },
  { id: 'kitchen', nameRu: 'Кухонная техника', nameKy: 'Ашкана техникасы', art: 'stove' },
  { id: 'small-kitchen', nameRu: 'Мелкая техника', nameKy: 'Майда техника', art: 'coffee' },
  { id: 'care', nameRu: 'Уборка и уход', nameKy: 'Тазалоо жана кам көрүү', art: 'robot' },
  { id: 'climate', nameRu: 'Климат', nameKy: 'Климат', art: 'fan' },
  { id: 'power', nameRu: 'Энергоснабжение', nameKy: 'Энергия менен камсыздоо', art: 'battery' },
  { id: 'home', nameRu: 'Для дома', nameKy: 'Үй үчүн', art: 'box' },
]

export const FALLBACK_CATEGORY = 'home'

/** Группа 1С (нижний регистр, подстрока) → раздел сайта */
const GROUP_RULES: [string, string][] = [
  ['холодил', 'fridges'],
  ['морозил', 'fridges'],
  ['стиральн', 'washers'],
  ['сушилк', 'washers'],
  ['тв ', 'tv'],
  ['тв и', 'tv'],
  ['телевиз', 'tv'],
  ['антенн', 'tv'],
  ['мелкая кухон', 'small-kitchen'],
  ['чайник', 'small-kitchen'],
  ['духов', 'kitchen'],
  ['вытяжк', 'kitchen'],
  ['варочн', 'kitchen'],
  ['посудомо', 'kitchen'],
  ['микроволн', 'kitchen'],
  ['плит', 'kitchen'],
  ['кухонная техника', 'kitchen'],
  ['пылесос', 'care'],
  ['утюг', 'care'],
  ['отпарив', 'care'],
  ['уборк', 'care'],
  ['отоплен', 'climate'],
  ['охлажд', 'climate'],
  ['обогрев', 'climate'],
  ['кондиц', 'climate'],
  ['увлажн', 'climate'],
  ['энергосн', 'power'],
  ['инвертор', 'power'],
  ['аккумул', 'power'],
  ['генератор', 'power'],
  ['стабилиз', 'power'],
  ['товары для дома', 'home'],
  ['гардероб', 'home'],
  ['полки', 'home'],
  ['транспорт', 'home'],
  ['швейн', 'home'],
]

/** Слова в названии товара без группы → раздел сайта */
// В JS-регулярках \b не работает с кириллицей, поэтому границы слов — через (^|[^а-яa-z]).
const W = '(?:^|[^а-яa-z0-9])'

const NAME_RULES: [RegExp, string][] = [
  [/освежител|ароматизат/, 'home'],
  [/морозил|холодил|витрин/, 'fridges'],
  [/стирал|полуавтомат|сушилк.*бель|центрифуг/, 'washers'],
  [new RegExp(`телевиз|smart\\s*tv|android\\s*tv|приставк|антенн|кронштейн|${W}tv(?:$|[^a-z])`), 'tv'],
  [/посудомо|духов|вытяжк|варочн|встраиваем.*поверхн|плита|плитк|микроволн|свч/, 'kitchen'],
  [
    /чайник|термопот|самовар|блендер|миксер|мясорубк|мул[ь]?тиварк|хлебопеч|тостер|кофе|шашлыч|шашлин|аэрогрил|гриль|соковыжим|мини\s*печ|электропеч|сэндвич|вафельниц|фритюр|йогуртниц|чоппер|измельчит|кухонн.*комбайн|кулл?ер|минутка/,
    'small-kitchen',
  ],
  [new RegExp(`пылесос|утюг|отпарив|парогенер|пароочист|${W}фен(?:$|[^а-я])|бритв|плойк|выпрямит|триммер|эпилят|швабр`), 'care'],
  [new RegExp(`обогрев|конвектор|радиатор|тепловентил|кондиц|вентил|${W}вент(?:$|[^а-я])|водонагрев|увлажн|очистител.*воздух|климат`), 'climate'],
  [new RegExp(`инвертор|${W}ups(?:$|[^a-z])|ибп|аккумулят|генератор|стабилизат|удлинит|разветв|разветк|розетк`), 'power'],
]

export function categoryForGroup(group: string, parentGroup: string, name: string): string {
  const groups = `${parentGroup} ${group}`.toLowerCase()
  if (groups.trim()) {
    // сначала узкая группа товара, потом верхняя
    for (const source of [group.toLowerCase(), parentGroup.toLowerCase()]) {
      if (!source) continue
      const rule = GROUP_RULES.find(([needle]) => source.includes(needle))
      if (rule) return rule[1]
    }
  }
  const lower = ` ${name.toLowerCase().replace(/ё/g, 'е')}`
  const rule = NAME_RULES.find(([pattern]) => pattern.test(lower))
  return rule ? rule[1] : FALLBACK_CATEGORY
}
