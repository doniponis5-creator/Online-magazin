import { expect, test } from '@playwright/test'

/**
 * Каталог: URL — единственный источник состояния. Поиск из шапки дважды,
 * категория, назад/вперёд, reload — результаты восстанавливаются.
 */
test('catalog: header search twice → category → back/forward → reload', async ({ page }) => {
  await page.goto('/ru/catalog')

  // поиск Aura из шапки
  await page.getByRole('searchbox', { name: 'Поиск товаров' }).fill('Aura')
  await page.getByRole('searchbox', { name: 'Поиск товаров' }).press('Enter')
  await expect(page).toHaveURL('http://localhost:3100/ru/catalog?q=Aura')
  await expect(page.locator('.card')).toHaveCount(1)
  await expect(page.locator('.card__name').first()).toContainText('Aura X5')

  // повторный поиск из шапки — AirSound заменяет результаты, не «застревает»
  const headerSearch = page.getByRole('searchbox', { name: 'Поиск товаров' })
  await headerSearch.fill('AirSound')
  await expect(headerSearch).toHaveValue('AirSound')
  await page.waitForTimeout(200)
  await headerSearch.press('Enter')
  await expect(page).toHaveURL('http://localhost:3100/ru/catalog?q=AirSound')
  await expect(page.locator('.card')).toHaveCount(1)
  await expect(page.locator('.card__name').first()).toContainText('AirSound')

  // категория ноутбуков через чип каталога (в мобильной сетке поднавигация скрыта)
  await page.locator('.chip', { hasText: 'Ноутбуки' }).click()
  await expect(page).toHaveURL('http://localhost:3100/ru/catalog?q=AirSound&cat=laptops')
  await expect(page.locator('.card')).toHaveCount(0) // AirSound — аксессуар, не ноутбук

  // назад → результаты поиска AirSound восстанавливаются из URL
  await page.goBack()
  await expect(page).toHaveURL('http://localhost:3100/ru/catalog?q=AirSound')
  await expect(page.locator('.card')).toHaveCount(1)
  await expect(page.locator('.card__name').first()).toContainText('AirSound')

  // вперёд → снова фильтр категории поверх поиска
  await page.goForward()
  await expect(page).toHaveURL('http://localhost:3100/ru/catalog?q=AirSound&cat=laptops')

  // reload → вид восстанавливается
  await page.reload()
  await expect(page).toHaveURL('http://localhost:3100/ru/catalog?q=AirSound&cat=laptops')
  await expect(page.getByRole('searchbox', { name: 'Поиск товаров' })).toHaveValue('AirSound')
})

test('catalog: category chip alone, sorting and brand filter write into URL', async ({ page }) => {
  await page.goto('/ru/catalog')

  await page.locator('.chip', { hasText: 'Ноутбуки' }).click()
  await expect(page).toHaveURL('http://localhost:3100/ru/catalog?cat=laptops')
  await expect(page.locator('.card')).toHaveCount(2)

  // сортировка: сначала дешевле
  await page.locator('.catalog-meta__sort .filter-select__trigger').click()
  await page.getByRole('option', { name: 'Сначала дешевле' }).click()
  await expect(page).toHaveURL('http://localhost:3100/ru/catalog?cat=laptops&sort=price-asc')
  await expect(page.locator('.card__price').first()).toHaveText('52 900 сом')

  // бренд — флажок в панели фильтров
  await page.locator('.filter-panel .check', { hasText: 'ProWork' }).click()
  await expect(page).toHaveURL('http://localhost:3100/ru/catalog?cat=laptops&sort=price-asc&brand=ProWork')
  await expect(page.locator('.card')).toHaveCount(1)

  // сброс возвращает полный каталог
  await page.getByRole('button', { name: 'Сбросить фильтры' }).click()
  await expect(page).toHaveURL('http://localhost:3100/ru/catalog')
  await expect(page.locator('.card')).toHaveCount(15)
})

test('catalog: search field in catalog page writes q into URL with debounce', async ({ page }) => {
  await page.goto('/ru/catalog')
  const field = page.getByRole('searchbox', { name: 'Поиск по названию или бренду' })
  await field.fill('Aura')
  await expect(page).toHaveURL('http://localhost:3100/ru/catalog?q=Aura')
  await expect(page.locator('.card')).toHaveCount(1)

  // сброс фильтров возвращает полный каталог
  await page.locator('.catalog-meta').getByRole('button', { name: 'Сбросить фильтры' }).click()
  await expect(page).toHaveURL('http://localhost:3100/ru/catalog')
  await expect(page.locator('.card')).toHaveCount(15)
})

test('catalog: empty state offers reset, no dead ends', async ({ page }) => {
  await page.goto('/ru/catalog?q=несуществующий-товар-xyz')
  await expect(page.getByText('Ничего не найдено')).toBeVisible()
  await page.locator('.empty').getByRole('button', { name: 'Сбросить фильтры' }).click()
  await expect(page.locator('.card').first()).toBeVisible()
})

test('catalog: price, stock and sale filters combine in URL and survive reload', async ({ page }) => {
  await page.goto('/ru/catalog')

  await page.locator('.filter-panel .check', { hasText: 'Со скидкой' }).click()
  await expect(page).toHaveURL('http://localhost:3100/ru/catalog?sale=1')
  await expect(page.locator('.card')).toHaveCount(3)

  await page.locator('.price-range__field input').nth(1).fill('50000')
  await expect(page).toHaveURL('http://localhost:3100/ru/catalog?sale=1&max=50000')
  await expect(page.locator('.card')).toHaveCount(2)

  await page.reload()
  await expect(page.locator('.price-range__field input').nth(1)).toHaveValue('50000')
  await expect(page.locator('.card')).toHaveCount(2)

  await page.locator('.filter-panel__reset').click()
  await expect(page).toHaveURL('http://localhost:3100/ru/catalog')
})
