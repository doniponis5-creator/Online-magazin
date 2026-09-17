import type { Metadata } from 'next'
import { AccountView } from '@/components/AccountView'
import '@/components/home-merchandising.css'
import '@/components/account.css'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  return {
    title: `${lang === 'ky' ? 'Жеке кабинет' : 'Личный кабинет'} SBonus — Smart Centr`,
    robots: { index: false },
  }
}

export default async function AccountPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  return (
    <div className="container">
      <div className="page-head">
        <h1 className="page-head__title">{lang === 'ky' ? 'Жеке кабинет' : 'Личный кабинет'}</h1>
      </div>
      <AccountView />
    </div>
  )
}
