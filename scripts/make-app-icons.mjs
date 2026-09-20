// Иконки приложения для App Store и Google Play + картинка экрана запуска.
//
// Знак рисуем из вектора (тот же контур, что в src/components/Brand.tsx), а не
// обводим JPG: у вектора края чёткие на любом размере, и на маленькой иконке
// 48×48 не появляется грязь по краю буквы.
//
// Запуск: node scripts/make-app-icons.mjs
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const root = path.resolve(import.meta.dirname, '..')
const iconSet = path.join(root, 'ios/App/App/Assets.xcassets/AppIcon.appiconset')
const splashSet = path.join(root, 'ios/App/App/Assets.xcassets/Splash.imageset')
const androidDir = path.join(root, 'app-icons/android')
const storeDir = path.join(root, 'app-icons/store')

/** Тёмно-синий из DESIGN.md — цвет самого знака. */
const INK = '#263244'
/** Фирменный лимонный: тот же, что у кнопок «В корзину» на сайте. */
const LEMON = '#eaf500'
// Значок: лимонное поле, тёмный знак почти во всю высоту — так решил владелец.
// На экране телефона среди чужих значков жёлтый квадрат видно первым.
const ICON_BG = LEMON
const ICON_FG = INK
/** Доля высоты значка под знак. Больше — и буква упрётся в скругление. */
const ICON_SHARE = 0.7

// Контур знака «S» — копия MARK из src/components/Brand.tsx (viewBox 55.96×100).
const MARK =
  'M3.09 26.51L3.68 26.8L3.68 27.25L4.57 28.28L6.77 29.6L35.2 40.8L43.3 43.59L46.69 45.36L48.9 47.13L50.81 49.04L53.02 51.99L54.34 54.49L55.52 58.32L55.96 61.71L55.82 65.24L54.93 69.07L53.31 72.75L52.58 73.2L52.14 72.31L50.96 71.13L49.04 70.1L46.24 69.22L42.71 67.6L40.65 67.01L32.55 63.62L29.31 62.59L24.59 60.53L10.9 55.38L6.48 52.28L4.57 50.37L2.06 46.69L0.74 43.3L0 39.62L0 34.9L0.44 32.55L1.33 29.75L3.09 26.51ZM27.54 63.62L50.07 72.46L50.96 73.64L50.96 75.41L50.52 76.44L48.9 78.06L45.07 80.56L21.06 90.87L18.26 92.34L12.37 94.7L11.93 95.14L9.28 96.02L0.88 99.85L0 100L0 81.89L1.18 78.35L2.5 76.29L4.12 74.52L6.04 73.05L15.91 68.92L17.08 68.19L27.54 63.62ZM55.38 0L55.82 0.15L55.82 17.82L55.52 19.29L54.49 22.09L53.61 23.42L49.93 26.95L29.01 36.08L27.98 36.08L12.81 30.04L10.75 29.46L8.84 28.42L6.33 27.54L5.3 26.66L5.01 25.04L5.6 23.27L8.54 20.77L10.01 19.88L55.38 0Z'

const RATIO = 55.96 / 100

/** Знак заданной высоты, лимонный, с прозрачным фоном. */
async function glyph(height, color) {
  const h = Math.max(2, Math.round(height))
  const w = Math.max(2, Math.round(h * RATIO))
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 55.96 100"><path fill="${color}" d="${MARK}"/></svg>`
  return sharp(Buffer.from(svg)).png().toBuffer()
}

/** Квадрат со знаком по центру. share — доля высоты под знак. */
async function square(size, share, background = ICON_BG, foreground = ICON_FG) {
  return sharp({ create: { width: size, height: size, channels: 4, background } })
    .composite([{ input: await glyph(size * share, foreground), gravity: 'centre' }])
    .png()
    .toBuffer()
}

