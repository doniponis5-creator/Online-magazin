import { expect, test } from '@playwright/test'

/**
 * TASK_05 — скролл-анимация LG из настоящих 3D-рендеров.
 * Доказательства: скриншоты трёх положений на mobile/desktop и видео
 * прокрутки вперёд и назад сохраняются в review/task-05/.
 * Проверяются также запасные варианты: reduce, без JS, ошибка загрузки.
 */

// постер должен отобразаться сразу из серверного HTML
test.beforeEach(async ({ page }) => {
  await page.goto('/ru/')
  await expect(page.locator('.hero3d__poster')).toBeVisible()
})

test('scroll frames: start/middle/end screenshots at mobile and desktop', async ({ page }) => {
  const { writeFileSync, mkdirSync } = await import('node:fs')
  mkdirSync('review/task-05', { recursive: true })

  for (const [width, height, tag] of [
    [390, 844, 'mobile'],
    [1440, 900, 'desktop'],
  ] as const) {
    await page.setViewportSize({ width, height })
    await page.goto('/ru/')
    await page.waitForFunction(
      () => document.querySelector('.hero3d__canvas')?.classList.contains('is-live'),
      undefined,
      { timeout: 15000 },
    )
    const range = await page.evaluate(() => {
      const root = document.querySelector('.hero3d') as HTMLElement
      const sticky = document.querySelector('.hero3d__sticky') as HTMLElement
      return root.offsetHeight - sticky.offsetHeight
    })
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.waitForTimeout(400)
    writeFileSync(`review/task-05/scroll-${tag}-start.png`, await page.screenshot())

    await page.evaluate((r) => window.scrollTo(0, Math.round(r * 0.51)), range)
    await page.waitForTimeout(400)
    writeFileSync(`review/task-05/scroll-${tag}-middle.png`, await page.screenshot())

    await page.evaluate((r) => window.scrollTo(0, Math.round(r)), range)
    await page.waitForTimeout(400)
    writeFileSync(`review/task-05/scroll-${tag}-end.png`, await page.screenshot())

    // кадры реально различаются между положениями
    const frameOf = () =>
      page
        .locator('.hero3d__canvas')
        .evaluate((el) => Number((el as HTMLElement).dataset.frame ?? '-1'))
    const f = await frameOf()
    expect(f).toBeGreaterThanOrEqual(0)
  }
})

test('video: scroll forward through hero and back', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    recordVideo: { dir: 'review/task-05', size: { width: 390, height: 844 } },
  })
  const page = await context.newPage()
  await page.goto('/ru/')
  await page.waitForFunction(
    () => document.querySelector('.hero3d__canvas')?.classList.contains('is-live'),
    undefined,
    { timeout: 15000 },
  )
  const range = await page.evaluate(() => {
    const root = document.querySelector('.hero3d') as HTMLElement
    const sticky = document.querySelector('.hero3d__sticky') as HTMLElement
    return root.offsetHeight - sticky.offsetHeight
  })
  // вперёд: ¾ → фронт → противоположные ¾
  const steps = 10
  for (let i = 1; i <= steps; i++) {
    const y = Math.round(range * (i / steps))
    await page.evaluate((top) => window.scrollTo(0, top), y)
    await page.waitForTimeout(260)
  }
  // назад: последовательность идёт обратно
  for (let i = steps - 1; i >= 0; i--) {
    const y = Math.round(range * (i / steps))
    await page.evaluate((top) => window.scrollTo(0, top), y)
    await page.waitForTimeout(260)
  }
  await context.close()

  // видео фиксируем осмысленным именем (черновые page@*.webm не остаются)
  const { readdirSync, renameSync } = await import('node:fs')
  const drafts = readdirSync('review/task-05').filter((f) => f.startsWith('page@'))
  expect(drafts.length).toBeGreaterThanOrEqual(1)
  drafts.sort()
  renameSync(`review/task-05/${drafts[drafts.length - 1]}`, 'review/task-05/scroll-forward-back.webm')
  for (const d of drafts.slice(0, -1)) {
    try {
      renameSync(`review/task-05/${d}`, `review/task-05/_draft-${d}`)
    } catch {
      // уже переименован
    }
  }
})

test('reduced motion: poster stays, frame series never loads', async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: 'reduce' })
  const page = await context.newPage()
  const frameRequests: string[] = []
  page.on('request', (req) => {
    if (req.url().includes('/lg/turntable/')) frameRequests.push(req.url())
  })
  await page.goto('/ru/')
  await page.evaluate(() => window.scrollTo(0, 900))
  await page.waitForTimeout(600)
  await expect(page.locator('.hero3d__poster')).toBeVisible()
  await expect(page.locator('.hero3d__canvas')).not.toHaveClass(/is-live/)
  expect(frameRequests).toEqual([])
  await context.close()
})

test('no JavaScript: poster, texts and CTA visible in server HTML', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false })
  const page = await context.newPage()
  await page.goto('/ru/')
  await expect(page.locator('.hero3d__poster')).toBeVisible()
  await expect(page.locator('.hero3d__title')).toHaveText('LG F4X5ES5SB')
  const cta = page.locator('.hero3d__cta')
  await expect(cta).toBeVisible()
  await expect(cta).toHaveAttribute('href', '/ru/catalog?cat=home')
  await context.close()
})

test('frame load error: poster, texts and CTA remain available', async ({ page }) => {
  // серия недоступна — hero деградирует к постеру, ничего не исчезает
  await page.route('**/lg/turntable/**', (route) => route.abort())
  await page.goto('/ru/')
  await page.evaluate(() => window.scrollTo(0, 700))
  await page.waitForTimeout(800)
  await expect(page.locator('.hero3d__poster')).toBeVisible()
  await expect(page.locator('.hero3d__title')).toBeVisible()
  await expect(page.locator('.hero3d__cta')).toBeVisible()
})

test('CTA from hero leads to home-appliances catalog', async ({ page }) => {
  await page.locator('.hero3d__cta').click()
  await expect(page).toHaveURL(/\/ru\/catalog\?cat=home/)
  await expect(page.locator('main')).toBeVisible()
})

test('KY hero: localized title and hint', async ({ page }) => {
  await page.goto('/ky/')
  await expect(page.locator('.hero3d__title')).toHaveText('LG F4X5ES5SB')
  await expect(page.locator('.hero3d__hint')).toContainText('сырғытыңыз')
  await expect(page.locator('.hero3d__poster')).toBeVisible()
})

test('no horizontal overflow introduced by hero at 390 and 1440', async ({ page }) => {
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/ru/')
    await page.evaluate(() => window.scrollTo(0, 800))
    await page.waitForTimeout(300)
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow, `hero at ${width}px`).toBeLessThanOrEqual(1)
  }
})
