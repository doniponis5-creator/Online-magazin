import { expect, test } from '@playwright/test'

/**
 * Избранное: переключение сердечка, счётчик, сохранение после reload.
 */
test('favorites: toggle from card, survives reload, badge counts', async ({ page }) => {
  // контекст Playwright изолирован: хранилище изначально пустое
  await page.goto('/ru/catalog')

  const firstCard = page.locator('.card').first()
  await firstCard.getByRole('button', { name: 'Добавить в избранное' }).click()
  await expect(page.locator('.header__actions .icon-btn__badge')).toHaveText('1')

  // счётчик в шапке и состояние сердечка
  await expect(firstCard.getByRole('button', { name: 'Убрать из избранного' })).toHaveCount(1)

  // страница избранного показывает товар
  await page.goto('/ru/favorites')
  await expect(page.locator('.card')).toHaveCount(1)

  // сохранение после reload
  await page.reload()
  await expect(page.locator('.card')).toHaveCount(1)

  // пустое состояние после снятия
  await page.getByRole('button', { name: 'Убрать все' }).click()
  await expect(page.getByText('В избранном пока пусто')).toBeVisible()
})

test('keyboard: skip link works, focus visible on interactive elements', async ({ page }) => {
  await page.goto('/ru/')
  await page.keyboard.press('Tab')
  await expect(page.locator('.skip-link')).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.locator('#content')).toBeFocused()

  // Tab продолжает двигаться по интерактивным элементам шапки
  await page.keyboard.press('Tab')
  const focused = page.evaluate(() => document.activeElement?.tagName)
  await expect(await focused).toMatch(/A|BUTTON|INPUT/)
})

test('reduced motion: interactions still work with animations disabled', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
  })
  const page = await context.newPage()
  await page.addInitScript(() => localStorage.removeItem('sc-cart-v1'))
  await page.goto('/ru/product/aura-x5')
  await page.locator('.purchase__actions .btn--primary').click()
  await expect(page.locator('.header__actions .icon-btn__badge')).toHaveText('1')
  await context.close()
})

/**
 * Никакой горизонтальной прокрутки страницы на ключевых ширинах;
 * попутно сохраняем скриншоты ключевых экранов в review/.
 */
const widths = [360, 390, 768, 1440]

