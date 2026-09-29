# Interaction audit: moving cabinets (2026-09-29)

Short answer to "I can't move cabinets where I want": cabinets are not free objects. Each wall is a packed row, space between placed items is always refilled with auto cabinets, and the drag has mapping and gesture problems. The phone complaint mostly comes from one-finger gestures meaning different things depending on hidden state (selected or not, hold time), plus a pinch bug.

E = `src/components/kitchen/three/engine.ts`, L = `src/lib/kitchen/layout.ts`, KP = `src/components/kitchen/KitchenPlanner.tsx`, T = `src/lib/kitchen/types.ts`.

## 1. Data model

Order plus an optional centre per wall, not free coordinates.
- `KitchenState.arrangement` = ordered list of keys per wall (A back, B left, C right, I island) (T:84-87, 105-106).
- `at` = optional centre in cm along the wall from the corner (T:131-136).
- Custom cabinets in `cabinets: {kN: {w, front}}` (T:70-75, 129-130).
- Row built by `wallItems` (L:636-683), then `place`/`resolveRun` (L:283-327, 414-460).

Only these can move: appliances/fixed items — fridge, tall, sink, dishwasher, washer, hob, pantry, pantry2, oven (T:68-69); custom `kN`; an auto base cabinet ≥ 15 cm (drag converts it to `kN` via `pinCabinet`, L:984-996, KP:1232-1260; check E:954). Upper cabinets can never be moved: drag limited to `row === 'base'` (E:954); uppers derived from base (`uppersFor`, L:476, 753).

Gaps are impossible: every gap gets a "fill" item (L:643-660, 677-681); `fillSegment` always consumes the remainder (L:338-375); `splitFill`: <15 cm filler, <30 bottle rack, ≤90 one cabinet, >90 ~80 cm pieces (L:257-270). Moving a cabinet makes neighbours change width, appear or disappear; its old spot is refilled.

Other walls: allowed by drag (E:1167-1176) and by «На другую стену» (`nextWall`, L:959-968) which cycles A→B→C and inserts into the middle; no target choice. Tall items banned from island (`allowedOn`, L:580-581). Only walls of the chosen shape (L:564-569). No free placement in the room, no rotation, no second island.

Along a wall: anywhere between order-neighbours; `resolveRun` clamps `at` between sum of widths before and after (L:297-300).

What a drag does: reorder + shift. `moveItem` removes the key and re-inserts before the first item whose centre > pos (L:928-943). On drop, `at` = pos for the dragged item, all other centres frozen (`frozen`, KP:1143-1147, 655). Companions not frozen: sink/dishwasher/washer, hob/oven, fridge/tall/pantry (`GLUED` L:614-628, `companions` L:1003-1020) → glued pairs can't be separated by a short drag.

Clamping/snapping: pointer projected onto plane y = 0.9 m; centre clamped to [lo + w/2, hi − w/2], lo = 0.6 m for wall C, hi = L − 0.6 for wall B (E:1184-1187); rounded to 1 cm (E:1190). Snap to neighbour/wall end within `SNAP = 6` cm, only for the moving item (L:44, 301-306, KP:1137); stored `at` rounded to 0.5 cm (KP:1165). Width in 5 cm steps within `WIDTH_LIMITS` 15–120 (L:47-55, KP:1369-1373). Resizing any wall discards every `at` (KP:1110-1114); changing shape discards arrangement, cabinets, at (KP:1103).

If the drop doesn't fit: `apply` rejects when more items get dropped than before, shows "noRoom" toast, reverts (KP:1155-1161).

## 2. Pointer handling

Setup: OrbitControls (E:355-372); pan off; polar 0.02–1.42; azimuth ±1.25 rad; damping 0.08. Mouse: LEFT rotate, MIDDLE dolly, RIGHT rotate (E:368). Touch defaults: one finger rotate, two fingers dolly (pan off).

