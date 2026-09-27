import { describe, expect, it } from 'vitest'
import { cutParts, type CutPart } from '@/lib/kitchen/cutting'
import { DECORS } from '@/lib/kitchen/decors'
import { findColors, FRONT_COLORS, frontColor } from '@/lib/kitchen/finishes'
import { parseRal, RAL } from '@/lib/kitchen/ral'
import { DEFAULT_STATE, queryFromState, stateFromQuery } from '@/lib/kitchen/share'
import type { SpecData } from '@/lib/kitchen/spec'

/**
 * Пакет цвета (истории 1–3, 5–7, 13): любой RAL, декоры ЛДСП с кодом.
 * Шов — `frontColor(id)`: новые id понимают ссылка, 3D и раскрой без своих веток.
 */

describe('RAL: палитра и разбор кода', () => {
  it('палитра RAL Classic, коды разные, цвета #rrggbb', () => {
    expect(new Set(RAL.map((c) => c.code)).size).toBe(RAL.length)
    for (const c of RAL) expect(c.hex).toMatch(/^#[0-9a-f]{6}$/)
    expect(RAL.find((c) => c.code === '7016')).toEqual({ code: '7016', hex: '#383e42', ru: 'Антрацитово-серый' })
    expect(RAL.find((c) => c.code === '9003')?.ru).toBe('Сигнальный белый')
  })

  it('принимает код в любой записи', () => {
    for (const s of ['7016', 'RAL 7016', 'ral7016', 'RAL-7016', '  ral  7016 ', 'Ral 70 16']) expect(parseRal(s)).toBe('7016')
  })

  it('новые цвета RAL Classic 2020 есть, чужая палитра F9 — нет', () => {
    // 2017 «RAL оранжевый» и 9012 «белый для чистых помещений» — в RAL Classic с 2020
    expect(parseRal('2017')).toBe('2017')
    expect(parseRal('RAL 9012')).toBe('9012')
    // 6040 «Helloliv» — палитра RAL F9 (камуфляж), не Classic
    expect(parseRal('6040')).toBeNull()
  })

  it('мусор и несуществующий код — null', () => {
    for (const s of ['', '   ', 'RAL', '0000', '7777', '70166', 'abc', 'RAL 701', '#383e42']) expect(parseRal(s)).toBeNull()
  })
})

/** Один нижний шкаф с широким фасадом 796 × 356 мм (как ящик): видно, куда идёт волокно. */
const oneDrawer: SpecData = {
  runs: [{ id: 'A', length: 80, modules: [], boxes: [], tops: [], fronts: [{ x: 0.2, y: 10, w: 79.6, h: 35.6, hinge: 'left', glass: false, framed: false, handle: true }] }],
  carcasses: [{ row: 'base', w: 80, h: 72, d: 56, shelves: 1, top: false, bottom: true, back: true }],
  panels: [],
  plinth: 80,
  gola: 0,
  splash: 0,
  heights: { plinth: 10, counter: 86, upperBottom: 140, upperTop: 212, mezzTop: null, ceiling: 270 },
}
const front = (parts: CutPart[]) => parts.find((p) => p.front)!
const roundTrip = (over: Partial<typeof DEFAULT_STATE>) => stateFromQuery(new URLSearchParams(queryFromState({ ...DEFAULT_STATE, ...over })), new Map())

describe('frontColor: RAL', () => {
  it('ral-7016 — эмаль цвета RAL с кодом', () => {
    expect(frontColor('ral-7016')).toEqual({ id: 'ral-7016', material: 'enamel', ru: 'Антрацитово-серый', ky: 'Антрацитово-серый', color: '#383e42', code: 'RAL 7016' })
  })

  it('несуществующий код RAL — undefined', () => {
    for (const id of ['ral-0000', 'ral-', 'ral-701', 'ral-70160', 'RAL-7016', 'ral-7016x']) expect(frontColor(id)).toBeUndefined()
  })

  it('ссылка туда-обратно сохраняет RAL у низа и у верха', () => {
    const s = roundTrip({ facade: 'ral-7016', upperFacade: 'ral-9010' })
    expect(s.facade).toBe('ral-7016')
    expect(s.upperFacade).toBe('ral-9010')
  })

  it('раскрой: RAL-фасад — МДФ в цех фасадов, не из листа', () => {
    const f = front(cutParts(oneDrawer, { facade: 'ral-7016' }))
    // подпись — «<код> <название>»; порядок и склейку ведёт раскрой, здесь — что код и название в ней есть
    expect(f.material).toMatchObject({ kind: 'mdf', color: '#383e42', thick: null })
    expect(f.material.label).toContain('RAL 7016')
    expect(f.material.label).toContain('Антрацитово-серый')
    expect(f.facade?.finish).toBe('enamel')
  })

  it('прежние 52 цвета каталога — как были', () => {
    expect(FRONT_COLORS).toHaveLength(52)
    expect(frontColor('lam-white')).toEqual({ id: 'lam-white', material: 'laminate', ru: 'Белый премиум', ky: 'Премиум ак', color: '#f1f0ec' })
    expect(frontColor('lam-sonoma')?.texture).toBe('wood')
    expect(frontColor('nope')).toBeUndefined()
  })
})

describe('декоры ЛДСП', () => {
  it('Egger, Kronospan, Lamarty — по 10–12 декоров, id по коду и без повторов', () => {
    for (const brand of ['egger', 'kronospan', 'lamarty'] as const) {
      const n = DECORS.filter((d) => d.brand === brand).length
      expect(n, brand).toBeGreaterThanOrEqual(10)
      expect(n, brand).toBeLessThanOrEqual(12)
    }
    expect(new Set(DECORS.map((d) => d.id)).size).toBe(DECORS.length)
    for (const d of DECORS) {
      expect(d.id).toMatch(/^dec-(egger|kronospan|lamarty)-[a-z0-9-]+$/)
      expect(d.color).toMatch(/^#[0-9a-f]{6}$/)
      expect(d.ru && d.ky).toBeTruthy()
    }
  })

  it('dec-egger-h1145-st10 — ламинат-дерево с кодом Egger', () => {
    expect(frontColor('dec-egger-h1145-st10')).toMatchObject({
      id: 'dec-egger-h1145-st10',
      material: 'laminate',
      ru: 'Дуб Бардолино натуральный',
      texture: 'wood',
      code: 'Egger H1145 ST10',
      brand: 'egger',
    })
  })

  it('бетон — фактура бетона, однотон — без фактуры; у Lamarty кода нет, только бренд', () => {
    expect(frontColor('dec-egger-f186-st9')).toMatchObject({ texture: 'concrete', code: 'Egger F186 ST9' })
    expect(frontColor('dec-kronospan-k001')).toMatchObject({ texture: 'wood', code: 'Kronospan K001', ru: 'Дуб Крафт Белый' })
    const white = frontColor('dec-egger-w1000-st9')!
    expect(white.texture).toBeUndefined()
    expect(white.material).toBe('laminate')
    expect(frontColor('dec-lamarty-wotan-oak')).toMatchObject({ ru: 'Дуб Вотан', code: 'Lamarty', brand: 'lamarty', texture: 'wood' })
  })

  it('Kronospan — только декоры, которые выпускаются как ЛДСП (kronospan.com/ru_KZ, вкладка «Продукты»)', () => {
    // K091, K200, K201, K203, K205 — только столешницы, стеновые панели и HPL
    for (const code of ['k091', 'k200', 'k201', 'k203', 'k205']) expect(frontColor(`dec-kronospan-${code}`), code).toBeUndefined()
    expect(frontColor('dec-kronospan-k112')).toMatchObject({ ru: 'Серый Камень', code: 'Kronospan K112' })
    expect(frontColor('dec-kronospan-k350')).toMatchObject({ texture: 'concrete', code: 'Kronospan K350' })
  })

  it('неизвестный декор — undefined', () => {
    for (const id of ['dec-x', 'dec-egger-h9999-st1', 'dec-', 'dec-EGGER-H1145-ST10']) expect(frontColor(id)).toBeUndefined()
  })

  it('ссылка туда-обратно сохраняет декор у низа, верха и шкафа над холодильником', () => {
    const s = roundTrip({ facade: 'ral-7016', upperFacade: 'dec-egger-h1145-st10', overFridgeFacade: 'dec-kronospan-k353' })
    expect([s.facade, s.upperFacade, s.overFridgeFacade]).toEqual(['ral-7016', 'dec-egger-h1145-st10', 'dec-kronospan-k353'])
    // чужой код в ссылке отбрасывается без ошибки
    const bad = stateFromQuery(new URLSearchParams('fc=dec-x&uf=ral-0000'), new Map())
    expect([bad.facade, bad.upperFacade]).toEqual([DEFAULT_STATE.facade, DEFAULT_STATE.upperFacade])
  })

  it('раскрой: декор-дерево — ЛДСП из листа, волокно вдоль высоты, своё название', () => {
    const f = front(cutParts(oneDrawer, { facade: 'dec-egger-h1145-st10' }))
    expect(f.material).toMatchObject({ kind: 'ldsp', thick: 16 })
    expect(f.material.label).toContain('H1145 ST10')
    expect(f.material.label).toContain('Дуб Бардолино натуральный')
    expect(f).toMatchObject({ grain: true, length: 356, width: 796 })
    // бетон — тоже ЛДСП, но без волокна: длина по большей стороне
    expect(front(cutParts(oneDrawer, { facade: 'dec-egger-f186-st9' }))).toMatchObject({ grain: false, length: 796, width: 356, material: { kind: 'ldsp' } })
  })
})

describe('findColors: поиск по коду и названию', () => {
  const ids = (q: string, lang?: 'ru' | 'ky') => findColors(q, lang).map((c) => c.id)

  it('пустой запрос — ничего', () => {
    expect(findColors('')).toEqual([])
    expect(findColors('   ')).toEqual([])
  })

  it('код RAL в любой записи — этот RAL первым', () => {
    for (const q of ['7016', 'RAL 7016', 'ral7016']) expect(ids(q)[0], q).toBe('ral-7016')
  })

  it('код декора без учёта регистра и пробелов — этот декор первым', () => {
    for (const q of ['h1145', 'H1145 ST10', 'h1145st10', 'Egger H1145']) expect(ids(q)[0], q).toBe('dec-egger-h1145-st10')
    expect(ids('K001')[0]).toBe('dec-kronospan-k001')
  })

  it('по названию — во всех видах: каталог, RAL, декоры', () => {
    const oak = findColors('дуб')
    expect(oak.map((c) => c.id)).toEqual(expect.arrayContaining(['lam-sonoma', 'ven-oak', 'dec-egger-h1145-st10', 'dec-kronospan-k001', 'dec-lamarty-wotan-oak']))
    for (const c of oak) expect(c.ru.toLowerCase()).toContain('дуб')
    expect(ids('Бетон')).toEqual(expect.arrayContaining(['lam-concrete', 'dec-egger-f186-st9', 'dec-kronospan-k350']))
    expect(ids('антрацит')).toEqual(expect.arrayContaining(['acr-anthracite', 'ral-7016', 'dec-kronospan-k164']))
    // «ё» и «е» — одно и то же
    expect(ids('черный графит')).toContain('dec-egger-u961-st2')
  })

  it('по-кыргызски ищет и по кыргызским названиям', () => {
    expect(ids('эмени', 'ky')).toEqual(expect.arrayContaining(['lam-sonoma', 'dec-egger-h1145-st10']))
  })

  it('не больше 60 результатов', () => {
    expect(findColors('1')).toHaveLength(60)
    expect(findColors('белый').length).toBeLessThanOrEqual(60)
  })
})

describe('раскрой: цвет острова = цвет низа — как без цвета острова', () => {
  // ряд у стены и остров: фасады острова и его задняя панель помечены `island`
  const islandSpec: SpecData = {
    ...oneDrawer,
    runs: [
      oneDrawer.runs[0],
      { id: 'I', length: 160, modules: [], boxes: [], tops: [], fronts: [{ x: 0.2, y: 10, w: 59.6, h: 71.6, hinge: 'left', glass: false, framed: false, handle: true, island: true }] },
    ],
    carcasses: [...oneDrawer.carcasses, { row: 'base', w: 60, h: 72, d: 56, shelves: 1, top: false, bottom: true, back: true }],
    extras: [{ kind: 'islandBack', run: 'I', w: 160, h: 82, island: true }],
  }

  it('islandFacade того же цвета, что низ, ничего не меняет в деталях', () => {
    const plain = cutParts(islandSpec, { facade: 'lam-white' })
    expect(plain.some((p) => p.front)).toBe(true)
    expect(cutParts(islandSpec, { facade: 'lam-white', islandFacade: 'lam-white' })).toEqual(plain)
    // а свой цвет острова детали меняет — значит, остров в этом проекте раскрой видит
    expect(cutParts(islandSpec, { facade: 'lam-white', islandFacade: 'lam-graphite' })).not.toEqual(plain)
  })
})

