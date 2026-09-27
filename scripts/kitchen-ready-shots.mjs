#!/usr/bin/env node
/**
 * Кадры 3D для готовых кухонь (src/data/kitchen-ready.ts) →
 * public/kitchen/ready/<id>.jpg (1200×750), <id>-s.jpg (480×300), <id>-card.jpg (1200×630).
 *
 * Снимает сам конструктор на живом сайте (там полный каталог техники):
 * открывает <BASE>/ru/kitchen?<q> и берёт общий вид «3D» (engine.sheetShot) —
 * тот же кадр, что на листе мастера. Движок находится через React-дерево
 * страницы (на dev-сервере ещё и window.__kp); код сайта не меняется.
 * Только GET: все прочие запросы страницы (POST /api/visit — счётчик
 * посещений и т. п.) браузер обрывает, на сайт ничего не отправляется.
 *
 * Запуск (из корня проекта):
 *   node scripts/kitchen-ready-shots.mjs                 # все 12
 *   node scripts/kitchen-ready-shots.mjs island-450-gold # одну или несколько
 *   node scripts/kitchen-ready-shots.mjs --fixture       # обновить технику в
 *        __tests__/fixtures/kitchen-live-appliances.json (по ней проверяет тест)
 *
 * Настройки: BASE (адрес сайта, по умолчанию https://smarket.kg; для
 * dev-сервера — BASE=http://localhost:3113), NO_GPU=1 — без видеокарты.
 * Браузер — установленный Google Chrome (Playwright свой не скачивает);
 * другой путь — CHROME=…, например на Windows (PowerShell):
 *   $env:CHROME = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
 *   node scripts/kitchen-ready-shots.mjs
 * (NO_GPU=1 на Windows обычно не нужен: там Chrome рисует через свой ANGLE.)
 */
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'public', 'kitchen', 'ready')
const BASE = (process.env.BASE || 'https://smarket.kg').replace(/\/+$/, '')
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const LIMIT = 245 * 1024 // тест требует ≤ 250 КБ
const STEP_MS = 90_000 // одна кухня дольше — перезапуск браузера

/** Кухни из src/data/kitchen-ready.ts: kitchen('<id>', '<q>', …). */
function readyList() {
  const src = readFileSync(join(ROOT, 'src', 'data', 'kitchen-ready.ts'), 'utf8')
  return [...src.matchAll(/kitchen\(\s*'([a-z0-9-]+)',\s*'([^']+)'/g)].map(([, id, q]) => ({ id, q }))
}

async function launch() {
  const gpu = process.env.NO_GPU ? [] : ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist']
  return chromium.launch({ executablePath: CHROME, headless: true, args: gpu })
}

const FIXTURE = join(ROOT, '__tests__', 'fixtures', 'kitchen-live-appliances.json')

/**
 * Техника конструктора из данных страницы: KitchenPlanner получает
 * `appliances` (id, слот, размеры, цена) — они лежат в потоке RSC
 * (self.__next_f). В списке только товары с ценой и в наличии.
 */
async function liveAppliances() {
  const res = await fetch(`${BASE}/ru/kitchen`)
  if (!res.ok) throw new Error(`${BASE}/ru/kitchen: ${res.status}`)
  const html = await res.text()
  let text = ''
  for (const m of html.matchAll(/self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g)) text += JSON.parse(m[1])
  const at = text.indexOf('"appliances":[')
  if (at < 0) throw new Error('на странице нет списка техники')
  const start = text.indexOf('[', at)
  let depth = 0
  let end = start
  for (; end < text.length; end++) {
    const c = text[end]
    if (c === '"') {
      for (end++; text[end] !== '"'; end++) if (text[end] === '\\') end++
      continue
    }
    if (c === '[' || c === '{') depth++
    if ((c === ']' || c === '}') && --depth === 0) break
  }
  // RSC пишет undefined как "$undefined"; фото в фикстуре не нужно
  const clean = (a) => Object.fromEntries(Object.entries(a).filter(([k, v]) => v !== '$undefined' && v != null && k !== 'image'))
  return JSON.parse(text.slice(start, end + 1)).map(clean)
}

async function writeFixture() {
  const list = (await liveAppliances()).filter((a) => a.slot !== 'washer').sort((x, y) => x.slot.localeCompare(y.slot) || x.price - y.price)
  const head = { source: `${BASE}/ru/kitchen`, fetched: new Date().toISOString().slice(0, 10), note: 'Техника конструктора с живого сайта: полный каталог 1С, всё в наличии. Обновить: node scripts/kitchen-ready-shots.mjs --fixture' }
  const body = list.map((a) => '    ' + JSON.stringify(a)).join(',\n')
  writeFileSync(FIXTURE, JSON.stringify(head, null, 2).replace(/\n\}$/, `,\n  "appliances": [\n${body}\n  ]\n}\n`))
  const bySlot = {}
  for (const a of list) bySlot[a.slot] = (bySlot[a.slot] ?? 0) + 1
  console.log(`${FIXTURE}: ${list.length}`, bySlot)
}