/** То же, но обрезано в круг — для лаунчеров Android с круглыми значками. */
async function circle(size, share) {
  const mask = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/></svg>`,
  )
  return sharp(await square(size, share))
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toBuffer()
}

await mkdir(iconSet, { recursive: true })
await mkdir(splashSet, { recursive: true })
await mkdir(androidDir, { recursive: true })
await mkdir(storeDir, { recursive: true })

// ── Apple ───────────────────────────────────────────────────────────────────
// Xcode 26 берёт одну картинку 1024×1024 и сам делает из неё все размеры.
// 0.62 вместо прежних 0.5: на экране телефона иконку обрезают скруглением, и
// знак в половину высоты выглядел потерянным среди пустого поля.
await writeFile(path.join(iconSet, 'AppIcon-512@2x.png'), await square(1024, ICON_SHARE))
await writeFile(
  path.join(iconSet, 'Contents.json'),
  JSON.stringify(
    {
      images: [{ filename: 'AppIcon-512@2x.png', idiom: 'universal', platform: 'ios', size: '1024x1024' }],
      info: { author: 'xcode', version: 1 },
    },
    null,
    2,
  ) + '\n',
)

// Экран запуска: тот же фон, знак мельче — он тут не значок, а отметка загрузки.
// Картинка квадратная и большая: сториборд растягивает её на весь экран.
for (const [name, size] of [
  ['splash.png', 912],
  ['splash@2x.png', 1824],
  ['splash@3x.png', 2732],
]) {
  await writeFile(path.join(splashSet, name), await square(size, 0.2, INK, LEMON))
}
await writeFile(
  path.join(splashSet, 'Contents.json'),
  JSON.stringify(
    {
      images: [
        { filename: 'splash.png', idiom: 'universal', scale: '1x' },
        { filename: 'splash@2x.png', idiom: 'universal', scale: '2x' },
        { filename: 'splash@3x.png', idiom: 'universal', scale: '3x' },
      ],
      info: { author: 'xcode', version: 1 },
    },
    null,
    2,
  ) + '\n',
)

// ── Android ─────────────────────────────────────────────────────────────────
// Обычные значки: по одному на каждую плотность экрана.
const DENSITIES = [
  ['mdpi', 48],
  ['hdpi', 72],
  ['xhdpi', 96],
  ['xxhdpi', 144],
  ['xxxhdpi', 192],
]
for (const [density, size] of DENSITIES) {
  const dir = path.join(androidDir, `mipmap-${density}`)
  await mkdir(dir, { recursive: true })
  await writeFile(path.join(dir, 'ic_launcher.png'), await square(size, ICON_SHARE))
  await writeFile(path.join(dir, 'ic_launcher_round.png'), await circle(size, ICON_SHARE - 0.04))
  // Слой «рисунок» у современного значка: система обрезает его по краям,
  // видно только середину — примерно две трети. Поэтому знак здесь мельче,
  // иначе после обрезки от буквы останутся рожки.
  await writeFile(
    path.join(dir, 'ic_launcher_foreground.png'),
    await sharp({
      create: { width: size * 2, height: size * 2, channels: 4, background: '#00000000' },
    })
      .composite([{ input: await glyph(size * 2 * 0.46, ICON_FG), gravity: 'centre' }])
      .png()
      .toBuffer(),
  )
}

// Слой «фон» современного значка — сплошной цвет, его задаёт файл настроек.
await mkdir(path.join(androidDir, 'values'), { recursive: true })
await writeFile(
  path.join(androidDir, 'values', 'ic_launcher_background.xml'),
  `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${ICON_BG}</color>\n</resources>\n`,
)
await mkdir(path.join(androidDir, 'mipmap-anydpi-v26'), { recursive: true })
for (const name of ['ic_launcher.xml', 'ic_launcher_round.xml']) {
  await writeFile(
    path.join(androidDir, 'mipmap-anydpi-v26', name),
    `<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n    <background android:drawable="@color/ic_launcher_background"/>\n    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>\n</adaptive-icon>\n`,
  )
}

// ── Для витрин магазинов ────────────────────────────────────────────────────
await writeFile(path.join(storeDir, 'google-play-512.png'), await square(512, ICON_SHARE))
await writeFile(path.join(storeDir, 'app-store-1024.png'), await square(1024, ICON_SHARE))

console.log('Готово:')
console.log('  Apple    ios/App/App/Assets.xcassets/AppIcon.appiconset + Splash.imageset')
console.log('  Android  app-icons/android  → скопировать в android/app/src/main/res')
console.log('  Витрины  app-icons/store    → 512 для Google Play, 1024 для App Store')
