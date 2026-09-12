import { expect, test } from '@playwright/test'

/**
 * Новый контракт (решение владельца 12.09): в публичной витрине товарных
 * фото нет, поэтому фотозум на странице товара недоступен. Доступный
 * dialog-зум сохранён для будущих реальных снимков и проверяется на
 * изолированной фикстуре /dev/gallery?fixture=zoom (без параметра — 404,
 * из витрины не связана).
 */

test('public product page: placeholder shown, no photo zoom available', async ({ page }) => {
  await page.goto('/ru/product/tabslate-10')
  await expect(page.locator('h1')).toHaveText('Планшет TabSlate 10')

  // единый нейтральный плейсхолдер с локализованной подписью
  await expect(page.locator('.gallery__main .product-placeholder')).toBeVisible()
  await expect(page.locator('.gallery__main .product-placeholder__label')).toHaveText(
    'Фото скоро появится',
  )
  // зум не предлагается без реального снимка
  await expect(page.locator('.gallery__main--zoom')).toHaveCount(0)
  await expect(page.locator('dialog.zoom-overlay')).toHaveCount(0)
})

test('dev fixture: hidden without the fixture param (404)', async ({ page }) => {
  const res = await page.goto('/ru/dev/gallery')
  expect(res?.status()).toBe(404)
})

test('dev fixture zoom dialog: focus trap, Escape, focus return, scroll lock', async ({ page }) => {
  await page.goto('/ru/dev/gallery?fixture=zoom')
  const opener = page.locator('.gallery__main--zoom')
  await expect(opener).toBeVisible()

  // фон прокручивается до открытия
  await page.evaluate(() => window.scrollTo(0, 200))
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0)

  await opener.click()
  const dialog = page.locator('dialog.zoom-overlay')
  await expect(dialog).toBeVisible()
  await expect(page.locator('.zoom-overlay__close')).toBeFocused()

  // прокрутка фона заблокирована, пока диалог открыт (html.dialog-open)
  expect(
    await page.evaluate(() => getComputedStyle(document.documentElement).overflowX),
  ).toBe('hidden')

  // Tab/Shift+Tab остаются внутри диалога (нативная модальность)
  for (let i = 0; i < 5; i++) await page.keyboard.press('Tab')
  for (let i = 0; i < 5; i++) await page.keyboard.press('Shift+Tab')
  const focusInsideDialog = await page.evaluate(() => {
    const el = document.activeElement
    return Boolean(el && el.closest('dialog.zoom-overlay'))
  })
  expect(focusInsideDialog).toBe(true)

  // Escape закрывает (нативное поведение dialog)
  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()

  // фокус вернулся на opener, прокрутка фона восстановлена
  await expect(opener).toBeFocused()
  await expect
    .poll(() => page.evaluate(() => getComputedStyle(document.documentElement).overflowX))
    .not.toBe('hidden')
})

test('dev fixture zoom: close button also closes and returns focus', async ({ page }) => {
  await page.goto('/ru/dev/gallery?fixture=zoom')
  const opener = page.locator('.gallery__main--zoom')
  await opener.click()
  const dialog = page.locator('dialog.zoom-overlay')
  await expect(dialog).toBeVisible()

  await page.locator('.zoom-overlay__close').click()
  await expect(dialog).not.toBeVisible()
  await expect(opener).toBeFocused()
})

test('variant combo: missing combination is explicit, no silent substitution', async ({ page }) => {
  await page.goto('/ru/product/tabslate-10')

  // Голубой · 128 по умолчанию
  await expect(page.locator('.purchase__variant')).toContainText('Голубой · 128 ГБ')
  await expect(page.locator('.purchase__price')).toHaveText('19 700 сом')

  // 256 ГБ → цена +3 000 (комбинация Голубой · 256 существует)
  await page.getByRole('button', { name: /256 ГБ/ }).click()
  await expect(page.locator('.purchase__price')).toHaveText('22 700 сом')

  // выбираем Тёмный при памяти 256 → комбинации нет в каталоге:
  // явное состояние, цена не показывается, вторая характеристика не меняется молча
  await page.getByRole('button', { name: 'Тёмный', exact: true }).click()
  await expect(page.locator('.combo-missing')).toBeVisible()
  await expect(page.locator('.combo-missing')).toContainText('Нет в такой комбинации')
  await expect(page.locator('.purchase__variant')).toHaveCount(0)
  await expect(page.locator('.purchase__price')).toHaveCount(0)

  // память осталась «256 ГБ» (aria-pressed) — молчаливой подмены не было
  await expect(page.getByRole('button', { name: '256 ГБ', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )

  // добавление в корзину заблокировано — никакой чужой SKU не добавится
  await expect(page.locator('.purchase__actions .btn--primary')).toBeDisabled()

  // предложение доступных комбинаций — явное действие пользователя
  const suggestion = page.locator('.combo-missing__list .swatch', { hasText: 'Тёмный' }).first()
  await suggestion.click()
  await expect(page.locator('.purchase__variant')).toContainText('Тёмный · 128 ГБ')
  await expect(page.locator('.purchase__price')).toHaveText('19 700 сом')
  await expect(page.locator('.purchase__actions .btn--primary')).toBeEnabled()
})

test('out-of-stock SKU: selectable chip does not allow purchase', async ({ page }) => {
  // Aura X5 «Тёмный» имеет демо-остаток 0 — выбор разрешён, покупка запрещена
  await page.goto('/ru/product/aura-x5')
  await page.getByRole('button', { name: 'Тёмный', exact: true }).click()
  await expect(page.locator('.stock-line')).toContainText('Нет в наличии')
  await expect(page.locator('.purchase__actions .btn--primary')).toBeDisabled()
  // возврат на доступный цвет снова разрешает покупку
  await page.getByRole('button', { name: 'Синий', exact: true }).click()
  await expect(page.locator('.stock-line')).toContainText('В наличии')
  await expect(page.locator('.purchase__actions .btn--primary')).toBeEnabled()
})
