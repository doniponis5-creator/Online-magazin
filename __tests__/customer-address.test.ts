import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

/**
 * Постоянный адрес доставки: правила, хранилище на сайте и точка для кабинета.
 * Номера и адреса выдуманы; файл пишется во временную папку.
 */
const session = vi.hoisted(() => ({ current: null as { phone: string; name: string; exp: number } | null }))
vi.mock('@/app/api/customer/route-helpers', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/app/api/customer/route-helpers')>()),
  currentSession: async () => session.current,
}))

import { addressLine, cleanAddress } from '@/lib/customer/address-rules'

const PHONE = '+996700111222'
let dir = ''
let store: typeof import('@/lib/customer/addresses')
let route: typeof import('@/app/api/customer/address/route')

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'sc-address-'))
  vi.stubEnv('CUSTOMERS_DIR', dir)
  store = await import('@/lib/customer/addresses')
  route = await import('@/app/api/customer/address/route')
})

afterAll(() => {
  vi.unstubAllEnvs()
  rmSync(dir, { recursive: true, force: true })
})

beforeEach(() => {
  session.current = null
})

const put = (body: unknown) =>
  route.PUT(new Request('http://site.test/api/customer/address', { method: 'PUT', body: JSON.stringify(body) }))

describe('правила адреса', () => {
  it('убирает лишние пробелы', () => {
    expect(cleanAddress({ city: '  Бишкек ', address: 'ул.   Токтогула 12,\nкв. 5 ' })).toEqual({
      city: 'Бишкек',
      address: 'ул. Токтогула 12, кв. 5',
    })
  })

  it('те же границы, что в оформлении заказа: город от 2 знаков, адрес от 4', () => {
    expect(cleanAddress({ city: 'Б', address: 'ул. Ленина 1' })).toBeNull()
    expect(cleanAddress({ city: 'Ош', address: 'д.1' })).toBeNull()
    expect(cleanAddress({ city: 'Ош', address: 'д. 1' })).toEqual({ city: 'Ош', address: 'д. 1' })
    expect(cleanAddress({ city: 'Ош', address: 'x'.repeat(201) })).toBeNull()
    expect(cleanAddress(null)).toBeNull()
    expect(cleanAddress({ city: 5, address: ['ул. Ленина 1'] })).toBeNull()
  })

  it('одной строкой для меню кабинета', () => {
    expect(addressLine({ city: 'Бишкек', address: 'ул. Токтогула 12' })).toBe('Бишкек, ул. Токтогула 12')
  })
})

describe('хранилище адресов', () => {
  it('сохраняет, отдаёт и стирает по номеру телефона', async () => {
    expect(await store.getAddress(PHONE)).toBeNull()
    expect(await store.setAddress(PHONE, { city: 'Бишкек', address: 'ул. Токтогула 12' })).toEqual({
      city: 'Бишкек',
      address: 'ул. Токтогула 12',
    })
    expect(await store.getAddress(PHONE)).toEqual({ city: 'Бишкек', address: 'ул. Токтогула 12' })
    // в файле — целиком и без временных копий рядом
    const book = JSON.parse(readFileSync(join(dir, 'addresses.json'), 'utf8'))
    expect(book[PHONE]).toMatchObject({ city: 'Бишкек', address: 'ул. Токтогула 12' })
    expect(existsSync(join(dir, `addresses.json.${process.pid}.tmp`))).toBe(false)

    await store.removeAddress(PHONE)
    expect(await store.getAddress(PHONE)).toBeNull()
  })

  it('плохой адрес не записывает', async () => {
    expect(await store.setAddress(PHONE, { city: '', address: '' })).toBeNull()
    expect(await store.getAddress(PHONE)).toBeNull()
  })

  it('два сохранения подряд не теряют друг друга', async () => {
    await Promise.all([
      store.setAddress('+996700000001', { city: 'Ош', address: 'ул. Курманжан Датка 5' }),
      store.setAddress('+996700000002', { city: 'Каракол', address: 'ул. Абдрахманова 7' }),
    ])
    expect(await store.getAddress('+996700000001')).toMatchObject({ city: 'Ош' })
    expect(await store.getAddress('+996700000002')).toMatchObject({ city: 'Каракол' })
  })
})

describe('/api/customer/address', () => {
  it('без входа — 401: у гостя адрес помнит только его браузер', async () => {
    expect((await route.GET()).status).toBe(401)
    expect((await put({ city: 'Ош', address: 'ул. Ленина 1' })).status).toBe(401)
    expect((await route.DELETE()).status).toBe(401)
  })

  it('сохранить, прочитать и стереть свой адрес', async () => {
    session.current = { phone: PHONE, name: 'Тест', exp: Date.now() + 60_000 }
    expect((await put({ city: 'О', address: 'x' })).status).toBe(400)

    const saved = await (await put({ city: 'Бишкек ', address: ' мкр. Джал 23, кв. 4' })).json()
    expect(saved).toEqual({ ok: true, address: { city: 'Бишкек', address: 'мкр. Джал 23, кв. 4' } })

    const read = await route.GET()
    expect(read.headers.get('Cache-Control')).toBe('no-store')
    expect(await read.json()).toEqual({ ok: true, address: { city: 'Бишкек', address: 'мкр. Джал 23, кв. 4' } })

    expect((await route.DELETE()).status).toBe(200)
    expect(await (await route.GET()).json()).toEqual({ ok: true, address: null })
  })
})
