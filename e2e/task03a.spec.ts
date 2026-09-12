import { expect, test } from '@playwright/test'

/**
 * TASK 03A REVIEW FIXES — регрессии нового контракта (решение владельца 12.09):
 * 1) товарных фото в витрине нет: единый плейсхолдер, подпись локализована;
 * 2) фотозум без снимка не предлагается (проверка dialog — отдельная фикстура
 *    в product-zoom.spec.ts);
 * 3) reveal регистрируется после клиентских переходов; reduced-motion
 *    уважается с загрузки и при смене настройки на лету; исправление
 *    каскада проверяется computed-стилями, а не только классами;
 * 4) страница источников: ровно один активный баннер + честный архив.
 */

test('placeholder: RU cards show single localized placeholder, no product photos', async ({
  page,
}) => {
  await page.goto('/ru/')
  const card = page.locator('.card').first()
  await expect(card.locator('.product-placeholder')).toBeVisible()
  await expect(card.locator('.product-placeholder__label')).toHaveText('Фото скоро появится')
  // товарных <img> в карточках больше нет
  await expect(page.locator('.card__media-link img')).toHaveCount(0)
  // каталог — то же самое
  await page.goto('/ru/catalog')
  await expect(
    page.locator('.card .product-placeholder__label').first(),
  ).toHaveText('Фото скоро появится')
})

test('placeholder: KY cards show Kyrgyz label', async ({ page }) => {
  await page.goto('/ky/')
  await expect(page.locator('.card .product-placeholder__label').first()).toHaveText(
    'Сүрөт жакында чыгат',
  )
  await page.goto('/ky/catalog')
  await expect(page.locator('.card .product-placeholder__label').first()).toHaveText(
    'Сүрөт жакында чыгат',
  )
})

test('product page: placeholder instead of photo, no zoom and no photo badges', async ({ page }) => {
  await page.goto('/ru/product/tabslate-10')
  await expect(page.locator('.gallery__main .product-placeholder')).toBeVisible()
  await expect(page.locator('.gallery__main--zoom')).toHaveCount(0)
  await expect(page.locator('dialog.zoom-overlay')).toHaveCount(0)
  // прежние подписи «Иллюстрация категории» ушли вместе с фото
  await expect(page.locator('.card__photo-badge')).toHaveCount(0)
  await expect(page.locator('.gallery__photo-note')).toHaveCount(0)
})

test('hero: CSS scene with model text, no photos, CTA to home-appliances catalog', async ({
  page,
}) => {
  await page.goto('/ru/')
  // модель владельца и подтверждённая характеристика
  await expect(page.locator('.hero3d__title')).toHaveText('LG F4X5ES5SB')
  await expect(page.locator('.hero3d__subtitle.hero3d__ph--intro')).toContainText('11 кг')
  // сцена — авторская CSS-графика: тегов img в hero нет вовсе
  await expect(page.locator('.hero3d img')).toHaveCount(0)
  await expect(page.locator('.wm__machine').first()).toBeVisible()
  // один CTA ведёт в существующий каталог техники для дома
  const cta = page.locator('.hero3d__cta')
  await expect(cta).toHaveText(/Смотреть стиральные машины/)
  await expect(cta).toHaveAttribute('href', '/ru/catalog?cat=home')
})

test('motion: reveal sections register after client-side navigation', async ({ page }) => {
  await page.goto('/ru/')
  await page.getByRole('link', { name: 'Каталог' }).first().click()
  await expect(page).toHaveURL(/\/ru\/catalog/)
  await page.getByRole('link', { name: 'Smart Centr' }).click()
  await expect(page).toHaveURL(/\/ru\/?$/)

  // секции зарегистрированы заново (без перезагрузки): ждём готовности, не снулём
  await page.waitForFunction(
    () => document.querySelectorAll('main [data-reveal].reveal:not(.is-in)').length > 0,
  )
  const sections = page.locator('main [data-reveal]')
  expect(await sections.count()).toBeGreaterThan(3)

  // прокрутка до последней секции: она раскрывается (контент не застревает скрытым)
  await sections.last().scrollIntoViewIfNeeded()
  await expect(sections.last()).toHaveClass(/is-in/, { timeout: 5000 })
})

