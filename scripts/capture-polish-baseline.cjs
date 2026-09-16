// Базовые скриншоты перед polish-проходом: главная на desktop/mobile, обе локали.
const { chromium } = require('@playwright/test')
const path = require('node:path')

;(async () => {
  const out = path.resolve('review/polish')
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  const cases = [
    ['home-ru-1440', '/ru', 1440, 1000],
    ['home-ru-1280', '/ru', 1280, 800],
    ['home-ru-390', '/ru', 390, 844],
    ['home-ky-390', '/ky', 390, 844],
  ]
  for (const [name, route, width, height] of cases) {
    const page = await browser.newPage({ viewport: { width, height } })
    await page.goto(`http://localhost:3100${route}`, { waitUntil: 'networkidle' })
    await page.evaluate(() => document.fonts.ready)
    await page.waitForTimeout(600)
    await page.screenshot({ path: path.join(out, `${name}-viewport.png`) })
    await page.screenshot({ path: path.join(out, `${name}-full.png`), fullPage: true })
    await page.close()
  }
  await browser.close()
  console.log('done')
})().catch(e => { console.error(e); process.exit(1) })
