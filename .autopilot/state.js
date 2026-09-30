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
  "updatedAt": "2026-09-30T10:11:49+06:00",
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
      "tests": { "passed": 906, "failed": 0 },
      "commit": "a10698b",
      "files": ["lib/kitchen/layout.ts", "lib/kitchen/types.ts", "lib/kitchen/share.ts", "lib/kitchen/order.ts", "lib/kitchen/drag.ts"],
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
      "tests": { "passed": 888, "failed": 0 },
      "commit": "7e77a28",
      "files": ["three/quality.ts", "three/engine.ts", "three/build.ts", "three/materials.ts", "three/parts.ts", "three/appliances.ts"],
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
      "tests": { "passed": 899, "failed": 0 },
      "commit": "02e5a9c",
      "files": ["three/engine.ts", "three/build.ts", "KitchenPlanner.tsx", "lib/kitchen/layout.ts", "lib/kitchen/share.ts", "e2e/kitchen-gestures.spec.ts"],
      "startedAt": "2026-09-29T23:06:17+06:00",
      "retries": 0,
      "repairs": 1,
      "repairFindings": ["decorPlan: доска у плиты и чайник у мойки пропали (мёртвое чтение d.board/d.kettle) — R23i"],
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
      "tests": { "passed": 906, "failed": 0 },
      "commit": "69b0e69",
      "files": ["PlanView.tsx", "planGeom.ts", "KitchenPlanner.tsx", "three/engine.ts", "three/build.ts", "kitchen.css", "e2e/kitchen-plan.spec.ts"],
      "startedAt": "2026-09-30T09:34:02+06:00",
      "retries": 0,
      "repairs": 1,
      "repairFindings": ["план: стена B ставит зеркально (cm не от угла) — R16i.1", "is-plan вместе с has-col прячет ценники/подписи в 3D на компьютере — R10/R23i"],
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
      "status": "in-progress",
      "startedAt": "2026-09-30T10:11:49+06:00",
      "retries": 0,
      "repairs": 0,
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
      "status": "pending",
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
      "status": "pending",
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
    "T04 · engine.dangerColor · getComputedStyle на каждый move с fits=false — кэшировать"
],
  "reviewers": {
    "manifestSpec": null,
    "craft": null
  },
  "blind": null
}
