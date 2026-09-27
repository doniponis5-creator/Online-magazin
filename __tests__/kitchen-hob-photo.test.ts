import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import type { Product } from '@/data/products'
import { applianceFromProduct } from '@/lib/kitchen/catalog'
import { getStyle, getTone } from '@/lib/kitchen/styles'
import type { KitchenAppliance } from '@/lib/kitchen/types'
import { hob, stove } from '@/components/kitchen/three/appliances'
import { createMaterials } from '@/components/kitchen/three/materials'
import { fitsFront, fitsTop, frontTop, type Photo } from '@/components/kitchen/three/photo'
import { hobTop } from '@/components/kitchen/three/textures'

/**
 * Настоящее фото варочной панели и плиты в 3D: какое фото ложится на стекло
 * панели, какое — на лицо плиты. Числа пропорций сняты с настоящих фото
 * smarket.kg (1200×1200, белый фон) после обрезки белых полей.
 */

const photo = (aspect: number): Photo => ({ texture: null as never, aspect })

describe('фото сверху на стекле варочной панели', () => {
  it('панель 59×52: фото MIDEA MC-6T3401R216 (1,153) и Asco SHAK6222BG (1,104) подходят', () => {
    expect(fitsTop(photo(1.153), 59, 52)).toBe(true)
    expect(fitsTop(photo(1.104), 59, 52)).toBe(true)
  })

  it('домино 28,8×52: своё узкое фото (0,554) подходит, к широкой панели — нет', () => {
    expect(fitsTop(photo(0.554), 28.8, 52)).toBe(true)
    expect(fitsTop(photo(0.554), 59, 52)).toBe(false)
    expect(fitsTop(photo(1.153), 28.8, 52)).toBe(false)
  })

  it('фото не той формы или без фото — стекло рисуется само', () => {
    expect(fitsTop(photo(1.658), 59, 52)).toBe(false)
    expect(fitsTop(null, 59, 52)).toBe(false)
    expect(fitsTop(undefined, 59, 52)).toBe(false)
  })
})

describe('фото плиты спереди: видный сверху верх срезается, лицо остаётся', () => {
  // Верх товара по столбцам (строки от верха обрезки), как у фото SHIVAKI 6401E
  // (cb-00002487, 900×900 после уменьшения): 581 столбец, лицо — с 42-й строки,
  // по бокам «плечи» — стекло сверху в перспективе, 72 столбца на 40 строк.
  const n = 581
  const height = 814
  const shivaki = Array.from({ length: n }, (_, i) => {
    const edge = Math.min(i, n - 1 - i)
    return edge < 72 ? Math.round(42 - (edge * 40) / 72) : 1
  })

  it('SHIVAKI 6401E: лицо начинается у переднего края верха (≈42-я строка), фото ложится на 60×85', () => {
    const top = frontTop(shivaki, height)
    expect(top).not.toBeNull()
    expect(top!).toBeGreaterThanOrEqual(38)
    expect(top!).toBeLessThanOrEqual(44)
    expect(fitsFront(photo(n / (height - top!)), 60, 85)).toBe(true)
  })

  it('ровно спереди — ничего не срезается', () => {
    const flat = Array.from({ length: 300 }, (_, i) => (i < 3 || i > 296 ? 6 - Math.min(i, 299 - i) * 2 : 0))
    expect(frontTop(flat, 500)).toBe(0)
  })

  it('«три четверти» — боковина с одной стороны: фото не годится', () => {
    const side = Array.from({ length: 300 }, (_, i) => (i < 66 ? Math.round((66 - i) * 0.5) : 0))
    expect(frontTop(side, 500)).toBeNull()
    expect(frontTop([...side].reverse(), 500)).toBeNull()
  })
})

const spec = (label: string, value: string) => ({ labelRu: label, labelKy: label, valueRu: value, valueKy: value })

function product(name: string, specs: [string, string][], price = 20000): Product {
  return {
    id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    brand: 'Test',
    categoryId: 'kitchen',
    nameRu: name,
    nameKy: name,
    price,
    art: 'box',
    baseColor: '#000',
    descRu: '',
    descKy: '',
    specs: specs.map(([l, v]) => spec(l, v)),
    warrantyMonths: 12,
    variants: [{ id: 'std', stock: 1 }],
  }
}

