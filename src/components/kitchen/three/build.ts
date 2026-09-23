import * as THREE from 'three'
import { baseKey, DRAWER_PARTS, MIN_EDIT_W, upperKey } from '@/lib/kitchen/fronts'
import type { Module, Plan, Run } from '@/lib/kitchen/layout'
import type { Dims, DimsKind, SpecBox, SpecCarcass, SpecData, SpecFront, SpecRun, SpecTop } from '@/lib/kitchen/spec'
import type { DoorKind, KitchenStyle, Tone } from '@/lib/kitchen/styles'
import { isCabinet, type BaseFront, type FloorKind, type FrontVariant, type ItemKey, type KitchenAppliance, type SlotKind, type UpperFront } from '@/lib/kitchen/types'
import * as A from './appliances'
import { createMaterials, type FinishLook, type Mats } from './materials'
import { box, cornice, front, FRONT_T, GAP, handle, mergeAll, mesh, openable, panels, rounded, shiftUV, slab, type HandleAt, type Span } from './parts'
import type { Photo } from './photo'
import * as T from './textures'

export type { Dims, DimsKind }

/**
 * Сборка кухни из плана раскладки, стиля и выбранной техники.
 * Размеры мебели — типовые размеры мебельщиков (метры):
 */
const PLINTH = 0.1
const BODY = 0.72
const CARCASS_D = 0.58
const TOP_D = 0.62
const UPPER_D = 0.33
const UPPER_BOTTOM = 1.42
/** потолок по умолчанию */
export const WALL_H = 2.7
/**
 * Слой потолка: его видит камера и тень от солнца в окне, но не основной
 * свет сверху — иначе потолок затенил бы всю кухню. Нажатия его не ловят.
 */
export const CEILING_LAYER = 2
const WALL_T = 0.12
const BODY_TOP = PLINTH + BODY
/** ЛДСП корпуса и боковин ниши */
const PANEL_T = 0.016

export type Anim = { obj: THREE.Object3D; kind: 'swing' | 'lift' | 'slide' | 'fold'; dir: number; delay: number; slot?: SlotKind }

/** Шкаф, у которого покупатель может поменять фасады. */
export type CabInfo = { key: string; row: 'base' | 'upper'; variant: FrontVariant }

const r5 = (v: number) => Math.round(v * 2) / 2

function dims(obj: THREE.Object3D, kind: DimsKind, w: number, h: number, d: number, slot?: SlotKind) {
  obj.userData.dims = { kind, w: r5(w), h: r5(h), d: r5(d), slot } satisfies Dims
}

function applianceDims(obj: THREE.Object3D, a: KitchenAppliance | undefined, slot: SlotKind, fallback: [number, number, number]) {
  dims(obj, 'appliance', a?.w ?? fallback[0], a?.h ?? fallback[1], a?.d ?? fallback[2], slot)
}

export type BuildInput = {
  plan: Plan
  style: KitchenStyle
  tone: Tone
  items: Partial<Record<SlotKind, KitchenAppliance | null>>
  photos: Map<string, Photo | null>
  evening: boolean
  /** комната: потолок в см, шкафы до потолка, свой пол и цвет стен */
  room: { ceiling: number; toCeiling: boolean; floor?: FloorKind; wall?: string | null }
  /** свои фасады отдельных шкафов */
  fronts: Record<string, FrontVariant>
  /** детальность картинок: 2 — компьютер, 1 — телефон, 0,5 — превью */
  detail?: number
  /** отделка из каталога: фасады, столешница */
  finish?: FinishLook
}

export type Built = {
  root: THREE.Group
  /** точки для ценников: верх-перед техники */
  anchors: Partial<Record<SlotKind, THREE.Vector3>>
  /** объекты техники — для подсветки выбора */
  objects: Partial<Record<SlotKind, THREE.Object3D>>
  anims: Anim[]
  /** вечерний свет: включается переключателем */
  eveningLights: THREE.Object3D[]
  /** верхние шкафы, вытяжка, лампы — прячутся на виде сверху, как на чертеже */
  overhead: THREE.Object3D[]
  /** контуры убранных шкафов: видны в конструкторе, но не на картинке */
  ghosts: THREE.Object3D[]
  bounds: THREE.Box3
  /** высота потолка, м */
  wallH: number
  /** всё для мебельщика: корпуса, фасады, столешница */
  spec: SpecData
  dispose(): void
}

type Ctx = {
  mats: Mats
  style: KitchenStyle
  input: BuildInput
  counterY: number
  /** верх основного ряда верхних шкафов */
  upperTop: number
  /** второй ряд до потолка (антресоли) */
  mezz: { from: number; to: number } | null
  /** верх пеналов и шкафа над холодильником */
  columnTop: number
  wallH: number
  anims: Anim[]
  objects: Partial<Record<SlotKind, THREE.Object3D>>
  anchorsLocal: { slot: SlotKind; obj: THREE.Object3D; at: THREE.Vector3 }[]
  eveningLights: THREE.Object3D[]
  overhead: THREE.Object3D[]
  ghosts: THREE.Object3D[]
  /** порядковый номер фасада — для «волны» при смене стиля */
  wave: number
  /** ваза с лимонами уже стоит — вторую не ставим */
  lemons: boolean
  /** доска и чайник уже стоят (по одному на кухню) */
  props: { board: boolean; kettle: boolean }
  /** сдвиг рисунка фасадов в текущем ряду */
  uvRun: number
  /* для мебельщика */
  carcasses: SpecCarcass[]
  nichePanels: { h: number; d: number; count: number }[]
  plinth: number
  gola: number
  splash: number
  tops: SpecTop[]
}

const cm = (v: number) => v / 100

function tag(obj: THREE.Object3D, slot: SlotKind) {
  obj.traverse((o) => {
    o.userData.slot = slot
  })
}

/** Помечает предмет, который можно переставить: нажать и держать. */
function tagItem(obj: THREE.Object3D, item: ItemKey) {
  obj.traverse((o) => {
    o.userData.item = item
  })
}

function anchor(ctx: Ctx, slot: SlotKind, obj: THREE.Object3D, x: number, y: number, z: number) {
  ctx.anchorsLocal.push({ slot, obj, at: new THREE.Vector3(x, y, z) })
}

/* ───────────── фасады и ручки ───────────── */

type Hinge = 'left' | 'right' | 'top' | 'fold' | 'drawer' | 'none'

const OPEN: Record<Exclude<Hinge, 'none'>, { kind: Anim['kind']; dir: number }> = {
  left: { kind: 'swing', dir: -1 },
  right: { kind: 'swing', dir: 1 },
  top: { kind: 'lift', dir: -1 },
  fold: { kind: 'fold', dir: 1 },
  drawer: { kind: 'slide', dir: 1 },
}

function addFront(
  ctx: Ctx,
  parent: THREE.Object3D,
  opts: {
    x: number
    y: number
    z: number
    w: number
    h: number
    hinge: Hinge
    upper?: boolean
    kind?: DoorKind
    mat?: THREE.Material
    noHandle?: boolean
    glass?: boolean
    /** глубина ящика за фасадом */
    depth?: number
  },
) {
  const { style, mats } = ctx
  const kind = opts.kind ?? (opts.upper ? style.upperDoor : style.door)
  const mat = opts.mat ?? (opts.upper ? mats.upper : mats.facade)
  const w = opts.w
  const h = opts.h
  // Ящик получает простую рамку: филёнка на низком фасаде выглядит тяжело.
  const doorKind: DoorKind = opts.hinge === 'drawer' && kind === 'raised' ? 'shaker' : kind
  const glass = opts.glass ? { mat: mats.vitrine, bars: style.vitrine === 'bars' } : undefined
  const panel = front(doorKind, w, h, doorKind === 'fluted' && !glass ? mats.fluted(mat) : mat, glass, mats.trimMetal)
  // Шпон, бетон, мрамор: рисунок идёт через все фасады ряда, а не повторяется.
  const textured = mat === mats.facade ? mats.textured : mat === mats.upper ? mats.upperTextured : false
  if (textured) shiftUV(panel, ctx.uvRun + parent.position.x + opts.x, opts.y)

  let withHandle = false
  if (!opts.noHandle) {
    const at = handleAt(style.handle, opts.hinge, w, h, Boolean(opts.upper))
    const hd = at ? handle(style.handle, at, style.handle === 'leather' ? mats.leather : mats.handle) : null
    if (hd) {
      panel.add(hd)
      withHandle = true
    }
  }
  panel.userData.front = { w: w * 100, h: h * 100, hinge: opts.hinge, glass: Boolean(opts.glass), framed: doorKind === 'framed', handle: withHandle }

  const pivot = new THREE.Group()
  const delay = 0.03 * ctx.wave++
  if (opts.hinge === 'right') {
    pivot.position.set(opts.x + w, opts.y, opts.z)
    panel.position.x = -w
  } else if (opts.hinge === 'top') {
    pivot.position.set(opts.x, opts.y + h, opts.z)
    panel.position.y = -h
  } else {
    pivot.position.set(opts.x, opts.y, opts.z)
  }
  if (opts.hinge !== 'none') {
    const o = OPEN[opts.hinge]
    openable(pivot, o.kind, o.dir)
    ctx.anims.push({ obj: pivot, kind: o.kind, dir: o.dir, delay })
  }
  // У ящика есть короб: выдвигается вместе с фасадом.
  if (opts.hinge === 'drawer' && h > 0.07) {
    const bh = Math.min(h - 0.03, 0.17)
    const bd = opts.depth ?? 0.48
    const bw = w - 0.05
    const x0 = 0.025
    const y0 = 0.015
    const t = 0.012
    const list: Span[] = [
      [x0, y0, -bd, x0 + t, y0 + bh, -0.002],
      [x0 + bw - t, y0, -bd, x0 + bw, y0 + bh, -0.002],
      [x0, y0, -bd, x0 + bw, y0 + bh, -bd + t],
      [x0, y0, -bd, x0 + bw, y0 + t, -0.002],
    ]
    pivot.add(mesh(panels(list), mats.interior, 0, 0, 0, false))
  }
  pivot.add(panel)
  parent.add(pivot)
  return pivot
}