Custom canvas listeners (E:376-385): pointerdown capture phase (before OrbitControls), pointerup/move/cancel; contextmenu suppressed.

Scroll/touch-action: `.kp-canvas { touch-action: none; -webkit-touch-callout: none }` (kitchen.css:100-113). Page never scrolls over 3D. Portrait: stage sticky, `clamp(260px, 38svh, 420px)` (kitchen.css:3094, 3112-3121). Landscape (max-height 520): `.kp-work` 100svh (3487-3500, 3528+) — nearly whole screen non-scrollable.

Gesture rules (`onDown` E:935-974, `onUp` 976-998, `onMove` 1000-1027):

| Case | What happens |
|---|---|
| Tap = select | up within 6 px and 600 ms; raycast, show dims, toggle door if door hit, `onPick` (E:990-997). Tap on a door both selects and swings it. |
| Already selected (`grab === key`, KP:1489-1491), mouse or touch | controls disabled immediately, pointer captured; drag after 5 px (E:959-968, 1003-1011). One finger on the selected object can never rotate. |
| Not selected, mouse | no drag; left-drag rotates (E:970). Click to select, then drag. |
| Not selected, touch | long-press HOLD_MS = 380 ms starts drag (E:107, 971-973) + 12 ms vibration (E:1152). >8 px cancels hold (E:1001). Controls stay enabled during the hold → view rotates slightly while waiting. |
| Second finger | cancels hold/press, re-enables controls (E:939-946); does not stop a running drag. |

Orbit vs drag resolved only via `controls.enabled = false` in the capture-phase down (press case) or `startDrag` (E:1150); re-enabled on up/cancel/`stopDrag` (E:978-981, 1238). Hover cursor mouse only (E:1017-1026).

## 3. Feedback during a drag

- Marker, not the object: translucent blue box 0.9 m high, 0.62 m deep, width = item (E:1208-1233). Real object doesn't move until drop.
- Preview: each pointermove runs a full `planKitchen` trial (`onPreview`, KP:667-696, E:1194-1198). Gap labels `gap:i` (E:1197-1198, KP:2652). Red marker when `fits` false (E:1225-1229).
- Missing: no snap lines, no ghost of the actual cabinet, no neighbour highlight, no dimension of the dragged item.
- Invalid drops: off every wall → marker hides, release silent no-op (E:1173, 1177-1181, 1244). Ray misses plane (pointer above horizon) → early return, target not cleared (E:1165) → previous target committed on release. Doesn't fit → toast + revert (KP:1158-1160; texts.ts:534).
- After drop: full `setKitchen` rebuild; appliances get a 650 ms drop animation (KP:874-876, E:428-434).

## 4. Every way to move a cabinet

| # | Method | Constraints |
|---|---|---|
| a | 3D drag (E:1143-1245 → KP:650-662) | base row only; auto ≥15 cm; select first (mouse) or long-press (touch); target = nearest run to finger projection on counter plane; clamped; tall not on island; rejected if something drops out |
| b | ←/→ in `.kp-move` (KP:2985-3036) | 5 cm per step (`NUDGE` KP:125); hold repeats 420 ms then 110 ms (KP:1301-1307); direction flipped on walls B and I (KP:1269, 1277); blocked → jumps over neighbour (`stepItem` KP:1284-1290) |
| c | «На другую стену / На остров / К стене» (KP:1314-1321, 1552-1559) | cycles walls; `at` dropped; hidden if one wall (`canChangeWall` L:976-978) |
| d | Keyboard ← → (KP:1514-1516) | same as nudge; no ↑/↓, no wall key; Delete removes custom cabinet (KP:1517-1519) |
| e | Width ± (KP:1369-1397) | grows from centre, neighbours re-flow; touched auto cabinets become custom |
| f | Undo/redo (KP:1066-1089, 2704-2720) | Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y; <600 ms merge; max 60 |

## 5. Top 10 reasons for "can't move where I want" / "phone is inconvenient"

