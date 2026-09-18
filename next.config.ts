import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: { globalNotFound: true },
  // Только для `npm run dev`: приложение для телефона открывает сайт не по «localhost»,
  // а по адресу машины в сети. Без этого Next.js не отдаёт ему свои файлы разработки.
  allowedDevOrigins: ['127.0.0.1', '192.168.*.*', '10.*.*.*'],
  // Сборка для сервера: .next/standalone со своим server.js (Docker, см. Dockerfile).
  output: 'standalone',
  // Номер версии Next.js в заголовках ответа не показываем.
  poweredByHeader: false,
}

export default nextConfig
