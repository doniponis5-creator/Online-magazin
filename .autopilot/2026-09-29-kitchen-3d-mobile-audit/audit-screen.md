# Screen-structure audit (2026-09-29)

Read: JSX `KitchenPlanner.tsx:2543-4208` + helpers 4222-4570, all of `kitchen.css`, `DESIGN.md`, `texts.ts`, `ReadyStrip.tsx`, dialogs, `src/lib/kitchen/*`.

Volume: `texts.ts` ~592 RU keys (20-702) + same KY (704-1336). Main component: 84 `<button>` JSX sites + 6 links (2543-4208), 16 inputs/Switches/SizeFields/details. Helpers add 16 buttons. Rendered button instances on the finish step run into the hundreds (RAL 216 tiles).

Breakpoints (kitchen.css): phone portrait "STACKED" `(max-width:900px) and (min-height:521px)` (tsx:213; css:3088-3461); landscape `(max-height:520px)` 3480-3526, 3528-3587; toolbar collapse ≤1220 (2776-2942); desktop grid 75-82.

## 1. Page map — MOBILE (portrait ~390×844, iOS svh ≈ 664)

Site header ~100-120 px, hides once "pinned" (tsx:570); site bottom nav slides away while pinned (css:3061-3067).
1. `kp-head` ~90-110 px (tsx:2545-2548; css:2945-2951): H1 + two-line lead.
2. `kp-stage` sticky, `clamp(260px, 38svh, 420px)` (css:3094, 3112-3121) ≈ 260 px on iPhone; bottom 40 px white strip (`--kp-strip`, 3100, 3130-3140) → ~220 px of 3D. Inside: top toolbar 44 px (tsx:2694-2823; css:2776-2830, 3617-3638): Undo, Redo, Фото, Ещё, Fullscreen. Bottom strip: views «3D / С высоты глаз / Спереди / Сверху» (tsx:2695-2701; css:3142-3160) + consultant button 36 px (3197-3207). «Ещё» sheet (3271-3285): Вечер, Цены, Размеры, Чёткость Лёгкий/HD/4K (tsx:2747-2798). Overlays: price tags on by default (tsx:306, 2618-2685), touch hint (3087-3095), «?» (3082-3086). Selection sheet `kp-sel` fixed bottom, almost full height possible (css:3241-3262): dims, 6 base / 5 upper / 4 over-fridge fronts, over-fridge material + colours, hinge, width ±, «Убрать шкаф», height ±, ←/→ / «На другую стену» / close (tsx:2831-3038). Photo bar (3041-3080). Error cards (2561-2616).
3. Resume card ~90 px when saved (3099-3111).
4. Dropped warning (3112, 4400-4434).
5. Step tabs sticky under 3D, 56 px (3113-3135; css:3210-3222): Форма, Размер, Техника, Стиль, Отделка (tsx:101).
6. `kp-body` scrolls under sticky 3D + tabs:
   - Форма (3148-3159): 4 shape cards; ReadyStrip title + lead + 3 chip rows (13 chips) + carousel of 12 ready kitchens + gallery picks (ReadyStrip.tsx:103-133) ≈ 550-650 px; «Начать заново».
   - Размер (3161-3211, 3581-3650): walls A/B/C/island each SizeField with −/input/+/slider (4342-4391); Комната: ceiling, window Switch, window width; Мебель: oven placement (3), pantries ±, fridge niche Switch — ~25 controls, ~900-1100 px.
   - Техника (3652-3672): 7 slot rows (types.ts:14), each with head, «Подробнее»/«Спросить о поставке», expandable model list with radio + «Подробнее» (4436-4570).
   - Стиль (3213-3253): «Шкафы до потолка» Switch, hint, 21 styles in 3 groups, 3:2 thumbnail + name + note in 2 columns (css:1079-1101) ≈ 1,700-2,000 px; «Цвет фасадов» 3 tones.
   - Отделка (3255-3579): 6 accordion Parts (4267-4292), Фасады open by default: Вся/Низ/Верх/Остров, search, 7 material chips, tiles; Ручки: handleless, 11 handles, 6 metals; Столешница 5 materials/18; Фартук 4 groups/31; Пол 9; Стены 11; up to 2 reset buttons.
   - Next row (3675-3692) `display: contents` on phone (css:3927-3929), not sticky → «Дальше» at the very end of each step.
7. `kp-sum` ~130 px, not sticky (css:3442-3448): «Техника · N товаров» + price, «Всё в корзину» (lemon), «Спросить в WhatsApp», «Позвонить», honesty line 11.5 px (3695-3723).
8. «Проверка проекта» (3727-3745).
9. «Для мебельщика» (3747-3858): 2 PDF buttons, 5 facts, wall SVGs, spec `<details>`; inside it «Мастеру» (3861-3989): «Мои цены», sheets/edge summary, estimate details, client name input, Excel + estimate PDF, cut maps.
10. «Коротко: что где стоит» (4093-4122): `<pre>`, Скопировать / Поделиться / В галерею / Спросить консультанта, plan sketch.
11. «Мои варианты» (4124-4173): save, gallery ask Да/Нет, up to 8 variants with Открыть/Удалить.
12. Toast (4185-4206).

