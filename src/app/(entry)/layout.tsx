import type { Metadata } from 'next'
import '../globals.css'
import '../light-lemon.css'

export const metadata: Metadata = {
  title: 'Смарт Центр (Smart Centr) — техника для вашего дня',
  description:
    'Смарт Центр (Smart Centr, S MARKET) — онлайн-магазин электроники и техники с доставкой '
    + 'по всему Кыргызстану.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  )
}
