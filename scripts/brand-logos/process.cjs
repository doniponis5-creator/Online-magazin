/**
 * Подготовка логотипов брендов для сайта.
 *
 * Берёт исходники из «public/Бренд лого», убирает фон (белый, чёрный или серый),
 * обрезает пустые края, приводит к одной высоте и сохраняет прозрачный WebP
 * в public/brands/<slug>.webp. Логотипы на тёмном фоне (светлый рисунок)
 * перекрашиваются в тёмный цвет, чтобы читались на светлой плитке.
 *
 * Запуск: node scripts/brand-logos/process.cjs
 */
const fs = require('fs')
const path = require('path')
const sharp = require('sharp')

const ROOT = path.resolve(__dirname, '..', '..')
const SRC = path.join(ROOT, 'public', 'Бренд лого')
const OUT = path.join(ROOT, 'public', 'brands')
// Список готовых логотипов для сайта: бренд → файл и размеры (src/components/BrandLogo.tsx)
const MANIFEST = path.join(ROOT, 'src', 'data', 'brand-logos.json')
const manifest = {}
const HEIGHT = 120 // высота холста; сам логотип вписывается с полями
const MAX_WIDTH = 420
const INK = [38, 50, 68] // --color-ink
// node process.cjs ARTEL HITACHI — переделать только эти; остальные остаются в списке как были
const ONLY = process.argv.slice(2).map((a) => a.toUpperCase())

// Имя файла (без расширения, в верхнем регистре) → бренд и настройки
const BRANDS = {
  ARNICA: { slug: 'arnica' },
  ARSHIA: { slug: 'arshia' },
  BRUCE: { slug: 'bruce' },
  BAOYU: { slug: 'baoyu' },
  EMIN: { slug: 'emin' },
  FERRE: { slug: 'ferre' },
  ITIMAT: { slug: 'itimat' },
  LEVO: { slug: 'levo' },
  TOEAR: { slug: 'toear' },
  UAKEEN: { slug: 'uakeen' },
  VELBERG: { slug: 'velberg' },
  AVANGARD: { slug: 'avangard' },
  'AVEST-LOGO-USER': { slug: 'avest' },
  ТЕХНОМИР: { slug: 'tehnomir' },
  // wikimedia/ — логотипы с Wikimedia Commons (см. public/Бренд лого/wikimedia/SOURCES.md)
  MIDEA: { slug: 'midea' },
  LG: { slug: 'lg' },
  SAMSUNG: { slug: 'samsung' },
  HISENSE: { slug: 'hisense' },
  PHILIPS: { slug: 'philips' },
  CHANGHONG: { slug: 'changhong' },
  ASKO: { slug: 'asko' },
  BOSCH: { slug: 'bosch' },
  BEKO: { slug: 'beko' },
  // Фирменный красный, только надпись: слоган «Inspire the Next» и полосу под ним отрезаем.
  HITACHI: { slug: 'hitachi', ink: [222, 0, 49], topBand: true },
  ARISTON: { slug: 'ariston' },
  GORENJE: { slug: 'gorenje' },
  SHIVAKI: { slug: 'shivaki' },
  // Белая надпись с зелёной шильды, перекрашенная в фирменный зелёный Artel.
  ARTEL: { slug: 'artel', mode: 'light', ink: [106, 180, 58] },
  // HANTAJI намеренно нет: исходник — фотография вывески, после обрезки
  // остаётся мутный серый прямоугольник. Текстовое начертание выглядит лучше.
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

/** Цвет фона — медиана пикселей по краям картинки. */
function backgroundColor(data, width, height, channels) {
  const r = [], g = [], b = []
  const push = (x, y) => {
    const i = (y * width + x) * channels
    const a = channels === 4 ? data[i + 3] : 255
    if (a < 20) return
    r.push(data[i]); g.push(data[i + 1]); b.push(data[i + 2])
  }
  for (let x = 0; x < width; x += 2) { push(x, 0); push(x, height - 1) }
  for (let y = 0; y < height; y += 2) { push(0, y); push(width - 1, y) }
  if (r.length === 0) return null // фон уже прозрачный
  return [median(r), median(g), median(b)]
}

/** Убирает фон один раз: возвращает PNG с прозрачным фоном, обрезанный по рисунку. */
async function removeBackground(input, brand) {
  // SVG растрируем с высокой плотностью, чтобы края были чёткими
  const isSvg = typeof input === 'string' && input.toLowerCase().endsWith('.svg')
  const { data, info } = await sharp(input, isSvg ? { density: 600 } : {}).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width, height, channels } = info
  // У картинки уже есть прозрачный фон (PNG/SVG-рендер) — фон не ищем, иначе цвет логотипа у края примем за фон.
  let transparent = 0
  for (let i = 3; i < data.length; i += channels) if (data[i] < 20) transparent++
  const alreadyTransparent = transparent > (width * height) * 0.02
  const bg = alreadyTransparent ? null : backgroundColor(data, width, height, channels)
  const bgLum = bg ? 0.299 * bg[0] + 0.587 * bg[1] + 0.114 * bg[2] : 255
  const darkBackground = bgLum < 90
  const threshold = brand.threshold ?? 60

  const out = Buffer.alloc(width * height * 4)
  for (let p = 0; p < width * height; p++) {
    const i = p * channels
    let [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]]
    if (brand.mode === 'light') {
      // светлый рисунок на цветной подложке с переливом (зелёная шильда Artel):
      // ищем не фон, а сам логотип — оставляем только светлые пиксели.
      const lum = 0.299 * r + 0.587 * g + 0.114 * b
      const t = Math.min(1, Math.max(0, (lum - 140) / 80))
      a = Math.round(a * t)
      ;[r, g, b] = brand.ink ?? INK
    } else if (brand.mode === 'chroma') {
      // фон — серый металл с переливом: оставляем только цветные пиксели логотипа
      const chroma = Math.max(r, g, b) - Math.min(r, g, b)
      const t = Math.min(1, Math.max(0, (chroma - 12) / 18))
      a = Math.round(a * t)
    } else if (bg) {
      const dist = Math.sqrt((r - bg[0]) ** 2 + (g - bg[1]) ** 2 + (b - bg[2]) ** 2)
      // плавный край: до threshold/3 — фон, после threshold — полностью рисунок
      const t = Math.min(1, Math.max(0, (dist - threshold / 3) / (threshold - threshold / 3)))
      a = Math.round(a * t)
    }
    if (darkBackground) [r, g, b] = INK
    if (brand.ink) [r, g, b] = brand.ink
    out[p * 4] = r; out[p * 4 + 1] = g; out[p * 4 + 2] = b; out[p * 4 + 3] = a
  }

  return sharp(out, { raw: { width, height, channels: 4 } }).trim({ threshold: 10 }).png().toBuffer()
}

