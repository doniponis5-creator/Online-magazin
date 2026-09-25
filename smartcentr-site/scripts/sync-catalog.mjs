#!/usr/bin/env node
/**
 * Синхронизация каталога: сервер SBonus → src/data/1c/catalog.json.
 *
 * 1С каждые 10 минут отправляет на сервер товары, цены, наличие и фото.
 * Этот скрипт забирает каталог и перезаписывает файл сайта, только если каталог изменился
 * (сравнение по hash). Фото на сайт не скачиваются — они отдаются сервером по постоянным адресам.
 *
 * Коды выхода: 0 — каталог изменился (нужна пересборка сайта), 10 — без изменений, 1 — ошибка.
 * Настройки: SHOP_API_URL, SHOP_API_SECRET — из окружения или .env.local / .env.production.
 *
 * Запуск: node scripts/sync-catalog.mjs
 */
import { createHmac } from 'node:crypto'
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CATALOG = join(ROOT, 'src', 'data', '1c', 'catalog.json')
const PATH = '/api/v1/webhook/site/catalog'

function readEnvFiles() {
  const values = {}
  for (const name of ['.env.production', '.env.local']) {
    const file = join(ROOT, name)
    if (!existsSync(file)) continue
    for (const raw of readFileSync(file, 'utf8').split(/\r?\n/)) {
      const line = raw.trim()
      if (!line || line.startsWith('#') || !line.includes('=')) continue
      const index = line.indexOf('=')
      values[line.slice(0, index).trim()] = line.slice(index + 1).trim()
    }
  }
  return values
}

const fileEnv = readEnvFiles()
const apiUrl = (process.env.SHOP_API_URL || fileEnv.SHOP_API_URL || '').replace(/\/+$/, '')
const secret = process.env.SHOP_API_SECRET || fileEnv.SHOP_API_SECRET || ''

function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`)
}

async function main() {
  if (!apiUrl || !secret) {
    log('Не заданы SHOP_API_URL и SHOP_API_SECRET')
    return 1
  }
  const signature = createHmac('sha256', secret).update(PATH, 'utf8').digest('hex')
  const response = await fetch(`${apiUrl}${PATH}`, {
    headers: { 'X-Signature': signature },
    signal: AbortSignal.timeout(60000),
  })
  if (!response.ok) {
    log(`Сервер ответил ${response.status}`)
    return 1
  }
  const remote = await response.json()
  if (!remote.hash || !Array.isArray(remote.items)) {
    log('На сервере ещё нет каталога — 1С его не отправляла. Файл сайта не трогаю.')
    return 10
  }
  // Защита от пустого снимка: не затираем рабочий каталог, если 1С прислала 0 товаров.
  if (remote.items.length === 0) {
    log('Сервер вернул пустой каталог — файл сайта не трогаю.')
    return 10
  }

  let localHash = null
  if (existsSync(CATALOG)) {
    try {
      localHash = JSON.parse(readFileSync(CATALOG, 'utf8')).hash ?? null
    } catch {
      localHash = null
    }
  }
  if (localHash === remote.hash) {
    log(`Каталог без изменений (${remote.items.length} товаров)`)
    return 10
  }

  const content = JSON.stringify({ hash: remote.hash, exportedAt: remote.exportedAt, items: remote.items }, null, 2)
  const temp = `${CATALOG}.tmp`
  writeFileSync(temp, content + '\n', 'utf8')
  renameSync(temp, CATALOG)
  log(`Каталог обновлён: ${remote.items.length} товаров, hash ${remote.hash.slice(0, 12)}`)
  return 0
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    log(`Ошибка: ${error.message}`)
    process.exit(1)
  })
