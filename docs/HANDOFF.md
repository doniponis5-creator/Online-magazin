# Smart Centr — онлайн-магазин: что уже сделано

> Файл для нового чата. Сначала прочитайте этот файл, потом [TODO_NEXT.md](TODO_NEXT.md).
> Обновлено: 2026-09-17 (вечер). Ветка git: `feature/milestone-01-02-storefront`, всё закоммичено и отправлено в GitHub.

## 0. Правила работы (обязательно)

- Владелец — не программист. Пишет по-узбекски и по-русски. Ответы — на простом русском: сначала ответ, термины с расшифровкой, отчёт «что сделал · сработало или нет · что делать дальше», не больше 2 вариантов выбора, точные команды в блоках `bash`.
- **Пароли, ключи, секреты сам не вводить** (пароль 1С, секреты сервера, пароль VPS), даже если владелец присылает их в чат. Пароли владелец пишет сам в `.env.local`. Скрипты, которым нужен пароль 1С, запускает владелец.
- **Рабочая база 1С:** основную конфигурацию не менять, только расширение «Онлайн магазин». Сначала проверка на тестовой копии.
- **SBonus на сервере не ломать.** Любое изменение сервера — скриптом с бэкапом и автооткатом. Скрипт запускает владелец или (только с явного разрешения) я по SSH-ключу. Без разрешения на сервере — только чтение.
- **Главный сайт smartcentr.store не трогать.** Магазин временно на **https://whitefitpro.com** (потом свой домен).
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

**Бонусы SBonus на сайте (установлено на сервер и сайт 2026-09-17):**
```
покупатель → телефон → код в WhatsApp → вход (cookie sc_customer)
   новый номер → имя → клиент в SBonus + 1000 сом (только новым)
оформление → бонусы до SITE_BONUS_MAX_PCT% заказа → O!Деньги на (сумма − бонусы)
   оплата подтверждена → сервер списывает бонусы (чек СП-SC-…)
1С → заказ со скидкой бонусами по строкам, ПКО = деньги → РТУ → начисление бонуса (чек РТУ-<номер>)
```

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
| Вход покупателя по коду WhatsApp, сессия | `src/lib/customer/session.ts` (подписанная cookie `sc_customer`, 30 дней), `src/lib/customer/gateway.ts`, API `src/app/api/customer/{send-code,verify,register,me}`, `src/app/api/customer/route-helpers.ts` |
| Кабинет покупателя | `src/app/[lang]/account/page.tsx`, `src/components/AccountView.tsx` (баланс, уровень, история, заказы; хук `useCustomer`), `src/components/CustomerLogin.tsx`, `src/components/account.css` |
| Бонусы в оформлении заказа | `src/app/[lang]/checkout/page.tsx` (без входа заказ нельзя; галочка «Оплатить бонусами»), `src/app/api/orders/route.ts` (телефон из сессии, `applyBonus`), `src/lib/orders/order.ts` (`bonus`, `applyBonus`) |
| Тестовый режим без сервера | `.claude/launch.json` → `storefront-mock` (`SHOP_PAYMENT_MODE=mock`): код входа **1234**, бонусы в памяти |
| Страница статуса заказа (опрос каждые 5 с) | `src/app/[lang]/order/[id]/page.tsx`, `layout.tsx` (noindex) |
| Тексты | `src/lib/i18n/dictionaries.ts` (блоки `checkout`, `order`, `catalog.*`) |
| Тесты | `__tests__/orders.test.ts`, `__tests__/sku.test.ts`, `__tests__/customer.test.ts` (всего 62) |
| Настройки | `.env.local` (заполнен владельцем, не в git), `.env.example` |
| Режим оплаты | `paymentMode()`: `live`, если заданы `SHOP_API_URL` и `SHOP_API_SECRET`; иначе тестовый mock |

Сборка для сервера: `next.config.ts` (`output: 'standalone'`), `Dockerfile`, `.dockerignore`.

## 3. Расширение 1С «Онлайн магазин» (`integrations/1c-online-shop/`)

- База: 1С УТ 11.5.17.234 (не BAS), платформа 8.3.27, файловая. Рабочая: `D:\doonni\1С Предприятие\Базы\Смарт центр база`. Есть тестовая копия.
- Расширение собирается из XML скриптом `build_extension.py ut`. Версия **1.5.0.1** (бонусы) — установлена в **тестовую копию**. В **рабочей базе пока 1.4** → ⚠ до первого заказа с бонусами поставить 1.5 (`manage.py install prod`), иначе ПКО запишется на полную сумму.
- Управление: `python integrations/1c-online-shop/manage.py copy | install test | install prod | open`. Для `install prod` надо напечатать `УСТАНОВИТЬ`, делается бэкап .cfe. Перед установкой закрыть все сеансы 1С (иначе «исключительная блокировка»).
- Логин 1С берётся из `.env.local` через `scripts/local_env.py`.

