import { describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { detectLangScored } from '@/lib/assistant/talk'
import { readTurns, withoutRepeatGreeting } from '@/lib/assistant/respond'
import { talkLang } from '@/lib/assistant/reply'
import { products } from '@/data/products'

/** Разбор переписок 05.10 (369 разговоров Instagram и WhatsApp за 3 дня). */
describe('разговор, который начал магазин (ответ на комментарий)', () => {
  const template = { role: 'assistant', text: 'Ассаламу алейкум! Кайсы товар кызыктырды? Жазыңыз — баасын айтып берем.' }
  it('первая реплика магазина не выбрасывается — второго «Ассаламу алейкум» нет (было 142 за сутки)', () => {
    const turns = readTurns([template, { role: 'user', text: 'Мини посудамойка' }])
    expect(turns.map((t) => t.role)).toEqual(['assistant', 'user'])
    expect(withoutRepeatGreeting('Ассаламу алейкум. Есть компактная настольная Midea, 23 900 сом.', turns)).toBe('Есть компактная настольная Midea, 23 900 сом.')
  })
  it('покупатель написал неясно («Мини посудамойка») — язык разговора по нашей кыргызской первой фразе', () => {
    expect(talkLang(readTurns([template, { role: 'user', text: 'Мини посудамойка' }]), 'ru')).toBe('ky')
  })
})

describe('кыргызские слова с окончаниями — кыргызский, а не русский', () => {
  it('рилс посудомойки: «идиш жуугуч», «кичинекей», «наркы»', () => {
    for (const q of ['Мини идиш жуган машинка', 'Идиш жуугуч машина', 'Кичинекей посудамойка', 'Кичине идиш жугуч машинка', 'Пасуда жууган мини машина', 'Наркы стиральный кандай?']) {
      expect(detectLangScored(q, 'ru'), q).toEqual({ lang: 'ky', strong: true })
    }
  })
  it('узбекское «ювадигон» — узбекский; «Слишком дорого» — уверенно русский', () => {
    expect(detectLangScored('Кичкина идиш ювадигон машина', 'ru').lang).toBe('uz')
    expect(detectLangScored('Слишком дорого', 'ky')).toEqual({ lang: 'ru', strong: true })
  })
})

describe('напоминание «суроо калдыбы?»', () => {
  const id = products.find((p) => p.price > 0)!.id
  it('на языке последнего ответа бота: после русского ответа — по-русски', async () => {
    const { followUp } = await import('@/lib/assistant/followup')
    const turns = [
      { role: 'user' as const, text: 'Мини посудамойка' },
      { role: 'assistant' as const, text: 'Есть компактная настольная Midea на 2 комплекта, 23 900 сом. Вам доставка нужна?' },
    ]
    expect(((await followUp(turns, [id], 'ky')) as { text: string }).text).toMatch(/^Остались вопросы по /)
  })
  it('сказал «потом» — не напоминаем через два часа', async () => {
    const { followUp } = await import('@/lib/assistant/followup')
    for (const later of ['Акча кылайын анан', 'кийин алам', 'Подумаю, потом напишу']) {
      expect(await followUp([{ role: 'assistant', text: 'MIDEA — 23 900 сом.' }, { role: 'user', text: later }, { role: 'assistant', text: 'Макул.' }], [id], 'ky'), later).toEqual({ skip: 'declined' })
    }
  })
  it('в названии нет единиц без числа: «Весы кг» → «Весы»', async () => {
    const { spokenName } = await import('@/lib/assistant/followup')
    expect(spokenName('Весы 200 кг')).toBe('Весы')
  })
})
