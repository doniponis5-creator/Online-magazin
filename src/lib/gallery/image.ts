/**
 * Картинки галереи: размер по заголовку файла и срез EXIF.
 *
 * Размер читаем из байтов, а не из формы: картинка 20000×20000 весит мало, но
 * браузер, открывший её, тратит сотни мегабайт памяти. Больше 4000 px по
 * стороне не берём. Размер не прочитался — тоже не берём.
 *
 * EXIF и прочие метаданные (APP1 у JPEG; eXIf/tEXt/iTXt/zTXt у PNG; EXIF/XMP у
 * WebP) несут координаты съёмки и модель телефона — фото «я сделал такую»
 * снято дома у автора. Срезаем до записи на диск.
 */

/** Самая длинная сторона картинки, px. */
export const MAX_SIDE = 4000

export type Size = { width: number; height: number }

const u16be = (b: Uint8Array, i: number) => (b[i] << 8) | b[i + 1]
const u32be = (b: Uint8Array, i: number) => ((b[i] << 24) >>> 0) + (b[i + 1] << 16) + (b[i + 2] << 8) + b[i + 3]
const u24le = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8) | (b[i + 2] << 16)
const ascii = (b: Uint8Array, i: number, n: number) => String.fromCharCode(...b.subarray(i, i + n))

/** Маркеры без длины: RST0–RST7, TEM. */
const standalone = (m: number) => (m >= 0xd0 && m <= 0xd7) || m === 0x01
/** Кадр (SOF): C0–CF, кроме DHT (C4), JPG (C8), DAC (CC). */
const isSof = (m: number) => m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc

function jpegSize(b: Uint8Array): Size | null {
  let i = 2
  while (i + 3 < b.length) {
    if (b[i] !== 0xff) return null
    const m = b[i + 1]
    if (m === 0xff) {
      i += 1
      continue
    }
    if (standalone(m)) {
      i += 2
      continue
    }
    if (m === 0xda || m === 0xd9) return null
    const len = u16be(b, i + 2)
    if (len < 2) return null
    if (isSof(m)) return i + 8 < b.length ? { height: u16be(b, i + 5), width: u16be(b, i + 7) } : null
    i += 2 + len
  }
  return null
}

function webpSize(b: Uint8Array): Size | null {
  const chunk = ascii(b, 12, 4)
  if (chunk === 'VP8 ' && b.length >= 30) return { width: (b[26] | (b[27] << 8)) & 0x3fff, height: (b[28] | (b[29] << 8)) & 0x3fff }
  if (chunk === 'VP8L' && b.length >= 25) {
    return {
      width: 1 + (((b[22] & 0x3f) << 8) | b[21]),
      height: 1 + (((b[24] & 0x0f) << 10) | (b[23] << 2) | ((b[22] & 0xc0) >> 6)),
    }
  }
  if (chunk === 'VP8X' && b.length >= 30) return { width: 1 + u24le(b, 24), height: 1 + u24le(b, 27) }
  return null
}

/** Ширина и высота по заголовку JPEG/PNG/WebP; не прочитался — null. */
export function imageSize(b: Uint8Array): Size | null {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return jpegSize(b)
  if (b.length >= 24 && b[0] === 0x89 && ascii(b, 1, 3) === 'PNG' && ascii(b, 12, 4) === 'IHDR') {
    return { width: u32be(b, 16), height: u32be(b, 20) }
  }
  if (b.length >= 16 && ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WEBP') return webpSize(b)
  return null
}

/** Картинка в пределах: размер прочитан, обе стороны от 1 до 4000 px. */
export function sizeOk(b: Uint8Array): boolean {
  const s = imageSize(b)
  return Boolean(s && s.width >= 1 && s.height >= 1 && s.width <= MAX_SIDE && s.height <= MAX_SIDE)
}

/**
 * JPEG без сегментов APP1 (EXIF, XMP). Всё до начала данных (SOS) идёт
 * сегментами — их и перебираем; сами данные копируются как есть.
 * Сломанный заголовок — null: такую картинку не берём.
 */
export function stripExif(b: Uint8Array): Uint8Array | null {
  const out: Uint8Array[] = [b.subarray(0, 2)]
  let i = 2
  while (i + 1 < b.length) {
    if (b[i] !== 0xff) return null
    const m = b[i + 1]
    if (m === 0xda || m === 0xd9) {
      out.push(b.subarray(i))
      break
    }
    if (m === 0xff) {
      i += 1
      continue
    }
    if (standalone(m)) {
      out.push(b.subarray(i, i + 2))
      i += 2
      continue
    }
    if (i + 3 >= b.length) return null
    const end = i + 2 + u16be(b, i + 2)
    if (end > b.length || end < i + 4) return null
    if (m !== 0xe1) out.push(b.subarray(i, end))
    i = end
  }
  return join(out)
}

/** Чанки PNG с текстом и EXIF: имя автора, программа, координаты. */
const PNG_META = new Set(['eXIf', 'tEXt', 'iTXt', 'zTXt'])

/** PNG без чанков метаданных. Чанки идут подряд: длина, тип, данные, CRC. */
function stripPng(b: Uint8Array): Uint8Array | null {
  const out: Uint8Array[] = [b.subarray(0, 8)]
  let i = 8
  while (i < b.length) {
    if (i + 12 > b.length) return null
    const end = i + 12 + u32be(b, i)
    if (end > b.length) return null
    if (!PNG_META.has(ascii(b, i + 4, 4))) out.push(b.subarray(i, end))
    i = end
  }
  return join(out)
}

/**
 * WebP без чанков EXIF и XMP. Контейнер RIFF: после чанков пересчитываем его
 * длину, а в VP8X снимаем флаги «есть EXIF» (0x08) и «есть XMP» (0x04).
 */
function stripWebp(b: Uint8Array): Uint8Array | null {
  const out: Uint8Array[] = []
  let i = 12
  while (i < b.length) {
    if (i + 8 > b.length) return null
    const size = b[i + 4] | (b[i + 5] << 8) | (b[i + 6] << 16) | (b[i + 7] << 24)
    const end = i + 8 + size + (size % 2)
    if (size < 0 || end > b.length) return null
    const type = ascii(b, i, 4)
    if (type === 'VP8X') {
      const chunk = b.slice(i, end)
      chunk[8] &= ~0x0c
      out.push(chunk)
    } else if (type !== 'EXIF' && type !== 'XMP ') {
      out.push(b.subarray(i, end))
    }
    i = end
  }
  const body = join(out)
  const riff = new Uint8Array(12 + body.length)
  riff.set(b.subarray(0, 12))
  const size = body.length + 4
  riff.set([size & 255, (size >> 8) & 255, (size >> 16) & 255, (size >>> 24) & 255], 4)
  riff.set(body, 12)
  return riff
}

function join(parts: Uint8Array[]): Uint8Array {
  const all = new Uint8Array(parts.reduce((s, p) => s + p.length, 0))
  let at = 0
  for (const part of parts) {
    all.set(part, at)
    at += part.length
  }
  return all
}

/** Картинка без метаданных (EXIF, XMP, текст) — по формату; сломанная — null. */
export function stripMeta(b: Uint8Array, ext: 'jpg' | 'png' | 'webp'): Uint8Array | null {
  return ext === 'jpg' ? stripExif(b) : ext === 'png' ? stripPng(b) : stripWebp(b)
}
