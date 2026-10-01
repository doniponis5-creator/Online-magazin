import { getHeroVariant } from '@/lib/customer/gateway'
import { HomeRest, HomeTop } from './HomeSections'

// Анимацию баннера владелец меняет в 1С: главную пересобираем не чаще раза в минуту.
export const revalidate = 60

export default async function HomePage() {
  const hero = await getHeroVariant()
  return (
    <div className="container">
      <HomeTop hero={hero} />
      <HomeRest />
    </div>
  )
}
