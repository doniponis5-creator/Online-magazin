/**
 * ─────────────────────────────────────────────────────────────────────────────
 * ДЕМО-ФИКСТУРЫ / DEMO FIXTURES
 * Все товары, бренды, цены, характеристики и остатки — вымышленные
 * демонстрационные данные. Это НЕ склад 1С и не публичная оферта.
 * Реальные товары/фото/цены появятся после интеграции (ARCHITECTURE_UZ.md, §4, §12).
 *
 * Изображения — оригинальные схематичные SVG-иллюстрации
 * (src/components/ProductArt.tsx), помечены как демо и не являются
 * фотографиями реальных моделей: внешность реальных товаров не выдумывается.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { CategoryId } from './categories'

export type ArtKind =
  | 'phone'
  | 'laptop'
  | 'tablet'
  | 'tv'
  | 'headphones'
  | 'washer'
  | 'coffee'
  | 'fryer'
  | 'robot'
  | 'watch'
  | 'speaker'

export type ColorOption = { key: string; labelRu: string; labelKy: string; hex: string }
export type MemoryOption = { key: string; labelRu: string; labelKy: string }

/**
 * Вариант — конкретная комбинация «цвет + память».
 * colorKey/memoryKey ссылаются на опции продукта; если измерения нет,
 * поле не задано и при подборе комбинации считается совпадающим.
 */
export type ProductVariant = {
  id: string
  stock: number // демо-остаток, шт.
  priceDelta?: number
  colorKey?: string
  memoryKey?: string
}

export type SpecRow = {
  labelRu: string
  labelKy: string
  valueRu: string
  valueKy: string
}

export type Product = {
  id: string
  brand: string
  categoryId: CategoryId
  nameRu: string
  nameKy: string
  price: number // сом, целое число
  oldPrice?: number
  art: ArtKind
  image?: string
  baseColor: string
  descRu: string
  descKy: string
  specs: SpecRow[]
  warrantyMonths: number
  colorOptions?: ColorOption[]
  memoryOptions?: MemoryOption[]
  variants: ProductVariant[]
  badge?: 'hit' | 'new'
}

const screen = (value: string): SpecRow => ({
  labelRu: 'Экран',
  labelKy: 'Экраны',
  valueRu: value,
  valueKy: value,
})

const memorySpec = (ram: string, storage: string): SpecRow => ({
  labelRu: 'Память',
  labelKy: 'Эси',
  valueRu: `${ram} ОЗУ / ${storage}`,
  valueKy: `${ram} ОЗУ / ${storage}`,
})

const cameraSpec = (value: string): SpecRow => ({
  labelRu: 'Камера',
  labelKy: 'Камерасы',
  valueRu: value,
  valueKy: value,
})

const batterySpec = (value: string): SpecRow => ({
  labelRu: 'Аккумулятор',
  labelKy: 'Батареясы',
  valueRu: value,
  valueKy: value,
})

const plain = (labelRu: string, labelKy: string, valueRu: string, valueKy = valueRu): SpecRow => ({
  labelRu,
  labelKy,
  valueRu,
  valueKy,
})

