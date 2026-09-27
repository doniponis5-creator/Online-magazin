import { FRONT_T } from './dims'
import { frontColor, type FrontMaterial } from './finishes'
import { cutList, frontList, LDSP, type CutName, type FrontType, type SpecData } from './spec'

/**
 * Раскрой для пильного центра: детали из листа с кромкой по сторонам,
 * итог кромки и раскладка по листам. Всё в миллиметрах. Размеры деталей —
 * только из спецификации (`cutList`, `frontList`): числа мебельщику не
 * расходятся с чертежом. Материал, цвет и текстура — из каталога отделки.
 */

/* ───────── отделка ───────── */

/** Отделка без id каталога (фасад стиля): материал, название, цвет, древесный ли декор. */
export type CutFinish = { material: FrontMaterial; ru: string; ky: string; color: string; wood: boolean }

export type EdgeThick = 0 | 0.4 | 1 | 2

export type CutLook = {
  /** фасады: id из каталога отделки (`FRONT_COLORS`) или отделка стиля; нет — белый ламинат */
  facade?: string | CutFinish
  /** корпус: id из каталога или своя отделка; нет — белый без текстуры */
  body?: string | CutFinish
  /** толщина видимой кромки корпуса, мм; нет — 1 */
  bodyEdge?: 0.4 | 1 | 2
  /** язык названий цветов; нет — ru */
  lang?: 'ru' | 'ky'
}

export type CutMaterial = {
  /** ЛДСП и ХДФ режутся из листа; МДФ-фасады (акрил, эмаль, шпон, Fenix) — в цех фасадов */
  kind: 'ldsp' | 'hdf' | 'mdf'
  /** название цвета или декора */
  label: string
  /** цвет для карты раскроя, #rrggbb */
  color: string
  /** толщина, мм */
  thick: number
}

export type CutPart = {
  /** номер детали в раскрое: «1», «2»… — им подписаны детали на карте листа */
  id: string
  /** что за деталь: корпус (`CutName`) или фасад (`FrontType`) */
  name: CutName | FrontType
  /** фасад, а не деталь корпуса */
  front: boolean
  material: CutMaterial
  /** длина, мм: у детали с текстурой — вдоль волокна (вдоль длины листа) */
  length: number
  /** ширина, мм */
  width: number
  count: number
  /** древесный декор: кладётся только вдоль волокна, не поворачивается */
  grain: boolean
  /** кромка, мм: l1, l2 — по длинным сторонам (длина), w1, w2 — по ширине; l1/w1 — передняя */
  edges: { l1: EdgeThick; l2: EdgeThick; w1: EdgeThick; w2: EdgeThick }
  note?: string
}

/** ХДФ задних стенок, мм. */
const HDF_T = 3
/** Белый без текстуры — корпус и фасады, когда отделка не выбрана. */
const WHITE = 'lam-white'

type Finish = { material: FrontMaterial; label: string; color: string; wood: boolean }

function finishOf(f: string | CutFinish | undefined, lang: 'ru' | 'ky'): Finish {
  if (f && typeof f !== 'string') return { material: f.material, label: lang === 'ky' ? f.ky : f.ru, color: f.color, wood: f.wood }
  const c = frontColor(f) ?? frontColor(WHITE)!
  return { material: c.material, label: lang === 'ky' ? c.ky : c.ru, color: c.color, wood: c.texture === 'wood' }
}

/* ───────── детали ───────── */

