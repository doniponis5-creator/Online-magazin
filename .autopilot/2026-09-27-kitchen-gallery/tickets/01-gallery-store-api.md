# 01 — Хранилище галереи, API и панель владельца

**Требования:** R05, R06, R07, R08, R09, R10, R11, R12, R13 (A01, A04), R15i (ранжирование), R17i
**Blocked by:** —
**Зона:** `src/lib/gallery/` (новая: `rules.ts`, `store.ts`) · `src/app/api/gallery/` (новые) · `src/app/panel/gallery/route.ts` (новый) · `__tests__/gallery-*.test.ts` (новые)
**Волна:** 1 (параллельно с 02 — зоны не пересекаются)
**Status:** ready

## Что должно заработать

Сервер умеет принять кухню от вошедшего (проект + картинка), отдать список и одну кухню без телефонов, принять оценку, комментарий, жалобу, фото «я сделал такую», убрать свою кухню; владелец прячет кухни и комментарии в `/panel/gallery?key=…`.

## Разделы спецификации

Истории 6–23 (серверная часть), Решения §1–§3, §4 (серверная проверка картинки), §6, §7; Границы (`rules.ts`, `store.ts`, `/api/gallery/*`, панель).

## Образец в проекте

Отзывы: `src/lib/reviews/store.ts` (папка из `REVIEWS_DIR`/`ASSISTANT_LOG_DIR`, очередь `serial()`, запись через tmp + rename, кэш `store(...)`, ошибка чтения ≠ пустой список), `src/lib/reviews/rules.ts` (`displayName`, `cleanText`, `imageType`, `PHOTO_NAME`, `thumbOf`), `src/app/api/reviews/*`, `src/app/panel/reviews/route.ts`; сессия — `currentSession()`, `clientIp()` из `src/app/api/customer/route-helpers.ts`; лимиты — `tooOften` из `src/lib/assistant/limits.ts`; `hideDigits` из `src/lib/assistant/log.ts`. Повторяй их стиль, не копируй код бездумно — общий кусок можно вынести, если это не ломает отзывы (их тесты `__tests__/reviews.test.ts` должны остаться зелёными).

## Критерии приёмки

- [ ] `store.ts`: папка `GALLERY_DIR || join(ASSISTANT_LOG_DIR || 'data', 'gallery')`, `kitchens.json` + `images/`; атомарная запись, очередь, кэш; до 2000 кухонь (сначала вычищаются скрытые, потом самые старые без оценок); у кухни: `id` (16 hex), `q` (≤ 4000, проверка `stateFromQuery` без падения), `title` (≤ 80, по умолчанию собирается из формы/размеров/стиля — функция в `rules.ts`), `role: 'buyer'|'master'`, `authorName` (только имя — первое слово, решение «Faqat ism»), `authorId`, телефон (приватно), `createdAt`, `status: 'published'|'hidden'`, оценки (по телефону, приватно) → публично `avg`, `count`, `comments[]` (`id`, `authorName` (только имя — первое слово, решение «Faqat ism»), `authorId`, `text`, `at`, `status`), `reports`, картинка + превью, до 5 реальных фото
- [ ] Публичная форма (`GalleryKitchen`) никогда не содержит телефонов и приватных полей — тест, что сериализованный ответ не содержит `+996`/`phone`
- [ ] `authorIdOf(phone)` — HMAC с секретом сайта (`SHOP_API_SECRET`; нет секрета — sha256 с солью из константы и пометкой), 12 hex
- [ ] `rankScore(avg, count)` — байесовское среднее (априорная 3,5, вес 5); `listKitchens({sort:'top'})` по нему, `'new'` — по дате; фильтры `shape`, `authorId`; страница 24
- [ ] API: `GET /api/gallery?sort&shape&author&page`; `POST /api/gallery` (multipart: `q`, `title?`, `role`, `image`, `thumb`) — нужна сессия (401 `login`), лимит 5 в сутки на телефон (429 `too-many`), картинка ≤ 400 КБ, превью ≤ 80 КБ, тип по байтам (JPEG/PNG/WebP); `GET /api/gallery/[id]`; `DELETE /api/gallery/[id]` — только автор; `POST /api/gallery/[id]/rate` `{stars:1..5}` — вошедший, не автор, одна на человека (можно поменять); `POST /api/gallery/[id]/comments` `{text}` — вошедший, 2–500 знаков, `hideDigits` + ссылки прячутся, ≤ 1/30 с и ≤ 20/сутки; `POST /api/gallery/[id]/report` `{commentId?}` — вошедший, одна жалоба от человека на запись; `POST /api/gallery/[id]/photos` — автор, до 5, как фото отзывов; `GET /api/gallery/image/[name]` — строгий шаблон имени, `nosniff`, кеш; скрытая кухня → 404 везде (и картинки)
- [ ] Ошибки — понятными кодами (`login`, `too-many`, `bad-input`, `not-found`, `forbidden`), как у отзывов; тексты ошибок на экране сделает таск 03/04
- [ ] Панель `/panel/gallery?key=…` (ключ `ASSISTANT_LOG_KEY`, как у отзывов; сравнение — через `timingSafeEqual`): последние кухни (картинка-превью, название, автор, оценка, жалобы) и последние комментарии; жалобы сверху; «Скрыть» кухню / комментарий / фото; `noindex`
- [ ] Тесты (`__tests__/gallery-store.test.ts`, `gallery-api.test.ts`): публикация и чтение, скрытие (и картинки 404), своя/чужая кухня, одна оценка на человека, лимиты, очистка текста, телефоны не утекают, параллельные записи, битый `kitchens.json` не превращается в пустой, `rankScore`; `reviews.test.ts` зелёный
- [ ] `npx tsc --noEmit`, `npx vitest run` зелёные
