import { expect, test } from '@playwright/test'

/**
 * TASK 03A регрессии (только ошибки из дизайн-ревью):
 * 1) alt реальных изображений следует языку страницы (KY, а не всегда RU);
 * 2) видимая маркировка «Иллюстрация категории» на карточке, в галерее и в зуме;
 * 3) reveal-анимация регистрируется после клиентских переходов, cleanup
 *    оставляет контент видимым, reduced-motion уважается — включая смену
 *    системной настройки уже после загрузки страницы;
 * 4) страница источников фото доступна из footer.
 */

test('alt: KY pages show Kyrgyz alt text for real photos', async ({ page }) => {
  await page.goto('/ky/')
  // карточки с фото: alt на кыргызском
  await expect(
    page.locator('.card__media-link img[alt*="демо сүрөтү"]').first(),
  ).toBeVisible()
  // русской подписи на кыргызской странице быть не должно
  await expect(
    page.locator('.card__media-link img[alt*="демо-изображение категории"]'),
  ).toHaveCount(0)
  // каталог — тот же продукт, тот же язык
  await page.goto('/ky/catalog')
  await expect(
    page.locator('.card__media-link img[alt*="демо сүрөтү"]').first(),
  ).toBeVisible()
})

test('alt: RU pages show Russian alt text for real photos', async ({ page }) => {
  await page.goto('/ru/')
  await expect(
    page.locator('.card__media-link img[alt*="демо-изображение категории"]').first(),
  ).toBeVisible()
  await expect(
    page.locator('.card__media-link img[alt*="демо сүрөтү"]'),
  ).toHaveCount(0)
})

test('badge: «Иллюстрация категории» visible on card, in gallery and in zoom', async ({
  page,
}) => {
  await page.goto('/ru/')
  const cardBadge = page.locator('.card__photo-badge').first()
  await expect(cardBadge).toBeVisible()
  await expect(cardBadge).toHaveText('Иллюстрация категории')

  // страница товара: бейдж у главной фото и заметка о соответствии цвету
  await page.goto('/ru/product/tabslate-10')
  await expect(page.locator('.gallery .card__photo-badge').first()).toBeVisible()
  await expect(page.locator('.gallery__photo-note')).toBeVisible()
  await expect(page.locator('.gallery__photo-note')).toContainText('не совпадать')

  // зум: бейдж остаётся внутри диалога
  await page.locator('.gallery__main--zoom').click()
  await expect(page.locator('.zoom-overlay[open]')).toBeVisible()
  await expect(page.locator('.zoom-overlay .card__photo-badge')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('.zoom-overlay[open]')).toHaveCount(0)
})

test('motion: reveal sections register after client-side navigation', async ({ page }) => {
  await page.goto('/ru/')
  // клиентский переход главная → каталог → главная (без полной перезагрузки)
  await page.getByRole('link', { name: 'Каталог' }).first().click()
  await expect(page).toHaveURL(/\/ru\/catalog/)
  await page.getByRole('link', { name: 'Smart Centr' }).click()
  await expect(page).toHaveURL(/\/ru\/?$/)

  // после повторного входа секции снова зарегистрированы: есть .reveal,
  // и при попадании в вьюпорт получают .is-in (контент не застревает скрытым)
  const sections = page.locator('main [data-reveal]')
  const count = await sections.count()
  expect(count).toBeGreaterThan(3)
  const registered = await page
    .locator('main [data-reveal].reveal:not(.is-in)')
    .count()
  expect(registered).toBeGreaterThan(0)

  // прокрутка до последней секции: все зарегистрированные раскрываются
  await sections.last().scrollIntoViewIfNeeded()
  await expect(sections.last()).toHaveClass(/is-in/, { timeout: 5000 })
})

test('motion: reduced-motion at load keeps all sections visible', async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: 'reduce' })
  const page = await context.newPage()
  await page.goto('/ru/')
  // при reduce эффект не вешает .reveal вовсе — контент виден без JS-анимации
  await expect(page.locator('main [data-reveal].reveal')).toHaveCount(0)
  const sections = page.locator('main [data-reveal]')
  expect(await sections.count()).toBeGreaterThan(3)
  await context.close()
})

test('motion: switching to reduced-motion after load reveals everything', async ({ page }) => {
  await page.goto('/ru/')
  // часть секций ещё не в вьюпорте и ждёт reveal
  const pending = page.locator('main [data-reveal].reveal:not(.is-in)')
  expect(await pending.count()).toBeGreaterThan(0)

  // смена системной настройки после загрузки: слушатель показывает всё сразу
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(page.locator('main [data-reveal].reveal:not(.is-in)')).toHaveCount(0)
})

test('sources: footer link opens photo attribution page in both languages', async ({ page }) => {
  await page.goto('/ru/')
  await page.getByRole('link', { name: 'Источники фото' }).click()
  await expect(page).toHaveURL(/\/ru\/sources/)
  await expect(page.getByRole('heading', { name: 'Источники изображений' })).toBeVisible()
  // авторы из проверенного списка, включая исправленные после ревью
  await expect(page.locator('.sources-table')).toContainText('Zaidan Falaah')
  await expect(page.locator('.sources-table')).toContainText('Vova Kras')
  await expect(page.locator('.sources-table tbody tr')).toHaveCount(13)

  await page.goto('/ky/sources')
  await expect(page.getByRole('heading', { name: 'Сүрөт булактары' })).toBeVisible()
  await expect(page.locator('.sources-table')).toContainText('Torsten Dettlaff')
})
