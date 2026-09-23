import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import type { DoorKind, HandleKind } from '@/lib/kitchen/styles'

/**
 * Детали мебели: короба, фасады, ручки, карниз. Единицы — метры.
 * У каждого фасада начало координат в левом нижнем заднем углу:
 * x ∈ [0, w], y ∈ [0, h], z ∈ [0, толщина]; лицевая сторона смотрит в +z.
 */

export const FRONT_T = 0.018
export const GAP = 0.003

/** UV в метрах: текстура ложится в реальном масштабе на любую грань. */
export function metersUV(geom: THREE.BufferGeometry, w: number, h: number, d: number) {
  const uv = geom.getAttribute('uv') as THREE.BufferAttribute
  const normal = geom.getAttribute('normal') as THREE.BufferAttribute
  for (let i = 0; i < uv.count; i++) {
    const nx = Math.abs(normal.getX(i))
    const ny = Math.abs(normal.getY(i))
    const nz = Math.abs(normal.getZ(i))
    let su = w
    let sv = h
    if (nx >= ny && nx >= nz) {
      su = d
      sv = h
    } else if (ny >= nx && ny >= nz) {
      su = w
      sv = d
    }
    uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv)
  }
  uv.needsUpdate = true
  return geom
}

export function box(w: number, h: number, d: number): THREE.BufferGeometry {
  return metersUV(new THREE.BoxGeometry(w, h, d), w, h, d)
}

export function rounded(w: number, h: number, d: number, radius = 0.0018): THREE.BufferGeometry {
  const r = Math.min(radius, w / 2.1, h / 2.1, d / 2.1)
  return metersUV(new RoundedBoxGeometry(w, h, d, 2, r), w, h, d)
}

type Mat = THREE.Material | THREE.Material[]

export type Span = [x0: number, y0: number, z0: number, x1: number, y1: number, z1: number]

/**
 * Много плоских деталей одним объектом: короб шкафа из боковин, дна, спинки
 * и полок рисуется за один вызов видеокарты, а не за шесть.
 */
export function panels(list: Span[]): THREE.BufferGeometry {
  const parts = list
    .filter(([x0, y0, z0, x1, y1, z1]) => x1 - x0 > 0.0004 && y1 - y0 > 0.0004 && z1 - z0 > 0.0004)
    .map(([x0, y0, z0, x1, y1, z1]) => box(x1 - x0, y1 - y0, z1 - z0).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2))
  if (parts.length === 0) return new THREE.BufferGeometry()
  const out = mergeGeometries(parts, false)
  for (const g of parts) g.dispose()
  return out
}

/** Плоскость с кусочком картинки: u0..u1, v0..v1 (для фото, разрезанного по дверцам). */
export function uvPlane(w: number, h: number, u0: number, v0: number, u1: number, v1: number): THREE.PlaneGeometry {
  const g = new THREE.PlaneGeometry(w, h)
  const uv = g.getAttribute('uv') as THREE.BufferAttribute
  for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), v0 + uv.getY(i) * (v1 - v0))
  uv.needsUpdate = true
  return g
}

export function mesh(geom: THREE.BufferGeometry, mat: Mat, x = 0, y = 0, z = 0, shadow = true): THREE.Mesh {
  const m = new THREE.Mesh(geom, mat)
  m.position.set(x, y, z)
  m.castShadow = shadow
  m.receiveShadow = true
  return m
}

/** Коробка по двум углам: удобнее, чем центр и размеры. */
export function slab(mat: Mat, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, round = false): THREE.Mesh {
  const w = Math.max(0.0005, x1 - x0)
  const h = Math.max(0.0005, y1 - y0)
  const d = Math.max(0.0005, z1 - z0)
  return mesh(round ? rounded(w, h, d) : box(w, h, d), mat, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)
}

/** Прямоугольная рамка из четырёх брусков (для филёнок и молдингов). */
function frame(g: THREE.Group, mat: Mat, x0: number, y0: number, x1: number, y1: number, width: number, z0: number, z1: number, round = true) {
  g.add(slab(mat, x0, y0, z0, x0 + width, y1, z1, round))
  g.add(slab(mat, x1 - width, y0, z0, x1, y1, z1, round))
  g.add(slab(mat, x0 + width, y0, z0, x1 - width, y0 + width, z1, round))
  g.add(slab(mat, x0 + width, y1 - width, z0, x1 - width, y1, z1, round))
}

