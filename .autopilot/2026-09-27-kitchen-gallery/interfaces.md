# Интерфейсы

## Правила проекта для исполнителей

- Next.js 16 (API изменены — `AGENTS.md`; `RouteContext<'/api/…/[name]'>` у динамических маршрутов), TypeScript strict, vitest. Команды: `npx tsc --noEmit`, `npx vitest run` (один: `npx vitest run __tests__/<имя>.test.ts`), `npm run build`.
- Пакеты не ставь (нет — `BLOCKED`). Не коммить. Без `git stash`/`checkout`/`reset`. Dev-сервер/Chrome — останавливать по своим PID, не `pkill -f next-server`.
- Секреты — только имена переменных (`ASSISTANT_LOG_KEY`, `SHOP_API_SECRET`, `ASSISTANT_LOG_DIR`), значений не читать и не печатать.
- Тексты кухни — `src/components/kitchen/texts.ts` (RU/KY, термины — тест `kitchen-texts`); тексты галереи — `src/lib/gallery/texts.ts`.
- Образцы: отзывы (`src/lib/reviews/*`, `src/app/api/reviews/*`, `src/app/panel/reviews/route.ts`), сессия покупателя (`currentSession()` → `{phone, name, exp}`; `useCustomer()` в `src/components/AccountView.tsx`; вход — `src/components/CustomerLogin.tsx`), лимиты (`tooOften` в `src/lib/assistant/limits.ts`), `hideDigits` (`src/lib/assistant/log.ts`), уменьшение фото в браузере (`src/lib/reviews/shrink.ts`), кадр 3D (`engine.snapshot(w,h)` → data URL JPEG), проект кухни (`queryFromState`/`stateFromQuery` в `src/lib/kitchen/share.ts`), техника проекта (`projectItems` в `src/lib/kitchen/order.ts`), страницы (`src/app/[lang]/kitchen/page.tsx`: META, `canonical()` из `src/lib/seo.ts`), карта сайта `src/app/sitemap.ts`.
- Том данных на сервере — `/app/data` (`ASSISTANT_LOG_DIR`), переживает обновление сайта.

## Границы, решённые в спецификации

(см. `spec.md` «Границы и швы» — скопировано)

| Модуль | Выставляет |
|---|---|
| `src/lib/gallery/rules.ts` | `GalleryKitchen`, `validateTitle/validateComment`, `cleanComment`, `rankScore(avg, count)`, `authorIdOf(phone)`, лимиты |
| `src/lib/gallery/store.ts` | `publishKitchen`, `listKitchens({sort, shape?, authorId?, page})`, `getKitchen`, `rateKitchen`, `addComment`, `reportItem`, `removeOwn`, `addRealPhotos`, `hideKitchen`, `hideComment`, `readImage` |
| `src/app/api/gallery/*` | `GET/POST /api/gallery`, `GET/DELETE /api/gallery/[id]`, `POST …/rate`, `…/comments`, `…/report`, `…/photos`, `GET /api/gallery/image/[name]`; ошибки `login`, `too-many`, `bad-input`, `not-found`, `forbidden` |
| `src/data/kitchen-ready.ts` | `READY: {id, q, ru, ky, image, thumb, card}[]` |
| страницы | `/[lang]/kitchen/gallery`, `/[lang]/kitchen/gallery/[id]` (`ready-<id>` для готовых) |

**Швы для тестов:** `rules.ts`, `store.ts` (временная папка), обработчики `/api/gallery/*` (подмена сессии), `READY`, `sitemap`.

## Из таска 01 — хранилище и API (на ревью)

