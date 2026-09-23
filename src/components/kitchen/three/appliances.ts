import * as THREE from 'three'
import type { KitchenAppliance } from '@/lib/kitchen/types'
import type { Mats } from './materials'
import { box, mergeAll, mesh, openable, panels, rounded, slab, uvPlane, type Span } from './parts'
import { fitsFront, type Photo } from './photo'
import { hobTop } from './textures'

/**
 * Техника в 3D. Размеры — из карточки товара. Если фото снято спереди, оно
 * становится лицевой стороной модели; иначе лицо рисуется по типу и цвету.
 * Дверцы открываются по нажатию — внутри то, что есть у настоящей техники.
 * Начало координат: левый нижний задний угол, лицо смотрит в +z.
 */

const cm = (v: number) => v / 100

/** Кусок фото на плоскости: часть лица техники (дверца, пульт). */
function photoPart(photo: Photo, mats: Mats, w: number, h: number, crop: [number, number, number, number], x: number, y: number, z: number) {
  const face = new THREE.Mesh(uvPlane(w, h, ...crop), mats.photo(photo.texture))
  face.position.set(x, y, z)
  face.receiveShadow = true
  return face
}

function knob(g: THREE.Object3D, mats: Mats, x: number, y: number, z: number, r = 0.018) {
  const geom = new THREE.CylinderGeometry(r, r, 0.02, 24).rotateX(Math.PI / 2)
  g.add(mesh(geom, mats.metal('steel'), x, y, z + 0.01))
}

/** Решётка из прутьев: рама и поперечины. */
function rack(mats: Mats, w: number, d: number, rods = 7): THREE.Mesh {
  const r = 0.003
  const list: Span[] = [
    [0, 0, 0, w, r * 2, r * 2],
    [0, 0, d - r * 2, w, r * 2, d],
    [0, 0, 0, r * 2, r * 2, d],
    [w - r * 2, 0, 0, w, r * 2, d],
  ]
  for (let i = 1; i < rods; i++) list.push([(w / rods) * i - r, 0, 0, (w / rods) * i + r, r * 2, d])
  return mesh(panels(list), mats.wire, 0, 0, 0, false)
}

/* ───────── духовой шкаф ───────── */

/** Духовка: пульт сверху, дверца откидывается вниз, внутри — камера с решётками. */
export function oven(a: KitchenAppliance | undefined, mats: Mats, photo?: Photo | null): THREE.Group {
  const g = new THREE.Group()
  const w = cm(a?.w ?? 59.5)
  const h = cm(a?.h ?? 59.5)
  const d = 0.02
  const finish = mats.appliance(a?.finish ?? 'black')
  const split = 0.17
  const doorH = h * (1 - split)
  // камера
  const cw = w - 0.08
  const ch = doorH - 0.08
  const cd = 0.42
  g.add(mesh(box(cw, ch, cd), mats.enamel, w / 2, 0.04 + ch / 2, -cd / 2, false))
  for (const y of [0.04 + ch * 0.28, 0.04 + ch * 0.58]) {
    const rk = rack(mats, cw - 0.02, cd - 0.06, 9)
    rk.position.set((w - cw) / 2 + 0.01, y, -cd + 0.03)
    g.add(rk)
  }
  // тёплая лампа в глубине — видна, когда дверца открыта
  g.add(mesh(new THREE.PlaneGeometry(0.05, 0.05), mats.warm, w - 0.08, 0.04 + ch - 0.05, -cd + 0.002, false))

  // пульт
  g.add(slab(finish, 0, doorH, 0, w, h, d, true))
  const door = openable(new THREE.Group(), 'fold', 1)
  door.add(slab(finish, 0, 0, 0, w, doorH - 0.002, d, true))
  // изнутри дверца — тёмное стекло
  const inner = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.06, doorH - 0.06), mats.darkGlass)
  inner.position.set(w / 2, doorH / 2, -0.001)
  inner.rotation.y = Math.PI
  door.add(inner)
  g.add(door)

  if (a && fitsFront(photo, a.w, a.h)) {
    g.add(photoPart(photo, mats, w, h - doorH, [0, 1 - split, 1, 1], w / 2, doorH + (h - doorH) / 2, d + 0.0015))
    door.add(photoPart(photo, mats, w, doorH, [0, 0, 1, 1 - split], w / 2, doorH / 2, d + 0.0015))
    return g
  }
  door.add(slab(mats.darkGlass, w * 0.12, doorH * 0.16, d, w * 0.88, doorH * 0.78, d + 0.002))
  door.add(slab(mats.metal('steel'), w * 0.08, doorH - 0.05, d, w * 0.92, doorH - 0.035, d + 0.03, true))
  knob(g, mats, w * 0.16, doorH + (h - doorH) / 2, d)
  knob(g, mats, w * 0.84, doorH + (h - doorH) / 2, d)
  g.add(slab(mats.led, w * 0.42, doorH + (h - doorH) * 0.3, d, w * 0.58, doorH + (h - doorH) * 0.7, d + 0.001))
  return g
}