/**
 * Оставить только верхнюю полосу рисунка — до первого пустого промежутка.
 * Нужна логотипам со слоганом под надписью (Hitachi «Inspire the Next»).
 */
async function firstBand(png) {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width, height, channels } = info
  const filled = (y) => {
    let n = 0
    for (let x = 0; x < width; x++) if (data[(y * width + x) * channels + 3] > 40) n++
    return n > width * 0.004
  }
  let top = 0
  while (top < height && !filled(top)) top++
  let bottom = top
  while (bottom < height && filled(bottom)) bottom++
  return sharp(png).extract({ left: 0, top, width, height: bottom - top }).trim({ threshold: 10 }).png().toBuffer()
}

async function processFile(file) {
  // «BEKO.render.png» — отрисованный браузером SVG (render-svg.cjs); исходный SVG тогда пропускаем
  const key = path.parse(file).name.split('.')[0].toUpperCase()
  if (!/\.(png|jpe?g|webp|svg)$/i.test(file)) return
  if (/\.svg$/i.test(file) && fs.existsSync(file.replace(/\.svg$/i, '.render.png'))) return
  const brand = BRANDS[key]
  if (ONLY.length && !ONLY.includes(key)) return
  if (!brand) {
    console.log(`  пропущен (нет в списке брендов): ${file}`)
    return
  }
  let trimmed = await removeBackground(file, brand)
  if (brand.topBand) trimmed = await firstBand(trimmed)
  // Фото логотипа на подложке (белая рамка, внутри серый металл): второй проход по новому краю.
  for (let pass = 0; pass < (brand.passes ?? 1) - 1; pass++) {
    trimmed = await removeBackground(trimmed, brand)
  }
  const target = path.join(OUT, `${brand.slug}.webp`)
  await sharp(trimmed)
    .resize({ height: HEIGHT, width: MAX_WIDTH, fit: 'inside', withoutEnlargement: false })
    .webp({ quality: 92, alphaQuality: 100 })
    .toFile(target)
  const meta = await sharp(target).metadata()
  // ?v=<хэш>: файл меняется — меняется адрес, и браузер не показывает старый логотип
  // ещё 4 часа из своего кэша (Cache-Control max-age=14400).
  const version = require('crypto').createHash('sha1').update(fs.readFileSync(target)).digest('hex').slice(0, 8)
  manifest[key] = { src: `/brands/${brand.slug}.webp?v=${version}`, w: meta.width, h: meta.height }
  console.log(`  ${brand.slug}.webp  ${meta.width}×${meta.height}`)
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const files = []
  for (const entry of fs.readdirSync(SRC, { withFileTypes: true })) {
    if (entry.isFile()) files.push(path.join(SRC, entry.name))
    if (entry.isDirectory()) {
      for (const inner of fs.readdirSync(path.join(SRC, entry.name))) {
        if (/\.(png|jpe?g|webp|svg)$/i.test(inner)) files.push(path.join(SRC, entry.name, inner))
      }
    }
  }
  if (ONLY.length) Object.assign(manifest, JSON.parse(fs.readFileSync(MANIFEST, 'utf8')))
  for (const file of files) await processFile(file)
  const sorted = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)))
  fs.writeFileSync(MANIFEST, JSON.stringify(sorted, null, 2) + '\n')
  console.log(`Список логотипов: ${MANIFEST}`)
}

main()
