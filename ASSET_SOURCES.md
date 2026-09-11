# ASSET_SOURCES — источники и права визуальных материалов

Обновлено: 11.09.2026 (**TASK 03A** — сверка с ревью). Канонический машинный
список: `src/data/photo-sources.ts` (используется страницей `/ru|ky/sources`),
копия — `scripts/photo-metadata.json`. Публичная страница атрибуции доступна
из footer: `/ru/sources`, `/ky/sources`.

## Что изменилось в TASK 03A и почему

Ревью нашло противоречия между `photos.ts`, этим файлом и metadata.json
(AbdFams ↔ Zaidan Falaah; hero: Flickr ↔ StockSnap), а страницы Flickr не
открывались извне — то есть лицензии CC BY оставались неподтверждёнными.
Принято решение: **весь набор приведён к одному проверяемому источнику —
Pexels**. Каждая страница фото открыта напрямую, подпись «Photo by … on
Pexels» и статус «Free to use» зафиксированы 11.09.2026. Неподтверждаемые
Flickr/rawpixel-снимки (ноутбук, клавиатура, барабан стиральной машины,
кухня с кофемашинами, наушники timtak, колонка rawpixel) и монохромный
StockSnap-hero заменены проверенными снимками Pexels. Старый
Openverse-сборщик `scripts/fetch-photos.mjs` больше не источник набора
(остаётся как исторический инструмент первого поколения).

## Важная честная оговорка

Это **категорийные/декоративные снимки**, а не фотографии конкретных
продаваемых моделей. Демо-наименования витрины (Aura X5, Vega Pro и т.д.) —
вымышленные заглушки для дизайн-проверки, фото им не соответствует, что
подписано на карточках («Иллюстрация категории») и в галерее. Фотографии не
выдаются за снимок товара, который получит покупатель.

## Файлы витрины (используются сейчас)

Все — Pexels License: <https://www.pexels.com/license/> (свободное
использование, атрибуция не требуется — приводится добровольно).

| Файл | Фото Pexels | Автор | Где используется | Проверка |
|---|---|---|---|---|
| `hero.jpg` | [#12123389](https://www.pexels.com/photo/12123389/) | Vova Kras | Hero-баннер главной (смартфон на сине-лаймовом градиенте) | страница |
| `phone-dark.jpg` | [#11934173](https://www.pexels.com/photo/smartphone-with-black-screen-on-blue-background-11934173/) | Zaidan Falaah | Карточки смартфонов (Aura X5, Vega Pro) | страница |
| `phone-light.jpg` | [#8408537](https://www.pexels.com/photo/smartphone-on-a-white-surface-8408537/) | Sarah Dorweiler | Карточка смартфона (Nova Lite) | страница |
| `laptop.jpg` | [#4884117](https://www.pexels.com/photo/photo-of-a-laptop-4884117/) | Artem Podrez | Карточка ноутбука (AirBook 14) | страница |
| `laptop2.jpg` | [#8533587](https://www.pexels.com/photo/8533587/) | Hanna Pad | Карточка ноутбука (ProWork 15) | страница |
| `tv-living.jpg` | [#6980724](https://www.pexels.com/photo/television-against-sofa-in-modern-living-room-6980724/) | Max Vakhtbovycn | Карточки телевизоров (SmartView 43″/55″) | страница |
| `washer.jpg` | [#19846397](https://www.pexels.com/photo/interior-of-a-modern-laundry-room-19846397/) | Lisa Anna | Карточка стиральной машины (CleanPure 6) | страница |
| `coffee.jpg` | [#38317221](https://www.pexels.com/photo/38317221/) | Valentin Ivantsov | Карточка кофемашины (BaristaHome) | страница |
| `robot-vacuum.jpg` | [#8566426](https://www.pexels.com/photo/robot-vacuum-cleaner-on-wooden-flooring-8566426/) | Kindel Media | Карточка робота-пылесоса (CycloneClean) | страница |
| `tablet.jpg` | [#1334599](https://www.pexels.com/photo/1334599/) | Josh Sorenson | Карточка планшета (TabSlate 10) | страница |
| `headphones.jpg` | [#210927](https://www.pexels.com/photo/210927/) | Aleksandar Spasojevic | Карточка наушников (AirSound Pro) | страница |
| `smartwatch.jpg` | [#437037](https://www.pexels.com/photo/black-apple-watch-with-black-sports-band-437037/) | Torsten Dettlaff | Карточка умных часов (TimeFit) | страница |
| `speaker.jpg` | [#1034653](https://www.pexels.com/photo/photo-of-white-portable-bluetooth-speaker-1034653/) | Tom Swinnen | Карточка колонки (BoomMini) | страница + зеркала* |

\* Страница #1034653 при автоматическом открытии отдавала бот-защиту;
автор Tom Swinnen подтверждён выдачей поиска Pexels и зеркалом
[Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Audio-blur-close-up-1034653.jpg).
На странице `/sources` это помечено отдельно.

Изменения изображений: только ресайз/сжатие (sharp, JPEG q82, ширина
≤1200 px) — без ретуши, перекраски и склейки.

## Плейсхолдеры (ProductArt SVG)

- `src/components/ProductArt.tsx` — оригинальные схематичные SVG проекта:
  помеченный демо-плейсхолдер там, где фото ещё нет (аэрогриль), и иконки
  категорий. Лицензия — собственная графика проекта.

## Запрос магазину: фото для будущего каталога 1С

Когда каталог товаров появится в 1С, для дизайн-проверки и запуска нужны
фотографии **реальных моделей/артикулов из этого будущего каталога 1С**
(согласованные с поставщиками/производителями права) — по каждому товару:

1. Прямой товарный снимок на светлом фоне: фронт + ракурс 3/4, без чужих
   логотипов на упаковке, читаемые артикулы из 1С.
2. Для вариантов (цвет/память) — снимок каждого варианта; фото должно
   соответствовать выбранной модификации.
3. Телевизоры — фронтальный снимок включённого и выключенного экрана.
4. Крупная бытовая техника — снимок целиком, не крупный план детали.
5. Одинаковый масштаб/фон для всей карточной сетки.

Просить фотографии вымышленных Aura/Vega/AeroChef как «реальных товаров»
нельзя — эти имена только демо-заглушки и исчезнут вместе с 1С-каталогом.

## Технические заметки

- Хранение: локальные файлы в `public/photos` (внешнего CDN на рантайме нет).
- Выдача: `next/image` — responsive resize, WebP/AVIF по Accept, `sizes`
  на каждом месте использования, lazy-load ниже первого экрана, `priority`
  только для hero и первых карточек.
- Актуальный набор собран вручную из проверенных страниц Pexels
  (CDN `images.pexels.com`) и сжат sharp; `scripts/fetch-photos.mjs`
  (Openverse) — исторический, набор им не воспроизводится.
