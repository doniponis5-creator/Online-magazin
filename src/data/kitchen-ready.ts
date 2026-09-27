/**
 * Готовые кухни — с них покупатель начинает, а не с пустой комнаты.
 *
 * Каждая кухня — строка проекта конструктора (`q`, как в адресе
 * `/ru/kitchen?<q>` и в «Поделиться»), название RU/KY и три кадра 3D из
 * `public/kitchen/ready/`: `<id>.jpg` 1200×750, `<id>-s.jpg` 480×300,
 * `<id>-card.jpg` 1200×630 (карточка для Telegram/Instagram).
 *
 * Как поменять кухню: соберите её в конструкторе, нажмите «Поделиться» и
 * вставьте в `q` всё, что после «?». Картинки заново (снимает 3D живого
 * сайта) — `node scripts/kitchen-ready-shots.mjs <id>`; техника для теста —
 * `node scripts/kitchen-ready-shots.mjs --fixture`. Проверка —
 * `npx vitest run __tests__/kitchen-ready.test.ts`.
 *
 * Техника — модели с живого сайта (полный каталог 1С, в наличии на дату
 * `__tests__/fixtures/kitchen-live-appliances.json`); в старом локальном
 * catalog.json их может не быть — конструктор такие просто пропускает.
 * «dw=-» — посудомойка не нужна (в маленькой кухне ей нет места).
 * Пропавшая из продажи модель выпадает из проекта; цены — всегда текущие.
 */

export type ReadyKitchen = {
  id: string
  q: string
  ru: string
  ky: string
  image: string
  thumb: string
  card: string
}

const shots = (id: string) => ({
  image: `/kitchen/ready/${id}.jpg`,
  thumb: `/kitchen/ready/${id}-s.jpg`,
  card: `/kitchen/ready/${id}-card.jpg`,
})

const kitchen = (id: string, q: string, ru: string, ky: string): ReadyKitchen => ({ id, q, ru, ky, ...shots(id) })

export const READY: ReadyKitchen[] = [
  // прямые
  kitchen(
    'straight-300-scandi',
    'f=straight&a=300&s=scandi&fr=cb-00002233&ov=cb-00002028&hb=cb-00002139&hd=cb-00002138&dw=cb-00002489&fc=ral-9010&tp=tw-oak',
    'Прямая 300 · Сканди, белый и дуб',
    'Түз 300 · Сканди, ак жана эмен',
  ),
  kitchen(
    'straight-320-loft',
    'f=straight&a=320&s=loft&fr=cb-00002230&ov=cb-00002241&hb=cb-00002257&hd=cb-00002152&dw=cb-00002491&fc=dec-kronospan-k353&tp=tw-walnut&sp=sp-brick',
    'Прямая 320 · Лофт, угольный камень',
    'Түз 320 · Лофт, көмүр таш',
  ),
  kitchen(
    'straight-380-hitech',
    'f=straight&a=380&s=hitech&fr=cb-00002319&ov=cb-00002333&hb=cb-00002338&hd=cb-00001547&dw=cb-00002492&mw=cb-00002332&fc=ral-7016',
    'Прямая 380 · Хай-тек, антрацит',
    'Түз 380 · Хай-тек, антрацит',
  ),
  // угловые
  kitchen(
    'corner-240x180-japandi',
    'f=corner&a=240&b=180&s=japandi&fr=cb-00002233&ov=cb-00002147&hb=cb-00002139&hd=cb-00002138&dw=-&fc=dec-egger-h1145-st10',
    'Угловая 240 × 180 · Японди, дуб',
    'Бурчтук 240 × 180 · Японди, эмен',
  ),
  kitchen(
    'corner-300x240-marble',
    'f=corner&a=300&b=240&s=marble&fr=cb-00002129&ov=cb-00002142&hb=cb-00002337&hd=cb-00001547&dw=cb-00002489&fc=dec-egger-u961-st2',
    'Угловая 300 × 240 · Мрамор и графит',
    'Бурчтук 300 × 240 · Мрамор жана графит',
  ),
  kitchen(
    'corner-360x300-english',
    'f=corner&a=360&b=300&s=english&fr=cb-00002319&ov=cb-00002334&hb=cb-00002338&hd=cb-00001547&dw=cb-00002492&mw=cb-00002331&fc=ral-6028&tp=tq-calacatta',
    'Угловая 360 × 300 · Английская, зелёная',
    'Бурчтук 360 × 300 · Англис, жашыл',
  ),
  // П-образные
  kitchen(
    'u-300x240-minimal',
    'f=u&a=300&b=240&c=240&s=minimal&fr=cb-00002320&ov=cb-00001782&hb=cb-00001822&hd=cb-00001444&dw=-&fc=dec-kronospan-k101&tp=tq-grey',
    'П-образная 300 × 240 · Минимализм, белый',
    'П-формалуу 300 × 240 · Минимализм, ак',
  ),
  kitchen(
    'u-360x270-artdeco',
    'f=u&a=360&b=270&c=270&s=artdeco&fr=cb-00001639&ov=cb-00002241&hb=cb-00002257&hd=cb-00002240&dw=cb-00002491&fc=ral-5011',
    'П-образная 360 × 270 · Арт-деко, синий',
    'П-формалуу 360 × 270 · Арт-деко, көк',
  ),
  kitchen(
    'u-420x300-classic',
    'f=u&a=420&b=300&c=300&s=classic&fr=cb-00002111&ov=cb-00002333&hb=cb-00002337&hd=cb-00001547&dw=cb-00002492&mw=cb-00002332&fc=ral-9001',
    'П-образная 420 × 300 · Классика, кремовый',
    'П-формалуу 420 × 300 · Классика, каймак түс',
  ),
  // с островом
  kitchen(
    'island-320-modern',
    'f=island&a=320&i=180&s=modern&fr=cb-00002233&ov=cb-00002028&hb=cb-00002139&hd=cb-00002140&dw=cb-00002489&fc=dec-egger-h3303-st10&if=ral-7016',
    'С островом 320 · Модерн, дуб и антрацит',
    'Аралчасы менен 320 · Модерн, эмен жана антрацит',
  ),
  kitchen(
    'island-380-quiet',
    'f=island&a=380&i=200&s=quiet&fr=cb-00001994&ov=cb-00002258&hb=cb-00002338&hd=cb-00002269&dw=cb-00002491&fc=dec-egger-u702-st9&if=dec-egger-h1344-st32',
    'С островом 380 · Тихая роскошь, кашемир',
    'Аралчасы менен 380 · Токтоо люкс, кашемир',
  ),
  kitchen(
    'island-450-gold',
    'f=island&a=450&i=240&s=gold&fr=cb-00000430&ov=cb-00002334&hb=cb-00002338&hd=cb-00001547&dw=cb-00002492&mw=cb-00002331&fc=ral-9003&if=ral-9005',
    'С островом 450 · Золото, белый и чёрный',
    'Аралчасы менен 450 · Алтын, ак жана кара',
  ),
]

export function readyKitchen(id: string): ReadyKitchen | undefined {
  return READY.find((k) => k.id === id)
}