/** Стеклянная дверца витрины: рамка, стекло и (для классики) переплёт. */
function glassFront(kind: DoorKind, w: number, h: number, mat: Mat, glass: THREE.Material, bars: boolean, frameMat?: Mat): THREE.Group {
  const g = new THREE.Group()
  const t = FRONT_T
  const stile = kind === 'slab' || kind === 'fluted' ? 0.022 : kind === 'framed' ? 0.02 : Math.min(0.06, w * 0.18)
  frame(g, kind === 'framed' && frameMat ? frameMat : mat, 0, 0, w, h, stile, 0, t)
  const pane = mesh(new THREE.PlaneGeometry(w - 2 * stile, h - 2 * stile), glass, w / 2, h / 2, t * 0.55, false)
  pane.castShadow = false
  g.add(pane)
  if (bars) {
    const b = 0.012
    g.add(slab(mat, w / 2 - b / 2, stile, t * 0.3, w / 2 + b / 2, h - stile, t * 0.85))
    for (const k of [1 / 3, 2 / 3]) {
      const y = stile + (h - 2 * stile) * k
      g.add(slab(mat, stile, y - b / 2, t * 0.3, w - stile, y + b / 2, t * 0.85))
    }
  }
  return g
}

export function front(kind: DoorKind, w: number, h: number, mat: Mat, glass?: { mat: THREE.Material; bars: boolean }, frameMat?: Mat): THREE.Group {
  if (glass) return glassFront(kind, w, h, mat, glass.mat, glass.bars, frameMat)
  const g = new THREE.Group()
  const t = FRONT_T
  // Крашеное стекло в алюминиевом профиле 19 мм: рамка блестит, стекло чуть утоплено.
  if (kind === 'framed') {
    const p = Math.min(0.019, w * 0.2, h * 0.2)
    frame(g, frameMat ?? mat, 0, 0, w, h, p, 0, t, false)
    g.add(slab(mat, p, p, 0, w - p, h - p, t - 0.002))
    return g
  }
  // Узкие и низкие фасады (ящики, бутылочница) рамку делают уже.
  const stile = Math.min(kind === 'raised' ? 0.075 : 0.06, w * 0.2, h * 0.24)
  // Рифлёный фасад — гладкая плита с рельефом из текстуры (см. materials.fluted):
  // настоящие рейки дают рябь на экране, рельеф — нет.
  if (kind === 'slab' || kind === 'fluted' || stile < 0.02) {
    g.add(slab(mat, 0, 0, 0, w, h, t, true))
    return g
  }
  frame(g, mat, 0, 0, w, h, stile, 0, t)
  const px0 = stile
  const py0 = stile
  const px1 = w - stile
  const py1 = h - stile
  if (kind === 'shaker' || kind === 'molding') {
    g.add(slab(mat, px0, py0, 0, px1, py1, t * 0.5))
    if (kind === 'molding' && px1 - px0 > 0.06 && py1 - py0 > 0.06) {
      const inset = 0.014
      frame(g, mat, px0 + inset, py0 + inset, px1 - inset, py1 - inset, 0.007, t * 0.5, t * 0.5 + 0.005)
    }
    return g
  }
  // raised: выпуклая филёнка с фаской — классика
  const pw = px1 - px0 - 0.008
  const ph = py1 - py0 - 0.008
  const bevel = Math.min(0.024, pw / 4, ph / 4)
  const shape = new THREE.Shape()
  shape.moveTo(-pw / 2 + bevel, -ph / 2 + bevel)
  shape.lineTo(pw / 2 - bevel, -ph / 2 + bevel)
  shape.lineTo(pw / 2 - bevel, ph / 2 - bevel)
  shape.lineTo(-pw / 2 + bevel, ph / 2 - bevel)
  shape.closePath()
  const geom = new THREE.ExtrudeGeometry(shape, {
    depth: 0.004,
    bevelEnabled: true,
    bevelThickness: 0.007,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: 1,
  })
  // У выдавленной геометрии UV уже в метрах (координаты формы).
  const panel = mesh(geom, mat, (px0 + px1) / 2, (py0 + py1) / 2, t * 0.35)
  g.add(panel)
  frame(g, mat, px0 - 0.004, py0 - 0.004, px1 + 0.004, py1 + 0.004, 0.006, t, t + 0.004)
  return g
}

/** len — длина ручки, м (для длинных и профильных ручек) */
export type HandleAt = { x: number; y: number; vertical: boolean; long: boolean; len?: number }