/** Детали для распила: корпуса (ЛДСП, ХДФ) и фасады (ЛДСП из листа или МДФ в цех фасадов). */
export function cutParts(spec: SpecData, look: CutLook): CutPart[] {
  const lang = look.lang ?? 'ru'
  const body = finishOf(look.body, lang)
  const facade = finishOf(look.facade, lang)
  const visible = look.bodyEdge ?? 1
  const fronts = frontSides(spec)
  const out: CutPart[] = []
  const push = (p: Omit<CutPart, 'id'>) => out.push({ id: String(out.length + 1), ...p })

  for (const row of cutList(spec.carcasses, spec.panels)) {
    const hdf = row.hdf
    const grain = !hdf && body.wood
    const material: CutMaterial = hdf
      ? { kind: 'hdf', label: body.label, color: body.color, thick: HDF_T }
      : { kind: 'ldsp', label: body.label, color: body.color, thick: LDSP }
    // передняя сторона детали: боковина — по высоте, дно, крыша, полка, царга — по ширине шкафа
    const front = fronts.get(`${row.name}:${row.a}:${row.b}`) ?? row.a
    // волокно у корпуса идёт вдоль передней кромки; однотонная деталь — длиной по большей стороне
    const [length, width] = grain ? [front, front === row.a ? row.b : row.a] : [row.a, row.b]
    const edge: EdgeThick = hdf ? 0 : row.name === 'rail' ? 0.4 : visible
    const edges: CutPart['edges'] = { l1: 0, l2: 0, w1: 0, w2: 0 }
    // царга — одна длинная кромка; остальные — передняя
    if (row.name === 'rail' || front === length) edges.l1 = edge
    else edges.w1 = edge
    push({ name: row.name, front: false, material, length, width, count: row.count, grain, edges })
  }

  for (const row of frontList(spec.runs)) {
    const f = row.color && frontColor(row.color) ? finishOf(row.color, lang) : facade
    // рамка со стеклом и рамочный фасад из плоского листа не выпилить — в цех фасадов
    const sheet = f.material === 'laminate' && row.type !== 'glass' && row.type !== 'framed'
    const grain = f.wood
    const material: CutMaterial = sheet
      ? { kind: 'ldsp', label: f.label, color: f.color, thick: LDSP }
      : { kind: 'mdf', label: f.label, color: f.color, thick: Math.round(FRONT_T * 10) }
    // волокно фасада — вдоль высоты
    const [length, width] = grain || row.h >= row.w ? [row.h, row.w] : [row.w, row.h]
    const e: EdgeThick = sheet ? 2 : 0
    push({ name: row.type, front: true, material, length, width, count: row.count, grain, edges: { l1: e, l2: e, w1: e, w2: e } })
  }
  return out
}

/* ───────── кромка ───────── */

/** Запас кромки на торцовку. */
export const EDGE_SPARE = 0.1

export type EdgeTotal = {
  /** толщина кромки, мм */
  thick: EdgeThick
  /** метров чистых, до 0,1 */
  net: number
  /** метров с запасом 10%, до 0,1 — столько купить */
  meters: number
}

/** Кромка каждой толщины: метры по всем деталям, от тонкой к толстой. */
export function edgeTotals(parts: CutPart[]): EdgeTotal[] {
  const mmBy = new Map<EdgeThick, number>()
  const add = (t: EdgeThick, len: number) => {
    if (t > 0) mmBy.set(t, (mmBy.get(t) ?? 0) + len)
  }
  for (const p of parts) {
    for (let k = 0; k < p.count; k++) {
      add(p.edges.l1, p.length)
      add(p.edges.l2, p.length)
      add(p.edges.w1, p.width)
      add(p.edges.w2, p.width)
    }
  }
  const r1 = (m: number) => Math.round(m * 10) / 10
  return [...mmBy.entries()]
    .sort((p, q) => p[0] - q[0])
    .map(([thick, len]) => ({ thick, net: r1(len / 1000), meters: r1((len / 1000) * (1 + EDGE_SPARE)) }))
}

/* ───────── раскладка по листам ───────── */

export type Sheet = { L: number; W: number }
/** Лист ЛДСП и ХДФ по умолчанию, мм: длина — вдоль волокна. */
export const SHEET: Sheet = { L: 2800, W: 2070 }
/** Пропил пилы, мм. */
export const KERF = 4
/** Обрезка кромки листа с каждой стороны, мм. */
export const TRIM = 10

export type NestOpts = {
  /** лист для всех материалов; нет — 2800 × 2070 */
  sheet?: Sheet
  /** свой лист по материалу — важнее `sheet` */
  sheets?: Partial<Record<'ldsp' | 'hdf', Sheet>>
  /** пропил, мм; нет — 4 */
  kerf?: number
  /** обрезка с каждой стороны листа, мм; нет — 10 */
  trim?: number
}

