import { defineConfig } from 'vitest/config'
import path from 'node:path'

/** Отдельная настройка: имтихон не входит в обычный `vitest run`. */
export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, '../../src') } },
  test: {
    environment: 'node',
    include: ['scripts/exam/run.ts'],
    testTimeout: 10 * 60_000,
    // Ответы печатаем как есть, без обёртки vitest.
    reporters: ['dot'],
  },
})
