# Rendering audit: 3D kitchen planner (2026-09-29)

Paths relative to `src/components/kitchen/`. three ^0.186, three-gpu-pathtracer ^0.0.24. Read-only audit.

## 1. Renderer setup (three/engine.ts)

Device classification
- "Phone" = `(pointer: coarse)` and no `(any-pointer: fine)` (245). iPad with trackpad/pencil or a touch laptop counts as desktop.
- `lowEnd` (269-271) = `mobile && (deviceMemory<=3 || (!apple && cores<=4) || LOW_END_GPU regex (109))`.
- `deviceMemory` defaults to 8 when not reported (251). iOS never reports it and is exempt from the core check, so every iPhone (incl. A11/A12) counts as "not low-end".

Context attributes
- `antialias: !safe && !(mobile && memory<=3)` (253): iPhones and good Androids get MSAA.
- `powerPreference: 'high-performance'` unless safe (254). No `stencil:false`.

Pixel ratio
- `canvasRatio = min(dpr, 2)` (287). Initial `setPixelRatio(mobile ? baseRatio : canvasRatio)` (288).
- Phone has no composer: `setRatio`/`applyRatio` call `renderer.setPixelRatio` + `setSize` directly (1788-1791) — the real canvas is resized every time.
- Desktop keeps canvas at `canvasRatio`, only composer targets scale (1793-1797).

Color / tone: SRGB output (289), NeutralToneMapping exposure 1 (290-291); desktop OutputPass (347) then sharpen (349-351).

Shadows
- `shadowMap.enabled = true`, PCFShadowMap (292-293). Sun `castShadow = !lite` (309). `shadowSize()` (1713-1717): lowEnd 1024, phone HD 1024, phone 4K 2048, desktop 4096.
- `windowSun` desktop only, 2048² (319-326).
- `shadowMap.autoUpdate` never turned off — shadow pass re-renders every frame; only frozen inside `captureRoom` (1645-1652).
- Almost every mesh casts+receives shadow, incl. handle parts (parts.ts:76-82).

Environment
- PMREM RoomEnvironment at start (302-305). Optional per-rebuild room cube probe: 6 renders, 128 phone / 256 desktop (1628-1658), only when `roomShot` (desktop non-lite, or phone 4K non-lowEnd, 1729-1732).

Desktop-only composer (332-353): HalfFloat RT 4× MSAA; RenderPass → GTAOPass (16 AO + 16 denoise, 337-339) → UnrealBloom (evening only, 471-476) → OutputPass → sharpen. RectAreaLight desktop only (327-329).

Render loop: on demand (good). `invalidate()` single rAF (1531-1538); `tick()` re-invalidates while tweens run or controls move (1603-1606). Triggers: OrbitControls change (369) + ~1 s damping; tweens (424-451, 1036-1057, 615-632, 889-912); setKitchen/setSelected/showMeasure/drag marker/setTag (1249-1253); resize (1819-1837); visibility (219-232). After motion, 160 ms timer → one refine render at `fineRatio()` (1607-1617). `placeTags()` every frame: getBoundingClientRect + style write per tag (1283-1306).

## 2. Quality tiers (`Quality = 'lite' | 'hd' | '4k'`, 79)

- `quality = safe || mobile ? 'lite' : (saved ?? '4k')` (284-285). Phone always opens Lite; saved choice ignored on phone (comment 278-283). Desktop default 4K even on Intel iGPU; `weakGpu` only disables photo prewarm (257-261, 1387).
- `setQuality` writes `localStorage 'kp-quality'` (1738-1739); user control Лёгкий/HD/4K (KitchenPlanner.tsx:2781-2797, 962-965).
- Safe mode only when the first constructor throws (KitchenPlanner.tsx:739-747), not after context loss.

`applyQuality` (1691-1710):

| Setting | Lite | HD | 4K |
|---|---|---|---|
| Moving ratio, phone | 1 | 1 | min(dpr,1.5); lowEnd 1 |
| Moving ratio, desktop | min(dpr,1.5) | min(dpr,1.5) | clamp(dpr,1.5,2) |
| Texture K | 0.5 | phone 1 / desktop 2 | 2 |
| Texture budget | phone 110 MB / desktop 420 MB | same | phone 200 / desktop 480 |
| Sun shadow | off | phone 1024 / desktop 4096 | phone 2048 / desktop 4096 |
| Room probe | off | desktop only | desktop + non-lowEnd phone |
| Bloom | off | evening desktop | evening desktop |

`fineRatio()` (1660-1671): phone 4K → dpr; HD/Lite → min(dpr,2). Desktop 4K → min(dpr*3,3); HD → min(dpr*2,2). Capped by `sqrt(budget/cssPixels)`; budgets 4K phone 5 MP, desktop 8.3 MP, HD phone 2.4 MP, desktop 4 MP.

