import { describe, expect, it } from 'vitest'
import type { Product } from '@/data/products'
import {
  facetOptions,
  facetsFor,
  FACETS,
  overlockThreads,
  sewingAuto,
  sewingKind,
  tvDiagonal,
  tvResolution,
  washerKind,
  washerLoadStep,
  washerLoading,
} from '@/lib/catalogFacets'

/** Товар как из 1С: название и характеристики «название=значение». */
function item(name: string, specs: Record<string, string> = {}, categoryId = 'home'): Product {
  return {
    id: name,
    brand: '',
    categoryId,
    nameRu: name,
    nameKy: name,
    price: 10000,
    art: 'box',
    baseColor: '#fff',
    descRu: '',
    descKy: '',
    specs: Object.entries(specs).map(([labelRu, valueRu]) => ({ labelRu, labelKy: labelRu, valueRu, valueKy: valueRu })),
    warrantyMonths: 0,
    variants: [{ id: 'std', stock: 1 }],
  } as Product
}

describe('телевизоры (живые названия 06.10)', () => {
  it('диагональ из характеристик и из названия', () => {
    expect(tvDiagonal(item('Телевизор LG 65NANO81A6A', { Диагональ: '65″ (164 см)' }))).toBe('65')
    expect(tvDiagonal(item("Телевизор SMART 43' SMART"))).toBe('43')
    expect(tvDiagonal(item('Телевизор CHANGHONG 32D6P ANDROID'))).toBe('32')
    // «35+» — не диагональ телевизора: не угадываем
    expect(tvDiagonal(item('Телевизор SMART 35+ ANDROID'))).toBeNull()
  })

  it('чёткость', () => {
    expect(tvResolution(item('Телевизор HISENSE 75E7Q 4K QLED'))).toBe('4k')
    expect(tvResolution(item('Т', { Разрешение: 'HD, 1366×768' }))).toBe('hd')
    expect(tvResolution(item('Т', { Разрешение: 'Full HD, 1920×1080' }))).toBe('fhd')
    expect(tvResolution(item("Телевизор SMART 43' SMART"))).toBeNull()
  })
})

describe('стиральные машины', () => {
  it('автомат и полуавтомат', () => {
    expect(washerKind(item('Стиральная машина п/а AVANGARD ATG-72-708'))).toBe('semi')
    expect(washerKind(item('Стиральная машина ARTEL SE25', { Тип: 'Полуавтоматическая стиральная машина' }))).toBe('semi')
    expect(washerKind(item('Стиральная машина LG F2Y1HS3W 7кг белый'))).toBe('auto')
    // сушильная — не стиральная: в фильтры раздела не попадает
    const dryer = item('Сушильная машина MIDEA MD205H80WB 8 кг')
    expect(washerKind(dryer)).toBeNull()
    expect(washerLoadStep(dryer)).toBeNull()
  })

  it('загрузка ступенями: из характеристик, из названия, «7/4 kg» — стирка 7', () => {
    expect(washerLoadStep(item('Стиральная машина ARTEL SE25', { 'Загрузка для стирки': '2,5 кг' }))).toBe('le6')
    expect(washerLoadStep(item('Стиральная Машина IDEAL ID-75 7.5кг'))).toBe('7')
    expect(washerLoadStep(item('Стиральная машина LG F2V5HG1W 7/4 kg стирка и сушка'))).toBe('7')
    expect(washerLoadStep(item('Стиральная машина TOSHIBA', { 'Максимальная загрузка': '8 кг' }))).toBe('8')
    expect(washerLoadStep(item('Стиральная машина MIDEA', { 'Загрузка для стирки': '10,5 кг' }))).toBe('ge9')
  })

  it('тип загрузки', () => {
    expect(washerLoading(item('Стиральная машина', { 'Тип загрузки': 'Фронтальная' }))).toBe('front')
    expect(washerLoading(item('Стиральная машина', { 'Тип загрузки': 'Вертикальная' }))).toBe('top')
  })
})

