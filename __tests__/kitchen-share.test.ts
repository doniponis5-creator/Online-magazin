import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Product } from '@/data/products'
import { parseSize } from '@/lib/kitchen/catalog'
import { clearLast, DEFAULT_STATE, kitchenLinkFor, loadLast, queryFromState, saveLast, stateFromQuery } from '@/lib/kitchen/share'
import type { KitchenState } from '@/lib/kitchen/types'

const roundTrip = (state: KitchenState, known = new Set<string>()) =>
  stateFromQuery(new URLSearchParams(queryFromState(state)), known)

describe('ссылка на кухню: туда и обратно', () => {
  it('ручка и вытяжка не затирают друг друга в адресе', () => {
    const state: KitchenState = { ...DEFAULT_STATE, picks: { ...DEFAULT_STATE.picks, hood: 'hd-7' }, handle: 'bar' }
    const back = roundTrip(state, new Set(['hd-7']))
    expect(back.picks.hood).toBe('hd-7')
    expect(back.handle).toBe('bar')
  })
  it('старая ссылка с ручкой в hd= открывается с той же ручкой', () => {
    const back = stateFromQuery(new URLSearchParams('f=corner&hd=knob'), new Set())
    expect(back.handle).toBe('knob')
  })
  it('C12: дверца вправо остаётся у того же своего шкафа (40 см)', () => {
    const state: KitchenState = {
      ...DEFAULT_STATE,
      shape: 'straight',
      a: 400,
      arrangement: { A: ['k2', 'sink', 'k1'] },
      cabinets: { k1: { w: 40, front: 'doors' }, k2: { w: 50, front: 'doors' } },
      doorsRight: ['k1'],
    }
    const back = roundTrip(state)
    const right = (back.doorsRight ?? []).filter((k) => k.startsWith('k'))
    expect(right).toHaveLength(1)
    expect(back.cabinets?.[right[0] as `k${number}`]).toEqual({ w: 40, front: 'doors' })
  })

  it('C17: места сохраняются с шагом 0,5 см (мойка на 132,5)', () => {
    const state: KitchenState = {
      ...DEFAULT_STATE,
      shape: 'straight',
      a: 400,
      cabinets: { k1: { w: 45, front: 'drawers3' } },
      arrangement: { A: ['k1', 'sink', 'hob'] },
      at: { k1: 30, sink: 132.5, hob: 250 },
    }
    expect(roundTrip(state).at).toEqual({ k1: 30, sink: 132.5, hob: 250 })
  })
})

describe('ссылка на кухню: чужой или старый адрес не ломает проект', () => {
  it('C13: колонна с духовкой не ниже 160 см', () => {
    const back = stateFromQuery(new URLSearchParams('f=straight&po=1&ht=t120'), new Set())
    expect(back.heights?.tall).toBe(160)
    // пенал по-прежнему может быть от 120
    expect(stateFromQuery(new URLSearchParams('f=straight&ht=p120'), new Set()).heights?.pantry).toBe(120)
  })
  it('C13: со встраиваемой микроволновкой колонна не ниже 200 см', () => {
    const known = new Map([['mw1', { builtIn: true }], ['mw2', { builtIn: false }]])
    expect(stateFromQuery(new URLSearchParams('f=straight&po=1&ht=t170&mw=mw1'), known).heights?.tall).toBe(200)
    expect(stateFromQuery(new URLSearchParams('f=straight&po=1&ht=t170&mw=mw2'), known).heights?.tall).toBe(170)
  })
  it('C14: остров не длиннее стены A', () => {
    const back = stateFromQuery(new URLSearchParams('f=island&a=180&i=280'), new Set())
    expect(back.a).toBe(180)
    expect(back.island).toBe(180)
    // в пределах стены — как было
    expect(stateFromQuery(new URLSearchParams('f=island&a=400&i=240'), new Set()).island).toBe(240)
  })
})

