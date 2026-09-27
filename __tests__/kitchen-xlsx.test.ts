import { crc32 } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import './helpers/canvas'
import { kitchenTexts } from '@/components/kitchen/texts'
import { cutWorkbook } from '@/lib/kitchen/cutExcel'
import { cutParts, nest, type CutLook } from '@/lib/kitchen/cutting'
import { cutList, extraList, frontList, type SpecData } from '@/lib/kitchen/spec'
import { buildKitchen } from '@/components/kitchen/three/build'
import { frontColor } from '@/lib/kitchen/finishes'
import { planKitchen } from '@/lib/kitchen/layout'
import { getTone, STYLES } from '@/lib/kitchen/styles'
import type { KitchenAppliance } from '@/lib/kitchen/types'
import { xlsx, type XlsxSheet } from '@/lib/kitchen/xlsx'

/**
 * Excel для пильного центра (пакет мастера, истории 1–3, 5, 7; решение §1):
 * `.xlsx` своим кодом — zip «store» + SpreadsheetML. Файл разбирается
 * обратно своим мини-разбором zip и сверяется по ячейкам.
 */

/* ───────────── мини-разбор zip «store» ───────────── */

type Entry = { name: string; method: number; crc: number; data: Uint8Array }

/** Центральный каталог → локальные заголовки → данные. Только «store» (без сжатия). */
function unzip(buf: Uint8Array): Entry[] {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  const dec = new TextDecoder()
  let end = -1
  for (let i = buf.length - 22; i >= 0; i--) {
    if (dv.getUint32(i, true) === 0x06054b50) {
      end = i
      break
    }
  }
  if (end < 0) throw new Error('нет конца центрального каталога')
  const count = dv.getUint16(end + 10, true)
  let p = dv.getUint32(end + 16, true)
  const out: Entry[] = []
  for (let k = 0; k < count; k++) {
    if (dv.getUint32(p, true) !== 0x02014b50) throw new Error(`битая запись каталога ${k}`)
    const method = dv.getUint16(p + 10, true)
    const crc = dv.getUint32(p + 16, true)
    const size = dv.getUint32(p + 20, true)
    const raw = dv.getUint32(p + 24, true)
    const nameLen = dv.getUint16(p + 28, true)
    const extraLen = dv.getUint16(p + 30, true)
    const commentLen = dv.getUint16(p + 32, true)
    const local = dv.getUint32(p + 42, true)
    const name = dec.decode(buf.subarray(p + 46, p + 46 + nameLen))
    if (dv.getUint32(local, true) !== 0x04034b50) throw new Error(`битый локальный заголовок ${name}`)
    if (size !== raw) throw new Error(`${name}: сжат, а должен быть store`)
    const lName = dv.getUint16(local + 26, true)
    const lExtra = dv.getUint16(local + 28, true)
    const start = local + 30 + lName + lExtra
    out.push({ name, method, crc, data: buf.subarray(start, start + size) })
    p += 46 + nameLen + extraLen + commentLen
  }
  return out
}

const text = (files: Entry[], name: string): string => {
  const f = files.find((e) => e.name === name)
  if (!f) throw new Error(`нет ${name}`)
  return new TextDecoder().decode(f.data)
}

/* ───────────── разбор XML ───────────── */

