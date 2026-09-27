import type { KitchenTexts } from '@/components/kitchen/texts'
import { cutParts, edgeTotals, nest, type CutLook, type CutMaterial, type CutPart, type EdgeThick, type NestOpts } from './cutting'
import { FRONT_COLORS, frontColor, type FrontMaterial } from './finishes'
import { frontList, hardware, topList, type SpecData } from './spec'
import type { XlsxCell, XlsxSheet } from './xlsx'

/**
 * Книга Excel для пильного центра (пакет мастера, истории 2–3, 5, 7):
 * «Распил», «Фасады», «Столешница», «Фурнитура», «Кромка», «Листы». Числа —
 * из `cutting.ts` и `spec.ts`, подписи — из `texts.ts` (RU/KY). Колонки
 * меняются только здесь — так файл подгоняется под конкретный пильный центр.
 */
export function cutWorkbook(spec: SpecData, look: CutLook, t: KitchenTexts, opts?: NestOpts): XlsxSheet[] {
  const x = t.xl
  const parts = cutParts(spec, look)
  const nested = nest(parts, opts)
  const oversize = new Set(nested.flatMap((r) => r.oversize))
  const partName = (p: CutPart) => (p.front ? t.frontTypes[p.name as keyof typeof t.frontTypes] : t.cutNames[p.name as keyof typeof t.cutNames])
  const matName = (m: CutMaterial) => `${x.kinds[m.kind]} ${m.thick} ${x.mm}`
  const edge = (e: EdgeThick): XlsxCell => (e > 0 ? e : null)

  // распил: всё, что режется из листа, — корпуса, ХДФ, фасады из ЛДСП; № — как на карте листа
  const cut = parts
    .filter((p) => p.material.kind !== 'mdf')
    .map((p): XlsxCell[] => [
      Number(p.id),
      partName(p),
      matName(p.material),
      p.material.label,
      p.length,
      p.width,
      p.count,
      edge(p.edges.l1),
      edge(p.edges.l2),
      edge(p.edges.w1),
      edge(p.edges.w2),
      p.grain ? x.yes : x.no,
      [p.note, oversize.has(p.id) ? x.oversize : undefined].filter(Boolean).join('; ') || null,
    ])
  // фасады не из листа (МДФ: плёнка со стеклом, эмаль, акрил, шпон, Fenix) — в цех фасадов;
  // высота и ширина — по строке `frontList`: у детали раскроя длина — вдоль волокна, а не по высоте
  const facadeMat: FrontMaterial = typeof look.facade === 'object' ? look.facade.material : (frontColor(look.facade)?.material ?? 'laminate')
  const catalogMat = (m: CutMaterial) => FRONT_COLORS.find((c) => c.color === m.color && (c.ru === m.label || c.ky === m.label))?.material
  const frontParts = parts.filter((p) => p.front)
  const fronts: XlsxCell[][] = []
  let frontCount = 0
  let frontArea = 0
  for (const row of frontList(spec.runs)) {
    const k = frontParts.findIndex(
      (p) => p.name === row.type && p.count === row.count && ((p.length === row.h && p.width === row.w) || (p.length === row.w && p.width === row.h)),
    )
    if (k < 0) continue
    const [p] = frontParts.splice(k, 1)
    if (p.material.kind !== 'mdf') continue
    const fm = frontColor(row.color)?.material ?? catalogMat(p.material) ?? facadeMat
    const area = (row.h * row.w * row.count) / 1e6
    frontCount += row.count
    frontArea += area
    fronts.push([t.frontTypes[row.type], `${matName(p.material)}, ${x.frontMat[fm]}`, p.material.label, row.h, row.w, row.count, r2(area)])
  }
  if (fronts.length) fronts.push([x.total, null, null, null, null, frontCount, r2(frontArea)])
  else fronts.push([x.frontsInCut])

  // столешница: по стенам, вырезы под мойку и варочную панель
  const tops: XlsxCell[][] = topList(spec.runs).rows.map((r) => [
    x.wall(r.run),
    r.length,
    r.depth,
    r.thick,
    [r.sink ? x.sink : '', r.hob ? x.hob : ''].filter(Boolean).join(', ') || null,
  ])
  if (tops.length) tops.push([x.total, tops.reduce((s, r) => s + (r[1] as number), 0)])

  // фурнитура и погонаж — как в таблице «Для мебельщика»; нули не пишем
  const hw = hardware(spec)
  const unit = (name: string, u: string) => `${name}, ${u}`
  const hwRows: XlsxCell[][] = (
    [
      [t.hw.hinges, hw.hinges],
      [t.hw.lifts, hw.lifts],
      [t.hw.runners, hw.runners],
      [t.hw.handles, hw.handles],
      [t.hw.push, hw.push],
      [t.hw.legs, hw.legs],
      [t.hw.hangers, hw.hangers],
      [unit(t.hw.gola, t.meters), hw.gola],
      [unit(t.hw.plinth, t.meters), hw.plinth],
      [unit(t.hw.splash, t.m2), r2(spec.splash)],
    ] as [string, number][]
  ).filter((r) => r[1] > 0)

  // кромка: по толщине, от тонкой к толстой; ниже — что значат Д1/Ш1
  const edges: XlsxCell[][] = edgeTotals(parts).map((e) => [e.thick, e.net, e.meters])
  edges.push([], [x.edgeNote])

  // листы: сводка по материалу+цвету, ниже — где лежит каждая деталь на каждом листе
  const byId = new Map(parts.map((p) => [p.id, p]))
  const size = (L: number, W: number) => `${L} × ${W}`
  const nestRows: XlsxCell[][] = nested.map((r) => [
    x.kinds[r.material.kind],
    r.material.label,
    r.material.thick,
    size(r.sheetL, r.sheetW),
    r.sheets.length,
    Math.round(r.waste * 1000) / 10,
  ])
  if (oversize.size) nestRows.push([x.oversizeList([...oversize].join(', '))])
  for (const r of nested) {
    if (!r.sheets.length) continue
    nestRows.push([], [x.nestOf(`${matName(r.material)} · ${r.material.label}`, size(r.sheetL, r.sheetW))], x.placeHead)
    r.sheets.forEach((sh, i) => {
      for (const pl of sh.placements) {
        const p = byId.get(pl.id)
        nestRows.push([i + 1, p ? `${pl.id} · ${partName(p)}` : pl.id, pl.l, pl.w, pl.x, pl.y, pl.rotated ? x.yes : x.no])
      }
    })
  }

  const sheet = (name: string, head: string[], rows: XlsxCell[][], widths: number[]): XlsxSheet => ({ name, rows: [head, ...rows], widths })
  return [
    sheet(x.sheets.cut, x.cutHead, cut, [5, 26, 13, 18, 10, 10, 7, 9, 9, 9, 9, 9, 30]),
    sheet(x.sheets.fronts, x.frontsHead, fronts, [24, 22, 18, 11, 11, 7, 8]),
    sheet(x.sheets.top, x.topHead, tops, [12, 11, 11, 11, 28]),
    sheet(x.sheets.hw, x.hwHead, hwRows, [40, 9]),
    sheet(x.sheets.edge, x.edgeHead, edges, [13, 15, 22]),
    sheet(x.sheets.nest, x.nestHead, nestRows, [13, 26, 12, 16, 10, 12, 12]),
  ]
}

const r2 = (v: number) => Math.round(v * 100) / 100
