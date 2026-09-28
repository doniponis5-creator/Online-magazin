import { getSiteSettings } from '@/lib/customer/gateway'
import { turnstileSiteKey } from '@/lib/security/turnstile'

// Настройки владельца нужны и невошедшему покупателю: на главной мы обещаем
// конкретные числа — приветственный бонус и какую часть заказа можно закрыть
// бонусами. Владелец меняет их в 1С, и обещание на сайте должно меняться вместе.
export const dynamic = 'force-dynamic'

export async function GET() {
  const settings = await getSiteSettings()
  return Response.json({
    ok: true,
    welcomeBonus: settings.welcomeBonus,
    bonusMaxPct: settings.bonusMaxPct,
    bonusMaxOrder: settings.bonusMaxOrder,
    guestCheckout: settings.guestCheckout,
    // Открытый ключ «я не робот» для входа и заказа; null — проверка выключена
    turnstileSiteKey: turnstileSiteKey(),
  })
}