/* ───────── микроволновка ───────── */

export function microwave(a: KitchenAppliance | undefined, mats: Mats, photo?: Photo | null): THREE.Group {
  const g = new THREE.Group()
  const w = cm(a?.w ?? 59.5)
  const h = cm(a?.h ?? 38.5)
  const d = 0.02
  const finish = mats.appliance(a?.finish ?? 'black')
  const cut = 0.72
  const dw = w * cut
  // камера и стеклянный поддон
  const cd = 0.3
  g.add(mesh(box(dw - 0.06, h - 0.08, cd), mats.fridgeInside, dw / 2, h / 2, -cd / 2, false))
  g.add(mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.006, 40), mats.shelfGlass, dw / 2, 0.05, -cd / 2, false))
  g.add(slab(finish, dw, 0, 0, w, h, d, true))
  const door = openable(new THREE.Group(), 'swing', -1)
  door.add(slab(finish, 0, 0, 0, dw - 0.002, h, d, true))
  g.add(door)
  if (a && fitsFront(photo, a.w, a.h)) {
    g.add(photoPart(photo, mats, w - dw, h, [cut, 0, 1, 1], dw + (w - dw) / 2, h / 2, d + 0.0015))
    door.add(photoPart(photo, mats, dw, h, [0, 0, cut, 1], dw / 2, h / 2, d + 0.0015))
    return g
  }
  door.add(slab(mats.darkGlass, dw * 0.08, h * 0.14, d, dw * 0.94, h * 0.86, d + 0.002))
  knob(g, mats, dw + (w - dw) / 2, h * 0.6, d, 0.02)
  return g
}

/* ───────── холодильник ───────── */

type FridgeDoor = { x0: number; x1: number; y0: number; y1: number; hinge: 'left' | 'right' | 'drawer' }

function fridgeDoors(kind: KitchenAppliance['fridge'], w: number, h: number): { doors: FridgeDoor[]; split: number | null } {
  switch (kind) {
    case 'sbs':
      return {
        doors: [
          { x0: 0, x1: w / 2, y0: 0.02, y1: h, hinge: 'left' },
          { x0: w / 2, x1: w, y0: 0.02, y1: h, hinge: 'right' },
        ],
        split: null,
      }
    case 'french': {
      const s = h * 0.45
      return {
        doors: [
          { x0: 0, x1: w / 2, y0: s, y1: h, hinge: 'left' },
          { x0: w / 2, x1: w, y0: s, y1: h, hinge: 'right' },
          { x0: 0, x1: w, y0: s / 2, y1: s, hinge: 'drawer' },
          { x0: 0, x1: w, y0: 0.02, y1: s / 2, hinge: 'drawer' },
        ],
        split: s,
      }
    }
    case 'single':
      return { doors: [{ x0: 0, x1: w, y0: 0.02, y1: h, hinge: 'right' }], split: null }
    case 'top': {
      const s = h * 0.72
      return {
        doors: [
          { x0: 0, x1: w, y0: s, y1: h, hinge: 'right' },
          { x0: 0, x1: w, y0: 0.02, y1: s, hinge: 'right' },
        ],
        split: s,
      }
    }
    default: {
      const s = h * 0.36
      return {
        doors: [
          { x0: 0, x1: w, y0: s, y1: h, hinge: 'right' },
          { x0: 0, x1: w, y0: 0.02, y1: s, hinge: 'right' },
        ],
        split: s,
      }
    }
  }
}

