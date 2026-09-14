// Визуальные доказательства: desktop/mobile и действующие пути покупки.
const { chromium } = require('@playwright/test')
const fs = require('node:fs/promises')
const path = require('node:path')

;(async () => {
  const out = path.resolve('review/light-lemon')
  await fs.mkdir(out, { recursive: true })
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  const cases = [
    ['desktop', '/ru', 1440, 1000], ['mobile', '/ru', 390, 844],
    ['desktop-ky', '/ky', 1440, 1000], ['mobile-ky', '/ky', 390, 844],
    ['user-1280', '/ru', 1280, 800],
    ['catalog-mobile', '/ru/catalog', 390, 844],
    ['product-desktop', '/ru/product/aura-x5', 1440, 1000],
    ['cart-mobile', '/ru/cart', 390, 844],
  ]
  const results = []
  for (const [name, route, width, height] of cases) {
    const page = await browser.newPage({ viewport: { width, height } })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(`http://localhost:3100${route}`, { waitUntil: 'networkidle' })
    await page.evaluate(() => document.fonts.ready)
    await page.screenshot({ path: path.join(out, `${name}.png`) })
    if (name === 'desktop' || name === 'mobile') {
      await page.screenshot({ path: path.join(out, `${name}-full.png`), fullPage: true })
    }
    const measurements = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > innerWidth,
      heading: document.querySelector('h1')?.textContent,
      primary: (() => { const b = document.querySelector('.btn--primary'); if (!b) return null; const s = getComputedStyle(b); return { color: s.color, background: s.backgroundColor } })(),
      font: getComputedStyle(document.body).fontFamily,
    }))
    results.push({ name, width, height, ...measurements, errors })
    await page.close()
  }
  await browser.close()
  await fs.writeFile(path.join(out, 'measurements.json'), JSON.stringify(results, null, 2))
  console.log(JSON.stringify(results, null, 2))
  if (results.some(r => r.overflow || r.errors.length)) process.exitCode = 1
})().catch(error => { console.error(error); process.exitCode = 1 })
