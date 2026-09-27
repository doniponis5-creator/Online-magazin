/**
 * Заглушка холста для тестов кухни в node: three.js рисует текстуры на
 * `document.createElement('canvas')`, а в node документа нет. Импорт файла
 * ставит `globalThis.document`, чей холст принимает любые вызовы 2D-контекста;
 * `getImageData` отдаёт пустые пиксели нужного размера.
 *
 * Файл без `.test.ts` в имени — vitest его как тест не запускает
 * (`include: ['__tests__/**\/*.test.ts']` в `vitest.config.ts`).
 */

export const ctx2d: unknown = new Proxy({} as Record<string | symbol, unknown>, {
  get: (t, k) => {
    if (k in t) return t[k]
    if (k === 'getImageData') return (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) })
    return () => ctx2d
  },
  set: (t, k, v) => {
    t[k] = v
    return true
  },
})

;(globalThis as { document?: unknown }).document = {
  createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }),
}
