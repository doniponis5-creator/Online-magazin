/**
 * Подсказка браузеру «здесь входили» (08.10, нагрузка перед рекламой). Сама кука входа закрыта от скриптов,
 * поэтому раньше каждая страница спрашивала сервер сайта «кто я?» — и гость, а это почти все с рекламы,
 * дёргал сервер на каждом экране. Теперь: есть подсказка — спрашиваем; нет — спрашиваем один раз за вкладку
 * (вдруг вход был до этой правки), дальше гость молчит. Подсказку ставит и снимает сервер вместе со входом.
 */
export const LOGIN_HINT = 'sc_in'
const GUEST_MARK = 'sc-guest'

export function mayBeSignedIn(): boolean {
  try {
    if (document.cookie.split('; ').some((c) => c === `${LOGIN_HINT}=1`)) return true
    return window.sessionStorage.getItem(GUEST_MARK) !== '1'
  } catch {
    return true
  }
}

/** Сервер ответил «не вошёл» — в этой вкладке больше не спрашиваем (до входа: он ставит подсказку). */
export function markGuest(): void {
  try {
    window.sessionStorage.setItem(GUEST_MARK, '1')
  } catch {
    // приватный режим — спросим ещё раз, не страшно
  }
}