test('motion: reduced-motion at load — sections visible, hero scene static (computed)', async ({
  browser,
}) => {
  const context = await browser.newContext({ reducedMotion: 'reduce' })
  const page = await context.newPage()
  await page.goto('/ru/')

  // при reduce эффект не вешает .reveal вовсе — контент видим без JS-анимации
  await expect(page.locator('main [data-reveal].reveal')).toHaveCount(0)
  const sections = page.locator('main [data-reveal]')
  expect(await sections.count()).toBeGreaterThan(3)
  // computed-проверка: секция ниже экрана непрозрачной не прячется
  const belowFold = sections.last()
  const opacity = await belowFold.evaluate((el) => getComputedStyle(el).opacity)
  expect(opacity).toBe('1')

  // hero-сцена статична: прокрутка не меняет computed transform группы машины
  const machine = page.locator('.wm')
  await page.evaluate(() => window.scrollTo(0, 400))
  await page.waitForTimeout(150)
  const t1 = await machine.evaluate((el) => getComputedStyle(el).transform)
  await page.evaluate(() => window.scrollTo(0, 800))
  await page.waitForTimeout(150)
  const t2 = await machine.evaluate((el) => getComputedStyle(el).transform)
  expect(t1).toBe(t2)
  // и сцена не наклонена указателем (transform stage — none)
  const stageTransform = await page
    .locator('.hero3d__stage')
    .evaluate((el) => getComputedStyle(el).transform)
  expect(stageTransform).toBe('none')
  await context.close()
})

test('motion: reduced-motion CSS cascade wins over .reveal (computed opacity)', async ({
  browser,
}) => {
  const context = await browser.newContext({ reducedMotion: 'reduce' })
  const page = await context.newPage()
  await page.goto('/ru/')
  // каскадная проверка: даже если элемент имеет .reveal без .is-in,
  // блок reduce в конце globals.css должен держать computed opacity = 1.
  // Класс добавляем сами — это проверка CSS-каскада, а не подделка анимации.
  const opacity = await page.evaluate(() => {
    const el = document.querySelector('main [data-reveal]') as HTMLElement | null
    if (!el) return 'no-section'
    el.classList.add('reveal')
    const op = getComputedStyle(el).opacity
    el.classList.remove('reveal')
    return op
  })
  expect(opacity).toBe('1')
  await context.close()
})

test('motion: switching to reduced-motion after load reveals everything', async ({ browser }) => {
  // явный no-preference: раньше контекст наследовал настройки машины и
  // проверка выполнялась до регистрации наблюдателя — причина нестабильности
  const context = await browser.newContext({ reducedMotion: 'no-preference' })
  const page = await context.newPage()
  await page.goto('/ru/')
  await page.evaluate(() => window.scrollTo(0, 0))
  // ждём готовности наблюдателя: секции зарегистрированы и ждут вьюпорта
  await page.waitForFunction(
    () => document.querySelectorAll('main [data-reveal].reveal:not(.is-in)').length > 0,
  )
  // смена системной настройки после загрузки: слушатель показывает всё сразу
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect
    .poll(() =>
      page.evaluate(() => document.querySelectorAll('main [data-reveal].reveal:not(.is-in)').length),
    )
    .toBe(0)
  await context.close()
})

test('hero scroll: geometry of the scene actually changes while scrolling', async ({ browser }) => {
  // сцена управляется прокруткой без reduce — проверяем мобильную и desktop
  // компоновки: группа машины меняет computed transform на каждой из них
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 1440, height: 900 },
  ]) {
    const context = await browser.newContext({ reducedMotion: 'no-preference', viewport })
    const page = await context.newPage()
    await page.goto('/ru/')
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.waitForTimeout(120)
    const machine = page.locator('.wm')
    const tStart = await machine.evaluate((el) => getComputedStyle(el).transform)

    // обычная прокрутка пользователями — без принудительных классов
    await page.mouse.wheel(0, 250)
    await page.waitForTimeout(220)
    const tMid = await machine.evaluate((el) => getComputedStyle(el).transform)

    await page.mouse.wheel(0, 800)
    await page.waitForTimeout(220)
    const tEnd = await machine.evaluate((el) => getComputedStyle(el).transform)

    expect(tStart, `${viewport.width}px: start vs middle`).not.toBe(tMid)
    expect(tMid, `${viewport.width}px: middle vs end`).not.toBe(tEnd)
    await context.close()
  }
})

test('sources: no active photos (CSS scene), honest archive, both languages', async ({ page }) => {
  await page.goto('/ru/')
  await page.getByRole('link', { name: 'Источники фото' }).click()
  await expect(page).toHaveURL(/\/ru\/sources/)
  await expect(page.getByRole('heading', { name: 'Источники изображений' })).toBeVisible()
  // активной таблицы нет (архивная живёт внутри <details>) — честное пояснение
  await expect(page.locator('.sources-page .container > .table-wrap')).toHaveCount(0)
  await expect(page.getByText('Активных фотографий сейчас нет')).toBeVisible()

  // архив раскрыт честно: прежние снимки перечислены, но не «активны»
  await page.locator('.sources-page__archive summary').click()
  const archiveRows = page.locator('.sources-page__archive .sources-table tbody tr')
  await expect(archiveRows.first()).toBeVisible()
  expect(await archiveRows.count()).toBeGreaterThanOrEqual(14)
  await expect(page.locator('.sources-page__archive .sources-table')).toContainText('Vova Kras')

  await page.goto('/ky/sources')
  await expect(page.getByRole('heading', { name: 'Сүрөт булактары' })).toBeVisible()
  await expect(page.getByText('Азыр активдүү сүрөт жок')).toBeVisible()
})