function handleAt(kind: KitchenStyle['handle'], hinge: Hinge, w: number, h: number, upper: boolean): HandleAt | null {
  if (kind === 'gola' || hinge === 'none') return null
  const rod = kind === 'bar' || kind === 'knurled' || kind === 'tbar'
  const long = rod ? h > 0.55 || ((hinge === 'drawer' || hinge === 'fold') && w > 0.55) : w > 0.5
  const small = kind === 'knob' || kind === 'woodKnob' || kind === 'ring' || kind === 'leather'
  if (hinge === 'drawer' || hinge === 'top' || hinge === 'fold') {
    // длинные и профильные ручки на ящике — почти во всю ширину
    const len = kind === 'long' ? Math.max(0.12, Math.min(w - 0.1, w * 0.8)) : kind === 'rail' ? Math.max(0.12, Math.min(w - 0.12, 0.5)) : undefined
    const y = kind === 'edge' ? (hinge === 'top' ? 0.004 : h - 0.004) : hinge === 'top' ? 0.06 : h > 0.22 ? h - 0.06 : h / 2
    return { x: w / 2, y, vertical: false, long, len }
  }
  const side = hinge === 'left' ? w - 0.045 : 0.045
  if (kind === 'edge') {
    return { x: hinge === 'left' ? w - 0.1 : 0.1, y: upper ? 0.004 : h - 0.004, vertical: false, long: false }
  }
  if (small) return { x: side, y: upper ? 0.07 : h - 0.07, vertical: true, long }
  if (kind === 'long') {
    // на высокой дверце — по центру, на обычной — у верхнего (у верхних — у нижнего) края
    const len = Math.max(0.2, Math.min(h - 0.12, h > 1 ? 0.9 : h * 0.72))
    const y = h > 1 ? h / 2 : upper ? 0.06 + len / 2 : h - 0.06 - len / 2
    return { x: side, y, vertical: true, long: true, len }
  }
  const len = kind === 'rail' ? (h > 1 ? 0.4 : 0.22) : kind === 'tbar' ? (long ? 0.2 : 0.13) : long ? 0.32 : kind === 'knurled' ? 0.18 : 0.16
  const y = upper ? 0.05 + len / 2 : h - 0.05 - len / 2
  return { x: side, y, vertical: true, long, len: kind === 'rail' || kind === 'knurled' ? len : undefined }
}

/** Фасады одного проёма: одна или две дверцы. */
function doorsIn(
  ctx: Ctx,
  parent: THREE.Object3D,
  x: number,
  y0: number,
  y1: number,
  z: number,
  w: number,
  upper: boolean,
  index: number,
  mat?: THREE.Material,
  glass = false,
) {
  const h = y1 - y0
  if (w < 0.2) {
    addFront(ctx, parent, { x: x + GAP / 2, y: y0, z, w: w - GAP, h, hinge: 'none', upper, mat })
    return
  }
  if (w > 0.62) {
    const half = w / 2
    addFront(ctx, parent, { x: x + GAP / 2, y: y0, z, w: half - GAP, h, hinge: 'left', upper, mat, glass })
    addFront(ctx, parent, { x: x + half + GAP / 2, y: y0, z, w: half - GAP, h, hinge: 'right', upper, mat, glass })
    return
  }
  addFront(ctx, parent, { x: x + GAP / 2, y: y0, z, w: w - GAP, h, hinge: index % 2 ? 'right' : 'left', upper, mat, glass })
}

/** Подъёмные дверцы (вверх): одна, а на широком шкафу — две рядом. */
function liftsIn(ctx: Ctx, parent: THREE.Object3D, x: number, y0: number, y1: number, z: number, w: number, glass = false) {
  const n = w > 0.92 ? 2 : 1
  const each = w / n
  for (let k = 0; k < n; k++) {
    addFront(ctx, parent, { x: x + each * k + GAP / 2, y: y0, z, w: each - GAP, h: y1 - y0, hinge: 'top', upper: true, glass })
  }
}

function drawersIn(ctx: Ctx, parent: THREE.Object3D, x: number, y0: number, y1: number, z: number, w: number, parts = DRAWER_PARTS.drawers3) {
  const total = y1 - y0
  let top = y1
  for (const p of parts) {
    const h = total * p
    addFront(ctx, parent, { x: x + GAP / 2, y: top - h + GAP / 2, z, w: w - GAP, h: h - GAP, hinge: 'drawer' })
    top -= h
  }
  return top
}

/**
 * Короб шкафа, как у мебельщика: боковины цвета фасада (их видно с торца),
 * а дно, спинка и полки — светлый ЛДСП. Внутри пусто — дверцу можно открыть.
 */
function carcass(
  ctx: Ctx,
  g: THREE.Object3D,
  w: number,
  y0: number,
  y1: number,
  depth: number,
  opts: { shelves?: number[]; top?: boolean; bottom?: boolean; sides?: THREE.Material; back?: boolean } = {},
) {
  const t = PANEL_T
  const sides = opts.sides ?? ctx.mats.facade
  g.add(mesh(panels([[0, y0, 0, t, y1, depth], [w - t, y0, 0, w, y1, depth]]), sides))
  const inner: Span[] = []
  if (opts.back !== false) inner.push([t, y0, 0, w - t, y1, 0.008])
  if (opts.bottom !== false) inner.push([t, y0, 0, w - t, y0 + t, depth])
  // Шкаф до потолка сверху виден в 3D как срез: крышка — в цвет боковин.
  const toCeiling = y1 >= ctx.wallH - 0.01
  if (opts.top && toCeiling) g.add(mesh(panels([[t, y1 - t, 0, w - t, y1, depth]]), sides))
  else if (opts.top) inner.push([t, y1 - t, 0, w - t, y1, depth])
  for (const y of opts.shelves ?? []) inner.push([t, y - t / 2, 0.008, w - t, y + t / 2, depth - 0.02])
  if (inner.length) g.add(mesh(panels(inner), ctx.mats.interior))
  ctx.carcasses.push({
    row: y0 >= 1 ? 'upper' : y1 - y0 > 1 ? 'tall' : 'base',
    w: w * 100,
    h: (y1 - y0) * 100,
    d: depth * 100,
    shelves: opts.shelves?.length ?? 0,
    top: Boolean(opts.top),
    bottom: opts.bottom !== false,
    back: opts.back !== false,
  })
}

/** Посуда на полке закрытого шкафа или витрины: стопка тарелок и стаканы. */
function dishes(ctx: Ctx, g: THREE.Object3D, x0: number, x1: number, y: number, depth: number) {
  if (x1 - x0 < 0.3) return
  const plates: THREE.BufferGeometry[] = []
  for (let j = 0; j < 5; j++) plates.push(new THREE.CylinderGeometry(0.1, 0.085, 0.012, 28).translate(x0 + 0.13, y + 0.007 + j * 0.013, depth / 2))
  g.add(mesh(mergeAll(plates), ctx.mats.ceramic, 0, 0, 0, false))
  const cups: THREE.BufferGeometry[] = []
  for (let j = 0; j < 3; j++) cups.push(new THREE.CylinderGeometry(0.032, 0.028, 0.1, 16).translate(x1 - 0.06 - j * 0.075, y + 0.05, depth / 2 + (j % 2) * 0.04))
  g.add(mesh(mergeAll(cups), ctx.mats.glass, 0, 0, 0, false))
}

/** Контур убранного шкафа: нажмите — и его можно вернуть. На картинке его нет. */
function ghost(ctx: Ctx, parent: THREE.Object3D, x: number, y0: number, y1: number, w: number, depth: number) {
  const g = new THREE.Group()
  const fill = new THREE.Mesh(
    new THREE.BoxGeometry(w - 0.01, y1 - y0 - 0.01, depth),
    new THREE.MeshBasicMaterial({ color: '#2563eb', transparent: true, opacity: 0.05, depthWrite: false }),
  )
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(fill.geometry), new THREE.LineBasicMaterial({ color: '#2563eb', transparent: true, opacity: 0.45 }))
  fill.add(edges)
  fill.position.set(x + w / 2, (y0 + y1) / 2, depth / 2)
  g.add(fill)
  g.userData.ghost = true
  parent.add(g)
  ctx.ghosts.push(g)
  return g
}

/* ───────────── нижний ряд ───────────── */

const BASE_DIMS: Record<BaseFront, DimsKind> = {
  doors: 'base',
  drawers2: 'drawers',
  drawers3: 'drawers',
  drawers4: 'drawers',
  mix: 'drawers',
  open: 'openBase',
}

