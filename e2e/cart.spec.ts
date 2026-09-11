import { expect, test } from '@playwright/test'

/**
 * Сценарий корзины: добавление выбранного SKU, количество с лимитом
 * демо-остатка, пересчёт итога, удаление и восстановление после reload.
 * Перед сценарием корзина очищается — тест изолирован.
 */
test.use({ viewport: { width: 390, height: 844 } })

test('cart: add variant → qty clamp → totals → remove → restore notice', async ({ page }) => {
  // изолированность: чистое хранилище
  await page.goto('/ru/')
  await page.evaluate(() => localStorage.removeItem('sc-cart-v1'))

  // 1) добавить конкретный вариант с карточки товара
  await page.goto('/ru/product/tabslate-10')
  await page.getByRole('button', { name: 'Тёмный', exact: true }).click()
  await expect(page.locator('.purchase__variant')).toContainText('Тёмный · 128 ГБ')
  await page.locator('.purchase__actions .btn--primary').click()

  const badge = page.locator('.header__actions .icon-btn__badge')
  await expect(badge).toHaveText('1')

  // 2) в корзине — строка выбранного варианта и верная сумма
  await page.goto('/ru/cart')
  const line = page.locator('.cart-line')
  await expect(line).toHaveCount(1)
  await expect(page.locator('.cart-line__variant')).toHaveText('Тёмный · 128 ГБ')
  await expect(page.locator('.cart-line__unit')).toContainText('19 700 сом')
  await expect(page.locator('.summary-card__total')).toContainText('19 700 сом')
  await expect(page.locator('.stepper__value')).toHaveText('1')

  // 3) + до лимита демо-остатка (stock 3), минус-кнопка на min отключена
  const plus = page.locator('.stepper__btn[aria-label="+"]')
  const minus = page.locator('.stepper__btn[aria-label="−"]')
  await expect(minus).toBeDisabled()
  await plus.click()
  await expect(page.locator('.stepper__value')).toHaveText('2')
  await expect(page.locator('.summary-card__total')).toContainText('39 400 сом')
  await plus.click()
  await expect(page.locator('.stepper__value')).toHaveText('3')
  await expect(plus).toBeDisabled() // достигнут демо-остаток
  await expect(page.locator('.summary-card__total')).toContainText('59 100 сом')

  // 4) reload: корзина сохраняется ровно в том же виде
  await page.reload()
  await expect(page.locator('.stepper__value')).toHaveText('3')
  await expect(page.locator('.summary-card__total')).toContainText('59 100 сом')

  // 5) удаление строки → пустое состояние без «успешной» заявки
  await page.getByRole('button', { name: 'Удалить' }).click()
  await expect(page.locator('.cart-line')).toHaveCount(0)
  await expect(page.getByText('В корзине пока ничего нет')).toBeVisible()
  await expect(page.locator('.summary-card')).toHaveCount(0)
})

test('cart: corrupted localStorage is normalized with notice, no negative totals', async ({ page }) => {
  // повторяющийся SKU + невалидные строки + превышение остатка
  await page.addInitScript(() => {
    localStorage.setItem(
      'sc-cart-v1',
      JSON.stringify([
        { productId: 'aura-x5', variantId: 'blue', qty: 2 },
        { productId: 'aura-x5', variantId: 'blue', qty: 99 }, // дубликат + за лимитом (stock 7)
        { productId: 'ghost', variantId: 'x', qty: 5 }, // неизвестный товар
        { productId: 'aura-x5', variantId: 'ink', qty: 1 }, // демо-остаток 0
        { productId: 'aura-x5', variantId: 'white', qty: -3 }, // мусорное количество
      ]),
    )
  })
  await page.goto('/ru/cart')

  // должна остаться одна корректная строка: aura blue, слитая и зажатая до 7
  await expect(page.locator('.cart-line')).toHaveCount(1)
  await expect(page.locator('.cart-line__variant')).toHaveText('Синий')
  await expect(page.locator('.stepper__value')).toHaveText('7')
  await expect(page.locator('.summary-card__total')).toContainText('174 300 сом') // 7 × 24 900

  // понятное сообщение о корректировке корзины
  await expect(page.locator('.notice')).toContainText('Корзина восстановлена с изменениями')
  // сообщение можно закрыть
  await page.locator('.notice__close').click()
  await expect(page.locator('.notice')).toHaveCount(0)
})

test('cart: language switch RU→KY preserves cart and stays on the same host/path', async ({ page }) => {
  await page.goto('/ru/')
  await page.evaluate(() => localStorage.removeItem('sc-cart-v1'))
  await page.goto('/ru/product/aura-x5')
  await page.locator('.purchase__actions .btn--primary').click()

  await page.goto('/ru/cart')
  await expect(page.locator('.cart-line')).toHaveCount(1)

  // переключение языка из корзины: внутренняя ссылка /ky/cart
  await page.locator('nav.lang-switch a[href="/ky/cart"]').click()
  await expect(page).toHaveURL('http://localhost:3100/ky/cart')
  await expect(page.locator('h1')).toContainText('Себет')
  await expect(page.locator('.cart-line')).toHaveCount(1)
  await expect(page.locator('.cart-line__variant')).toHaveText('Көк')

  // обратное переключение
  await page.locator('nav.lang-switch a[href="/ru/cart"]').click()
  await expect(page).toHaveURL('http://localhost:3100/ru/cart')
  await expect(page.locator('.cart-line')).toHaveCount(1)
})
