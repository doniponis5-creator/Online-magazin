# ASSET_SOURCES — источники и права визуальных материалов

Обновлено: 11.09.2026 (TASK 03). Все фотографии скачаны локально в `public/photos/`
и используются в витрине. Лицензии проверены: только свободные — Pexels License,
CC0 / Public Domain, CC BY 2.0 (атрибуция приведена ниже и дублируется в
`scripts/photo-metadata.json`, лог сборщика — `scripts/fetch-photos.mjs`).

## Важная честная оговорка

Это **категорийные/декоративные снимки**, а не фотографии конкретных продаваемых
моделей: демо-модели витрины (Aura, Nova, Vega…) намеренно обобщённые, с демо-ценами.
Фотографии не выдаются за снимок товара, который получит покупатель.
Реальные фото моделей магазин предоставит после согласования прав с
производителями/поставщиками (ARCHITECTURE_UZ.md, §12).

## Файлы витрины (используются сейчас)

| Файл | Источник (страница) | Автор | Лицензия | Роль на витрине |
|---|---|---|---|---|
| `hero.jpg` | [stocksnap.io/photo/top-workspace-ILQA1VXXOJ](https://stocksnap.io/photo/top-workspace-ILQA1VXXOJ) | Top Down Tech | CC0 1.0 | Большое изображение hero-баннера |
| `phone-dark.jpg` | [pexels.com/photo/…-11934173](https://www.pexels.com/photo/smartphone-with-black-screen-on-blue-background-11934173/) | Zaidan Falaah (Pexels) | Pexels License | Карточки смартфонов Aura X5, Vega Pro |
| `phone-light.jpg` | [pexels.com/photo/…-8408537](https://www.pexels.com/photo/smartphone-on-a-white-surface-8408537/) | Pexels contributor | Pexels License | Карточка смартфона Nova Lite |
| `laptop.jpg` | [flickr.com/photos/38305415@N00/6798184016](https://www.flickr.com/photos/38305415@N00/6798184016) | Johan Larsson | CC BY 2.0 | Карточка ноутбука AirBook 14 |
| `laptop2.jpg` | [flickr.com/photos/51117149@N08/4798822966](https://www.flickr.com/photos/51117149@N08/4798822966) | Lena LeRay | CC BY 2.0 | Карточка ноутбука ProWork 15 (клавиатура) |
| `tv-living.jpg` | [pexels.com/photo/…-6980724](https://www.pexels.com/photo/television-against-sofa-in-modern-living-room-6980724/) | Pexels contributor | Pexels License | Карточки телевизоров SmartView 43″/55″ |
| `washer.jpg` | [flickr.com/photos/155403590@N07/47090184431](https://www.flickr.com/photos/155403590@N07/47090184431) | dejankrsmanovic | CC BY 2.0 | Карточка стиральной машины CleanPure 6 |
| `coffee.jpg` | [flickr.com/photos/202846129@N03/54562327158](https://www.flickr.com/photos/202846129@N03/54562327158) | nenadstojkovicart | CC BY 2.0 | Карточка кофемашины BaristaHome |
| `robot-vacuum.jpg` | [pexels.com/photo/…-8566426](https://www.pexels.com/photo/robot-vacuum-cleaner-on-wooden-flooring-8566426/) | Kindel Media (Pexels) | Pexels License | Карточка робота-пылесоса CycloneClean |
| `tablet.jpg` | [pexels.com/photo/black-samsung-tablet-computer-106344](https://www.pexels.com/photo/black-samsung-tablet-computer-106344/) | Pixabay (Pexels) | Pexels License | Карточка планшета TabSlate 10 |
| `headphones.jpg` | [flickr.com/photos/64015205@N00/46329607](https://www.flickr.com/photos/64015205@N00/46329607) | timtak | CC BY 2.0 | Карточка наушников AirSound Pro |
| `smartwatch.jpg` | [pexels.com/photo/…-437037](https://www.pexels.com/photo/black-apple-watch-with-black-sports-band-437037/) | Mateusz Dach (Pexels) | Pexels License | Карточка умных часов TimeFit |
| `speaker.jpg` | [rawpixel.com/image/5975218](https://www.rawpixel.com/image/5975218/closeup-black-bluetooth-speaker) | автор не указан (rawpixel) | CC0 1.0 | Карточка колонки BoomMini |

Для CC BY 2.0 указание автора (таблица выше) — требуемая атрибуция;
в продакшене она будет вынесена на страницу «Правообладатели».

## Плейсхолдеры (ProductArt SVG)

- `src/components/ProductArt.tsx` — оригинальные схематичные SVG, нарисованные
  для проекта; используются как помеченный демо-плейсхолдер там, где фото пока нет
  (аэрогриль AeroChef) и как иконки категорий. Лицензия — собственная графика проекта.

## Чего не хватает (запрос магазину — конкретный список)

1. **Смартфоны (3 модели):** прямые product-shot каждого цвета на светлом фоне
   (фронт + ракурс 3/4), без логотипов чужих брендов — для Aura X5 / Nova Lite / Vega Pro.
2. **Телевизоры (2 диагонали):** фронтальный снимок включённого и выключенного экрана.
3. **Аэрогриль AeroChef 5 л:** товарный снимок на белом фоне (сейчас — SVG-плейсхолдер).
4. **Ноутбуки (2 модели):** раскрытый ноутбук фронтально, экран чистый.
5. **Стиральная машина:** фронтальный снимок целиком (сейчас — крупный план барабана).
6. **Кофемашина:** отдельно стоящая машина на светлом фоне (сейчас — кухня с рядом машин).
7. **Смарт-часы / колонка / планшет:** нейтральные product-shot без брендовых элементов.

## Технические заметки

- Хранение: локальные файлы в `public/photos` (без внешнего CDN на рантайме).
- Выдача: `next/image` — автоматический responsive resize, WebP/AVIF по Accept,
  `sizes` задан на каждом месте использования, lazy-load ниже первого экрана,
  `priority` только для hero и первых карточек.
- Пересборка набора: `node scripts/fetch-photos.mjs --force` (Openverse API);
  Pexels-файлы скачаны вручную по прямым ссылкам из этого отчёта.