describe('швейные машины', () => {
  it('вид машины', () => {
    expect(sewingKind(item('Швейная Машина BRUSE X5  (OVERLOk)'))).toBe('overlock')
    expect(sewingKind(item('Швейная Машина Распошивальная JACK'))).toBe('coverstitch')
    expect(sewingKind(item('Швейная Машина BRUCE 6390B', { Тип: 'одноигольная машина с шагающей лапкой' }))).toBe('walking')
    expect(sewingKind(item('Швейная Машина JASS JS-H1', { Тип: 'одноигольная прямострочная машина' }))).toBe('lockstitch')
    expect(sewingKind(item('Швейная Машина JANOME', { Тип: 'Электромеханическая швейная машина' }))).toBe('household')
  })

  it('автомат, «кайчи» (только обрезка нити) и полуавтомат; «автоматическая смазка» автоматом не делает', () => {
    const straight = { Тип: 'одноигольная прямострочная машина' }
    expect(sewingAuto(item('Швейная Машина JASS JS-H2 (Кайчи)', { ...straight, Функции: 'автоматическая обрезка нити' }))).toBe('trim')
    expect(sewingAuto(item('Швейная Машина JACK A2C', { ...straight, Функции: 'автоматическая обрезка нити, ручная закрепка' }))).toBe('trim')
    expect(sewingAuto(item('Швейная Машина JACK A4B Автомат', straight))).toBe('auto')
    expect(sewingAuto(item('Швейная Машина BRUCE R2', { Тип: 'компьютерная одноигольная прямострочная машина' }))).toBe('auto')
    expect(
      sewingAuto(item('Швейная Машина Baoyu', { ...straight, Функции: 'обрезка нити, закрепка, подъём лапки, позиционер иглы' })),
    ).toBe('auto')
    expect(sewingAuto(item('Швейная Машина BRUSE Q5', { ...straight, Функции: 'позиционер иглы, автоматическая смазка' }))).toBe('semi')
    // у оверлока такого выбора нет
    expect(sewingAuto(item('Швейная Машина (Оверлок) JASS JS-GT800E-4'))).toBeNull()
  })

  it('нити оверлока: характеристика, слово, конец модели', () => {
    expect(overlockThreads(item('Швейная Машина BRUSE X5 (OVERLOk)', { 'Количество нитей': '4' }))).toBe('4')
    expect(overlockThreads(item('Швейная Машина Baoyu', { Тип: 'Промышленный пятиниточный оверлок' }))).toBe('5')
    expect(overlockThreads(item('Швейная Машина (Оверлок) JASS JS-H8-4'))).toBe('4')
    expect(overlockThreads(item('Швейная Машина OVERLOK DS-1SD'))).toBeNull()
    expect(overlockThreads(item('Швейная Машина JASS JS-H1'))).toBeNull()
  })
})

describe('список фильтров', () => {
  it('у каждого раздела свои, ключи адреса не повторяются', () => {
    expect(facetsFor('tv').map((f) => f.id)).toEqual(['diag', 'res'])
    expect(facetsFor('fridges')).toEqual([])
    expect(new Set(FACETS.map((f) => f.id)).size).toBe(FACETS.length)
  })

  it('варианты со счётчиками в заданном порядке, неизвестное не считается', () => {
    const diag = facetsFor('tv')[0]
    const pool = [item('Телевизор 75E7Q'), item('Телевизор 32D6P'), item('Телевизор 75D10W'), item('Телевизор SMART 35+')]
    expect(facetOptions(diag, pool)).toEqual([
      { value: '32', count: 1 },
      { value: '75', count: 2 },
    ])
    const wtype = facetsFor('washers')[0]
    const washers = [item('Стиральная машина п/а A'), item('Стиральная машина LG')]
    expect(facetOptions(wtype, washers).map((o) => o.value)).toEqual(['auto', 'semi'])
    expect(wtype.label('semi', 'ky')).toBe('Жарым автомат')
  })
})
