# Graph Report - Online-magazin  (2026-09-20)

## Corpus Check
- 232 files · ~4,493,472 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 34 file(s) not represented in the graph (top: .bsl 7, .css 7, (none) 6)

## Summary
- 1494 nodes · 3183 edges · 147 communities (82 shown, 65 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 83 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `de2b5823`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- orders/gateway.ts
- build_model.py
- build_extension.py
- config.ts
- OfflineCatalogView
- App Store га топшириш — 8-қадам
- package.json
- AccountView.tsx
- ProductCard.tsx
- shop_customers.py
- get
- Текшириладиган рўйхат
- Icons.tsx
- CatalogView.tsx
- shop_push.py
- AppLockPlugin
- BonusCardView
- collections
- shop_admin.py
- CartProvider.tsx
- @playwright/test
- compilerOptions
- AppDelegate
- I18nProvider.tsx
- useI18n
- FilterSelect.tsx
- TASK 03A Report — review closure and LG scene
- _post
- TASK 04 Report — Blender Model of LG F4X5ES5SB
- Smart Centr Architecture (site, iOS, Android, 1C, SBonus)
- customer/gateway.ts
- BonusCardPlugin
- Bonus Hold Mechanism
- Neutral Localized Photo Placeholder
- about/page.tsx
- app/shop Module on the SBonus Server
- TASK 03 Brief — expressive storefront, photos, motion
- TODO_NEXT.md — What To Do Next
- products.ts
- ShopOrder
- 1C Extension ИМ_ОнлайнМагазин
- IOS_APP_UZ.md — App Store Guide
- TASK 03 Report — Storefront Photos and Motion
- fetch-photos.mjs
- make-ios-icon.mjs
- Smart Centr Project Working Rules
- 3. Устувор топилмалар
- Hero3D Pure-CSS LG Scroll Scene
- HANDOFF.md — What Is Already Built
- .scene
- OfflineCatalogPlugin
- set_shop_domain.sh
- switch_to_shop_domain.sh
- install_site.sh
- [lang]/layout.tsx
- shop_router.py
- Gallery.tsx
- Data Ownership Matrix (source of truth per entity)
- update_site.sh
- inspect_server.sh
- pack.sh script
- update_catalog.sh
- deploy_shop.sh
- Package.swift
- apns-remote.sh
- setup-apns.sh script
- telegram-gateway-remote.sh
- render-svg.cjs
- Смарт Центр — бош саҳифа янгиланиши
- MODEL_SOURCES — модель LG F4X5ES5SB (TASK 04, этап Blender)
- v7 — исправления модели и визуальная проверка
- Смарт Центр — аудит тузатишлари
- Home merchandising extension
- BRIEF.md
- SCROLL-PLAN.md
- DIRECTION.md
- HomeStory.tsx
- ref_d
- caveman/SKILL.md
- setup-demo-login.sh
- concurrent_futures
- importlib_util
- io
- ref_node_assert
- requests
- urllib_parse
- CatalogStore
- build-appstore.sh
- capacitor_swift
- review-light-lemon.cjs
- bs4
- privacy.ts
- sync-catalog.mjs
- errorResponse
- argparse
- cdvscreenorientationdelegate
- cdvurlprotocol
- cdvwebviewprocesspoolfactory
- cstdbool
- cstddef
- appdelegate
- cstdint
- cstring
- new
- nsdictionary_cordovapreferences
- objc_prologue
- objectivec
- ptrauth
- stdbool
- stddef
- stdint
- cdvavailabilitydeprecated
- stdlib
- type_traits
- uchar
- usernotifications
- webkit
- (entry)/layout.tsx
- catalog.ts
- route-helpers.ts
- order.ts
- dictionaries.ts
- ref_node_path
- update-all.sh
- install-on-iphone.sh
- cappluginmethod
- cdv
- cdvavailability
- cdvcommanddelegateimpl
- cdvinvokedurlcommand
- capinstancedescriptor
- cdvplugin
- cdvplugin_resources
- cdvpluginmanager
- cdvpluginresult
- corefoundation
- shop_models.py
- process.cjs
- product/[id]/page.tsx
- currentSession

## God Nodes (most connected - your core abstractions)
1. `useI18n()` - 65 edges
2. `react` - 30 edges
3. `base()` - 29 edges
4. `text()` - 24 edges
5. `getProduct()` - 24 edges
6. `formatSom()` - 23 edges
7. `Form` - 21 edges
8. `OfflineCatalogView` - 19 edges
9. `ShopOrder` - 18 edges
10. `isLang()` - 18 edges

## Surprising Connections (you probably didn't know these)
- `A11 · P2 — Қирғизча HTML дастлаб рус тили деб белгиланган` --references--> `HtmlLang()`  [INFERRED]
  review/audit-20260915/AUDIT_UZ.md → src/components/HtmlLang.tsx
- `window.imExport — JPEG data URL Export Bridge` --semantically_similar_to--> `window.Capacitor.Plugins.BonusCard Bridge`  [INFERRED] [semantically similar]
  integrations/1c-online-shop/src/РедакторФото.html → ios-web/index.html
- `Bonus Hold Mechanism` --semantically_similar_to--> `normalizeLines Cart Restoration Guard`  [INFERRED] [semantically similar]
  ARCHITECTURE_UZ.md → TASK_02_REPORT.md
- `ASSET_SOURCES.md Photo Licensing Ledger` --semantically_similar_to--> `Wikimedia Brand Logo Sources and Licenses`  [INFERRED] [semantically similar]
  TASK_03_REPORT.md → public/Бренд лого/wikimedia/SOURCES.md
- `Smart Centr Project Working Rules` --semantically_similar_to--> `Owner's Work Standard (verify visually, no self-scoring)`  [INFERRED] [semantically similar]
  CLAUDE.md → TASK_03A_REVIEW_FIXES.md

## Import Cycles
- None detected.

## Communities (147 total, 65 thin omitted)

### Community 0 - "orders/gateway.ts"
Cohesion: 0.18
Nodes (16): ref_next_server, POST(), GET(), mockSpend(), API_URL, callServer(), CreateResult, getOrder() (+8 more)

### Community 1 - "build_model.py"
Cohesion: 0.05
Nodes (51): area(), box(), camera(), digit(), look_at(), LG F4X5ES5SB — внешняя модель по официальным фото, не заводской CAD. blender…, weighted(), Листы проверки: только кадрирование/одинаковая высота, без ретуши модели. (+43 more)

### Community 2 - "build_extension.py"
Cohesion: 0.10
Nodes (38): build_adopted(), build_common_module(), build_configuration(), build_module(), build_processor(), build_register(), build_registers(), build_role() (+30 more)

### Community 3 - "config.ts"
Cohesion: 0.16
Nodes (14): nextConfig, next, generateMetadata(), generateMetadata(), generateMetadata(), generateMetadata(), generateMetadata(), metadata (+6 more)

### Community 4 - "OfflineCatalogView"
Cohesion: 0.15
Nodes (24): Codable, Equatable, Identifiable, Int, CatalogBrand, CatalogCategory, CatalogItem, .inStock (+16 more)

### Community 5 - "App Store га топшириш — 8-қадам"
Cohesion: 0.17
Nodes (11): 1. Сайт ва сервер чиқарилсин, 2. Демо-кириш ёқилсин, 3. Apple калити жанговар режимга, App Store га топшириш — 8-қадам, Жанговар йиғилишни қандай қилиш, «Маълумотлар ёрлиғи» — App Store Connect даги жавоблар, Рад этилса, Сиздан керак — Apple сўрайдиган матнлар (+3 more)

### Community 6 - "package.json"
Cohesion: 0.05
Nodes (37): config, dependencies, @capacitor/cli, @capacitor/core, @capacitor/ios, @capacitor/push-notifications, next, react (+29 more)

### Community 7 - "AccountView.tsx"
Cohesion: 0.13
Nodes (28): AccountView(), formatDate(), useCustomer(), src_components_home_merchandising, AppLockPlugin, CapacitorGlobal, forgetFaceId(), hasLockKey() (+20 more)

### Community 8 - "ProductCard.tsx"
Cohesion: 0.17
Nodes (15): ref_next_link, FavoritesPage(), FavoriteButton(), ProductCard(), msLeft(), PromoCountdown(), two(), QuantityStepper() (+7 more)

### Community 10 - "shop_customers.py"
Cohesion: 0.16
Nodes (32): asyncio, BonusAccount, Decimal, _account(), branch_id(), _code_hash(), _customer(), get_profile() (+24 more)

### Community 11 - "get"
Cohesion: 0.29
Nodes (10): _as_jpeg(), photos_index(), public_photo(), AsyncSession, Request, JPEG оставляем как есть; PNG, WebP, BMP, GIF переводим в JPEG (прозрачность —…, site_catalog(), upload_catalog() (+2 more)

### Community 12 - "Текшириладиган рўйхат"
Cohesion: 0.12
Nodes (16): 1. Илова очилиши, 2. Кириш, 3. Бонус картаси, 4. ⚠ Кассадаги сканер — энг муҳим текширув, 5. Face ID, 6. Push хабарлар, 7. Иловани ёпиб, қайта очиш, 8. Каталог интернетсиз (+8 more)

### Community 13 - "Icons.tsx"
Cohesion: 0.12
Nodes (32): frameUrl(), Hero3D(), base(), IconArrowDown(), IconArrowUpRight(), IconCard(), IconCart(), IconCheck() (+24 more)

### Community 14 - "CatalogView.tsx"
Cohesion: 0.15
Nodes (18): metadata, src_components_catalog_filters, Badge, BADGES, CatalogView(), CatalogViewInner(), inStock(), normalize() (+10 more)

### Community 15 - "shop_push.py"
Cohesion: 0.16
Nodes (23): base64, _b64(), _bundle(), _devices(), _drop(), enabled(), _fail(), forget_phone() (+15 more)

### Community 16 - "AppLockPlugin"
Cohesion: 0.13
Nodes (12): CAPPlugin, Foundation, AppLockPlugin, AppLockStore, .base, Any, Bool, CAPPluginCall (+4 more)

### Community 17 - "BonusCardView"
Cohesion: 0.13
Nodes (18): CoreImage.CIFilterBuiltins, Double, Image, BonusCardData, BonusCardStore, .query, BonusCardView, .body (+10 more)

### Community 19 - "shop_admin.py"
Cohesion: 0.10
Nodes (39): app_core_redis, app_models, httpx, Интернет-магазин Smart Centr: заказы с сайта (O!Деньги → 1С)., account_delete(), AccountDelete, _as_list(), _clean() (+31 more)

### Community 20 - "CartProvider.tsx"
Cohesion: 0.10
Nodes (36): ART_BY_CATEGORY, BRAND_ALIASES, cleanName(), detectBrand(), KNOWN_BRANDS, OneCCatalog, OneCItem, productFromOneC() (+28 more)

### Community 21 - "@playwright/test"
Cohesion: 0.12
Nodes (7): widths, ref_node_assert_strict, ref_node_fs, @playwright/test, assert, { chromium }, fs

### Community 22 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 23 - "AppDelegate"
Cohesion: 0.15
Nodes (11): Error, AppDelegate, Any, Bool, Data, UIScene, UISceneSession, UIWindow (+3 more)

### Community 24 - "I18nProvider.tsx"
Cohesion: 0.12
Nodes (27): react, CartPage(), CheckoutPage(), FieldErrors, OrderView(), src_components_account, AddToCartButton(), BottomNav() (+19 more)

### Community 25 - "useI18n"
Cohesion: 0.11
Nodes (33): CategoryTiles(), HomePage(), InfoStrip(), NightBanner(), ProductSection(), BonusPromo(), Brand(), BrandMark() (+25 more)

### Community 26 - "FilterSelect.tsx"
Cohesion: 0.38
Nodes (6): src_components_filter_select, FilterSelect(), choose(), keyboard(), show(), Option

### Community 27 - "TASK 03A Report — review closure and LG scene"
Cohesion: 0.27
Nodes (14): Archived Pexels Category Photo Set, Asset Sources Contract (no active product photos), photo-sources.ts Canonical Machine List, LG F4X5ES5SB 3D Scroll Scene Brief, TASK 03A Brief — close design review, MotionProvider Empty-Deps and Reveal Cascade Defect, Photo Source Reconciliation Audit, ProductImage Always Uses altRu Defect (+6 more)

### Community 28 - "_post"
Cohesion: 0.27
Nodes (10): AsyncClient, enabled(), _post(), Интернет-магазин Smart Centr — код входа через Telegram Gateway. Зачем: код в…, Один вызов Gateway API. Возвращает result или None, если не вышло., Отправить код входа в Telegram. True — доставлено в Telegram, False — нет…, send_code(), sender() (+2 more)

### Community 29 - "TASK 04 Report — Blender Model of LG F4X5ES5SB"
Cohesion: 0.15
Nodes (16): No Fake Reviews, Timers or Discounts, TASK 04 Brief — Realistic LG Frames, LG F4X5ES5SB Washing Machine, Do Not Pass Photos or AI Images as Rendered Model, Single Editable 3D Source Rule, Three Mandatory Frames (front, 3/4, cutaway), TASK 04 Report — Blender Model of LG F4X5ES5SB, build_model.py Procedural Blender Scene (+8 more)

### Community 30 - "Smart Centr Architecture (site, iOS, Android, 1C, SBonus)"
Cohesion: 0.19
Nodes (13): Mobile Path Decision (Capacitor shell vs full native), Security, Privacy and Recovery Plan, Smart Centr Architecture (site, iOS, Android, 1C, SBonus), Unified Client API, Product Principles (honest demo vs confirmed data), Smart Centr Product Definition, Demo Boundaries (no real 1C/SBonus/payments), Storefront Prototype README (milestone 01/02) (+5 more)

### Community 31 - "customer/gateway.ts"
Cohesion: 0.11
Nodes (21): POST(), BonusHistoryItem, call(), CodeChannel, CustomerApiError, CustomerOrderItem, CustomerProfile, DEMO_BALANCE (+13 more)

### Community 32 - "BonusCardPlugin"
Cohesion: 0.27
Nodes (5): CGFloat, BonusCardPlugin, CAPPluginCall, CAPPluginMethod, UIViewController

### Community 33 - "Bonus Hold Mechanism"
Cohesion: 0.22
Nodes (11): Extended Admin Workspace, Bonus Hold Mechanism, Pickup and Staff-Coordinated Taxi Delivery, Persistent Exchange Queue (outbox/inbox), Pre-Launch Acceptance Tests (15 scenarios), Night / 1C-Offline Order Mode, O!Dengi Payment Verification, 1C Standard Reservation Mechanism (+3 more)

### Community 34 - "Neutral Localized Photo Placeholder"
Cohesion: 0.22
Nodes (11): Approved Blue + Lime Palette (variant 01), Neutral Localized Photo Placeholder, White-Lemon-Cobalt Color Tokens, The Compact Commerce Rule, The Honest Status Rule, The Lemon Signal Rule, Manrope Typography Scale, The One-Family Rule (Manrope only) (+3 more)

### Community 35 - "about/page.tsx"
Cohesion: 0.23
Nodes (18): AboutPage(), metadata, ContactButton(), Footer(), IconInstagram(), IconTelegram(), IconWhatsApp(), InstagramCard() (+10 more)

### Community 36 - "app/shop Module on the SBonus Server"
Cohesion: 0.16
Nodes (14): Site docker-compose Project (smartcentr-site), Separate Compose Project So SBonus Containers Are Untouched, site service → container smartcentr_site on 127.0.0.1:18820, deploy_shop.sh — Backup, Trial Import, Auto-Rollback, Панель сайта — Site Control Panel inside 1C, app/shop Module on the SBonus Server, Three-Part Architecture (site · SBonus server · 1C), APNs Push Notifications (shop_push.py, .p8 key) (+6 more)

### Community 37 - "TASK 03 Brief — expressive storefront, photos, motion"
Cohesion: 0.27
Nodes (10): The Flat-First Rule, Repository Structure Map, P0 Defect List (language, catalog, cart, variants), buildLangHref Language Switch Fix, comboVariant Single SKU Source, normalizeLines Cart Restoration Guard, URL as Single Source of Catalog State, TASK 03 Brief — expressive storefront, photos, motion (+2 more)

### Community 38 - "TODO_NEXT.md — What To Do Next"
Cohesion: 0.24
Nodes (10): SBonus Bonus Flow on the Site, Face ID Login (AppLock.swift, native key), Apple Guideline 4.2 — Repackaged Website Rejection, Path B — Capacitor Shell Plus Real Native Capabilities, TODO_NEXT.md — What To Do Next, SBonus BonusService earn/spend Semantics, Mixed+ iOS 26 Liquid Glass Plan, Owner Decisions (login, welcome bonus, site bonus cap) (+2 more)

### Community 39 - "products.ts"
Cohesion: 0.07
Nodes (22): ProductDetail(), src_data_1c_catalog, categories, Category, CategoryId, demoCategories, ArtKind, brands (+14 more)

### Community 40 - "ShopOrder"
Cohesion: 0.15
Nodes (24): api_route, Сколько клиент платит деньгами (для старых заказов без бонусов — total)., Для страницы заказа на сайте: без телефона и адреса., Для 1С: всё, что нужно для Заказа клиента, ПКО и Реализации., ShopOrder, _admin_phone(), _check_and_confirm(), _client_ip() (+16 more)

### Community 41 - "1C Extension ИМ_ОнлайнМагазин"
Cohesion: 0.32
Nodes (8): 1C Extension ИМ_ОнлайнМагазин, HMAC-SHA256 Signing Between Site, Server and 1C, Order Import Idempotency via САЙТ:<order_id> Marker, 1C Prod Still on 1.4 — Must Install 1.5 Before First Bonus Order, РедакторФото.html — 1C Photo Editor UI, #im-out Hidden Textarea Handoff Channel, %IMAGE_DATA_URL% Template Placeholder, window.imExport — JPEG data URL Export Bridge

### Community 42 - "IOS_APP_UZ.md — App Store Guide"
Cohesion: 0.38
Nodes (7): IOS_APP_UZ.md — App Store Guide, Offline SBonus QR Card (BonusCard.swift, Keychain), CODE_SIGN_IDENTITY="-" Required or Keychain Fails (-34018), Offline Catalog on the Phone (not started), Unverified — Does the POS Scanner Read SB-XXXXXXXXXX, ios-web/index.html — Offline Screen, window.Capacitor.Plugins.BonusCard Bridge

### Community 43 - "TASK 03 Report — Storefront Photos and Motion"
Cohesion: 0.29
Nodes (8): Manrope SIL Open Font License 1.1, TASK 03 Report — Storefront Photos and Motion, Accessible Gallery Zoom via native <dialog>, ASSET_SOURCES.md Photo Licensing Ledger, Cart Restore Notice for Corrupted Storage, Explicit SKU Combination State, Motion Duration Token System, Poster Fallback for No-JS, Reduced Motion and Load Errors

### Community 44 - "fetch-photos.mjs"
Cohesion: 0.36
Nodes (8): BAD_WORDS, FORCE, GOOD_WORDS, main(), score(), searchTopic(), sleep(), TOPICS

### Community 45 - "make-ios-icon.mjs"
Cohesion: 0.28
Nodes (8): glyph(), icon(), iconSet, INK, mark, root, splash(), splashSet

### Community 46 - "Smart Centr Project Working Rules"
Cohesion: 0.25
Nodes (8): Next.js Agent Rules Block, Installment Eligibility Flag (existing SBonus clients only), Phone + One-Time Code Login, Smart Centr Project Working Rules, Secrets Boundary (never type owner's credentials), Live System Overview (site, SBonus server, 1C UT 11.5), Telegram Gateway Login Code with WhatsApp Fallback, Owner's Work Standard (verify visually, no self-scoring)

### Community 47 - "3. Устувор топилмалар"
Cohesion: 0.11
Nodes (18): 1. Реализация яхлитлиги: ўтмади, 2. Умумий баҳо — 11/20, 3. Устувор топилмалар, 4. Детектор натижасини қандай талқин қилдим, 5. Яхши ишланган қисмлар, 6. Текширув ҳажми ва чегаралари, 7. Кейинги ишлар тартиби, A01 · P0 — 768–900 px экранда саватга ўтиш йўқолади (+10 more)

### Community 48 - "Hero3D Pure-CSS LG Scroll Scene"
Cohesion: 0.43
Nodes (7): HomeStory Scroll Scene («the house wakes up»), Reduce/No-JS/No-WebGL Static Fallback Policy, Inverter Direct Drive Schematic View, Four Scroll-Progress Phases (0-20/20-55/55-80/80-100%), TurboWash360 Four-Direction Water Flow, Hero3D Pure-CSS LG Scroll Scene, next/image Stale-Cache Root Cause (same URL, new bytes)

### Community 49 - "HANDOFF.md — What Is Already Built"
Cohesion: 0.40
Nodes (6): HANDOFF.md — What Is Already Built, Known Issue — Only 1-2 Products Reach the Server Catalog, paymentMode() live vs mock Fallback, Assistant Never Types the Owner's Secrets, Wikimedia Brand Logo Sources and Licenses, Smart Centr Brand Logo Provenance

### Community 50 - ".scene"
Cohesion: 0.12
Nodes (13): Capacitor, CAPBridgeViewController, MainViewController, SceneDelegate, UIScene, UISceneSession, UIWindow, NSUserActivity (+5 more)

### Community 51 - "OfflineCatalogPlugin"
Cohesion: 0.33
Nodes (4): CAPBridgedPlugin, OfflineCatalogPlugin, CAPPluginCall, CAPPluginMethod

### Community 52 - "set_shop_domain.sh"
Cohesion: 0.53
Nodes (4): fail(), restore_nginx(), set_shop_domain.sh script, step()

### Community 53 - "switch_to_shop_domain.sh"
Cohesion: 0.53
Nodes (4): fail(), restore_nginx(), switch_to_shop_domain.sh script, step()

### Community 54 - "install_site.sh"
Cohesion: 0.70
Nodes (4): fail(), restore_nginx(), install_site.sh script, step()

### Community 55 - "[lang]/layout.tsx"
Cohesion: 0.18
Nodes (12): ref_next_navigation, LangLayout(), viewport, Header(), HtmlLang(), MotionProvider(), VisitCounter(), visitorId() (+4 more)

### Community 56 - "shop_router.py"
Cohesion: 0.10
Nodes (29): app_core_config, app_core_database, app_payments, datetime, fastapi, fastapi_responses, hashlib, hmac (+21 more)

### Community 57 - "Gallery.tsx"
Cohesion: 0.29
Nodes (6): ref_next_image, DevGalleryFixturePage(), Gallery(), ProductArt(), ProductImage(), ProductPhoto

### Community 58 - "Data Ownership Matrix (source of truth per entity)"
Cohesion: 0.50
Nodes (4): Data Ownership Matrix (source of truth per entity), Technical Data Contract (entity fields), Photo Request for Future 1C Catalog, Post-Acceptance Roadmap (contracts → 1C → SBonus → payments → mobile)

### Community 59 - "update_site.sh"
Cohesion: 0.83
Nodes (3): fail(), update_site.sh script, step()

### Community 74 - "render-svg.cjs"
Cohesion: 0.29
Nodes (6): ref_fs, ref_path, { chromium }, DIR, fs, path

### Community 75 - "Смарт Центр — бош саҳифа янгиланиши"
Cohesion: 0.29
Nodes (6): Дизайн ҳужжатлаштириш — оддий кенгайтириш, Кейинга қолдирилган, Смарт Центр — бош саҳифа янгиланиши, Тайёр бўлимлар, Таҳрирлаш, Текширув

### Community 76 - "MODEL_SOURCES — модель LG F4X5ES5SB (TASK 04, этап Blender)"
Cohesion: 0.29
Nodes (6): MODEL_SOURCES — модель LG F4X5ES5SB (TASK 04, этап Blender), Инструменты, Редактируемый источник (наш), Референсы (материалы производителя, не являются сдачей), Сравнение с официальным фото, Что в модели подтверждено референсами, а что приблизительно

### Community 77 - "v7 — исправления модели и визуальная проверка"
Cohesion: 0.33
Nodes (6): v7 — исправления модели и визуальная проверка, Актуальные артефакты, Воспроизведение, Практические ограничения, Проверено, Что исправлено

### Community 78 - "Смарт Центр — аудит тузатишлари"
Cohesion: 0.40
Nodes (4): Натижа, Смарт Центр — аудит тузатишлари, Текширувлар, Чегаралар

### Community 83 - "HomeStory.tsx"
Cohesion: 0.47
Nodes (4): A09 · P2 — Дизайн ҳужжати ва токенлар амалдаги бош баннердан ортда қолган, src_components_home_story, HomeStory(), StorefrontHero()

### Community 85 - "caveman/SKILL.md"
Cohesion: 0.25
Nodes (7): Выключение, Где caveman выключается сам, Правила сжатия, Уровни, Что остаётся обычным текстом, Язык — главное правило, Ясность важнее краткости

### Community 93 - "CatalogStore"
Cohesion: 0.22
Nodes (7): CatalogStore, .file, .folder, .updatedAt, Bool, Data, URL

### Community 94 - "build-appstore.sh"
Cohesion: 0.83
Nodes (3): fail(), build-appstore.sh script, step()

### Community 96 - "review-light-lemon.cjs"
Cohesion: 0.40
Nodes (4): ref_node_fs_promises, { chromium }, fs, path

### Community 100 - "privacy.ts"
Cohesion: 0.25
Nodes (9): metadata, PrivacyPage(), getPrivacy(), PRIVACY_UPDATED, PrivacyContent, privacyKy, privacyRu, PrivacySection (+1 more)

### Community 101 - "sync-catalog.mjs"
Cohesion: 0.15
Nodes (10): ref_node_crypto, ref_node_url, apiUrl, CATALOG, fileEnv, log(), main(), ROOT (+2 more)

### Community 102 - "errorResponse"
Cohesion: 0.28
Nodes (12): POST(), POST(), clientIp(), errorResponse(), startSession(), POST(), POST(), demoProfile() (+4 more)

### Community 129 - "(entry)/layout.tsx"
Cohesion: 0.24
Nodes (4): metadata, src_app_globals, src_app_light_lemon, NotFoundMessage()

### Community 130 - "catalog.ts"
Cohesion: 0.31
Nodes (9): OfflineCatalogSync(), CapacitorGlobal, CatalogPlugin, markTried(), offlineCatalogState(), plugin(), showOfflineCatalog(), syncOfflineCatalog() (+1 more)

### Community 131 - "route-helpers.ts"
Cohesion: 0.20
Nodes (15): ref_next_headers, ref_server_only, CustomerSession, decodeSession(), encodeNativeKey(), encodeSession(), NATIVE_KEY_DAYS, secret() (+7 more)

### Community 132 - "order.ts"
Cohesion: 0.18
Nodes (15): POST(), demoProducts, getProfile(), isDemoPhone(), createOrder(), applyBonus(), DeliveryMethod, deliveryPriceFor() (+7 more)

### Community 133 - "dictionaries.ts"
Cohesion: 0.21
Nodes (9): vitest, PEXELS_LICENSE, PhotoSource, photoSources, Dict, dictionaries, ky, ru (+1 more)

### Community 135 - "ref_node_path"
Cohesion: 0.20
Nodes (7): ref_node_path, sharp, ref_vitest_config, files, variants, { chromium }, path

### Community 137 - "update-all.sh"
Cohesion: 0.83
Nodes (3): fail(), update-all.sh script, step()

### Community 152 - "shop_models.py"
Cohesion: 0.22
Nodes (10): Base, Интернет-магазин Smart Centr — заказы с сайта (SQLAlchemy). Один заказ сайта =…, Вход покупателя и отправленный код — для счётчиков в «Панели сайта». От…, Посещение страницы сайта. visitor — необратимый отпечаток случайного…, ShopEvent, ShopOrderEvent, ShopVisit, sqlalchemy_dialects_postgresql (+2 more)

### Community 153 - "process.cjs"
Cohesion: 0.19
Nodes (14): backgroundColor(), BRANDS, fs, INK, main(), MANIFEST, median(), OUT (+6 more)

### Community 154 - "product/[id]/page.tsx"
Cohesion: 0.17
Nodes (9): generateMetadata(), ProductPage(), since, products, canonical(), SITE_ALT_NAMES, SITE_NAME, SITE_URL (+1 more)

### Community 155 - "currentSession"
Cohesion: 0.22
Nodes (12): POST(), DELETE(), GET(), GET(), currentSession(), endSession(), POST(), dynamic (+4 more)

## Knowledge Gaps
- **275 isolated node(s):** `Ҳозирги ҳолат`, `1. Сайт ва сервер чиқарилсин`, `2. Демо-кириш ёқилсин`, `3. Apple калити жанговар режимга`, `Сиздан керак — Apple сўрайдиган матнлар` (+270 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 537 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **65 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `copy_base()` connect `build_model.py` to `build_extension.py`, `package.json`?**
  _High betweenness centrality (0.204) - this node is a cross-community bridge._
- **Why does `test` connect `package.json` to `build_model.py`?**
  _High betweenness centrality (0.204) - this node is a cross-community bridge._
- **Are the 10 inferred relationships involving `text()` (e.g. with `photos_index()` and `public_photo()`) actually correct?**
  _`text()` has 10 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Ҳозирги ҳолат`, `1. Сайт ва сервер чиқарилсин`, `2. Демо-кириш ёқилсин` to the rest of the system?**
  _275 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `build_model.py` be split into smaller, more focused modules?**
  _Cohesion score 0.05004389815627744 - nodes in this community are weakly interconnected._
- **Should `build_extension.py` be split into smaller, more focused modules?**
  _Cohesion score 0.10272536687631027 - nodes in this community are weakly interconnected._
- **Should `OfflineCatalogView` be split into smaller, more focused modules?**
  _Cohesion score 0.14623655913978495 - nodes in this community are weakly interconnected._