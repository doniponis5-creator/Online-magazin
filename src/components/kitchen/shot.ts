import { MAX_IMAGE_BYTES, MAX_PREVIEW_BYTES } from '@/lib/gallery/rules'

/**
 * Кадр 3D для галереи: большая картинка 1200×750 (≤ 400 КБ) и превью
 * 480×300 (≤ 80 КБ), JPEG. Уменьшаем в браузере, как фото отзывов
 * (`src/lib/reviews/shrink.ts`): не влезло — сжимаем сильнее.
 */
const FULL = [0.86, 0.78, 0.68, 0.58] as const
const THUMB = [0.8, 0.7, 0.6, 0.5] as const

function encode(img: HTMLImageElement, width: number, height: number, quality: number): Promise<Blob | null> {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return Promise.resolve(null)
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, width, height)
  // кадр подгоняем под 16:10 без искажения — лишнее по краям обрезается
  const scale = Math.max(width / img.naturalWidth, height / img.naturalHeight)
  const w = img.naturalWidth * scale
  const h = img.naturalHeight * scale
  ctx.drawImage(img, (width - w) / 2, (height - h) / 2, w, h)
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
}

async function fit(img: HTMLImageElement, width: number, height: number, steps: readonly number[], limit: number): Promise<Blob | null> {
  for (const q of steps) {
    const blob = await encode(img, width, height, q)
    if (blob && blob.size <= limit) return blob
  }
  return null
}

/** data URL кадра (`engine.snapshot`) → две картинки для `POST /api/gallery`. Ошибка — `shot`. */
export async function galleryShots(dataUrl: string): Promise<{ image: Blob; thumb: Blob }> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('shot'))
    image.src = dataUrl
  })
  if (!img.naturalWidth || !img.naturalHeight) throw new Error('shot')
  const image = await fit(img, 1200, 750, FULL, MAX_IMAGE_BYTES)
  const thumb = await fit(img, 480, 300, THUMB, MAX_PREVIEW_BYTES)
  if (!image || !thumb) throw new Error('shot')
  return { image, thumb }
}
