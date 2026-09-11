/**
 * Единый достоверный список источников фотографий витрины.
 * Используется страницей /sources; дублируется в ASSET_SOURCES.md.
 *
 * Все снимки — Pexels License (https://www.pexels.com/license/):
 * свободное использование, атрибуция не требуется, но приводится
 * добровольно в знак уважения к авторам.
 *
 * Проверка: 11.09.2026 каждая страница фото открыта напрямую,
 * подпись «Photo by … on Pexels» и статус «Free to use» подтверждены
 * (см. поле verify). Локальные копии сжаты sharp (JPEG q82,
 * ширина ≤1200px) без изменения содержания.
 */
export type PhotoSource = {
  /** локальный файл в public/photos */
  file: string
  /** автор с страницы Pexels */
  author: string
  /** ID фото на Pexels */
  pexelsId: number
  /** страница источника */
  page: string
  /** роль на витрине RU/KY */
  roleRu: string
  roleKy: string
  /** как подтверждён автор */
  verify: 'page' | 'page+mirrors'
}

export const PEXELS_LICENSE = 'https://www.pexels.com/license/'

export const photoSources: PhotoSource[] = [
  {
    file: 'hero.jpg',
    author: 'Vova Kras',
    pexelsId: 12123389,
    page: 'https://www.pexels.com/photo/12123389/',
    roleRu: 'Изображение hero-баннера на главной (декоративное)',
    roleKy: 'Башкы беттеги hero-баннер сүрөтү (декоративдүү)',
    verify: 'page',
  },
  {
    file: 'phone-dark.jpg',
    author: 'Zaidan Falaah',
    pexelsId: 11934173,
    page: 'https://www.pexels.com/photo/smartphone-with-black-screen-on-blue-background-11934173/',
    roleRu: 'Карточки смартфонов (Aura X5, Vega Pro) — категорийное фото',
    roleKy: 'Смартфон карточкалары (Aura X5, Vega Pro) — категория сүрөтү',
    verify: 'page',
  },
  {
    file: 'phone-light.jpg',
    author: 'Sarah Dorweiler',
    pexelsId: 8408537,
    page: 'https://www.pexels.com/photo/smartphone-on-a-white-surface-8408537/',
    roleRu: 'Карточка смартфона (Nova Lite) — категорийное фото',
    roleKy: 'Смартфон карточкасы (Nova Lite) — категория сүрөтү',
    verify: 'page',
  },
  {
    file: 'laptop.jpg',
    author: 'Artem Podrez',
    pexelsId: 4884117,
    page: 'https://www.pexels.com/photo/photo-of-a-laptop-4884117/',
    roleRu: 'Карточка ноутбука (AirBook 14) — категорийное фото',
    roleKy: 'Ноутбук карточкасы (AirBook 14) — категория сүрөтү',
    verify: 'page',
  },
  {
    file: 'laptop2.jpg',
    author: 'Hanna Pad',
    pexelsId: 8533587,
    page: 'https://www.pexels.com/photo/8533587/',
    roleRu: 'Карточка ноутбука (ProWork 15) — категорийное фото',
    roleKy: 'Ноутбук карточкасы (ProWork 15) — категория сүрөтү',
    verify: 'page',
  },
  {
    file: 'tv-living.jpg',
    author: 'Max Vakhtbovycn',
    pexelsId: 6980724,
    page: 'https://www.pexels.com/photo/television-against-sofa-in-modern-living-room-6980724/',
    roleRu: 'Карточки телевизоров (SmartView 43″/55″) — категорийное фото',
    roleKy: 'Телевизор карточкалары (SmartView 43″/55″) — категория сүрөтү',
    verify: 'page',
  },
  {
    file: 'washer.jpg',
    author: 'Lisa Anna',
    pexelsId: 19846397,
    page: 'https://www.pexels.com/photo/interior-of-a-modern-laundry-room-19846397/',
    roleRu: 'Карточка стиральной машины (CleanPure 6) — категорийное фото',
    roleKy: 'Кир жуугуч машина карточкасы (CleanPure 6) — категория сүрөтү',
    verify: 'page',
  },
  {
    file: 'coffee.jpg',
    author: 'Valentin Ivantsov',
    pexelsId: 38317221,
    page: 'https://www.pexels.com/photo/38317221/',
    roleRu: 'Карточка кофемашины (BaristaHome) — категорийное фото',
    roleKy: 'Кофе машинасы карточкасы (BaristaHome) — категория сүрөтү',
    verify: 'page',
  },
  {
    file: 'robot-vacuum.jpg',
    author: 'Kindel Media',
    pexelsId: 8566426,
    page: 'https://www.pexels.com/photo/robot-vacuum-cleaner-on-wooden-flooring-8566426/',
    roleRu: 'Карточка робота-пылесоса (CycloneClean) — категорийное фото',
    roleKy: 'Робот чаңсоргуч карточкасы (CycloneClean) — категория сүрөтү',
    verify: 'page',
  },
  {
    file: 'tablet.jpg',
    author: 'Josh Sorenson',
    pexelsId: 1334599,
    page: 'https://www.pexels.com/photo/1334599/',
    roleRu: 'Карточка планшета (TabSlate 10) — категорийное фото',
    roleKy: 'Планшет карточкасы (TabSlate 10) — категория сүрөтү',
    verify: 'page',
  },
  {
    file: 'headphones.jpg',
    author: 'Aleksandar Spasojevic',
    pexelsId: 210927,
    page: 'https://www.pexels.com/photo/210927/',
    roleRu: 'Карточка наушников (AirSound Pro) — категорийное фото',
    roleKy: 'Кулакчын карточкасы (AirSound Pro) — категория сүрөтү',
    verify: 'page',
  },
  {
    file: 'smartwatch.jpg',
    author: 'Torsten Dettlaff',
    pexelsId: 437037,
    page: 'https://www.pexels.com/photo/black-apple-watch-with-black-sports-band-437037/',
    roleRu: 'Карточка умных часов (TimeFit) — категорийное фото',
    roleKy: 'Акылм саат карточкасы (TimeFit) — категория сүрөтү',
    verify: 'page',
  },
  {
    file: 'speaker.jpg',
    author: 'Tom Swinnen',
    pexelsId: 1034653,
    page: 'https://www.pexels.com/photo/photo-of-white-portable-bluetooth-speaker-1034653/',
    roleRu: 'Карточка колонки (BoomMini) — категорийное фото',
    roleKy: 'Колонка карточкасы (BoomMini) — категория сүрөтү',
    verify: 'page+mirrors',
  },
]