export const products: Product[] = [
  // ── Смартфоны ────────────────────────────────────────────────────────────
  {
    id: 'aura-x5',
    brand: 'Aura',
    categoryId: 'smartphones',
    nameRu: 'Смартфон Aura X5',
    nameKy: 'Aura X5 смартфону',
    price: 24900,
    oldPrice: 27900,
    art: 'phone',
    baseColor: '#3B6FE8',
    descRu: 'Демо-модель: смартфон с ярким AMOLED-экраном и ёмкой батареей для работы и развлечений.',
    descKy: 'Демо-модель: жаркын AMOLED экраны жана узак кызмат этүүчү батарейкасы бар смартфон.',
    specs: [
      screen('6,6″ AMOLED, 90 Гц'),
      memorySpec('8 ГБ', '128 ГБ'),
      cameraSpec('основная 50 Мп, фронтальная 16 Мп'),
      batterySpec('5000 мА·ч, быстрая зарядка 33 Вт'),
      plain('Операционная система', 'Операциялык система', 'Android (демо)'),
    ],
    warrantyMonths: 12,
    badge: 'hit',
    colorOptions: [
      { key: 'blue', labelRu: 'Синий', labelKy: 'Көк', hex: '#3B6FE8' },
      { key: 'white', labelRu: 'Белый', labelKy: 'Ак', hex: '#E9EDF5' },
      { key: 'ink', labelRu: 'Тёмный', labelKy: 'Кара көк', hex: '#1E2C3C' },
    ],
    variants: [
      { id: 'blue', colorKey: 'blue', stock: 7 },
      { id: 'white', colorKey: 'white', stock: 4 },
      { id: 'ink', colorKey: 'ink', stock: 0 },
    ],
  },
  {
    id: 'nova-lite',
    brand: 'Nova',
    categoryId: 'smartphones',
    nameRu: 'Смартфон Nova Lite',
    nameKy: 'Nova Lite смартфону',
    price: 12900,
    art: 'phone',
    baseColor: '#5A8BF0',
    descRu: 'Демо-модель: недорогой смартфон для повседневных задач — звонки, мессенджеры, фото.',
    descKy: 'Демо-модель: арзан смартфон — чалуулар, мессенджерлер жана сүрөт үчүн.',
    specs: [
      screen('6,5″ IPS, 60 Гц'),
      memorySpec('4 ГБ', '64 ГБ'),
      cameraSpec('основная 13 Мп'),
      batterySpec('4000 мА·ч'),
    ],
    warrantyMonths: 12,
    colorOptions: [
      { key: 'blue', labelRu: 'Голубой', labelKy: 'Көгүлтүр', hex: '#5A8BF0' },
      { key: 'ink', labelRu: 'Тёмный', labelKy: 'Кара көк', hex: '#1E2C3C' },
    ],
    variants: [
      { id: 'blue', colorKey: 'blue', stock: 12 },
      { id: 'ink', colorKey: 'ink', stock: 5 },
    ],
  },
  {
    id: 'vega-pro',
    brand: 'Vega',
    categoryId: 'smartphones',
    nameRu: 'Смартфон Vega Pro',
    nameKy: 'Vega Pro смартфону',
    price: 41500,
    art: 'phone',
    baseColor: '#142334',
    descRu: 'Демо-модель: флагманский смартфон с большим объёмом памяти.',
    descKy: 'Демо-модель: чоң эс тийини бар флагман смартфон.',
    specs: [
      screen('6,7″ AMOLED, 120 Гц'),
      cameraSpec('основная 108 Мп'),
      batterySpec('5200 мА·ч, 45 Вт'),
      plain('Бренд', 'Бренд', 'Vega (демо)'),
    ],
    warrantyMonths: 12,
    badge: 'new',
    memoryOptions: [
      { key: '8-256', labelRu: '8/256 ГБ', labelKy: '8/256 ГБ' },
      { key: '12-512', labelRu: '12/512 ГБ', labelKy: '12/512 ГБ' },
    ],
    variants: [
      { id: '8-256', memoryKey: '8-256', stock: 3 },
      { id: '12-512', memoryKey: '12-512', stock: 2, priceDelta: 4000 },
    ],
  },

  // ── Ноутбуки ─────────────────────────────────────────────────────────────
  {
    id: 'airbook-14',
    brand: 'AirBook',
    categoryId: 'laptops',
    nameRu: 'Ноутбук AirBook 14',
    nameKy: 'AirBook 14 ноутбуку',
    price: 52900,
    art: 'laptop',
    baseColor: '#D7DEEA',
    descRu: 'Демо-модель: лёгкий ноутбук для учёбы и офисных задач.',
    descKy: 'Демо-модель: окуу жана кеңсе иштери үчүн жеңил ноутбук.',
    specs: [
      screen('14″ IPS, Full HD'),
      memorySpec('16 ГБ', '512 ГБ SSD'),
      plain('Процессор', 'Процессор', '4-ядерный (демо)'),
      plain('Вес', 'Салмагы', '1,3 кг'),
    ],
    warrantyMonths: 24,
    memoryOptions: [
      { key: '16-512', labelRu: '16/512 ГБ', labelKy: '16/512 ГБ' },
      { key: '16-1024', labelRu: '16/1 ТБ', labelKy: '16/1 ТБ' },
    ],
    variants: [
      { id: '16-512', memoryKey: '16-512', stock: 5 },
      { id: '16-1024', memoryKey: '16-1024', stock: 3, priceDelta: 6000 },
    ],
  },
  {
    id: 'prowork-15',
    brand: 'ProWork',
    categoryId: 'laptops',
    nameRu: 'Ноутбук ProWork 15',
    nameKy: 'ProWork 15 ноутбуку',
    price: 68400,
    art: 'laptop',
    baseColor: '#1E2C3C',
    descRu: 'Демо-модель: производительный ноутбук для работы с графикой и многозадачности.',
    descKy: 'Демо-модель: графика жана көп тапшырма үчүн кубаттуу ноутбук.',
    specs: [
      screen('15,6″ IPS, Full HD'),
      memorySpec('16 ГБ', '512 ГБ SSD'),
      plain('Процессор', 'Процессор', '8-ядерный (демо)'),
      plain('Вес', 'Салмагы', '1,9 кг'),
    ],
    warrantyMonths: 24,
    memoryOptions: [
      { key: '16-512', labelRu: '16/512 ГБ', labelKy: '16/512 ГБ' },
      { key: '32-1024', labelRu: '32/1 ТБ', labelKy: '32/1 ТБ' },
    ],
    variants: [
      { id: '16-512', memoryKey: '16-512', stock: 2 },
      { id: '32-1024', memoryKey: '32-1024', stock: 2, priceDelta: 9000 },
    ],
  },

  // ── Телевизоры ───────────────────────────────────────────────────────────
  {
    id: 'smartview-43',
    brand: 'SmartView',
    categoryId: 'tv',
    nameRu: 'Телевизор SmartView 43″',
    nameKy: 'SmartView 43″ телевизору',
    price: 27800,
    art: 'tv',
    baseColor: '#142334',
    descRu: 'Демо-модель: 43-дюймовый 4K-телевизор со Smart-функциями.',
    descKy: 'Демо-модель: Smart функциялуу 43 дюймдук 4K телевизор.',
    specs: [
      screen('43″, 4K UHD'),
      plain('Smart TV', 'Smart TV', 'есть', 'бар'),
      plain('Разъёмы', 'Порттор', '3 × HDMI, 2 × USB'),
      plain('Wi-Fi', 'Wi-Fi', 'есть', 'бар'),
    ],
    warrantyMonths: 24,
    variants: [{ id: 'std', stock: 8 }],
  },
  {
    id: 'smartview-55',
    brand: 'SmartView',
    categoryId: 'tv',
    nameRu: 'Телевизор SmartView 55″',
    nameKy: 'SmartView 55″ телевизору',
    price: 42300,
    oldPrice: 45900,
    art: 'tv',
    baseColor: '#142334',
    descRu: 'Демо-модель: большой 4K-телевизор для гостиной.',
    descKy: 'Демо-модель: конуш үчүн чоң 4K телевизор.',
    specs: [
      screen('55″, 4K UHD'),
      plain('Smart TV', 'Smart TV', 'есть', 'бар'),
      plain('Разъёмы', 'Порттор', '4 × HDMI, 2 × USB'),
      plain('Wi-Fi', 'Wi-Fi', 'есть', 'бар'),
    ],
    warrantyMonths: 24,
    badge: 'hit',
    variants: [{ id: 'std', stock: 4 }],
  },

  // ── Техника для дома ─────────────────────────────────────────────────────
  {
    id: 'midea-mdrb521mge220dm',
    brand: 'Midea',
    categoryId: 'home',
    nameRu: 'Холодильник Midea MDRB521MGE220DM (Black Glass)',
    nameKy: 'Midea MDRB521MGE220DM муздаткычы (Black Glass)',
    price: 96000,
    oldPrice: 108000,
    art: 'washer',
    image: '/products/midea-mdrb521mge220dm.png',
    baseColor: '#121214',
    descRu: 'Премиальный двухкамерный холодильник с фасадом из закалённого чёрного стекла (Black Glass). Оснащён системой Total No Frost, равномерным распределением холода Multi Air Flow, зоной Metal Cooling и интуитивным сенсорным дисплеем.',
    descKy: 'Чыңалган кара айнектүү премиум фасаддуу эки камералуу муздаткыч (Black Glass). Total No Frost системасы, бир калыптагы Multi Air Flow муздатуусу, Metal Cooling зонасы жана сенсордук дисплей менен жабдылган.',
    specs: [
      plain('Тип', 'Түрү', 'Двухкамерный, нижняя морозильная камера', 'Эки камералуу, төмөнкү тоңдургуч'),
      plain('Цвет фасада', 'Фасаддын түсү', 'Чёрное стекло (Black Glass)', 'Кара айнек (Black Glass)'),
      plain('Общий полезный объем', 'Жалпы пайдалуу көлөмү', '386 л (холодильная 263 л / морозильная 123 л)', '386 л (муздаткыч 263 л / тоңдургуч 123 л)'),
      plain('Система разморозки', 'Эритүү системасы', 'Total No Frost', 'Total No Frost'),
      plain('Технологии охлаждения', 'Муздатуу технологиясы', 'Multi Air Flow + Metal Cooling', 'Multi Air Flow + Metal Cooling'),
      plain('Управление', 'Башкаруу', 'Электронное, внешний сенсорный дисплей', 'Электрондук, тышкы сенсордук дисплей'),
      plain('Класс энергопотребления', 'Энергия натыйжалуулугу', 'A++', 'A++'),
      plain('Уровень шума', 'Ызы-чуу деңгээли', '38 дБ', '38 дБ'),
      plain('Габариты (Ш×В×Г)', 'Өлчөмдөрү (Т×Б×Т)', '59.5 × 201.8 × 66 см', '59.5 × 201.8 × 66 см'),
    ],
    warrantyMonths: 24,
    badge: 'hit',
    colorOptions: [{ key: 'black-glass', labelRu: 'Чёрное стекло', labelKy: 'Кара айнек', hex: '#121214' }],
    variants: [{ id: 'black-glass', colorKey: 'black-glass', stock: 4 }],
  },
  {
    id: 'cleanpure-6',
    brand: 'CleanPure',
    categoryId: 'home',
    nameRu: 'Стиральная машина CleanPure 6 кг',
    nameKy: 'CleanPure 6 кг кийим жуугуч машина',
    price: 38900,
    art: 'washer',
    baseColor: '#E9EDF5',
    descRu: 'Демо-модель: узкая стиральная машина на 6 кг для квартиры.',
    descKy: 'Демо-модель: пәтер үчүн 6 кг сыйымдуулуктагы кууш жуугуч машина.',
    specs: [
      plain('Загрузка', 'Сыйымдуулук', '6 кг'),
      plain('Отжим', 'Айлануусу', '1200 об/мин'),
      plain('Класс энергопотребления', 'Энергия классы', 'A+ (демо)'),
      plain('Габариты (Ш×В×Г)', 'Өлчөмү (Т×Б×Т)', '60×85×42 см'),
    ],
    warrantyMonths: 24,
    colorOptions: [{ key: 'white', labelRu: 'Белый', labelKy: 'Ак', hex: '#E9EDF5' }],
    variants: [{ id: 'white', colorKey: 'white', stock: 3 }],
  },
  {
    id: 'barista-home',
    brand: 'BaristaHome',
    categoryId: 'home',
    nameRu: 'Кофемашина BaristaHome',
    nameKy: 'BaristaHome кофе машинасы',
    price: 12900,
    art: 'coffee',
    baseColor: '#1E2C3C',
    descRu: 'Демо-модель: автоматическая кофемашина для дома.',
    descKy: 'Демо-модель: үй үчүн автоматтык кофе машинасы.',
    specs: [
      plain('Тип', 'Тиби', 'автоматическая', 'автоматтык'),
      plain('Давление', 'Басым', '15 бар'),
      plain('Тип кофе', 'Кофе тиби', 'молотый / чалдык', 'түйүлгөн / чалдык'),
      plain('Ёмкость для воды', 'Суу идиши', '1,5 л'),
    ],
    warrantyMonths: 12,
    colorOptions: [{ key: 'ink', labelRu: 'Тёмный', labelKy: 'Кара көк', hex: '#1E2C3C' }],
    variants: [{ id: 'ink', colorKey: 'ink', stock: 6 }],
  },
  {
    id: 'aerochef-5',
    brand: 'AeroChef',
    categoryId: 'home',
    nameRu: 'Аэрогриль AeroChef 5 л',
    nameKy: 'AeroChef 5 л аэрогриль',
    price: 7400,
    art: 'fryer',
    baseColor: '#E9EDF5',
    descRu: 'Демо-модель: аэрогриль 5 литров с сенсорной панелью.',
    descKy: 'Демо-модель: сенсордук панели бар 5 литрлик аэрогриль.',
    specs: [
      plain('Объём', 'Көлөмү', '5 л'),
      plain('Мощность', 'Куаттуулугу', '1400 Вт'),
      plain('Управление', 'Башкаруу', 'сенсорное', 'сенсордук'),
      plain('Программы', 'Программалар', '8 (демо)'),
    ],
    warrantyMonths: 12,
    badge: 'new',
    colorOptions: [{ key: 'white', labelRu: 'Белый', labelKy: 'Ак', hex: '#E9EDF5' }],
    variants: [{ id: 'white', colorKey: 'white', stock: 9 }],
  },
  {
    id: 'cyclone-robot',
    brand: 'CycloneClean',
    categoryId: 'home',
    nameRu: 'Робот-пылесос CycloneClean',
    nameKy: 'CycloneClean робот чаңсоргуч',
    price: 19800,
    art: 'robot',
    baseColor: '#3B6FE8',
    descRu: 'Демо-модель: робот-пылесос с влажной уборкой.',
    descKy: 'Демо-модель: нымдуу тазалоочу робот чаңсоргуч.',
    specs: [
      plain('Тип', 'Тиби', 'робот-пылесос', 'робот чаңсоргуч'),
      plain('Уборка', 'Тазалоо', 'сухая и влажная', 'кургак жана нымдуу'),
      plain('Автономность', 'Батареясы', 'до 120 мин', '120 мүнөткө чейин'),
      plain('Пылесборник', 'Чаң идиши', '0,4 л'),
    ],
    warrantyMonths: 12,
    colorOptions: [{ key: 'blue', labelRu: 'Синий', labelKy: 'Көк', hex: '#3B6FE8' }],
    variants: [{ id: 'blue', colorKey: 'blue', stock: 2 }],
  },

  // ── Планшеты ─────────────────────────────────────────────────────────────
  {
    id: 'tabslate-10',
    brand: 'TabSlate',
    categoryId: 'tablets',
    nameRu: 'Планшет TabSlate 10',
    nameKy: 'TabSlate 10 планшети',
    price: 19700,
    art: 'tablet',
    baseColor: '#5A8BF0',
    descRu: 'Демо-модель: планшет 10 дюймов для учёбы и чтения.',
    descKy: 'Демо-модель: окуу жана окуу үчүн 10 дюймдук планшет.',
    specs: [
      screen('10,1″ IPS, Full HD'),
      memorySpec('4 ГБ', '128 ГБ'),
      batterySpec('6000 мА·ч'),
      plain('Вес', 'Салмагы', '460 г'),
    ],
    warrantyMonths: 12,
    colorOptions: [
      { key: 'blue', labelRu: 'Голубой', labelKy: 'Көгүлтүр', hex: '#5A8BF0' },
      { key: 'ink', labelRu: 'Тёмный', labelKy: 'Кара көк', hex: '#1E2C3C' },
    ],
    memoryOptions: [
      { key: '128', labelRu: '128 ГБ', labelKy: '128 ГБ' },
      { key: '256', labelRu: '256 ГБ', labelKy: '256 ГБ' },
    ],
    variants: [
      { id: 'blue-128', colorKey: 'blue', memoryKey: '128', stock: 6 },
      { id: 'blue-256', colorKey: 'blue', memoryKey: '256', stock: 2, priceDelta: 3000 },
      // комбинация «Тёмный · 256 ГБ» намеренно отсутствует в каталоге —
      // для проверки явного состояния отсутствия комбинации (TASK 03)
      { id: 'ink-128', colorKey: 'ink', memoryKey: '128', stock: 3 },
    ],
  },

  // ── Аксессуары ───────────────────────────────────────────────────────────
  {
    id: 'airsound-pro',
    brand: 'AirSound',
    categoryId: 'accessories',
    nameRu: 'Беспроводные наушники AirSound Pro',
    nameKy: 'AirSound Pro зымсыз кулакчын',
    price: 5900,
    art: 'headphones',
    baseColor: '#F4F6FA',
    descRu: 'Демо-модель: беспроводные наушники с шумоподавлением.',
    descKy: 'Демо-модель: ызы-чууну азайтуучу зымсыз кулакчын.',
    specs: [
      plain('Тип', 'Тиби', 'накладные, Bluetooth', 'баш кийимдүү, Bluetooth'),
      plain('Автономность', 'Батареясы', 'до 30 ч с кейсом', 'кутусу менен 30 саатка чейин'),
      plain('Шумоподавление', 'Ызы-чуу азайтуу', 'активное (демо)', 'активдүү (демо)'),
      plain('Вес', 'Салмагы', '220 г'),
    ],
    warrantyMonths: 12,
    badge: 'hit',
    colorOptions: [
      { key: 'white', labelRu: 'Белый', labelKy: 'Ак', hex: '#F4F6FA' },
      { key: 'ink', labelRu: 'Тёмный', labelKy: 'Кара көк', hex: '#1E2C3C' },
    ],
    variants: [
      { id: 'white', colorKey: 'white', stock: 15 },
      { id: 'ink', colorKey: 'ink', stock: 9 },
    ],
  },
  {
    id: 'timefit',
    brand: 'TimeFit',
    categoryId: 'accessories',
    nameRu: 'Умные часы TimeFit',
    nameKy: 'TimeFit акылм сааты',
    price: 8200,
    art: 'watch',
    baseColor: '#3B6FE8',
    descRu: 'Демо-модель: умные часы с пульсометром и уведомлениями.',
    descKy: 'Демо-модель: тамыр кагуусун жана билдирмелерди көрсөтүүчү акылм саат.',
    specs: [
      screen('1,8″ IPS'),
      plain('Датчики', 'Сенсорлору', 'пульс, шагомер', 'тамыр, кадам өлчөгүч'),
      plain('Автономность', 'Батареясы', 'до 7 дней', '7 күнгө чейин'),
      plain('Защита', 'Коргоо', 'IP67 (демо)'),
    ],
    warrantyMonths: 12,
    colorOptions: [
      { key: 'blue', labelRu: 'Синий', labelKy: 'Көк', hex: '#3B6FE8' },
      { key: 'ink', labelRu: 'Тёмный', labelKy: 'Кара көк', hex: '#1E2C3C' },
    ],
    variants: [
      { id: 'blue', colorKey: 'blue', stock: 6 },
      { id: 'ink', colorKey: 'ink', stock: 4 },
    ],
  },
  {
    id: 'boommini',
    brand: 'BoomMini',
    categoryId: 'accessories',
    nameRu: 'Портативная колонка BoomMini',
    nameKy: 'BoomMini портативтик добуш күчөткүч',
    price: 4300,
    art: 'speaker',
    baseColor: '#3B6FE8',
    descRu: 'Демо-модель: портативная Bluetooth-колонка с защитой от брызг.',
    descKy: 'Демо-модель: чачыроодон корголгон портативтик Bluetooth колонка.',
    specs: [
      plain('Мощность', 'Куаттуулугу', '10 Вт'),
      plain('Автономность', 'Батареясы', 'до 12 ч', '12 саатка чейин'),
      plain('Защита', 'Коргоо', 'IPX5 (демо)'),
      plain('Вес', 'Салмагы', '340 г'),
    ],
    warrantyMonths: 12,
    colorOptions: [{ key: 'blue', labelRu: 'Синий', labelKy: 'Көк', hex: '#3B6FE8' }],
    variants: [{ id: 'blue', colorKey: 'blue', stock: 11 }],
  },
]

