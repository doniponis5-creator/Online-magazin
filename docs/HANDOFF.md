# Smart Centr — онлайн-магазин: что уже сделано

> Файл для нового чата. Сначала прочитайте этот файл, потом [TODO_NEXT.md](TODO_NEXT.md).
> Дата: 2026-09-17. Ветка git: `feature/milestone-01-02-storefront` (изменения **не закоммичены**).

## 0. Правила работы (обязательно)

- Владелец — не программист. Пишет по-узбекски и по-русски. Ответы — на простом русском: сначала ответ, термины с расшифровкой, отчёт «что сделал · сработало или нет · что делать дальше», не больше 2 вариантов выбора, точные команды в блоках `bash`.
- **Пароли, ключи, секреты сам не вводить** (пароль 1С, секреты сервера, пароль VPS), даже если владелец присылает их в чат. Пароли владелец пишет сам в `.env.local`. Скрипты, которым нужен пароль 1С, запускает владелец.
- **Рабочая база 1С:** основную конфигурацию не менять, только расширение «Онлайн магазин». Сначала проверка на тестовой копии.
- **SBonus на сервере не ломать.** Любое изменение сервера — скриптом с бэкапом и автооткатом. Скрипт запускает владелец или (только с явного разрешения) я по SSH-ключу. Без разрешения на сервере — только чтение.
- **Главный сайт smartcentr.store не трогать.** Магазин будет на **shop.smartcentr.store**.
- Главную страницу сайта не менять (кроме блока «Бренды»).
- Коммит и push в GitHub — только по просьбе владельца. Репозиторий: https://github.com/doniponis5-creator/Online-magazin

## 1. Общая схема

```
1С УТ 11.5 (расширение «Онлайн магазин»)
   │  каждые 10 мин: товары + фото  ──►  сервер SBonus (api.smartcentr.store)
   │  каждые 5 мин: забирает оплаченные заказы  ◄──┘        │
   │                                                          │ каталог (cron 10 мин)
   │                                                          ▼
   └── создаёт партнёра, заказ, ПКО, реализацию      сайт (Next.js, контейнер smartcentr_site)
                                                              │
                     покупатель ──► оформление ──► O!Деньги ──┘ (callback на сервер SBonus)
                                                   + WhatsApp клиенту и админу
```

Проверено реальной оплатой 1 сом: сайт → сервер → O!Деньги → WhatsApp → 1С (тестовая копия).

## 2. Сайт (папка `D:\Projects\Online-magazin`)

Next.js 16 (App Router), React 19, TypeScript. Тесты: `npm test` (vitest, 57 тестов), e2e — Playwright через msedge.

| Что | Файлы |
|---|---|
| Фильтры каталога (цена, бренды, в наличии, скидка, хит, новинка; состояние в URL) | `src/components/CatalogView.tsx`, `src/components/catalog-filters.css` |
| Логотипы брендов (оригинальные цвета, выравнивание размера) | `src/components/BrandLogo.tsx`, `src/data/brand-logos.json`, `public/brands/`, скрипты `scripts/brand-logos/process.cjs`, `render-svg.cjs`; исходники `public/Бренд лого/` (+ `wikimedia/SOURCES.md`) |
| Блок «Бренды» на главной (12 шт., сначала с логотипом) | `src/components/HomeMerchandising.tsx` |
| Товары из 1С | `src/data/1c/adapter.ts` (OneCItem → Product, бренды, slug), `src/data/1c/categories.ts` (9 разделов + авто-раскладка товаров без группы), `src/data/1c/catalog.json` (данные), `src/data/products.ts`, `src/data/categories.ts` |
| «Цена по запросу» (цена 0) | `ProductCard.tsx`, `ProductPurchase.tsx`, `AddToCartButton.tsx` |
| Новые иконки товаров | `src/components/ProductArt.tsx` (fridge, stove, fan, battery, box) |
| Оформление заказа + оплата O!Деньги | `src/app/[lang]/checkout/page.tsx`, `src/lib/orders/order.ts` (проверка заказа, телефон +996, доставка), `src/lib/orders/gateway.ts` (связь с сервером, подпись HMAC), `src/app/api/orders/route.ts`, `src/app/api/orders/[id]/route.ts`, `src/app/api/orders/[id]/mock-pay/route.ts` |
| Страница статуса заказа (опрос каждые 5 с) | `src/app/[lang]/order/[id]/page.tsx`, `layout.tsx` (noindex) |
| Тексты | `src/lib/i18n/dictionaries.ts` (блоки `checkout`, `order`, `catalog.*`) |
| Тесты | `__tests__/orders.test.ts`, `__tests__/sku.test.ts` |
| Настройки | `.env.local` (заполнен владельцем, не в git), `.env.example` |
| Режим оплаты | `paymentMode()`: `live`, если заданы `SHOP_API_URL` и `SHOP_API_SECRET`; иначе тестовый mock |

