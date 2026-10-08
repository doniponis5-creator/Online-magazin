import { describe, expect, it } from 'vitest'
import { placeBlock, placesIn } from '@/lib/assistant/places'
import { storePolicy } from '@/lib/assistant/policy'

const first = (text: string) => placesIn(text)[0]
const NO_CAR = /своей машины туда нет/
const FREE = /бесплатно до центра/

describe('справочник сёл: где покупатель и везём ли (владелец 08.10)', () => {
  it('Токмок, Кара-Балта, Талас, Нарын — машины нет, предлагаем Бишкек', () => {
    for (const text of ['Токмокко жеткиресизби', 'Кара-Балтага', 'Таластанмын', 'Нарын шаарынан', 'Кочкордон болом']) {
      const place = first(text)
      expect(place, text).toBeTruthy()
      expect(place.rule, text).toMatch(NO_CAR)
      expect(place.rule, text).toMatch(/Бишкек/)
    }
  })

  it('свои города и сёла их районов — бесплатно до центра', () => {
    expect(first('Бишкекке доставка канча').rule).toMatch(FREE)
    expect(first('Озгондон').rule).toMatch(/Узген/)
    expect(first('Баткенден').rule).toMatch(FREE)
    expect(first('Майлуу-Сууга жеткиресизби').rule).toMatch(/бесплатно до центра: Майлуу-Суу/) // владелец 08.10
    expect(first('Жалал-Абадка').rule).toMatch(/Джалал-Абад/)
    expect(placesIn('Ак-Суу айылы').some((p) => p.district === 'Лейлекский район' && /Исфана/.test(p.rule))).toBe(true)
  })

  it('село с названием города — не город: Кызыл-Кия на Иссык-Куле не бесплатно', () => {
    const villages = placesIn('Кызыл Кия')
    expect(villages.find((p) => p.district === 'Кызыл-Кия')?.rule).toMatch(FREE)
    expect(villages.find((p) => p.district === 'Ак-Суйский район')?.rule).not.toMatch(FREE)
  })

  it('Араван — рядом с магазином; Кемин — цену скажет руководство', () => {
    expect(first('Араван').rule).toMatch(/рядом с магазином/)
    expect(first('Кемин шаары').rule).toMatch(/руководство/)
  })

  it('обычные слова чата — не сёла', () => {
    for (const text of [
      'Саламатсызбы', 'Канча сом', 'Можно в рассрочку?', 'Жоо менин каражатым жэтпейт экен кийинчерээк алам гоо',
      'Ал чала жувуйт дешип атышат адамдар', 'Мага орточоо өтө чооң эмес халадилниик керек элее',
      'Макул рахмаат акча даярдап алайын буйруса алам', 'Түп нуска экенби', 'Мен Айбике, алма тууралуу',
      'Стиральная машина FLAGMAN AV-80MXLB', 'Телевизор 43 дюйм бар бы', 'Достук үчүн рахмат',
    ]) expect(placesIn(text), text).toEqual([])
  })

  it('подсказка модели: одно село — без вопроса о районе, тёзки — спросить район', () => {
    expect(placeBlock('Канча сом')).toBe('')
    expect(placeBlock('Токмоктон')).toMatch(/МЕСТО, КОТОРОЕ НАЗВАЛ ПОКУПАТЕЛЬ[\s\S]*Токмак/)
    expect(placeBlock('Токмоктон')).not.toMatch(/спроси район/)
    expect(placeBlock('Кашка-Суудан болом')).toMatch(/спроси район/)
  })

  it('правила магазина знают про Токмок, Кара-Балту, Талас и Нарын', () => {
    expect(storePolicy()).toMatch(/Токмок, Кара-Балта, Таласская и Нарынская области — своей машины туда нет/)
  })
})
