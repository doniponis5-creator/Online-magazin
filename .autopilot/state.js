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
  "updatedAt": "2026-09-29T22:50:09+06:00",
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
      "status": "in-progress",
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
      "tests": { "passed": 862, "failed": 0 },
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
        "e2e/"
      ],
      "status": "pending",
      "retries": 0,
      "repairs": 0,
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
      "status": "pending",
      "retries": 0,
      "repairs": 0,
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
      "status": "pending",
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
    "T02 · CLAUDE.md:248–254 · «Подводные камни» описывают удалённый governor.ts/lowEnd/kp-quality — обновить в фазе памяти"
],
  "reviewers": {
    "manifestSpec": null,
    "craft": null
  },
  "blind": null
}
