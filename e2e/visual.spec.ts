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
    const pages = ['/ru/', '/ru/catalog', '/ru/product/tabslate-10', '/ru/cart', '/ru/checkout']
    for (const path of pages) {
      await page.goto(path)
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      )
      expect(overflow, `${path} at ${width}px`).toBeLessThanOrEqual(1)
    }
  })
}

test('screenshots: key screens for review', async ({ page }, testInfo) => {
  const { writeFileSync, mkdirSync } = await import('node:fs')
  mkdirSync('review/task-03', { recursive: true })
  const dir = 'review/task-03'

  // мобильный RU
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/ru/')
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(500)
  writeFileSync(`${dir}/01-home-ru-390.png`, await page.screenshot())

  await page.goto('/ky/')
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(500)
  writeFileSync(`${dir}/03-home-ky-390.png`, await page.screenshot())

  // каталог с фильтром
  await page.goto('/ru/catalog?cat=smartphones')
  await page.waitForTimeout(400)
  writeFileSync(`${dir}/04-catalog-filtered-390.png`, await page.screenshot())

  // товар с фото и выбранным вариантом
  await page.goto('/ru/product/tabslate-10')
  await page.getByRole('button', { name: 'Тёмный', exact: true }).click()
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(400)
  writeFileSync(`${dir}/06-product-variant-390.png`, await page.screenshot())

  // корзина
  await page.evaluate(() =>
    localStorage.setItem(
      'sc-cart-v1',
      JSON.stringify([
        { productId: 'aura-x5', variantId: 'blue', qty: 1 },
        { productId: 'tabslate-10', variantId: 'ink-128', qty: 2 },
      ]),
    ),
  )
  await page.goto('/ru/cart')
  await page.waitForTimeout(400)
  writeFileSync(`${dir}/07-cart-390.png`, await page.screenshot())

  // checkout с демо-результатом
  await page.goto('/ru/checkout')
  await page.getByRole('textbox', { name: 'Ваше имя' }).fill('Азиз')
  await page.getByRole('textbox', { name: 'Телефон' }).fill('+996 700 123456')
  await page.getByRole('button', { name: 'Отправить заявку (демо)' }).click()
  await page.waitForTimeout(300)
  writeFileSync(`${dir}/08-checkout-demo-result-390.png`, await page.screenshot())

  // desktop 1440
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/ru/')
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(500)
  writeFileSync(`${dir}/09-home-ru-1440.png`, await page.screenshot())
})

test('animation recording: scroll reveals and add-to-cart swap', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    recordVideo: { dir: 'review/task-03', size: { width: 390, height: 844 } },
  })
  const page = await context.newPage()
  // чистая корзина: swap «в корзину → количество» произойдёт на карточке
  await page.addInitScript(() => localStorage.removeItem('sc-cart-v1'))
  await page.goto('/ru/')
  await page.waitForTimeout(600)
  // прокрутка: секции получают однократное появление (reveal)
  await page.evaluate(() => window.scrollBy(0, 500))
  await page.waitForTimeout(500)
  await page.evaluate(() => window.scrollBy(0, 600))
  await page.waitForTimeout(500)
  // добавление из каталога: кнопка превращается в количество
  await page.goto('/ru/catalog')
  await page.waitForTimeout(400)
  await page.locator('.card').first().getByRole('button', { name: 'В корзину' }).click()
  await page.waitForTimeout(600)
  await expect(page.locator('.card').first().locator('.stepper')).toBeVisible()
  await context.close()
})
