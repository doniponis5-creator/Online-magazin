/**
 * Однократный сбор лицензированных фото через Openverse API
 * (агрегатор свободных изображений: Flickr и др.).
 * Только лицензии CC0 / Public Domain / CC BY (с указанием авторства).
 * Каждое фото после скачивания проверяется визуально перед использованием.
 *
 * Запуск: node scripts/fetch-photos.mjs [--force]
 * Права и источники фиксируются в ASSET_SOURCES.md.
 */
import { writeFile, mkdir } from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'

const OUT_DIR = 'public/photos'
const META_PATH = 'scripts/photo-metadata.json'
const FORCE = process.argv.includes('--force')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const TOPICS = {
  hero: 'laptop computer desk workspace dark',
  phone: 'smartphone isolated white background cutout',
  phone2: 'smartphone on wooden table top view screen',
  phone3: 'two smartphones next to each other',
  laptop: 'laptop computer open screen office',
  laptop2: 'laptop keyboard closeup',
  tablet: 'tablet computer screen isolated',
  tv: 'television isolated white background screen',
  headphones: 'headphones product photography',
  washer: 'washing machine white',
  coffee: 'espresso coffee machine kitchen',
  fryer: 'air fryer isolated kitchen device',
  robot: 'robot vacuum cleaner isolated white',
  watch: 'smartwatch black product isolated',
  speaker: 'bluetooth speaker black',
}

// слова, явно указывающие на неподходящий сюжет (люди, винтаж, магазины)
const BAD_WORDS = [
  'woman', 'man ', 'people', 'girl', 'boy', 'child', 'baby', 'portrait', 'selfie',
  'vintage', 'retro', 'antique', '1950', '1960', '1970', 'old ', 'advertis',
  'store', 'shop', 'market', 'crowd', 'meeting', 'wedding', 'cat', 'dog',
]
const GOOD_WORDS = ['white background', 'product', 'isolated', 'unsplash', 'studio', 'closeup', 'modern']

function score(item) {
  const t = (item.title || '').toLowerCase()
  let s = 0
  for (const w of GOOD_WORDS) if (t.includes(w)) s += 3
  for (const w of BAD_WORDS) if (t.includes(w)) s -= 6
  if ((item.width ?? 0) >= 1024) s += 1
  return s
}

async function searchTopic(query, attempt = 1) {
  const url =
    'https://api.openverse.org/v1/images/?format=json&per_page=20' +
    '&license=cc0,pdm,by&mature=false&aspect_ratio=wide,tall,square' +
    '&q=' +
    encodeURIComponent(query)
  const res = await fetch(url, {
    headers: { 'User-Agent': 'smart-centr-demo-prototype/0.2 (local; repo owner)' },
  })
  if (res.status === 429 && attempt <= 4) {
    await sleep(6000 * attempt)
    return searchTopic(query, attempt + 1)
  }
  if (!res.ok) throw new Error(`API ${res.status}`)
  const data = await res.json()
  return (data.results ?? []).filter((r) => {
    const w = r.width ?? 0
    const h = r.height ?? 0
    return (
      /jpe?g/.test(r.filetype || 'jpeg') &&
      w >= 800 &&
      w >= h * 0.55 &&
      w <= h * 2.4
    )
  })
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true })
  const metadata = existsSync(META_PATH) ? JSON.parse(readFileSync(META_PATH, 'utf8')) : {}
  // можно перезапрашивать отдельные ключи: node scripts/fetch-photos.mjs --force phone tv
  const onlyKeys = process.argv.slice(process.argv.indexOf('--force') + 1).filter((a) => !a.startsWith('--'))

  for (const [key, query] of Object.entries(TOPICS)) {
    if (onlyKeys.length > 0 && !onlyKeys.includes(key)) continue
    const outFile = `${OUT_DIR}/${key}.jpg`
    if (!FORCE && existsSync(outFile) && metadata[key]?.source === 'Openverse') {
      console.log(`skip ${key}`)
      continue
    }
    try {
      const results = (await searchTopic(query)).sort((a, b) => score(b) - score(a))
      let picked = null
      for (const r of results) {
        const t = (r.title || '').toLowerCase()
        if (BAD_WORDS.some((w) => t.includes(w))) continue
        picked = r
        break
      }
      if (!picked && results[0]) picked = results[0]
      if (!picked) {
        console.warn(`!! ${key}: ничего подходящего`)
        continue
      }
      const imgRes = await fetch(picked.url, {
        headers: { 'User-Agent': 'smart-centr-demo-prototype/0.2' },
      })
      if (!imgRes.ok) throw new Error(`download ${imgRes.status}`)
      const buf = Buffer.from(await imgRes.arrayBuffer())
      if (buf.length < 20000) throw new Error('файл слишком мал — вероятно, не фото')
      await writeFile(outFile, buf)
      metadata[key] = {
        title: picked.title,
        author: picked.creator ?? 'неизвестен',
        author_url: picked.creator_url ?? null,
        license: `${(picked.license || '').toUpperCase()} ${picked.license_version ?? ''}`.trim(),
        license_url: picked.license_url ?? null,
        page: picked.foreign_landing_url,
        source: `Openverse (${picked.provider})`,
        query,
        width: picked.width,
        bytes: buf.length,
      }
      console.log(
        `ok ${key}: "${picked.title}" by ${picked.creator} [${picked.license} ${picked.license_version ?? ''}] ${(buf.length / 1024) | 0}KB`,
      )
    } catch (e) {
      console.warn(`!! ${key}: ${e.message}`)
    }
    await sleep(1500)
  }
  await writeFile(META_PATH, JSON.stringify(metadata, null, 2))
  console.log(`metadata → ${META_PATH}`)
}

main()
