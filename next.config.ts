import type { NextConfig } from 'next'

/**
 * Заголовки безопасности на каждый ответ сайта.
 *
 * Ставим их здесь, а не в nginx: сайт обновляется скриптом, nginx руками не
 * трогаем, а Cloudflare и nginx эти заголовки пропускают как есть.
 * Сайт нигде не встраивается в рамку легально: панель 1С открывает адреса в
 * браузере, приложение для телефона грузит сайт напрямую. Поэтому рамка
 * разрешена только самому сайту — чужой домен не покажет конструктор у себя.
 */
const SECURITY_HEADERS = [
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'self'" },
  // По ссылке наружу (wa.me, Telegram) уходит только домен, без адреса проекта.
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
]

/**
 * Для Cloudflare (не для браузера): сколько держать страницу у себя. Next.js ставит своим страницам
 * `s-maxage=31536000` — по нему Cloudflare хранил бы старую цену год; этот заголовок Cloudflare читает раньше.
 */
const CDN_PAGE = [{ key: 'Cloudflare-CDN-Cache-Control', value: 'max-age=30' }]

const nextConfig: NextConfig = {
  experimental: { globalNotFound: true },
  // Только для `npm run dev`: приложение для телефона открывает сайт не по «localhost»,
  // а по адресу машины в сети. Без этого Next.js не отдаёт ему свои файлы разработки.
  allowedDevOrigins: ['127.0.0.1', '192.168.*.*', '10.*.*.*'],
  // Сборка для сервера: .next/standalone со своим server.js (Docker, см. Dockerfile).
  output: 'standalone',
  // Номер версии Next.js в заголовках ответа не показываем.
  poweredByHeader: false,
  /**
   * Фото товаров из 1С приходят 1200×1200, а в баннере «Скидки» карточка ~200 px (телефон с 3× экраном — ~600):
   * телефон распаковывал вчетверо больше, чем видно. Сервер сайта ужимает их по ширине экрана (sharp уже есть).
   * 90 — для фото товаров «как было»; 75 — по умолчанию для остального. Только фото нашего сервера SBonus.
   */
  images: {
    remotePatterns: [{ protocol: 'https', hostname: 'api.smartcentr.store', pathname: '/api/v1/shop/photos/**' }],
    qualities: [75, 90],
  },
  // Страницы «Источники фото» больше нет: её фото давно не показываются.
  // Старые ссылки и поисковики ведём на главную, а не на 404.
  /** Фото товаров через сайт — их кэширует Cloudflare, SBonus отдаёт каждое один раз (src/lib/photoSrc.ts). */
  rewrites() {
    return Promise.resolve({
      beforeFiles: [{ source: '/p/:path*', destination: 'https://api.smartcentr.store/api/v1/shop/photos/:path*' }],
      afterFiles: [],
      fallback: [],
    })
  },
  redirects() {
    return Promise.resolve([{ source: '/:lang(ru|ky)/sources', destination: '/:lang', permanent: true }])
  },
  headers() {
    return Promise.resolve([
      { source: '/:path*', headers: SECURITY_HEADERS },
      // Страницы одинаковые для всех (что видит вошедший — подгружается отдельно, из /api): Cloudflare держит
      // их 30 с у себя, и наплыв с рекламы до сервера сайта не доходит (08.10; правило кэша в Cloudflare — см.
      // docs/LOAD_UZ.md). Заказ (ссылка с токеном), галерея («мои»), служебное — мимо: там свой ответ каждому.
      { source: '/:lang(ru|ky)', headers: CDN_PAGE },
      { source: '/:lang(ru|ky)/:path((?!order|kitchen/gallery|dev).*)', headers: CDN_PAGE },
    ])
  },
}

export default nextConfig
