import { describe, expect, it } from 'vitest'
import { PROMO_STYLES } from '@/components/kitchen/KitchenPromo'
import { STYLES } from '@/lib/kitchen/styles'
import { kitchenTexts } from '@/components/kitchen/texts'
import { SPLASH_GROUPS } from '@/lib/kitchen/finishes'

describe('баннер кухни на главной — снимок каталога стилей', () => {
  it('число стилей в баннере совпадает с каталогом (STYLES.length)', () => {
    expect(PROMO_STYLES.count).toBe(STYLES.length)
  })

  it('пять образцов — первые цвета своих стилей, как в каталоге', () => {
    expect(PROMO_STYLES.swatches.map((s) => s.id)).toEqual(['hitech', 'modern', 'japandi', 'nero', 'provence'])
    for (const sw of PROMO_STYLES.swatches) {
      const tone = STYLES.find((s) => s.id === sw.id)?.tones[0]
      expect(tone, sw.id).toBeDefined()
      expect({ id: sw.id, facade: sw.facade, wood: sw.wood }).toEqual({
        id: sw.id,
        facade: tone!.facade,
        wood: tone!.texture === 'wood',
      })
    }
  })
})

/** Все строки, которые может увидеть покупатель: значения, вложенные списки и то, что возвращают функции. */
function allStrings(v: unknown, out: string[] = []): string[] {
  if (typeof v === 'string') out.push(v)
  else if (typeof v === 'function') {
    const fn = v as (...a: unknown[]) => unknown
    let r: unknown
    try {
      r = fn(...Array(fn.length).fill(1))
    } catch {
      r = fn([120, 150, 200], 470)
    }
    allStrings(r, out)
  } else if (v && typeof v === 'object') for (const x of Object.values(v)) allStrings(x, out)
  return out
}

/** Всё, кроме группы `stove`: «Плита» — отдельностоящая плита, свой предмет со своим словом (spec 2026-09-27-kitchen-stove). */
const exceptStove = (t: ReturnType<typeof kitchenTexts>) => ({ ...t, stove: null })

describe('тексты конструктора — один предмет, одно слово (T13, T17)', () => {
  it('ru: «Духовка» и «Варочная панель» — нигде нет «Плита» и «Духовой шкаф»', () => {
    const bad = allStrings(exceptStove(kitchenTexts('ru'))).filter((s) => /плит(?!к)|духовой шкаф/i.test(s))
    expect(bad).toEqual([])
  })

  it('ky: «Бышыруучу панель» и «Сордургуч» — нигде нет «Плита» и «Сордурма»', () => {
    const bad = allStrings(exceptStove(kitchenTexts('ky'))).filter((s) => /плит(?!к)|сордурма/i.test(s))
    expect(bad).toEqual([])
  })

  it('отдельностоящая плита — «Плита», не «варочная панель» и не «Духовой шкаф»', () => {
    for (const lang of ['ru', 'ky'] as const) {
      const t = kitchenTexts(lang)
      expect(t.stove.name).toBe('Плита')
      expect(allStrings(t.stove).filter((s) => /варочн|бышыруучу|духовой шкаф|сордурма/i.test(s))).toEqual([])
    }
  })

  it('духовка внутри плиты — «Духовка» на обоих языках; ky «Сордургуч» — это вытяжка', () => {
    for (const lang of ['ru', 'ky'] as const) {
      const t = kitchenTexts(lang)
      expect(t.slots.hood).toBe(lang === 'ru' ? 'Вытяжка' : 'Сордургуч')
      expect(t.stove.group).toMatch(/духовка/i)
      expect(t.stove.ovenNote).toMatch(/духовка/i)
      const oven = [t.stove.group, t.stove.ovenNote, t.stove.ovenInStove]
      expect(oven.filter((s) => /сордургуч|вытяжк/i.test(s))).toEqual([])
    }
  })

  it('проверки проекта при плите говорят «плита», не «варочная панель»', () => {
    for (const lang of ['ru', 'ky'] as const) {
      const c = kitchenTexts(lang).stove.checks
      const all = [c.sidesOk(60, 60), c.sidesWarn(20, 60), c.window, c.fridge(10), c.hoodOk(65, false), c.hoodWarn(50, 75, true)]
      for (const s of all) expect(s).toMatch(/плит/i)
      expect(all.filter((s) => /варочн|бышыруучу|панел/i.test(s))).toEqual([])
    }
  })
})