function baseModule(ctx: Ctx, run: Run, m: Module, i: number): THREE.Group {
  const { mats, style, input } = ctx
  const g = new THREE.Group()
  const w = cm(m.w)
  g.position.x = cm(m.x)
  const frontTop = style.handle === 'gola' ? BODY_TOP - 0.04 : BODY_TOP - GAP
  const frontY = PLINTH + GAP
  const z = CARCASS_D

  const shelf = PLINTH + BODY * 0.5
  const box3 = (shelves: number[] = []) => carcass(ctx, g, w, PLINTH, BODY_TOP, CARCASS_D, { shelves })
  const plinth = () => {
    g.add(slab(mats.plinth, 0, 0, CARCASS_D - 0.065, w, PLINTH, CARCASS_D - 0.05))
    ctx.plinth += m.w
  }

  const BASE_H = (PLINTH + BODY) * 100
  const D = (CARCASS_D + FRONT_T) * 100
  const DIMS: Partial<Record<Module['kind'], DimsKind>> = {
    doors: 'base',
    drawers: 'drawers',
    sink: 'sinkBase',
    hob: 'hobBase',
    corner: 'corner',
    bottle: 'bottle',
    filler: 'filler',
  }

  // Свои фасады: шкаф с дверцами или ящиками, а под плитой без духовки — тоже.
  const ovenUnderHob = m.kind === 'hob' && m.oven && input.items.oven !== null
  // Свой шкаф покупателя (k1…) узнаём по имени, у остальных ключ — ряд и начало.
  const own = Boolean(m.item && isCabinet(m.item))
  const editable = (m.kind === 'doors' || m.kind === 'drawers' || (m.kind === 'hob' && !ovenUnderHob)) && (m.w >= MIN_EDIT_W || own)
  const key = own ? (m.item as string) : baseKey(run.id, m.x)
  const auto: BaseFront = m.kind === 'doors' ? 'doors' : 'drawers3'
  const variant: BaseFront = editable ? ((own ? m.front : (input.fronts[key] as BaseFront | undefined)) ?? auto) : auto
  if (editable) g.userData.cab = { key, row: 'base', variant } satisfies CabInfo

  const dk = editable && m.kind !== 'hob' ? BASE_DIMS[variant] : DIMS[m.kind]
  if (dk) dims(g, dk, m.w, BASE_H, D)

  /** Шкаф с фасадами по выбору покупателя. */
  const fitted = () => {
    plinth()
    switch (variant) {
      case 'doors':
        box3([shelf])
        doorsIn(ctx, g, 0, frontY, frontTop, z, w, false, i)
        break
      case 'mix': {
        box3([PLINTH + BODY * 0.42])
        const below = drawersIn(ctx, g, 0, frontY, frontTop, z, w, DRAWER_PARTS.mix)
        doorsIn(ctx, g, 0, frontY, below - GAP / 2, z, w, false, i)
        break
      }
      case 'open': {
        // Открытые полки: короб без дверец, на полках — посуда.
        const shelves = [PLINTH + BODY * 0.36, PLINTH + BODY * 0.68]
        box3(shelves)
        for (const y of [PLINTH + PANEL_T, ...shelves]) dishes(ctx, g, 0.03, w - 0.03, y + PANEL_T / 2, CARCASS_D)
        break
      }
      default:
        box3()
        drawersIn(ctx, g, 0, frontY, frontTop, z, w, DRAWER_PARTS[variant])
    }
  }

  switch (m.kind) {
    case 'doors':
    case 'drawers':
      fitted()
      break
    case 'sink': {
      // Под мойкой полки нет: там сифон и мусорное ведро.
      box3()
      plinth()
      doorsIn(ctx, g, 0, frontY, frontTop, z, w, false, i)
      g.add(mesh(new THREE.CylinderGeometry(0.12, 0.11, 0.3, 24), mats.plain('#8f969c', 0.5), w / 2, PLINTH + 0.17, 0.3, false))
      break
    }
    case 'bottle':
      box3()
      plinth()
      addFront(ctx, g, { x: GAP / 2, y: frontY, z, w: w - GAP, h: frontTop - frontY, hinge: 'drawer' })
      break
    case 'filler':
      g.add(slab(mats.facade, 0, PLINTH, 0, w, BODY_TOP, CARCASS_D))
      plinth()
      addFront(ctx, g, { x: GAP / 2, y: frontY, z, w: w - GAP, h: frontTop - frontY, hinge: 'none', kind: 'slab' })
      break
    case 'corner': {
      box3([shelf])
      plinth()
      const blind = cm(m.blind ?? 60) + 0.03
      const x0 = m.blindAt === 'end' ? 0 : blind
      const x1 = m.blindAt === 'end' ? w - blind : w
      // планка у соседнего ряда, чтобы дверца не упиралась в его ручки
      g.add(slab(mats.facade, m.blindAt === 'end' ? x1 : x0 - 0.03, frontY, z, m.blindAt === 'end' ? x1 + 0.03 : x0, frontTop, z + FRONT_T))
      doorsIn(ctx, g, x0, frontY, frontTop, z, x1 - x0, false, i)
      break
    }
    case 'hob':
    case 'oven': {
      // Духовка под столешницей: под плитой или в своём шкафу; снизу — ящик.
      if (ovenUnderHob || (m.kind === 'oven' && input.items.oven !== null)) {
        box3()
        plinth()
        if (m.kind === 'oven') dims(g, 'ovenBase', m.w, BASE_H, D)
        const app = input.items.oven ?? undefined
        const ow = cm(app?.w ?? 59.5)
        const oh = cm(app?.h ?? 59.5)
        const oy = BODY_TOP - 0.025 - oh
        const oven = A.oven(app, mats, app?.image ? input.photos.get(app.image) : null)
        oven.position.set((w - ow) / 2, oy, z - 0.002)
        applianceDims(oven, app, 'oven', [59.5, 59.5, 56])
        if (app) {
          tag(oven, 'oven')
          ctx.objects.oven = oven
          anchor(ctx, 'oven', g, w / 2, oy + oh * 0.5, z + 0.04)
        }
        g.add(oven)
        addFront(ctx, g, { x: GAP / 2, y: frontY, z, w: w - GAP, h: oy - GAP - frontY, hinge: 'drawer' })
      } else {
        fitted()
      }
      break
    }
    case 'dishwasher': {
      const app = input.items.dishwasher
      if (!app) break
      if (app.builtIn) {
        // Встраиваемая: за фасадом мебели — настоящая машина с корзинами.
        carcass(ctx, g, w, PLINTH, BODY_TOP, CARCASS_D, { back: false, bottom: false })
        plinth()
        const inside = A.dishwasherInside(mats, w - 0.032, BODY_TOP - PLINTH - 0.02, CARCASS_D - 0.02)
        inside.position.set(0.016, PLINTH + 0.01, 0)
        g.add(inside)
        const door = addFront(ctx, g, { x: GAP / 2, y: frontY, z, w: w - GAP, h: frontTop - frontY, hinge: 'fold' })
        door.add(slab(mats.tub, 0.02, 0.02, -0.004, w - GAP - 0.02, frontTop - frontY - 0.05, 0))
        const whole = new THREE.Group()
        whole.add(inside, door)
        applianceDims(whole, app, 'dishwasher', [60, 82, 55])
        g.add(whole)
        tag(whole, 'dishwasher')
        ctx.objects.dishwasher = door
      } else {
        const dw = A.underCounter(app, mats, BODY_TOP - 0.004)
        applianceDims(dw, app, 'dishwasher', [60, 82, 55])
        dw.position.set((w - cm(app.w)) / 2, 0, CARCASS_D + FRONT_T - cm(Math.min(app.d, 60)))
        tag(dw, 'dishwasher')
        ctx.objects.dishwasher = dw
        g.add(dw)
      }
      anchor(ctx, 'dishwasher', g, w / 2, BODY_TOP * 0.62, z + 0.04)
      break
    }
    case 'washer': {
      const app = input.items.washer
      if (!app) break
      const wm = A.underCounter(app, mats, BODY_TOP - 0.004, app.image ? input.photos.get(app.image) : null)
      applianceDims(wm, app, 'washer', [60, 85, 50])
      wm.position.set((w - cm(app.w)) / 2, 0, CARCASS_D + FRONT_T - cm(Math.min(app.d, 60)))
      tag(wm, 'washer')
      ctx.objects.washer = wm
      g.add(wm)
      anchor(ctx, 'washer', g, w / 2, BODY_TOP * 0.62, z + 0.04)
      break
    }
    case 'fridge': {
      const app = input.items.fridge
      if (!app) break
      // Ниша: боковины от пола до верха пеналов, сверху — антресоль.
      const niche = run.uppers.some((u) => u.kind === 'fridge' && Math.abs(u.x - m.x) < 0.5)
      if (niche) {
        const sides = new THREE.Group()
        const nd = CARCASS_D + FRONT_T
        sides.add(slab(mats.facade, 0, 0, 0, PANEL_T, ctx.columnTop, nd))
        sides.add(slab(mats.facade, w - PANEL_T, 0, 0, w, ctx.columnTop, nd))
        dims(sides, 'panel', PANEL_T * 100, ctx.columnTop * 100, nd * 100)
        g.add(sides)
        ctx.nichePanels.push({ h: ctx.columnTop * 100, d: nd * 100, count: 2 })
      }
      const fr = A.fridge(app, mats, app.image ? input.photos.get(app.image) : null)
      applianceDims(fr, app, 'fridge', [60, 185, 65])
      fr.position.set((w - cm(app.w)) / 2, 0, 0.03)
      tag(fr, 'fridge')
      ctx.objects.fridge = fr
      g.add(fr)
      anchor(ctx, 'fridge', g, w / 2, cm(app.h) * 0.62, 0.03 + cm(app.d) + 0.03)
      break
    }
    case 'tall': {
      const top = ctx.columnTop
      carcass(ctx, g, w, PLINTH, top, CARCASS_D, { top: true, shelves: [PLINTH + 0.3, 0.83 - 0.01, top - 0.2] })
      plinth()
      dims(g, 'tall', m.w, top * 100, D)
      const ovenApp = input.items.oven ?? undefined
      const mwApp = input.items.microwave ?? undefined
      const ovenY = 0.83
      const oh = cm(ovenApp?.h ?? 59.5)
      const mh = cm(mwApp?.h ?? 38.5)
      const mwY = ovenY + oh + 0.012
      addFront(ctx, g, { x: GAP / 2, y: frontY, z, w: w - GAP, h: ovenY - GAP - frontY, hinge: i % 2 ? 'right' : 'left' })
      // духовка в пенале — если её не поставили в свой шкаф
      const ovenHere = m.oven !== false && input.items.oven !== null
      if (!ovenHere) {
        addFront(ctx, g, { x: GAP / 2, y: ovenY, z, w: w - GAP, h: oh, hinge: i % 2 ? 'right' : 'left' })
      }
      const oven = A.oven(ovenApp, mats, ovenApp?.image ? input.photos.get(ovenApp.image) : null)
      oven.position.set((w - cm(ovenApp?.w ?? 59.5)) / 2, ovenY, z - 0.002)
      applianceDims(oven, ovenApp, 'oven', [59.5, 59.5, 56])
      if (ovenHere) g.add(oven)
      if (ovenApp && ovenHere) {
        tag(oven, 'oven')
        ctx.objects.oven = oven
        anchor(ctx, 'oven', g, w / 2, ovenY + oh / 2, z + 0.04)
      }
      // Микроволновка — если выбрана встраиваемая; иначе над духовкой просто шкаф.
      if (mwApp) {
        const mw = A.microwave(mwApp, mats, mwApp.image ? input.photos.get(mwApp.image) : null)
        mw.position.set((w - cm(mwApp.w)) / 2, mwY, z - 0.002)
        applianceDims(mw, mwApp, 'microwave', [59.5, 38.5, 32])
        g.add(mw)
        tag(mw, 'microwave')
        ctx.objects.microwave = mw
        anchor(ctx, 'microwave', g, w / 2, mwY + mh / 2, z + 0.04)
      }
      const topY = mwApp ? mwY + mh + 0.012 : ovenY + oh + 0.012
      if (top - topY > 0.08) addFront(ctx, g, { x: GAP / 2, y: topY, z, w: w - GAP, h: top - topY - GAP, hinge: 'top' })
      break
    }
    case 'pantry': {
      // Пенал для хранения: две дверцы, внутри полки с банками и коробками.
      const top = ctx.columnTop
      const shelves = [PLINTH + 0.36, 0.74, 1.1, 1.46, 1.82, 2.18, 2.54].filter((y) => y < top - 0.16)
      carcass(ctx, g, w, PLINTH, top, CARCASS_D, { top: true, shelves })
      plinth()
      dims(g, 'pantry', m.w, top * 100, D)
      const split = Math.min(top - 0.4, 1.46)
      const hinge = i % 2 ? 'right' : 'left'
      addFront(ctx, g, { x: GAP / 2, y: frontY, z, w: w - GAP, h: split - GAP - frontY, hinge })
      addFront(ctx, g, { x: GAP / 2, y: split, z, w: w - GAP, h: top - split - GAP, hinge })
      pantryGoods(ctx, g, w, shelves.filter((y) => y < 2))
      break
    }
  }
  if (m.item) tagItem(g, m.item)
  return g
}