1. Cabinet jumps under the finger; no grab offset. `moveDrag` uses the hit point as the new centre (E:1161-1190); `startDrag` doesn't record where you grabbed. Grab a 60 cm cabinet near its edge → 25-30 cm jump on first move. Fix: store offset in `startDrag`, subtract.
2. Tall objects and non-top views map wrongly. Ray always hits plane y = 0.9 m (E:1165). Grab a fridge near its top or use eye/front views → hit behind the wall → wrong position/wall/no target/stale target. Fix: raycast against a vertical plane along the run or the object's own height.
3. On touch a sloppy tap on a selected cabinet moves it: drag threshold 5 px (E:1003) < tap tolerance 6 px (E:990); release commits (E:982-983) → silent move up to half width + undo entry. Fix: touch threshold 10-12 px; no commit under a few cm.
4. A slow tap becomes a drag: hold 380 ms starts drag (E:971-973) while a tap is accepted up to 600 ms (E:990). A 400-600 ms tap commits a drag; for an auto cabinet converts it to custom `kN` (KP:661, 1232-1250) and may shift up to 6 cm by snap (L:303-305). A finger that pauses before rotating gets a drag. Fix: don't commit a hold-drag with no movement; HOLD_MS ≥ 500.
5. Once selected, the cabinet blocks rotation (E:959-968); most of the 38svh canvas is cabinets. This is the "fix one, break another" loop.
6. Pinch breaks when finger 1 lands on the selected item: capture handler disables controls before OrbitControls sees pointer 1 (E:960); second finger re-enables (E:942-945) and OrbitControls tracks only pointer 2 → pinch rotates. Non-primary `onDown` overwrites `this.down` (E:936). Fix: don't disable controls for non-primary pointers / re-dispatch pointer 1.
7. No free placement: clamped between order-neighbours (L:297-300), every gap refilled (L:338-375, 677-681); glued companions move together (L:614-628, KP:655); wall cabinets can't move (E:954). Fix: at least explain in the hint; better — allow gaps.
8. Dragging a tall item onto the island moves it on its old wall: `moveItem` returns unchanged when `!allowedOn` (L:929) but planner writes `at[key] = pos` with the island coordinate (KP:655). Preview returns null → marker blue (KP:689-691, E:1196). Fix: reject / red marker when `!allowedOn`.
9. Misleading feedback when the item itself doesn't fit: `itemPositions(p)[key]` missing → preview null → blue marker (E:1196, KP:688-691); red only when another item drops (KP:695); then toast. Leaving the wall area hides the marker, drop does nothing (E:1177-1181).
10. Positions reset and every step full-rebuilds: wall resize wipes `at` (KP:1113); shape wipes everything (KP:1103); every move/nudge/width step → full rebuild (E:396-422, KP:863-905); hold-to-repeat nudge every 110 ms (KP:1305) can outrun the rebuild on weak phones. During drag no rebuild, but the real object doesn't follow → feels unresponsive.

Other:
- Selection lost after rebuild: auto cabinets keyed by row + x (`A120`, KP:1218-1223); after a neighbour shift `measureCab` fails (KP:892-897, E:792-801) → card/dims disappear, `grab` stale, mouse falls back to rotate (E:959).
- No page scroll over the canvas (kitchen.css:107) — serious in landscape (3487-3500).
- Damping drift: controls disabled mid-hold after OrbitControls started a rotation (E:1150); damped rotation continues in `tick` (E:1577).
- Hint weak on touch: never mentions long-press, neighbours adapt, wall cabinets fixed (texts.ts:183, 79, 520); auto-hides 9 s (KP:1045-1049) and on first tap (KP:639).
- Tap to select also swings the door (E:995-996).
- Island and wall A target zones overlap in the aisle (z −0.5..2.2 for each run, E:1173-1175) → target flips mid-aisle.
- Texts exist only in RU and KY (texts.ts:1337-1338).
