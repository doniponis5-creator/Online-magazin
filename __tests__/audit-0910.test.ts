import { describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))

import { BUY_INTENT, DEFER } from '@/lib/telegram/order'
import { onlyGreeting } from '@/lib/assistant/respond'
import { storePolicy } from '@/lib/assistant/policy'

// Аудит 09.10 по журналу Instagram/WhatsApp
describe('аудит 09.10', () => {
  it('приветствие — не покупка: «салам» не содержит «алам» для анкеты', () => {
    for (const hi of ['Валлейкум ассалам', 'Салам', 'Алейкум салам', 'Саламатсызбы', 'уа алейкум салам', 'Алекум салам Кызыл кыяда', 'Саламатсызбы. Рахмаат.']) {
      expect(BUY_INTENT.test(hi), hi).toBe(false)
    }
  })

  it('«алам» целым словом — по-прежнему покупка', () => {
    for (const buy of ['алам', 'Ушуну алам', 'сатып алайын', 'Мен алам эртең']) {
      expect(BUY_INTENT.test(buy), buy).toBe(true)
    }
  })

  it('«шартым келгенде алам» — это «потом»', () => {
    expect(DEFER.test('Буюрса шартым кплгенде алам. НАРЫН')).toBe(true)
    expect(DEFER.test('акча келгенде алам')).toBe(true)
  })

  it('от ответа осталось приветствие с именем — это пусто', () => {
    expect(onlyGreeting('Ассаламу алейкум, Клара.')).toBe(true)
    expect(onlyGreeting('Ассаламу алейкум.')).toBe(true)
    expect(onlyGreeting('Ооба.')).toBe(false)
    expect(onlyGreeting('Ассаламу алейкум, Клара. Баасы 23 900 сом.')).toBe(false)
  })

  it('правило скидки: вопрос о цене — не просьба', () => {
    expect(storePolicy()).toContain('это НЕ просьба о скидке')
  })
})
