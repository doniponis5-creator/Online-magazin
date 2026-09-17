import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: { globalNotFound: true },
  // Сборка для сервера: .next/standalone со своим server.js (Docker, см. Dockerfile).
  output: 'standalone',
  // Номер версии Next.js в заголовках ответа не показываем.
  poweredByHeader: false,
}

export default nextConfig
