import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Smart Centr — демо-прототип',
  description:
    'Демонстрационный прототип витрины Smart Centr. Не подключён к 1С, SBonus и платёжным сервисам.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  )
}