/** Продукты на полках: бутылки, контейнеры, яйца — чтобы открытый холодильник был живым. */
function groceries(w: number, y: number, z0: number, z1: number, seed: number): THREE.Group {
  const g = new THREE.Group()
  const colors = ['#d9e7c8', '#f2d7a6', '#e8b7a8', '#cfe0ec', '#f5f0e2', '#e7c46a']
  let x = 0.05 + (seed % 3) * 0.02
  let k = seed
  while (x < w - 0.08) {
    const c = colors[k % colors.length]
    const mat = new THREE.MeshStandardMaterial({ color: c, roughness: 0.45 })
    if (k % 3 === 0) {
      const hgt = 0.18 + (k % 2) * 0.05
      g.add(mesh(new THREE.CylinderGeometry(0.028, 0.03, hgt, 16), mat, x + 0.03, y + hgt / 2, (z0 + z1) / 2, false))
      x += 0.08
    } else {
      const bw = 0.1 + (k % 2) * 0.04
      g.add(mesh(box(bw, 0.07, 0.12), mat, x + bw / 2, y + 0.035, z0 + 0.1, false))
      x += bw + 0.03
    }
    k++
  }
  return g
}

/** Отдельностоящий холодильник: корпус, открывающиеся дверцы, полки внутри. */
export function fridge(a: KitchenAppliance, mats: Mats, photo?: Photo | null): THREE.Group {
  const g = new THREE.Group()
  const w = cm(a.w)
  const h = cm(a.h)
  const d = cm(a.d)
  const doorT = 0.05
  const bd = d - doorT
  const t = 0.03
  const finish = mats.appliance(a.finish)
  // корпус: боковины, верх, низ, спинка — снаружи цвета холодильника
  g.add(mesh(panels([[0, 0.02, 0, t, h, bd], [w - t, 0.02, 0, w, h, bd], [t, h - t, 0, w - t, h, bd], [t, 0.02, 0, w - t, 0.02 + t, bd], [t, 0.02, 0, w - t, h - t, t]]), finish))
  // белая камера внутри
  g.add(mesh(box(w - 2 * t, h - 0.02 - 2 * t, bd - t), mats.fridgeInside, w / 2, 0.02 + t + (h - 0.02 - 2 * t) / 2, t + (bd - t) / 2, false))
  g.add(slab(mats.rubber, 0.03, 0, bd - 0.08, w - 0.03, 0.02, bd - 0.02))

  const { doors, split } = fridgeDoors(a.fridge, w, h)
  if (split) g.add(slab(mats.plastic, t, split - 0.02, t, w - t, split + 0.02, bd))
  // полки и продукты в холодильной камере
  const fresh0 = a.fridge === 'top' ? 0.05 : split ?? 0.05
  const fresh1 = a.fridge === 'top' ? (split ?? h) - 0.03 : h - t - 0.04
  const shelves = 3
  for (let i = 1; i <= shelves; i++) {
    const y = fresh0 + ((fresh1 - fresh0) / (shelves + 1)) * i
    g.add(mesh(box(w - 2 * t - 0.01, 0.006, bd - t - 0.04), mats.shelfGlass, w / 2, y, t + (bd - t) / 2, false))
    g.add(groceries(w, y + 0.003, t + 0.02, bd - 0.05, i * 2 + Math.round(w * 10)))
  }
  g.add(mesh(new THREE.PlaneGeometry(w * 0.4, 0.02), mats.led, w / 2, fresh1 - 0.01, t + 0.05, false))

  const usePhoto = fitsFront(photo, a.w, a.h)
  const bar = (door: THREE.Object3D, x: number, y0: number, y1: number) =>
    door.add(slab(mats.metal(a.finish === 'black' ? 'black' : 'steel'), x - 0.008, y0, doorT, x + 0.008, y1, doorT + 0.035, true))
  for (const dr of doors) {
    const dwid = dr.x1 - dr.x0 - 0.004
    const dh = dr.y1 - dr.y0 - 0.004
    const pivot = new THREE.Group()
    const leaf = new THREE.Group()
    leaf.add(mesh(rounded(dwid, dh, doorT, 0.01), finish, dwid / 2, dh / 2, doorT / 2))
    // изнутри — белая панель с полочками
    leaf.add(slab(mats.plastic, 0.03, 0.03, -0.004, dwid - 0.03, dh - 0.03, 0.001))
    if (dr.hinge !== 'drawer') {
      for (let k = 1; k <= 3; k++) leaf.add(slab(mats.plastic, 0.05, (dh / 4) * k - 0.04, -0.07, dwid - 0.05, (dh / 4) * k, -0.004))
    }
    if (usePhoto) {
      const crop: [number, number, number, number] = [dr.x0 / w, dr.y0 / h, dr.x1 / w, dr.y1 / h]
      leaf.add(photoPart(photo!, mats, dwid, dh, crop, dwid / 2, dh / 2, doorT + 0.0015))
    } else if (dr.hinge === 'drawer') {
      bar(leaf, dwid / 2, dh - 0.06, dh - 0.045)
    } else {
      bar(leaf, dr.hinge === 'right' ? 0.05 : dwid - 0.05, Math.max(0.1, dh * 0.3), Math.min(dh - 0.1, dh * 0.3 + 0.5))
    }
    if (dr.hinge === 'right') {
      pivot.position.set(dr.x1 - 0.002, dr.y0 + 0.002, bd)
      leaf.position.x = -dwid
      openable(pivot, 'swing', 1)
    } else if (dr.hinge === 'left') {
      pivot.position.set(dr.x0 + 0.002, dr.y0 + 0.002, bd)
      openable(pivot, 'swing', -1)
    } else {
      pivot.position.set(dr.x0 + 0.002, dr.y0 + 0.002, bd)
      openable(pivot, 'slide', 1)
    }
    pivot.add(leaf)
    g.add(pivot)
  }
  return g
}

