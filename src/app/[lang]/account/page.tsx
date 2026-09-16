import Link from 'next/link'
import type { Metadata } from 'next'
import { Brand } from '@/components/Brand'
import { IconCart, IconHeart } from '@/components/Icons'
import '@/components/home-merchandising.css'

export async function generateMetadata({ params }: { params: Promise<{lang:string}> }): Promise<Metadata> {
 const { lang } = await params
 return { title: `${lang === 'ky' ? 'Жеке кабинет' : 'Личный кабинет'} SBonus — Smart Centr` }
}
export default async function AccountPage({params}: {params: Promise<{lang:string}>}) {
 const {lang} = await params
 const ky = lang === 'ky'
 return <div className="container"><div className="page-head"><h1 className="page-head__title">{ky ? 'Жеке кабинет' : 'Личный кабинет'}</h1></div>
 <div className="account-layout">
  <section className="account-loyalty"><Brand bonus /><h2>{ky ? 'Сиздин бонустарыңыз. Бир кабинет.' : 'Ваши бонусы. Один кабинет.'}</h2>
   <p>{ky ? 'Баланс, деңгээл жана бонустардын тарыхы — сиздин SBonus эсебиңизде.' : 'Баланс, уровень и история бонусов — в вашем существующем аккаунте SBonus.'}</p>
  </section>
  <section className="account-access"><h2>{ky ? 'Кабинет жакында ачылат' : 'Вход скоро откроется'}</h2>
   <p>{ky ? 'Азыр товарларды тандап, сүйүктүүлөргө же себетке кошо аласыз. Кабинет жеткиликтүү болгондо ушул жерден киресиз.' : 'Пока можно выбирать товары, сохранять избранное и собирать корзину. Когда кабинет станет доступен, вы сможете войти здесь.'}</p>
   <button className="btn btn--primary" disabled>{ky ? 'SBonus аркылуу кирүү' : 'Войти в SBonus'}</button>
   <div className="account-links"><Link href={`/${lang}/favorites`}><IconHeart size={20}/>{ky ? 'Сүйүктүүлөр' : 'Избранное'}</Link><Link href={`/${lang}/cart`}><IconCart size={20}/>{ky ? 'Себет' : 'Корзина'}</Link></div>
  </section>
 </div></div>
}