/** Продукты в пенале: банки с крупами и коробки. */
function pantryGoods(ctx: Ctx, g: THREE.Object3D, w: number, shelves: number[]) {
  const jars: THREE.BufferGeometry[] = []
  const boxes: THREE.BufferGeometry[] = []
  shelves.forEach((y, row) => {
    let x = 0.05 + (row % 2) * 0.03
    let k = row
    while (x < w - 0.1) {
      if (k++ % 2 === 0) {
        const h = 0.14 + (k % 3) * 0.03
        jars.push(new THREE.CylinderGeometry(0.04, 0.04, h, 18).translate(x + 0.04, y + 0.009 + h / 2, 0.3))
        x += 0.1
      } else {
        const h = 0.2 + (k % 2) * 0.06
        boxes.push(new THREE.BoxGeometry(0.07, h, 0.2).translate(x + 0.035, y + 0.009 + h / 2, 0.3))
        x += 0.1
      }
    }
  })
  if (jars.length) g.add(mesh(mergeAll(jars), ctx.mats.glass, 0, 0, 0, false))
  if (boxes.length) g.add(mesh(mergeAll(boxes), ctx.mats.plain('#c9a77c', 0.7), 0, 0, 0, false))
}

/** Отрезки ряда, закрытые столешницей (без холодильника и пенала). */
function counterSpans(run: Run): [number, number][] {
  const spans: [number, number][] = []
  for (const m of run.modules) {
    if (m.kind === 'fridge' || m.kind === 'tall' || m.kind === 'pantry') continue
    const last = spans[spans.length - 1]
    if (last && Math.abs(last[1] - m.x) < 0.5) last[1] = m.x + m.w
    else spans.push([m.x, m.x + m.w])
  }
  // Ряд у боковой стены упирается в столешницу задней стены — отступаем 2 см.
  const edge = (TOP_D - CARCASS_D - FRONT_T + 0.002) * 100
  for (const s of spans) {
    if (run.id === 'B' && Math.abs(s[1] - (run.length - 60)) < 0.5) s[1] = run.length - 60 - edge
    if (run.id === 'C' && Math.abs(s[0] - 60) < 0.5) s[0] = 60 + edge
  }
  return spans.map(([a, b]) => [cm(a), cm(b)])
}

function countertop(ctx: Ctx, run: Run, g: THREE.Group) {
  const { mats, counterY, style } = ctx
  const t = cm(style.topCm)
  const zBack = run.id === 'I' ? -0.3 : 0
  const y0 = counterY - t
  const sink = run.modules.find((m) => m.kind === 'sink')
  const hobM = run.modules.find((m) => m.kind === 'hob')
  for (const [x0, x1] of counterSpans(run)) {
    const sx0 = sink ? cm(sink.x) + 0.07 : Infinity
    const sx1 = sink ? cm(sink.x + sink.w) - 0.07 : -Infinity
    const inside = Boolean(sink) && sx0 >= x0 && sx1 <= x1
    const hobInside = Boolean(hobM) && ctx.input.items.hob !== null && cm(hobM!.x) >= x0 - 0.001 && cm(hobM!.x + hobM!.w) <= x1 + 0.001
    ctx.tops.push({ x0: x0 * 100, x1: x1 * 100, depth: (TOP_D - zBack) * 100, thick: style.topCm, sink: inside, hob: hobInside })
    // Столешница одним куском: по нажатию — её длина, толщина и глубина.
    const piece = new THREE.Group()
    dims(piece, run.id === 'I' ? 'island' : 'top', (x1 - x0) * 100, style.topCm, (TOP_D - zBack) * 100)
    g.add(piece)
    if (!inside) {
      piece.add(slab(mats.top, x0, y0, zBack, x1, counterY, TOP_D, true))
      continue
    }
    const bz0 = 0.1
    const bz1 = 0.5
    piece.add(slab(mats.top, x0, y0, zBack, sx0, counterY, TOP_D, true))
    piece.add(slab(mats.top, sx1, y0, zBack, x1, counterY, TOP_D, true))
    piece.add(slab(mats.top, sx0, y0, zBack, sx1, counterY, bz0))
    piece.add(slab(mats.top, sx0, y0, bz1, sx1, counterY, TOP_D))
    const sinkParts = new THREE.Group()
    sinkParts.add(A.sinkBowl(mats, sx0, sx1, bz0, bz1, counterY, style.sink !== 'black'))
    sinkParts.add(A.faucet(mats.faucet, (sx0 + sx1) / 2, counterY, 0.035))
    dims(sinkParts, 'sink', (sx1 - sx0) * 100, 19, (bz1 - bz0) * 100)
    tagItem(sinkParts, 'sink')
    g.add(sinkParts)
  }
  if (hobM && ctx.input.items.hob !== null) {
    const app = ctx.input.items.hob ?? undefined
    const hb = A.hob(app, mats)
    const hw = cm(app?.w ?? 59)
    hb.position.set(cm(hobM.x) + (cm(hobM.w) - hw) / 2, counterY, 0.05)
    tag(hb, 'hob')
    tagItem(hb, 'hob')
    applianceDims(hb, app, 'hob', [59, 5, 52])
    ctx.objects.hob = hb
    g.add(hb)
    anchor(ctx, 'hob', g, cm(hobM.x + hobM.w / 2), counterY + 0.04, 0.36)
  }
}

/** Фартук: от столешницы до верхних шкафов, за вытяжкой — выше. */
function backsplash(ctx: Ctx, run: Run, g: THREE.Group) {
  const { mats, style, counterY, input } = ctx
  // кирпич — это вся стена целиком; «без фартука» — только краска стены
  if (style.splash === 'brick' || style.splash === 'paint') return
  const hood = input.items.hood
  const tall = hood && (hood.hood === 'chimney' || hood.hood === 'inclined')
  const plan = input.plan
  const win = run.id === 'A' && plan.window?.wall === 'back' ? plan.window : null
  const pieces: { x0: number; x1: number; top: number }[] = []
  const w0 = win ? win.at - win.w / 2 : Infinity
  const w1 = win ? win.at + win.w / 2 : -Infinity
  const push = (x0: number, x1: number) => {
    if (x1 - x0 < 0.5) return
    const mid = (x0 + x1) / 2
    const up = run.uppers.find((u) => u.x <= mid && u.x + u.w >= mid)
    let top = UPPER_BOTTOM
    if (up?.kind === 'hood' && tall) top = ctx.upperTop
    if (mid > w0 && mid < w1) top = WINDOW.backSill
    const last = pieces[pieces.length - 1]
    if (last && Math.abs(last.x1 - cm(x0)) < 0.005 && Math.abs(last.top - top) < 0.001) last.x1 = cm(x1)
    else pieces.push({ x0: cm(x0), x1: cm(x1), top })
  }
  for (const m of run.modules) {
    if (m.kind === 'fridge' || m.kind === 'tall' || m.kind === 'pantry') continue
    // Окно режет фартук: под окном он доходит только до подоконника.
    const cuts = [m.x, Math.min(Math.max(w0, m.x), m.x + m.w), Math.min(Math.max(w1, m.x), m.x + m.w), m.x + m.w]
    for (let k = 0; k < 3; k++) push(cuts[k], cuts[k + 1])
  }
  for (const p of pieces) {
    g.add(slab(mats.splash, p.x0, counterY, 0, p.x1, p.top, 0.008))
    ctx.splash += (p.x1 - p.x0) * (p.top - counterY)
  }
}

/* ───────────── верхний ряд ───────────── */

