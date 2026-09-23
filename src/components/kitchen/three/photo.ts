import * as THREE from 'three'

/**
 * Настоящее фото техники на лицевой стороне 3D-модели.
 *
 * Фото в каталоге — товар на белом фоне. Белые поля обрезаются, остаётся
 * сама техника. Если после обрезки пропорции совпадают с размерами товара,
 * значит фото снято спереди, и оно становится «лицом» модели. Фото сбоку или
 * с открытой дверцей не подходит — тогда модель рисуется без фото.
 */

export type Photo = { texture: THREE.Texture; aspect: number }

const PHOTO_HOST = 'https://api.smartcentr.store/api/v1/shop/photos/'

/** Фото с сервера каталога идут через сайт: иначе браузер не даст взять их в 3D. */
export function photoUrl(src: string): string | null {
  if (src.startsWith(PHOTO_HOST)) return `/api/kitchen/photo?src=${encodeURIComponent(src)}`
  if (src.startsWith('/')) return src
  return null
}

const cache = new Map<string, Promise<Photo | null>>()

export function loadPhoto(src: string): Promise<Photo | null> {
  const hit = cache.get(src)
  if (hit) return hit
  const url = photoUrl(src)
  const job = url ? decode(url) : Promise.resolve(null)
  cache.set(src, job)
  return job
}

function decode(url: string): Promise<Photo | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.decoding = 'async'
    img.onerror = () => resolve(null)
    img.onload = () => {
      try {
        resolve(trim(img))
      } catch {
        resolve(null)
      }
    }
    img.src = url
  })
}

function trim(img: HTMLImageElement): Photo | null {
  const scale = Math.min(1, 900 / Math.max(img.naturalWidth, img.naturalHeight))
  const w = Math.round(img.naturalWidth * scale)
  const h = Math.round(img.naturalHeight * scale)
  const src = document.createElement('canvas')
  src.width = w
  src.height = h
  const ctx = src.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(img, 0, 0, w, h)
  const data = ctx.getImageData(0, 0, w, h).data
  const ink = (i: number) => data[i + 3] > 24 && (data[i] < 232 || data[i + 1] < 232 || data[i + 2] < 232)

  // Строка или столбец считаются «товаром», если в них больше 1% цветных точек.
  const rows = new Array<number>(h).fill(0)
  const cols = new Array<number>(w).fill(0)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (ink((y * w + x) * 4)) {
        rows[y]++
        cols[x]++
      }
    }
  }
  const first = (a: number[], min: number) => a.findIndex((v) => v > min)
  const last = (a: number[], min: number) => a.length - 1 - [...a].reverse().findIndex((v) => v > min)
  const x0 = first(cols, h * 0.01)
  const x1 = last(cols, h * 0.01)
  const y0 = first(rows, w * 0.01)
  const y1 = last(rows, w * 0.01)
  if (x0 < 0 || y0 < 0 || x1 - x0 < 20 || y1 - y0 < 20) return null

  const cw = x1 - x0 + 1
  const ch = y1 - y0 + 1
  const out = document.createElement('canvas')
  out.width = cw
  out.height = ch
  out.getContext('2d')!.drawImage(src, x0, y0, cw, ch, 0, 0, cw, ch)
  const texture = new THREE.CanvasTexture(out)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  return { texture, aspect: cw / ch }
}

/** Фото годится как лицевая сторона: пропорции совпадают с размерами (±16%). */
export function fitsFront(photo: Photo | null | undefined, w: number, h: number): photo is Photo {
  if (!photo) return false
  return Math.abs(Math.log(photo.aspect / (w / h))) < 0.16
}
