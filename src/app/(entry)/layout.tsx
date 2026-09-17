import type { Metadata } from 'next'
import '../globals.css'
import '../light-lemon.css'

export const metadata: Metadata = {
  title: 'Smart Centr — техника для вашего дня',
  description:
    'Онлайн-магазин электроники и техники Smart Centr с доставкой по всему Кыргызстану.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  )
}