/** Деталь на листе: x — вдоль длины листа, y — вдоль ширины, от угла листа, мм. */
export type Placement = { id: string; x: number; y: number; l: number; w: number; rotated: boolean }

export type NestResult = {
  material: CutMaterial
  sheetL: number
  sheetW: number
  sheets: { placements: Placement[] }[]
  /** отход, доля 0…1: 1 − площадь деталей / (листов × рабочая площадь листа) */
  waste: number
  /** номера деталей, которые не помещаются на лист (длиннее листа или поперёк волокна) */
  oversize: string[]
}

/**
 * Раскладка по листам: по материалу, цвету и толщине отдельно; МДФ — не из
 * листа. Гильотина: полосы (вдоль или поперёк листа), в полосе — столбцы, в
 * столбце детали друг над другом. Пробует несколько порядков и поворотов
 * (только у деталей без текстуры) и берёт тот, где меньше листов.
 */
export function nest(parts: CutPart[], opts: NestOpts = {}): NestResult[] {
  const kerf = opts.kerf ?? KERF
  const trim = opts.trim ?? TRIM
  const groups = new Map<string, { material: CutMaterial; parts: CutPart[] }>()
  for (const p of parts) {
    if (p.material.kind === 'mdf' || p.count <= 0) continue
    const m = p.material
    const key = `${m.kind}|${m.label}|${m.color}|${m.thick}`
    const g = groups.get(key)
    if (g) g.parts.push(p)
    else groups.set(key, { material: m, parts: [p] })
  }
  return [...groups.values()].map(({ material, parts: list }) => {
    const sheet = opts.sheets?.[material.kind as 'ldsp' | 'hdf'] ?? opts.sheet ?? SHEET
    const box = { L: sheet.L - 2 * trim, W: sheet.W - 2 * trim }
    const oversize: string[] = []
    const items: Item[] = []
    let area = 0
    for (const p of list) {
      const ways: Way[] = []
      if (p.length <= box.L && p.width <= box.W) ways.push({ l: p.length, w: p.width, rotated: false })
      if (!p.grain && p.length !== p.width && p.width <= box.L && p.length <= box.W) ways.push({ l: p.width, w: p.length, rotated: true })
      if (!ways.length) {
        if (!oversize.includes(p.id)) oversize.push(p.id)
        continue
      }
      // однотонная — длинной стороной вдоль листа, если так помещается
      ways.sort((a, b) => b.l - a.l)
      for (let k = 0; k < p.count; k++) items.push({ id: p.id, ways })
      area += p.length * p.width * p.count
    }
    // полосы вдоль длины листа, а если меньше листов — поперёк (та же гильотина, первый рез другой)
    const across = items.map((it) => ({ id: it.id, ways: it.ways.map((w) => ({ l: w.w, w: w.l, rotated: w.rotated })) }))
    const back = (sheets: Placement[][]) => sheets.map((pl) => pl.map((p) => ({ id: p.id, x: p.y, y: p.x, l: p.w, w: p.l, rotated: p.rotated })))
    let best: Placement[][] | null = null
    for (const turn of ['none', 'fit', 'prefer'] as const)
      for (const order of ['strip', 'area'] as const) {
        const along = pack(sorted(items, order, turn), turn, sheet, kerf, trim)
        if (!best || along.length < best.length) best = along
        const cross = pack(sorted(across, order, turn), turn, { L: sheet.W, W: sheet.L }, kerf, trim)
        if (cross.length < best.length) best = back(cross)
      }
    const sheets = (best ?? []).map((placements) => ({ placements }))
    const waste = sheets.length ? 1 - area / (sheets.length * box.L * box.W) : 0
    return { material, sheetL: sheet.L, sheetW: sheet.W, sheets, waste, oversize }
  })
}

type Way = { l: number; w: number; rotated: boolean }
type Item = { id: string; ways: Way[] }
type Turn = 'none' | 'fit' | 'prefer'

