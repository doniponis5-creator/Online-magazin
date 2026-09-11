import { defineConfig } from '@playwright/test'

/**
 * E2E-проверки прототипа против локального preview-сервера.
 * Используем установленный в системе браузер (channel chrome),
 * чтобы не скачивать отдельный Chromium.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3100',
    channel: 'chrome',
    viewport: { width: 390, height: 844 },
  },
  webServer: {
    command: 'npm run start -- -p 3100',
    url: 'http://localhost:3100/ru',
    reuseExistingServer: true,
    timeout: 60000,
  },
})
