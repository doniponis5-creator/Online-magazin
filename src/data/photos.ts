/**
 * Фотографии витрины. Все изображения — свободные лицензии (Pexels License,
 * CC0, CC BY 2.0), скачаны локально в public/photos. Полные источники,
 * авторы и ссылки на страницы файлов — в ASSET_SOURCES.md (корень репо).
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
  /** краткая атрибуция для отчёта/подписи */
  credit: string
}

export const heroPhoto: ProductPhoto = {
  src: '/photos/hero.jpg',
  altRu: 'Рабочее место с ноутбуком и смарт-часами (демо)',
  altKy: 'Ноутбук жана смарт сааты бар жумушчу стол (демо)',
  credit: 'Top Down Tech / Openverse (Flickr) / CC0 1.0',
}

export const productPhotos: Record<string, ProductPhoto> = {
  'aura-x5': {
    src: '/photos/phone-dark.jpg',
    altRu: 'Смартфон — демо-изображение категории',
    altKy: 'Смартфон — категориянын демо сүрөтү',
    credit: 'AbdFams / Pexels',
  },
  'nova-lite': {
    src: '/photos/phone-light.jpg',
    altRu: 'Смартфон на полке — демо-изображение категории',
    altKy: 'Сүрөтчөдөгү смартфон — категориянын демо сүрөтү',
    credit: 'Vraj Shah / Pexels',
  },
  'vega-pro': {
    src: '/photos/phone-dark.jpg',
    altRu: 'Смартфон — демо-изображение категории',
    altKy: 'Смартфон — категориянын демо сүрөтү',
    credit: 'AbdFams / Pexels',
  },
  'airbook-14': {
    src: '/photos/laptop.jpg',
    altRu: 'Ноутбук — демо-изображение категории',
    altKy: 'Ноутбук — категориянын демо сүрөтү',
    credit: 'Johan Larsson / Openverse (Flickr) / CC BY 2.0',
  },
  'prowork-15': {
    src: '/photos/laptop2.jpg',
    altRu: 'Клавиатура ноутбука — демо-изображение категории',
    altKy: 'Ноутбук клавиатурасы — категориянын демо сүрөтү',
    credit: 'Lena LeRay / Openverse (Flickr) / CC BY 2.0',
  },
  'smartview-43': {
    src: '/photos/tv-living.jpg',
    altRu: 'Телевизор в гостиной — демо-изображение категории',
    altKy: 'Конуштагы телевизор — категориянын демо сүрөтү',
    credit: 'Vecislavas Popa / Pexels',
  },
  'smartview-55': {
    src: '/photos/tv-living.jpg',
    altRu: 'Телевизор в гостиной — демо-изображение категории',
    altKy: 'Конуштагы телевизор — категориянын демо сүрөтү',
    credit: 'Vecislavas Popa / Pexels',
  },
  'cleanpure-6': {
    src: '/photos/washer.jpg',
    altRu: 'Стиральная машина — демо-изображение категории',
    altKy: 'Кийим жуугуч машина — категориянын демо сүрөтү',
    credit: 'dejankrsmanovic / Openverse (Flickr) / CC BY 2.0',
  },
  'barista-home': {
    src: '/photos/coffee.jpg',
    altRu: 'Кофемашина на кухне — демо-изображение категории',
    altKy: 'Ашканадагы кофе машинасы — категориянын демо сүрөтү',
    credit: 'nenadstojkovicart / Openverse (Flickr) / CC BY 2.0',
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
    credit: 'pixabay / Pexels',
  },
  'airsound-pro': {
    src: '/photos/headphones.jpg',
    altRu: 'Наушники — демо-изображение категории',
    altKy: 'Кулакчын — категориянын демо сүрөтү',
    credit: 'timtak / Openverse (Flickr) / CC BY 2.0',
  },
  timefit: {
    src: '/photos/smartwatch.jpg',
    altRu: 'Смарт-часы — демо-изображение категории',
    altKy: 'Акылм саат — категориянын демо сүрөтү',
    credit: 'Mateusz Dach / Pexels',
  },
  boommini: {
    src: '/photos/speaker.jpg',
    altRu: 'Портативная колонка — демо-изображение категории',
    altKy: 'Портативтик колонка — категориянын демо сүрөтү',
    credit: 'Openverse (Flickr) / CC0 1.0',
  },
}

/** Тип арта для категории (плейсхолдер, когда фото нет) */
export type { ArtKind }
