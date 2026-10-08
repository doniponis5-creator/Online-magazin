import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { productFromOneC } from '@/data/1c/adapter'
import { categoryForGroup, categoryForSection, oneCCategories } from '@/data/1c/categories'

/**
 * «Раздел на сайте» выбирают в карточке товара в 1С. Список разделов живёт
 * в двух местах — в расширении 1С и здесь; разойдутся — товар молча уйдёт
 * в раздел по группе, и владелец не поймёт почему.
 */
describe('раздел на сайте из 1С', () => {
  const item = (section?: string) =>
    productFromOneC({ id: 'g1', code: 'C1', name: 'Электро Эндуро мини', group: 'Транспорт', stock: 1, price: 100, section })

  it('выбранный раздел важнее группы 1С', () => {
    expect(item().categoryId).toBe('sport')
    expect(item('Климат').categoryId).toBe('climate')
    expect(item('  мелкая техника ').categoryId).toBe('small-kitchen')
  })

  it('«Авто», пусто и незнакомое название — раздел по группе', () => {
    expect(categoryForSection('Авто')).toBeUndefined()
    expect(categoryForSection('')).toBeUndefined()
    expect(item('Мотоциклы').categoryId).toBe('sport')
  })

  it('в 1С те же разделы, что на сайте', () => {
    const root = join(__dirname, '..', 'integrations', '1c-online-shop')
    const bsl = readFileSync(join(root, 'src', 'ОбщийМодульСервер.bsl'), 'utf-8')
    const inModule = /Функция РазделыСайта\(\)[\s\S]*?СтрРазделить\("([^"]+)"/.exec(bsl)?.[1].split(',')
    const builder = readFileSync(join(root, 'build_extension.py'), 'utf-8')
    const inForm = [...(/SITE_SECTIONS = \[([\s\S]*?)\]/.exec(builder)?.[1] ?? '').matchAll(/"([^"]+)"/g)].map((m) => m[1])
    const site = ['Авто', ...oneCCategories.map((c) => c.nameRu)]
    expect(inModule).toEqual(site)
    expect(inForm).toEqual(site)
  })
})

/**
 * Названия, которые точнее группы 1С (живой каталог, 28.09.2026): казаны были
 * в «Мелкой технике» и в «Для дома» сразу, «Ледогенератор» — в «Энергоснабжении»,
 * детские мотоциклы и велосипеды — среди швейных машин.
 */
describe('раскладка по названию сильнее группы', () => {
  const at = (name: string, group = 'Холодильники') => categoryForGroup(group, '', name)

  it('транспорт и спорт', () => {
    for (const name of ['Электро Эндуро мини', 'Мототцикл спорт', 'Синий Трактор', "Электро Велик GEPARD M2 16'",
      'Беговая дорожка P5 мини', 'Велотренажер', 'Электросамокат Kugoo']) {
      expect(at(name), name).toBe('sport')
    }
    expect(at('Велотренажер', 'Транспорт')).toBe('sport')
  })

  it('посуда, ледогенератор, газовая панель, сушилка для белья', () => {
    expect(at('Казан Набор UAKEEN VK-10 19 персон')).toBe('home')
    expect(at('Манты казан ROYAL MINOR')).toBe('home')
    expect(at('Ледогенератор KOLAX 59171')).toBe('small-kitchen')
    expect(at('Газовая Панель WENICE 1 коз')).toBe('kitchen')
    expect(at('Сушилка Напольная ISTAMBUL 004 2 этаж')).toBe('home')
  })

  it('швейные машины и оверлоки — свой раздел', () => {
    for (const name of ['Швейная Машина (Оверлок) JASS JS-H8-4', 'Швейная Машина BRUSE X5 (OVERLOk)',
      'Швейная Машина JACK A4B Автомат', 'Швейная Машина OVERLOK DS-1SD', 'Оверлок Janome 990D']) {
      expect(at(name, 'Товары для дома'), name).toBe('sewing')
    }
  })

  it('похожие слова не цепляет', () => {
    expect(categoryForGroup('', '', 'Генератор бензиновый 3 кВт')).toBe('power')
    expect(categoryForGroup('', '', 'Стиральная машина LEVO LV-80LUX-T DD Motor')).toBe('washers')
    expect(categoryForGroup('', '', 'Газовая плита SHIVAKI 6401E')).toBe('kitchen')
    expect(categoryForGroup('', '', 'Великолепный чайник')).toBe('small-kitchen')
  })
})

// 08.10: пришли гели и порошки AXMA — свой раздел «Бытовая химия», а не посудомойки и стиральные машины.
describe('бытовая химия', () => {
  const axma = [
    'Средство для посудомоечных машин AXMA (900 гр) порошок',
    'Гель для стирки AXMA (1кг) для белого белья MULTIACTION',
    'Гель для стирки AXMA (2кг) Ароматерапия для цветного белья',
    'Гель для стирки AXMA (1кг) Standart',
  ]
  it('товары AXMA — в «Бытовую химию», какая бы ни была группа 1С', () => {
    for (const name of axma) {
      expect(categoryForGroup('', '', name), name).toBe('chemistry')
      expect(categoryForGroup('Посудомоечные машины', 'Кухонная техника', name), name).toBe('chemistry')
    }
    expect(categoryForSection('Бытовая химия')).toBe('chemistry')
  })
  it('техника в «Бытовую химию» не попадает', () => {
    for (const name of ['Посудомоечная машина MIDEA MDWM-218TWO', 'Стиральная машина LG F2V3PS6J AI 8kg (inox)',
      'Пылесос UAKEEN ZL-940 (Моющий)', 'Полуавтомат для стирки Artel', 'Кондиционер Midea 12'])
      expect(categoryForGroup('', '', name), name).not.toBe('chemistry')
  })
})

describe('бытовая химия — только по началу названия (аудит 08.10)', () => {
  it('техника с «ополаскивателем», «порошком в подарок», фильтр — не химия', () => {
    for (const name of ['Посудомоечная машина Midea (с ополаскивателем)', 'Стиральная машина LG + порошок для стирки в подарок',
      'Стиральная машина с функцией пятновыводителя', 'Фильтр для посудомоечной машины', 'Шланг для посудомоечных машин'])
      expect(categoryForGroup('', '', name), name).not.toBe('chemistry')
  })
  it('группа 1С «Химия для стиральных машин» — химия, а не стиральные', () => {
    expect(categoryForGroup('Химия для стиральных машин', '', 'Капли')).toBe('chemistry')
  })
})
