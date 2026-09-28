// Картинки разделов для сетки «Категории» на главной.
//
// Берём фото НАШИХ товаров (снимки из 1С, права магазина) — чужие картинки из
// интернета не берём: у них есть владельцы (правила — ASSET_SOURCES.md).
// Каждое фото приводим к одному виду: срезаем белые поля, выравниваем размер
// товара и ставим в центр белого квадрата 320×320. Без этого холодильник
// занимал всю клетку, а чайник терялся в углу — сетка выглядела пёстро.
//
// Какой товар стоит на обложке раздела — список PICKS ниже (код товара на
// сайте: /ru/product/<код>). Поменять картинку: поправить код и запустить
//   node scripts/category-icons.mjs
// Товар может уже закончиться — не страшно: картинка раздела остаётся.
import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const root = path.resolve(import.meta.dirname, '..')
const outDir = path.join(root, 'public/img/categories')
/** Список готовых картинок для сайта (раздел → адрес). Его читает главная. */
const manifest = path.join(root, 'src/data/category-icons.json')
const SNAPSHOT = 'https://smarket.kg/api/catalog/snapshot'

/**
 * Раздел → товар, чьё фото стоит на обложке. Выбрано 28.09.2026.
 * [код, 1.15] — товар крупнее обычного: у пылесоса со шлангом рамка почти
 * пустая, и при общем размере он выглядел мельче соседей.
 */
const PICKS = {
  fridges: 'cb-00001994', // AVANGARD BCD-377WS — серебристый, двухкамерный
  washers: 'cb-00002386', // LG F2V5HG1W — белая, узнаваемый люк
  tv: 'cb-00002246', // LG 65NANO81A6A — яркий экран
  kitchen: 'cb-00002333', // ASKO 550BGFP — встраиваемая духовка
  'small-kitchen': 'cb-00001963', // MIDEA MK-8015 — стеклянный чайник
  care: ['cb-00002511', 1.15], // IDEAL VC-2010 — жёлтый пылесос, в цвет магазина; шланг «раздувает» рамку — чуть крупнее
  climate: 'cb-00002472', // CHIGO — сплит-система с пультом
  power: 'cb-00002104', // SIGMA XL-1000 — ИБП
  sewing: 'cb-00000456', // JANOME — домашняя швейная машина
  sport: 'cb-00002422', // электро-эндуро
  home: 'cb-00001771', // UAKEEN VK-22 — набор казанов
}

/** Сторона квадрата, px: в сетке он до 112 точек, на экране iPhone — ×3 ≈ 336. */
const SIZE = 320
/**
 * Размер товара в квадрате. Длинная сторона — не больше 84%, а «площадь»
 * одинаковая (√(ш×в) = 64% стороны): высокий холодильник и широкий телевизор
 * на глаз выглядят одного веса, а не одной высоты.
 */
const MAX_SIDE = 0.84
const AREA_SIDE = 0.64

const UA = { 'user-agent': 'Mozilla/5.0 (category-icons script; smarket.kg)' }

async function download(url) {
  const res = await fetch(url, { headers: UA })
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  return Buffer.from(await res.arrayBuffer())
}

async function icon(photo, zoom = 1) {
  // Фон снимков 1С — «почти белый» (250–254): чуть поднимаем яркость, чтобы он
  // стал чисто белым и слился с квадратом, потом срезаем поля вокруг товара.
  const cut = await sharp(photo)
    .flatten({ background: '#ffffff' })
    .linear(1.03, 0)
    .trim({ background: '#ffffff', threshold: 16 })
    .toBuffer({ resolveWithObject: true })
  const { width: w, height: h } = cut.info
  const k = Math.min((MAX_SIDE * SIZE) / Math.max(w, h), (zoom * AREA_SIDE * SIZE) / Math.sqrt(w * h))
  const rw = Math.round(w * k)
  const rh = Math.round(h * k)
  const product = await sharp(cut.data).resize(rw, rh, { kernel: 'lanczos3' }).toBuffer()
  return sharp({ create: { width: SIZE, height: SIZE, channels: 3, background: '#ffffff' } })
    .composite([{ input: product, left: Math.round((SIZE - rw) / 2), top: Math.round((SIZE - rh) / 2) }])
    .webp({ quality: 86 })
    .toBuffer()
}

const snapshot = await (await fetch(SNAPSHOT, { headers: UA })).json()
await mkdir(outDir, { recursive: true })
let failed = 0
/** ?v=<отпечаток файла>: картинку поменяли — у покупателя и в Cloudflare не останется старая */
const list = {}
for (const [cat, pick] of Object.entries(PICKS)) {
  const [id, zoom] = Array.isArray(pick) ? pick : [pick, 1]
  const item = snapshot.items.find((i) => i.id === id)
  if (!item?.img) {
    console.error(`✗ ${cat}: у товара ${id} нет фото в каталоге — выберите другой`)
    failed++
    continue
  }
  const file = path.join(outDir, `${cat}.webp`)
  const webp = await icon(await download(item.img), zoom)
  await writeFile(file, webp)
  list[cat] = `/img/categories/${cat}.webp?v=${createHash('sha1').update(webp).digest('hex').slice(0, 8)}`
  console.log(`✓ ${cat} ← ${item.n}`)
}
await writeFile(manifest, `${JSON.stringify(list, null, 2)}\n`)
if (failed) process.exitCode = 1
