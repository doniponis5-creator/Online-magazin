import { MAX_PHOTO_BYTES, MAX_THUMB_BYTES } from './rules'

/**
 * Сжать фото в браузере перед отправкой.
 *
 * Фото с телефона весит 3–8 МБ — пять таких не пролезут в интернет на
 * мобильном и в предел nginx. Уменьшаем до 1600 px по длинной стороне и
 * сохраняем в JPEG: выходит 150–400 КБ. Не влезло — пробуем мельче.
 *
 * Заодно делаем маленькую копию на 640 px для карточки на главной: там фото
 * шириной 350 px, и грузить ради него 300 КБ незачем. Большое фото
 * открывается только по нажатию.
 *
 * Данные камеры, в том числе место съёмки, пропадают: холст рисует только
 * картинку. Поворот фото браузер учитывает сам.
 */
const FULL = [
  [1600, 0.82],
  [1200, 0.72],
  [900, 0.65],
] as const
const THUMB = [
  [640, 0.78],
  [480, 0.7],
] as const

function encode(img: HTMLImageElement, max: number, quality: number): Promise<Blob | null> {
  const width = img.naturalWidth
  const height = img.naturalHeight
  const scale = Math.min(1, max / Math.max(width, height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width * scale))
  canvas.height = Math.max(1, Math.round(height * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) return Promise.resolve(null)
  // Прозрачный PNG в JPEG стал бы чёрным — подкладываем белый.
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
}

async function fit(img: HTMLImageElement, steps: readonly (readonly [number, number])[], limit: number) {
  for (const [max, quality] of steps) {
    const blob = await encode(img, max, quality)
    if (blob && blob.size <= limit) return blob
  }
  return null
}

export async function shrinkPhoto(file: File): Promise<{ full: Blob; thumb: Blob | null }> {
  const url = URL.createObjectURL(file)
  try {
    // Ждём onload, а не img.decode(): decode в скрытой вкладке не завершается,
    // пока её не откроют, — форма висела бы на «Готовим фото…».
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = () => reject(new Error('photo-bad'))
      image.src = url
    })
    if (!img.naturalWidth || !img.naturalHeight) throw new Error('photo-bad')
    const full = await fit(img, FULL, MAX_PHOTO_BYTES)
    if (!full) throw new Error('photo-size')
    // Копия не получилась — не беда: карточка покажет большое фото.
    const thumb = await fit(img, THUMB, MAX_THUMB_BYTES)
    return { full, thumb }
  } finally {
    URL.revokeObjectURL(url)
  }
}
