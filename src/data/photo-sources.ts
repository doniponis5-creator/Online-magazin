/**
 * Единый достоверный список источников изображений.
 * Используется страницей /sources; дублируется в ASSET_SOURCES.md
 * и scripts/photo-metadata.json.
 *
 * Решение владельца 12.09 (brief LG F4X5ES5SB): активных фотографий в
 * витрине нет — hero построен как авторская CSS-сцена, товарные места
 * занимает единый плейсхолдер «Фото скоро появится». Все прежние снимки
 * (включая баннерные) — архив (inUse: false): файлы сохранены как
 * исходные материалы до появления реального каталога фотографий владельца.
 *
 * Все позиции — Pexels License (https://www.pexels.com/license/).
 * Проверка: 11.09.2026 каждая страница фото открыта напрямую, подпись
 * «Photo by … on Pexels» и статус «Free to use» зафиксированы (см. verify).
 */
export type PhotoSource = {
  /** локальный файл (active: src/assets, архив: public/photos) */
  file: string
  /** автор со страницы Pexels */
  author: string
  /** ID фото на Pexels */
  pexelsId: number
  /** страница источника */
  page: string
  /** роль RU/KY */
  roleRu: string
  roleKy: string
  /** как подтверждён автор */
  verify: 'page' | 'page+mirrors'
  /** показывается ли файл в витрине сейчас */
  inUse: boolean
}

export const PEXELS_LICENSE = 'https://www.pexels.com/license/'