/** Хорошо ли сформирован XML: теги парные, `&` только в сущностях. */
function wellFormed(xml: string): boolean {
  const stack: string[] = []
  for (const m of xml.matchAll(/<(\/?)([^\s>/?!]+)[^>]*?(\/?)>/g)) {
    const [, close, name, self] = m
    if (self) continue
    if (close) {
      if (stack.pop() !== name) return false
    } else stack.push(name)
  }
  const amp = /&(?!amp;|lt;|gt;|quot;|apos;|#\d+;)/.test(xml)
  return stack.length === 0 && !amp
}

const unescape = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')

/** Ячейки листа: адрес → число или строка. */
function cells(xml: string): Map<string, string | number> {
  const out = new Map<string, string | number>()
  for (const m of xml.matchAll(/<c r="([A-Z]+\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
    const [, ref, attrs, body = ''] = m
    if (/t="inlineStr"/.test(attrs)) out.set(ref, unescape(/<t[^>]*>([\s\S]*?)<\/t>/.exec(body)?.[1] ?? ''))
    else {
      const v = /<v>([^<]*)<\/v>/.exec(body)?.[1]
      if (v !== undefined) out.set(ref, Number(v))
    }
  }
  return out
}

/** Листы книги по порядку: имя и путь к XML листа. */
function sheetsOf(files: Entry[]): { name: string; path: string }[] {
  const rels = new Map([...text(files, 'xl/_rels/workbook.xml.rels').matchAll(/<Relationship ([^>]*)\/>/g)].map((m) => [/Id="([^"]+)"/.exec(m[1])![1], /Target="([^"]+)"/.exec(m[1])![1]]))
  return [...text(files, 'xl/workbook.xml').matchAll(/<sheet ([^>]*)\/>/g)].map((m) => ({
    name: unescape(/name="([^"]*)"/.exec(m[1])![1]),
    path: `xl/${rels.get(/r:id="([^"]+)"/.exec(m[1])![1])!.replace(/^\/?xl\//, '')}`,
  }))
}

/* ───────────── xlsx ───────────── */

describe('xlsx — настоящий .xlsx своим кодом', () => {
  const file = xlsx([
    { name: 'Распил', rows: [['№', 'Деталь', 'Длина, мм'], [1, 'Боковина & <"верх">', 716], [null, 'Полка', 2.5]], widths: [6, 30, 12] },
    { name: 'Листы & ХДФ', rows: [['Ооба', 'ң ү ө']] },
  ])
  const files = unzip(file)

  it('zip «store»: все части книги на месте, контрольные суммы сходятся', () => {
    const names = files.map((f) => f.name)
    for (const need of ['[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml', 'xl/_rels/workbook.xml.rels', 'xl/styles.xml', 'xl/worksheets/sheet1.xml', 'xl/worksheets/sheet2.xml'])
      expect(names).toContain(need)
    for (const f of files) {
      expect(f.method, f.name).toBe(0)
      expect(f.crc, f.name).toBe(crc32(f.data))
      expect(wellFormed(new TextDecoder().decode(f.data)), f.name).toBe(true)
    }
    expect(text(files, '[Content_Types].xml')).toContain('/xl/worksheets/sheet2.xml')
  })

  it('листы по порядку, числа — числами, текст — строкой, спецсимволы и кириллица целы', () => {
    const sheets = sheetsOf(files)
    expect(sheets.map((s) => s.name)).toEqual(['Распил', 'Листы & ХДФ'])
    const first = cells(text(files, sheets[0].path))
    expect(first.get('A1')).toBe('№')
    expect(first.get('A2')).toBe(1)
    expect(first.get('B2')).toBe('Боковина & <"верх">')
    expect(first.get('C2')).toBe(716)
    expect(first.has('A3')).toBe(false)
    expect(first.get('C3')).toBe(2.5)
    expect(cells(text(files, sheets[1].path)).get('B1')).toBe('ң ү ө')
  })

  it('ширины колонок', () => {
    const xml = text(files, sheetsOf(files)[0].path)
    expect(xml).toMatch(/<col min="1" max="1" width="6"[^>]*\/>/)
    expect(xml).toMatch(/<col min="2" max="2" width="30"[^>]*\/>/)
  })
})

/* ───────────── cutWorkbook: книга для распила ───────────── */

/** Один нижний шкаф 60 × 72 × 56 с дверцей и столешница 240 см — всё считается вручную. */
const one: SpecData = {
  runs: [
    {
      id: 'A',
      length: 60,
      modules: [{ x: 0, w: 60 }],
      boxes: [],
      fronts: [{ x: 0.2, y: 10, w: 59.6, h: 71.6, hinge: 'left', glass: false, framed: false, handle: true }],
      tops: [{ x0: 0, x1: 240, depth: 60, thick: 3.8, sink: true, hob: true }],
    },
  ],
  carcasses: [{ row: 'base', w: 60, h: 72, d: 56, shelves: 1, top: false, bottom: true, back: true }],
  panels: [],
  plinth: 60,
  gola: 0,
  splash: 0,
  heights: { plinth: 10, counter: 86, upperBottom: 140, upperTop: 212, mezzTop: null, ceiling: 270 },
}
const ru = kitchenTexts('ru')
const book = (spec = one, look: CutLook = {}, t = ru) => cutWorkbook(spec, look, t)
const sheet = (b: XlsxSheet[], name: string) => b.find((s) => s.name === name)!.rows

describe('cutWorkbook — листы и колонки по историям 2–3', () => {
  it('шесть листов, колонки — как в спецификации', () => {
    const b = book()
    expect(b.map((s) => s.name)).toEqual(['Распил', 'Фасады', 'Столешница', 'Фурнитура', 'Кромка', 'Листы'])
    expect(sheet(b, 'Распил')[0]).toEqual(['№', 'Деталь', 'Материал', 'Цвет', 'Длина, мм', 'Ширина, мм', 'Кол-во', 'Кромка Д1', 'Кромка Д2', 'Кромка Ш1', 'Кромка Ш2', 'Текстура', 'Примечание'])
    expect(sheet(b, 'Фасады')[0]).toEqual(['Тип', 'Материал', 'Цвет', 'Высота, мм', 'Ширина, мм', 'Кол-во', 'м²'])
    expect(sheet(b, 'Столешница')[0]).toEqual(['Стена', 'Длина, мм', 'Глубина, мм', 'Толщина, мм', 'Вырез'])
    expect(sheet(b, 'Фурнитура')[0]).toEqual(['Наименование', 'Кол-во'])
    expect(sheet(b, 'Кромка')[0]).toEqual(['Толщина, мм', 'Метров чистых', 'Метров с запасом 10%'])
    expect(sheet(b, 'Листы')[0]).toEqual(['Материал', 'Цвет', 'Толщина, мм', 'Размер листа, мм', 'Листов', 'Отход, %'])
    for (const s of b) expect(s.widths?.length, s.name).toBeGreaterThanOrEqual(s.rows[0].length)
  })

  it('«Распил»: корпуса, ХДФ и фасады из ЛДСП — с кромкой по сторонам (разобрано вручную)', () => {
    const rows = sheet(book(), 'Распил').slice(1)
    const white = ['ЛДСП 16 мм', 'Белый премиум']
    expect(rows).toEqual([
      [1, 'Боковина', ...white, 720, 560, 2, 1, null, null, null, 'нет', null],
      [2, 'Дно', ...white, 568, 560, 1, 1, null, null, null, 'нет', null],
      [3, 'Царга', ...white, 568, 100, 2, 0.4, null, null, null, 'нет', null],
      [4, 'Полка', ...white, 566, 540, 1, 1, null, null, null, 'нет', null],
      [5, 'Задняя стенка (ХДФ)', 'ХДФ 3 мм', 'Белый премиум', 716, 596, 1, null, null, null, null, 'нет', null],
      [6, 'Дверца', ...white, 716, 596, 1, 2, 2, 2, 2, 'нет', null],
    ])
    // эмаль — не из листа: дверца уходит в цех фасадов
    expect(sheet(book(one, { facade: 'en-white' }), 'Распил').slice(1).map((r) => r[1])).not.toContain('Дверца')
  })

  it('«Фасады»: то, что не из листа, — высота и ширина как у фасада, м², итог', () => {
    const drawer = { x: 0.2, y: 0, w: 59.6, h: 17.6, hinge: 'drawer' as const, glass: false, framed: false, handle: true }
    const two: SpecData = { ...one, runs: [{ ...one.runs[0], fronts: [...one.runs[0].fronts, drawer] }] }
    // таск 01b: толщины у МДФ-фасадов в каталоге нет — «18 мм» было выдумано, теперь не пишется
    const enamel = ['МДФ, эмаль', 'Белый мат']
    expect(sheet(book(two, { facade: 'en-white' }), 'Фасады').slice(1)).toEqual([
      ['Дверца', ...enamel, 716, 596, 1, 0.43],
      ['Фасад ящика', ...enamel, 176, 596, 1, 0.1],
      ['Итого', null, null, null, null, 2, 0.53],
    ])
    // все фасады из ЛДСП — лист не пустой, а говорит, где они
    expect(sheet(book(), 'Фасады').slice(1)).toEqual([['Все фасады — из ЛДСП, они в листе «Распил»']])
  })

  it('«Столешница» и «Фурнитура»', () => {
    const b = book()
    expect(sheet(b, 'Столешница').slice(1)).toEqual([
      ['Стена A', 2400, 600, 38, 'мойка, варочная панель'],
      ['Итого', 2400],
    ])
    expect(sheet(b, 'Фурнитура').slice(1)).toEqual([
      ['Петли с доводчиком', 2],
      ['Ручки', 1],
      ['Опоры (ножки)', 4],
      ['Цоколь, м', 0.6],
    ])
  })
})

describe('cutWorkbook — итоги кромки и листов (истории 5, 7)', () => {
  it('«Кромка»: метры каждой толщины, чистые и с запасом 10% (разобрано вручную)', () => {
    // 1 мм: боковины 2 × 720 + дно 568 + полка 566; 0,4: царги 2 × 568; 2 мм: дверца по периметру 2 × (716 + 596)
    // таск 01b: «купить» — вверх до 0,1 м (было до ближайшего): 1,136 × 1,1 = 1,2496 → 1,3; 2,574 × 1,1 = 2,8314 → 2,9; 2,624 × 1,1 = 2,8864 → 2,9
    expect(sheet(book(), 'Кромка').slice(1, 4)).toEqual([
      [0.4, 1.1, 1.3],
      [1, 2.6, 2.9],
      [2, 2.6, 2.9],
    ])
  })

  it('«Листы»: сводка по материалам и раскладка по каждому листу', () => {
    const rows = sheet(book(), 'Листы')
    // отход = 1 − площадь деталей / рабочая площадь (2780 × 2050): ЛДСП 1 970 456 мм², ХДФ 596 × 716
    expect(rows.slice(1, 3)).toEqual([
      ['ЛДСП', 'Белый премиум', 16, '2800 × 2070', 1, 65.4],
      ['ХДФ', 'Белый премиум', 3, '2800 × 2070', 1, 92.5],
    ])
    expect(rows.some((r) => r[0] === 'ЛДСП 16 мм · Белый премиум · лист 2800 × 2070 мм')).toBe(true)
    expect(rows.filter((r) => r[0] === 'Лист №')).toHaveLength(2)
    const placed = rows.filter((r) => r.length === 7 && typeof r[0] === 'number')
    // 2 боковины, дно, 2 царги, полка, дверца + задняя стенка
    expect(placed).toHaveLength(8)
    expect(placed.filter((r) => r[1] === '1 · Боковина')).toHaveLength(2)
    for (const r of placed) {
      expect(r[0]).toBe(1)
      expect(['да', 'нет']).toContain(r[6])
      for (const v of r.slice(2, 6)) expect(typeof v).toBe('number')
    }
  })

  it('деталь длиннее листа — помечена в «Распил» и в «Листы», не теряется', () => {
    const tall: SpecData = { ...one, runs: [{ ...one.runs[0], fronts: [] }], carcasses: [{ row: 'tall', w: 60, h: 290, d: 56, shelves: 0, top: true, bottom: true, back: false }] }
    const b = book(tall)
    const side = sheet(b, 'Распил').find((r) => r[1] === 'Боковина')!
    expect(side[4]).toBe(2900)
    expect(side[12]).toBe('не помещается на лист — резать отдельно')
    expect(sheet(b, 'Листы')).toContainEqual(['Не помещаются на лист: 1'])
  })
})

/* ───────────── настоящая угловая кухня: от 3D до файла ───────────── */

const appliance = (over: Partial<KitchenAppliance>): KitchenAppliance => ({ id: 'x', slot: 'fridge', name: 'x', brand: '', price: 1, w: 60, h: 185, d: 65, sizeKnown: true, builtIn: false, finish: 'white', ...over })

/** Угловая 300 × 240 по умолчанию, как на экране: холодильник, посудомойка, варочная панель, духовка, вытяжка. */
function cornerSpec(): SpecData {
  const style = STYLES[0]
  const items = {
    fridge: appliance({ slot: 'fridge' }),
    dishwasher: appliance({ slot: 'dishwasher', w: 44.8, h: 81.5, d: 55, builtIn: true }),
    hob: appliance({ slot: 'hob', w: 59, h: 5, d: 52, builtIn: true, hob: 'electric' }),
    oven: appliance({ slot: 'oven', w: 59.5, h: 59.5, d: 56, builtIn: true }),
    hood: appliance({ slot: 'hood', w: 60, h: 50, d: 50, hood: 'chimney' }),
  }
  const plan = planKitchen({ shape: 'corner', a: 300, b: 240, c: 0, island: 0, fridge: items.fridge, dishwasher: items.dishwasher, hob: items.hob, oven: items.oven, hood: { w: 60 } }, { shelves: style.shelves })
  return buildKitchen({ plan, style, tone: getTone(style, 0), items, photos: new Map(), evening: false, room: { ceiling: 270, toCeiling: false }, fronts: {}, detail: 0.5 }).spec
}

describe('угловая кухня: книга → .xlsx → обратно', () => {
  const corner = cornerSpec()

  it('в «Распил» — все детали корпусов и ХДФ из cutList плюс фасады из ЛДСП, штук столько же', () => {
    const cut = sheet(book(corner), 'Распил').slice(1)
    const body = cutList(corner.carcasses, corner.panels)
    const ldspFronts = frontList(corner.runs).filter((r) => r.type !== 'glass' && r.type !== 'framed' && (frontColor(r.color)?.material ?? 'laminate') === 'laminate')
    // таск 01b (Решения §5a): доборы, планки угла и задняя панель острова (белый ламинат) — тоже из листа; раньше их в «Распил» не было
    const panels = extraList(corner).filter((r) => r.kind === 'filler' || r.kind === 'strip' || r.kind === 'islandBack')
    expect(cut).toHaveLength(body.length + ldspFronts.length + panels.length)
    const qty = (rows: { count: number }[]) => rows.reduce((s, r) => s + r.count, 0)
    expect(cut.reduce((s, r) => s + (r[6] as number), 0)).toBe(qty(body) + qty(ldspFronts) + qty(panels))
  })

  it('файл разбирается обратно: листы и ячейки те же, что в книге; ky — свои подписи', () => {
    for (const t of [ru, kitchenTexts('ky')]) {
      const b = book(corner, { lang: t === ru ? 'ru' : 'ky' }, t)
      const files = unzip(xlsx(b))
      const sheets = sheetsOf(files)
      expect(sheets.map((s) => s.name)).toEqual(b.map((s) => s.name))
      sheets.forEach((s, i) => {
        const got = cells(text(files, s.path))
        b[i].rows.forEach((row, r) =>
          row.forEach((v, c) => {
            const ref = `${String.fromCharCode(65 + c)}${r + 1}`
            if (v === null || v === '') expect(got.has(ref), `${s.name}!${ref}`).toBe(false)
            else expect(got.get(ref), `${s.name}!${ref}`).toBe(v)
          }),
        )
      })
    }
    const ky = book(corner, { lang: 'ky' }, kitchenTexts('ky'))
    expect(ky.map((s) => s.name)).toEqual(['Кесүү', 'Фасаддар', 'Столешница', 'Фурнитура', 'Кромка', 'Листтер'])
    expect(ky[0].rows[1][11]).toBe('жок')
  })
})


/* ───────────── таск 01b: фасады из деталей, язык, листы ───────────── */

describe('cutWorkbook — «Фасады» из самих деталей (Решения §5)', () => {
  const glass = { x: 0.2, y: 150, w: 59.6, h: 71.6, hinge: 'left' as const, glass: true, framed: false, handle: true, upper: true }
  const withGlass: SpecData = { ...one, runs: [{ ...one.runs[0], fronts: [...one.runs[0].fronts, glass] }] }

  it('стекло в плёнке — в цех фасадов без «МДФ»; дверца из ЛДСП — в «Распил»; 716 × 596 = 0,43 м²', () => {
    const b = book(withGlass)
    expect(sheet(b, 'Фасады').slice(1)).toEqual([
      ['Дверца со стеклом', 'в плёнке', 'Белый премиум', 716, 596, 1, 0.43],
      ['Итого', null, null, null, null, 1, 0.43],
    ])
    expect(sheet(b, 'Распил').filter((r) => r[1] === 'Дверца')).toHaveLength(1)
  })

  it('фасад стиля без материала — в цех фасадов с пометкой «материал по стилю — уточнить»', () => {
    const style = { ru: 'Орех стиля', ky: 'Стилдин жаңгагы', color: '#7a5436', wood: true }
    expect(sheet(book(one, { facade: style }), 'Фасады').slice(1)).toEqual([
      ['Дверца', 'материал по стилю — уточнить', 'Орех стиля', 716, 596, 1, 0.43],
      ['Итого', null, null, null, null, 1, 0.43],
    ])
  })

  it('МДФ-добор — тоже в «Фасады»: добор 150 × 700 = 0,105 м², итого 0,4267 + 0,105 = 0,53', () => {
    const withFiller: SpecData = { ...one, extras: [{ kind: 'filler', run: 'A', w: 15, h: 70, upper: true }] }
    expect(sheet(book(withFiller, { facade: 'en-white' }), 'Фасады').slice(1)).toEqual([
      ['Дверца', 'МДФ, эмаль', 'Белый мат', 716, 596, 1, 0.43],
      ['Добор — панель без корпуса', 'МДФ, эмаль', 'Белый мат', 700, 150, 1, 0.11],
      ['Итого', null, null, null, null, 2, 0.53],
    ])
  })

  it('неизвестный id отделки — явный отказ, а не белый', () => {
    expect(() => book(one, { facade: 'no-such' })).toThrow(/no-such/)
  })
})

describe('cutWorkbook — язык, «Листы», ширины (таск 01b)', () => {
  it('язык — из t: lang в look не спорит с подписями', () => {
    const ky = kitchenTexts('ky')
    expect(sheet(cutWorkbook(one, { lang: 'ru' }, ky), 'Кесүү')[1][3]).toBe('Премиум ак')
  })

  it('пропуски номеров в «Распил» объяснены: дверца из эмали — № 6 в «Фасады»', () => {
    const rows = sheet(book(one, { facade: 'en-white' }), 'Распил')
    expect(rows.map((r) => r[0]).filter((v) => typeof v === 'number')).toEqual([1, 2, 3, 4, 5])
    expect(rows[rows.length - 1]).toEqual(['№ 6 — не из листа: они в листе «Фасады»'])
  })

  it('«Листы»: у повёрнутой детали размеры как в «Распил» и «Повёрнута: да» (3 панели 2000 × 800 — на лист только поперёк)', () => {
    const backs: SpecData = { ...one, runs: [{ ...one.runs[0], fronts: [] }], carcasses: [], extras: [1, 2, 3].map(() => ({ kind: 'islandBack' as const, run: 'I' as const, w: 200, h: 80 })) }
    const b = book(backs)
    expect(sheet(b, 'Распил')[1].slice(4, 7)).toEqual([2000, 800, 3])
    const placed = sheet(b, 'Листы').filter((r) => r.length === 7 && typeof r[0] === 'number')
    expect(placed).toHaveLength(3)
    for (const r of placed) expect([r[0], r[1], r[2], r[3], r[6]]).toEqual([1, '1 · Задняя панель острова', 2000, 800, 'да'])
  })

  it('колонки кромки в «Распил» — не уже 11', () => {
    const w = book().find((s) => s.name === 'Распил')!.widths!
    for (const i of [7, 8, 9, 10]) expect(w[i]).toBeGreaterThanOrEqual(11)
  })
})

describe('cutWorkbook — цвет стиля низ и верх словами (таск 03)', () => {
  it('тон стиля с отдельным верхом: в «Фасадах» «… — низ» и «… — верх», без hex; KY — своими словами', () => {
    const corner = cornerSpec()
    const tone = { ru: 'Кашемир и дуб', ky: 'Кашемир жана эмен', facade: '#cfc5b8', upper: '#b58d63', upperTexture: 'wood' as const }
    const ruColors = new Set(sheet(book(corner, { tone }), 'Фасады').slice(1, -1).map((r) => r[2]))
    expect(ruColors).toEqual(new Set(['Кашемир и дуб — низ', 'Кашемир и дуб — верх']))
    const ky = kitchenTexts('ky')
    const kyColors = new Set(sheet(book(corner, { tone }, ky), ky.xl.sheets.fronts).slice(1, -1).map((r) => r[2]))
    expect(kyColors).toEqual(new Set(['Кашемир жана эмен — асты', 'Кашемир жана эмен — үстү']))
    // тон без отдельного верха — просто название тона
    const plain = new Set(sheet(book(corner, { tone: { ru: 'Графит', ky: 'Графит', facade: '#333333' } }), 'Фасады').slice(1, -1).map((r) => r[2]))
    expect(plain).toEqual(new Set(['Графит']))
    for (const b of [book(corner, { tone })]) for (const s of b) for (const r of s.rows) for (const c of r) expect(String(c ?? '')).not.toMatch(/#[0-9a-f]{3,6}\b/i)
  })
})

/* ───────────── таск 05: поломки, которые тесты раньше пропускали ───────────── */

type Placed = { sheet: number; label: string; len: number; wid: number; x: number; y: number; rotated: boolean }

/** Разделы «Листы» по материалу: заголовок, размер листа из заголовка, строки раскладки. */
function sections(b: XlsxSheet[]): { head: string; L: number; W: number; rows: Placed[] }[] {
  const out: { head: string; L: number; W: number; rows: Placed[] }[] = []
  for (const r of sheet(b, 'Листы')) {
    const size = typeof r[0] === 'string' ? / · лист (\d+) × (\d+) мм$/.exec(r[0]) : null
    if (size) out.push({ head: r[0] as string, L: Number(size[1]), W: Number(size[2]), rows: [] })
    else if (r.length === 7 && typeof r[0] === 'number')
      out[out.length - 1].rows.push({ sheet: r[0], label: r[1] as string, len: r[2] as number, wid: r[3] as number, x: r[4] as number, y: r[5] as number, rotated: r[6] === 'да' })
  }
  return out
}

/** Деталь целиком на листе за обрезкой: X — вдоль длины листа, Y — вдоль ширины; у повёрнутой вдоль длины листа — её ширина. */
function expectOnSheet(sec: { L: number; W: number; rows: Placed[] }, trim = 10) {
  for (const p of sec.rows) {
    const [alongL, alongW] = p.rotated ? [p.wid, p.len] : [p.len, p.wid]
    expect(p.x, p.label).toBeGreaterThanOrEqual(trim)
    expect(p.y, p.label).toBeGreaterThanOrEqual(trim)
    expect(p.x + alongL, `${p.label}: X ${p.x} + ${alongL}`).toBeLessThanOrEqual(sec.L - trim)
    expect(p.y + alongW, `${p.label}: Y ${p.y} + ${alongW}`).toBeLessThanOrEqual(sec.W - trim)
  }
}

describe('cutWorkbook — таск 05: «Листы», цвет, количество, имена листов', () => {
  it('«Листы»: X — вдоль длины листа, Y — вдоль ширины; места те же, что у nest', () => {
    // 3 однотонные панели 900 × 500: вдоль длины листа в ряд — X третьей 1818, с шириной 900 за ширину листа 2070 не влезла бы
    const row: SpecData = { ...one, runs: [{ ...one.runs[0], fronts: [] }], carcasses: [], extras: [1, 2, 3].map(() => ({ kind: 'islandBack' as const, run: 'I' as const, w: 90, h: 50 })) }
    const [sec] = sections(book(row))
    expect(sec.rows).toHaveLength(3)
    expectOnSheet(sec)
    // проверка чувствительна: хотя бы одна деталь при X ↔ Y вышла бы за ширину листа
    expect(sec.rows.some((p) => p.x + (p.rotated ? p.len : p.wid) > sec.W - 10)).toBe(true)
    const pl = nest(cutParts(row, {})).flatMap((r) => r.sheets.flatMap((s) => s.placements))
    expect(sec.rows.map((p) => [p.x, p.y, p.rotated])).toEqual(pl.map((p) => [p.x, p.y, p.rotated]))
    // угловая кухня: каждая деталь каждого листа — на своём листе
    const all = sections(book(cornerSpec()))
    expect(all.length).toBeGreaterThanOrEqual(2)
    for (const s of all) expectOnSheet(s)
  })

  it('у каждого материала — цвет: два цвета ЛДСП — две строки сводки и два раздела; в «Распил» цвет у каждой детали', () => {
    const b = book(one, { facade: 'lam-graphite' })
    expect(sheet(b, 'Листы').slice(1, 4).map((r) => r.slice(0, 5))).toEqual([
      ['ЛДСП', 'Белый премиум', 16, '2800 × 2070', 1],
      ['ХДФ', 'Белый премиум', 3, '2800 × 2070', 1],
      ['ЛДСП', 'Графит', 16, '2800 × 2070', 1],
    ])
    expect(sections(b).map((s) => s.head)).toEqual([
      'ЛДСП 16 мм · Белый премиум · лист 2800 × 2070 мм',
      'ХДФ 3 мм · Белый премиум · лист 2800 × 2070 мм',
      'ЛДСП 16 мм · Графит · лист 2800 × 2070 мм',
    ])
    const cut = sheet(b, 'Распил').slice(1)
    expect(cut).toHaveLength(6)
    for (const r of cut) expect(typeof r[3] === 'string' && r[3].length > 0, String(r[1])).toBe(true)
    expect(cut.find((r) => r[1] === 'Дверца')!.slice(2, 4)).toEqual(['ЛДСП 16 мм', 'Графит'])
    expect(cut.find((r) => r[1] === 'Боковина')!.slice(2, 4)).toEqual(['ЛДСП 16 мм', 'Белый премиум'])
    // «Фасады»: у МДФ — тоже цвет
    expect(sheet(book(one, { facade: 'en-sage' }), 'Фасады')[1].slice(1, 3)).toEqual(['МДФ, эмаль', frontColor('en-sage')!.ru])
  })

  it('«Фасады»: две одинаковые дверцы — одна строка, кол-во 2 и м² за обе; итог — все штуки (разобрано вручную)', () => {
    const door = one.runs[0].fronts[0]
    const drawer = { ...door, y: 0, h: 17.6, hinge: 'drawer' as const }
    const three: SpecData = { ...one, runs: [{ ...one.runs[0], fronts: [door, { ...door, x: 60.2 }, drawer] }] }
    // 716 × 596 = 426 736 мм², × 2 = 0,853 м²; ящик 176 × 596 = 104 896 мм² = 0,105; всего 0,958 м², 3 шт.
    expect(sheet(book(three, { facade: 'en-white' }), 'Фасады').slice(1)).toEqual([
      ['Дверца', 'МДФ, эмаль', 'Белый мат', 716, 596, 2, 0.85],
      ['Фасад ящика', 'МДФ, эмаль', 'Белый мат', 176, 596, 1, 0.1],
      ['Итого', null, null, null, null, 3, 0.96],
    ])
    // из ЛДСП — в «Распил» одной строкой, 2 штуки
    expect(sheet(book(three), 'Распил').filter((r) => r[1] === 'Дверца').map((r) => r.slice(4, 7))).toEqual([[716, 596, 2]])
  })

  it('имена листов в файле — ровно шесть, по-русски и по-кыргызски', () => {
    const want = {
      ru: ['Распил', 'Фасады', 'Столешница', 'Фурнитура', 'Кромка', 'Листы'],
      ky: ['Кесүү', 'Фасаддар', 'Столешница', 'Фурнитура', 'Кромка', 'Листтер'],
    }
    for (const lang of ['ru', 'ky'] as const) {
      const names = sheetsOf(unzip(xlsx(cutWorkbook(one, {}, kitchenTexts(lang))))).map((s) => s.name)
      expect(names, lang).toEqual(want[lang])
    }
  })

  it('лист мастера (opts.sheets) доходит до «Листы»: ЛДСП 2750 × 1830, ХДФ — 2800 × 2070; детали — на своём листе', () => {
    const b = cutWorkbook(cornerSpec(), {}, ru, { sheets: { ldsp: { L: 2750, W: 1830 } } })
    const sum = sheet(b, 'Листы').slice(1, 3)
    expect(sum.map((r) => r.slice(0, 4))).toEqual([
      ['ЛДСП', 'Белый премиум', 16, '2750 × 1830'],
      ['ХДФ', 'Белый премиум', 3, '2800 × 2070'],
    ])
    const secs = sections(b)
    expect(secs.map((s) => [s.L, s.W])).toEqual([
      [2750, 1830],
      [2800, 2070],
    ])
    for (const s of secs) expectOnSheet(s)
    // на меньшем листе ЛДСП листов не меньше, чем на 2800 × 2070
    expect(sum[0][4] as number).toBeGreaterThanOrEqual(sheet(book(cornerSpec()), 'Листы')[1][4] as number)
  })
})