describe('тексты конструктора — правки аудита T01–T18', () => {
  const ru = kitchenTexts('ru')
  const ky = kitchenTexts('ky')

  it('T01: «не поместилась» не спорит с родом предмета', () => {
    expect(ru.dropped('Холодильник', 20)).not.toMatch(/поместилась/)
    expect(ru.dropped('Холодильник', 20)).toContain('20 см')
    expect(ru.notFit).toBe('Не хватает места на стене')
  })

  it('T02: крестик карточки — «Закрыть», не «Свернуть» полного экрана', () => {
    expect([ru.close, ky.close]).toEqual(['Закрыть', 'Жабуу'])
    expect(ru.close).not.toBe(ru.fullOff)
  })

  it('T03: повтор действия — «Повторить», ky не похоже на «Назад»', () => {
    expect(ru.redo).toBe('Повторить')
    expect([ky.undo, ky.redo]).toEqual(['Жокко чыгаруу', 'Кайталоо'])
  })

  it('T04, T07: понятные подписи вида и подъёмной дверцы', () => {
    expect([ru.view.eye, ky.view.eye]).toEqual(['С высоты глаз', 'Көз деңгээлинен'])
    expect([ru.upperFronts.lift, ru.overFridgeFronts.lift]).toEqual(['Подъёмная', 'Подъёмная'])
    expect([ky.upperFronts.lift, ky.overFridgeFronts.lift]).toEqual(['Өйдө ачылат', 'Өйдө ачылат'])
  })

  it('T05, T06: размер «примерный», пустой слот не обещает типовую модель', () => {
    expect(ru.typicalSize).toMatch(/примерн/)
    expect(ky.typicalSize).toMatch(/болжолдуу/)
    // пустой слот: «Сейчас нет в наличии» + «Спросить о поставке» (история 42)
    expect([ru.noStock, ru.askSupply]).toEqual(['Сейчас нет в наличии', 'Спросить о поставке'])
    expect(`${ky.noStock} ${ky.askSupply}`).not.toMatch(/типтүү/)
  })

  it('T08: при замечаниях счёт не звучит как похвала', () => {
    expect(ru.checkScore(6, 6)).toMatch(/Хорошо/)
    expect(ru.checkScore(4, 6)).not.toMatch(/хорошо/i)
    expect(ru.checkScore(4, 6)).toMatch(/поправить: 2/)
    expect(ky.checkScore(4, 6)).not.toMatch(/жакшы/i)
  })

  it('T09, T10: без несуществующего сравнения и без «телефона» на компьютере', () => {
    expect(ru.variantsLead).not.toMatch(/сравн/)
    expect(ky.variantsLead).not.toMatch(/салыштыр/)
    for (const s of [ru.lost3d, ru.fail3dStart, ky.lost3d, ky.fail3dStart]) expect(s).not.toMatch(/телефон/i)
  })

  it('T11, T12, T14: кыргызские формы', () => {
    expect(ky.fail3dInApp).toMatch(/^Тиркеменин ичиндеги браузерде/)
    expect(ky.moveHint2).toMatch(/^5 см-ден /)
    expect(ky.colDims).toBe('Туурасы × бийиктиги × тереңдиги, см')
  })

  it('T15: подпись плитки на фартуке переведена', () => {
    expect(SPLASH_GROUPS.find((g) => g.id === 'tile')?.noteKy).toBe('Кабанчик плитка, зеллиж, кыш')
  })

  it('T18, U17: одно действие «Сохранить фото» — одно название, второй кнопки нет', () => {
    expect(ru.photoSave).toBe('Сохранить фото')
    expect(ky.photoSave).toBe('Сүрөттү сактоо')
    expect('saveImage' in ru).toBe(false)
    expect('saveImage' in ky).toBe(false)
  })

  it('R13i: фото не пошло — подсказка называет ту кнопку «Сохранить фото», что есть на экране', () => {
    expect(ru.photoFailed).toContain('«Сохранить фото»')
    expect(ky.photoFailed).toContain('«Сүрөттү сактоо»')
    expect(ru.photoFailed).not.toMatch(/ниже/)
    expect(ky.photoFailed).not.toMatch(/Төмөндө/)
  })
})
