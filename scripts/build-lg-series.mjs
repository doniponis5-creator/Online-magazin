/**
 * TASK_05: сборка оптимизированных серий WebP из мастер-кадров
 * assets-src/lg-f4x5es5sb/turntable/*.png (1200×1200, прозрачный фон).
 *
 * Выход (public/lg/):
 *   turntable/desktop/f000..f059.webp — 720px
 *   turntable/mobile/f000..f059.webp  — 560px
 *   poster-640.webp / poster-960.webp — постер из f000 (первый кадр)
 *
 * Бюджеты (TASK_05_GLM.md): ≤3 МБ mobile, ≤6 МБ desktop — считаются здесь.
 *
 * Запуск: node scripts/build-lg-series.mjs
 */
import sharp from 'sharp'
import { readdirSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const SRC = 'assets-src/lg-f4x5es5sb/turntable'
const OUT = 'public/lg'
const FRAMES = 60

const variants = [
  { name: 'desktop', size: 800, quality: 82 },
  { name: 'mobile', size: 640, quality: 76 },
]

const files = readdirSync(SRC)
  .filter((f) => /^f\d{3}\.png$/.test(f))
  .sort()
if (files.length !== FRAMES) {
  console.error(`ожидалось ${FRAMES} кадров, найдено ${files.length}`)
  process.exit(1)
}

for (const v of variants) {
  mkdirSync(join(OUT, 'turntable', v.name), { recursive: true })
  let total = 0
  for (let i = 0; i < FRAMES; i++) {
    const out = join(OUT, 'turntable', v.name, `f${String(i).padStart(3, '0')}.webp`)
    const info = await sharp(join(SRC, files[i]))
      .resize(v.size, v.size)
      .webp({ quality: v.quality, alphaQuality: 80, effort: 5 })
      .toFile(out)
    total += info.size
  }
  console.log(
    `${v.name}: ${FRAMES} кадров ${v.size}px q${v.quality} — ${(total / 1024 / 1024).toFixed(2)} МБ`,
  )
}

// постер из первого кадра: тот же фон/масштаб, что и серия
for (const size of [640, 960]) {
  const info = await sharp(join(SRC, 'f000.png'))
    .resize(size, size)
    .webp({ quality: 80, alphaQuality: 85, effort: 5 })
    .toFile(join(OUT, `poster-${size}.webp`))
  console.log(`poster-${size}.webp — ${(info.size / 1024).toFixed(0)} КБ`)
}