function uppers(ctx: Ctx, run: Run, g: THREE.Group) {
  const { mats, style, input, upperTop } = ctx
  const UB = UPPER_BOTTOM
  const corniceMat = mats.upper
  // Карниз закрывает верх шкафа до стены и выступает вперёд профилем.
  // До потолка карниза нет: шкафы упираются в потолок.
  const addCornice = (x0: number, x1: number, zFront: number, top = upperTop) => {
    if (style.cornice === 'none' || input.room.toCeiling) return
    if (style.cornice === 'simple') {
      g.add(slab(corniceMat, x0, top, 0, x1, top + 0.05, zFront + 0.022))
      return
    }
    g.add(slab(corniceMat, x0, top, 0, x1, top + 0.085, zFront - 0.01))
    const c = cornice('crown', x1 - x0, corniceMat)
    c.position.set(x0, top, zFront - 0.012)
    g.add(c)
  }
  // Второй ряд до потолка: подъёмные дверцы над каждым шкафом.
  const mezzanine = (x: number, w: number) => {
    const mz = ctx.mezz
    if (!mz || w < 0.1) return
    const cab = new THREE.Group()
    cab.position.x = x
    carcass(ctx, cab, w, mz.from, mz.to, UPPER_D, { top: true, sides: mats.upper })
    liftsIn(ctx, cab, 0, mz.from + GAP / 2, mz.to - GAP / 2, UPPER_D, w)
    dims(cab, 'antresol', w * 100, (mz.to - mz.from) * 100, (UPPER_D + FRONT_T) * 100)
    g.add(cab)
  }
  // Витрины (классика и неоклассика): по бокам окна, а если окна на стене
  // нет — крайний шкаф со стороны комнаты.
  const vitrines = new Set<number>()
  if (style.vitrine !== 'none') {
    const fits = (i: number) => {
      const u = run.uppers[i]
      return Boolean(u && u.kind === 'doors' && u.w >= 30 && u.w <= 100)
    }
    // ближайший полноценный шкаф по ту сторону окна (узкие обрезки пропускаем)
    const nearest = (from: number, step: 1 | -1) => {
      for (let j = from; j >= 0 && j < run.uppers.length; j += step) {
        const u = run.uppers[j]
        if (u.kind === 'none') continue
        if (fits(j)) return j
        if (u.kind !== 'doors' || u.w >= 30) return -1
      }
      return -1
    }
    const win = input.plan.window
    const winIdx = win && run.id === 'A' && win.wall === 'back' ? run.uppers.findIndex((u) => u.kind === 'none' && u.x < win.at && u.x + u.w > win.at) : -1
    if (winIdx >= 0) {
      for (const j of [nearest(winIdx - 1, -1), nearest(winIdx + 1, 1)]) if (j >= 0) vitrines.add(j)
    } else {
      const doors = run.uppers.map((_, i) => i).filter(fits)
      const end = run.id === 'B' ? doors[0] : doors[doors.length - 1]
      if (doors.length >= 2 && end !== undefined) vitrines.add(end)
    }
  }
  run.uppers.forEach((u, i) => {
    const x = cm(u.x)
    const w = cm(u.w)
    if (w <= 0.001) return
    const zf = UPPER_D
    const editable = (u.kind === 'doors' || u.kind === 'shelf') && u.w >= MIN_EDIT_W
    const key = upperKey(run.id, u.x)
    const auto: UpperFront = u.kind === 'shelf' ? 'open' : vitrines.has(i) ? 'glass' : 'doors'
    const variant: UpperFront = editable ? ((input.fronts[key] as UpperFront | undefined) ?? auto) : auto
    const mark = (obj: THREE.Object3D) => {
      if (editable) obj.userData.cab = { key, row: 'upper', variant } satisfies CabInfo
    }

    const cabinet = (bottom: number, kind: 'doors' | 'glass' | 'lift') => {
      const glass = kind === 'glass'
      const h = upperTop - bottom
      const shelves = h > 0.8 ? [bottom + h / 3, bottom + (2 * h) / 3] : [bottom + h / 2]
      const cab = new THREE.Group()
      cab.position.x = x
      carcass(ctx, cab, w, bottom, upperTop, UPPER_D, { top: true, shelves, sides: mats.upper })
      if (glass || w >= 0.4) dishes(ctx, cab, 0.02, w - 0.02, shelves[0] + 0.008, UPPER_D)
      if (glass) {
        // подсветка витрины: днём незаметна, вечером светится
        const lamp = slab(mats.led, 0.03, upperTop - 0.025, 0.1, w - 0.03, upperTop - 0.018, 0.2)
        lamp.castShadow = false
        cab.add(lamp)
      }
      g.add(cab)
      if (kind === 'lift') liftsIn(ctx, cab, 0, bottom + GAP / 2, upperTop - GAP / 2, zf, w)
      else doorsIn(ctx, cab, 0, bottom + GAP / 2, upperTop - GAP / 2, zf, w, true, i, mats.upper, glass)
      dims(cab, glass ? 'vitrine' : kind === 'lift' ? 'lift' : 'upper', u.w, h * 100, (UPPER_D + FRONT_T) * 100)
      mark(cab)
      addCornice(x, x + w, zf + FRONT_T)
      // Классика: нижний карнизик под шкафами прячет подсветку.
      if (style.cornice !== 'none') g.add(slab(mats.upper, x, bottom - 0.022, zf - 0.02, x + w, bottom, zf + FRONT_T + 0.006))
      if (style.led) {
        const strip = slab(mats.led, x + 0.01, bottom - 0.004, 0.24, x + w - 0.01, bottom - 0.001, 0.27)
        strip.castShadow = false
        g.add(strip)
      }
    }

    const openShelves = () => {
      const shelfGroup = new THREE.Group()
      dims(shelfGroup, 'shelf', u.w - 2, 3, 26)
      for (const y of [UB + 0.14, UB + 0.52]) {
        shelfGroup.add(slab(mats.shelf, x + 0.01, y, 0, x + w - 0.01, y + 0.03, 0.26))
        decorShelf(ctx, shelfGroup, x + 0.01, x + w - 0.01, y + 0.03, i + y)
      }
      mark(shelfGroup)
      g.add(shelfGroup)
    }

    switch (u.kind) {
      case 'doors':
      case 'shelf': {
        if (variant === 'none') {
          const gh = ghost(ctx, g, x, UB, ctx.mezz?.to ?? upperTop, w, UPPER_D)
          dims(gh, 'upper', u.w, (upperTop - UB) * 100, (UPPER_D + FRONT_T) * 100)
          mark(gh)
          break
        }
        if (variant === 'open') openShelves()
        else cabinet(UB, variant)
        mezzanine(x, w)
        break
      }
      case 'hood': {
        const app = input.items.hood
        if (!app) {
          cabinet(UB, 'doors')
          mezzanine(x, w)
          break
        }
        const aw = cm(app.w)
        const hx = x + (w - aw) / 2
        if (app.hood === 'chimney' || app.hood === 'inclined') {
          const bottom = ctx.counterY + 0.68
          const hd = A.chimneyHood(app, mats, ctx.wallH - bottom - 0.07)
          hd.position.set(hx, bottom, 0)
          applianceDims(hd, app, 'hood', [60, 50, 50])
          tag(hd, 'hood')
          ctx.objects.hood = hd
          g.add(hd)
          anchor(ctx, 'hood', g, x + w / 2, bottom + 0.2, 0.5)
          break
        }
        // Встраиваемая вытяжка прячется в шкаф: снизу видна только планка.
        const lift = app.hood === 'telescopic' ? 0.045 : 0
        cabinet(UB + lift, 'doors')
        mezzanine(x, w)
        const strip = new THREE.Group()
        strip.add(slab(mats.appliance(app.finish), hx, UB - 0.005, 0.02, hx + aw, UB + lift, app.hood === 'telescopic' ? UPPER_D + 0.05 : UPPER_D - 0.01, true))
        tag(strip, 'hood')
        applianceDims(strip, app, 'hood', [60, 30, 30])
        ctx.objects.hood = strip
        g.add(strip)
        anchor(ctx, 'hood', g, x + w / 2, UB + 0.06, UPPER_D + 0.06)
        break
      }
      case 'fridge': {
        // Шкаф над холодильником — между боковинами ниши, до верха пеналов.
        const app = input.items.fridge
        const bottom = (app ? cm(app.h) : 1.85) + 0.05
        const top = ctx.columnTop
        if (top - bottom < 0.18) break
        const cw = w - 2 * PANEL_T
        const cab = new THREE.Group()
        cab.position.x = x + PANEL_T
        carcass(ctx, cab, cw, bottom, top, CARCASS_D, { top: true, sides: mats.upper })
        dims(cab, 'overFridge', cw * 100, (top - bottom) * 100, (CARCASS_D + FRONT_T) * 100)
        g.add(cab)
        liftsIn(ctx, cab, 0, bottom + GAP / 2, top - GAP / 2, CARCASS_D, cw)
        addCornice(x, x + w, CARCASS_D + FRONT_T, top)
        break
      }
      case 'none': {
        const m = run.modules.find((mod) => Math.abs(mod.x - u.x) < 0.5 && Math.abs(mod.w - u.w) < 0.5)
        if (m?.kind === 'tall' || m?.kind === 'pantry') addCornice(x, x + w, CARCASS_D + FRONT_T, ctx.columnTop)
        break
      }
    }
  })
}

/* ───────────── декор ───────────── */

