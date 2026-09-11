/**
 * Фотографии витрины. Все изображения — Pexels License, скачаны локально
 * в public/photos. Полные источники (автор, страница, лицензия) — в
 * src/data/photo-sources.ts, ASSET_SOURCES.md и на странице /sources.
 *
 * ВАЖНО (честность): это категорийные/декоративные снимки, а не фотографии
 * конкретных продаваемых моделей — демо-модели намеренно обобщённые.
 * Реальные фото моделей магазин предоставит после согласования прав.
 */
import type { ArtKind } from './products'

export type ProductPhoto = {
  src: string
  altRu: string
  altKy: string
  /** краткая атрибуция; полная — в photo-sources.ts и /sources */
  credit: string
}

export const heroPhoto: ProductPhoto = {
  src: '/photos/hero.jpg',
  altRu: 'Смартфон на сине-лаймовом градиенте (демо)',
  altKy: 'Көк-лайм градиентиндеги смартфон (демо)',
  credit: 'Vova Kras / Pexels',
}

export const productPhotos: Record<string, ProductPhoto> = {
  'aura-x5': {
    src: '/photos/phone-dark.jpg',
    altRu: 'Смартфон — демо-изображение категории',
    altKy: 'Смартфон — категориянын демо сүрөтү',
    credit: 'Zaidan Falaah / Pexels',
  },
  'nova-lite': {
    src: '/photos/phone-light.jpg',
    altRu: 'Смартфон на полке — демо-изображение категории',
    altKy: 'Сүрөтчөдөгү смартфон — категориянын демо сүрөтү',
    credit: 'Sarah Dorweiler / Pexels',
  },
  'vega-pro': {
    src: '/photos/phone-dark.jpg',
    altRu: 'Смартфон — демо-изображение категории',
    altKy: 'Смартфон — категориянын демо сүрөтү',
    credit: 'Zaidan Falaah / Pexels',
  },
  'airbook-14': {
    src: '/photos/laptop.jpg',
    altRu: 'Ноутбук с чистым экраном — демо-изображение категории',
    altKy: 'Таза экрандуу ноутбук — категориянын демо сүрөтү',
    credit: 'Artem Podrez / Pexels',
  },
  'prowork-15': {
    src: '/photos/laptop2.jpg',
    altRu: 'Ноутбук — демо-изображение категории',
    altKy: 'Ноутбук — категориянын демо сүрөтү',
    credit: 'Hanna Pad / Pexels',
  },
  'smartview-43': {
    src: '/photos/tv-living.jpg',
    altRu: 'Телевизор в гостиной — демо-изображение категории',
    altKy: 'Конуштагы телевизор — категориянын демо сүрөтү',
    credit: 'Max Vakhtbovycn / Pexels',
  },
  'smartview-55': {
    src: '/photos/tv-living.jpg',
    altRu: 'Телевизор в гостиной — демо-изображение категории',
    altKy: 'Конуштагы телевизор — категориянын демо сүрөтү',
    credit: 'Max Vakhtbovycn / Pexels',
  },
  'cleanpure-6': {
    src: '/photos/washer.jpg',
    altRu: 'Стиральная машина в светлой прачечной — демо-изображение категории',
    altKy: 'Жарык кир жуугуч бөлмөсүндөгү кир жуугуч машина — категориянын демо сүрөтү',
    credit: 'Lisa Anna / Pexels',
  },
  'barista-home': {
    src: '/photos/coffee.jpg',
    altRu: 'Кофемашина — демо-изображение категории',
    altKy: 'Кофе машинасы — категориянын демо сүрөтү',
    credit: 'Valentin Ivantsov / Pexels',
  },
  'cyclone-robot': {
    src: '/photos/robot-vacuum.jpg',
    altRu: 'Робот-пылесос на полу — демо-изображение категории',
    altKy: 'Полдогу робот чаңсоргуч — категориянын демо сүрөтү',
    credit: 'Kindel Media / Pexels',
  },
  'tabslate-10': {
    src: '/photos/tablet.jpg',
    altRu: 'Планшет — демо-изображение категории',
    altKy: 'Планшет — категориянын демо сүрөтү',
    credit: 'Josh Sorenson / Pexels',
  },
  'airsound-pro': {
    src: '/photos/headphones.jpg',
    altRu: 'Наушники — демо-изображение категории',
    altKy: 'Кулакчын — категориянын демо сүрөтү',
    credit: 'Aleksandar Spasojevic / Pexels',
  },
  timefit: {
    src: '/photos/smartwatch.jpg',
    altRu: 'Смарт-часы — демо-изображение категории',
    altKy: 'Акылм саат — категориянын демо сүрөтү',
    credit: 'Torsten Dettlaff / Pexels',
  },
  boommini: {
    src: '/photos/speaker.jpg',
    altRu: 'Портативная колонка — демо-изображение категории',
    altKy: 'Портативтик колонка — категориянын демо сүрөтү',
    credit: 'Tom Swinnen / Pexels',
  },
}

/** Тип арта для категории (плейсхолдер, когда фото нет) */
export type { ArtKind }
