import type { Product } from './products'

/**
 * «Лучшая цена» (владелец 09.10, перед рекламой): известные модели, у которых мы дешевле магазинов Бишкека.
 * Покупатель сравнит — и запомнит магазин как самый дешёвый.
 *
 * `beat` — самая низкая цена этой же модели в другом магазине на дату проверки (Sulpak, Imperia, Onbir, Enter,
 * Technopolis, O!Market; kupi.kg не считаем — это цена закупки владельца, lalafo — не считаем, там б/у).
 * Метка горит, только пока наша цена из 1С НЕ ВЫШЕ `beat`: подняли цену или ещё не снизили — метки нет,
 * сайт не обещает неправды. Конкурентов на сайте не называем (владелец 09.10).
 *
 * Обновлять раз в неделю: цены конкурентов меняются. Порядок списка — порядок на главной.
 */
export const BEST_PRICE_CHECKED = '2026-10-09'

export const BEST_PRICE: { id: string; beat: number }[] = [
  { id: 'cb-00002246', beat: 90_590 }, // Телевизор LG 65NANO81A6A
  { id: 'cb-00002376', beat: 48_300 }, // Стиральная MIDEA MF210W105WB/T
  { id: 'cb-00002472', beat: 36_614 }, // Кондиционер CHIGO KFR-09AC-169 (у других — похожие инверторные Chigo)
  { id: 'cb-00002385', beat: 36_972 }, // Стиральная LG F2V3PS6W
  { id: 'cb-00001816', beat: 12_450 }, // Пылесос LG VC73189NHTR — цель 12 290
  { id: 'cb-00002487', beat: 29_400 }, // Плита SHIVAKI 6401E
  { id: 'cb-00002506', beat: 32_130 }, // Стиральная LG F2Y1WS3W
  { id: 'cb-00002500', beat: 10_490 }, // Пылесос LG VC5420NHTCG — цель 10 390
  { id: 'cb-00001447', beat: 40_060 }, // Стиральная LG F2V5PS2S
  { id: 'cb-00001547', beat: 19_400 }, // Вытяжка MIDEA MH60C785X
  { id: 'cb-00001634', beat: 10_000 }, // Пылесос Samsung SC20M2540JN — цель 9 890
  { id: 'cb-00001976', beat: 25_528 }, // Стиральная MIDEA MFO1610US40/T
  { id: 'cb-00002502', beat: 12_732 }, // Пылесос LG VC73189NHTS
  { id: 'cb-00002501', beat: 12_350 }, // Пылесос LG VC73189NHTB — цель 12 290
  { id: 'cb-00002485', beat: 27_620 }, // Стиральная LG F2Y1NS3W
  { id: 'cb-00002505', beat: 11_990 }, // Пылесос LG VK89309H — цель 11 890
  { id: 'cb-00002419', beat: 6_990 }, // Пылесос LG VK69662N — цель 6 990
  { id: '00-00000007', beat: 6_890 }, // Пылесос Samsung SC4520 — цель 6 790
  { id: 'cb-00002445', beat: 15_499 }, // Пылесос PHILIPS FC9351 — цель 15 390
  { id: 'cb-00002503', beat: 14_250 }, // Пылесос LG VK89609HQ — цель 14 190
  { id: 'cb-00002412', beat: 9_750 }, // Пылесос Samsung SC20M257AWR
  { id: 'cb-00000274', beat: 8_850 }, // Пылесос Samsung VC20M253AWR
  { id: 'cb-00001892', beat: 6_490 }, // Микроволновка MIDEA MM720C2MV-S
  { id: 'cb-00002482', beat: 3_800 }, // Блендер MIDEA MJ-BL7001AW
  { id: 'cb-00001963', beat: 2_500 }, // Чайник MIDEA MK-8015
]

const BEAT = new Map(BEST_PRICE.map((x) => [x.id, x.beat]))

/** Метка «Лучшая цена»: модель в списке, цена есть и не выше, чем у других магазинов. */
export function isBestPrice(p: Pick<Product, 'id' | 'price'>): boolean {
  const beat = BEAT.get(p.id)
  return beat !== undefined && p.price > 0 && p.price <= beat
}

const onSale = (p: Product) => Boolean(p.price > 0 && (p.sale || (p.oldPrice && p.oldPrice > p.price)))
const inStock = (p: Product) => p.variants.some((v) => v.stock > 0)

/**
 * Раздел «Лучшая цена»: сначала модели из списка (в его порядке), потом товары со скидкой из 1С.
 * Только то, что можно купить сейчас: без цены и без остатка — не показываем.
 */
export function bestPriceProducts(all: Product[]): Product[] {
  const byId = new Map(all.map((p) => [p.id, p]))
  const best = BEST_PRICE.map((x) => byId.get(x.id)).filter((p): p is Product => Boolean(p && isBestPrice(p) && inStock(p)))
  const taken = new Set(best.map((p) => p.id))
  const sale = all.filter((p) => !taken.has(p.id) && onSale(p) && inStock(p))
  return [...best, ...sale]
}

/** Товар раздела: «Лучшая цена» или скидка — для фильтра каталога ?best=1. */
export function inBestPrice(p: Product): boolean {
  return (isBestPrice(p) || onSale(p)) && inStock(p)
}