Сборка для сервера: `next.config.ts` (`output: 'standalone'`), `Dockerfile`, `.dockerignore`.

## 3. Расширение 1С «Онлайн магазин» (`integrations/1c-online-shop/`)

- База: 1С УТ 11.5.17.234 (не BAS), платформа 8.3.27, файловая. Рабочая: `D:\doonni\1С Предприятие\Базы\Смарт центр база`. Есть тестовая копия.
- Расширение собирается из XML скриптом `build_extension.py`. Версия **1.4.0.1**. Установлено в тестовую копию и в **рабочую базу**.
- Управление: `python integrations/1c-online-shop/manage.py copy | install test | install prod | open`. Для `install prod` надо напечатать `УСТАНОВИТЬ`, делается бэкап .cfe. Перед установкой закрыть все сеансы 1С (иначе «исключительная блокировка»).
- Логин 1С берётся из `.env.local` через `scripts/local_env.py`.

Что умеет:
- Список товаров: скрыть/показать, наличие, своя цена, старая цена и скидка, распродажа, товар дня, хит, новинка, стоимость доставки, себестоимость и маржа (в т.ч. отрицательная).
- Карточка товара: фото (добавить, главное, порядок, удалить) + редактор фото (обрезка 1:1, 4:3, 3:4, 16:9, масштаб, поворот, размер 800/1200/1600).
- Настройки заказов: организация, склад, касса (по умолчанию «О! Business»), соглашение, услуга доставки, адрес сервера, ключ API. Кнопки «Проверить связь», «Загрузить сейчас», «Отправить каталог».
- Регламентные задания: `ИМ_ЗагрузкаЗаказовСайта` — каждые 300 с; `ИМ_ОтправкаКаталогаНаСайт` — каждые 600 с.
- Загрузка заказа: партнёр по телефону (последние 9 цифр) или новый → контрагент → ЗаказКлиента → ПКО в кассу → РеализацияТоваровУслуг, если товар в наличии. Защита от повторов: метка `САЙТ:<order_id>` в комментарии.

Файлы модулей: `src/ФормаМодуль.bsl`, `src/КарточкаТовараМодуль.bsl`, `src/РедакторФотоМодуль.bsl`, `src/РедакторФото.html`, `src/ОбщийМодульСервер.bsl` (ИМ_ОнлайнМагазинСервер), `src/ЗаказыСайтаСервер.bsl` (ИМ_ЗаказыСайтаСервер), `src/НастройкиМагазинаМодуль.bsl`.

Регистры: `ИМ_ТоварыСайта`, `ИМ_ФотоТоваров`, `ИМ_НастройкиМагазина`.

Выгрузка каталога вручную (без сервера): `python scripts/1c-export/export_catalog.py` (`--test` — тестовая копия) → `src/data/1c/catalog.json` + фото в `public/products/1c`.

## 4. Сервер SBonus (VPS `145.223.100.16`, Ubuntu 22.04)