- `rules.ts` (браузер-безопасный): `GalleryCard {id,q,title,shape,role,authorName,authorId,createdAt,avg,count,commentCount,image,thumb,hasReal}`, `GalleryKitchen = Card & {comments, realPhotos}`, `GalleryComment {id,authorName,authorId,text,at}`, `Role`, `rankScore`, `firstName`, `cleanComment`, `validateComment`, `validateTitle`, `checkQuery`, `titleOf(q, lang)`, `thumbOf`, `imageType`, `PHOTO_NAME`; лимиты (PAGE_SIZE 24, заголовок 80, комментарий 2–500, картинка 400 КБ, превью 80 КБ, фото «в жизни» 5).
- `author.ts` (сервер): `authorIdOf(phone)` → 12 hex. `store.ts` (сервер): `publishKitchen`, `listKitchens({sort, shape?, authorId?, phone?, real?, page?})`, `getKitchen`, `viewerOf(id, phone)`, `rateKitchen`, `addComment`, `reportItem`, `removeOwn`, `addRealPhotos`, `hideKitchen`, `hideComment`, `hidePhoto`, `allKitchens`, `readImage`.
- HTTP: ошибки `{ok:false, error}` — login 401, too-many 429, bad-input 400, not-found 404, forbidden 403, save 500. `GET /api/gallery?sort&shape&author&real=1&mine=1&page`; `POST /api/gallery` → `{ok,id}`; `GET/DELETE /api/gallery/[id]` → `{ok, kitchen, viewer}`; `POST …/rate` → `{ok,avg,count}`; `…/comments` → `{ok,comment}`; `…/report`; `…/photos` → `{ok,realPhotos}`; `GET /api/gallery/image/<name>`.
- `authorName` может быть '' — экран подписывает по `role`. `q` — только как query в ссылке.

## Из таска 02 — готовые кухни (доработка: техника с живого сайта)

- `src/data/kitchen-ready.ts`: `ReadyKitchen {id, q, ru, ky, image, thumb, card}`, `READY` (12), `readyKitchen(id)`; картинки `/kitchen/ready/<id>.jpg|-s.jpg|-card.jpg`.
- Локальный `src/data/1c/catalog.json` устарел (нет холодильников, посудомоек, варочных); на сервере каталог свежий (синхронизируется при выкладке). Техника готовых кухонь — из живого сайта.

## Из таска 04 — конструктор (на ревью)

- `src/components/kitchen/ready.ts`: `wallsLength(s)`, `sizeBand(cm) → 'small'|'mid'|'large'` (≤270 / ≤400 / больше), `inBudget(sum, 'b100'|'b200'|'more')`, `topOfGallery(items)` (avg ≥ 4, count ≥ 3, ≤ 6), `openQuery(q, appliances) → {state, missing}`, `techSum(state, appliances)`.
- `src/components/kitchen/shot.ts`: `galleryShots(dataUrl) → {image 1200×750 ≤ 400 КБ, thumb 480×300 ≤ 80 КБ}`.
- `<ReadyStrip lang t appliances built onOpen(q, title)/>`, `<PublishDialog lang t q autoTitle shot onClose/>` (через `next/dynamic`, ssr:false); тексты `t.gallery.*` RU/KY.
- Кадр — `engine.sheetShot(1200, 750)` (общий вид).

## Из ремонта таска 01

- `rules.ts` += `KITCHEN_ID`, `DAY_MS`, `RATES_PER_MINUTE`, `COMMENTS_PER_KITCHEN` (300), `IMAGE_BUDGET` (3 ГБ), `canonicalQuery(raw)`, `authorNameOf(name)`; `GalleryCard.autoTitle` (true → название через `titleOf(q, lang)`).
- `image.ts` (новый): `imageSize`, `sizeOk` (≤ 4000 px), `stripExif`, `MAX_SIDE`.
- API: `/photos` > 5 → 429 `too-many`; нет места → 507 `{ok:false, error:'too-many', reason:'no-space'}`; `/rate` > 30/мин → 429; лимиты IP — `x-real-ip`.

## Из таска 03 — страницы (на ревью)

- `src/components/gallery/data.ts` (сервер): `kitchenPage(id, lang)` (<16hex> или `ready-<id>`), `galleryTiles({lang, sort, shape?, size?, real?, authorId?, phone?, upto?})`, `readyTiles(lang, {shape?, size?})`, `kitchenFacts(q, lang)`, `publishedKitchens()`, `wallLength(state)`.
- `src/lib/gallery/texts.ts`: `galleryTexts(lang)`, `errorText(lang, code)`, `sizeBand(cm)` (дубль с `src/components/kitchen/ready.ts` — свести).
- Адреса: `/[lang]/kitchen/gallery?sort=top|new&shape&size=small|mid|big&real=1&mine=1&author=<12hex>&page=N`; `/[lang]/kitchen/gallery/<id>|ready-<id>`. `sitemap.ts` — `force-dynamic`.
