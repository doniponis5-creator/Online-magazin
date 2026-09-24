import { beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

/**
 * Демо-вход для проверяющего из Apple. Apple вернула приложение (4.2.3):
 * проверяющий решил, что без Telegram и WhatsApp не войти. Демо-номер обязан
 * входить без них и не должен говорить «код ушёл в Telegram».
 */
const DEMO = '+996700000001'
let gateway: typeof import('@/lib/customer/gateway')

beforeAll(async () => {
  vi.stubEnv('SITE_DEMO_PHONE', DEMO)
  vi.stubEnv('SITE_DEMO_CODE', '4321')
  // Номер и код читаются при загрузке модуля — грузим после настройки.
  vi.resetModules()
  gateway = await import('@/lib/customer/gateway')
})

describe('демо-вход для Apple', () => {
  it('код никуда не отправляется и не называет Telegram', async () => {
    await expect(gateway.sendCode(DEMO, '127.0.0.1')).resolves.toBe('demo')
  })

  it('верный код впускает, неверный — нет', async () => {
    await expect(gateway.verifyCode(DEMO, '0000', '127.0.0.1')).rejects.toMatchObject({ status: 401 })
    const result = await gateway.verifyCode(DEMO, '4321', '127.0.0.1')
    expect(result.ok && !result.needName && result.customer.phone).toBe(DEMO)
  })

  it('обычный номер демо-входом не считается', () => {
    expect(gateway.isDemoPhone('+996700000002')).toBe(false)
  })
})