describe('C15: размеры из характеристик 1С', () => {
  const one = (label: string, value: string) => parseSize([{ label, value }])
  it('«Габариты В×Ш×Г»: высота первой', () => {
    expect(one('Габариты В×Ш×Г', '185 × 60 × 65 см')).toEqual({ w: 60, h: 185, d: 65 })
  })
  it('«Габаритные размеры (ВхШхГ)» с русской «х» и латинской «x» в значении', () => {
    expect(one('Габаритные размеры (ВхШхГ)', '185x60x65')).toEqual({ w: 60, h: 185, d: 65 })
  })
  it('«Размеры (ШxВxГ)» 600x850x400 — миллиметры для всех трёх', () => {
    expect(one('Размеры (ШxВxГ)', '600x850x400')).toEqual({ w: 60, h: 85, d: 40 })
  })
  it('«Размеры» без букв: 595x388x320 — миллиметры, порядок Ш×В×Г', () => {
    expect(one('Размеры', '595x388x320')).toEqual({ w: 59.5, h: 38.8, d: 32 })
  })
  it('«мм» в названии строки', () => {
    expect(one('Размеры Ш×В×Г, мм', '600 × 850 × 400')).toEqual({ w: 60, h: 85, d: 40 })
  })
  it('размеры в упаковке пропускаются', () => {
    expect(
      parseSize([
        { label: 'Размеры в упаковке (Ш×В×Г)', value: '70 × 190 × 72 см' },
        { label: 'Ширина', value: '60 см' },
      ]),
    ).toEqual({ w: 60, h: undefined, d: undefined })
    expect(
      parseSize([
        { label: 'Габариты упаковки В×Ш×Г', value: '190 × 70 × 72 см' },
        { label: 'Габариты В×Ш×Г', value: '185 × 60 × 65 см' },
      ]),
    ).toEqual({ w: 60, h: 185, d: 65 })
  })
  it('«Д×Ш×В»: длина — это глубина, а не ширина', () => {
    expect(one('Размеры Д×Ш×В', '35 × 28 × 25 см')).toEqual({ d: 35, w: 28, h: 25 })
  })
})

describe('последняя кухня в браузере (kp-last)', () => {
  const memory = () => {
    const data = new Map<string, string>()
    return {
      data,
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, String(v)),
      removeItem: (k: string) => void data.delete(k),
    }
  }
  afterEach(() => vi.unstubAllGlobals())

  const kitchen: KitchenState = { ...DEFAULT_STATE, shape: 'u', a: 320, b: 250, c: 200, picks: { oven: 'o1', hob: 'h1' } }

  it('сохраняет адрес и время, открывает ту же кухню', () => {
    const store = memory()
    vi.stubGlobal('localStorage', store)
    saveLast(kitchen)
    const record = JSON.parse(store.data.get('kp-last')!)
    expect(typeof record.q).toBe('string')
    expect(typeof record.t).toBe('number')
    const back = loadLast(new Set(['o1']))
    expect(back).toMatchObject({ shape: 'u', a: 320, b: 250, c: 200, picks: { oven: 'o1' } })
    // модели, которой больше нет в каталоге, нет и в кухне
    expect(back?.picks.hob).toBeUndefined()
  })

  it('битая или чужая запись — null, а не исключение', () => {
    const store = memory()
    vi.stubGlobal('localStorage', store)
    for (const bad of ['{не json', 'null', '"строка"', '{"x":1}', '{"q":5,"t":1}', '{"q":"a=300","t":1}']) {
      store.data.set('kp-last', bad)
      expect(loadLast(new Set())).toBeNull()
    }
  })

  it('без записи и без localStorage — null; ошибки хранилища не роняют страницу', () => {
    vi.stubGlobal('localStorage', memory())
    expect(loadLast(new Set())).toBeNull()
    vi.stubGlobal('localStorage', undefined)
    expect(loadLast(new Set())).toBeNull()
    expect(() => saveLast(kitchen)).not.toThrow()
    const broken = {
      getItem: () => {
        throw new Error('SecurityError')
      },
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
      removeItem: () => {
        throw new Error('SecurityError')
      },
    }
    vi.stubGlobal('localStorage', broken)
    expect(loadLast(new Set())).toBeNull()
    expect(() => saveLast(kitchen)).not.toThrow()
    expect(() => clearLast()).not.toThrow()
  })

  it('clearLast забывает кухню', () => {
    vi.stubGlobal('localStorage', memory())
    saveLast(kitchen)
    clearLast()
    expect(loadLast(new Set(['o1']))).toBeNull()
  })
})

