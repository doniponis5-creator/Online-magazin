/**
 * Растрирует SVG-логотипы через браузер (Edge/Chromium): он понимает стили,
 * маски и градиенты, которые пропускает встроенный в sharp обработчик SVG.
 * Результат — PNG с прозрачным фоном рядом с исходником; дальше их берёт process.cjs.
 *
 * Запуск: node scripts/brand-logos/render-svg.cjs
 */
const fs = require('fs')
const path = require('path')
const { chromium } = require('@playwright/test')

const DIR = path.resolve(__dirname, '..', '..', 'public', 'Бренд лого', 'wikimedia')

;(async () => {
  const browser = await chromium.launch({ channel: 'msedge' })
  const page = await browser.newPage({ deviceScaleFactor: 1 })
  for (const file of fs.readdirSync(DIR).filter((f) => f.toLowerCase().endsWith('.svg'))) {
    const svg = fs.readFileSync(path.join(DIR, file), 'utf8')
    const dataUrl = 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64')
    await page.setContent(
      `<html><body style="margin:0;background:transparent"><img id="logo" src="${dataUrl}" style="display:block;height:600px;width:auto"></body></html>`,
    )
    await page.waitForFunction(() => document.getElementById('logo').complete)
    const box = await page.locator('#logo').boundingBox()
    if (!box || box.width < 2) {
      console.log(`  не удалось отрисовать: ${file}`)
      continue
    }
    await page.setViewportSize({ width: Math.ceil(box.width), height: 600 })
    const out = path.join(DIR, file.replace(/\.svg$/i, '.render.png'))
    await page.locator('#logo').screenshot({ path: out, omitBackground: true })
    console.log(`  ${path.basename(out)}  ${Math.round(box.width)}×600`)
  }
  await browser.close()
})()