describe('варочная панель из каталога: вид и число конфорок (характеристики со страниц smarket.kg)', () => {
  it('Asco SHAK6222BG «2 газовые + 2 электрические Hi-Light» — газовая (вытяжка 75 см), 4 конфорки', () => {
    const a = applianceFromProduct(
      product('Встраиваемая поверхность Asco SHAK6222BG 2/2', [
        ['Тип', 'Комбинированная варочная панель'],
        ['Конфорки', '2 газовые + 2 электрические Hi-Light'],
        ['Размеры Ш×Г×В', '59 × 52 × 10 см'],
      ]),
    )
    expect(a).toMatchObject({ slot: 'hob', hob: 'gas', burners: 4, w: 59, d: 52 })
  })

  it('Asco 6013GRAY «3 газовые + 1 инфракрасная» — газовая, 4 конфорки', () => {
    const a = applianceFromProduct(product('Встраиваемая поверхность Asco 6013GRAY', [['Конфорки', '3 газовые + 1 инфракрасная'], ['Цвет', 'Серый']]))
    expect(a).toMatchObject({ slot: 'hob', hob: 'gas', burners: 4 })
  })

  it('MIDEA MC-6T3401R216 «Количество конфорок = 3» — электрическая, 3 конфорки', () => {
    const a = applianceFromProduct(
      product('Встраиваемая поверхность MIDEA MC-6T3401R216 (черный)', [
        ['Тип', 'Электрическая стеклокерамическая панель'],
        ['Количество конфорок', '3'],
        ['Мощность конфорок', '1200 Вт, 1800 Вт и 2200 Вт'],
        ['Размеры Ш×Г×В', '59 × 52 × 5,1 см'],
      ]),
    )
    expect(a).toMatchObject({ slot: 'hob', hob: 'electric', burners: 3, w: 59, d: 52 })
  })

  it('домино MIDEA MC-3D3001R212S «Ш×Г×В = 28,8 × 52 × 5,5 см», «Количество конфорок = 2»', () => {
    const a = applianceFromProduct(
      product('Встраиваемая поверхность MIDEA MC-3D3001R212S (1)', [
        ['Количество конфорок', '2'],
        ['Мощность конфорок', '1200 Вт и 1800 Вт'],
        ['Размеры Ш×Г×В', '28,8 × 52 × 5,5 см'],
      ]),
    )
    expect(a).toMatchObject({ slot: 'hob', hob: 'electric', burners: 2, w: 28.8, d: 52, h: 5.5, sizeKnown: true })
  })
})

/* ───────── фото на стекле панели в 3D ───────── */

// текстуры материалов рисуются на заглушке холста (как в kitchen-build)
const ctx2d: unknown = new Proxy({} as Record<string | symbol, unknown>, {
  get: (t, k) => {
    if (k in t) return t[k]
    if (k === 'getImageData') return (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) })
    return () => ctx2d
  },
  set: (t, k, v) => {
    t[k] = v
    return true
  },
})
;(globalThis as { document?: unknown }).document = {
  createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }),
}

/** Точки грани, на которой лежит картинка: [u, v, x, z]. */
function photoFace(g: THREE.Object3D, texture: THREE.Texture): [number, number, number, number][] {
  const out: [number, number, number, number][] = []
  g.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return
    const mats = Array.isArray(o.material) ? o.material : [o.material]
    const geo = o.geometry as THREE.BufferGeometry
    const uv = geo.getAttribute('uv')
    const pos = geo.getAttribute('position')
    const index = geo.getIndex()
    const groups = geo.groups.length ? geo.groups : [{ start: 0, count: index ? index.count : pos.count, materialIndex: 0 }]
    for (const gr of groups) {
      if ((mats[gr.materialIndex ?? 0] as THREE.MeshStandardMaterial | undefined)?.map !== texture) continue
      for (let i = gr.start; i < gr.start + gr.count; i++) {
        const k = index ? index.getX(i) : i
        out.push([uv.getX(k), uv.getY(k), pos.getX(k) + o.position.x, pos.getZ(k) + o.position.z])
      }
    }
  })
  return out
}

/** Картинка лежит на верхней грани целиком: u и v 0…1, u = 0 у левого края, v = 0 у передней кромки. */
function expectWhole(face: [number, number, number, number][]) {
  expect(face.length).toBeGreaterThan(0)
  const us = face.map((p) => p[0])
  const vs = face.map((p) => p[1])
  expect(Math.min(...us)).toBeCloseTo(0, 5)
  expect(Math.max(...us)).toBeCloseTo(1, 5)
  expect(Math.min(...vs)).toBeCloseTo(0, 5)
  expect(Math.max(...vs)).toBeCloseTo(1, 5)
  const left = Math.min(...face.map((p) => p[2]))
  const front = Math.max(...face.map((p) => p[3]))
  for (const [u, v, x, z] of face) {
    if (Math.abs(x - left) < 1e-6) expect(u).toBeCloseTo(0, 5)
    if (Math.abs(z - front) < 1e-6) expect(v).toBeCloseTo(0, 5)
  }
}

describe('верх варочной панели в 3D ложится целиком', () => {
  const style = getStyle('scandi')
  const a: KitchenAppliance = { id: 'midea', slot: 'hob', name: 'MIDEA MC-6T3401R216', brand: 'MIDEA', price: 14500, w: 59, h: 5.1, d: 52, sizeKnown: true, builtIn: true, finish: 'black', hob: 'electric', burners: 3 }

  it('фото — от края до края: левый край фото — слева, низ фото — у передней кромки', () => {
    const texture = new THREE.Texture()
    const mats = createMaterials(style, getTone(style, 0), false)
    expectWhole(photoFace(hob(a, mats, { texture, aspect: 59 / 52 }), texture))
  })

  it('без фото нарисованный верх (все 4 конфорки и сенсоры) — тоже целиком, сенсоры у покупателя', () => {
    const b: KitchenAppliance = { ...a, id: 'typical', burners: 4 }
    const mats = createMaterials(style, getTone(style, 0), false)
    expectWhole(photoFace(hob(b, mats), hobTop('electric', 4, '#0c0d0f')))
  })

  it('верх отдельностоящей плиты 60×85×60 без фото — целиком', () => {
    const s: KitchenAppliance = { ...a, id: 'stove', w: 60, h: 85, d: 60, burners: 4, stove: true, builtIn: false }
    const mats = createMaterials(style, getTone(style, 0), false)
    expectWhole(photoFace(stove(s, mats, { w: 60, h: 85, d: 60 }), hobTop('electric', 4, '#0c0d0f')))
  })
})