export function getProduct(id: string): Product | undefined {
  return products.find((p) => p.id === id)
}

/** Все уникальные бренды демо-каталога */
export const brands: string[] = [...new Set(products.map((p) => p.brand))].sort((a, b) =>
  a.localeCompare(b),
)

export const popularProductIds = ['aura-x5', 'airsound-pro', 'smartview-55', 'cleanpure-6']
export const newProductIds = ['vega-pro', 'aerochef-5', 'tabslate-10', 'boommini']

export function getPopular(): Product[] {
  return popularProductIds.map((id) => getProduct(id)).filter((p): p is Product => Boolean(p))
}

export function getNew(): Product[] {
  return newProductIds.map((id) => getProduct(id)).filter((p): p is Product => Boolean(p))
}

// ── Варианты: подбор комбинаций ────────────────────────────────────────────

/** Вариант, точно соответствующий выбранной комбинации (без fallback на чужой SKU). */
export function comboVariant(
  product: Product,
  colorKey: string | null,
  memoryKey: string | null,
): ProductVariant | undefined {
  return product.variants.find((v) => {
    if (product.colorOptions && v.colorKey !== colorKey) return false
    if (product.memoryOptions && v.memoryKey !== memoryKey) return false
    return true
  })
}

/** Есть ли для цвета хоть один вариант (любой памяти). */
export function colorHasVariant(product: Product, colorKey: string): boolean {
  return product.variants.some((v) => !product.memoryOptions || v.colorKey === colorKey)
}

