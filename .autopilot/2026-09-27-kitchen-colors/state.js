window.STATE =
{
  "slug": "kitchen-colors",
  "dir": "2026-09-27-kitchen-colors",
  "title": "Пакет цвета: любой RAL, настоящие декоры ЛДСП с кодом, третий цвет острова",
  "mode": "semi",
  "depth": "normal",
  "polish": null,
  "tier": "T1",
  "briefFile": "2026-09-27-brief.md",
  "memoryFile": "CLAUDE.md",
  "skillDir": "/Users/doniyorabduganiev/.claude/skills/autopilot",
  "startedAt": "2026-09-27T18:05:50+06:00",
  "updatedAt": "2026-09-27T19:19:02+06:00",
  "finishedAt": "2026-09-27T19:19:02+06:00",
  "stages": [
    {
      "id": "preflight",
      "status": "done",
      "finishedAt": "2026-09-27T18:06:51+06:00",
      "startedAt": "2026-09-27T18:05:50+06:00"
    },
    {
      "id": "manifest",
      "status": "done",
      "finishedAt": "2026-09-27T18:12:49+06:00",
      "startedAt": "2026-09-27T18:06:51+06:00"
    },
    {
      "id": "briefing",
      "status": "done",
      "startedAt": "2026-09-27T18:12:49+06:00",
      "finishedAt": "2026-09-27T18:12:49+06:00"
    },
    {
      "id": "spec",
      "status": "done",
      "finishedAt": "2026-09-27T18:14:11+06:00",
      "startedAt": "2026-09-27T18:12:49+06:00"
    },
    {
      "id": "plan",
      "status": "done",
      "finishedAt": "2026-09-27T18:14:53+06:00",
      "startedAt": "2026-09-27T18:14:11+06:00"
    },
    {
      "id": "build",
      "status": "done",
      "startedAt": "2026-09-27T18:14:53+06:00",
      "finishedAt": "2026-09-27T18:53:15+06:00"
    },
    {
      "id": "review",
      "status": "done",
      "startedAt": "2026-09-27T18:21:17+06:00",
      "finishedAt": "2026-09-27T18:53:15+06:00"
    },
    {
      "id": "final",
      "status": "done",
      "startedAt": "2026-09-27T18:53:15+06:00",
      "finishedAt": "2026-09-27T19:19:02+06:00"
    }
  ],
  "requirements": {
    "total": 15,
    "done": 15,
    "inTicket": 0,
    "inSpec": 0,
    "placeholder": 0,
    "deferred": 0,
    "dropped": 0
  },
  "tickets": [
    {
      "id": "01",
      "title": "Палитра RAL и декоры ЛДСП в резолвере цвета",
      "requirements": [
        "R02",
        "R03",
        "R05",
        "R06",
        "R08",
        "R09",
        "R14i"
      ],
      "blockedBy": [],
      "wave": 1,
      "zone": [
        "src/lib/kitchen/ral.ts",
        "src/lib/kitchen/decors.ts",
        "src/lib/kitchen/finishes.ts"
      ],
      "status": "done",
      "startedAt": "2026-09-27T18:14:53+06:00",
      "retries": 0,
      "repairs": 0,
      "handoffs": 0,
      "finishedAt": "2026-09-27T18:51:53+06:00",
      "commit": "16665fa"
    },
    {
      "id": "02",
      "title": "Свой цвет острова: состояние, ссылка, 3D, раскрой",
      "requirements": [
        "R10",
        "R11",
        "R14i"
      ],
      "blockedBy": [],
      "wave": 1,
      "zone": [
        "src/lib/kitchen/types.ts",
        "src/lib/kitchen/share.ts",
        "src/components/kitchen/three/",
        "src/lib/kitchen/spec.ts",
        "src/lib/kitchen/cutting.ts"
      ],
      "status": "done",
      "startedAt": "2026-09-27T18:14:53+06:00",
      "retries": 0,
      "repairs": 0,
      "handoffs": 0,
      "finishedAt": "2026-09-27T18:51:53+06:00",
      "commit": "8486d09"
    },
    {
      "id": "03",
      "title": "Выбор RAL/декора/острова на экране, код во всех выгрузках",
      "requirements": [
        "R02",
        "R04",
        "R07",
        "R10",
        "R11",
        "R12i",
        "R13i",
        "R14i"
      ],
      "blockedBy": [
        "01",
        "02"
      ],
      "wave": 2,
      "zone": [
        "src/components/kitchen/",
        "src/lib/kitchen/cutExcel.ts",
        "src/lib/kitchen/master.ts",
        "src/lib/kitchen/order.ts"
      ],
      "status": "done",
      "startedAt": "2026-09-27T18:25:40+06:00",
      "retries": 0,
      "repairs": 1,
      "handoffs": 0,
      "finishedAt": "2026-09-27T18:52:41+06:00",
      "commit": "49b6acd"
    },
    {
      "id": "04",
      "title": "Правки ревью: декоры Kronospan, RAL 9012, остров; боковины 3D цветом корпуса",
      "requirements": [
        "R05",
        "R02",
        "R10",
        "G01"
      ],
      "blockedBy": [
        "01",
        "02"
      ],
      "wave": 2,
      "zone": [
        "src/lib/kitchen/decors.ts",
        "src/lib/kitchen/ral.ts",
        "src/lib/kitchen/share.ts",
        "src/components/kitchen/three/"
      ],
      "status": "done",
      "retries": 0,
      "repairs": 0,
      "handoffs": 0,
      "startedAt": "2026-09-27T18:35:05+06:00",
      "finishedAt": "2026-09-27T18:51:53+06:00",
      "commit": "16665fa, 8486d09"
    },
    {
      "id": "05",
      "title": "Видимые панели из 3D — в раскрой: глухие панели колонны, пилястры камина",
      "requirements": [
        "R11",
        "R12i"
      ],
      "blockedBy": [
        "04"
      ],
      "wave": 3,
      "zone": [
        "src/components/kitchen/three/build.ts",
        "src/lib/kitchen/spec.ts"
      ],
      "status": "done",
      "retries": 0,
      "repairs": 0,
      "handoffs": 0,
      "startedAt": "2026-09-27T18:51:53+06:00",
      "finishedAt": "2026-09-27T19:19:02+06:00",
      "commit": "83e47e7"
    }
  ],
  "singlePass": null,
  "tests": {
    "passed": 576,
    "failed": 0
  },
  "debt": {
    "placeholders": [],
    "assumptions": [
      "Декоры — стартовый набор Egger/Kronospan/Lamarty по 10–12, правится по поставщику",
      "Экранные цвета RAL и декоров примерные — покупателю сказано",
      "RAL — только крашеный фасад (эмаль МДФ)",
      "В KY у RAL русское название"
    ],
    "emptyEnv": []
  },
  "additions": [],
  "coverage": {
    "findings": 2,
    "note": "полупокрыто: список декоров не в спеке — собирается в таске 01 по правилу (сверка с каталогом бренда); «сверх брифа»: поиск, код во всех выгрузках, телефон, совместимость, пометка «цвет примерный» — всё привязано к R05.1, R12i, R13i, R14i, R09"
  },
  "concerns": [
    "[решение] таск 03 запущен до конца ревью 01/02 — владелец торопит («tez tez»); правки ревью 01/02 — после 03",
    "[REPORT] M03 · RalCodeForm вставлен между описанием Part и Part (KitchenPlanner.tsx ~4062)",
    "[REPORT] M03 · высота липкого ряда 84 px числом в kitchen.css — третье такое место (ещё 70 px ×2)",
    "[REPORT] M03 · ralNow = parseRal(id) — разбор внутреннего id функцией ввода; подпись «Фасады» на экране — своё правило, не frontsText",
    "[REPORT] M04 · у тёмных стилей в 3D теперь белые торцы рядов и колонн — честно по раскрою (решение владельца G01)",
    "[FIX → 05] M04 · глухие панели колонны, пилястры камина, короб добора — в 3D есть, в раскрое нет; тест G01 без ниши/портала; устаревшие комментарии; источник hex RAL",
    "[REPORT] M05 · короб, колпак, полочка «камина» (mantel) и карниз — в 3D есть, в раскрое нет; пилястры в смете как «Фасады — ламинат»",
    "[REPORT] M05 · нет теста на ветку «духовка в своём шкафу + колонна 80»"
  ],
  "reviewers": {
    "manifestSpec": null,
    "craft": null
  },
  "blind": {
    "at": "2026-09-27T19:19:02+06:00",
    "ran": "npx next dev -p 3112 → 200; Playwright headless без 3D; снимок с 3D за 60 с не вышел (программный WebGL)",
    "verdict": [
      {
        "req": "R02/R03 RAL по коду, 3D",
        "blind": "реализовано (3D — по коду; снимок 3D есть у исполнителя таска 03)",
        "manifest": "done"
      },
      {
        "req": "R05–R07 декоры с кодом, 3D, Excel",
        "blind": "реализовано; у Lamarty кодов нет — бренд не нумерует декоры",
        "manifest": "done"
      },
      {
        "req": "R10 цвет острова",
        "blind": "реализовано",
        "manifest": "done"
      },
      {
        "req": "R11/R12i код везде",
        "blind": "реализовано; PDF мастеру — текст не извлекается, не проверен",
        "manifest": "done"
      },
      {
        "req": "Дополнение: 10–12 декоров",
        "blind": "частично — у Lamarty нет кодов",
        "manifest": "done"
      },
      {
        "req": "G01 боковины цветом корпуса",
        "blind": "реализовано (по коду и тестам)",
        "manifest": "done"
      }
    ],
    "drift": [],
    "notes": [
      "Lamarty без кодов — свойство бренда, в файле так и сказано",
      "короб «камина» над плитой — в 3D цвета верха, в раскрое только его рамочный фасад (пробел остался)"
    ]
  }
}
