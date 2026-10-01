import { getHeroVariant } from '@/lib/customer/gateway'
import { products } from '@/data/products'
import { saleDeck } from '@/lib/hero-sale'
import { devSaleCards } from '@/lib/hero-sale-dev'
import { HomeRest, HomeTop } from './HomeSections'

// Анимацию баннера владелец меняет в 1С: главную пересобираем не чаще раза в минуту.
export const revalidate = 60

export default async function HomePage() {
  const hero = await getHeroVariant()
  // товары со скидкой для баннера «Скидки» (на своём компьютере — снимок живого сайта, см. hero-sale-dev.ts)
  const sale = devSaleCards(saleDeck(products))
  return (
    <div className="container">
      <HomeTop hero={hero} sale={sale} />
      <HomeRest />
    </div>
  )
}