Modals/sheets: 10 (5 dialogs: ApplianceSheet 4556, ReadyStrip confirm, PublishLoader/Dialog 4175, wall zoom 3810, master price form 3991 ~30 fields; 4 bottom sheets: selection, Ещё, fullscreen step sheet, photo bar) + toast.

## DESKTOP (≥901)
1. `kp-head` title + lead one row (css:43-69).
2. `kp-work` grid `1fr | 404px` (360 at ≤1100), height `clamp(500px, 100svh − header − 84px, 920px)` (75-82, 2757-2761). Stage toolbar one row at ≥1221: 4 views, undo, redo, Фото, Вечер, Цены, Размеры, Лёгкий/HD/4K, fullscreen = 14 controls (tsx:2694-2823); <1220 collapses to Ещё (2776-2842). Overlays: «?» (3840-3853), long hint with shortcuts, floating size card + move bar, photo bar. Panel: resume, dropped, 64 px tabs (818-835), scroll body (871-879), sticky «Начать заново + Дальше» (3934-3977), `kp-sum` pinned (1498-1561).
3. Fullscreen: panel docks right with «Настройки» toggle + S key (tsx:2810-2822; css:4015-4056).
4. Below: same sections 8-11.

## 2. Mobile mechanics
- Canvas sticky (`top: var(--kp-top)` → 0 when header hides, css:3112-3121; tsx:578-582); tabs sticky at top + stage-h (3210-3216); `goStep`/`reveal()` scroll content under the sticky pair (tsx:983-1013).
- ~220 px of 3D; stage + tabs ≈ 316 px permanently occupied; ~340 px for settings.
- Fullscreen: tabs fixed at bottom; step opens as bottom sheet `max-height: 55dvh` (3361-3413).
- Selection sheet `max-height: calc(100svh − nav − 120px)` (3251) → can cover almost the whole screen incl. the item; contradicts comment tsx:2826-2830.
- No persistent planner bottom bar; cart/total inline at end of step (3442-3448).
- svh for stage/work; 100dvh fullscreen (2229); sheets 55dvh/92dvh; landscape 100svh − 16 px + scroll-snap (3480-3500, 3534-3535).
- Safe areas: toast (1621), fullscreen tools/tabs (2235-2240, 3372-3384), `--kp-nav` (3099, 3191), dialogs (4658, 4837).
- Keyboard: no `visualViewport` handling. Number fields `inputMode="numeric"` 20 px (tsx:4356; css:1050); search/RAL 16 px (1784). Keyboard open → sticky 316 px + keyboard ~300 px leave ~50 px; focused field can hide under the sticky stack; `reveal()` ignores keyboard. Values commit on blur/Enter only (4331-4367).

## 3. Choices

| Choice | Count | Source |
|---|---|---|
| Shapes | 4 | tsx:102 |
| Ready kitchens | 12 + gallery picks | data/kitchen-ready.ts:40+ |
| ReadyStrip chips | 13 | |
| Styles | 21 in 3 groups × 3 tones (63) | styles.ts:108-843 |
| Front target | 4 | |
| Front materials | 5, ~54 colours | finishes.ts:15-185 |
| RAL | 216 in 9 groups + code input | ral.ts |
| Décor | 36, 3 brands | decors.ts |
| Front colours total | ~306 + search | |
| Handles | 11 + 6 metals + handleless | finishes.ts:273-300 |
| Worktops | 5 materials, 18 | 186-222 |
| Splashbacks | 4 groups, 31 | 223-272 |
| Floors / walls | 9 / 11 | styles.ts:847-890 |
| Cabinet fronts | base 6, upper 5, over-fridge 4 | fronts.ts:11-18 |
| Appliance slots | 7, all in-stock models | |
| Views / quality / toggles | 4 / 3 / 3 | |

Too much for a phone: RAL + décor + search; 21 styles as 2,000 px; 4 paint targets + over-fridge overrides; 11×6 handles; 31 splashes/18 tops; ceiling/window/pantries on Размер; 3 ReadyStrip filter rows; hinge + height ± in the selection sheet; 4 views; quality/evening/prices/dims toggles.

## 4. Duplicates and naming
- Same WhatsApp link twice: «Спросить в WhatsApp» (3715) and «Спросить консультанта» (4115); site consultant button too.
- Five share paths: «Поделиться» URL (4103, 1808-1823); «Отправить PDF мастеру» (3761, 2503-2515); «Скопировать список» (4100); PublishDialog «Поделиться» (PublishDialog.tsx:136); «Сохранить фото» share sheet (1780-1786).
- Photo: toolbar «Фото» starts ray-trace; «Сохранить фото» in two bars (3046, 3073); on phone save always takes light path (`light = photoFallback || engine.mobile`, 1759-1761) → wait for progress, get plain raster.
- Undo only in toolbar icon; plus «Вернуть отделку стиля», «Вернуть шкафы как было (n)», «Начать заново» (3677), «Заново» (3106) — four reset flavours.
- Front colour set in two places: tones on Стиль (3243-3251) and Фасады Part on Отделка (3264).
- Height split: «Шкафы до потолка» on Стиль (3215), ceiling on Размер (3184).
- Two selection close buttons (css:3340-3342).
- Dimensions in three places; prices vs dims mutually exclusive via hidden coupling (2757-2776).
- Cart state duplicated (3711 vs «уже в корзине»); honesty line in `honest` and `honestShort`.
- Naming: «мебельщик» vs «мастер»; «Заново» vs «Начать заново»; «Всё в корзину» vs «Добавить всё в корзину»; «3D» as one view's name; «Готово — проверить проект» just scrolls (1015-1017); lead text order ≠ step order (tsx:101).

