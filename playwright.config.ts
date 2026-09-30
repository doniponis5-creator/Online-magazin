import { defineConfig, devices } from '@playwright/test'

/**
 * E2E-проверки против локального сервера. Три профиля (таск 07, R01/R24i, R10):
 *
 * - `iphone`  — iPhone 375 × 812, касания, WebKit (то же ядро, что в приложении
 *               для iPhone, WKWebView): все e2e конструктора `e2e/kitchen-*.spec.ts`.
 *               Браузер ставится один раз: `npx playwright install webkit`.
 * - `desktop` — компьютер 1440 × 900, установленный Chrome: сквозная приёмка
 *               `e2e/kitchen-acceptance.spec.ts` (в ней же замер кадра с CPU ×4 через CDP).
 * - `chrome`  — телефон 390 × 844 в установленном Chrome (как было): остальные e2e сайта;
 *               `kitchen-*` не гоняет — они уже идут в `iphone` (C1, 50).
 *
 * Запуск против уже поднятого dev-сервера: `PW_BASE_URL=http://localhost:3001 npx playwright test`;
 * без переменной поднимается `npm run start` на 3100. Один профиль: `--project=iphone`.
 */
const base = process.env.PW_BASE_URL
const kitchen = /kitchen-.*\.spec\.ts$/
const acceptance = /kitchen-acceptance\.spec\.ts$/

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  retries: 0,
  reporter: 'list',
  // снимки раскладки общие для профилей: телефон и компьютер обязаны дать одну кухню
  snapshotPathTemplate: '{testDir}/__snapshots__/{testFileName}/{arg}{ext}',
  use: {
    baseURL: base ?? 'http://localhost:3100',
  },
  projects: [
    {
      name: 'iphone',
      testMatch: kitchen,
      use: { ...devices['iPhone 11 Pro'], browserName: 'webkit', viewport: { width: 375, height: 812 } },
    },
    {
      name: 'desktop',
      testMatch: acceptance,
      use: { channel: 'chrome', viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'chrome',
      testIgnore: kitchen,
      use: { channel: 'chrome', viewport: { width: 390, height: 844 } },
    },
  ],
  webServer: base
    ? undefined
    : {
        command: 'npm run start -- -p 3100',
        url: 'http://localhost:3100/ru',
        reuseExistingServer: true,
        timeout: 60000,
      },
})