/** Стержень ручки на двух стойках: рейлинг, длинная, с насечкой. */
function rodOnPosts(g: THREE.Group, at: HandleAt, mat: THREE.Material, rod: THREE.BufferGeometry, len: number, posts: number[]) {
  if (!at.vertical) rod.rotateZ(Math.PI / 2)
  g.add(mesh(rod, mat, 0, 0, 0.032))
  for (const k of posts) {
    const p = len / 2 - 0.02
    const post = new THREE.CylinderGeometry(0.0045, 0.0045, 0.03, 10).rotateX(Math.PI / 2)
    g.add(mesh(post, mat, at.vertical ? 0 : k * p, at.vertical ? k * p : 0, 0.016))
  }
}

/** Ручка в точке (x, y) на лицевой стороне фасада. */
export function handle(kind: HandleKind, at: HandleAt, mat: THREE.Material): THREE.Object3D | null {
  const g = new THREE.Group()
  const zf = FRONT_T
  switch (kind) {
    case 'gola':
      return null
    case 'cup': {
      if (at.vertical) {
        // на дверце — кнобка того же металла
        g.add(mesh(new THREE.SphereGeometry(0.014, 18, 12), mat, 0, 0, 0.026))
        g.add(mesh(new THREE.CylinderGeometry(0.006, 0.009, 0.02, 12).rotateX(Math.PI / 2), mat, 0, 0, 0.01))
        break
      }
      // ракушка: половина трубки, раскрытая вниз
      const shell = new THREE.CylinderGeometry(0.019, 0.019, 0.085, 20, 1, true, Math.PI / 2, Math.PI)
      shell.rotateZ(Math.PI / 2)
      const m = mesh(shell, mat, 0, 0.004, 0.016)
      ;(m.material as THREE.Material).side = THREE.DoubleSide
      g.add(m)
      g.add(mesh(box(0.1, 0.03, 0.004), mat, 0, 0.01, 0.002))
      break
    }
    case 'knob':
    case 'woodKnob': {
      if (kind === 'knob') {
        g.add(mesh(new THREE.SphereGeometry(0.014, 18, 12), mat, 0, 0, 0.026))
        g.add(mesh(new THREE.CylinderGeometry(0.006, 0.009, 0.02, 12).rotateX(Math.PI / 2), mat, 0, 0, 0.01))
      } else {
        g.add(mesh(new THREE.CylinderGeometry(0.017, 0.012, 0.024, 20).rotateX(Math.PI / 2), mat, 0, 0, 0.012))
      }
      break
    }
    case 'bar': {
      const len = at.long ? 0.32 : 0.16
      const rod = new THREE.CylinderGeometry(0.006, 0.006, len, 14)
      if (!at.vertical) rod.rotateZ(Math.PI / 2)
      g.add(mesh(rod, mat, 0, 0, 0.032))
      const spread = len / 2 - 0.02
      for (const s of [-1, 1]) {
        const post = new THREE.CylinderGeometry(0.0045, 0.0045, 0.03, 10).rotateX(Math.PI / 2)
        g.add(mesh(post, mat, at.vertical ? 0 : s * spread, at.vertical ? s * spread : 0, 0.016))
      }
      break
    }
    case 'bow': {
      const arc = new THREE.TorusGeometry(0.038, 0.005, 10, 24, Math.PI)
      arc.rotateX(Math.PI / 2)
      if (at.vertical) arc.rotateZ(Math.PI / 2)
      g.add(mesh(arc, mat, 0, 0, 0.004))
      break
    }
    case 'edge': {
      const len = at.len ?? (at.long ? 0.3 : 0.16)
      const w = at.vertical ? 0.008 : len
      const h = at.vertical ? len : 0.008
      g.add(mesh(box(w, h, 0.026), mat, 0, 0, 0.013))
      break
    }
    case 'tbar': {
      // Т-образная: короткий стержень на одной стойке
      const len = at.long ? 0.2 : 0.13
      const rod = new THREE.CylinderGeometry(0.006, 0.006, len, 16)
      if (!at.vertical) rod.rotateZ(Math.PI / 2)
      g.add(mesh(rod, mat, 0, 0, 0.03))
      g.add(mesh(new THREE.CylinderGeometry(0.005, 0.006, 0.028, 12).rotateX(Math.PI / 2), mat, 0, 0, 0.014))
      break
    }
    case 'long': {
      // длинная квадратная ручка почти на всю дверцу — модно в хай-теке
      const len = at.len ?? 0.5
      const rod = rounded(0.012, len, 0.012, 0.003)
      rodOnPosts(g, at, mat, rod, len, [-1, 1])
      break
    }
    case 'rail': {
      // тонкий плоский профиль на стойках
      const len = at.len ?? (at.long ? 0.4 : 0.22)
      const bar = rounded(0.006, len, 0.02, 0.002)
      if (!at.vertical) bar.rotateZ(Math.PI / 2)
      g.add(mesh(bar, mat, 0, 0, 0.03))
      for (const k of [-1, 1]) {
        const p = len / 2 - 0.025
        g.add(mesh(box(0.008, 0.008, 0.022), mat, at.vertical ? 0 : k * p, at.vertical ? k * p : 0, 0.011))
      }
      break
    }
    case 'knurled': {
      // рейлинг с насечкой: частые кольца по всей длине
      const len = at.len ?? (at.long ? 0.3 : 0.18)
      const pts: THREE.Vector2[] = [new THREE.Vector2(0, -len / 2), new THREE.Vector2(0.0062, -len / 2)]
      const step = 0.0035
      for (let y = -len / 2 + 0.012; y < len / 2 - 0.012; y += step) {
        pts.push(new THREE.Vector2(0.0066, y), new THREE.Vector2(0.0058, y + step / 2))
      }
      pts.push(new THREE.Vector2(0.0062, len / 2), new THREE.Vector2(0, len / 2))
      rodOnPosts(g, at, mat, new THREE.LatheGeometry(pts, 14), len, [-1, 1])
      break
    }
    case 'ring': {
      // кольцо на круглой накладке
      g.add(mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.006, 24).rotateX(Math.PI / 2), mat, 0, 0, 0.003))
      g.add(mesh(new THREE.TorusGeometry(0.02, 0.0032, 10, 36), mat, 0, -0.02, 0.009))
      break
    }
    case 'leather': {
      // кожаная петля: мягкая лента дугой и два винта
      const loop = new THREE.TorusGeometry(0.03, 0.0075, 8, 28, Math.PI)
      loop.rotateX(Math.PI / 2)
      loop.scale(1, 0.35, 1)
      if (at.vertical) loop.rotateZ(Math.PI / 2)
      g.add(mesh(loop, mat, 0, 0, 0.002))
      break
    }
  }
  g.position.set(at.x, at.y, zf)
  return g
}