Lite removes in build: bump/roughness grain (materials.ts:39,63,82,94,99,113,219,228-233), shelves (build.ts:439), dishes (455), decor (845,1409). Materials stay MeshPhysical with clearcoat/sheen/anisotropy.

On a phone HD looks no sharper than Lite (same ratios). 

Governor (governor.ts): moving frames only (engine.ts:1544-1548, 1596-1599); interval capped 80 ms (28,48); avg of 10 > 30 ms → ratio −0.25 to min 0.6 (10-23, 51-53); 30 consecutive < 17.5 ms → +0.25 to base (54-56). Persists within session (1554-1557), reset on quality change (1709). Only lowers pixels — never shadows/MSAA/lights/materials.

## 3. Scene cost

Geometry / draw calls: no InstancedMesh, no geometry sharing. Every `slab()/box()/rounded()` builds fresh geometry (parts.ts:40-47, 85-90). Carcass merged into 2-3 meshes (parts.ts:57-65; build.ts:430-440) — good. Fronts not merged: framed door 4 slabs + panel (parts.ts:93-98, 139-172); glass door 4 + pane + up to 3 bars (101-118). Handles 1-3 meshes each (195-305). Estimate 10-25 draw calls per cabinet → several hundred per kitchen; each again in the shadow pass and ×6 for the room probe. Raycast `hit()` recursive over whole tree, no BVH (763-770).

Lights always present: `eveningLight()` only sets intensity 0 (build.ts:1601-1606): 3 ceiling SpotLights (1865-1871), 1 SpotLight per wall run (1957-1968), PointLights per pendant (1570). three.js still evaluates intensity-0 lights in every lit fragment. Desktop adds RectAreaLight.

Textures (textures.ts): main-thread Canvas2D, sized by K: wood 512K×1024K (155-207); marble/concrete/planks/herringbone 1024K² (213-265, 311-354, 489-580); fixed: speckle 512, subway 512, zellige 600, brick 1000×500, floorTile 1024, hobTop 600×520, grain/paint 256, sky 16×256. `noise()` per-pixel JS loop over getImageData (141-152) — 4 M px at K=2; marble uses ctx.filter blur (233). anisotropy 16 on everything (83). `scaled()` clones + needsUpdate (128-129). LRU budget counts base bytes only (99, 106-116).

Materials (materials.ts): MeshPhysical for fronts/tops/splash/appliances, clearcoat, sheen (69-71), anisotropy steel/inox/sink (272,296,326), transparent glass (301-303, 350-351). Lite keeps all. Build dispose frees geometry only; materials kept for shader programs (build.ts:1908-1917).

Post (desktop only): sharpen.ts = 5-tap CAS with 4 bilinear fetches each when scale>1 (41-58), CAS sharpen (59-63), vignette (64-65). GTAO at up to 3× CSS resolution is the heavy part on iGPU laptops.

Path tracer (photoreal.ts): WebGLPathTracer 5 bounces, 3 transmissive, MIS (68-81); tiles ~170 k px up to 8×8 (307-310). Runs on «Фото» (`startPhoto` engine.ts:1330-1378). Prewarm skipped on phone/weak (1386-1394). But the Фото button is not hidden on phones (KitchenPlanner.tsx:2722-2730; `togglePhoto` 1727-1743 has no mobile check): phone compiles the tracer (15-60 s, comment 1382) and traces 96 samples at the current buffer size (1314, 1426-1468). `photoBig` 3840 desktop / 2048 phone / 1536 lowEnd (1487); yet `savePhoto` on phone always takes `snapshot4k` raster (KitchenPlanner.tsx:1757-1766).

## 4. Disposal, memory, context loss

- Every change → full rebuild: `setKitchen` → `buildKitchen` whole kitchen, dispose old geometries (engine.ts:396-422). Triggered by useEffect on `buildInput` incl. `photosVersion` (KitchenPlanner.tsx:811-828, 863-905) → every arriving appliance photo rebuilds (772-777). `setEvening` full rebuild (453-458). `setQuality` rebuilds when detail/lite changes (1769).
- Toggling `castShadow` in setQuality (1749-1750) recompiles all programs. No compileAsync anywhere; first-frame compile of dozens of Physical variants is synchronous.
- Style thumbnails: one full buildKitchen per style (detail 0.5) + render every 40 ms on the style step, phones included (KitchenPlanner.tsx:1022-1046; engine.ts:1958-2004).
- Texture cache module-level, survives restarts; prune disposes only scaled clones (textures.ts:106-116). Photo cache never evicted (photo.ts:25-34).
- Context loss: `webglcontextlost` → preventDefault + onError (297-300); planner recreates whole engine when visible, after 2 restarts shows "lost" (KitchenPlanner.tsx:720-735). No `webglcontextrestored`. Restart does not fall back to safe mode. Desktop MSAA targets disposed/reallocated on every motion↔rest switch (`setSamples` 1804-1812).