## 5. Mobile ratings

| Criterion | Score | Reason |
|---|---|---|
| First-screen clarity | 2 | header + H1 + lead, ~220 px 3D under price tags/hint/toolbar/views; step content starts ~550 px down; no single CTA |
| Primary action reachability | 2 | «Всё в корзину»/«Дальше» at end of content, not sticky; tabs mid-screen; undo top-left |
| Taps to finished kitchen | 3 | ~9-12 taps + long scrolls; ReadyStrip shortcut buried |
| Discoverability of move | 2 | only the hint (texts.ts:183), hidden on first pointer-down (2551); hold 380 ms; move hint subtitle hidden on phone (css:2996-2998); «?» under views strip (3840-3853, z 3 vs 4) |
| Performance perception | 3 | Lite default, loader; 21 thumbnails render in sequence (1024-1040); photo waits then raster; quality exposed |
| Text density | 1-2 | notes on every control, 13 declarations at 10-11.5 px, ~590 strings |

## 6. Problems and fixes

Top 15 phone
1. 3D only ~220 px (css:3094, 3100) → drop view strip, `clamp(300px, 45svh, …)`.
2. Primary CTA not sticky (3442-3448, 3927-3929) → 56-64 px sticky bottom bar: total, Дальше, cart.
3. Стиль = ~2,000 px scroll (3217-3242) → carousel of 6-8 + «Все стили».
4. Move hint disappears on first touch (2551, 3087) → coach mark until first drag; inline hint in selection sheet.
5. «?» collides with view strip (3840-3853 vs 3142-3147) → into toolbar/Ещё.
6. Selection sheet can cover screen (3251) → cap ~45svh; secondary rows behind «Ещё параметры».
7. Keyboard hides inputs, no visualViewport (4353-4369) → shrink stage on focus, live apply.
8. ~306 swatches + search + RAL + décor (3264-3381) → 12-16 curated; RAL/décor behind «Точный код (для мастера)».
9. Price tags on by default over small 3D (306, 2621) → off on phone; total in sticky bar.
10. First screen spent on H1 + lead (2545-2548) → hide lead ≤900.
11. ReadyStrip below shapes with 3 filter rows (ReadyStrip.tsx:106-109) → first, no filters.
12. «С высоты глаз» cramped (texts.ts:71; css:3142-3160, 3197-3207) → 2 views.
13. Photo on phone: ray-trace wait then raster (1759-1761) → immediate snapshot on mobile.
14. Размер ~25 controls, 4 per wall (4348-4385) → field + ±; rest in «Дополнительно».
15. Buyer and master content mixed; «Мастеру» before buyer's «Коротко»/«Мои варианты» (3861 vs 4093, 4124; comment 3860 wrong) → reorder; collapsed «Для мастера».

Top 5 desktop
1. 14-control toolbar ≥1221 (2694-2823) → views + undo/redo/photo/fullscreen; rest in Ещё.
2. Long hint with shortcuts on the scene (3088-3094) → one line + «?» popover.
3. Стиль/Отделка cramped in 404 px (css:1079-1083, 1717-1721) → wider panel or overlay grid.
4. «Готово — проверить проект» scrolls into long page (1015-1017) → «Итог» modal/tab.
5. Three ways to toggle the fullscreen panel (2810-2822, 3139-3147) → one.

Remove / hide behind Ещё: quality selector (auto); Вечер/Размеры toggles; «С высоты глаз»/«Спереди»; ray-trace photo on phones; ReadyStrip size/budget filters; style notes; second WhatsApp; «Скопировать список»; duplicate resets; tones on Стиль.
Move to «Мастеру» view/route: RAL/décor/search; hinge, height ±, over-fridge material/colour; advanced front variants; «Для мебельщика» facts/spec; whole «Мастеру» section (price form ~30 fields 3991-4089, Excel, estimate PDF, client name, cut maps); one «PDF мастеру» share for client; «Коротко» `<pre>`; shortcuts hint; gallery publish ask.
Keep for client: shape/ready kitchen, walls, appliances, curated style, ~12 colours, ~5 handles, ~6 worktops, sticky total + cart, save/share, one WhatsApp.

Design-system notes (DESIGN.md): 44 px targets respected (css:3617-3638) except «?» 32 px (3845-3846) and fullscreen/assistant 36 px (3203-3207). Lemon primary on many competing buttons per screen (resume, cart, PDF, Excel, variant Открыть, gallery Да) — against the Lemon Signal Rule. 11.5 px text (`kp-sum__honest`, 1558) below the 12 px label size.