describe('«Примерить в кухне» с карточки товара', () => {
  const product = (id: string, name: string, specs: [string, string][] = [], stock = 1): Product => ({
    id,
    brand: 'Test',
    categoryId: 'kitchen',
    nameRu: name,
    nameKy: name,
    price: 30000,
    art: 'box',
    baseColor: '#000',
    descRu: '',
    descKy: '',
    specs: specs.map(([l, v]) => ({ labelRu: l, labelKy: l, valueRu: v, valueKy: v })),
    warrantyMonths: 12,
    variants: [{ id: 'std', stock }],
  })

  it('ссылка на конструктор с этой моделью в своём слоте', () => {
    expect(kitchenLinkFor(product('ov-1', 'Духовой шкаф встраиваемый Bosch'), 'ru')).toBe('/ru/kitchen?ov=ov-1')
    expect(kitchenLinkFor(product('ov-1', 'Духовой шкаф встраиваемый Bosch'), 'ky')).toBe('/ky/kitchen?ov=ov-1')
    expect(kitchenLinkFor(product('fr-2', 'Холодильник LG'), 'ru')).toBe('/ru/kitchen?fr=fr-2')
    expect(kitchenLinkFor(product('hb-3', 'Варочная панель Gorenje'), 'ru')).toBe('/ru/kitchen?hb=hb-3')
    expect(kitchenLinkFor(product('hd-4', 'Вытяжка Elikor'), 'ru')).toBe('/ru/kitchen?hd=hd-4')
    expect(kitchenLinkFor(product('dw-5', 'Посудомоечная машина Midea'), 'ru')).toBe('/ru/kitchen?dw=dw-5')
    expect(kitchenLinkFor(product('mw-6', 'Микроволновая печь Samsung'), 'ru')).toBe('/ru/kitchen?mw=mw-6')
    expect(kitchenLinkFor(product('wm-7', 'Стиральная машина Artel'), 'ru')).toBe('/ru/kitchen?wm=wm-7')
  })

  it('нет ссылки у товара, который конструктор не принимает', () => {
    expect(kitchenLinkFor(product('tv-1', 'Телевизор Samsung 55'), 'ru')).toBeNull()
    expect(kitchenLinkFor(product('ov-2', 'Духовой шкаф Bosch', [], 0), 'ru')).toBeNull()
    expect(kitchenLinkFor(product('wm-2', 'Стиральная машина п/а AVANGARD', [['Тип загрузки', 'Вертикальная']]), 'ru')).toBeNull()
  })
})

describe('R10: свой цвет острова в ссылке (if=)', () => {
  const island: KitchenState = { ...DEFAULT_STATE, shape: 'island', a: 400, island: 240, facade: 'lam-white', islandFacade: 'lam-graphite' }

  it('туда и обратно: цвет острова ложится в if= и возвращается', () => {
    const q = new URLSearchParams(queryFromState(island))
    expect(q.get('if')).toBe('lam-graphite')
    const back = roundTrip(island)
    expect(back.islandFacade).toBe('lam-graphite')
    // низ острова не подменяет
    expect(back.facade).toBe('lam-white')
  })
  it('неизвестный цвет острова отбрасывается без ошибки, как у fc=', () => {
    const back = stateFromQuery(new URLSearchParams('f=island&a=400&i=240&fc=lam-white&if=no-such-color'), new Set())
    expect(back.islandFacade).toBeUndefined()
    expect(back.facade).toBe('lam-white')
  })
  it('старая ссылка без if= — остров как низ (поля нет)', () => {
    const back = stateFromQuery(new URLSearchParams('f=island&a=400&i=240&fc=lam-white'), new Set())
    expect('islandFacade' in back).toBe(false)
    expect(new URLSearchParams(queryFromState(back)).has('if')).toBe(false)
  })
  it('у кухни без острова if= в ссылку не пишется, как i=', () => {
    for (const shape of ['straight', 'corner', 'u'] as const) {
      const q = new URLSearchParams(queryFromState({ ...island, shape }))
      expect(q.has('i'), shape).toBe(false)
      expect(q.has('if'), shape).toBe(false)
    }
  })
  it('автосохранение (kp-last) хранит цвет острова', () => {
    const data = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, String(v)),
      removeItem: (k: string) => void data.delete(k),
    })
    try {
      saveLast(island)
      expect(loadLast(new Set())?.islandFacade).toBe('lam-graphite')
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
