window.STATE =
{
  "slug": "kitchen-3d-pro",
  "dir": "2026-09-29-kitchen-3d-pro--wip",
  "title": "3D-конструктор кухни — как у профессионалов: свободная расстановка, план сверху, телефон",
  "mode": "full",
  "depth": "normal",
  "polish": {
    "rounds": 0,
    "max": 3
  },
  "tier": "T2",
  "briefFile": "2026-09-29-brief.md",
  "memoryFile": "CLAUDE.md",
  "skillDir": "/Users/doniyorabduganiev/.claude/skills/autopilot",
  "startedAt": "2026-09-29T22:14:27+06:00",
  "updatedAt": "2026-10-01T04:13:13+06:00",
  "finishedAt": null,
  "stages": [
    {
      "id": "preflight",
      "status": "done",
      "startedAt": "2026-09-29T22:14:27+06:00",
      "finishedAt": "2026-09-29T22:15:25+06:00"
    },
    {
      "id": "manifest",
      "status": "active",
      "startedAt": "2026-09-29T22:15:25+06:00"
    },
    {
      "id": "briefing",
      "status": "pending"
    },
    {
      "id": "spec",
      "status": "pending"
    },
    {
      "id": "plan",
      "status": "pending"
    },
    {
      "id": "build",
      "status": "pending"
    },
    {
      "id": "review",
      "status": "pending"
    },
    {
      "id": "final",
      "status": "pending"
    }
  ],
  "requirements": {
    "total": 24,
    "done": 1,
    "inTicket": 0,
    "inSpec": 0,
    "placeholder": 0,
    "deferred": 0,
    "dropped": 0
  },
  "tickets": [
    {
      "id": "01",
      "title": "Модель расстановки: пустое место, ручной верх, постановка с точкой захвата",
      "requirements": [
        "R05",
        "R05.1",
        "R05.2",
        "R05.4",
        "R05.5",
        "R17i",
        "R18i",
        "R04",
        "R23i",
        "R23i.1",
        "A01"
      ],
      "blockedBy": [],
      "wave": 1,
      "zone": [
        "src/lib/kitchen/",
        "src/components/kitchen/drawing.ts",
        "src/components/kitchen/pdfSheet.ts",
        "__tests__/"
      ],
      "status": "done",
      "finishedAt": "2026-09-29T23:06:17+06:00",
      "tests": {
        "passed": 914,
        "failed": 0
      },
      "commit": "a10698b",
      "files": [
        "lib/kitchen/layout.ts",
        "lib/kitchen/types.ts",
        "lib/kitchen/share.ts",
        "lib/kitchen/order.ts",
        "lib/kitchen/drag.ts"
      ],
      "startedAt": "2026-09-29T22:26:02+06:00",
      "retries": 0,
      "repairs": 0,
      "handoffs": 0
    },
    {
      "id": "02",
      "title": "Качество и скорость: класс устройства, лёгкие материалы, статичные тени, 4K только в фото",
      "requirements": [
        "R06",
        "R06.1",
        "R07",
        "R21i",
        "R11"
      ],
      "blockedBy": [],
      "wave": 1,
      "zone": [
        "src/components/kitchen/three/"
      ],
      "status": "done",
      "finishedAt": "2026-09-29T22:50:09+06:00",
      "tests": {
        "passed": 888,
        "failed": 0
      },
      "commit": "7e77a28",
      "files": [
        "three/quality.ts",
        "three/engine.ts",
        "three/build.ts",
        "three/materials.ts",
        "three/parts.ts",
        "three/appliances.ts"
      ],
      "startedAt": "2026-09-29T22:26:02+06:00",
      "retries": 0,
      "repairs": 0,
      "handoffs": 0
    },
    {
      "id": "03",
      "title": "Жесты в 3D: шкаф идёт за пальцем, одно правило пальца",
      "requirements": [
        "R05",
        "R05.3",
        "R05.4",
        "R05.5",
        "R17i",
        "R19i",
        "R19i.1",
        "R19i.2",
        "R04",
        "A02"
      ],
      "blockedBy": [
        "01",
        "02"
      ],
      "wave": 2,
      "zone": [
        "src/components/kitchen/three/engine.ts",
        "src/components/kitchen/three/build.ts",
        "src/components/kitchen/KitchenPlanner.tsx",
        "src/lib/kitchen/layout.ts",
        "e2e/"
      ],
      "status": "done",
      "finishedAt": "2026-09-30T09:34:02+06:00",
      "tests": {
        "passed": 899,
        "failed": 0
      },
      "commit": "02e5a9c",
      "files": [
        "three/engine.ts",
        "three/build.ts",
        "KitchenPlanner.tsx",
        "lib/kitchen/layout.ts",
        "lib/kitchen/share.ts",
        "e2e/kitchen-gestures.spec.ts"
      ],
      "startedAt": "2026-09-29T23:06:17+06:00",
      "retries": 0,
      "repairs": 1,
      "repairFindings": [
        "decorPlan: доска у плиты и чайник у мойки пропали (мёртвое чтение d.board/d.kettle) — R23i"
      ],
      "handoffs": 0
    },
    {
      "id": "04",
      "title": "План сверху: интерактивный SVG, те же жесты, «+» на пустом месте",
      "requirements": [
        "R16i",
        "R16i.1",
        "R16i.2",
        "R18i",
        "R18i.1",
        "R10",
        "R22i.1",
        "A01"
      ],
      "blockedBy": [
        "03"
      ],
      "wave": 3,
      "zone": [
        "src/components/kitchen/PlanView.tsx",
        "src/components/kitchen/KitchenPlanner.tsx",
        "src/components/kitchen/kitchen.css"
      ],
      "status": "done",
      "finishedAt": "2026-09-30T10:11:49+06:00",
      "tests": {
        "passed": 906,
        "failed": 0
      },
      "commit": "69b0e69",
      "files": [
        "PlanView.tsx",
        "planGeom.ts",
        "KitchenPlanner.tsx",
        "three/engine.ts",
        "three/build.ts",
        "kitchen.css",
        "e2e/kitchen-plan.spec.ts"
      ],
      "startedAt": "2026-09-30T09:34:02+06:00",
      "retries": 0,
      "repairs": 1,
      "repairFindings": [
        "план: стена B ставит зеркально (cm не от угла) — R16i.1",
        "is-plan вместе с has-col прячет ценники/подписи в 3D на компьютере — R10/R23i"
      ],
      "handoffs": 0
    },
    {
      "id": "05",
      "title": "Телефон: 3D на полэкрана, нижняя панель, четыре шага, лист выбора, клавиатура",
      "requirements": [
        "R03",
        "R08",
        "R10",
        "R20i",
        "R20i.1",
        "R20i.2",
        "R20i.3",
        "R09",
        "R01",
        "R24i"
      ],
      "blockedBy": [
        "04"
      ],
      "wave": 4,
      "zone": [
        "src/components/kitchen/KitchenPlanner.tsx",
        "src/components/kitchen/kitchen.css",
        "src/components/kitchen/texts.ts"
      ],
      "status": "done",
      "finishedAt": "2026-09-30T10:40:38+06:00",
      "tests": {
        "passed": 906,
        "failed": 0
      },
      "commit": "caa8deb",
      "files": [
        "KitchenPlanner.tsx",
        "kitchen.css",
        "texts.ts",
        "three/engine.ts",
        "e2e/kitchen-phone.spec.ts"
      ],
      "startedAt": "2026-09-30T10:11:49+06:00",
      "retries": 0,
      "repairs": 1,
      "repairFindings": [
        "холст 3D на телефоне ≈ 45 % вместо ≥ 50 % (полоса видов внутри 50svh) — R20i/R03"
      ],
      "handoffs": 0
    },
    {
      "id": "06",
      "title": "Меньше лишнего: карусель стилей, 16 цветов, «ещё», один WhatsApp, без переключателя качества",
      "requirements": [
        "R11",
        "R22i",
        "R22i.1",
        "R08",
        "R21i",
        "R07",
        "A02"
      ],
      "blockedBy": [
        "05"
      ],
      "wave": 5,
      "zone": [
        "src/components/kitchen/KitchenPlanner.tsx",
        "src/components/kitchen/ReadyStrip.tsx",
        "src/lib/kitchen/styles.ts"
      ],
      "status": "done",
      "finishedAt": "2026-09-30T14:24:44+06:00",
      "tests": {
        "passed": 914,
        "failed": 0
      },
      "commit": "b9f9e97",
      "files": [
        "KitchenPlanner.tsx",
        "ReadyStrip.tsx",
        "kitchen.css",
        "texts.ts",
        "lib/kitchen/styles.ts",
        "e2e/kitchen-simplify.spec.ts"
      ],
      "startedAt": "2026-09-30T10:40:38+06:00",
      "retries": 0,
      "repairs": 0,
      "handoffs": 0
    },
    {
      "id": "07",
      "title": "Сквозная проверка: телефон и компьютер, старые ссылки, скорость",
      "requirements": [
        "R23i",
        "R23i.1",
        "R01",
        "R24i",
        "R02",
        "R12",
        "R13",
        "R14",
        "R04"
      ],
      "blockedBy": [
        "06"
      ],
      "wave": 6,
      "zone": [
        "e2e/",
        "__tests__/",
        "docs/"
      ],
      "status": "done",
      "finishedAt": "2026-09-30T15:06:43+06:00",
      "tests": {
        "passed": 914,
        "failed": 0
      },
      "commit": "09ed760",
      "files": [
        "e2e/kitchen-acceptance.spec.ts",
        "e2e/kp.ts",
        "playwright.config.ts",
        "docs/KITCHEN_E2E_UZ.md"
      ],
      "startedAt": "2026-09-30T14:24:44+06:00",
      "retries": 0,
      "repairs": 0,
      "handoffs": 0
    },
    {
      "id": "C1",
      "title": "Разбор concerns: дубли, мёртвый код, мелкие дефекты",
      "requirements": [
        "R04",
        "R23i"
      ],
      "blockedBy": [
        "07"
      ],
      "wave": 7,
      "zone": [
        "src/lib/kitchen/",
        "src/components/kitchen/",
        "e2e/kp.ts"
      ],
      "status": "done",
      "finishedAt": "2026-09-30T20:28:42+06:00",
      "tests": {
        "passed": 951,
        "failed": 0
      },
      "commit": "3bfd3bf",
      "startedAt": "2026-09-30T15:17:50+06:00",
      "retries": 0,
      "repairs": 1,
      "repairFindings": [
        "выпавшее пустое место подписано «Пенал» в предупреждении; apply не ужимает соседний gap — R23i"
      ],
      "handoffs": 1
    },
    {
      "id": "C2",
      "title": "Разбор concerns: недостающие тесты",
      "requirements": [
        "R23i",
        "R04"
      ],
      "blockedBy": [
        "C1"
      ],
      "wave": 8,
      "zone": [
        "__tests__/",
        "e2e/"
      ],
      "status": "done",
      "finishedAt": "2026-09-30T20:57:04+06:00",
      "tests": {
        "passed": 951,
        "failed": 0
      },
      "commit": "d84dc8f",
      "startedAt": "2026-09-30T20:28:42+06:00",
      "retries": 0,
      "repairs": 0,
      "handoffs": 1
    },
    {
      "id": "P1",
      "title": "Доводка 1: соседи не меняются, одно правило переноса, «+» и подписи плана",
      "requirements": [
        "R05",
        "R05.1",
        "R04",
        "R18i",
        "R16i.1"
      ],
      "blockedBy": [
        "C2"
      ],
      "wave": 9,
      "zone": [
        "src/lib/kitchen/layout.ts",
        "src/components/kitchen/PlanView.tsx",
        "src/components/kitchen/KitchenPlanner.tsx"
      ],
      "status": "done",
      "finishedAt": "2026-09-30T22:59:09+06:00",
      "tests": {
        "passed": 968,
        "failed": 0
      },
      "commit": "7aee880",
      "startedAt": "2026-09-30T21:07:21+06:00",
      "retries": 1,
      "repairs": 1,
      "repairFindings": [
        "автошкафы закреплены и на целевой стене — в стартовой кухне модуль никуда не встаёт (R05)"
      ],
      "handoffs": 1
    },
    {
      "id": "P2",
      "title": "Доводка 1: камера и выбор на телефоне, компьютер в одно окно, лист мастера",
      "requirements": [
        "R20i",
        "R03",
        "R10",
        "R02",
        "R09"
      ],
      "blockedBy": [
        "P1"
      ],
      "wave": 10,
      "zone": [
        "src/components/kitchen/three/engine.ts",
        "src/components/kitchen/KitchenPlanner.tsx",
        "src/components/kitchen/kitchen.css"
      ],
      "status": "done",
      "finishedAt": "2026-09-30T23:33:54+06:00",
      "tests": {
        "passed": 968,
        "failed": 0
      },
      "commit": "68fc3fe",
      "startedAt": "2026-09-30T22:59:09+06:00",
      "retries": 0,
      "repairs": 0,
      "handoffs": 1
    },
    {
      "id": "P3",
      "title": "Доводка 2: обмен местами, без обрезков 22 см, подписи мойки",
      "requirements": [
        "R05",
        "R04",
        "R02"
      ],
      "blockedBy": [
        "P2"
      ],
      "wave": 11,
      "zone": [
        "src/lib/kitchen/layout.ts",
        "src/components/kitchen/drawing.ts"
      ],
      "status": "done",
      "finishedAt": "2026-10-01T00:13:17+06:00",
      "tests": {
        "passed": 983,
        "failed": 0
      },
      "commit": "c585d94",
      "startedAt": "2026-09-30T23:46:39+06:00",
      "retries": 0,
      "repairs": 0,
      "handoffs": 1
    },
    {
      "id": "P4",
      "title": "Доводка 2: карточка, консультант, план «показать всё», чёткость телефона",
      "requirements": [
        "R10",
        "R03",
        "R20i",
        "R07",
        "R16i"
      ],
      "blockedBy": [
        "P3"
      ],
      "wave": 12,
      "zone": [
        "src/components/kitchen/KitchenPlanner.tsx",
        "src/components/kitchen/PlanView.tsx",
        "src/components/kitchen/kitchen.css",
        "src/components/kitchen/three/"
      ],
      "status": "done",
      "finishedAt": "2026-10-01T00:50:25+06:00",
      "tests": {
        "passed": 983,
        "failed": 0
      },
      "commit": "832f2ad",
      "startedAt": "2026-10-01T00:13:17+06:00",
      "retries": 0,
      "repairs": 1,
      "repairFindings": [
        "MSAA half-float на телефоне без запасного пути — риск чёрного кадра (R07/R24i); кнопки 32 px у телефона боком"
      ],
      "handoffs": 1
    },
    {
      "id": "P5",
      "title": "Доводка 3: вытяжка над варочной, обмен вместо дыры, выбор на плане",
      "requirements": [
        "R04",
        "R05",
        "R23i",
        "R16i"
      ],
      "blockedBy": [
        "P4"
      ],
      "wave": 13,
      "zone": [
        "src/lib/kitchen/",
        "src/components/kitchen/PlanView.tsx",
        "src/components/kitchen/planGeom.ts"
      ],
      "status": "done",
      "finishedAt": "2026-10-01T04:13:13+06:00",
      "tests": { "passed": 989, "failed": 0 },
      "commit": "a6c72e1",
      "startedAt": "2026-10-01T00:59:15+06:00",
      "retries": 0,
      "repairs": 1,
      "repairFindings": ["предпросмотр рисует обмен на −33…−44 см, отпускание ставит уступкой — разные пороги (R04)"],
      "handoffs": 1
    },
    {
      "id": "P6",
      "title": "Доводка 3: одна панель, кухня крупно, пропорции компьютера, одна карточка",
      "requirements": [
        "R03",
        "R20i",
        "R10"
      ],
      "blockedBy": [
        "P5"
      ],
      "wave": 14,
      "zone": [
        "src/components/kitchen/KitchenPlanner.tsx",
        "src/components/kitchen/kitchen.css",
        "src/components/kitchen/three/engine.ts"
      ],
      "status": "in-progress",
      "startedAt": "2026-10-01T04:13:13+06:00",
      "retries": 0,
      "repairs": 0,
      "handoffs": 0
    }
  ],
  "singlePass": null,
  "tests": { "passed": 862, "failed": 0 },
  "debt": {
    "placeholders": [],
    "assumptions": [],
    "emptyEnv": []
  },
  "additions": [],
  "coverage": { "found": 4, "fixed": 4, "deferred": 0, "extras": 7, "note": "полупокрыто: черты планировщиков не перечислены → таблица; 4K живого вида не оговорено → оговорено; класс lowEnd → phone-low; проверка в приложениях → WebKit/Chromium + подтверждение владельца. Добавки сверх брифа помечены A01, A02, R08/R19i/R20i.n" },
  "concerns": [
    "T02 · engine.ts:409–430 · фото техники пересобирает всю стену, пометка photoFace не читается — плитка-only не сделана (спека §7)",
    "T02 · build.ts:1837 · смена цвета фасадов (общая для всех стен) = полная пересборка; остров/overFridge могли бы не трогать соседние стены",
    "T02 · quality.ts:104–121 · desktop-weak в покое ниже прежнего компьютерного (2× / 4 Мп вместо 3× / 8,3 Мп) — решение не записано",
    "T02 · engine.ts:853–925 · renderCorner дублирует thumbnail (viewport/scissor/снимок)",
    "T02 · engine.ts:167 + quality.ts:186 · правило «телефон = coarse && !fine» написано дважды",
    "T02 · engine.ts:876 · shadowMap.needsUpdate = auto || true — auto мёртвая",
    "T02 · parts.ts:77–85 · noShadow подменяет метод add у Group; достаточно traverse",
    "T02 · engine.ts:329–349 · compileFirst в finally восстанавливает начальное состояние тени, а не текущее",
    "T02 · без теста: вечерние лампы visible=false днём; ручки castShadow=false",
    "T02 · kitchen-quality.test.ts:52 · ожидание 2,886 посчитано формулой кода; лучше проверять бюджет по существу",
    "T02 · CLAUDE.md:248–254 · «Подводные камни» описывают удалённый governor.ts/lowEnd/kp-quality — обновить в фазе памяти",
    "T01 · share.ts · пустые места хранятся в o=, отдельного g= (как в спеке §8) нет — записано в interfaces как решение",
    "T01 · layout.ts · placeAt/narrowFor/detachUppers/resizeWalls требуют planner/plan от экрана — модуль не самодостаточен",
    "T01 · layout.ts · планка (strip) — флаг пустого места, в спецификацию/раскрой не идёт; решить в T04/T05",
    "T01 · layout.ts:459 · при нехватке длины пустое место выпадает первым и молча (не в dropped)",
    "T01 · layout.ts · cutWindow дублирует правило окна из uppersFor; обратный перевод центра для стены B inline; HOB_SIDE=30 записано дважды; placeWith: мёртвые cm/grab",
    "T01 · kitchen-place.test.ts · gap-невидимость выгрузок проверена одним структурным тестом, не на каждую выгрузку",
    "T03 · e2e/kitchen-gestures.spec.ts:107-129 · числа сценария «перенос на другую стену» взяты из стартовой раскладки без явного адреса и комментария",
    "T03 · engine.ts · «ключ сцены»/разбор A120 повторяется в 4 местах движка и в dragBaseFor планировщика — одна parseSceneKey",
    "T03 · engine.ts setKitchen · revertDrag перед пересборкой делает лишние setSelected/showMeasure на уходящем объекте",
    "T03 · build.ts · RunCache.lemons/props, ctx.lemons, done.board/kettle — мёртвый учёт после decorPlan; выпавшая техника входит в runKey каждого ряда",
    "T03 · kitchen-place.test.ts:309-321 · тест filler на синтетическом плане, не на угловой кухне из снимка",
    "T03 · KitchenPlanner.tsx resize · три поля продублированы после спреда",
    "T03 · e2e · положительный путь «Сузить» (кнопка есть и ставит) без e2e после починки",
    "T04 · planGeom.ts:14-18 / drawing.ts:440 / PlanSketch.tsx · формула «точка ряда → мир» в трёх местах; PlanView заново рисует стены/окно/цепочки, которые рисует planSvg — одна геометрия на чертёж и план",
    "T04 · KitchenPlanner.tsx addNarrow · ширина нового шкафа 60 и ключ-заглушка k0; addAt должен сам возвращать fit при неудаче",
    "T04 · PlanView.tsx:299 · чтение downRef.current во время рендера",
    "T04 · planGeom.ts:99,109 + engine.ts keyAt · порог «планка < 15 см не берётся» продублирован",
    "T04 · kitchen-plan-view.test.ts · rectOf для повёрнутых рядов (B, остров) и planFrame не покрыты",
    "T04 · перетаскивание из плана не двигает объект в 3D во время жеста (только после отпускания)",
    "T04 · меню «+» → «техника» открывает шаг «Техника» и первый пустой слот, а не ставит в точку",
    "T04 · addPicked · при всех занятых слотах переносится всегда посудомойка, не выбор пользователя; не влезла — без тоста",
    "T04 · engine.dangerColor · getComputedStyle на каждый move с fits=false — кэшировать",
    "T05 · KitchenPlanner.tsx SizeField keepInView · поле ищет .kp-stage через document.querySelector — знание о раскладке в дочернем поле",
    "T05 · KitchenPlanner.tsx:2779 · planShownRef.current = planShown во время рендера — перенести в useEffect",
    "T05 · kitchen.css .kp--bar .kp-body * scroll-margin · универсальный селектор",
    "T05 · KitchenPlanner.tsx:1358 · дубли полей после спреда в update(next) остались с таска 03",
    "T05 · сцена телефона 50svh включает полосу видов 40 px — холст 50svh − 40",
    "T05 · goStep больше не включает камеру «Сверху» на размерах; вид top — почти мёртвая ветка (решить в T06)",
    "T05 · kitchen.css:3097 · 40 px полосы видов вписан числом (не var(--kp-strip)) — при смене полосы править два места",
    "T06 · KitchenPlanner.tsx:3798-3932 · блок «shortList + Ещё N/Свернуть» повторён трижды; фильтры TOPS/SPLASHES считаются по три раза",
    "T06 · ready.ts BUDGET_CHIPS/inBudget · фильтр бюджета живёт только ради своего теста",
    "T06 · KitchenPlanner.tsx · два whatsappHref с одним текстом (masterPage и .kp-sum__wa)",
    "T06 · styles.ts:891-905 · carouselStyles через shortList — трюк, читается хуже прямого [sel, ...FEATURED.slice(0,7)]",
    "T06 · ApplianceSheet supplyHref · второй wa.me («спросить о поставке») на шаге «Техника» — другая функция, записано",
    "T07 · e2e/__snapshots__ · снимки 12 готовых сняты с локального каталога (без холодильников/посудомоек) — страж регрессий отсюда, не «как до правок»; переснять при первом прогоне против живого каталога",
    "T07 · kitchen-acceptance:182-200 · черта 2: магнит (snap) в e2e не проверяется — только unit previewMove",
    "T07 · kitchen-acceptance:382-437 · замер кадра на классе phone (не phone-low), p95 только печатается, порог 33 при среднем 16,7 ловит лишь сильные провалы",
    "T07 · kitchen-acceptance:314-329 · 17 кухонь в одном test — первая ошибка прячет остальные",
    "T07 · e2e · помощники ready/fire/tap/drag переписаны в пяти спеках; профиль chrome гоняет kitchen-* повторно",
    "T07 · старые e2e сайта (cart, catalog, checkout, visual, task0*) рассчитаны на npm run start 3100 — против dev 3001 красные (не регрессия)",
    "T07 · docs/KITCHEN_E2E_UZ.md · опечатка «савaтга» (латинская a)",
    "P2 · engine.ts resize() · draw() мимо охраны compiling — resize во время первой compileAsync соберёт шейдеры синхронно",
    "P2 · placeCard · карточка выбора всегда справа сверху; на 1220–1440 px с колонкой плана может закрыть бо́льшую часть 3D",
    "P2 · kitchen.css · на листе мастера на телефоне консультант скрыт целиком (а не сдвинут)",
    "P2 · useLayoutEffect querySelector('header') · может наблюдать .kp-head вместо шапки сайта",
    "P2 · html:has(.kp-sel) .kp-toast · правило действует и на компьютере",
    "P4 · 1280×800 · карточка шкафа с дверцами: строка «Дверца открывается» уходит в прокрутку внутри карточки (~20 px)",
    "P4 · has-col · строка инструментов над колонкой плана — план ниже на ~54 px",
    "P4 · KY-сокращение осей «Т × Б × Т» неоднозначно — проверить носителю",
    "P4 · MSAA на реальных iPhone/Android не проверен (запасной путь есть) — проверить владельцем в приложении",
    "P3 · шкаф 60 перенесён с B на A — варочная на B сдвигается к углу на 30 (нужна столешница у пустого места)",
    "P5 · swapFirst · на пороге «четверть» модуль прыгает (−44 → 168, −46 → 130)"
],
  "reviewers": {
    "manifestSpec": null,
    "craft": null
  },
  "blind": {"ranAt": "2026-09-30T15:17:50+06:00", "launched": true, "commands": ["curl :3001/ru/kitchen → 200", "playwright kitchen-acceptance → 22 passed, 2 skipped", "vitest → 914 passed"], "verdicts": {"аудит/лишнее": "реализовано", "телефон удобно": "реализовано", "шкаф куда хочу": "реализовано", "пустое место и +": "реализовано", "план сверху": "реализовано", "скорость/4K": "частично (4K только файл — как решено)", "как у профи": "частично (нет поворота и постановки вне стены — вне рамок)", "дизайн": "реализовано", "удобно на компе": "частично — ценники съезжают при колонке плана", "лист мастера": "реализовано"}, "drift": ["R10: manifest done, blind частично — .kp-tags сдвинуты на ширину колонки плана на 1440×900 → C1"], "extras": ["Проверка проекта 3 из 3 (было)", "тост про «Мои варианты» при открытии по ссылке (было)", "В галерею (было)", "Закрыть планкой / Заполнить автоматически (A01)", "e2e-профили и замер кадра (T07)"], "minor": ["телефон: «Ещё» под листом выбранного → C1", "«Всё поместилось» зелёная при пустом месте (норма)"]}
}