## 5. Resize / DPR

- ResizeObserver → `resize()` (387-388, 1819-1837): setPixelRatio + setSize at base ratio, invalidate. Uses integer clientWidth/Height (1820-1821) while CSS stretches canvas 100% (kitchen.css:100-105).
- Phone stage `clamp(260px, 38svh, 420px)` (kitchen.css:3094); fullscreen 100dvh (2229) → address-bar show/hide triggers resize + canvas reallocation.
- Max phone resolution: Lite/HD 2 at rest, 1 moving; 4K full dpr (3) at rest with 5 MP budget, 1.5 moving. DPR not capped in 4K on phones (1669).
- Exports separate from live view: `snapshot` 1600×1000 (1870-1900); `snapshot4k` 3840 wide, 2×2 tiles, 1.5× desktop via composer, 1× phone (1906-1955); `photoBig` path tracer (1481-1517). All temporarily resize the live canvas and use current quality → phone Lite exports "4K" with K=0.5 textures, no shadows, no AO.

## 6a. Top 10 performance problems on low-end phones

1. Physical shaders + 4-6 always-on lights even in Lite (build.ts:1601-1606, 1865-1871, 1964; materials.ts:48-73, 85-94). Fix: `visible=false` for evening lights by day; MeshStandard without clearcoat in Lite.
2. Every gesture reallocates the canvas (1779-1791, 1599, 1613). Fix: fixed canvas + scalable offscreen target / viewport scaling on phones.
3. Shadow maps re-render every frame (292-293, parts.ts:79). Fix: `autoUpdate=false`, `needsUpdate` after rebuild/door tween; no castShadow on small parts.
4. Hundreds of draw calls, no instancing/merging (parts.ts:85-118, 195-305). Fix: merge static per-material geometry per cabinet; instance handles.
5. MSAA fixed on for iPhones / ≥4 GB Android (253). Fix: decide from tier; Lite = no MSAA + FXAA.
6. Refine render at rest can be huge (1660-1671) — one long blocking frame, may trigger context loss. Fix: cap phone refine ~1.5-2 MP; skip if last moving frames slow.
7. Governor only lowers resolution, 0.25 steps, 10 slow frames to act (governor.ts:10-23). Fix: tier steps (shadows → bump → materials) before ratio < 1.
8. Full rebuilds cause jank (engine.ts:396-409; KitchenPlanner.tsx:772-777, 863-905; textures.ts:141-152). Fix: incremental rebuild per run/cabinet; textures in worker/OffscreenCanvas; thumbnails cached / pre-rendered on phones.
9. Synchronous, repeated shader compilation (1746-1750). Fix: `compileAsync` behind loader; stable light/shadow counts across modes.
10. Photo and 4K tier available on weak phones (KitchenPlanner.tsx:1727-1743; engine.ts:1330; 270-271); `placeTags` per-frame layout read/write (1283-1306). Fix: gate Фото on mobile; detect old iPhones by frame time; batch/skip tags while moving.

## 6b. Top 5 reasons the live view is blurry on high-DPI phones

1. Phones forced to Lite (285): 1× moving (1702), ≤2× at rest (1669) — 3× upscale in motion on DPR-3 iPhone. HD no better. Fix: default tier renders ≥ min(dpr,2) moving, full DPR at rest; remember choice.
2. Lite textures ¼ size, K=0.5 (1703): wood 256×512, marble 512² over 1-1.8 m (materials.ts:43-57, 152-184); no bump. Fix: keep K=1 in Lite, save on shaders/lights instead.
3. Governor can drop to 0.6× and stay (governor.ts:23, 51-53; recovery needs 30 consecutive fast frames). Fix: min ~0.85 for DPR≥2; time-based recovery.
4. Sharp frame rarely appears: refine only after all motion + 160 ms (1607-1617); damping/tweens count as motion. Fix: refine sooner; higher moving ratio when scene is cheap.
5. No AA/sharpen on phones (332; 253); minor soften from integer clientWidth sizing vs fractional CSS (1820-1831; kitchen.css:100-105). Fix: cheap FXAA/CAS on mobile; size from getBoundingClientRect / devicePixelContentBoxSize.

Export note: phone "4K" saves go through `snapshot4k` with the Lite scene (KitchenPlanner.tsx:1757-1766; engine.ts:1906-1955). Fix: switch to full-detail materials/textures for the export.
