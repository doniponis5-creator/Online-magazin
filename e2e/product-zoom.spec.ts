import { expect, test } from '@playwright/test'

/**
 * Сценарий: галерея товара — зум.
 * 1) клик по .gallery__main--zoom
 * 2) .zoom-overlay виден
 * 3) Escape
 * 4) .zoom-overlay скрыт/удалён
 * 5) фокус вернулся на opener
 */
test('product gallery zoom: open → Escape → close → focus returns', async ({ page }) => {
  await page.goto('/ru/product/tabslate-10')
  await expect(page.locator('h1')).toHaveText('Планшет TabSlate 10')

  const opener = page.locator('.gallery__main--zoom')
  await expect(opener).toBeVisible()

  // 1–2: открыть зум
  await opener.click()
  const overlay = page.locator('.zoom-overlay')
  await expect(overlay).toBeVisible()
  await expect(page.locator('.zoom-overlay__close')).toBeFocused()

  // 3–4: Escape закрывает оверлей
  await page.keyboard.press('Escape')
  await expect(overlay).toHaveCount(0)

  // 5: фокус возвращается на открывшую кнопку
  await expect(opener).toBeFocused()
})

test('product gallery zoom: close button also closes', async ({ page }) => {
  await page.goto('/ru/product/tabslate-10')
  const opener = page.locator('.gallery__main--zoom')
  await opener.click()
  const overlay = page.locator('.zoom-overlay')
  await expect(overlay).toBeVisible()

  await page.locator('.zoom-overlay__close').click()
  await expect(overlay).toHaveCount(0)
  await expect(opener).toBeFocused()
})

test('variant combo: gallery and purchase read the same selected SKU', async ({ page }) => {
  await page.goto('/ru/product/tabslate-10')

  // Голубой · 128 по умолчанию
  await expect(page.locator('.purchase__variant')).toContainText('Голубой · 128 ГБ')
  await expect(page.locator('.purchase__price')).toHaveText('19 700 сом')

  // 256 ГБ → цена +3 000
  await page.getByRole('button', { name: /256 ГБ/ }).click()
  await expect(page.locator('.purchase__price')).toHaveText('22 700 сом')
  await expect(page.locator('.purchase__variant')).toContainText('Голубой · 256 ГБ')
  await expect(page.locator('.stock-line')).toContainText(': 2')

  // Тёмный при 256: комбинация ink+256 в демо stock 0 → авто-подбор ближайшей доступной
  // (цвет остаётся доступным, память/цвет уводятся от недоступной комбинации)
  await page.getByRole('button', { name: 'Тёмный', exact: true }).click()
  await expect(page.locator('.purchase__variant')).toContainText('Тёмный · 128 ГБ')
  await expect(page.locator('.purchase__price')).toHaveText('19 700 сом')
  await expect(page.locator('.stock-line')).toContainText(': 3')

  // 256 при Тёмном → подбирается доступный Голубой · 256 (+3 000)
  await page.getByRole('button', { name: /256 ГБ/ }).click()
  await expect(page.locator('.purchase__variant')).toContainText('Голубой · 256 ГБ')
  await expect(page.locator('.purchase__price')).toHaveText('22 700 сом')
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