for (const width of widths) {
  test(`overflow: no horizontal page scroll at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    const pages = ['/ru/', '/ru/catalog', '/ru/product/tabslate-10', '/ru/cart', '/ru/checkout', '/ru/sources']
    for (const path of pages) {
      await page.goto(path)
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      )
      expect(overflow, `${path} at ${width}px`).toBeLessThanOrEqual(1)
    }
  })
}


/**
 * Доказательства для TASK 03A REVIEW FIXES:
 * - hero в начале/середине/конце его scroll-участка (desktop и mobile),
 *   прокрутка обычная (mouse.wheel), классы вручную не навешиваются;
 * - полностраничные RU/KY снимки главной и каталога, товар с плейсхолдером;
 * - зум — только на изолированной фикстуре;
 * - короткая запись нормальной прокрутки и покупки (видео переименовываем,
 *   черновые page@*.webm не остаются).
 */
test('screenshots: hero scene at start/middle/end of its scroll range', async ({ page }) => {
  const { writeFileSync, mkdirSync } = await import('node:fs')
  mkdirSync('review/task-03a', { recursive: true })
  const dir = 'review/task-03a'

  for (const [width, height] of [
    [1440, 900],
    [390, 844],
  ] as const) {
    await page.setViewportSize({ width, height })
    await page.goto('/ru/')
    // нормальные позиции прокрутки внутри sticky-участка hero:
    // начало (машина 3/4), середина (TurboWash™360°), конец (машина собрана)
    const range = await page.evaluate(() => {
      const root = document.querySelector('.hero3d') as HTMLElement | null
      const sticky = document.querySelector('.hero3d__sticky') as HTMLElement | null
      return root && sticky ? root.offsetHeight - sticky.offsetHeight : 400
    })
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.waitForTimeout(350)
    writeFileSync(`${dir}/hero-${width}-start.png`, await page.screenshot())

    await page.evaluate((r) => window.scrollTo(0, Math.round(r * 0.4)), range)
    await page.waitForTimeout(350)
    writeFileSync(`${dir}/hero-${width}-middle.png`, await page.screenshot())

    await page.evaluate((r) => window.scrollTo(0, Math.round(r)), range)
    await page.waitForTimeout(350)
    writeFileSync(`${dir}/hero-${width}-end.png`, await page.screenshot())
  }
})

test('screenshots: full-page key screens for review', async ({ page }) => {
  const { writeFileSync, mkdirSync } = await import('node:fs')
  mkdirSync('review/task-03a', { recursive: true })
  const dir = 'review/task-03a'

  // перед полноэкранной съёмкой раскрываем reveal-секции: иначе низ страницы
  // попадёт в снимок ещё прозрачным
  const revealAll = async () => {
    await page.evaluate(async () => {
      await new Promise<void>((resolve) => {
        let y = 0
        const step = () => {
          y += 420
          window.scrollTo(0, y)
          if (y < document.documentElement.scrollHeight) setTimeout(step, 110)
          else resolve()
        }
        step()
      })
      window.scrollTo(0, 0)
    })
    await page.waitForTimeout(650)
  }

  // мобильный 390: RU и KY, главная и каталог — полностранично
  await page.setViewportSize({ width: 390, height: 844 })
  for (const [tag, path] of [
    ['home-ru-390', '/ru/'],
    ['home-ky-390', '/ky/'],
    ['catalog-ru-390', '/ru/catalog'],
    ['catalog-ky-390', '/ky/catalog'],
  ] as const) {
    await page.goto(path)
    await revealAll()
    writeFileSync(`${dir}/${tag}-full.png`, await page.screenshot({ fullPage: true }))
  }

  // товар с плейсхолдером и выбранным вариантом
  await page.goto('/ru/product/tabslate-10')
  await page.getByRole('button', { name: 'Тёмный', exact: true }).click()
  await revealAll()
  writeFileSync(`${dir}/product-ru-390-full.png`, await page.screenshot({ fullPage: true }))

  // зум доступного dialog — снимок с изолированной фикстуры
  await page.goto('/ru/dev/gallery?fixture=zoom')
  await page.locator('.gallery__main--zoom').click()
  await expect(page.locator('.zoom-overlay[open]')).toBeVisible()
  await page.waitForTimeout(400)
  writeFileSync(`${dir}/zoom-fixture-390.png`, await page.screenshot())
  await page.keyboard.press('Escape')

  // desktop 1440: RU и KY главная + каталог
  await page.setViewportSize({ width: 1440, height: 900 })
  for (const [tag, path] of [
    ['home-ru-1440', '/ru/'],
    ['home-ky-1440', '/ky/'],
    ['catalog-ru-1440', '/ru/catalog'],
  ] as const) {
    await page.goto(path)
    await revealAll()
    writeFileSync(`${dir}/${tag}-full.png`, await page.screenshot({ fullPage: true }))
  }
})

test('video: normal scroll through hero + add to cart', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    recordVideo: { dir: 'review/task-03a', size: { width: 390, height: 844 } },
  })
  const page = await context.newPage()
  await page.addInitScript(() => localStorage.removeItem('sc-cart-v1'))
  await page.goto('/ru/')
  await page.waitForTimeout(600)
  // нормальная прокрутка пользователя через hero к ассортименту
  for (let i = 0; i < 6; i++) {
    await page.mouse.wheel(0, 260)
    await page.waitForTimeout(320)
  }
  // покупка: добавление из каталога, кнопка превращается в количество
  await page.goto('/ru/catalog')
  await page.waitForTimeout(400)
  await page.locator('.card').first().getByRole('button', { name: 'В корзину' }).click()
  await expect(page.locator('.card').first().locator('.stepper')).toBeVisible()
  await context.close()

  // черновые page@*.webm не оставляем: видео фиксируем осмысленным именем
  const { readdirSync, renameSync } = await import('node:fs')
  const drafts = readdirSync('review/task-03a').filter((f) => f.startsWith('page@'))
  if (drafts.length > 0) {
    drafts.sort()
    renameSync(`review/task-03a/${drafts[drafts.length - 1]}`, 'review/task-03a/scroll-hero-purchase.webm')
    for (const d of drafts.slice(0, -1)) {
      try {
        renameSync(`review/task-03a/${d}`, `review/task-03a/_draft-${d}`)
      } catch {
        // уже переименован
      }
    }
  }
})
