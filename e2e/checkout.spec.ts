import { expect, test } from '@playwright/test'

/**
 * Демо-оформление: валидация, обязательные населённый пункт и адрес для такси,
 * явная демонстрационная подача. Никаких сетевых отправок заказа/оплаты.
 */
test.use({ viewport: { width: 390, height: 844 } })

// ВАЖНО: seeding только через addInitScript — до гидрации Next.js.
// Запись через page.evaluate на открытой странице перетирается
// первичным write-эффектом CartProvider (он приводит хранилище к состоянию приложения).
async function seedCart(page: import('@playwright/test').Page, items: unknown[] = []) {
  await page.addInitScript(
    (value) => localStorage.setItem('sc-cart-v1', value),
    JSON.stringify(items),
  )
}

test('checkout: validation errors shown, then demo result without network sends', async ({
  page,
}) => {
  await seedCart(page, [{ productId: 'aura-x5', variantId: 'blue', qty: 1 }])
  const sends: string[] = []
  page.on('request', (req) => {
    if (req.method() !== 'GET') sends.push(`${req.method()} ${req.url()}`)
  })

  await page.goto('/ru/checkout')
  await expect(page.locator('h1')).toHaveText('Оформление заказа')

  // пустая отправка → ошибки валидации, никаких переходов
  await page.getByRole('button', { name: 'Отправить заявку (демо)' }).click()
  await expect(page.getByText('Укажите имя')).toBeVisible()
  await expect(page.getByText('Введите номер в формате +996 XXX XXX XXX')).toBeVisible()

  // такси: обязательны населённый пункт и адрес
  await page.getByRole('textbox', { name: 'Ваше имя' }).fill('Азиз')
  await page.getByRole('textbox', { name: 'Телефон' }).fill('+996 700 123456')
  await page.getByRole('radio', { name: /Доставка такси/ }).check()
  await page.getByRole('button', { name: 'Отправить заявку (демо)' }).click()
  await expect(page.getByText('Укажите город или область')).toBeVisible()
  await expect(page.getByText('Укажите адрес доставки')).toBeVisible()

  // корректные демо-данные
  await page.getByRole('textbox', { name: 'Город / область' }).fill('Ош')
  await page.getByRole('textbox', { name: 'Адрес' }).fill('ул. Ленина 1')
  await page.getByRole('button', { name: 'Отправить заявку (демо)' }).click()

  // явная демонстрационная подача, а не «успешная продажа»
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Демонстрация — заявка не отправлена',
  )
  await expect(page.getByText(/номер демо-заявки/i)).toBeVisible()
  await expect(page.locator('.demo-result__warning')).toContainText('реального заказа')

  // ни одного не-GET запроса: заказ и оплата никуда не уходят
  expect(sends).toEqual([])
})

test('checkout: empty cart shows honest empty state, not a form', async ({ page }) => {
  await seedCart(page, [])
  await page.goto('/ru/checkout')
  await expect(page.getByText('Себетте азырынча эч нерсе жок')).toBeHidden() // кыргызский не «протекает» в RU
  await expect(page.getByText('В корзине пока ничего нет')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Отправить заявку (демо)' })).toHaveCount(0)
})

test('checkout KY: interface fully in Kyrgyz including errors and result', async ({ page }) => {
  await seedCart(page, [{ productId: 'aura-x5', variantId: 'blue', qty: 1 }])
  await page.goto('/ky/checkout')
  await expect(page.locator('h1')).toHaveText('Буйрутманы берүү')

  await page.getByRole('button', { name: 'Арыз жөнөтүү (демо)' }).click()
  await expect(page.getByText('Атыңызды жазыңыз')).toBeVisible()
  await expect(page.getByText('Телефонду +996 XXX XXX XXX форматында жазыңыз')).toBeVisible()

  await page.getByRole('textbox', { name: 'Атыңыз' }).fill('Азамат')
  await page.getByRole('textbox', { name: 'Телефон' }).fill('+996 555 000111')
  await page.getByRole('button', { name: 'Арыз жөнөтүү (демо)' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Демонстрация — арыз жөнөтүлгөн жок',
  )
})
