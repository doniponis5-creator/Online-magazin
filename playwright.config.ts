import { defineConfig } from '@playwright/test'

/**
 * E2E-проверки прототипа против локального preview-сервера.
 * Используем установленный в системе браузер (channel chrome),
 * чтобы не скачивать отдельный Chromium.
 */
// PW_BASE_URL=http://localhost:3001 — гонять против уже поднятого dev-сервера, свой сервер не поднимать
const base = process.env.PW_BASE_URL

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: base ?? 'http://localhost:3100',
    channel: 'chrome',
    viewport: { width: 390, height: 844 },
  },
  webServer: base
    ? undefined
    : {
        command: 'npm run start -- -p 3100',
        url: 'http://localhost:3100/ru',
        reuseExistingServer: true,
        timeout: 60000,
      },
})