- Вход: `ssh root@145.223.100.16` по ключу `C:\Users\uba\.ssh\id_ed25519` (без пароля).
- SBonus: `/opt/sbonus`, `docker-compose.prod.yml`, контейнеры `sbonus_api` (FastAPI), `sbonus_db` (postgres, база `sbonus_db`), redis, admin, client (кабинет `https://cabinet.smartcentr.store`), pos. Код API: `/opt/sbonus/sbonus-backend/app`. Настройки: `/opt/sbonus/.env.production`.
- DNS: `api.smartcentr.store` → 145.223.100.16. `smartcentr.store` и `www` → 2.57.91.91 (другой хостинг).

### 4.1 Модуль магазина в SBonus (развёрнут, работает)

Исходник у нас: `integrations/sbonus-server/shop/`. На сервере — пакет `app/shop`.

| Файл | Что делает |
|---|---|
| `shop_models.py` | таблицы ShopOrder, ShopOrderEvent |
| `001_shop_orders_migration.sql`, `002_shop_catalog_migration.sql` | таблицы заказов, `shop_catalog`, `shop_photos` |
| `shop_router.py` | `POST /api/v1/webhook/site/orders` (создать заказ + счёт O!Деньги), `GET /api/v1/webhook/site/orders/{id}?token=`, `/api/v1/webhook/obank/shop-callback`, для 1С: `GET .../pending`, `POST .../{id}/mark-done`, `.../{id}/mark-failed`; WhatsApp клиенту и админу (996557100505) |
| `shop_catalog.py` | приём каталога и фото из 1С, `GET /api/v1/webhook/site/catalog`, публичные фото `GET /api/v1/shop/photos/{key}.jpg` |
| `deploy_shop.sh` | установка: бэкап БД и main.py, миграции, сборка только api, автооткат |
| `inspect_server.sh` | проверка сервера только на чтение |

Подписи: сайт ↔ сервер — HMAC-SHA256 секретом `SHOP_SITE_SECRET` (у сайта `SHOP_API_SECRET`). 1С ↔ сервер — секрет `webhook_1c_secret` (в 1С константа `SB_WebhookSecret`), GET — заголовок `X-Api-Key`.

⚠️ **Не запускать** команду «ОТКАТ», которую печатает `deploy_shop.sh`: сейчас она удалит и заказы.

### 4.2 Сайт на сервере (развёрнут, но на временном домене)

- Файлы: `/opt/smartcentr-site`. Контейнер `smartcentr_site`, порт `127.0.0.1:18820`. Проект compose: `deploy/site/docker-compose.yml`.
- Каталог: cron `/etc/cron.d/smartcentr-site` → `deploy/site/update_catalog.sh` (каждые 10 мин; при изменении пересборка, при ошибке возврат к образу `:previous`). Лог: `/var/log/smartcentr-site.log`.
- Установка: `deploy/site/pack.ps1` (архив 5,2 МБ) → `scp` → `deploy/site/install_site.sh`.
- ⚠️ `install_site.sh` сейчас жёстко настроен на `smartcentr.store`. Он отключил nginx-конфиги `landing.conf` и `smartcentr.store` и добавил `smartcentr-shop.conf`. Бэкап: `/opt/smartcentr-site-backups/20260917_124103`, откат: `restore_previous_site.sh` в этой папке. certbot не сработал (DNS указывает на другой хостинг). **Это надо исправить — см. TODO_NEXT.md, задача 1.**

## 5. Известные проблемы

- В каталоге на сервере только 1–2 товара, остатки видны как 0. Причина не найдена. Владелец ещё не прислал результат кнопки «Отправить каталог сейчас» в рабочей базе.
- Все изменения в git не закоммичены.

## 6. Память Claude

`C:\Users\uba\.claude\projects\D--Projects-Online-magazin\memory\` — `online-shop-architecture.md`, `user-credentials-boundary.md`, `user-profile.md`.