function decorShelf(ctx: Ctx, g: THREE.Group, x0: number, x1: number, y: number, seed: number) {
  const { mats, style } = ctx
  const light = style.id === 'scandi'
  const ceramic = mats.plain(light ? '#f1efe9' : '#e7e2d8', 0.35)
  const dark = mats.plain(light ? '#cdbfae' : '#2f3032', 0.5)
  let x = x0 + 0.05 + (seed % 3) * 0.03
  let k = Math.floor(seed * 7) % 4
  while (x < x1 - 0.12) {
    const pick = k++ % 4
    if (pick === 0) {
      // стопка тарелок
      for (let j = 0; j < 4; j++) g.add(mesh(new THREE.CylinderGeometry(0.1, 0.085, 0.012, 32), ceramic, x + 0.1, y + 0.006 + j * 0.013, 0.13))
      x += 0.24
    } else if (pick === 1) {
      // банки
      for (let j = 0; j < 3; j++) {
        const h = 0.12 + j * 0.03
        g.add(mesh(new THREE.CylinderGeometry(0.035, 0.035, h, 20), mats.glass, x + j * 0.08, y + h / 2, 0.12))
        g.add(mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.02, 20), mats.shelf, x + j * 0.08, y + h + 0.01, 0.12))
      }
      x += 0.26
    } else if (pick === 2) {
      plant(ctx, g, x + 0.06, y, 0.13, 0.7)
      x += 0.18
    } else {
      g.add(mesh(new THREE.CylinderGeometry(0.045, 0.035, 0.1, 24), dark, x + 0.05, y + 0.05, 0.12))
      x += 0.14
    }
  }
}

function plant(ctx: Ctx, g: THREE.Group, x: number, y: number, z: number, scale = 1) {
  const pot = ctx.mats.plain('#d9d3c7', 0.7)
  const leaf = ctx.mats.plain('#4f6b43', 0.6)
  g.add(mesh(new THREE.CylinderGeometry(0.055 * scale, 0.045 * scale, 0.1 * scale, 20), pot, x, y + 0.05 * scale, z))
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2
    const l = mesh(new THREE.SphereGeometry(0.05 * scale, 10, 8), leaf, x + Math.cos(a) * 0.04 * scale, y + (0.14 + (i % 3) * 0.04) * scale, z + Math.sin(a) * 0.04 * scale)
    l.scale.set(0.5, 1.4, 0.25)
    l.rotation.set(Math.sin(a) * 0.5, a, Math.cos(a) * 0.5)
    g.add(l)
  }
}

/** Ваза с лимонами — фирменный цвет магазина прямо на столешнице. */
function lemons(ctx: Ctx, g: THREE.Group, x: number, y: number, z: number) {
  const bowl = new THREE.LatheGeometry(
    [new THREE.Vector2(0, 0), new THREE.Vector2(0.05, 0.002), new THREE.Vector2(0.11, 0.05), new THREE.Vector2(0.12, 0.07), new THREE.Vector2(0.114, 0.07), new THREE.Vector2(0.104, 0.052), new THREE.Vector2(0.045, 0.01), new THREE.Vector2(0, 0.008)],
    40,
  )
  g.add(mesh(bowl, ctx.mats.plain('#f4f2ee', 0.25), x, y, z))
  const peel = new THREE.MeshPhysicalMaterial({ color: '#e8d32a', roughness: 0.45, clearcoat: 0.4 })
  const spots: [number, number, number][] = [[-0.04, 0.05, 0], [0.04, 0.05, 0.02], [0, 0.055, -0.04], [0.005, 0.1, 0]]
  for (const [dx, dy, dz] of spots) {
    const l = mesh(new THREE.SphereGeometry(0.036, 20, 14), peel, x + dx, y + dy, z + dz)
    l.scale.set(1.25, 1, 1)
    l.rotation.y = dx * 20
    g.add(l)
  }
}

function decorRun(ctx: Ctx, run: Run, g: THREE.Group) {
  if (run.id === 'I') return
  let spot: Module | undefined
  if (!ctx.lemons) {
    spot = run.modules.find((m) => m.role === 'work' && m.w >= 45) ?? run.modules.find((m) => m.role === 'side' && m.w >= 40)
    if (spot) {
      lemons(ctx, g, cm(spot.x + spot.w / 2), ctx.counterY, 0.34)
      ctx.lemons = true
    }
  }
  props(ctx, run, g, spot)
}

/* ───────────── жизнь на кухне ───────────── */

const COUNTER: Module['kind'][] = ['doors', 'drawers', 'bottle', 'oven', 'hob', 'corner']

/**
 * Мелочи, без которых кухня выглядит выставочной: у плиты — доска и масло,
 * у мойки — чайник. Ставятся только на свободную столешницу, мимо вазы с
 * лимонами. Технику ничем не закрываем: её человек и выбирает.
 */
function props(ctx: Ctx, run: Run, g: THREE.Group, taken?: Module) {
  const { mats, counterY } = ctx
  const mods = run.modules
  const free = (i: number) => {
    const m = mods[i]
    return m && m !== taken && COUNTER.includes(m.kind) && m.kind !== 'hob' && m.w >= 30
  }
  const hi = mods.findIndex((m) => m.kind === 'hob')
  const si = mods.findIndex((m) => m.kind === 'sink')
  const done = ctx.props
  const wood = mats.shelf
  // Розетки на фартуке: белые, на тёмном фартуке — чёрные.
  const dark = new THREE.Color(ctx.style.splashColor).getHSL({ h: 0, s: 0, l: 0 }).l < 0.35
  const socketMat = mats.plain(dark ? '#1d1e20' : '#f3f3f1', 0.35)
  const holeMat = mats.plain(dark ? '#0c0c0d' : '#d6d6d3', 0.6)
  const socket = (x: number, y: number) => {
    const s2 = new THREE.Group()
    s2.add(mesh(rounded(0.158, 0.084, 0.011, 0.004), socketMat, 0, 0, 0))
    for (const dx of [-0.039, 0.039]) {
      const cup = mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.004, 28).rotateX(Math.PI / 2), holeMat, dx, 0, 0.005, false)
      s2.add(cup)
    }
    s2.position.set(x, y, 0.016)
    g.add(s2)
  }
  // у плиты: разделочная доска у фартука, бутылки масла и мельницы
  const nearHob = done.board ? undefined : [hi + 1, hi - 1].find((i) => hi >= 0 && free(i))
  if (nearHob !== undefined) {
    done.board = true
    const m = mods[nearHob]
    const cx = cm(m.x + m.w / 2)
    const board = new THREE.Group()
    board.add(mesh(rounded(0.3, 0.42, 0.018, 0.012), wood, 0, 0.21, 0))
    board.add(mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.02, 20).rotateX(Math.PI / 2), mats.plain('#1c1c1c', 0.6), 0, 0.37, 0.001))
    board.position.set(cx - 0.04, counterY, 0.05)
    board.rotation.x = -0.14
    g.add(board)
    const oil = new THREE.LatheGeometry(
      [new THREE.Vector2(0, 0), new THREE.Vector2(0.03, 0.002), new THREE.Vector2(0.032, 0.16), new THREE.Vector2(0.012, 0.2), new THREE.Vector2(0.011, 0.24), new THREE.Vector2(0, 0.24)],
      24,
    )
    const glass = new THREE.MeshPhysicalMaterial({ color: '#7d8a2c', roughness: 0.08, clearcoat: 1, transparent: true, opacity: 0.88 })
    g.add(mesh(oil, glass, cx + 0.12, counterY, 0.12))
    g.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.025, 12), mats.plain('#2b2b2b', 0.5), cx + 0.12, counterY + 0.252, 0.12))
    for (const [dx, color] of [[0.19, '#3a2b20'], [0.24, '#ece9e2']] as const) {
      g.add(mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.15, 20), mats.plain(color, 0.45), cx + dx, counterY + 0.075, 0.1))
      g.add(mesh(new THREE.SphereGeometry(0.02, 16, 10), mats.plain(color, 0.45), cx + dx, counterY + 0.155, 0.1))
    }
    if (m.w >= 45) socket(cx + 0.19, counterY + 0.34)
  }
  // у мойки — чайник
  const nearSink = done.kettle ? undefined : [si + 1, si - 1, si + 2, si - 2].find((i) => si >= 0 && free(i) && i !== nearHob)
  if (nearSink !== undefined) {
    done.kettle = true
    const m = mods[nearSink]
    const cx = cm(m.x + m.w / 2)
    const body = new THREE.LatheGeometry(
      [new THREE.Vector2(0, 0), new THREE.Vector2(0.09, 0.004), new THREE.Vector2(0.1, 0.05), new THREE.Vector2(0.085, 0.15), new THREE.Vector2(0.05, 0.19), new THREE.Vector2(0, 0.195)],
      40,
    )
    const shell = ctx.style.metal === 'black' || ctx.style.metal === 'gunmetal' ? mats.plain('#1f2022', 0.35, 0.3) : mats.metal('steel')
    const kettle = new THREE.Group()
    kettle.add(mesh(body, shell))
    kettle.add(mesh(new THREE.SphereGeometry(0.018, 16, 10), mats.plain('#1b1b1b', 0.5), 0, 0.2, 0))
    const handle = mesh(new THREE.TorusGeometry(0.075, 0.011, 10, 28, Math.PI), mats.plain('#1b1b1b', 0.5), 0, 0.12, 0)
    handle.rotation.z = Math.PI / 2
    handle.rotation.y = Math.PI / 2
    kettle.add(handle)
    const spout = mesh(new THREE.CylinderGeometry(0.012, 0.02, 0.1, 14), shell, 0.1, 0.12, 0)
    spout.rotation.z = -0.9
    kettle.add(spout)
    socket(cx - 0.12, counterY + 0.15)
    kettle.position.set(cx, counterY, 0.28)
    kettle.rotation.y = 0.5
    g.add(kettle)
  }
  // Полотенца на ручке духовки больше нет: плоский светлый прямоугольник
  // читался не как ткань, а как бумажка на стекле — и закрывал саму
  // духовку, то есть товар, ради которого человек собирает кухню.
}

/* ───────────── остров ───────────── */

