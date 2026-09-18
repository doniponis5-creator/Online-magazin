// Иконка приложения и картинка для экрана запуска.
// Берёт фирменный знак public/brand/smart-centr-mark.jpg (жёлтая «S» на белом),
// обрезает белые поля и кладёт жёлтый знак на тёмный фон midnight-ink из DESIGN.md.
// Запуск: node scripts/make-ios-icon.mjs
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const root = path.resolve(import.meta.dirname, '..')
const mark = path.join(root, 'public/brand/smart-centr-mark.jpg')
const iconSet = path.join(root, 'ios/App/App/Assets.xcassets/AppIcon.appiconset')
const splashSet = path.join(root, 'ios/App/App/Assets.xcassets/Splash.imageset')

const INK = { r: 0x26, g: 0x32, b: 0x44, alpha: 1 }
const LEMON = '#eaf500'

// Знак в исходнике жёлтый на белом. У жёлтого синий канал = 0, у белого = 255,
// поэтому перевёрнутый синий канал и есть точная форма буквы.
async function glyph(height) {
  const trimmed = await sharp(mark).trim({ threshold: 20 }).resize({ height }).toBuffer()
  const { width } = await sharp(trimmed).metadata()
  const alpha = await sharp(trimmed).extractChannel('blue').negate().toBuffer()
  return sharp({ create: { width, height, channels: 3, background: LEMON } })
    .joinChannel(alpha)
    .png()
    .toBuffer()
}

async function icon(size) {
  return sharp({ create: { width: size, height: size, channels: 4, background: INK } })
    .composite([{ input: await glyph(Math.round(size * 0.5)), gravity: 'centre' }])
    .png()
    .toBuffer()
}

await mkdir(iconSet, { recursive: true })
await mkdir(splashSet, { recursive: true })

// Xcode 26 берёт одну картинку 1024×1024 и сам делает из неё все размеры.
await writeFile(path.join(iconSet, 'AppIcon-512@2x.png'), await icon(1024))
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

// Экран запуска: тот же тёмный фон, знак по центру.
// Картинка квадратная и большая: сториборд растягивает её на весь экран
// (scaleAspectFill), поэтому фон дотянется до краёв на любом iPhone.
async function splash(size) {
  return sharp({ create: { width: size, height: size, channels: 4, background: INK } })
    .composite([{ input: await glyph(Math.round(size * 0.2)), gravity: 'centre' }])
    .png()
    .toBuffer()
}

for (const [name, size] of [
  ['splash.png', 912],
  ['splash@2x.png', 1824],
  ['splash@3x.png', 2732],
]) {
  await writeFile(path.join(splashSet, name), await splash(size))
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

console.log('готово: иконка и картинка экрана запуска')