/* ───────── варочная и вытяжка ───────── */

/** Варочная поверхность: стекло на столешнице. */
export function hob(a: KitchenAppliance | undefined, mats: Mats): THREE.Group {
  const g = new THREE.Group()
  const w = cm(a?.w ?? 59)
  const d = cm(Math.min(a?.d ?? 52, 54))
  const kind = a?.hob ?? 'electric'
  const color = a?.finish === 'white' ? '#e9e9e7' : a?.finish === 'inox' ? '#bfc2c4' : '#0c0d0f'
  const map = hobTop(kind, a?.burners ?? 4, color)
  const top = new THREE.MeshPhysicalMaterial({ map, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.03 })
  g.add(mesh(box(w, 0.006, d), [mats.darkGlass, mats.darkGlass, top, mats.darkGlass, mats.darkGlass, mats.darkGlass], w / 2, 0.003, d / 2))
  if (kind === 'gas') {
    const iron = mats.plain('#1b1c1e', 0.55, 0.4)
    for (const x of [0.25, 0.75]) g.add(slab(iron, w * x - 0.13, 0.006, 0.04, w * x + 0.13, 0.03, d - 0.04))
  }
  return g
}

/** Каминная и наклонная вытяжка: колпак и труба до верха стены. */
export function chimneyHood(a: KitchenAppliance, mats: Mats, chimney: number): THREE.Group {
  const g = new THREE.Group()
  const w = cm(a.w)
  const finish = mats.appliance(a.finish)
  if (a.hood === 'inclined') {
    const panel = mesh(rounded(w, 0.44, 0.03, 0.006), mats.darkGlass, w / 2, 0.22, 0)
    panel.rotation.x = -0.55
    panel.position.set(w / 2, 0.24, 0.22)
    g.add(panel)
    g.add(slab(finish, 0.02, 0, 0, w - 0.02, 0.44, 0.12, true))
    g.add(slab(finish, w / 2 - 0.13, 0.44, 0, w / 2 + 0.13, 0.44 + chimney, 0.2))
    return g
  }
  g.add(slab(finish, 0, 0, 0, w, 0.07, 0.5, true))
  g.add(slab(mats.darkGlass, 0.02, 0.012, 0.5, w - 0.02, 0.058, 0.503))
  for (const x of [0.25, 0.75]) g.add(slab(mats.led, w * x - 0.03, -0.001, 0.3, w * x + 0.03, 0.001, 0.36))
  g.add(slab(finish, w / 2 - 0.13, 0.07, 0, w / 2 + 0.13, 0.07 + chimney, 0.23))
  return g
}

