# Graph Report - Online-magazin  (2026-09-21)

## Corpus Check
- 307 files · ~4,895,731 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 55 file(s) not represented in the graph (top: .xml 13, (none) 8, .css 8)

## Summary
- 2131 nodes · 4842 edges · 178 communities (104 shown, 74 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 107 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e79ce727`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- orders/order.ts
- build_model.py
- build_extension.py
- config.ts
- OfflineCatalogView
- App Store га топшириш — 8-қадам
- package.json
- AccountView.tsx
- formatSom
- AppLockPlugin.java
- shop_customers.py
- customer/gateway.ts
- Текшириладиган рўйхат
- Icons.tsx
- CatalogView.tsx
- shop_push.py
- AppLockPlugin
- BonusCardView
- CatalogStore
- shop_admin.py
- telegram/order.ts
- @playwright/test
- compilerOptions
- AppDelegate
- export_catalog.py
- useI18n
- assistant.test.ts
- TASK 03A Report — review closure and LG scene
- bot.ts
- TASK 04 Report — Blender Model of LG F4X5ES5SB
- Smart Centr Architecture (site, iOS, Android, 1C, SBonus)
- privacy.ts
- BonusCardPlugin
- Bonus Hold Mechanism
- Neutral Localized Photo Placeholder
- next
- app/shop Module on the SBonus Server
- TASK 03 Brief — expressive storefront, photos, motion
- TODO_NEXT.md — What To Do Next
- assistant/route.ts
- shop_router.py
- 1C Extension ИМ_ОнлайнМагазин
- IOS_APP_UZ.md — App Store Guide
- TASK 03 Report — Storefront Photos and Motion
- fetch-photos.mjs
- [lang]/layout.tsx
- Smart Centr Project Working Rules
- 3. Устувор топилмалар
- Hero3D Pure-CSS LG Scroll Scene
- HANDOFF.md — What Is Already Built
- shop_installments_calc.py
- OfflineCatalogPlugin
- set_shop_domain.sh
- switch_to_shop_domain.sh
- install_site.sh
- shop_catalog.py
- shop_wa_bot.py
- ref_node_path
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
- ProductCard.tsx
- Смарт Центр — бош саҳифа янгиланиши
- MODEL_SOURCES — модель LG F4X5ES5SB (TASK 04, этап Blender)
- v7 — исправления модели и визуальная проверка
- Смарт Центр — аудит тузатишлари
- Home merchandising extension
- BRIEF.md
- SCROLL-PLAN.md
- DIRECTION.md
- make-ios-icon.mjs
- ref_d
- caveman/SKILL.md
- setup-demo-login.sh
- pathlib
- manage.py
- Что сделано на PC 21.09.2026 — читать MacBook первым делом
- orders/gateway.ts
- products.ts
- FilterSelect.tsx
- .dp
- make-app-icons.mjs
- capacitor_swift
- route-helpers.ts
- OfflineCatalogActivity.java
- BonusCardActivity.java
- (entry)/layout.tsx
- local.ts
- ProductArt.tsx
- OfflineCatalogActivity
- currentSession
- I18nProvider.tsx
- sources/page.tsx
- check_installments.py
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
- catalog.ts
- dictionaries.ts
- ExampleInstrumentedTest.java
- deploy_cabinet_walogin.sh
- AssistantChat.tsx
- sync-catalog.mjs
- Adapter
- update-all.sh
- install-on-iphone.sh
- bs4
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
- errorResponse
- .scene
- digest.ts
- process.cjs
- build-appstore.sh
- telegram-webhook.sh
- knowledge.ts
- importlib_util
- android.os.Bundle
- reply.ts
- android.graphics.Bitmap
- gradlew
- android-keystore.sh
- argparse
- concurrent_futures
- html
- io
- requests
- urllib_parse
- urllib_request
- ref_node_assert
- ref_node_fs

## God Nodes (most connected - your core abstractions)
1. `useI18n()` - 68 edges
2. `formatSom()` - 36 edges
3. `handleUpdate()` - 32 edges
4. `text()` - 31 edges
5. `react` - 31 edges
6. `base()` - 30 edges
7. `OfflineCatalogActivity` - 24 edges
8. `_post()` - 24 edges
9. `getProduct()` - 24 edges
10. `Lang` - 23 edges

## Surprising Connections (you probably didn't know these)
- `A11 · P2 — Қирғизча HTML дастлаб рус тили деб белгиланган` --references--> `HtmlLang()`  [INFERRED]
  review/audit-20260915/AUDIT_UZ.md → src/components/HtmlLang.tsx
- `window.imExport — JPEG data URL Export Bridge` --semantically_similar_to--> `window.Capacitor.Plugins.BonusCard Bridge`  [INFERRED] [semantically similar]
  integrations/1c-online-shop/src/РедакторФото.html → ios-web/index.html
- `Bonus Hold Mechanism` --semantically_similar_to--> `normalizeLines Cart Restoration Guard`  [INFERRED] [semantically similar]
  ARCHITECTURE_UZ.md → TASK_02_REPORT.md
- `Smart Centr Project Working Rules` --semantically_similar_to--> `Owner's Work Standard (verify visually, no self-scoring)`  [INFERRED] [semantically similar]
  CLAUDE.md → TASK_03A_REVIEW_FIXES.md
- `Для PC: кабинет SBonus тоже шлёт код через Green API` --references--> `_own_wa_number()`  [INFERRED]
  docs/MAC_2026-09-21.md → integrations/sbonus-server/shop/shop_customers.py

## Import Cycles
- None detected.

## Communities (178 total, 74 thin omitted)

### Community 0 - "orders/order.ts"
Cohesion: 0.18
Nodes (15): POST(), demoProducts, getProfile(), isDemoPhone(), createOrder(), applyBonus(), DeliveryMethod, deliveryPriceFor() (+7 more)

### Community 1 - "build_model.py"
Cohesion: 0.10
Nodes (13): area(), box(), camera(), digit(), look_at(), LG F4X5ES5SB — внешняя модель по официальным фото, не заводской CAD. blender…, weighted(), TASK_05: последовательность поворота LG F4X5ES5SB (¾ → фронт → ¾). Загружает… (+5 more)

### Community 2 - "build_extension.py"
Cohesion: 0.10
Nodes (38): build_adopted(), build_common_module(), build_configuration(), build_module(), build_processor(), build_register(), build_registers(), build_role() (+30 more)

### Community 3 - "config.ts"
Cohesion: 0.20
Nodes (10): generateMetadata(), generateMetadata(), generateMetadata(), generateMetadata(), generateMetadata(), defaultLang, isLang(), languages (+2 more)

### Community 4 - "OfflineCatalogView"
Cohesion: 0.15
Nodes (24): Codable, Equatable, Identifiable, Int, CatalogBrand, CatalogCategory, CatalogItem, .inStock (+16 more)

### Community 5 - "App Store га топшириш — 8-қадам"
Cohesion: 0.17
Nodes (11): 1. Сайт ва сервер чиқарилсин, 2. Демо-кириш ёқилсин, 3. Apple калити жанговар режимга, App Store га топшириш — 8-қадам, Жанговар йиғилишни қандай қилиш, «Маълумотлар ёрлиғи» — App Store Connect даги жавоблар, Рад этилса, Сиздан керак — Apple сўрайдиган матнлар (+3 more)

### Community 6 - "package.json"
Cohesion: 0.05
Nodes (40): config, dependencies, @capacitor/android, @capacitor/cli, @capacitor/core, @capacitor/ios, @capacitor/push-notifications, next (+32 more)

### Community 7 - "AccountView.tsx"
Cohesion: 0.13
Nodes (28): AccountView(), formatDate(), useCustomer(), src_components_home_merchandising, AppLockPlugin, CapacitorGlobal, forgetFaceId(), hasLockKey() (+20 more)

### Community 8 - "formatSom"
Cohesion: 0.10
Nodes (28): CartPage(), CheckoutPage(), FieldErrors, OrderView(), src_components_account, CartReminder(), CustomerLogin(), Step (+20 more)

### Community 9 - "AppLockPlugin.java"
Cohesion: 0.05
Nodes (49): AppLockPlugin, BonusCardPlugin, Store, OfflineCatalogPlugin, Store, Vault, android.content.Context, android.content.SharedPreferences (+41 more)

### Community 10 - "shop_customers.py"
Cohesion: 0.13
Nodes (41): BonusAccount, Decimal, _account(), branch_id(), _code_hash(), _customer(), get_profile(), _logged_in() (+33 more)

### Community 11 - "customer/gateway.ts"
Cohesion: 0.10
Nodes (26): POST(), POST(), BonusHistoryItem, call(), CodeChannel, CustomerApiError, CustomerOrderItem, CustomerProfile (+18 more)

### Community 12 - "Текшириладиган рўйхат"
Cohesion: 0.12
Nodes (16): 1. Илова очилиши, 2. Кириш, 3. Бонус картаси, 4. ⚠ Кассадаги сканер — энг муҳим текширув, 5. Face ID, 6. Push хабарлар, 7. Иловани ёпиб, қайта очиш, 8. Каталог интернетсиз (+8 more)

### Community 13 - "Icons.tsx"
Cohesion: 0.12
Nodes (32): ref_next_navigation, Cached, base(), IconArrowDown(), IconArrowUpRight(), IconCamera(), IconCard(), IconCart() (+24 more)

### Community 14 - "CatalogView.tsx"
Cohesion: 0.15
Nodes (18): metadata, src_components_catalog_filters, Badge, BADGES, CatalogView(), CatalogViewInner(), inStock(), normalize() (+10 more)

### Community 15 - "shop_push.py"
Cohesion: 0.09
Nodes (35): app_payments, httpx, _b64(), _bundle(), _devices(), _drop(), enabled(), _fail() (+27 more)

### Community 16 - "AppLockPlugin"
Cohesion: 0.13
Nodes (12): CAPPlugin, Foundation, AppLockPlugin, AppLockStore, .base, Any, Bool, CAPPluginCall (+4 more)

### Community 17 - "BonusCardView"
Cohesion: 0.13
Nodes (18): CoreImage.CIFilterBuiltins, Double, Image, BonusCardData, BonusCardStore, .query, BonusCardView, .body (+10 more)

### Community 18 - "CatalogStore"
Cohesion: 0.22
Nodes (7): CatalogStore, .file, .folder, .updatedAt, Bool, Data, URL

### Community 19 - "shop_admin.py"
Cohesion: 0.09
Nodes (47): app_models, AsyncClient, Интернет-магазин Smart Centr: заказы с сайта (O!Деньги → 1С)., account_delete(), AccountDelete, _as_list(), _attention(), _clean() (+39 more)

### Community 20 - "telegram/order.ts"
Cohesion: 0.08
Nodes (46): vitest, products, ASK_PHONE, BAD_PHONE, CALL_INTENT, Draft, drafts, FAILED (+38 more)

### Community 21 - "@playwright/test"
Cohesion: 0.18
Nodes (8): @playwright/test, dynamic, esc(), GET(), page(), rowsTable(), when(), summarize()

### Community 22 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 23 - "AppDelegate"
Cohesion: 0.15
Nodes (11): Error, AppDelegate, Any, Bool, Data, UIScene, UISceneSession, UIWindow (+3 more)

### Community 24 - "export_catalog.py"
Cohesion: 0.31
Nodes (15): csv, main(), Почему товара нет на сайте — только чтение, база 1С не меняется. На сайт уходит…, reason(), connect(), detect_brand(), export_photos(), load_settings() (+7 more)

### Community 25 - "useI18n"
Cohesion: 0.12
Nodes (32): CategoryTiles(), HomePage(), InfoStrip(), NightBanner(), ProductSection(), BonusReminder(), BottomNav(), hasBrandImage() (+24 more)

### Community 26 - "assistant.test.ts"
Cohesion: 0.20
Nodes (13): dynamic, POST(), fromJson(), withoutIds(), askGemini(), geminiConfigured(), GeminiError, MEDIA_TASK (+5 more)

### Community 27 - "TASK 03A Report — review closure and LG scene"
Cohesion: 0.27
Nodes (14): Archived Pexels Category Photo Set, Asset Sources Contract (no active product photos), photo-sources.ts Canonical Machine List, LG F4X5ES5SB 3D Scroll Scene Brief, TASK 03A Brief — close design review, MotionProvider Empty-Deps and Reveal Cascade Defect, Photo Source Reconciliation Audit, ProductImage Always Uses altRu Defect (+6 more)

### Community 28 - "bot.ts"
Cohesion: 0.14
Nodes (24): dynamic, POST(), cancelLead(), tooOften(), backToChat(), call(), handleUpdate(), hello() (+16 more)

### Community 29 - "TASK 04 Report — Blender Model of LG F4X5ES5SB"
Cohesion: 0.27
Nodes (9): TASK 04 Brief — Realistic LG Frames, LG F4X5ES5SB Washing Machine, Do Not Pass Photos or AI Images as Rendered Model, Single Editable 3D Source Rule, TASK 04 Report — Blender Model of LG F4X5ES5SB, build_model.py Procedural Blender Scene, Empty Contact Sheet Caused by Opaque SVG Overlay, Fixes in Script, Never by Transforming Final PNGs (+1 more)

### Community 30 - "Smart Centr Architecture (site, iOS, Android, 1C, SBonus)"
Cohesion: 0.19
Nodes (13): Mobile Path Decision (Capacitor shell vs full native), Security, Privacy and Recovery Plan, Smart Centr Architecture (site, iOS, Android, 1C, SBonus), Unified Client API, Product Principles (honest demo vs confirmed data), Smart Centr Product Definition, Demo Boundaries (no real 1C/SBonus/payments), Storefront Prototype README (milestone 01/02) (+5 more)

### Community 31 - "privacy.ts"
Cohesion: 0.25
Nodes (9): metadata, PrivacyPage(), getPrivacy(), PRIVACY_UPDATED, PrivacyContent, privacyKy, privacyRu, PrivacySection (+1 more)

### Community 32 - "BonusCardPlugin"
Cohesion: 0.27
Nodes (5): CGFloat, BonusCardPlugin, CAPPluginCall, CAPPluginMethod, UIViewController

### Community 33 - "Bonus Hold Mechanism"
Cohesion: 0.22
Nodes (11): Extended Admin Workspace, Bonus Hold Mechanism, Pickup and Staff-Coordinated Taxi Delivery, Persistent Exchange Queue (outbox/inbox), Pre-Launch Acceptance Tests (15 scenarios), Night / 1C-Offline Order Mode, O!Dengi Payment Verification, 1C Standard Reservation Mechanism (+3 more)

### Community 34 - "Neutral Localized Photo Placeholder"
Cohesion: 0.22
Nodes (11): Approved Blue + Lime Palette (variant 01), Neutral Localized Photo Placeholder, White-Lemon-Cobalt Color Tokens, The Compact Commerce Rule, The Honest Status Rule, The Lemon Signal Rule, Manrope Typography Scale, The One-Family Rule (Manrope only) (+3 more)

### Community 35 - "next"
Cohesion: 0.22
Nodes (6): nextConfig, next, ALLOW, ASSISTANTS, PRIVATE, TRAINERS

### Community 36 - "app/shop Module on the SBonus Server"
Cohesion: 0.16
Nodes (14): Site docker-compose Project (smartcentr-site), Separate Compose Project So SBonus Containers Are Untouched, site service → container smartcentr_site on 127.0.0.1:18820, deploy_shop.sh — Backup, Trial Import, Auto-Rollback, Панель сайта — Site Control Panel inside 1C, app/shop Module on the SBonus Server, Three-Part Architecture (site · SBonus server · 1C), APNs Push Notifications (shop_push.py, .p8 key) (+6 more)

### Community 37 - "TASK 03 Brief — expressive storefront, photos, motion"
Cohesion: 0.27
Nodes (10): The Flat-First Rule, Repository Structure Map, P0 Defect List (language, catalog, cart, variants), buildLangHref Language Switch Fix, comboVariant Single SKU Source, normalizeLines Cart Restoration Guard, URL as Single Source of Catalog State, TASK 03 Brief — expressive storefront, photos, motion (+2 more)

### Community 38 - "TODO_NEXT.md — What To Do Next"
Cohesion: 0.28
Nodes (9): SBonus Bonus Flow on the Site, Apple Guideline 4.2 — Repackaged Website Rejection, Path B — Capacitor Shell Plus Real Native Capabilities, TODO_NEXT.md — What To Do Next, SBonus BonusService earn/spend Semantics, Mixed+ iOS 26 Liquid Glass Plan, Owner Decisions (login, welcome bonus, site bonus cap), SBonus Tier Threshold Anomaly (Gold < Silver, two Platinum) (+1 more)

### Community 39 - "assistant/route.ts"
Cohesion: 0.14
Nodes (19): ref_node_crypto, dynamic, ipOf(), POST(), readImage(), seen, tooOften(), dynamic (+11 more)

### Community 40 - "shop_router.py"
Cohesion: 0.09
Nodes (49): api_route, app_core_config, Base, fastapi_responses, Сколько клиент платит деньгами (для старых заказов без бонусов — total)., Для страницы заказа на сайте: без телефона и адреса., Для 1С: всё, что нужно для Заказа клиента, ПКО и Реализации., ShopOrder (+41 more)

### Community 41 - "1C Extension ИМ_ОнлайнМагазин"
Cohesion: 0.32
Nodes (8): 1C Extension ИМ_ОнлайнМагазин, HMAC-SHA256 Signing Between Site, Server and 1C, Order Import Idempotency via САЙТ:<order_id> Marker, 1C Prod Still on 1.4 — Must Install 1.5 Before First Bonus Order, РедакторФото.html — 1C Photo Editor UI, #im-out Hidden Textarea Handoff Channel, %IMAGE_DATA_URL% Template Placeholder, window.imExport — JPEG data URL Export Bridge

### Community 42 - "IOS_APP_UZ.md — App Store Guide"
Cohesion: 0.32
Nodes (8): IOS_APP_UZ.md — App Store Guide, Face ID Login (AppLock.swift, native key), Offline SBonus QR Card (BonusCard.swift, Keychain), CODE_SIGN_IDENTITY="-" Required or Keychain Fails (-34018), Offline Catalog on the Phone (not started), Unverified — Does the POS Scanner Read SB-XXXXXXXXXX, ios-web/index.html — Offline Screen, window.Capacitor.Plugins.BonusCard Bridge

### Community 43 - "TASK 03 Report — Storefront Photos and Motion"
Cohesion: 0.18
Nodes (13): TASK 03 Report — Storefront Photos and Motion, Accessible Gallery Zoom via native <dialog>, Cart Restore Notice for Corrupted Storage, Explicit SKU Combination State, Motion Duration Token System, No Fake Reviews, Timers or Discounts, Three Mandatory Frames (front, 3/4, cutaway), V7_REVIEW.md Current Limitations Record (+5 more)

### Community 44 - "fetch-photos.mjs"
Cohesion: 0.36
Nodes (8): BAD_WORDS, FORCE, GOOD_WORDS, main(), score(), searchTopic(), sleep(), TOPICS

### Community 45 - "[lang]/layout.tsx"
Cohesion: 0.18
Nodes (11): LangLayout(), viewport, Header(), HtmlLang(), MotionProvider(), VisitCounter(), visitorId(), Lang (+3 more)

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
Cohesion: 0.29
Nodes (8): HANDOFF.md — What Is Already Built, Known Issue — Only 1-2 Products Reach the Server Catalog, paymentMode() live vs mock Fallback, Assistant Never Types the Owner's Secrets, Wikimedia Brand Logo Sources and Licenses, Smart Centr Brand Logo Provenance, Manrope SIL Open Font License 1.1, ASSET_SOURCES.md Photo Licensing Ledger

### Community 50 - "shop_installments_calc.py"
Cohesion: 0.16
Nodes (18): date, build_rows(), _day(), _money(), _one_phone(), parse_phones(), _purchase(), Рассрочка для сайта: чистый расчёт без сервера и базы. Отдельный файл, чтобы то… (+10 more)

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

### Community 55 - "shop_catalog.py"
Cohesion: 0.08
Nodes (41): app_core_database, collections, datetime, fastapi, hashlib, _as_jpeg(), chat_extra_items(), photos_index() (+33 more)

### Community 56 - "shop_wa_bot.py"
Cohesion: 0.07
Nodes (54): app_core_redis, asyncio, Бонус виден покупателю, Вход через WhatsApp «наоборот» (главное за вечер), Для PC: кабинет SBonus тоже шлёт код через Green API, Консультант, Проверить после выкатки (PC), Что сделано на MacBook 21.09.2026 — читать PC первым делом (+46 more)

### Community 57 - "ref_node_path"
Cohesion: 0.20
Nodes (7): ref_node_path, sharp, ref_vitest_config, files, variants, { chromium }, path

### Community 58 - "Data Ownership Matrix (source of truth per entity)"
Cohesion: 0.50
Nodes (4): Data Ownership Matrix (source of truth per entity), Technical Data Contract (entity fields), Photo Request for Future 1C Catalog, Post-Acceptance Roadmap (contracts → 1C → SBonus → payments → mobile)

### Community 59 - "update_site.sh"
Cohesion: 0.83
Nodes (3): fail(), update_site.sh script, step()

### Community 74 - "ProductCard.tsx"
Cohesion: 0.17
Nodes (17): ref_next_link, FavoritesPage(), generateMetadata(), ProductPage(), AddToCartButton(), FavoriteButton(), ProductCard(), QuantityStepper() (+9 more)

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

### Community 83 - "make-ios-icon.mjs"
Cohesion: 0.20
Nodes (9): glyph(), ICON_YELLOW, iconSet, iconSource, INK, mark, root, splash() (+1 more)

### Community 85 - "caveman/SKILL.md"
Cohesion: 0.25
Nodes (7): Выключение, Где caveman выключается сам, Правила сжатия, Уровни, Что остаётся обычным текстом, Язык — главное правило, Ясность важнее краткости

### Community 87 - "pathlib"
Cohesion: 0.18
Nodes (8): Листы проверки: только кадрирование/одинаковая высота, без ретуши модели., main(), patch(), Кабинет SBonus — страница входа: кнопка «Войти через WhatsApp». Правит…, Path, pathlib, pil, shutil

### Community 88 - "manage.py"
Cohesion: 0.20
Nodes (17): ask_credentials(), _configure(), configure_extension(), copy_base(), designer(), _detect(), detect_variant(), install() (+9 more)

### Community 89 - "Что сделано на PC 21.09.2026 — читать MacBook первым делом"
Cohesion: 0.29
Nodes (6): WhatsApp-продавец (новое, проверено вживую), Ждёт завтра (PC, 1С), Прочее, ⚠ Сначала — о чужих файлах, Что работает (выкачено), Что сделано на PC 21.09.2026 — читать MacBook первым делом

### Community 90 - "orders/gateway.ts"
Cohesion: 0.16
Nodes (17): ref_next_server, POST(), GET(), getInstallment(), mockSpend(), API_URL, callServer(), CreateResult (+9 more)

### Community 91 - "products.ts"
Cohesion: 0.07
Nodes (23): ref_next_image, dynamic, SnapshotItem, DevGalleryFixturePage(), Gallery(), ProductDetail(), src_data_1c_catalog, Category (+15 more)

### Community 92 - "FilterSelect.tsx"
Cohesion: 0.38
Nodes (6): src_components_filter_select, FilterSelect(), choose(), keyboard(), show(), Option

### Community 93 - ".dp"
Cohesion: 0.23
Nodes (6): BonusCardActivity, Override, Row, Ui, android.widget.LinearLayout, android.widget.TextView

### Community 94 - "make-app-icons.mjs"
Cohesion: 0.15
Nodes (13): ref_node_fs_promises, androidDir, circle(), DENSITIES, glyph(), iconSet, root, splashSet (+5 more)

### Community 96 - "route-helpers.ts"
Cohesion: 0.18
Nodes (17): ref_next_headers, GET(), POST(), CustomerSession, decodeNativeKey(), decodeSession(), encodeNativeKey(), encodeSession() (+9 more)

### Community 97 - "OfflineCatalogActivity.java"
Cohesion: 0.10
Nodes (19): android.os.Handler, android.util.LruCache, arraylist, bitmapfactory, editable, edittext, executors, executorservice (+11 more)

### Community 98 - "BonusCardActivity.java"
Cohesion: 0.12
Nodes (15): androidx.appcompat.app.AppCompatActivity, barcodeformat, bitmatrix, button, color, encodehinttype, enummap, errorcorrectionlevel (+7 more)

### Community 99 - "(entry)/layout.tsx"
Cohesion: 0.24
Nodes (4): metadata, src_app_globals, src_app_light_lemon, NotFoundMessage()

### Community 100 - "local.ts"
Cohesion: 0.11
Nodes (31): CustomerBrief, storeFacts(), allOutSay, Answer, bonusText(), dayText(), foundSay, helloText() (+23 more)

### Community 101 - "ProductArt.tsx"
Cohesion: 0.06
Nodes (36): ART_BY_CATEGORY, BRAND_ALIASES, cleanName(), detectBrand(), KNOWN_BRANDS, OneCCatalog, OneCItem, productFromOneC() (+28 more)

### Community 102 - "OfflineCatalogActivity"
Cohesion: 0.29
Nodes (4): Item, OfflineCatalogActivity, android.view.View, org.json.JSONArray

### Community 103 - "currentSession"
Cohesion: 0.24
Nodes (11): POST(), DELETE(), GET(), currentSession(), endSession(), POST(), dynamic, GET() (+3 more)

### Community 104 - "I18nProvider.tsx"
Cohesion: 0.13
Nodes (16): react, A09 · P2 — Дизайн ҳужжати ва токенлар амалдаги бош баннердан ортда қолган, BrandLogo(), LOGOS, LogoSpec, frameUrl(), Hero3D(), src_components_home_story (+8 more)

### Community 105 - "sources/page.tsx"
Cohesion: 0.36
Nodes (5): metadata, SourcesPage(), PEXELS_LICENSE, PhotoSource, photoSources

### Community 106 - "check_installments.py"
Cohesion: 0.19
Nodes (10): getpass, json, os, main(), Проверка остатков по рассрочке перед выкатом — ничего не меняет и никуда не…, som(), onec_credentials(), Чтение настроек из .env.local в корне проекта — для программ 1С и сервера. Файл… (+2 more)

### Community 129 - "catalog.ts"
Cohesion: 0.31
Nodes (9): OfflineCatalogSync(), CapacitorGlobal, CatalogPlugin, markTried(), offlineCatalogState(), plugin(), showOfflineCatalog(), syncOfflineCatalog() (+1 more)

### Community 130 - "dictionaries.ts"
Cohesion: 0.43
Nodes (5): Dict, dictionaries, ky, ru, assertSameShape()

### Community 131 - "ExampleInstrumentedTest.java"
Cohesion: 0.24
Nodes (8): ExampleInstrumentedTest, ExampleUnitTest, androidx.test.ext.junit.runners.AndroidJUnit4, assert, context, instrumentationregistry, org.junit.runner.RunWith, org.junit.Test

### Community 132 - "deploy_cabinet_walogin.sh"
Cohesion: 0.83
Nodes (3): fail(), deploy_cabinet_walogin.sh script, step()

### Community 133 - "AssistantChat.tsx"
Cohesion: 0.10
Nodes (37): AboutPage(), metadata, src_components_assistant_chat, AssistantChat(), onKeyDown(), onPickFile(), send(), handoffText() (+29 more)

### Community 134 - "sync-catalog.mjs"
Cohesion: 0.25
Nodes (7): ref_node_url, apiUrl, CATALOG, fileEnv, log(), main(), ROOT

### Community 136 - "Adapter"
Cohesion: 0.27
Nodes (4): Adapter, Override, android.view.ViewGroup, android.widget.BaseAdapter

### Community 137 - "update-all.sh"
Cohesion: 0.83
Nodes (3): fail(), update-all.sh script, step()

### Community 150 - "errorResponse"
Cohesion: 0.31
Nodes (10): POST(), clientIp(), errorResponse(), startSession(), POST(), POST(), POST(), register() (+2 more)

### Community 151 - ".scene"
Cohesion: 0.12
Nodes (13): Capacitor, CAPBridgeViewController, MainViewController, SceneDelegate, UIScene, UISceneSession, UIWindow, NSUserActivity (+5 more)

### Community 152 - "digest.ts"
Cohesion: 0.27
Nodes (12): dynamic, POST(), bishkekDay(), CHANNEL, clip(), dailyDigest(), dedupe(), frequent() (+4 more)

### Community 153 - "process.cjs"
Cohesion: 0.12
Nodes (20): ref_fs, ref_path, backgroundColor(), BRANDS, fs, INK, main(), MANIFEST (+12 more)

### Community 154 - "build-appstore.sh"
Cohesion: 0.83
Nodes (3): fail(), build-appstore.sh script, step()

### Community 157 - "knowledge.ts"
Cohesion: 0.16
Nodes (19): budgetFrom(), cheaperThan(), NOT_UNIT, PATTERNS, THOUSAND, catalogForQuestion(), expand(), InstallmentBrief (+11 more)

### Community 159 - "android.os.Bundle"
Cohesion: 0.32
Nodes (6): Override, MainActivity, android.os.Bundle, com.getcapacitor.BridgeActivity, onbackpressedcallback, webview

### Community 161 - "reply.ts"
Cohesion: 0.14
Nodes (27): ref_server_only, productsFromOneC(), followUp, ChatTurn, dailyLimit(), day, dayBudgetLeft(), hits (+19 more)

### Community 166 - "gradlew"
Cohesion: 0.83
Nodes (3): gradlew script, die(), warn()

### Community 185 - "ref_node_fs"
Cohesion: 0.15
Nodes (8): widths, ref_node_assert_strict, ref_node_fs, assert, { chromium }, fs, SECRET, TOKEN

## Knowledge Gaps
- **367 isolated node(s):** `customer`, `phone`, `laptop`, `catalog`, `order` (+362 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 736 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **74 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `test` connect `package.json` to `manage.py`?**
  _High betweenness centrality (0.277) - this node is a cross-community bridge._
- **Why does `copy_base()` connect `manage.py` to `build_extension.py`, `package.json`?**
  _High betweenness centrality (0.276) - this node is a cross-community bridge._
- **Are the 17 inferred relationships involving `text()` (e.g. with `_notes()` and `save_notes()`) actually correct?**
  _`text()` has 17 INFERRED edges - model-reasoned connections that need verification._
- **What connects `customer`, `phone`, `laptop` to the rest of the system?**
  _367 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `build_model.py` be split into smaller, more focused modules?**
  _Cohesion score 0.10333333333333333 - nodes in this community are weakly interconnected._
- **Should `build_extension.py` be split into smaller, more focused modules?**
  _Cohesion score 0.10272536687631027 - nodes in this community are weakly interconnected._
- **Should `OfflineCatalogView` be split into smaller, more focused modules?**
  _Cohesion score 0.14623655913978495 - nodes in this community are weakly interconnected._