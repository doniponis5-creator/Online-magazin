import { expect, test } from '@playwright/test'

/**
 * TASK 03 регрессии:
 * - уведомление о корректировке корзины даже когда удалены все строки;
 * - повреждённый JSON даёт отдельное понятное сообщение;
 * - синхронизация корзины и избранного между двумя вкладками (storage).
 */
test('cart notice: shows even when restored cart lost all lines', async ({ page }) => {
  // только неизвестные товары → после нормализации корзина пуста, но флаг не теряется
  await page.addInitScript(() => {
    localStorage.setItem(
      'sc-cart-v1',
      JSON.stringify([{ productId: 'ghost', variantId: 'x', qty: 3 }]),
    )
  })
  await page.goto('/ru/cart')
  await expect(page.getByText('В корзине пока ничего нет')).toBeVisible()
  await expect(page.locator('.notice')).toContainText('Корзина восстановлена с изменениями')
})

test('cart notice: corrupted JSON gets a dedicated message', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('sc-cart-v1', '{not valid json!!')
  })
  await page.goto('/ru/cart')
  await expect(page.getByText('В корзине пока ничего нет')).toBeVisible()
  await expect(page.locator('.notice')).toContainText(
    'Сохранённая корзина была повреждена',
  )
  // сообщение закрывается
  await page.locator('.notice__close').click()
  await expect(page.locator('.notice')).toHaveCount(0)
})

test('two tabs: cart added in one tab appears in the other', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const tabA = await context.newPage()
  const tabB = await context.newPage()

  await tabA.goto('/ru/product/aura-x5')
  await tabB.goto('/ru/catalog')

  // вкладка A добавляет товар
  await tabA.locator('.purchase__actions .btn--primary').click()
  await expect(tabA.locator('.header__actions .icon-btn__badge')).toHaveText('1')

  // вкладка B получает storage-событие и обновляет счётчик без перезагрузки
  await expect(tabB.locator('.header__actions .icon-btn__badge')).toHaveText('1', {
    timeout: 5000,
  })
  await context.close()
})

test('two tabs: favorites toggled in one tab appear in the other', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const tabA = await context.newPage()
  const tabB = await context.newPage()

  await tabA.goto('/ru/product/aura-x5')
  await tabB.goto('/ru/catalog')

  await tabA.locator('.purchase__actions').getByRole('button', { name: 'Добавить в избранное' }).click()

  // избранное в другой вкладке обновляется без перезагрузки
  await expect(tabB.locator('.header__actions .icon-btn__badge')).toHaveText('1', {
    timeout: 5000,
  })

  // и на странице избранного товар есть
  await tabB.goto('/ru/favorites')
  await expect(tabB.locator('.card')).toHaveCount(1)
  await context.close()
})