/* ───────── посудомоечная ───────── */

/**
 * Внутри посудомойки: нержавеющий бак, две корзины, тарелки и чашки.
 * Видно, когда дверца откинута.
 */
export function dishwasherInside(mats: Mats, w: number, h: number, d: number): THREE.Group {
  const g = new THREE.Group()
  const iw = w - 0.04
  const ih = h - 0.06
  const id = d - 0.04
  g.add(mesh(box(iw, ih, id), mats.tub, w / 2, 0.03 + ih / 2, id / 2 + 0.01, false))
  const lower = rack(mats, iw - 0.04, id - 0.06, 8)
  lower.position.set(0.04, 0.09, 0.03)
  g.add(lower)
  const upper = rack(mats, iw - 0.04, id - 0.06, 8)
  upper.position.set(0.04, 0.09 + ih * 0.5, 0.03)
  g.add(upper)
  // тарелки стоят рядком в нижней корзине
  const plates: THREE.BufferGeometry[] = []
  const n = Math.max(4, Math.floor((iw - 0.08) / 0.05))
  for (let i = 0; i < n; i++) {
    // тарелки стоят чуть наискось — так их видно, как в настоящей корзине
    const p = new THREE.CylinderGeometry(0.11, 0.1, 0.008, 28).rotateX(Math.PI / 2).rotateY(Math.PI / 2 - 0.55)
    p.translate(0.07 + i * ((iw - 0.12) / n), 0.1 + 0.11, id * 0.55)
    plates.push(p)
  }
  g.add(mesh(mergeAll(plates), mats.ceramic, 0, 0, 0, false))
  // чашки вверх дном в верхней корзине
  const cups: THREE.BufferGeometry[] = []
  for (let i = 0; i < 5; i++) {
    const c = new THREE.CylinderGeometry(0.035, 0.03, 0.08, 18)
    c.translate(0.1 + i * ((iw - 0.16) / 4), 0.1 + ih * 0.5 + 0.045, id * 0.45 + (i % 2) * 0.1)
    cups.push(c)
  }
  g.add(mesh(mergeAll(cups), mats.ceramic, 0, 0, 0, false))
  return g
}