Что умеет:
- Список товаров: скрыть/показать, наличие, своя цена, старая цена и скидка, распродажа, товар дня, хит, новинка, стоимость доставки, себестоимость и маржа (в т.ч. отрицательная).
- Карточка товара: фото (добавить, главное, порядок, удалить) + редактор фото (обрезка 1:1, 4:3, 3:4, 16:9, масштаб, поворот, размер 800/1200/1600).
- Настройки заказов: организация, склад, касса (по умолчанию «О! Business»), соглашение, услуга доставки, адрес сервера, ключ API. Кнопки «Проверить связь», «Загрузить сейчас», «Отправить каталог».
- Регламентные задания: `ИМ_ЗагрузкаЗаказовСайта` — каждые 300 с; `ИМ_ОтправкаКаталогаНаСайт` — каждые 600 с.
- Загрузка заказа: партнёр по телефону (последние 9 цифр) или новый → контрагент → ЗаказКлиента → ПКО в кассу → РеализацияТоваровУслуг, если товар в наличии. Защита от повторов: метка `САЙТ:<order_id>` в комментарии.
- Бонусы (1.5): `bonus_spent` → ручная скидка по строкам товаров (`РаспределитьСкидкуБонусами`, `ПроцентРучнойСкидки`/`СуммаРучнойСкидки`, этап оплаты = сумма после скидки), комментарий `SBonus+ скидка: N сом` (как кнопка SBonusPlus). ПКО = `pay_amount`. После проведённой РТУ — `НачислитьБонусЗаРеализацию`: `POST /api/v1/webhook/1c/purchase`, `branch_id` из константы `SB_BranchID`, чек `РТУ-<номер>`, комментарий `SBonus+ начислено`; 409 = уже начислено. `bonus_earned` уходит в mark-done.

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
| `shop_customers.py` | вход покупателя: `POST /api/v1/webhook/site/customer/send-code`, `/verify`, `/register`, `GET /api/v1/webhook/site/customer/{996XXXXXXXXX}?amount=&full=1`; `spend_for_order` (списание после оплаты, чек `СП-<order_id>`); welcome — транзакция PROMO с чеком `WELCOME-SITE-<phone>` (уникально) |
| `003_shop_bonus_migration.sql` | колонки `bonus_spend, bonus_spent, pay_amount, bonus_earned` в `shop_orders`; настройки `SITE_WELCOME_BONUS_AMOUNT=1000`, `SITE_BONUS_MAX_PCT=10` в таблице `settings` SBonus |
| `inspect_server.sh` | проверка сервера только на чтение |

Подписи: сайт ↔ сервер — HMAC-SHA256 секретом `SHOP_SITE_SECRET` (у сайта `SHOP_API_SECRET`). 1С ↔ сервер — секрет `webhook_1c_secret` (в 1С константа `SB_WebhookSecret`), GET — заголовок `X-Api-Key`.

- Последняя установка сервера: 2026-09-17 13:48 (бэкап БД `/opt/sbonus/backups/before_shop_20260917_134821.sql.gz`). Команда «ОТКАТ КОДА» из вывода `deploy_shop.sh` возвращает только код, данные остаются.
- Поменять бонусы сайта (без перезапуска): `docker exec sbonus_db psql -U sbonus -d sbonus_db -c "update settings set value='15' where key='SITE_BONUS_MAX_PCT'"` (аналогично `SITE_WELCOME_BONUS_AMOUNT`).
- В SBonus один филиал «Смарт Центр» (`36eccf64-521e-4d37-a301-0b1fd6d10a4f`). Уровни: Bronze 1%, Silver 2%, Gold 3%, Platinum 5%, platinum 7% — ⚠ у Gold порог 15000 меньше Silver 90000 и два Platinum (сообщено владельцу, не трогали).

### 4.2 Сайт на сервере — https://whitefitpro.com (временный домен)

- Файлы: `/opt/smartcentr-site`. Контейнер `smartcentr_site`, порт `127.0.0.1:18820`. Проект compose: `deploy/site/docker-compose.yml`.
- Каталог: cron `/etc/cron.d/smartcentr-site` → `deploy/site/update_catalog.sh` (каждые 10 мин; при изменении пересборка, при ошибке возврат к образу `:previous`). Лог: `/var/log/smartcentr-site.log`.
- Обновление сайта: `deploy/site/pack.ps1` (запускать через **PowerShell**, не Git Bash — там другой tar) → `scp smartcentr-site.tar.gz deploy/site/install_site.sh root@145.223.100.16:/tmp/` → `bash /tmp/install_site.sh whitefitpro.com www.whitefitpro.com` (все имена домена через пробел).
- Сменить домен: `deploy/site/set_shop_domain.sh <домен> [www.домен]` — выключает чужой конфиг этого домена, certbot, `SHOP_SITE_BASE_URL`, отмена `undo.sh` в папке бэкапа.
- smartcentr.store — снова прежняя страница (landing). Старая программа WhiteFit (порт 3000) работает, но без домена (владелец разрешил).
- Последняя установка сайта: 2026-09-17 13:50, бэкап `/opt/smartcentr-site-backups/20260917_135015`.

## 5. Известные проблемы

- В каталоге на сервере только 1–2 товара, остатки видны как 0. Причина не найдена. Владелец ещё не прислал результат кнопки «Отправить каталог сейчас» в рабочей базе.
- Бонусы сайта не проверены реальным входом/заказом (нужен телефон владельца). В локальном каталоге нет товаров с ценой — заказ с бонусами на localhost не пройти.

## 6. Память Claude

`C:\Users\uba\.claude\projects\D--Projects-Online-magazin\memory\` — `online-shop-architecture.md`, `user-credentials-boundary.md`, `user-profile.md`.
