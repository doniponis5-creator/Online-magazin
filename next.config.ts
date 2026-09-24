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

const nextConfig: NextConfig = {
  experimental: { globalNotFound: true },
  // Только для `npm run dev`: приложение для телефона открывает сайт не по «localhost»,
  // а по адресу машины в сети. Без этого Next.js не отдаёт ему свои файлы разработки.
  allowedDevOrigins: ['127.0.0.1', '192.168.*.*', '10.*.*.*'],
  // Сборка для сервера: .next/standalone со своим server.js (Docker, см. Dockerfile).
  output: 'standalone',
  // Номер версии Next.js в заголовках ответа не показываем.
  poweredByHeader: false,
  // Страницы «Источники фото» больше нет: её фото давно не показываются.
  // Старые ссылки и поисковики ведём на главную, а не на 404.
  redirects() {
    return Promise.resolve([{ source: '/:lang(ru|ky)/sources', destination: '/:lang', permanent: true }])
  },
  headers() {
    return Promise.resolve([{ source: '/:path*', headers: SECURITY_HEADERS }])
  },
}

export default nextConfig
