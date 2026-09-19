# Graph Report - Online-magazin  (2026-09-19)

## Corpus Check
- 216 files · ~4,477,978 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 34 file(s) not represented in the graph (top: .bsl 7, .css 7, (none) 6)

## Summary
- 1396 nodes · 2873 edges · 131 communities (73 shown, 58 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 82 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `93b019e1`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- customer/gateway.ts
- build_model.py
- build_extension.py
- [lang]/layout.tsx
- OfflineCatalogView
- useI18n
- package.json
- AccountView.tsx
- shop_catalog.py
- I18nProvider.tsx
- shop_customers.py
- shop_router.py
- Текшириладиган рўйхат
- Icons.tsx
- CatalogView.tsx
- shop_push.py
- AppLockPlugin
- BonusCardView
- CartProvider.tsx
- shop_admin.py
- ProductArt.tsx
- @playwright/test
- compilerOptions
- AppDelegate
- corefoundation
- adapter.ts
- process.cjs
- TASK 03A Report — review closure and LG scene
- .money_amount
- TASK 04 Report — Blender Model of LG F4X5ES5SB
- Smart Centr Architecture (site, iOS, Android, 1C, SBonus)
- .scene
- BonusCardPlugin
- Bonus Hold Mechanism
- Neutral Localized Photo Placeholder
- build-lg-series.mjs
- app/shop Module on the SBonus Server
- TASK 03 Brief — expressive storefront, photos, motion
- TODO_NEXT.md — What To Do Next
- sync-catalog.mjs
- catalog.ts
- 1C Extension ИМ_ОнлайнМагазин
- IOS_APP_UZ.md — App Store Guide
- TASK 03 Report — Storefront Photos and Motion
- fetch-photos.mjs
- make-ios-icon.mjs
- Smart Centr Project Working Rules
- 3. Устувор топилмалар
- Hero3D Pure-CSS LG Scroll Scene
- HANDOFF.md — What Is Already Built
- Any
- OfflineCatalogPlugin
- set_shop_domain.sh
- switch_to_shop_domain.sh
- install_site.sh
- Bool
- ref_node_path
- _post
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
- install-on-iphone.sh
- Смарт Центр — бош саҳифа янгиланиши
- MODEL_SOURCES — модель LG F4X5ES5SB (TASK 04, этап Blender)
- v7 — исправления модели и визуальная проверка
- Смарт Центр — аудит тузатишлари
- Home merchandising extension
- BRIEF.md
- SCROLL-PLAN.md
- DIRECTION.md
- Capacitor
- ref_d
- caveman/SKILL.md
- render-svg.cjs
- (entry)/layout.tsx
- ref_node_assert
- FilterSelect.tsx
- checkout/page.tsx
- products.ts
- react
- CatalogStore
- Data
- capacitor_swift
- update-all.sh
- cappluginmethod
- cdv
- cdvavailability
- cdvcommanddelegateimpl
- cdvinvokedurlcommand
- cdvplugin
- cdvplugin_resources
- cdvpluginmanager
- cdvpluginresult
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
- Footer.tsx
- photo-sources.ts
- capinstancedescriptor

## God Nodes (most connected - your core abstractions)
1. `useI18n()` - 56 edges
2. `react` - 25 edges
3. `base()` - 24 edges
4. `text()` - 23 edges
5. `Form` - 21 edges
6. `OfflineCatalogView` - 19 edges
7. `ShopOrder` - 18 edges
8. `getProduct()` - 18 edges
9. `AccountView()` - 17 edges
10. `site_create_order()` - 17 edges

## Surprising Connections (you probably didn't know these)
- `A11 · P2 — Қирғизча HTML дастлаб рус тили деб белгиланган` --references--> `HtmlLang()`  [INFERRED]
  review/audit-20260915/AUDIT_UZ.md → src/components/HtmlLang.tsx
- `window.imExport — JPEG data URL Export Bridge` --semantically_similar_to--> `window.Capacitor.Plugins.BonusCard Bridge`  [INFERRED] [semantically similar]
  integrations/1c-online-shop/src/РедакторФото.html → ios-web/index.html
- `normalizeLines Cart Restoration Guard` --semantically_similar_to--> `Bonus Hold Mechanism`  [INFERRED] [semantically similar]
  TASK_02_REPORT.md → ARCHITECTURE_UZ.md
- `Wikimedia Brand Logo Sources and Licenses` --semantically_similar_to--> `ASSET_SOURCES.md Photo Licensing Ledger`  [INFERRED] [semantically similar]
  public/Бренд лого/wikimedia/SOURCES.md → TASK_03_REPORT.md
- `Owner's Work Standard (verify visually, no self-scoring)` --semantically_similar_to--> `Smart Centr Project Working Rules`  [INFERRED] [semantically similar]
  TASK_03A_REVIEW_FIXES.md → CLAUDE.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Bonus Integrity Chain (audit → hold → bank confirm → acceptance test)** — architecture_uz_shop_py_audit, architecture_uz_bonus_hold, architecture_uz_odengi_payment, architecture_uz_launch_acceptance_tests [EXTRACTED 1.00]
- **Native Capabilities That Make the Shell an Acceptable App** — docs_ios_app_uz_path_b, docs_ios_app_uz_apple_rule_4_2, docs_ios_app_uz_bonus_card, docs_ios_app_uz_app_lock, docs_ios_app_uz_push, docs_ios_app_uz_offline_catalog [EXTRACTED 1.00]
- **LG Hero Scene Delivery Chain (direction → brief → implementation → successor scene)** — task_03a_review_fixes_3d_hero_direction, lg_f4x5es5sb_3d_brief_scene, task_03a_report_hero3d, design_homestory [EXTRACTED 1.00]
- **Honest Demo Contract (no invented photos, prices, stock or promises)** — readme_demo_boundaries, product_principles, asset_sources_neutral_placeholder, task_03a_review_fixes_no_product_photos, design_honest_status_rule [INFERRED 0.85]
- **LG F4X5ES5SB Render Pipeline: Brief → Blender Model → Scroll Sequence** — task_04_lg_realistic_frames_single_3d_source, task_04_report_build_model, task_04_lg_realistic_frames_three_frames, task_05_glm_scroll_sequence, task_04_report_stylized_not_photoreal [INFERRED 0.85]
- **Site Delivery Stack: Cloudflare → nginx → smartcentr_site Container** — infra_smarket_kg_uz_traffic_path, infra_smarket_kg_uz_cloudflare_realip, deploy_site_docker_compose_site, docs_handoff_three_part_architecture, deploy_site_docker_compose_isolation [INFERRED 0.95]

## Communities (131 total, 58 thin omitted)

### Community 0 - "customer/gateway.ts"
Cohesion: 0.06
Nodes (69): ref_next_headers, ref_next_server, ref_server_only, DELETE(), GET(), GET(), POST(), POST() (+61 more)

### Community 1 - "build_model.py"
Cohesion: 0.05
Nodes (48): area(), box(), camera(), digit(), look_at(), LG F4X5ES5SB — внешняя модель по официальным фото, не заводской CAD. blender…, weighted(), Листы проверки: только кадрирование/одинаковая высота, без ретуши модели. (+40 more)

### Community 2 - "build_extension.py"
Cohesion: 0.08
Nodes (48): build_adopted(), build_common_module(), build_configuration(), build_module(), build_processor(), build_register(), build_registers(), build_role() (+40 more)

### Community 3 - "[lang]/layout.tsx"
Cohesion: 0.09
Nodes (29): nextConfig, next, ref_next_navigation, vitest, generateMetadata(), generateMetadata(), generateMetadata(), generateMetadata() (+21 more)

### Community 4 - "OfflineCatalogView"
Cohesion: 0.15
Nodes (24): Codable, Equatable, Identifiable, Int, CatalogBrand, CatalogCategory, CatalogItem, .inStock (+16 more)

### Community 5 - "useI18n"
Cohesion: 0.12
Nodes (26): A09 · P2 — Дизайн ҳужжати ва токенлар амалдаги бош баннердан ортда қолган, CategoryTiles(), InfoStrip(), NightBanner(), ProductSection(), PromoSection(), BrandLogo(), hasBrandImage() (+18 more)

### Community 6 - "package.json"
Cohesion: 0.05
Nodes (37): config, dependencies, @capacitor/cli, @capacitor/core, @capacitor/ios, @capacitor/push-notifications, next, react (+29 more)

### Community 7 - "AccountView.tsx"
Cohesion: 0.12
Nodes (29): src_components_account, AccountView(), formatDate(), useCustomer(), src_components_home_merchandising, AppLockPlugin, CapacitorGlobal, forgetFaceId() (+21 more)

### Community 8 - "shop_catalog.py"
Cohesion: 0.12
Nodes (18): app_core_database, Base, datetime, fastapi, hashlib, Интернет-магазин Smart Centr — каталог и фото: 1С → сервер → сайт. 1С…, Интернет-магазин Smart Centr — заказы с сайта (SQLAlchemy). Один заказ сайта =…, Вход покупателя и отправленный код — для счётчиков в «Панели сайта». От… (+10 more)

### Community 9 - "I18nProvider.tsx"
Cohesion: 0.14
Nodes (20): ref_next_link, CartPage(), OrderView(), AddToCartButton(), BottomNav(), ProductCard(), ProductPurchase(), StockLine() (+12 more)

### Community 10 - "shop_customers.py"
Cohesion: 0.16
Nodes (32): asyncio, BonusAccount, Decimal, _account(), branch_id(), _code_hash(), _customer(), get_profile() (+24 more)

### Community 11 - "shop_router.py"
Cohesion: 0.11
Nodes (41): api_route, app_core_config, app_payments, fastapi_responses, hmac, ShopOrder, _admin_phone(), _check_and_confirm() (+33 more)

### Community 12 - "Текшириладиган рўйхат"
Cohesion: 0.12
Nodes (16): 1. Илова очилиши, 2. Кириш, 3. Бонус картаси, 4. ⚠ Кассадаги сканер — энг муҳим текширув, 5. Face ID, 6. Push хабарлар, 7. Иловани ёпиб, қайта очиш, 8. Каталог интернетсиз (+8 more)

### Community 13 - "Icons.tsx"
Cohesion: 0.11
Nodes (32): FavoriteButton(), Header(), HeaderInner(), base(), IconCard(), IconCart(), IconCheck(), IconChevronLeft() (+24 more)

### Community 14 - "CatalogView.tsx"
Cohesion: 0.10
Nodes (23): dynamic, SnapshotItem, metadata, src_components_catalog_filters, Badge, BADGES, CatalogView(), CatalogViewInner() (+15 more)

### Community 15 - "shop_push.py"
Cohesion: 0.15
Nodes (23): base64, _b64(), _bundle(), _devices(), _drop(), enabled(), _fail(), _host() (+15 more)

### Community 16 - "AppLockPlugin"
Cohesion: 0.14
Nodes (11): Foundation, AppLockPlugin, AppLockStore, .base, Any, Bool, CAPPluginCall, CAPPluginMethod (+3 more)

### Community 17 - "BonusCardView"
Cohesion: 0.13
Nodes (18): Any, CoreImage.CIFilterBuiltins, Double, Image, BonusCardData, BonusCardStore, .query, BonusCardView (+10 more)

### Community 18 - "CartProvider.tsx"
Cohesion: 0.23
Nodes (18): CartContext, CartContextValue, CartProvider(), RestoreNotice, addItem(), CartLine, cartTotals(), clampQty() (+10 more)

### Community 19 - "shop_admin.py"
Cohesion: 0.12
Nodes (30): app_core_redis, app_models, Интернет-магазин Smart Centr: заказы с сайта (O!Деньги → 1С)., _as_list(), _clean(), dashboard(), guest_checkout_allowed(), push_device() (+22 more)

### Community 20 - "ProductArt.tsx"
Cohesion: 0.10
Nodes (6): ref_next_image, Gallery(), ProductArt(), ProductImage(), ProductPhoto, ArtKind

### Community 21 - "@playwright/test"
Cohesion: 0.12
Nodes (7): widths, ref_node_assert_strict, ref_node_fs, @playwright/test, assert, { chromium }, fs

### Community 22 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 23 - "AppDelegate"
Cohesion: 0.15
Nodes (11): Error, AppDelegate, Any, Bool, Data, UIScene, UISceneSession, UIWindow (+3 more)

### Community 25 - "adapter.ts"
Cohesion: 0.16
Nodes (18): ART_BY_CATEGORY, BRAND_ALIASES, cleanName(), detectBrand(), KNOWN_BRANDS, OneCCatalog, OneCItem, productFromOneC() (+10 more)

### Community 26 - "process.cjs"
Cohesion: 0.19
Nodes (14): backgroundColor(), BRANDS, fs, INK, main(), MANIFEST, median(), OUT (+6 more)

### Community 27 - "TASK 03A Report — review closure and LG scene"
Cohesion: 0.27
Nodes (14): Archived Pexels Category Photo Set, Asset Sources Contract (no active product photos), photo-sources.ts Canonical Machine List, LG F4X5ES5SB 3D Scroll Scene Brief, TASK 03A Brief — close design review, MotionProvider Empty-Deps and Reveal Cascade Defect, Photo Source Reconciliation Audit, ProductImage Always Uses altRu Defect (+6 more)

### Community 28 - ".money_amount"
Cohesion: 0.33
Nodes (3): Сколько клиент платит деньгами (для старых заказов без бонусов — total)., Для страницы заказа на сайте: без телефона и адреса., Для 1С: всё, что нужно для Заказа клиента, ПКО и Реализации.

### Community 29 - "TASK 04 Report — Blender Model of LG F4X5ES5SB"
Cohesion: 0.15
Nodes (16): No Fake Reviews, Timers or Discounts, TASK 04 Brief — Realistic LG Frames, LG F4X5ES5SB Washing Machine, Do Not Pass Photos or AI Images as Rendered Model, Single Editable 3D Source Rule, Three Mandatory Frames (front, 3/4, cutaway), TASK 04 Report — Blender Model of LG F4X5ES5SB, build_model.py Procedural Blender Scene (+8 more)

### Community 30 - "Smart Centr Architecture (site, iOS, Android, 1C, SBonus)"
Cohesion: 0.19
Nodes (13): Mobile Path Decision (Capacitor shell vs full native), Security, Privacy and Recovery Plan, Smart Centr Architecture (site, iOS, Android, 1C, SBonus), Unified Client API, Product Principles (honest demo vs confirmed data), Smart Centr Product Definition, Demo Boundaries (no real 1C/SBonus/payments), Storefront Prototype README (milestone 01/02) (+5 more)

### Community 31 - ".scene"
Cohesion: 0.22
Nodes (7): CAPBridgeViewController, MainViewController, UIScene, UISceneSession, NSUserActivity, Set, UIOpenURLContext

### Community 32 - "BonusCardPlugin"
Cohesion: 0.27
Nodes (5): CGFloat, BonusCardPlugin, CAPPluginCall, CAPPluginMethod, UIViewController

### Community 33 - "Bonus Hold Mechanism"
Cohesion: 0.22
Nodes (11): Extended Admin Workspace, Bonus Hold Mechanism, Pickup and Staff-Coordinated Taxi Delivery, Persistent Exchange Queue (outbox/inbox), Pre-Launch Acceptance Tests (15 scenarios), Night / 1C-Offline Order Mode, O!Dengi Payment Verification, 1C Standard Reservation Mechanism (+3 more)

### Community 34 - "Neutral Localized Photo Placeholder"
Cohesion: 0.22
Nodes (11): Approved Blue + Lime Palette (variant 01), Neutral Localized Photo Placeholder, White-Lemon-Cobalt Color Tokens, The Compact Commerce Rule, The Honest Status Rule, The Lemon Signal Rule, Manrope Typography Scale, The One-Family Rule (Manrope only) (+3 more)

### Community 35 - "build-lg-series.mjs"
Cohesion: 0.50
Nodes (3): sharp, files, variants

### Community 36 - "app/shop Module on the SBonus Server"
Cohesion: 0.16
Nodes (14): Site docker-compose Project (smartcentr-site), Separate Compose Project So SBonus Containers Are Untouched, site service → container smartcentr_site on 127.0.0.1:18820, deploy_shop.sh — Backup, Trial Import, Auto-Rollback, Панель сайта — Site Control Panel inside 1C, app/shop Module on the SBonus Server, Three-Part Architecture (site · SBonus server · 1C), APNs Push Notifications (shop_push.py, .p8 key) (+6 more)

### Community 37 - "TASK 03 Brief — expressive storefront, photos, motion"
Cohesion: 0.27
Nodes (10): The Flat-First Rule, Repository Structure Map, P0 Defect List (language, catalog, cart, variants), buildLangHref Language Switch Fix, comboVariant Single SKU Source, normalizeLines Cart Restoration Guard, URL as Single Source of Catalog State, TASK 03 Brief — expressive storefront, photos, motion (+2 more)

### Community 38 - "TODO_NEXT.md — What To Do Next"
Cohesion: 0.24
Nodes (10): SBonus Bonus Flow on the Site, Face ID Login (AppLock.swift, native key), Apple Guideline 4.2 — Repackaged Website Rejection, Path B — Capacitor Shell Plus Real Native Capabilities, TODO_NEXT.md — What To Do Next, SBonus BonusService earn/spend Semantics, Mixed+ iOS 26 Liquid Glass Plan, Owner Decisions (login, welcome bonus, site bonus cap) (+2 more)

### Community 39 - "sync-catalog.mjs"
Cohesion: 0.22
Nodes (8): ref_node_crypto, ref_node_url, apiUrl, CATALOG, fileEnv, log(), main(), ROOT

### Community 40 - "catalog.ts"
Cohesion: 0.31
Nodes (9): OfflineCatalogSync(), CapacitorGlobal, CatalogPlugin, markTried(), offlineCatalogState(), plugin(), showOfflineCatalog(), syncOfflineCatalog() (+1 more)

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

### Community 51 - "OfflineCatalogPlugin"
Cohesion: 0.29
Nodes (5): CAPBridgedPlugin, CAPPlugin, OfflineCatalogPlugin, CAPPluginCall, CAPPluginMethod

### Community 52 - "set_shop_domain.sh"
Cohesion: 0.53
Nodes (4): fail(), restore_nginx(), set_shop_domain.sh script, step()

### Community 53 - "switch_to_shop_domain.sh"
Cohesion: 0.53
Nodes (4): fail(), restore_nginx(), switch_to_shop_domain.sh script, step()

### Community 54 - "install_site.sh"
Cohesion: 0.70
Nodes (4): fail(), restore_nginx(), install_site.sh script, step()

### Community 56 - "ref_node_path"
Cohesion: 0.18
Nodes (8): ref_node_fs_promises, ref_node_path, ref_vitest_config, { chromium }, path, { chromium }, fs, path

### Community 57 - "_post"
Cohesion: 0.24
Nodes (11): AsyncClient, httpx, enabled(), _post(), Интернет-магазин Smart Centr — код входа через Telegram Gateway. Зачем: код в…, Один вызов Gateway API. Возвращает result или None, если не вышло., Отправить код входа в Telegram. True — доставлено в Telegram, False — нет…, send_code() (+3 more)

### Community 58 - "Data Ownership Matrix (source of truth per entity)"
Cohesion: 0.50
Nodes (4): Data Ownership Matrix (source of truth per entity), Technical Data Contract (entity fields), Photo Request for Future 1C Catalog, Post-Acceptance Roadmap (contracts → 1C → SBonus → payments → mobile)

### Community 59 - "update_site.sh"
Cohesion: 0.83
Nodes (3): fail(), update_site.sh script, step()

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

### Community 83 - "Capacitor"
Cohesion: 0.29
Nodes (6): Capacitor, SceneDelegate, UIWindow, UIKit, UIResponder, UIWindowSceneDelegate

### Community 85 - "caveman/SKILL.md"
Cohesion: 0.25
Nodes (7): Выключение, Где caveman выключается сам, Правила сжатия, Уровни, Что остаётся обычным текстом, Язык — главное правило, Ясность важнее краткости

### Community 86 - "render-svg.cjs"
Cohesion: 0.29
Nodes (6): ref_fs, ref_path, { chromium }, DIR, fs, path

### Community 87 - "(entry)/layout.tsx"
Cohesion: 0.24
Nodes (4): metadata, src_app_globals, src_app_light_lemon, NotFoundMessage()

### Community 89 - "FilterSelect.tsx"
Cohesion: 0.38
Nodes (6): src_components_filter_select, FilterSelect(), choose(), keyboard(), show(), Option

### Community 90 - "checkout/page.tsx"
Cohesion: 0.17
Nodes (17): CheckoutPage(), FieldErrors, CustomerLogin(), Step, IconTelegram(), demoProducts, Product, DeliveryMethod (+9 more)

### Community 91 - "products.ts"
Cohesion: 0.07
Nodes (30): DevGalleryFixturePage(), FavoritesPage(), HomePage(), generateMetadata(), DailySelection(), ProductDetail(), byIds(), catalogSource (+22 more)

### Community 92 - "react"
Cohesion: 0.21
Nodes (9): react, frameUrl(), Hero3D(), VisitCounter(), visitorId(), FavoritesContext, FavoritesContextValue, FavoritesProvider() (+1 more)

### Community 93 - "CatalogStore"
Cohesion: 0.22
Nodes (7): Bool, Data, CatalogStore, .file, .folder, .updatedAt, URL

### Community 96 - "update-all.sh"
Cohesion: 0.83
Nodes (3): fail(), update-all.sh script, step()

### Community 135 - "Footer.tsx"
Cohesion: 0.22
Nodes (8): Brand(), Footer(), PRIVACY_UPDATED, PrivacyContent, privacyKy, privacyRu, PrivacySection, SHOP_CONTACT

### Community 143 - "photo-sources.ts"
Cohesion: 0.50
Nodes (3): PEXELS_LICENSE, PhotoSource, photoSources

## Knowledge Gaps
- **255 isolated node(s):** `config`, `Аввал биладиган нарса`, `Сайт янгиланди`, `Телефонни тайёрлаш`, `Иловани телефонга қўйиш` (+250 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 503 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **58 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `copy_base()` connect `build_model.py` to `build_extension.py`, `package.json`?**
  _High betweenness centrality (0.227) - this node is a cross-community bridge._
- **Why does `test` connect `package.json` to `build_model.py`?**
  _High betweenness centrality (0.227) - this node is a cross-community bridge._
- **Are the 9 inferred relationships involving `text()` (e.g. with `photos_index()` and `public_photo()`) actually correct?**
  _`text()` has 9 INFERRED edges - model-reasoned connections that need verification._
- **What connects `config`, `Аввал биладиган нарса`, `Сайт янгиланди` to the rest of the system?**
  _255 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `customer/gateway.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05966386554621849 - nodes in this community are weakly interconnected._
- **Should `build_model.py` be split into smaller, more focused modules?**
  _Cohesion score 0.051923076923076926 - nodes in this community are weakly interconnected._
- **Should `build_extension.py` be split into smaller, more focused modules?**
  _Cohesion score 0.07932692307692307 - nodes in this community are weakly interconnected._