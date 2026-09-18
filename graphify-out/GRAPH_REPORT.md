# Graph Report - Online-magazin  (2026-09-19)

## Corpus Check
- Large corpus: 614 files · ~4,467,963 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder.

## Summary
- 1200 nodes · 2639 edges · 74 communities (59 shown, 15 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 77 edges (avg confidence: 0.85)
- Token cost: 287,952 input · 0 output

## Community Hubs (Navigation)
- Customer API and Gateway
- LG 3D Model Build
- 1C Extension Builder
- Next.js Routing and i18n
- Product Catalog Data
- Home Page Components
- Dependencies and Capacitor Config
- Native iOS Bridges
- SBonus Shop App Core
- Checkout and Order Pages
- SBonus Customer Accounts
- SBonus Order Router
- Cart and Product Pages
- Icon Components
- Catalog View
- SBonus Push Notifications
- iOS App Lock
- iOS Bonus Card View
- Cart Logic and Tests
- SBonus Admin Settings
- 1C Catalog Adapter
- E2E Playwright Tests
- TypeScript Config
- iOS AppDelegate
- Product Images and Gallery
- Brand Logo Processing
- Task 03A Assets
- Telegram Login Sender
- Task 04-05 3D Frames
- Project Briefs and Milestones
- iOS Scene Delegate
- iOS Bonus Card Plugin
- Architecture Mechanisms
- Design System Rules
- SBonus Database Models
- Domain and Deploy Infra
- Task 02-03 Reports
- TODO and iOS Docs
- Catalog Sync Script
- 3D Frame Capture Scripts
- 1C Extension Docs
- iOS App Documentation
- Task 03 Accessibility Report
- Product Photo Fetcher
- iOS Icon Generator
- Project Rules and Secrets
- iOS Image Filters
- LG 3D Hero Brief
- Handoff Operations Notes
- Brand Logo Renderer
- Filter Select Component
- Shop Secret Setup Script
- Site Switch Script
- Site Install Script
- Bonus Card Strings
- Light Theme Review Script
- Favorites Provider
- Data Ownership Contract
- Site Update Script
- Server Inspect Script
- Site Pack Script
- Catalog Update Script
- SBonus Deploy Script
- Capacitor SPM Package
- APNs Remote Script
- APNs Setup Script
- Telegram Gateway Script

## God Nodes (most connected - your core abstractions)
1. `useI18n()` - 56 edges
2. `react` - 24 edges
3. `base()` - 24 edges
4. `text()` - 23 edges
5. `Form` - 21 edges
6. `ShopOrder` - 18 edges
7. `getProduct()` - 18 edges
8. `_cfg()` - 17 edges
9. `site_create_order()` - 17 edges
10. `AccountView()` - 17 edges

## Surprising Connections (you probably didn't know these)
- `normalizeLines Cart Restoration Guard` --semantically_similar_to--> `Bonus Hold Mechanism`  [INFERRED] [semantically similar]
  TASK_02_REPORT.md → ARCHITECTURE_UZ.md
- `Owner's Work Standard (verify visually, no self-scoring)` --semantically_similar_to--> `Smart Centr Project Working Rules`  [INFERRED] [semantically similar]
  TASK_03A_REVIEW_FIXES.md → CLAUDE.md
- `Poster Fallback for No-JS, Reduced Motion and Load Errors` --semantically_similar_to--> `Motion Duration Token System`  [INFERRED] [semantically similar]
  TASK_05_GLM.md → TASK_03_REPORT.md
- `Wikimedia Brand Logo Sources and Licenses` --semantically_similar_to--> `ASSET_SOURCES.md Photo Licensing Ledger`  [INFERRED] [semantically similar]
  public/Бренд лого/wikimedia/SOURCES.md → TASK_03_REPORT.md
- `White-Lemon-Cobalt Color Tokens` --semantically_similar_to--> `Approved Blue + Lime Palette (variant 01)`  [INFERRED] [semantically similar]
  DESIGN.md → ARCHITECTURE_UZ.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Bonus Integrity Chain (audit → hold → bank confirm → acceptance test)** — architecture_uz_shop_py_audit, architecture_uz_bonus_hold, architecture_uz_odengi_payment, architecture_uz_launch_acceptance_tests [EXTRACTED 1.00]
- **Honest Demo Contract (no invented photos, prices, stock or promises)** — readme_demo_boundaries, product_principles, asset_sources_neutral_placeholder, task_03a_review_fixes_no_product_photos, design_honest_status_rule [INFERRED 0.85]
- **LG Hero Scene Delivery Chain (direction → brief → implementation → successor scene)** — task_03a_review_fixes_3d_hero_direction, lg_f4x5es5sb_3d_brief_scene, task_03a_report_hero3d, design_homestory [EXTRACTED 1.00]
- **Native Capabilities That Make the Shell an Acceptable App** — docs_ios_app_uz_path_b, docs_ios_app_uz_apple_rule_4_2, docs_ios_app_uz_bonus_card, docs_ios_app_uz_app_lock, docs_ios_app_uz_push, docs_ios_app_uz_offline_catalog [EXTRACTED 1.00]
- **LG F4X5ES5SB Render Pipeline: Brief → Blender Model → Scroll Sequence** — task_04_lg_realistic_frames_single_3d_source, task_04_report_build_model, task_04_lg_realistic_frames_three_frames, task_05_glm_scroll_sequence, task_04_report_stylized_not_photoreal [INFERRED 0.85]
- **Site Delivery Stack: Cloudflare → nginx → smartcentr_site Container** — infra_smarket_kg_uz_traffic_path, infra_smarket_kg_uz_cloudflare_realip, deploy_site_docker_compose_site, docs_handoff_three_part_architecture, deploy_site_docker_compose_isolation [INFERRED 0.95]

## Communities (74 total, 15 thin omitted)

### Community 0 - "Customer API and Gateway"
Cohesion: 0.06
Nodes (67): ref_next_headers, ref_next_server, ref_server_only, DELETE(), GET(), GET(), POST(), POST() (+59 more)

### Community 1 - "LG 3D Model Build"
Cohesion: 0.05
Nodes (49): area(), box(), camera(), digit(), look_at(), LG F4X5ES5SB — внешняя модель по официальным фото, не заводской CAD. blender…, weighted(), Листы проверки: только кадрирование/одинаковая высота, без ретуши модели. (+41 more)

### Community 2 - "1C Extension Builder"
Cohesion: 0.08
Nodes (48): build_adopted(), build_common_module(), build_configuration(), build_module(), build_processor(), build_register(), build_registers(), build_role() (+40 more)

### Community 3 - "Next.js Routing and i18n"
Cohesion: 0.06
Nodes (36): nextConfig, next, ref_next_navigation, vitest, metadata, src_app_globals, generateMetadata(), generateMetadata() (+28 more)

### Community 4 - "Product Catalog Data"
Cohesion: 0.08
Nodes (25): HomePage(), ProductDetail(), byIds(), catalogSource, colorHexOf(), ColorOption, comboVariant(), defaultColorKey() (+17 more)

### Community 5 - "Home Page Components"
Cohesion: 0.10
Nodes (31): CategoryTiles(), InfoStrip(), NightBanner(), ProductSection(), PromoSection(), Brand(), BrandLogo(), hasBrandImage() (+23 more)

### Community 6 - "Dependencies and Capacitor Config"
Cohesion: 0.05
Nodes (37): config, dependencies, @capacitor/cli, @capacitor/core, @capacitor/ios, @capacitor/push-notifications, next, react (+29 more)

### Community 7 - "Native iOS Bridges"
Cohesion: 0.12
Nodes (30): src_components_account, AccountView(), formatDate(), useCustomer(), src_components_home_merchandising, CustomerProfile, AppLockPlugin, CapacitorGlobal (+22 more)

### Community 8 - "SBonus Shop App Core"
Cohesion: 0.10
Nodes (31): app_core_config, app_core_database, app_core_redis, app_models, app_payments, datetime, fastapi, fastapi_responses (+23 more)

### Community 9 - "Checkout and Order Pages"
Cohesion: 0.11
Nodes (24): react, FieldErrors, OrderView(), CustomerLogin(), Step, IconTelegram(), InstallmentDemo(), demoProducts (+16 more)

### Community 10 - "SBonus Customer Accounts"
Cohesion: 0.16
Nodes (32): asyncio, BonusAccount, Decimal, _account(), branch_id(), _code_hash(), _customer(), get_profile() (+24 more)

### Community 11 - "SBonus Order Router"
Cohesion: 0.12
Nodes (29): api_route, Сколько клиент платит деньгами (для старых заказов без бонусов — total)., Для страницы заказа на сайте: без телефона и адреса., Для 1С: всё, что нужно для Заказа клиента, ПКО и Реализации., ShopOrder, _admin_phone(), _check_and_confirm(), _check_site_order() (+21 more)

### Community 12 - "Cart and Product Pages"
Cohesion: 0.16
Nodes (21): ref_next_link, CartPage(), CheckoutPage(), FavoritesPage(), generateMetadata(), ProductPage(), AddToCartButton(), BottomNav() (+13 more)

### Community 13 - "Icon Components"
Cohesion: 0.16
Nodes (24): base(), IconCard(), IconCart(), IconCheck(), IconChevronLeft(), IconClose(), IconFilter(), IconGift() (+16 more)

### Community 14 - "Catalog View"
Cohesion: 0.13
Nodes (20): metadata, src_components_catalog_filters, Badge, BADGES, CatalogView(), CatalogViewInner(), inStock(), normalize() (+12 more)

### Community 15 - "SBonus Push Notifications"
Cohesion: 0.16
Nodes (22): base64, _b64(), _bundle(), _devices(), _drop(), enabled(), _fail(), _host() (+14 more)

### Community 16 - "iOS App Lock"
Cohesion: 0.13
Nodes (13): CAPBridgedPlugin, CAPPlugin, Foundation, AppLockPlugin, AppLockStore, .base, Any, Bool (+5 more)

### Community 17 - "iOS Bonus Card View"
Cohesion: 0.16
Nodes (16): Codable, Double, Equatable, Image, BonusCardData, BonusCardView, .body, .closeButton (+8 more)

### Community 18 - "Cart Logic and Tests"
Cohesion: 0.23
Nodes (18): CartContext, CartContextValue, CartProvider(), RestoreNotice, addItem(), CartLine, cartTotals(), clampQty() (+10 more)

### Community 19 - "SBonus Admin Settings"
Cohesion: 0.16
Nodes (20): _as_list(), _clean(), guest_checkout_allowed(), push_device(), PushDevice, AsyncSession, BaseModel, Request (+12 more)

### Community 20 - "1C Catalog Adapter"
Cohesion: 0.16
Nodes (18): ART_BY_CATEGORY, BRAND_ALIASES, cleanName(), detectBrand(), KNOWN_BRANDS, OneCCatalog, OneCItem, productFromOneC() (+10 more)

### Community 21 - "E2E Playwright Tests"
Cohesion: 0.12
Nodes (7): widths, ref_node_assert_strict, ref_node_fs, @playwright/test, assert, { chromium }, fs

### Community 22 - "TypeScript Config"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 23 - "iOS AppDelegate"
Cohesion: 0.15
Nodes (11): Data, Error, AppDelegate, Any, Bool, UIScene, UISceneSession, UIWindow (+3 more)

### Community 25 - "Product Images and Gallery"
Cohesion: 0.16
Nodes (10): ref_next_image, DevGalleryFixturePage(), Gallery(), ProductImage(), src_data_1c_catalog, Category, CategoryId, demoCategories (+2 more)

### Community 26 - "Brand Logo Processing"
Cohesion: 0.19
Nodes (14): backgroundColor(), BRANDS, fs, INK, main(), MANIFEST, median(), OUT (+6 more)

### Community 27 - "Task 03A Assets"
Cohesion: 0.27
Nodes (14): Archived Pexels Category Photo Set, Asset Sources Contract (no active product photos), photo-sources.ts Canonical Machine List, LG F4X5ES5SB 3D Scroll Scene Brief, TASK 03A Brief — close design review, MotionProvider Empty-Deps and Reveal Cascade Defect, Photo Source Reconciliation Audit, ProductImage Always Uses altRu Defect (+6 more)

### Community 28 - "Telegram Login Sender"
Cohesion: 0.20
Nodes (13): AsyncClient, httpx, dashboard(), Живой ответ Green API. Молчаливо сломанный WhatsApp — худшее, что может быть., _whatsapp_state(), enabled(), _post(), Интернет-магазин Smart Centr — код входа через Telegram Gateway. Зачем: код в… (+5 more)

### Community 29 - "Task 04-05 3D Frames"
Cohesion: 0.19
Nodes (14): TASK 04 Brief — Realistic LG Frames, Do Not Pass Photos or AI Images as Rendered Model, Single Editable 3D Source Rule, Three Mandatory Frames (front, 3/4, cutaway), TASK 04 Report — Blender Model of LG F4X5ES5SB, build_model.py Procedural Blender Scene, Empty Contact Sheet Caused by Opaque SVG Overlay, Fixes in Script, Never by Transforming Final PNGs (+6 more)

### Community 30 - "Project Briefs and Milestones"
Cohesion: 0.19
Nodes (13): Mobile Path Decision (Capacitor shell vs full native), Security, Privacy and Recovery Plan, Smart Centr Architecture (site, iOS, Android, 1C, SBonus), Unified Client API, Product Principles (honest demo vs confirmed data), Smart Centr Product Definition, Demo Boundaries (no real 1C/SBonus/payments), Storefront Prototype README (milestone 01/02) (+5 more)

### Community 31 - "iOS Scene Delegate"
Cohesion: 0.15
Nodes (11): CAPBridgeViewController, MainViewController, SceneDelegate, UIScene, UISceneSession, UIWindow, NSUserActivity, Set (+3 more)

### Community 32 - "iOS Bonus Card Plugin"
Cohesion: 0.27
Nodes (5): CGFloat, BonusCardPlugin, CAPPluginCall, CAPPluginMethod, UIViewController

### Community 33 - "Architecture Mechanisms"
Cohesion: 0.22
Nodes (11): Extended Admin Workspace, Bonus Hold Mechanism, Pickup and Staff-Coordinated Taxi Delivery, Persistent Exchange Queue (outbox/inbox), Pre-Launch Acceptance Tests (15 scenarios), Night / 1C-Offline Order Mode, O!Dengi Payment Verification, 1C Standard Reservation Mechanism (+3 more)

### Community 34 - "Design System Rules"
Cohesion: 0.22
Nodes (11): Approved Blue + Lime Palette (variant 01), Neutral Localized Photo Placeholder, White-Lemon-Cobalt Color Tokens, The Compact Commerce Rule, The Honest Status Rule, The Lemon Signal Rule, Manrope Typography Scale, The One-Family Rule (Manrope only) (+3 more)

### Community 35 - "SBonus Database Models"
Cohesion: 0.22
Nodes (10): Base, Интернет-магазин Smart Centr — заказы с сайта (SQLAlchemy). Один заказ сайта =…, Вход покупателя и отправленный код — для счётчиков в «Панели сайта». От…, Посещение страницы сайта. visitor — необратимый отпечаток случайного…, ShopEvent, ShopOrderEvent, ShopVisit, sqlalchemy_dialects_postgresql (+2 more)

### Community 36 - "Domain and Deploy Infra"
Cohesion: 0.20
Nodes (11): Site docker-compose Project (smartcentr-site), Separate Compose Project So SBonus Containers Are Untouched, site service → container smartcentr_site on 127.0.0.1:18820, deploy_shop.sh — Backup, Trial Import, Auto-Rollback, Three-Part Architecture (site · SBonus server · 1C), deploy_shop.sh ОТКАТ Deletes Orders — Needs Rewrite, SMARKET_KG_UZ.md — Domain, DNS, Server, Protection, cloudflare-realip.conf — Trust CF-Connecting-IP Only (+3 more)

### Community 37 - "Task 02-03 Reports"
Cohesion: 0.27
Nodes (10): The Flat-First Rule, Repository Structure Map, P0 Defect List (language, catalog, cart, variants), buildLangHref Language Switch Fix, comboVariant Single SKU Source, normalizeLines Cart Restoration Guard, URL as Single Source of Catalog State, TASK 03 Brief — expressive storefront, photos, motion (+2 more)

### Community 38 - "TODO and iOS Docs"
Cohesion: 0.24
Nodes (10): SBonus Bonus Flow on the Site, Face ID Login (AppLock.swift, native key), Apple Guideline 4.2 — Repackaged Website Rejection, Path B — Capacitor Shell Plus Real Native Capabilities, TODO_NEXT.md — What To Do Next, SBonus BonusService earn/spend Semantics, Mixed+ iOS 26 Liquid Glass Plan, Owner Decisions (login, welcome bonus, site bonus cap) (+2 more)

### Community 39 - "Catalog Sync Script"
Cohesion: 0.22
Nodes (8): ref_node_crypto, ref_node_url, apiUrl, CATALOG, fileEnv, log(), main(), ROOT

### Community 40 - "3D Frame Capture Scripts"
Cohesion: 0.20
Nodes (7): ref_node_path, sharp, ref_vitest_config, files, variants, { chromium }, path

### Community 41 - "1C Extension Docs"
Cohesion: 0.28
Nodes (9): 1C Extension ИМ_ОнлайнМагазин, HMAC-SHA256 Signing Between Site, Server and 1C, Order Import Idempotency via САЙТ:<order_id> Marker, 1C Prod Still on 1.4 — Must Install 1.5 Before First Bonus Order, РедакторФото.html — 1C Photo Editor UI, #im-out Hidden Textarea Handoff Channel, %IMAGE_DATA_URL% Template Placeholder, window.imExport — JPEG data URL Export Bridge (+1 more)

### Community 42 - "iOS App Documentation"
Cohesion: 0.28
Nodes (9): Панель сайта — Site Control Panel inside 1C, app/shop Module on the SBonus Server, IOS_APP_UZ.md — App Store Guide, Offline SBonus QR Card (BonusCard.swift, Keychain), CODE_SIGN_IDENTITY="-" Required or Keychain Fails (-34018), Offline Catalog on the Phone (not started), APNs Push Notifications (shop_push.py, .p8 key), Unverified — Does the POS Scanner Read SB-XXXXXXXXXX (+1 more)

### Community 43 - "Task 03 Accessibility Report"
Cohesion: 0.25
Nodes (9): Manrope SIL Open Font License 1.1, TASK 03 Report — Storefront Photos and Motion, Accessible Gallery Zoom via native <dialog>, ASSET_SOURCES.md Photo Licensing Ledger, Cart Restore Notice for Corrupted Storage, Explicit SKU Combination State, Motion Duration Token System, No Fake Reviews, Timers or Discounts (+1 more)

### Community 44 - "Product Photo Fetcher"
Cohesion: 0.36
Nodes (8): BAD_WORDS, FORCE, GOOD_WORDS, main(), score(), searchTopic(), sleep(), TOPICS

### Community 45 - "iOS Icon Generator"
Cohesion: 0.28
Nodes (8): glyph(), icon(), iconSet, INK, mark, root, splash(), splashSet

### Community 46 - "Project Rules and Secrets"
Cohesion: 0.25
Nodes (8): Next.js Agent Rules Block, Installment Eligibility Flag (existing SBonus clients only), Phone + One-Time Code Login, Smart Centr Project Working Rules, Secrets Boundary (never type owner's credentials), Live System Overview (site, SBonus server, 1C UT 11.5), Telegram Gateway Login Code with WhatsApp Fallback, Owner's Work Standard (verify visually, no self-scoring)

### Community 47 - "iOS Image Filters"
Cohesion: 0.38
Nodes (4): Capacitor, CoreImage.CIFilterBuiltins, SwiftUI, UIKit

### Community 48 - "LG 3D Hero Brief"
Cohesion: 0.43
Nodes (7): HomeStory Scroll Scene («the house wakes up»), Reduce/No-JS/No-WebGL Static Fallback Policy, Inverter Direct Drive Schematic View, Four Scroll-Progress Phases (0-20/20-55/55-80/80-100%), TurboWash360 Four-Direction Water Flow, Hero3D Pure-CSS LG Scroll Scene, next/image Stale-Cache Root Cause (same URL, new bytes)

### Community 49 - "Handoff Operations Notes"
Cohesion: 0.33
Nodes (7): HANDOFF.md — What Is Already Built, Known Issue — Only 1-2 Products Reach the Server Catalog, paymentMode() live vs mock Fallback, Assistant Never Types the Owner's Secrets, Wikimedia Brand Logo Sources and Licenses, Smart Centr Brand Logo Provenance, LG F4X5ES5SB Washing Machine

### Community 50 - "Brand Logo Renderer"
Cohesion: 0.29
Nodes (6): ref_fs, ref_path, { chromium }, DIR, fs, path

### Community 51 - "Filter Select Component"
Cohesion: 0.38
Nodes (6): src_components_filter_select, FilterSelect(), choose(), keyboard(), show(), Option

### Community 52 - "Shop Secret Setup Script"
Cohesion: 0.53
Nodes (4): fail(), restore_nginx(), set_shop_domain.sh script, step()

### Community 53 - "Site Switch Script"
Cohesion: 0.53
Nodes (4): fail(), restore_nginx(), switch_to_shop_domain.sh script, step()

### Community 54 - "Site Install Script"
Cohesion: 0.70
Nodes (4): fail(), restore_nginx(), install_site.sh script, step()

### Community 55 - "Bonus Card Strings"
Cohesion: 0.40
Nodes (3): BonusCardStore, .query, Any

### Community 56 - "Light Theme Review Script"
Cohesion: 0.40
Nodes (4): ref_node_fs_promises, { chromium }, fs, path

### Community 57 - "Favorites Provider"
Cohesion: 0.50
Nodes (4): FavoritesContext, FavoritesContextValue, FavoritesProvider(), readStorage()

### Community 58 - "Data Ownership Contract"
Cohesion: 0.50
Nodes (4): Data Ownership Matrix (source of truth per entity), Technical Data Contract (entity fields), Photo Request for Future 1C Catalog, Post-Acceptance Roadmap (contracts → 1C → SBonus → payments → mobile)

### Community 59 - "Site Update Script"
Cohesion: 0.83
Nodes (3): fail(), update_site.sh script, step()

## Knowledge Gaps
- **179 isolated node(s):** `phone`, `laptop`, `catalog`, `order`, `base` (+174 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 376 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **15 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `test` connect `Dependencies and Capacitor Config` to `LG 3D Model Build`?**
  _High betweenness centrality (0.268) - this node is a cross-community bridge._
- **Why does `copy_base()` connect `LG 3D Model Build` to `1C Extension Builder`, `Dependencies and Capacitor Config`?**
  _High betweenness centrality (0.268) - this node is a cross-community bridge._
- **Are the 9 inferred relationships involving `text()` (e.g. with `photos_index()` and `public_photo()`) actually correct?**
  _`text()` has 9 INFERRED edges - model-reasoned connections that need verification._
- **What connects `phone`, `laptop`, `catalog` to the rest of the system?**
  _179 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Customer API and Gateway` be split into smaller, more focused modules?**
  _Cohesion score 0.06200411401704378 - nodes in this community are weakly interconnected._
- **Should `LG 3D Model Build` be split into smaller, more focused modules?**
  _Cohesion score 0.05081585081585081 - nodes in this community are weakly interconnected._
- **Should `1C Extension Builder` be split into smaller, more focused modules?**
  _Cohesion score 0.07932692307692307 - nodes in this community are weakly interconnected._