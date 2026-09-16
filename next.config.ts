import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: { globalNotFound: true },
  // Прототип работает только на демо-данных: внешних сервисов и загрузок нет.
}

export default nextConfig
