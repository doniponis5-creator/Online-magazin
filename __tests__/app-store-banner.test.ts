import { describe, expect, it } from 'vitest'
import { APP_STORE_URL, isIos, isPlainSafari } from '@/lib/native/appStore'

const SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1'
const INSTAGRAM = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 380.0.0.30.89 (iPhone15,2; iOS 18_5; ru_RU)'
const CHROME_IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/129.0 Mobile/15E148 Safari/604.1'
const TELEGRAM = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1 Telegram-iOS'
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36'
const IPAD = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15'

describe('кому звать скачать приложение (04.10)', () => {
  it('iPhone и iPad — да; Android и компьютер — нет', () => {
    expect(isIos(SAFARI)).toBe(true)
    expect(isIos(INSTAGRAM)).toBe(true)
    expect(isIos(IPAD, 5)).toBe(true) // новый iPad называет себя Mac, но с касанием
    expect(isIos(IPAD, 0)).toBe(false) // настоящий Mac
    expect(isIos(ANDROID)).toBe(false)
  })

  it('в Safari полосу показывает сам iPhone — своя только во встроенных браузерах и Chrome', () => {
    expect(isPlainSafari(SAFARI)).toBe(true)
    expect(isPlainSafari(INSTAGRAM)).toBe(false)
    expect(isPlainSafari(CHROME_IOS)).toBe(false)
    expect(isPlainSafari(TELEGRAM)).toBe(false)
  })

  it('ссылка — на приложение в App Store Кыргызстана', () => {
    expect(APP_STORE_URL).toBe('https://apps.apple.com/kg/app/id6814226061')
  })
})