/** Способы положить деталь по правилу поворота: none — как есть, fit — любым, prefer — сначала повёрнутой. */
const waysOf = (it: Item, turn: Turn): Way[] => (turn === 'none' ? it.ways.slice(0, 1) : turn === 'prefer' ? [...it.ways].reverse() : it.ways)

function sorted(items: Item[], order: 'strip' | 'area', turn: Turn): Item[] {
  const first = (it: Item) => waysOf(it, turn)[0]
  return [...items].sort((a, b) => {
    const p = first(a)
    const q = first(b)
    return order === 'strip' ? q.w - p.w || q.l - p.l : q.l * q.w - p.l * p.w || q.w - p.w
  })
}

type Col = { x: number; l: number; used: number }
type Strip = { y: number; h: number; x: number; cols: Col[] }
type SheetState = { strips: Strip[]; nextY: number; placements: Placement[] }

/** Первая подходящая полоса (first-fit decreasing) — список листов с деталями. */
function pack(items: Item[], turn: Turn, sheet: Sheet, kerf: number, trim: number): Placement[][] {
  const endX = sheet.L - trim
  const endY = sheet.W - trim
  const sheets: SheetState[] = []
  const put = (s: SheetState, it: Item, way: Way, x: number, y: number) => s.placements.push({ id: it.id, x, y, l: way.l, w: way.w, rotated: way.rotated })

  const intoStrips = (it: Item, ways: Way[]): boolean => {
    for (const s of sheets)
      for (const strip of s.strips)
        for (const way of ways) {
          // над деталью в столбце полосы
          for (const col of strip.cols) {
            if (way.l <= col.l && col.used + kerf + way.w <= strip.h) {
              put(s, it, way, col.x, strip.y + col.used + kerf)
              col.used += kerf + way.w
              return true
            }
          }
          // новый столбец в полосе
          if (way.w <= strip.h && strip.x + way.l <= endX) {
            put(s, it, way, strip.x, strip.y)
            strip.cols.push({ x: strip.x, l: way.l, used: way.w })
            strip.x += way.l + kerf
            return true
          }
        }
    return false
  }
  const newStrip = (s: SheetState, it: Item, way: Way) => {
    put(s, it, way, trim, s.nextY)
    s.strips.push({ y: s.nextY, h: way.w, x: trim + way.l + kerf, cols: [{ x: trim, l: way.l, used: way.w }] })
    s.nextY += way.w + kerf
  }

  for (const it of items) {
    const ways = waysOf(it, turn)
    if (intoStrips(it, ways)) continue
    const room = sheets.find((s) => ways.some((way) => s.nextY + way.w <= endY))
    if (room) {
      newStrip(room, it, ways.find((way) => room.nextY + way.w <= endY)!)
      continue
    }
    const fresh: SheetState = { strips: [], nextY: trim, placements: [] }
    sheets.push(fresh)
    newStrip(fresh, it, ways[0])
  }
  return sheets.map((s) => s.placements)
}

const mm = (cm: number) => Math.round(cm * 10)

/**
 * Какая сторона детали корпуса передняя: ключ — как у строки `cutList`
 * (`имя:большая:меньшая`), значение — длина передней стороны, мм. Размеры те
 * же, что в `cutList`, — здесь только чтобы знать, где передняя кромка.
 */
function frontSides(spec: SpecData): Map<string, number> {
  const out = new Map<string, number>()
  const add = (name: CutName, front: number, depth: number) => {
    const key = `${name}:${Math.max(front, depth)}:${Math.min(front, depth)}`
    if (!out.has(key)) out.set(key, front)
  }
  for (const c of spec.carcasses) {
    const inner = mm(c.w) - 2 * LDSP
    const d = mm(c.d)
    add('side', mm(c.h), d)
    add('bottom', inner, d)
    add('top', inner, d)
    add('rail', inner, 100)
    add('shelf', inner - 2, d - 20)
  }
  for (const p of spec.panels) add('nicheSide', mm(p.h), mm(p.d))
  return out
}