function islandExtras(ctx: Ctx, run: Run, g: THREE.Group) {
  const { mats, counterY, style, input } = ctx
  const L = cm(run.length)
  // Плита на острове — вытяжка висит над ней с потолка.
  const hobM = run.modules.find((m) => m.kind === 'hob')
  let hoodX = -1
  if (hobM && input.items.hood && input.items.hob !== null) {
    const app = input.items.hood
    const aw = cm(app.w)
    const bottom = counterY + 0.7
    const hd = A.chimneyHood(app, mats, ctx.wallH - bottom - 0.07)
    hoodX = cm(hobM.x + hobM.w / 2)
    hd.position.set(hoodX - aw / 2, bottom, 0.05)
    applianceDims(hd, app, 'hood', [60, 50, 50])
    tag(hd, 'hood')
    ctx.objects.hood = hd
    const over = new THREE.Group()
    over.add(hd)
    ctx.overhead.push(over)
    g.add(over)
    anchor(ctx, 'hood', g, hoodX, bottom + 0.2, 0.55)
  }
  // задняя панель со стороны стульев
  g.add(slab(mats.facade, 0, 0, -0.02, L, counterY - cm(style.topCm), 0))
  const n = Math.max(2, Math.floor(L / 0.55))
  const seat = mats.plain(style.id === 'loft' ? '#6b4a33' : style.group === 'hitech' ? '#1d1e21' : '#d8cfc2', 0.6)
  const legs = mats.metal(style.metal === 'wood' ? 'black' : style.metal)
  for (let i = 0; i < n; i++) {
    const x = (L / n) * (i + 0.5)
    const s = new THREE.Group()
    s.add(mesh(new THREE.CylinderGeometry(0.19, 0.18, 0.05, 28), seat, 0, 0.67, 0))
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + Math.PI / 4
      const leg = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.67, 10), legs, Math.cos(a) * 0.12, 0.335, Math.sin(a) * 0.12)
      leg.rotation.set(Math.sin(a) * 0.1, 0, -Math.cos(a) * 0.1)
      s.add(leg)
    }
    s.add(mesh(new THREE.TorusGeometry(0.14, 0.008, 8, 32).rotateX(Math.PI / 2), legs, 0, 0.25, 0))
    s.position.set(x, 0, -0.5)
    g.add(s)
  }
  // подвесные светильники
  const lamps = Math.max(2, Math.round(L / 0.7))
  const over = new THREE.Group()
  ctx.overhead.push(over)
  g.add(over)
  for (let i = 0; i < lamps; i++) {
    const x = (L / lamps) * (i + 0.5)
    // над вытяжкой лампу не вешаем
    if (hoodX >= 0 && Math.abs(x - hoodX) < 0.45) continue
    pendant(ctx, over, x, counterY + 0.8, 0.15)
  }
  const glow = eveningLight(ctx, new THREE.PointLight('#ffd9a3', 5, 4, 1.5))
  glow.position.set(L / 2, counterY + 0.5, 0.15)
  g.add(glow)
}

function pendant(ctx: Ctx, g: THREE.Group, x: number, y: number, z: number) {
  const { mats, style } = ctx
  const cord = mats.plain('#1b1b1b', 0.6)
  g.add(mesh(new THREE.CylinderGeometry(0.003, 0.003, ctx.wallH - y, 6), cord, x, (ctx.wallH + y) / 2, z, false))
  const shadeMat =
    style.id === 'scandi'
      ? mats.plain('#f3f1ec', 0.5)
      : style.id === 'loft' || style.metal === 'black'
        ? mats.plain('#1e1f21', 0.5, 0.3)
        : style.metal === 'brass'
          ? mats.metal('brass')
          : mats.plain('#e9e9e6', 0.4)
  const shade = new THREE.LatheGeometry(
    [new THREE.Vector2(0.015, 0.2), new THREE.Vector2(0.03, 0.19), new THREE.Vector2(0.06, 0.12), new THREE.Vector2(0.15, 0.01), new THREE.Vector2(0.155, 0)],
    40,
  )
  const inside = shadeMat.clone()
  inside.side = THREE.DoubleSide
  g.add(mesh(shade, inside, x, y - 0.2, z))
  // светящийся рассеиватель в раскрыве абажура — виден снизу
  const glow = mesh(new THREE.CircleGeometry(0.12, 32), mats.led, x, y - 0.195, z, false)
  glow.rotation.x = Math.PI / 2
  g.add(glow)
}

/** Вечерний свет: в дневном режиме яркость 0 (без пересборки шейдеров). */
function eveningLight<L extends THREE.Light>(ctx: Ctx, light: L): L {
  light.userData.on = light.intensity
  light.intensity = 0
  ctx.eveningLights.push(light)
  return light
}

/* ───────────── комната ───────────── */

export const WINDOW = { backSill: 1.0, leftSill: 0.9, top: 2.3 }

function wallWithWindow(
  mat: THREE.Material[],
  axis: 'x' | 'z',
  from: number,
  to: number,
  fixed: [number, number],
  height: number,
  opening: { at: number; w: number; sill: number; top: number } | null,
): THREE.Mesh[] {
  const pieces: [number, number, number, number][] = [] // a0, a1, y0, y1
  if (!opening) pieces.push([from, to, 0, height])
  else {
    const o0 = opening.at - opening.w / 2
    const o1 = opening.at + opening.w / 2
    pieces.push([from, o0, 0, height], [o1, to, 0, height], [o0, o1, 0, opening.sill], [o0, o1, opening.top, height])
  }
  return pieces
    .filter(([a0, a1, y0, y1]) => a1 - a0 > 0.001 && y1 - y0 > 0.001)
    .map(([a0, a1, y0, y1]) => {
      const m =
        axis === 'x'
          ? mesh(box(a1 - a0, y1 - y0, fixed[1] - fixed[0]), mat, (a0 + a1) / 2, (y0 + y1) / 2, (fixed[0] + fixed[1]) / 2)
          : mesh(box(fixed[1] - fixed[0], y1 - y0, a1 - a0), mat, (fixed[0] + fixed[1]) / 2, (y0 + y1) / 2, (a0 + a1) / 2)
      return m
    })
}

function windowUnit(ctx: Ctx, axis: 'x' | 'z', at: number, w: number, sill: number, top: number): THREE.Group {
  // Рисуем окно в плоскости задней стены (x — вдоль, z — толщина), потом поворачиваем.
  const { mats } = ctx
  const g = new THREE.Group()
  const h = top - sill
  const p = 0.06
  const zf = -WALL_T / 2
  const f = (x0: number, y0: number, x1: number, y1: number) => g.add(slab(mats.trim, x0, y0, zf - 0.03, x1, y1, zf + 0.03))
  f(-w / 2, 0, -w / 2 + p, h)
  f(w / 2 - p, 0, w / 2, h)
  f(-w / 2, 0, w / 2, p)
  f(-w / 2, h - p, w / 2, h)
  // широкое окно — две створки и форточка, узкое — одна перемычка
  const mullions = w > 1.5 ? [-w / 6, w / 6] : [0]
  for (const mx of mullions) f(mx - 0.02, 0, mx + 0.02, h)
  const glass = mesh(new THREE.PlaneGeometry(w - 2 * p, h - 2 * p), mats.glass, 0, h / 2, zf, false)
  glass.castShadow = false
  g.add(glass)
  // подоконник
  g.add(slab(mats.trim, -w / 2 - 0.04, -0.03, zf, w / 2 + 0.04, 0, 0.05))
  // Небо — внутри проёма, у наружной грани стены: сверху его закрывает стена.
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mats.sky)
  sky.position.set(0, h / 2, -WALL_T + 0.004)
  g.add(sky)
  g.position.y = sill
  if (axis === 'x') g.position.x = at
  else {
    g.rotation.y = Math.PI / 2
    g.position.z = at
  }
  return g
}

function room(ctx: Ctx, root: THREE.Group) {
  const { mats, input } = ctx
  const plan = input.plan
  const H = ctx.wallH
  const W = cm(plan.room.w)
  const D = cm(plan.room.d)
  const u = plan.shape === 'u'
  const cap = mats.plain('#d6d2cb', 0.9)
  // пол
  const floorW = W + WALL_T + (u ? WALL_T : 0)
  const fl = mesh(box(floorW, 0.04, D + WALL_T), mats.floor, -WALL_T + floorW / 2, -0.02, (D - WALL_T) / 2, false)
  root.add(fl)
  // окно не выше потолка: при низком потолке верх окна опускается
  const winTop = Math.min(WINDOW.top, H - 0.25)
  // задняя стена: лицевая грань (+z) — фактурная, верх — «срез»
  const backMats = [mats.wall, mats.wall, cap, mats.wall, mats.featureWall, mats.wall]
  const win = plan.window
  const back = wallWithWindow(
    backMats,
    'x',
    -WALL_T,
    W + (u ? WALL_T : 0),
    [-WALL_T, 0],
    H,
    win?.wall === 'back' ? { at: cm(win.at), w: cm(win.w), sill: WINDOW.backSill, top: winTop } : null,
  )
  back.forEach((m) => root.add(m))
  if (win?.wall === 'back') {
    const wu = windowUnit(ctx, 'x', cm(win.at), cm(win.w), WINDOW.backSill, winTop)
    root.add(wu)
  }
  // левая стена: лицевая грань (+x)
  const leftMats = [mats.wall, mats.wall, cap, mats.wall, mats.wall, mats.wall]
  const left = wallWithWindow(
    leftMats,
    'z',
    0,
    D,
    [-WALL_T, 0],
    H,
    win?.wall === 'left' ? { at: cm(win.at), w: cm(win.w), sill: WINDOW.leftSill, top: winTop } : null,
  )
  left.forEach((m) => root.add(m))
  if (win?.wall === 'left') {
    const wu = windowUnit(ctx, 'z', cm(win.at), cm(win.w), WINDOW.leftSill, winTop)
    root.add(wu)
    plant(ctx, root, 0.12, WINDOW.leftSill, cm(win.at) + 0.2)
  }
  if (u) {
    const right = wallWithWindow(leftMats, 'z', 0, D, [W, W + WALL_T], H, null)
    right.forEach((m) => root.add(m))
  } else {
    // Правая стена видна только изнутри (вид «как в жизни»): снаружи, с
    // обзорной камеры, она прозрачна и не заслоняет кухню.
    const inner = new THREE.Mesh(new THREE.PlaneGeometry(D, H), mats.wall)
    inner.rotation.y = -Math.PI / 2
    inner.position.set(W, H / 2, D / 2)
    inner.receiveShadow = true
    root.add(inner)
  }
  // Потолок — плоскость лицом вниз: видна только изнутри, с высоты глаз.
  // Сверху (обзорный вид) её нет, и комната остаётся открытой.
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(floorW, D + WALL_T), mats.ceiling)
  ceil.rotation.x = Math.PI / 2
  ceil.position.set(-WALL_T + floorW / 2, H - 0.001, (D - WALL_T) / 2)
  ceil.castShadow = true
  ceil.layers.set(CEILING_LAYER)
  root.add(ceil)
  for (const [x, z] of [[W * 0.25, 1.1], [W * 0.75, 1.1], [W * 0.5, D * 0.7]]) {
    // светильник тоже виден только снизу: плоское кольцо и рассеиватель лицом вниз
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.04, 0.058, 40), mats.trim)
    ring.rotation.x = Math.PI / 2
    ring.position.set(x, H - 0.003, z)
    ring.layers.set(CEILING_LAYER)
    const lamp = new THREE.Mesh(new THREE.CircleGeometry(0.04, 32), mats.led)
    lamp.rotation.x = Math.PI / 2
    lamp.position.set(x, H - 0.009, z)
    lamp.layers.set(CEILING_LAYER)
    root.add(ring, lamp)
  }
  // Плинтус у пола — мелочь, без которой комната выглядит нарисованной.
  const skirt = ctx.style.id === 'loft' ? mats.plain('#2a2b2d', 0.5) : mats.plain('#f2f0ec', 0.45)
  root.add(slab(skirt, 0, 0, 0, W, 0.08, 0.014))
  root.add(slab(skirt, 0, 0, 0.014, 0.014, 0.08, D))
  if (u) root.add(slab(skirt, W - 0.014, 0, 0.014, W, 0.08, D))
}