/** Посудомойка или стиральная машина, стоящая под столешницей. */
export function underCounter(a: KitchenAppliance, mats: Mats, height: number, photo?: Photo | null): THREE.Group {
  const g = new THREE.Group()
  const w = cm(a.w)
  const d = cm(Math.min(a.d, 60))
  const h = height
  const finish = mats.appliance(a.finish)
  if (a.slot === 'dishwasher') {
    // корпус без передней стенки — дверца откидывается
    g.add(mesh(panels([[0, 0, 0, 0.012, h, d - 0.02], [w - 0.012, 0, 0, w, h, d - 0.02], [0, h - 0.012, 0, w, h, d - 0.02], [0, 0, 0, w, 0.02, d - 0.02]]), finish))
    const inside = dishwasherInside(mats, w, h - 0.02, d - 0.03)
    g.add(inside)
    const door = openable(new THREE.Group(), 'fold', 1)
    door.position.set(0, 0.02, d - 0.02)
    door.add(mesh(rounded(w, h - 0.02, 0.02, 0.006), finish, w / 2, (h - 0.02) / 2, 0.01))
    door.add(slab(mats.tub, 0.02, 0.02, -0.003, w - 0.02, h - 0.06, 0))
    door.add(slab(mats.darkGlass, 0.01, h - 0.11, 0.02, w - 0.01, h - 0.032, 0.022))
    door.add(slab(mats.metal('steel'), w * 0.3, h - 0.15, 0.02, w * 0.7, h - 0.135, 0.04, true))
    g.add(door)
    return g
  }
  g.add(mesh(rounded(w, h, d, 0.008), finish, w / 2, h / 2, d / 2))
  if (fitsFront(photo, a.w, a.h)) {
    g.add(photoPart(photo, mats, w, h, [0, 0, 1, 1], w / 2, h / 2, d + 0.0015))
    return g
  }
  // стиральная: люк и панель
  g.add(slab(mats.darkGlass, 0.01, h - 0.11, d, w - 0.01, h - 0.015, d + 0.002))
  const ring = new THREE.TorusGeometry(0.2, 0.028, 16, 48)
  g.add(mesh(ring, mats.metal(a.finish === 'black' ? 'black' : 'chrome'), w / 2, h * 0.47, d + 0.02))
  g.add(mesh(new THREE.CircleGeometry(0.18, 48), mats.darkGlass, w / 2, h * 0.47, d + 0.03))
  return g
}

/* ───────── мойка ───────── */

/** Мойка: чаша, борт и смеситель. x0/x1 — края чаши вдоль ряда. */
export function sinkBowl(mats: Mats, x0: number, x1: number, z0: number, z1: number, topY: number, rim: boolean): THREE.Group {
  const g = new THREE.Group()
  const depth = 0.19
  const inner = mats.sink.clone()
  inner.side = THREE.BackSide
  g.add(mesh(box(x1 - x0, depth, z1 - z0), inner, (x0 + x1) / 2, topY - depth / 2 + 0.0005, (z0 + z1) / 2, false))
  g.add(mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.004, 24), mats.metal('chrome'), (x0 + x1) / 2, topY - depth + 0.003, (z0 + z1) / 2, false))
  if (rim) {
    const r = 0.018
    g.add(slab(mats.sink, x0 - r, topY, z0 - r, x1 + r, topY + 0.004, z0))
    g.add(slab(mats.sink, x0 - r, topY, z1, x1 + r, topY + 0.004, z1 + r))
    g.add(slab(mats.sink, x0 - r, topY, z0, x0, topY + 0.004, z1))
    g.add(slab(mats.sink, x1, topY, z0, x1 + r, topY + 0.004, z1))
  }
  return g
}

export function faucet(mat: THREE.Material, x: number, y: number, z: number): THREE.Group {
  const g = new THREE.Group()
  g.add(mesh(new THREE.CylinderGeometry(0.026, 0.028, 0.05, 24), mat, 0, 0.025, 0))
  const path = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.04, 0),
    new THREE.Vector3(0, 0.26, 0),
    new THREE.Vector3(0, 0.33, 0.05),
    new THREE.Vector3(0, 0.31, 0.15),
    new THREE.Vector3(0, 0.24, 0.19),
  ])
  g.add(mesh(new THREE.TubeGeometry(path, 40, 0.011, 12, false), mat))
  const lever = mesh(box(0.012, 0.012, 0.08), mat, 0.03, 0.07, 0.02)
  lever.rotation.z = -0.4
  g.add(lever)
  g.position.set(x, y, z)
  return g
}
