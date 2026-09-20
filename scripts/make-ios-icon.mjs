// Иконка приложения и картинка для экрана запуска.
//
// Иконку владелец нарисовал сам: assets-src/icon/app-icon-source.jpg —
// чёрная «S» на жёлтом. Её мы только переводим в формат, который требует
// Apple: PNG 1024×1024 без прозрачности. Ничего не пририсовываем: как
// нарисовано, так и будет в App Store.
//
// Экран запуска сделан под неё же: тот самый жёлтый и чёрный знак. Так первое,
// что человек видит при запуске, совпадает с иконкой, по которой он нажал.
//
// Запуск: node scripts/make-ios-icon.mjs
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const root = path.resolve(import.meta.dirname, '..')
const mark = path.join(root, 'public/brand/smart-centr-mark.jpg')
const iconSource = path.join(root, 'assets-src/icon/app-icon-source.jpg')
const iconSet = path.join(root, 'ios/App/App/Assets.xcassets/AppIcon.appiconset')
const splashSet = path.join(root, 'ios/App/App/Assets.xcassets/Splash.imageset')

const INK = { r: 0x26, g: 0x32, b: 0x44, alpha: 1 }
const LEMON = '#eaf500'
// Жёлтый взят пипеткой из самой иконки, чтобы экран запуска и иконка были
// одного цвета — иначе при запуске заметен скачок оттенка.
const ICON_YELLOW = { r: 0xfe, g: 0xf1, b: 0x02, alpha: 1 }
const ICON_MARK = '#000000'

// Знак в исходнике жёлтый на белом. У жёлтого синий канал = 0, у белого = 255,
// поэтому перевёрнутый синий канал и есть точная форма буквы.
async function glyph(height, color = LEMON) {
  const trimmed = await sharp(mark).trim({ threshold: 20 }).resize({ height }).toBuffer()
  const { width } = await sharp(trimmed).metadata()
  const alpha = await sharp(trimmed).extractChannel('blue').negate().toBuffer()
  return sharp({ create: { width, height, channels: 3, background: color } })
    .joinChannel(alpha)
    .png()
    .toBuffer()
}

// Apple не принимает иконку с прозрачностью: flatten убирает альфа-канал,
// даже если в исходнике его не было.
async function icon(size) {
  return sharp(iconSource)
    .resize(size, size, { fit: 'cover' })
    .flatten({ background: '#ffffff' })
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

// Экран запуска: тот же жёлтый, что на иконке, и чёрный знак по центру.
// Картинка квадратная и большая: сториборд растягивает её на весь экран
// (scaleAspectFill), поэтому фон дотянется до краёв на любом iPhone.
async function splash(size) {
  return sharp({ create: { width: size, height: size, channels: 4, background: ICON_YELLOW } })
    .composite([{ input: await glyph(Math.round(size * 0.2), ICON_MARK), gravity: 'centre' }])
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