/* ───────────── сборка ───────────── */

/** Высоты шкафов: обычные или до потолка с антресолями. */
function heights(input: BuildInput) {
  const wallH = cm(input.room.ceiling)
  const ceil = wallH - 0.004
  const main = UPPER_BOTTOM + cm(input.style.upperCm)
  let upperTop = main
  let mezz: Ctx['mezz'] = null
  if (input.room.toCeiling) {
    // Щель под потолком меньше 25 см — просто высокие шкафы в один ряд.
    if (ceil - main < 0.25) upperTop = ceil
    else mezz = { from: main, to: ceil }
  }
  let columnTop = input.room.toCeiling ? ceil : Math.min(upperTop, ceil)
  // Высокому холодильнику нужна антресоль хотя бы 30 см — пеналы растут вместе с ней.
  const fridge = input.items.fridge
  const niche = input.plan.runs.some((r) => r.uppers.some((u) => u.kind === 'fridge'))
  if (fridge && niche && !input.room.toCeiling) columnTop = Math.min(ceil, Math.max(columnTop, cm(fridge.h) + 0.05 + 0.3))
  return { wallH, upperTop, mezz, columnTop }
}

export function buildKitchen(input: BuildInput): Built {
  const prev = T.detail(input.detail ?? 2)
  try {
    return assemble(input)
  } finally {
    T.detail(prev)
  }
}

function assemble(input: BuildInput): Built {
  const mats = createMaterials(input.style, input.tone, input.evening, { floor: input.room.floor, wall: input.room.wall }, input.finish)
  const counterY = BODY_TOP + cm(input.style.topCm)
  const h = heights(input)
  const ctx: Ctx = {
    mats,
    style: input.style,
    input,
    counterY,
    upperTop: h.upperTop,
    mezz: h.mezz,
    columnTop: h.columnTop,
    wallH: h.wallH,
    anims: [],
    objects: {},
    anchorsLocal: [],
    eveningLights: [],
    overhead: [],
    ghosts: [],
    wave: 0,
    lemons: false,
    props: { board: false, kettle: false },
    uvRun: 0,
    carcasses: [],
    nichePanels: [],
    plinth: 0,
    gola: 0,
    splash: 0,
    tops: [],
  }
  const root = new THREE.Group()
  room(ctx, root)

  const specRuns: SpecRun[] = []
  input.plan.runs.forEach((run, ri) => {
    const g = new THREE.Group()
    g.position.set(cm(run.ox), 0, cm(run.oz))
    g.rotation.y = run.rot
    ctx.uvRun = ri * 3.7
    ctx.tops = []
    run.modules.forEach((m, i) => g.add(baseModule(ctx, run, m, i)))
    countertop(ctx, run, g)
    if (run.wall) {
      backsplash(ctx, run, g)
      const over = new THREE.Group()
      ctx.overhead.push(over)
      g.add(over)
      uppers(ctx, run, over)
      if (ctx.style.handle === 'gola') golaChannel(ctx, run, g)
      if (ctx.style.led) underLight(ctx, run, g)
    } else {
      islandExtras(ctx, run, g)
    }
    decorRun(ctx, run, g)
    root.add(g)
    specRuns.push(collectRun(ctx, run, g))
  })

  // Потолочные споты для вечера.
  const W = cm(input.plan.room.w)
  const D = cm(input.plan.room.d)
  for (const [x, z] of [[W * 0.25, 1.1], [W * 0.75, 1.1], [W * 0.5, D * 0.7]]) {
    // мягкие широкие пятна — без «прожектора» на фасадах
    const spot = eveningLight(ctx, new THREE.SpotLight('#ffe3bd', 4, 6, 1.0, 0.95, 1.4))
    spot.position.set(x, ctx.wallH - 0.05, z)
    spot.target.position.set(x, 0, z - 0.3)
    root.add(spot, spot.target)
  }

  root.updateMatrixWorld(true)
  const anchors: Built['anchors'] = {}
  for (const a of ctx.anchorsLocal) anchors[a.slot] = a.obj.localToWorld(a.at.clone())
  const bounds = new THREE.Box3().setFromObject(root)

  const spec: SpecData = {
    runs: specRuns,
    carcasses: ctx.carcasses,
    panels: ctx.nichePanels,
    plinth: ctx.plinth,
    gola: ctx.gola,
    splash: Math.round(ctx.splash * 100) / 100,
    heights: {
      plinth: PLINTH * 100,
      counter: Math.round(counterY * 1000) / 10,
      upperBottom: UPPER_BOTTOM * 100,
      upperTop: Math.round(ctx.upperTop * 1000) / 10,
      mezzTop: ctx.mezz ? Math.round(ctx.mezz.to * 1000) / 10 : null,
      ceiling: input.room.ceiling,
    },
  }

  return {
    root,
    anchors,
    objects: ctx.objects,
    anims: ctx.anims,
    eveningLights: ctx.eveningLights,
    overhead: ctx.overhead,
    ghosts: ctx.ghosts,
    bounds,
    wallH: ctx.wallH,
    spec,
    dispose() {
      // Геометрию освобождаем, а материалы — нет: у освобождённого материала
      // видеокарта выбрасывает и его шейдер, и следующая кухня собирала бы
      // шейдеры заново (полсекунды на каждую смену цвета). Сами материалы
      // уберёт сборщик мусора, шейдеров же всего несколько десятков видов.
      root.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments) o.geometry.dispose()
        if (o instanceof THREE.Light) o.dispose()
      })
    },
  }
}

/**
 * Что нарисовано в ряду — для мебельщика: рамки предметов с размерами и
 * фасады, в сантиметрах вдоль ряда (слева направо, лицом к шкафам) и от пола.
 */
function collectRun(ctx: Ctx, run: Run, g: THREE.Group): SpecRun {
  g.updateMatrixWorld(true)
  const inv = g.matrixWorld.clone().invert()
  const boxes: SpecBox[] = []
  const fronts: SpecFront[] = []
  const v = new THREE.Vector3()
  const r1 = (n: number) => Math.round(n * 10) / 10
  g.traverse((o) => {
    const d = o.userData.dims as Dims | undefined
    if (d && o !== g && !o.userData.ghost) {
      const b = new THREE.Box3().setFromObject(o).applyMatrix4(inv)
      boxes.push({ ...d, x: r1(b.min.x * 100), y: r1(Math.max(0, b.min.y) * 100) })
    }
    const f = o.userData.front as Omit<SpecFront, 'x' | 'y'> | undefined
    if (f) {
      o.getWorldPosition(v).applyMatrix4(inv)
      fronts.push({ ...f, x: r1(v.x * 100), y: r1(v.y * 100) })
    }
  })
  const modules = run.modules.map((m) => ({ x: m.x, w: m.w }))
  return { id: run.id, length: run.length, modules, boxes, fronts, tops: ctx.tops }
}

/** Алюминиевый профиль вместо ручек (хай-тек). */
function golaChannel(ctx: Ctx, run: Run, g: THREE.Group) {
  const steel = ctx.mats.trimMetal
  for (const [x0, x1] of counterSpans(run)) {
    g.add(slab(steel, x0, BODY_TOP - 0.038, CARCASS_D - 0.03, x1, BODY_TOP - 0.004, CARCASS_D - 0.012))
    ctx.gola += (x1 - x0) * 100
  }
}

/** Подсветка рабочей зоны под верхними шкафами — горит вечером. */
function underLight(ctx: Ctx, run: Run, g: THREE.Group) {
  const spans = run.uppers.filter((u) => u.kind === 'doors')
  if (spans.length === 0) return
  const x0 = cm(Math.min(...spans.map((s) => s.x)))
  const x1 = cm(Math.max(...spans.map((s) => s.x + s.w)))
  const x = (x0 + x1) / 2
  const light = eveningLight(ctx, new THREE.SpotLight('#fff0d8', 6, 3, 1.35, 0.95, 1.2))
  light.position.set(x, UPPER_BOTTOM - 0.02, 0.18)
  light.target.position.set(x, ctx.counterY, 0.32)
  g.add(light, light.target)
}
