# Интерфейсы прогона

## Правила проекта (для каждого исполнителя)

- Стек: Next.js (версия в `package.json`; **эта версия отличается от привычной** — перед
  правкой роутов читать `node_modules/next/dist/docs/`), React, TypeScript, three.js 0.186,
  vitest. Дизайн-токены — `DESIGN.md` в корне (цвета `cobalt-control`, `midnight-ink`,
  `mist-border`; радиусы; Manrope).
- Команды: `npx tsc --noEmit` · `npx vitest run` · `npm run build`. Dev-сервер поднимает
  только оркестратор через панель предпросмотра, исполнитель dev не запускает.
- **Не трогать**: `integrations/`, `deploy/`, `ios/`, `layout.ts`, `build.ts`, схему ссылок
  в `share.ts`, тексты PDF. Не устанавливать зависимости: нет пакета → вернуть `BLOCKED`.
- Не коммитить. Коммит делает оркестратор.
- Комментарии в коде — по-русски, в стиле файла (объясняют «почему», не «что»).
- Секреты не читать и не писать.

## Границы, решённые в спецификации

| Модуль | Владеет | Выставляет | Прячет |
|---|---|---|---|
| `next.config.ts` | заголовки ответа | `headers()` | список заголовков |
| `src/app/api/kitchen/photo/route.ts` | прокси фото | `GET ?src=` | белый список из каталога, кэш |
| `src/components/kitchen/three/engine.ts` | рендер, качество | `setQuality`, существующие методы; новых публичных методов не добавлять | губернатор кадров, ratio, lowEnd |
| `src/components/kitchen/KitchenPlanner.tsx` + `kitchen.css` + `texts.ts` | экран, полный экран, панель | — | `fullPanel`, раскладка STACKED |
| `src/lib/kitchen/share.ts` | разбор ссылки | `stateFromQuery` | лимиты (не менять, только тесты) |

Швы для тестов: `stateFromQuery` в `__tests__/kitchen.test.ts`; прокси — `curl` на dev;
экран — браузер 390×844 и 1280×800.

## Что построили таски (дописывают исполнители)

### 01 — безопасность

- `next.config.ts` → `headers()`: на `/:path*` — `X-Frame-Options: SAMEORIGIN`,
  `Content-Security-Policy: frame-ancestors 'self'`, `Referrer-Policy: strict-origin-when-cross-origin`,
  `X-Content-Type-Options: nosniff`. Другие таски заголовки не добавляют.
- `GET /api/kitchen/photo?src=` — `src` только из белого списка (`products[].image`, начинающиеся
  с `HOST`; собирается один раз через `store('kitchen-photo-allow')`), иначе 400 без запроса наружу.
  Отдаёт только `image/jpeg|png|webp`, с `nosniff`; файл ≤ 2 МБ, кэш 40 фото.

## Из таска 03 — движок

- `three/governor.ts`: `newGovernor(base, ratio?)`, `governStep(state, dtMs)` — чистый шаг губернатора; тест `__tests__/kitchen-governor.test.ts`.
- Движок: новых публичных методов нет; на mobile antialias off, ratio 1 в движении, тени 1024 (HD), без captureRoom; hidden → кадры не рисуются; lowEnd (≤ 4 ядер) → фото 1536.

## Из таска 02 — экран

- `src/lib/kitchen/variants.ts`: `parseVariants(raw)`, тип `Variant`; тест `__tests__/kitchen-variants.test.ts`.
- Планировщик: `fullPanel` + класс `is-panel` (только телефон в полном экране); `hostRef` = `.kp-scene` (холст), `stageRef` = `.kp-stage`; полоса `.kp-stage__bar`; переменные `--kp-strip`, `--kp-steps-h`, `--kp-full-foot`; тексты `toolsMoreShort`, `panelHide`.

## Из таска 05 — лёгкая модель

- `Quality = 'lite' | 'hd' | '4k'`; в движке единый `get lite()`; `BuildInput.lite` → `createMaterials(..., lite)` → `Mats.lite` (сборка читает только его). lowEnd без сохранённого `kp-quality` → lite. Тексты `qualityLite`.