/** Есть ли для памяти хоть один вариант (любого цвета). */
export function memoryHasVariant(product: Product, memoryKey: string): boolean {
  return product.variants.some((v) => !product.colorOptions || v.memoryKey === memoryKey)
}

/** Цвет по умолчанию: первый цвет, для которого есть вариант в наличии. */
export function defaultColorKey(product: Product): string | null {
  if (!product.colorOptions) return null
  const inStock = product.variants.find(
    (v) => v.stock > 0 && product.colorOptions!.some((c) => c.key === v.colorKey),
  )
  const fallback = product.variants.find((v) =>
    product.colorOptions!.some((c) => c.key === v.colorKey),
  )
  return (inStock ?? fallback)?.colorKey ?? null
}

/** Память по умолчанию с учётом выбранного цвета. */
export function defaultMemoryKey(product: Product, colorKey: string | null): string | null {
  if (!product.memoryOptions) return null
  const pool = product.variants.filter(
    (v) => !product.colorOptions || v.colorKey === colorKey,
  )
  const inStock = pool.find((v) => v.stock > 0)
  return (inStock ?? pool[0])?.memoryKey ?? null
}

export function colorHexOf(product: Product, variant: ProductVariant | undefined): string {
  if (!variant?.colorKey) return product.baseColor
  return product.colorOptions?.find((c) => c.key === variant.colorKey)?.hex ?? product.baseColor
}

/** Цвет выбранного ключа (для галереи, даже когда комбинации ещё нет). */
export function colorHexOfKey(product: Product, colorKey: string | null): string {
  if (!colorKey) return product.baseColor
  return product.colorOptions?.find((c) => c.key === colorKey)?.hex ?? product.baseColor
}
