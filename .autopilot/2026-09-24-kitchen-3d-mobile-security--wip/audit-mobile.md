# Диагностика на iPhone 390×844 (агент, читал только; проверено в Chrome-эмуляции)

T = KitchenPlanner.tsx, C = kitchen.css, E = three/engine.ts.

1. **«3D» синяя.** T:1982-1988 — 4 кнопки `role=radio`, вид `angle` стартовый, `C:212`
   `.kp-seg__btn[aria-checked='true'] { background: cobalt; color: #fff }`. Причины «залипания»
   на iOS: нет `-webkit-tap-highlight-color: transparent`; `.kp-seg__btn:hover` (C:208) без
   `@media (hover: hover)`; `.kp-seg { backdrop-filter: blur(6px) }` (C:182-191) + `transition:
   background` у кнопки (C:203) — WebKit рисует «призрак».
2. **«⋯» не видно.** Это `.kp-tools__more` (T:2018-2029) и лист `.kp-tools__extra.is-open`
   (T:2031). Кнопка есть (C:2435 `inline-flex; order:3`), только значок без слова. Лист
   `position: fixed; bottom: var(--kp-nav)` (C:2849-2863) внутри `.kp-stage` (z-index 20,
   C:2737); `.bottom-nav` z-index 100 (globals.css:530), `.assistant` 120 — низ листа может
   уходить под нижнее меню.
3. **Полный экран.** Только CSS: T:1873 `kp--full`, T:740-754 `html.kp-lock`, C:1968-1976
   `.kp--full .kp-stage { position: fixed; inset: 0; z-index: 200; height: 100dvh }`.
   Доступны виды, ↶↷, Фото, ⋯, ⛶, `.kp-sel` (C:2841). Недоступны вкладки шагов и панель.
4. **Касания.** Конфликта кнопок с вращением нет: слушатели на `renderer.domElement`
   (E:308-320), `.kp-tools { pointer-events: none }` (C:166-180). `.kp-canvas { touch-action:
   none }` (C:92). `contextmenu` отменён (E:320); `-webkit-touch-callout` нет. Площадь 36svh
   минус верхний ряд и виды снизу ≈ 190px свободных; `HOLD_MS` 380 (E:105).
5. **Адаптация.** E:204-260, 1505-1518, 1378-1445: `mobile`, `weak`, `lowEnd` (iPhone никогда
   не lowEnd — память не сообщает, GPU «Apple GPU»). На mobile нет composer, солнца,
   RectAreaLight; тени 2048 (1024 lowEnd); `prewarmPhoto` не идёт (E:1235). Нет: `antialias`
   всегда true (E:207); `captureRoom` на телефоне не отключён (E:1419, 1448); паузы по
   `visibilitychange` нет; `baseRatio` в движении 1.5 (E:1512); fineRatio на iPhone = dpr 3
   (E:1482).
6. **Панель на STACKED.** Виды (C:2748 абсолютно слева внизу), undo/redo, Фото (текст),
   ⋯ (без текста), ⛶; в листе ⋯: вечер, цены, размеры, чёткость HD/4K.
   Консультант: `html.kp-pinned .assistant` — `top: calc(var(--kp-stage-h) - 54px); right: 10px`
   (C:2774) — сидит на картинке.
