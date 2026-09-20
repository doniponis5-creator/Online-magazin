#!/usr/bin/env node
/**
 * Телеграм-бот на своём компьютере — для проверки, пока сайта нет в интернете.
 *
 * Telegram умеет сам приносить сообщения на сайт (webhook), но для этого сайт
 * должен быть виден из интернета. На ноутбуке его не видно, поэтому здесь
 * наоборот: скрипт сам спрашивает Telegram «есть новые сообщения?» и передаёт
 * их сайту в тот же самый адрес, в который на сервере стучится Telegram.
 *
 * Своей логики у скрипта нет намеренно: весь бот живёт в src/lib/telegram.
 * Иначе бот на ноутбуке и бот на сервере однажды разошлись бы в поведении.
 *
 * Запуск (сайт должен быть запущен через npm run dev):
 *   node scripts/telegram-bot.mjs
 */

import { readFileSync } from 'node:fs'

function envValue(name) {
  if (process.env[name]) return process.env[name]
  try {
    for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
      const [key, ...rest] = line.split('=')
      if (key.trim() === name) return rest.join('=').trim()
    }
  } catch {
    // .env.local может и не быть
  }
  return ''
}

const TOKEN = envValue('TELEGRAM_BOT_TOKEN')
const SECRET = envValue('TELEGRAM_WEBHOOK_SECRET')
const SITE = process.env.SITE_ORIGIN || 'http://localhost:3000'

if (!TOKEN) {
  console.error('Нет TELEGRAM_BOT_TOKEN в .env.local. Допишите строку и запустите снова.')
  process.exit(1)
}
if (!SECRET) {
  console.error('Нет TELEGRAM_WEBHOOK_SECRET в .env.local. Придумайте длинное слово и допишите строку.')
  process.exit(1)
}

const API = `https://api.telegram.org/bot${TOKEN}`

async function tg(method, body) {
  const response = await fetch(`${API}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  return await response.json()
}

// Webhook и опрос одновременно не работают: снимаем webhook, если он был.
await tg('deleteWebhook', { drop_pending_updates: false })
const me = await tg('getMe', {})
if (!me.ok) {
  console.error('Токен не подошёл:', me.description)
  process.exit(1)
}
console.log(`Бот @${me.result.username} слушает. Напишите ему в Telegram. Остановить — Ctrl+C.`)

let offset = 0
for (;;) {
  let updates
  try {
    updates = await tg('getUpdates', { offset, timeout: 25 })
  } catch (error) {
    console.error('Telegram не ответил:', error.message)
    await new Promise((r) => setTimeout(r, 3000))
    continue
  }

  for (const update of updates.result ?? []) {
    offset = update.update_id + 1
    const text = update.message?.text
    if (text) console.log(`→ ${text}`)

    try {
      const response = await fetch(`${SITE}/api/telegram/webhook`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-telegram-bot-api-secret-token': SECRET },
        body: JSON.stringify(update),
      })
      if (!response.ok) console.error(`Сайт ответил ${response.status}`)
    } catch (error) {
      console.error('Сайт не ответил:', error.message)
    }
  }
}
