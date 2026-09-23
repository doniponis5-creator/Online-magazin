# Graph Report - Online-magazin  (2026-09-23)

## Corpus Check
- 350 files · ~4,973,676 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 58 file(s) not represented in the graph (top: .xml 13, .css 11, (none) 8)

## Summary
- 2718 nodes · 6572 edges · 202 communities (126 shown, 76 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 117 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `b43f4e99`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- kitchen/catalog.ts
- build_model.py
- build_extension.py
- isLang
- OfflineCatalogView
- App Store га топшириш — 8-қадам
- package.json
- AccountView.tsx
- layout.ts
- AppLockPlugin.java
- shop_customers.py
- customer/gateway.ts
- Текшириладиган рўйхат
- Icons.tsx
- CatalogView.tsx
- shop_push.py
- AppLockPlugin
- BonusCardView
- KitchenPlanner.tsx
- shop_admin.py
- spec.ts
- @playwright/test
- compilerOptions
- AppDelegate
- export_catalog.py
- telegram/order.ts
- sync-catalog.mjs
- TASK 03A Report — review closure and LG scene
- ProductReels.tsx
- TASK 04 Report — Blender Model of LG F4X5ES5SB
- Smart Centr Architecture (site, iOS, Android, 1C, SBonus)
- manage.py
- BonusCardPlugin
- Bonus Hold Mechanism
- Neutral Localized Photo Placeholder
- shop_installments_calc.py
- app/shop Module on the SBonus Server
- TASK 03 Brief — expressive storefront, photos, motion
- TODO_NEXT.md — What To Do Next
- reply.ts
- shop_router.py
- 1C Extension ИМ_ОнлайнМагазин
- IOS_APP_UZ.md — App Store Guide
- TASK 03 Report — Storefront Photos and Motion
- fetch-photos.mjs
- formatSom
- Smart Centr Project Working Rules
- 3. Устувор топилмалар
- Hero3D Pure-CSS LG Scroll Scene
- HANDOFF.md — What Is Already Built
- route-helpers.ts
- CatalogStore
- set_shop_domain.sh
- switch_to_shop_domain.sh
- install_site.sh
- Что сделано на MacBook 21.09.2026 — читать PC первым делом
- shop_wa_bot.py
- make-ios-icon.mjs
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
- KitchenEngine
- Смарт Центр — бош саҳифа янгиланиши
- MODEL_SOURCES — модель LG F4X5ES5SB (TASK 04, этап Blender)
- v7 — исправления модели и визуальная проверка
- Смарт Центр — аудит тузатишлари
- Home merchandising extension
- BRIEF.md
- SCROLL-PLAN.md
- DIRECTION.md
- products.ts
- ref_d
- SKILL.md
- setup-demo-login.sh
- config.ts
- pathlib
- Что сделано на PC 21.09.2026 — читать MacBook первым делом
- .scene
- fronts.ts
- useI18n
- .filled
- make-app-icons.mjs
- capacitor_swift
- (entry)/layout.tsx
- OfflineCatalogActivity.java
- orders/gateway.ts
- share.ts
- local.ts
- build.ts
- text
- scripts
- Product
- bot.ts
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
- native/catalog.ts
- BonusCardPlugin.java
- ExampleInstrumentedTest.java
- deploy_cabinet_walogin.sh
- currentSession
- dictionaries.ts
- BonusCardActivity.java
- Adapter
- update-all.sh
- install-on-iphone.sh
- textures.ts
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
- CartProvider.tsx
- assistant/route.ts
- log.ts
- process.cjs
- build-appstore.sh
- telegram-webhook.sh
- orders/order.ts
- checks.ts
- importlib_util
- android.os.Bundle
- kitchen/page.tsx
- argparse
- robots.ts
- engine.ts
- next.config.ts
- ref_server_only
- gradlew
- android-keystore.sh
- deploy_cabinet_client.sh
- bs4
- knowledge.ts
- concurrent_futures
- html
- dependencies
- whatsapp/route.ts
- privacy.ts
- com.getcapacitor.PluginCall
- android.content.Context
- compare_model.py
- ref_node_fs
- Capacitor
- io
- android.graphics.Bitmap
- ref_node_assert
- FilterSelect.tsx
- requests
- urllib3
- urllib_parse
- shop_models.py
- errorResponse
- OfflineCatalogActivity
- urllib_request
- devDependencies
- check_installments.py
- sources/page.tsx
- [lang]/layout.tsx

## God Nodes (most connected - your core abstractions)
1. `useI18n()` - 80 edges
2. `KitchenEngine` - 58 edges
3. `KitchenPlanner()` - 55 edges
4. `three` - 47 edges
5. `formatSom()` - 45 edges
6. `mesh()` - 36 edges
7. `react` - 36 edges
8. `handleUpdate()` - 32 edges
9. `text()` - 31 edges
10. `base()` - 31 edges

## Surprising Connections (you probably didn't know these)
- `Для PC: кабинет SBonus тоже шлёт код через Green API` --references--> `_scan_wa_logins()`  [INFERRED]
  docs/MAC_2026-09-21.md → integrations/sbonus-server/shop/shop_customers.py
- `window.imExport — JPEG data URL Export Bridge` --semantically_similar_to--> `window.Capacitor.Plugins.BonusCard Bridge`  [INFERRED] [semantically similar]
  integrations/1c-online-shop/src/РедакторФото.html → ios-web/index.html
- `Bonus Hold Mechanism` --semantically_similar_to--> `normalizeLines Cart Restoration Guard`  [INFERRED] [semantically similar]
  ARCHITECTURE_UZ.md → TASK_02_REPORT.md
- `Smart Centr Project Working Rules` --semantically_similar_to--> `Owner's Work Standard (verify visually, no self-scoring)`  [INFERRED] [semantically similar]
  CLAUDE.md → TASK_03A_REVIEW_FIXES.md
- `A11 · P2 — Қирғизча HTML дастлаб рус тили деб белгиланган` --references--> `HtmlLang()`  [INFERRED]
  review/audit-20260915/AUDIT_UZ.md → src/components/HtmlLang.tsx

## Import Cycles
- None detected.

## Communities (202 total, 76 thin omitted)

### Community 0 - "kitchen/catalog.ts"
Cohesion: 0.15
Nodes (18): applianceFromProduct(), defaultPick(), find(), FINISH_WORDS, finishOf(), fridgeKind(), hobKind(), hoodKind() (+10 more)

### Community 1 - "build_model.py"
Cohesion: 0.12
Nodes (11): area(), box(), camera(), digit(), look_at(), LG F4X5ES5SB — внешняя модель по официальным фото, не заводской CAD. blender…, weighted(), TASK_05: последовательность поворота LG F4X5ES5SB (¾ → фронт → ¾). Загружает… (+3 more)

### Community 2 - "build_extension.py"
Cohesion: 0.10
Nodes (37): build_adopted(), build_common_module(), build_configuration(), build_module(), build_processor(), build_register(), build_registers(), build_role() (+29 more)

### Community 3 - "isLang"
Cohesion: 0.21
Nodes (11): next, generateMetadata(), generateMetadata(), generateMetadata(), generateMetadata(), generateMetadata(), generateMetadata(), SourcesPage() (+3 more)

### Community 4 - "OfflineCatalogView"
Cohesion: 0.13
Nodes (25): Codable, Equatable, Identifiable, Int, CatalogBrand, CatalogCategory, CatalogItem, .inStock (+17 more)

### Community 5 - "App Store га топшириш — 8-қадам"
Cohesion: 0.17
Nodes (11): 1. Сайт ва сервер чиқарилсин, 2. Демо-кириш ёқилсин, 3. Apple калити жанговар режимга, App Store га топшириш — 8-қадам, Жанговар йиғилишни қандай қилиш, «Маълумотлар ёрлиғи» — App Store Connect даги жавоблар, Рад этилса, Сиздан керак — Apple сўрайдиган матнлар (+3 more)

### Community 6 - "package.json"
Cohesion: 0.11
Nodes (16): config, description, name, private, version, @capacitor/android, @capacitor/cli, @capacitor/core (+8 more)

### Community 7 - "AccountView.tsx"
Cohesion: 0.12
Nodes (30): src_components_account, AccountView(), formatDate(), useCustomer(), src_components_home_merchandising, CustomerProfile, AppLockPlugin, CapacitorGlobal (+22 more)

### Community 8 - "layout.ts"
Cohesion: 0.06
Nodes (60): Dropped(), commitPinned(), FILL, PlanSketch(), Props, ALL_WALLS, allowedOn(), canChangeWall() (+52 more)

### Community 9 - "AppLockPlugin.java"
Cohesion: 0.10
Nodes (22): android.content.SharedPreferences, base64, biometricmanager, biometricprompt, build, cipher, contextcompat, gcmparameterspec (+14 more)

### Community 10 - "shop_customers.py"
Cohesion: 0.12
Nodes (44): BonusAccount, Decimal, _account(), branch_id(), _code_hash(), _customer(), get_profile(), _logged_in() (+36 more)

### Community 11 - "customer/gateway.ts"
Cohesion: 0.11
Nodes (22): POST(), BonusHistoryItem, call(), CodeChannel, CustomerApiError, CustomerOrderItem, DEMO_BALANCE, DEMO_CODE (+14 more)

### Community 12 - "Текшириладиган рўйхат"
Cohesion: 0.12
Nodes (16): 1. Илова очилиши, 2. Кириш, 3. Бонус картаси, 4. ⚠ Кассадаги сканер — энг муҳим текширув, 5. Face ID, 6. Push хабарлар, 7. Иловани ёпиб, қайта очиш, 8. Каталог интернетсиз (+8 more)

### Community 13 - "Icons.tsx"
Cohesion: 0.10
Nodes (40): ref_next_link, react, Cached, Brand(), BrandMark(), frameUrl(), Hero3D(), src_components_home_story (+32 more)

### Community 14 - "CatalogView.tsx"
Cohesion: 0.17
Nodes (16): metadata, src_components_catalog_filters, Badge, BADGES, CatalogView(), CatalogViewInner(), inStock(), normalize() (+8 more)

### Community 15 - "shop_push.py"
Cohesion: 0.10
Nodes (34): app_payments, httpx, _b64(), _bundle(), _devices(), _drop(), enabled(), _fail() (+26 more)

### Community 16 - "AppLockPlugin"
Cohesion: 0.14
Nodes (11): Foundation, AppLockPlugin, AppLockStore, .base, Any, Bool, CAPPluginCall, CAPPluginMethod (+3 more)

### Community 17 - "BonusCardView"
Cohesion: 0.12
Nodes (19): CoreImage.CIFilterBuiltins, Double, Image, BonusCardData, BonusCardStore, .query, BonusCardView, .body (+11 more)

### Community 18 - "KitchenPlanner.tsx"
Cohesion: 0.05
Nodes (38): DRAWING_CSS, src_components_kitchen_kitchen, colorSwatch(), CORE, fmt(), hasWebGL(), iconProps, isStacked() (+30 more)

### Community 19 - "shop_admin.py"
Cohesion: 0.09
Nodes (46): app_models, AsyncClient, Интернет-магазин Smart Centr: заказы с сайта (O!Деньги → 1С)., account_delete(), AccountDelete, _as_list(), _attention(), _clean() (+38 more)

### Community 20 - "spec.ts"
Cohesion: 0.08
Nodes (37): appliance(), CARCASS, DrawingLabels, elevationSvg(), esc(), fmt(), front(), n() (+29 more)

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

### Community 25 - "telegram/order.ts"
Cohesion: 0.15
Nodes (25): followUp, lookupIn(), salesCatalogNow(), ASK_ADDRESS, ASK_NAME, ASK_PHONE, ASK_PICK, ASK_WHERE (+17 more)

### Community 26 - "sync-catalog.mjs"
Cohesion: 0.25
Nodes (7): ref_node_url, apiUrl, CATALOG, fileEnv, log(), main(), ROOT

### Community 27 - "TASK 03A Report — review closure and LG scene"
Cohesion: 0.27
Nodes (14): Archived Pexels Category Photo Set, Asset Sources Contract (no active product photos), photo-sources.ts Canonical Machine List, LG F4X5ES5SB 3D Scroll Scene Brief, TASK 03A Brief — close design review, MotionProvider Empty-Deps and Reveal Cascade Defect, Photo Source Reconciliation Audit, ProductImage Always Uses altRu Defect (+6 more)

### Community 28 - "ProductReels.tsx"
Cohesion: 0.10
Nodes (26): FavoritesPage(), generateMetadata(), ProductPage(), AddToCartButton(), BottomNav(), FavoriteButton(), HeaderInner(), src_components_product_reels (+18 more)

### Community 29 - "TASK 04 Report — Blender Model of LG F4X5ES5SB"
Cohesion: 0.27
Nodes (9): TASK 04 Brief — Realistic LG Frames, LG F4X5ES5SB Washing Machine, Do Not Pass Photos or AI Images as Rendered Model, Single Editable 3D Source Rule, TASK 04 Report — Blender Model of LG F4X5ES5SB, build_model.py Procedural Blender Scene, Empty Contact Sheet Caused by Opaque SVG Overlay, Fixes in Script, Never by Transforming Final PNGs (+1 more)

### Community 30 - "Smart Centr Architecture (site, iOS, Android, 1C, SBonus)"
Cohesion: 0.19
Nodes (13): Mobile Path Decision (Capacitor shell vs full native), Security, Privacy and Recovery Plan, Smart Centr Architecture (site, iOS, Android, 1C, SBonus), Unified Client API, Product Principles (honest demo vs confirmed data), Smart Centr Product Definition, Demo Boundaries (no real 1C/SBonus/payments), Storefront Prototype README (milestone 01/02) (+5 more)

### Community 31 - "manage.py"
Cohesion: 0.20
Nodes (17): ask_credentials(), _configure(), configure_extension(), copy_base(), designer(), _detect(), detect_variant(), install() (+9 more)

### Community 32 - "BonusCardPlugin"
Cohesion: 0.27
Nodes (5): CGFloat, BonusCardPlugin, CAPPluginCall, CAPPluginMethod, UIViewController

### Community 33 - "Bonus Hold Mechanism"
Cohesion: 0.22
Nodes (11): Extended Admin Workspace, Bonus Hold Mechanism, Pickup and Staff-Coordinated Taxi Delivery, Persistent Exchange Queue (outbox/inbox), Pre-Launch Acceptance Tests (15 scenarios), Night / 1C-Offline Order Mode, O!Dengi Payment Verification, 1C Standard Reservation Mechanism (+3 more)

### Community 34 - "Neutral Localized Photo Placeholder"
Cohesion: 0.22
Nodes (11): Approved Blue + Lime Palette (variant 01), Neutral Localized Photo Placeholder, White-Lemon-Cobalt Color Tokens, The Compact Commerce Rule, The Honest Status Rule, The Lemon Signal Rule, Manrope Typography Scale, The One-Family Rule (Manrope only) (+3 more)

### Community 35 - "shop_installments_calc.py"
Cohesion: 0.16
Nodes (18): collections, date, build_rows(), _day(), _money(), _one_phone(), parse_phones(), _purchase() (+10 more)

### Community 36 - "app/shop Module on the SBonus Server"
Cohesion: 0.16
Nodes (14): Site docker-compose Project (smartcentr-site), Separate Compose Project So SBonus Containers Are Untouched, site service → container smartcentr_site on 127.0.0.1:18820, deploy_shop.sh — Backup, Trial Import, Auto-Rollback, Панель сайта — Site Control Panel inside 1C, app/shop Module on the SBonus Server, Three-Part Architecture (site · SBonus server · 1C), APNs Push Notifications (shop_push.py, .p8 key) (+6 more)

### Community 37 - "TASK 03 Brief — expressive storefront, photos, motion"
Cohesion: 0.27
Nodes (10): The Flat-First Rule, Repository Structure Map, P0 Defect List (language, catalog, cart, variants), buildLangHref Language Switch Fix, comboVariant Single SKU Source, normalizeLines Cart Restoration Guard, URL as Single Source of Catalog State, TASK 03 Brief — expressive storefront, photos, motion (+2 more)

### Community 38 - "TODO_NEXT.md — What To Do Next"
Cohesion: 0.28
Nodes (9): SBonus Bonus Flow on the Site, Apple Guideline 4.2 — Repackaged Website Rejection, Path B — Capacitor Shell Plus Real Native Capabilities, TODO_NEXT.md — What To Do Next, SBonus BonusService earn/spend Semantics, Mixed+ iOS 26 Liquid Glass Plan, Owner Decisions (login, welcome bonus, site bonus cap), SBonus Tier Threshold Anomaly (Gold < Silver, two Platinum) (+1 more)

### Community 39 - "reply.ts"
Cohesion: 0.14
Nodes (19): budgetFrom(), cheaperThan(), NOT_UNIT, PATTERNS, THOUSAND, productName(), toHit(), parseAnswer() (+11 more)

### Community 40 - "shop_router.py"
Cohesion: 0.08
Nodes (55): api_route, app_core_config, Base, fastapi_responses, Сколько клиент платит деньгами (для старых заказов без бонусов — total)., Для страницы заказа на сайте: без телефона и адреса., Для 1С: всё, что нужно для Заказа клиента, ПКО и Реализации., ShopOrder (+47 more)

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

### Community 45 - "formatSom"
Cohesion: 0.11
Nodes (25): CartPage(), CheckoutPage(), FieldErrors, OrderView(), BonusReminder(), CustomerLogin(), Step, askText() (+17 more)

### Community 46 - "Smart Centr Project Working Rules"
Cohesion: 0.25
Nodes (8): Next.js Agent Rules Block, Installment Eligibility Flag (existing SBonus clients only), Phone + One-Time Code Login, Smart Centr Project Working Rules, Secrets Boundary (never type owner's credentials), Live System Overview (site, SBonus server, 1C UT 11.5), Telegram Gateway Login Code with WhatsApp Fallback, Owner's Work Standard (verify visually, no self-scoring)

### Community 47 - "3. Устувор топилмалар"
Cohesion: 0.10
Nodes (19): 1. Реализация яхлитлиги: ўтмади, 2. Умумий баҳо — 11/20, 3. Устувор топилмалар, 4. Детектор натижасини қандай талқин қилдим, 5. Яхши ишланган қисмлар, 6. Текширув ҳажми ва чегаралари, 7. Кейинги ишлар тартиби, A01 · P0 — 768–900 px экранда саватга ўтиш йўқолади (+11 more)

### Community 48 - "Hero3D Pure-CSS LG Scroll Scene"
Cohesion: 0.43
Nodes (7): HomeStory Scroll Scene («the house wakes up»), Reduce/No-JS/No-WebGL Static Fallback Policy, Inverter Direct Drive Schematic View, Four Scroll-Progress Phases (0-20/20-55/55-80/80-100%), TurboWash360 Four-Direction Water Flow, Hero3D Pure-CSS LG Scroll Scene, next/image Stale-Cache Root Cause (same URL, new bytes)

### Community 49 - "HANDOFF.md — What Is Already Built"
Cohesion: 0.29
Nodes (8): HANDOFF.md — What Is Already Built, Known Issue — Only 1-2 Products Reach the Server Catalog, paymentMode() live vs mock Fallback, Assistant Never Types the Owner's Secrets, Wikimedia Brand Logo Sources and Licenses, Smart Centr Brand Logo Provenance, Manrope SIL Open Font License 1.1, ASSET_SOURCES.md Photo Licensing Ledger

### Community 50 - "route-helpers.ts"
Cohesion: 0.17
Nodes (18): ref_next_headers, GET(), POST(), maxBonusSpend(), CustomerSession, decodeNativeKey(), decodeSession(), encodeNativeKey() (+10 more)

### Community 51 - "CatalogStore"
Cohesion: 0.16
Nodes (10): CAPBridgedPlugin, CAPPlugin, CatalogStore, .file, .folder, .updatedAt, OfflineCatalogPlugin, CAPPluginCall (+2 more)

### Community 52 - "set_shop_domain.sh"
Cohesion: 0.53
Nodes (4): fail(), restore_nginx(), set_shop_domain.sh script, step()

### Community 53 - "switch_to_shop_domain.sh"
Cohesion: 0.53
Nodes (4): fail(), restore_nginx(), switch_to_shop_domain.sh script, step()

### Community 54 - "install_site.sh"
Cohesion: 0.70
Nodes (4): fail(), restore_nginx(), install_site.sh script, step()

### Community 55 - "Что сделано на MacBook 21.09.2026 — читать PC первым делом"
Cohesion: 0.20
Nodes (9): Бонус виден покупателю, Вход через WhatsApp «наоборот» (главное за вечер), Для PC (1С): 1 000 сом — тратить целиком, Для PC: кабинет SBonus тоже шлёт код через Green API, Кому адресовано (WhatsApp) — 22.09, Проверить после выкатки (PC), Что сделано на MacBook 21.09.2026 — читать PC первым делом, _own_wa_number() (+1 more)

### Community 56 - "shop_wa_bot.py"
Cohesion: 0.08
Nodes (49): app_core_redis, asyncio, Консультант, hashlib, hmac, Прочитать свежие входящие WhatsApp и отметить коды входа, которые прислали…, _scan_wa_logins(), _site_base_url() (+41 more)

### Community 57 - "make-ios-icon.mjs"
Cohesion: 0.20
Nodes (9): glyph(), ICON_YELLOW, iconSet, iconSource, INK, mark, root, splash() (+1 more)

### Community 58 - "Data Ownership Matrix (source of truth per entity)"
Cohesion: 0.50
Nodes (4): Data Ownership Matrix (source of truth per entity), Technical Data Contract (entity fields), Photo Request for Future 1C Catalog, Post-Acceptance Roadmap (contracts → 1C → SBonus → payments → mobile)

### Community 59 - "update_site.sh"
Cohesion: 0.83
Nodes (3): fail(), update_site.sh script, step()

### Community 74 - "KitchenEngine"
Cohesion: 0.09
Nodes (3): buildKitchen(), easeInOut(), KitchenEngine

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

### Community 83 - "products.ts"
Cohesion: 0.06
Nodes (34): ref_next_image, DevGalleryFixturePage(), HomePage(), Gallery(), PinchZoom(), ProductDetail(), src_data_1c_catalog, Category (+26 more)

### Community 85 - "SKILL.md"
Cohesion: 0.25
Nodes (7): Выключение, Где caveman выключается сам, Правила сжатия, Уровни, Что остаётся обычным текстом, Язык — главное правило, Ясность важнее краткости

### Community 87 - "config.ts"
Cohesion: 0.27
Nodes (4): Lang, languages, otherLang, buildLangHref()

### Community 88 - "pathlib"
Cohesion: 0.18
Nodes (8): Кабинет SBonus (cabinet.smartcentr.store): вход через WhatsApp «наоборот».…, Кабинет SBonus — страница входа: форма «код по номеру» свёрнута. После…, main(), patch(), Кабинет SBonus — страница входа: кнопка «Войти через WhatsApp». Правит…, Path, pathlib, sys

### Community 89 - "Что сделано на PC 21.09.2026 — читать MacBook первым делом"
Cohesion: 0.29
Nodes (6): WhatsApp-продавец (новое, проверено вживую), Ждёт завтра (PC, 1С), Прочее, ⚠ Сначала — о чужих файлах, Что работает (выкачено), Что сделано на PC 21.09.2026 — читать MacBook первым делом

### Community 90 - ".scene"
Cohesion: 0.22
Nodes (7): CAPBridgeViewController, MainViewController, UIScene, UISceneSession, NSUserActivity, Set, UIOpenURLContext

### Community 91 - "fronts.ts"
Cohesion: 0.17
Nodes (14): allowed(), BASE_FRONTS, BY_CODE, CODE, DRAWER_PARTS, frontsFromQuery(), frontsToQuery(), isUpperKey() (+6 more)

### Community 92 - "useI18n"
Cohesion: 0.10
Nodes (37): A09 · P2 — Дизайн ҳужжати ва токенлар амалдаги бош баннердан ортда қолган, CategoryTiles(), InfoStrip(), NightBanner(), ProductSection(), BrandLogo(), hasBrandImage(), LOGOS (+29 more)

### Community 93 - ".filled"
Cohesion: 0.19
Nodes (7): BonusCardActivity, Override, Row, Ui, android.graphics.drawable.GradientDrawable, android.widget.LinearLayout, android.widget.TextView

### Community 94 - "make-app-icons.mjs"
Cohesion: 0.09
Nodes (20): ref_node_fs_promises, ref_node_path, sharp, ref_vitest_config, files, variants, { chromium }, path (+12 more)

### Community 96 - "(entry)/layout.tsx"
Cohesion: 0.24
Nodes (4): metadata, src_app_globals, src_app_light_lemon, NotFoundMessage()

### Community 97 - "OfflineCatalogActivity.java"
Cohesion: 0.11
Nodes (18): android.os.Handler, android.util.LruCache, arraylist, bitmapfactory, editable, edittext, executors, executorservice (+10 more)

### Community 98 - "orders/gateway.ts"
Cohesion: 0.18
Nodes (16): ref_next_server, POST(), GET(), mockSpend(), API_URL, callServer(), CreateResult, getOrder() (+8 more)

### Community 99 - "share.ts"
Cohesion: 0.06
Nodes (57): src_components_kitchen_kitchen_promo, SizeField(), KitchenPromo(), FinishLook, RoomLook, FRONT_COLORS, FRONT_MATERIALS, frontColor (+49 more)

### Community 100 - "local.ts"
Cohesion: 0.07
Nodes (48): fromJson(), withoutIds(), catalogForQuestion(), expand(), isInStock(), productLine(), promoMarks(), searchProducts() (+40 more)

### Community 101 - "build.ts"
Cohesion: 0.07
Nodes (99): three, three, ref_three_addons_geometries_roundedboxgeometry_js, ref_three_addons_utils_buffergeometryutils_js, chimneyHood(), cm(), dishwasherInside(), faucet() (+91 more)

### Community 103 - "text"
Cohesion: 0.13
Nodes (31): app_core_database, datetime, fastapi, text(), _as_jpeg(), chat_extra_items(), photos_index(), public_photo() (+23 more)

### Community 104 - "scripts"
Cohesion: 0.25
Nodes (8): scripts, build, dev, exam, start, test, test:e2e, typecheck

### Community 105 - "Product"
Cohesion: 0.15
Nodes (22): vitest, dynamic, GET(), dynamic, GET(), productsFromOneC(), Product, products (+14 more)

### Community 106 - "bot.ts"
Cohesion: 0.08
Nodes (50): dynamic, POST(), CustomerBrief, ProductHit, ASK_PHONE, BAD_PHONE, CALL_INTENT, cancelLead() (+42 more)

### Community 129 - "native/catalog.ts"
Cohesion: 0.31
Nodes (9): OfflineCatalogSync(), CapacitorGlobal, CatalogPlugin, markTried(), offlineCatalogState(), plugin(), showOfflineCatalog(), syncOfflineCatalog() (+1 more)

### Community 130 - "BonusCardPlugin.java"
Cohesion: 0.13
Nodes (16): com.getcapacitor.annotation.CapacitorPlugin, com.getcapacitor.Plugin, decimalformat, decimalformatsymbols, file, fileinputstream, fileoutputstream, insets (+8 more)

### Community 131 - "ExampleInstrumentedTest.java"
Cohesion: 0.24
Nodes (8): ExampleInstrumentedTest, ExampleUnitTest, androidx.test.ext.junit.runners.AndroidJUnit4, assert, context, instrumentationregistry, org.junit.runner.RunWith, org.junit.Test

### Community 132 - "deploy_cabinet_walogin.sh"
Cohesion: 0.83
Nodes (3): fail(), deploy_cabinet_walogin.sh script, step()

### Community 133 - "currentSession"
Cohesion: 0.48
Nodes (5): POST(), currentSession(), POST(), deleteAccount(), registerPushDevice()

### Community 134 - "dictionaries.ts"
Cohesion: 0.43
Nodes (5): Dict, dictionaries, ky, ru, assertSameShape()

### Community 135 - "BonusCardActivity.java"
Cohesion: 0.12
Nodes (15): androidx.appcompat.app.AppCompatActivity, barcodeformat, bitmatrix, button, color, encodehinttype, enummap, errorcorrectionlevel (+7 more)

### Community 136 - "Adapter"
Cohesion: 0.27
Nodes (4): Adapter, Override, android.view.ViewGroup, android.widget.BaseAdapter

### Community 137 - "update-all.sh"
Cohesion: 0.83
Nodes (3): fail(), update-all.sh script, step()

### Community 139 - "textures.ts"
Cohesion: 0.23
Nodes (29): brick(), cache, canvas(), clear(), concrete(), Entry, finish(), floorTile() (+21 more)

### Community 150 - "CartProvider.tsx"
Cohesion: 0.10
Nodes (35): ART_BY_CATEGORY, BRAND_ALIASES, cleanName(), detectBrand(), KNOWN_BRANDS, OneCCatalog, OneCItem, productFromOneC() (+27 more)

### Community 151 - "assistant/route.ts"
Cohesion: 0.10
Nodes (24): ref_node_crypto, dynamic, ipOf(), POST(), readImage(), seen, tooOften(), dynamic (+16 more)

### Community 152 - "log.ts"
Cohesion: 0.17
Nodes (17): dynamic, POST(), bishkekDay(), CHANNEL, clip(), dailyDigest(), dedupe(), frequent() (+9 more)

### Community 153 - "process.cjs"
Cohesion: 0.12
Nodes (22): ref_fs, ref_path, backgroundColor(), BRANDS, firstBand(), fs, INK, main() (+14 more)

### Community 154 - "build-appstore.sh"
Cohesion: 0.83
Nodes (3): fail(), build-appstore.sh script, step()

### Community 156 - "orders/order.ts"
Cohesion: 0.21
Nodes (12): POST(), createOrder(), applyBonus(), DeliveryMethod, deliveryPriceFor(), OrderError, OrderLine, OrderRequest (+4 more)

### Community 157 - "checks.ts"
Cohesion: 0.20
Nodes (15): Check, CheckLevel, checkProject(), counterBeside(), dist(), find(), Found, front() (+7 more)

### Community 159 - "android.os.Bundle"
Cohesion: 0.32
Nodes (6): Override, MainActivity, android.os.Bundle, com.getcapacitor.BridgeActivity, onbackpressedcallback, webview

### Community 160 - "kitchen/page.tsx"
Cohesion: 0.47
Nodes (5): generateMetadata(), KitchenPage(), META, kitchenAppliances(), canonical()

### Community 162 - "robots.ts"
Cohesion: 0.33
Nodes (4): ALLOW, ASSISTANTS, PRIVATE, TRAINERS

### Community 163 - "engine.ts"
Cohesion: 0.08
Nodes (26): ref_three_addons_controls_orbitcontrols_js, ref_three_addons_environments_roomenvironment_js, ref_three_addons_lights_rectarealightuniformslib_js, ref_three_addons_postprocessing_effectcomposer_js, ref_three_addons_postprocessing_gtaopass_js, ref_three_addons_postprocessing_outputpass_js, ref_three_addons_postprocessing_renderpass_js, ref_three_addons_postprocessing_shaderpass_js (+18 more)

### Community 165 - "ref_server_only"
Cohesion: 0.18
Nodes (12): ref_server_only, cache, Entry, GET(), reply(), dailyLimit(), day, dayBudgetLeft() (+4 more)

### Community 166 - "gradlew"
Cohesion: 0.83
Nodes (3): gradlew script, die(), warn()

### Community 172 - "deploy_cabinet_client.sh"
Cohesion: 0.83
Nodes (3): fail(), restore(), deploy_cabinet_client.sh script

### Community 176 - "knowledge.ts"
Cohesion: 0.08
Nodes (40): AboutPage(), metadata, src_components_assistant_chat, AssistantChat(), onKeyDown(), onPickFile(), send(), handoffText() (+32 more)

### Community 179 - "dependencies"
Cohesion: 0.22
Nodes (9): dependencies, @capacitor/android, @capacitor/cli, @capacitor/core, @capacitor/ios, @capacitor/push-notifications, next, react (+1 more)

### Community 180 - "whatsapp/route.ts"
Cohesion: 0.22
Nodes (12): dynamic, POST(), DELETE(), GET(), endSession(), dynamic, GET(), customerBrief() (+4 more)

### Community 181 - "privacy.ts"
Cohesion: 0.25
Nodes (9): metadata, PrivacyPage(), getPrivacy(), PRIVACY_UPDATED, PrivacyContent, privacyKy, privacyRu, PrivacySection (+1 more)

### Community 182 - "com.getcapacitor.PluginCall"
Cohesion: 0.18
Nodes (6): AppLockPlugin, BonusCardPlugin, OfflineCatalogPlugin, com.getcapacitor.PluginCall, com.getcapacitor.PluginMethod, java.security.PublicKey

### Community 183 - "android.content.Context"
Cohesion: 0.24
Nodes (6): Store, Store, Vault, android.content.Context, javax.crypto.SecretKey, org.json.JSONObject

### Community 184 - "compare_model.py"
Cohesion: 0.33
Nodes (3): Листы проверки: только кадрирование/одинаковая высота, без ретуши модели., pil, shutil

### Community 185 - "ref_node_fs"
Cohesion: 0.13
Nodes (9): widths, ref_node_assert_strict, ref_node_fs, assert, { chromium }, fs, SECRET, TOKEN (+1 more)

### Community 186 - "Capacitor"
Cohesion: 0.29
Nodes (6): Capacitor, SceneDelegate, UIWindow, UIKit, UIResponder, UIWindowSceneDelegate

### Community 190 - "FilterSelect.tsx"
Cohesion: 0.38
Nodes (6): src_components_filter_select, FilterSelect(), choose(), keyboard(), show(), Option

### Community 194 - "shop_models.py"
Cohesion: 0.33
Nodes (5): Интернет-магазин Smart Centr — заказы с сайта (SQLAlchemy). Один заказ сайта =…, sqlalchemy, sqlalchemy_dialects_postgresql, sqlalchemy_orm, uuid

### Community 195 - "errorResponse"
Cohesion: 0.25
Nodes (13): POST(), clientIp(), errorResponse(), startSession(), POST(), POST(), POST(), POST() (+5 more)

### Community 196 - "OfflineCatalogActivity"
Cohesion: 0.37
Nodes (3): Item, OfflineCatalogActivity, android.view.View

### Community 198 - "devDependencies"
Cohesion: 0.22
Nodes (9): devDependencies, @playwright/test, sharp, @types/node, @types/react, @types/react-dom, @types/three, typescript (+1 more)

### Community 205 - "check_installments.py"
Cohesion: 0.21
Nodes (9): getpass, os, main(), Проверка остатков по рассрочке перед выкатом — ничего не меняет и никуда не…, som(), onec_credentials(), Чтение настроек из .env.local в корне проекта — для программ 1С и сервера. Файл…, Пользователь и пароль 1С: из .env.local (ONEC_USER, ONEC_PASSWORD) или вопросом… (+1 more)

### Community 207 - "sources/page.tsx"
Cohesion: 0.43
Nodes (4): metadata, PEXELS_LICENSE, PhotoSource, photoSources

### Community 235 - "[lang]/layout.tsx"
Cohesion: 0.17
Nodes (13): ref_next_navigation, LangLayout(), viewport, CartReminder(), Header(), MotionProvider(), VisitCounter(), visitorId() (+5 more)

## Knowledge Gaps
- **468 isolated node(s):** `Step`, `STEPS`, `SHAPES`, `CORE`, `OPTIONAL` (+463 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 879 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **76 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `scripts` connect `scripts` to `package.json`?**
  _High betweenness centrality (0.333) - this node is a cross-community bridge._
- **Why does `test` connect `scripts` to `manage.py`?**
  _High betweenness centrality (0.325) - this node is a cross-community bridge._
- **Why does `copy_base()` connect `manage.py` to `scripts`, `build_extension.py`?**
  _High betweenness centrality (0.325) - this node is a cross-community bridge._
- **What connects `Step`, `STEPS`, `SHAPES` to the rest of the system?**
  _468 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `build_model.py` be split into smaller, more focused modules?**
  _Cohesion score 0.12380952380952381 - nodes in this community are weakly interconnected._
- **Should `build_extension.py` be split into smaller, more focused modules?**
  _Cohesion score 0.0965166908563135 - nodes in this community are weakly interconnected._
- **Should `OfflineCatalogView` be split into smaller, more focused modules?**
  _Cohesion score 0.13068181818181818 - nodes in this community are weakly interconnected._