export const photoSources: PhotoSource[] = [
  {
    file: 'src/assets/hero-blue-lime.jpg',
    author: 'Vova Kras',
    pexelsId: 12123389,
    page: 'https://www.pexels.com/photo/12123389/',
    roleRu:
      'Архив: декоративный баннер hero до сцены LG F4X5ES5SB (сцена теперь — авторский CSS)',
    roleKy: 'Архив: LG F4X5ES5SB сахнасына чейинки hero баннери (азыр сцена — автордук CSS)',
    verify: 'page',
    inUse: false,
  },
  {
    file: 'public/photos/hero.jpg',
    author: 'Vova Kras',
    pexelsId: 12123389,
    page: 'https://www.pexels.com/photo/12123389/',
    roleRu: 'Архив: прежний hero до перехода на статический импорт (тот же снимок)',
    roleKy: 'Архив: статикалык импортко чейинки эски hero (ошол эле сүрөт)',
    verify: 'page',
    inUse: false,
  },
  {
    file: 'public/photos/phone-dark.jpg',
    author: 'Zaidan Falaah',
    pexelsId: 11934173,
    page: 'https://www.pexels.com/photo/smartphone-with-black-screen-on-blue-background-11934173/',
    roleRu: 'Архив: категорийное фото смартфонов (Aura X5, Vega Pro)',
    roleKy: 'Архив: смартфондордуң категория сүрөтү (Aura X5, Vega Pro)',
    verify: 'page',
    inUse: false,
  },
  {
    file: 'public/photos/phone-light.jpg',
    author: 'Sarah Dorweiler',
    pexelsId: 8408537,
    page: 'https://www.pexels.com/photo/smartphone-on-a-white-surface-8408537/',
    roleRu: 'Архив: категорийное фото смартфона (Nova Lite)',
    roleKy: 'Архив: смартфондун категория сүрөтү (Nova Lite)',
    verify: 'page',
    inUse: false,
  },
  {
    file: 'public/photos/laptop.jpg',
    author: 'Artem Podrez',
    pexelsId: 4884117,
    page: 'https://www.pexels.com/photo/photo-of-a-laptop-4884117/',
    roleRu: 'Архив: категорийное фото ноутбука (AirBook 14)',
    roleKy: 'Архив: ноутбукдун категория сүрөтү (AirBook 14)',
    verify: 'page',
    inUse: false,
  },
  {
    file: 'public/photos/laptop2.jpg',
    author: 'Hanna Pad',
    pexelsId: 8533587,
    page: 'https://www.pexels.com/photo/8533587/',
    roleRu: 'Архив: категорийное фото ноутбука (ProWork 15)',
    roleKy: 'Архив: ноутбукдун категория сүрөтү (ProWork 15)',
    verify: 'page',
    inUse: false,
  },
  {
    file: 'public/photos/tv-living.jpg',
    author: 'Max Vakhtbovycn',
    pexelsId: 6980724,
    page: 'https://www.pexels.com/photo/television-against-sofa-in-modern-living-room-6980724/',
    roleRu: 'Архив: категорийное фото телевизоров (SmartView 43″/55″)',
    roleKy: 'Архив: телевизорлордуң категория сүрөтү (SmartView 43″/55″)',
    verify: 'page',
    inUse: false,
  },
  {
    file: 'public/photos/washer.jpg',
    author: 'Lisa Anna',
    pexelsId: 19846397,
    page: 'https://www.pexels.com/photo/interior-of-a-modern-laundry-room-19846397/',
    roleRu: 'Архив: категорийное фото стиральной машины (CleanPure 6)',
    roleKy: 'Архив: кир жуугуч машинанын категория сүрөтү (CleanPure 6)',
    verify: 'page',
    inUse: false,
  },
  {
    file: 'public/photos/coffee.jpg',
    author: 'Valentin Ivantsov',
    pexelsId: 38317221,
    page: 'https://www.pexels.com/photo/38317221/',
    roleRu: 'Архив: категорийное фото кофемашины (BaristaHome)',
    roleKy: 'Архив: кофе машинанын категория сүрөтү (BaristaHome)',
    verify: 'page',
    inUse: false,
  },
  {
    file: 'public/photos/robot-vacuum.jpg',
    author: 'Kindel Media',
    pexelsId: 8566426,
    page: 'https://www.pexels.com/photo/robot-vacuum-cleaner-on-wooden-flooring-8566426/',
    roleRu: 'Архив: категорийное фото робота-пылесоса (CycloneClean)',
    roleKy: 'Архив: робот чаңсоргучтун категория сүрөтү (CycloneClean)',
    verify: 'page',
    inUse: false,
  },
  {
    file: 'public/photos/tablet.jpg',
    author: 'Josh Sorenson',
    pexelsId: 1334599,
    page: 'https://www.pexels.com/photo/1334599/',
    roleRu:
      'Архив: файл использовался как «фото планшета», но на снимке смарт-часы; снят с витрины',
    roleKy:
      'Архив: файл «планшет сүрөтү» катары колдонулган, бирок сүрөттө акылм саат; витринадан алынды',
    verify: 'page',
    inUse: false,
  },
  {
    file: 'public/photos/headphones.jpg',
    author: 'Aleksandar Spasojevic',
    pexelsId: 210927,
    page: 'https://www.pexels.com/photo/210927/',
    roleRu: 'Архив: категорийное фото наушников (AirSound Pro)',
    roleKy: 'Архив: кулакчындын категория сүрөтү (AirSound Pro)',
    verify: 'page',
    inUse: false,
  },
  {
    file: 'public/photos/smartwatch.jpg',
    author: 'Torsten Dettlaff',
    pexelsId: 437037,
    page: 'https://www.pexels.com/photo/black-apple-watch-with-black-sports-band-437037/',
    roleRu: 'Архив: категорийное фото умных часов (TimeFit)',
    roleKy: 'Архив: акылм сааттын категория сүрөтү (TimeFit)',
    verify: 'page',
    inUse: false,
  },
  {
    file: 'public/photos/speaker.jpg',
    author: 'Tom Swinnen',
    pexelsId: 1034653,
    page: 'https://www.pexels.com/photo/photo-of-white-portable-bluetooth-speaker-1034653/',
    roleRu: 'Архив: категорийное фото колонки (BoomMini)',
    roleKy: 'Архив: колонканын категория сүрөтү (BoomMini)',
    verify: 'page+mirrors',
    inUse: false,
  },
]