/** Движок 3D на странице: window.__kp (dev) или ref из хуков KitchenPlanner. */
const FIND_ENGINE = `(() => {
  if (window.__kp) return window.__kp
  const host = document.querySelector('.kp-scene')
  const key = host && Object.keys(host).find((k) => k.startsWith('__reactFiber$'))
  for (let f = key ? host[key] : null; f; f = f.return) {
    for (let h = f.memoizedState; h && typeof h === 'object' && 'next' in h; h = h.next) {
      const v = h.memoizedState
      if (v && typeof v === 'object' && v.current && typeof v.current.sheetShot === 'function') return v.current
    }
  }
  return null
})()`

const withTimeout = (p, ms, what) =>
  Promise.race([p, new Promise((_, reject) => setTimeout(() => reject(new Error(`${what}: дольше ${ms / 1000} с`)), ms))])

async function shoot(browser, { id, q }) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  // только чтение: POST /api/visit и любые не-GET запросы не уходят на сайт
  await page.route('**/*', (r) => (r.request().method() === 'GET' ? r.continue() : r.abort()))
  try {
    await page.goto(`${BASE}/ru/kitchen?${q}`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
    // движок собран и кухня построена
    await page.waitForFunction(`Boolean(${FIND_ENGINE}?.built)`, null, { timeout: 60_000, polling: 250 })
    await page.evaluate(`${FIND_ENGINE}.setQuality('hd')`)
    // фото техники и текстуры догружаются
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})
    await page.waitForTimeout(2500)
    return await page.evaluate(async ([limit, find]) => {
      const kp = (0, eval)(find)
      const load = (url) =>
        new Promise((resolve, reject) => {
          const img = new Image()
          img.onload = () => resolve(img)
          img.onerror = reject
          img.src = url
        })
      /** JPEG нужного размера, качество снижается, пока файл не влезет в лимит. */
      const jpeg = (img, w, h) => {
        const c = document.createElement('canvas')
        c.width = w
        c.height = h
        const ctx = c.getContext('2d')
        ctx.imageSmoothingQuality = 'high'
        ctx.drawImage(img, 0, 0, w, h)
        for (let quality = 0.88; ; quality -= 0.04) {
          const url = c.toDataURL('image/jpeg', quality)
          if (url.length * 0.75 <= limit || quality < 0.5) return url
        }
      }
      const wide = await load(kp.sheetShot(1200, 750))
      const card = await load(kp.sheetShot(1200, 630))
      return { image: jpeg(wide, 1200, 750), thumb: jpeg(wide, 480, 300), card: jpeg(card, 1200, 630) }
    }, [LIMIT, FIND_ENGINE])
  } finally {
    await page.close().catch(() => {})
  }
}

function save(id, shots) {
  mkdirSync(OUT, { recursive: true })
  const files = { image: `${id}.jpg`, thumb: `${id}-s.jpg`, card: `${id}-card.jpg` }
  for (const [key, name] of Object.entries(files)) {
    const file = join(OUT, name)
    writeFileSync(file, Buffer.from(shots[key].split(',')[1], 'base64'))
    console.log(`  ${name} ${Math.round(statSync(file).size / 1024)} КБ`)
  }
}

if (process.argv.includes('--fixture')) {
  await writeFixture()
  process.exit(0)
}

const only = process.argv.slice(2)
const list = readyList().filter((k) => only.length === 0 || only.includes(k.id))
if (list.length === 0) {
  console.error('Нет таких кухонь в src/data/kitchen-ready.ts')
  process.exit(1)
}

let browser = await launch()
let failed = 0
try {
  for (const k of list) {
    console.log(`${k.id}`)
    for (let attempt = 1; ; attempt++) {
      try {
        save(k.id, await withTimeout(shoot(browser, k), STEP_MS, k.id))
        break
      } catch (e) {
        console.error(`  не вышло (${attempt}): ${e.message}`)
        await browser.close().catch(() => {})
        browser = await launch()
        if (attempt >= 2) {
          failed++
          break
        }
      }
    }
  }
} finally {
  await browser.close().catch(() => {})
}
process.exit(failed ? 1 : 0)