/** Карниз над верхними шкафами. Длина — вдоль x, выступ — в +z. */
export function cornice(kind: 'simple' | 'crown', length: number, mat: THREE.Material): THREE.Object3D {
  if (kind === 'simple') return slab(mat, 0, 0, -0.005, length, 0.05, 0.022)
  // Профиль: выкружка, полочка и плоский верх.
  const s = new THREE.Shape()
  s.moveTo(0, 0)
  s.lineTo(0.012, 0)
  s.lineTo(0.012, 0.012)
  s.bezierCurveTo(0.02, 0.018, 0.052, 0.03, 0.058, 0.068)
  s.lineTo(0.066, 0.07)
  s.lineTo(0.066, 0.085)
  s.lineTo(0, 0.085)
  s.closePath()
  const geom = new THREE.ExtrudeGeometry(s, { depth: length, bevelEnabled: false, curveSegments: 10 })
  // Профиль нарисован в плоскости (выступ, высота) и выдавлен вдоль z.
  // Поворот на −90°: выдавливание уходит в −x, выступ — к зрителю (+z).
  geom.rotateY(-Math.PI / 2)
  geom.translate(length, 0, 0)
  return mesh(geom, mat)
}

/**
 * Как открывается дверца по нажатию: swing — на петлях сбоку (dir: −1 петли
 * слева, +1 справа), lift — вверх, fold — вниз (духовка, посудомойка),
 * slide — выдвигается (ящик).
 */
export type OpenKind = 'swing' | 'lift' | 'fold' | 'slide'

export function openable<T extends THREE.Object3D>(pivot: T, kind: OpenKind, dir: number): T {
  pivot.userData.open = { kind, dir }
  return pivot
}

/**
 * Сдвиг рисунка на детали: у шпона, бетона и мрамора соседние дверцы
 * продолжают друг друга, как у настоящих плит, раскроенных по порядку.
 */
export function shiftUV(obj: THREE.Object3D, du: number, dv: number) {
  obj.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return
    const uv = o.geometry.getAttribute('uv') as THREE.BufferAttribute | undefined
    if (!uv) return
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) + du, uv.getY(i) + dv)
    uv.needsUpdate = true
  })
}

/** Несколько готовых геометрий одним объектом (тарелки, стаканы, прутья). */
export function mergeAll(list: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const prepared = list.map((g) => (g.index ? g.toNonIndexed() : g))
  const out = mergeGeometries(prepared, false)
  for (const g of list) g.dispose()
  for (const g of prepared) g.dispose()
  return out
}
