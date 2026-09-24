# 02 — Телефон: виды под 3D, «Ещё» словом, полный экран с панелью

**Требования:** R03, R04, R04.1, R05, R06, R06.1, R06.2, R08, R08.1, R09, R09.1, R02.4, R11.2
**Blocked by:** —
**Зона:** `src/components/kitchen/KitchenPlanner.tsx` · `src/components/kitchen/kitchen.css` · `src/components/kitchen/texts.ts`
**Волна:** 1
**Status:** ready

## Что должно заработать

На телефоне (запрос STACKED `(max-width: 900px) and (min-height: 521px)`) на самой 3D-картинке
остаётся только верхний ряд кнопок. Переключатель видов «3D · В жизни · Спереди · Сверху»
и кнопка консультанта стоят в полосе под картинкой внутри прилипшего блока. Выбранный вид
выглядит как вкладка, не как залипшая синяя кнопка, без серой вспышки iOS. Кнопка «⋯»
подписана «Ещё», её лист всегда поверх нижнего меню сайта. В полном экране снизу — вкладки
шагов, настройки шага выезжают листом поверх 3D: кухню можно собрать, не выходя из полного
экрана. На компьютере всё как было.

## Из брифа, дословно

> «телда яхши ишлайдиган кил !»
> «3D Ни агар боссам копия богандей кок бопколяпти кегин 3 та точка телда коринмаяпти»
> «Полный телда удобный хамма одам ишлатадиган килип бер»
> «Телда инстурментларни осон ишлатсин бир бирига 3D Картина бн конфликт болмасин !»

## Разделы спецификации

Истории 9–17, 24b, Решения §3–5. Диагноз — `audit-mobile.md` в папке прогона.

## Критерии приёмки

- [ ] STACKED: `--kp-stage-h: clamp(260px, 38svh, 420px)`; внутри `.kp-stage` холст занимает `calc(100% - 40px)`, под ним полоса 40px сплошного фона (`white-canvas`, верхняя линия `mist-border`): слева `.kp-views`, справа место 44px под кнопку консультанта; `html.kp-pinned .assistant:not(.is-open)` встаёт в эту полосу (`top: calc(var(--kp-stage-h) - 40px + 2px)`, 36px кнопка), а не на картинку. `.kp-hint`, размерные подписи и `--kp-tools-h` не ломаются
- [ ] `.kp-views`: везде (и на компьютере) стиль сегмента iOS — дорожка `rgb(38 50 68 / 8%)`, выбранный — белая таблетка, тень `0 1px 2px rgb(38 50 68 / 18%)`, текст `midnight-ink` 650; кобальтовая заливка у `.kp-views .kp-seg__btn[aria-checked=true]` убрана; остальные `.kp-seg` (HD/4K) не трогать
- [ ] `.kp button { -webkit-tap-highlight-color: transparent }`; hover-правила `.kp-seg__btn:hover`, `.kp-toggle:hover` обёрнуты в `@media (hover: hover)`; на `(pointer: coarse)` у `.kp-seg` и `.kp-toggle` `backdrop-filter: none` и непрозрачный фон
- [ ] Кнопка `.kp-tools__more` на STACKED показывает значок + слово «Ещё» (ru) / «Дагы» (ky) из `texts.ts` (`toolsMoreShort`); `aria-label` остаётся полный. Правило `html:has(.kp-tools__extra.is-open) .kp-stage { z-index: 130 }` — лист выше нижнего меню (100) и консультанта (120)
- [ ] `.kp-canvas`: `-webkit-touch-callout: none; -webkit-user-select: none; user-select: none`; `touch-action: none` остаётся
- [ ] Полный экран на STACKED: новое состояние `fullPanel` (false при входе/выходе). Корень получает `is-panel`. `.kp--full .kp-steps { position: fixed; left:0; right:0; bottom:0; z-index: 202; height: calc(var(--kp-steps-h, 56px) + env(safe-area-inset-bottom,0px)); padding-bottom: env(safe-area-inset-bottom,0px) }`; `.kp--full .kp-body { display: none }`; `.kp--full.is-panel .kp-body { display:block; position: fixed; left:0; right:0; bottom: calc(var(--kp-steps-h,56px) + env(safe-area-inset-bottom,0px)); max-height: 55dvh; overflow:auto; z-index: 201; background: white-canvas; border-radius: 18px 18px 0 0; box-shadow как у .kp-sel; animation kp-sheet }` с ручкой (`::before` 36×4 px) и крестиком «Скрыть» в шапке (закрывает только лист). Тап по текущей вкладке — переключает `fullPanel`; тап по другой — `goStep` + `fullPanel=true`. `.kp-sel` и лист «Ещё» в полном экране остаются выше (`z-index` ≥ 203). Холст в полном экране — `height: calc(100dvh - var(--kp-steps-h) - env(...))`, а не под вкладками
- [ ] Desktop `kp--full` без изменений; Esc выходит; `reframe()` вызывается при смене `fullPanel` (размер холста меняется)
- [ ] `localStorage kp-variants`: разбор через `Array.isArray` и фильтр `typeof v?.q === 'string' && typeof v?.name === 'string'`; мусор → пустой список без падения
- [ ] Перед правкой прочитать `/Users/doniyorabduganiev/.claude/skills/impeccable/reference/craft-floor.md` и `/Users/doniyorabduganiev/.claude/skills/impeccable/reference/adapt.md`; после правки — самопроверка по craft-floor (без открытия браузера; браузер проверяет оркестратор)
- [ ] `npx tsc --noEmit` зелёный; `npx vitest run` зелёный
- [ ] В `docs/HANDOFF.md` раздел «Удобство на телефоне и компьютере» дополнен абзацем от 24.09.2026 (полоса видов, «Ещё», полный экран с панелью) — коротко, в стиле файла
