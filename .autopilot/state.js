window.STATE =
{
  "slug": "kitchen-colors",
  "dir": "2026-09-27-kitchen-colors--wip",
  "title": "Пакет цвета: любой RAL, настоящие декоры ЛДСП с кодом, третий цвет острова",
  "mode": "semi",
  "depth": "normal",
  "polish": null,
  "tier": "T1",
  "briefFile": "2026-09-27-brief.md",
  "memoryFile": "CLAUDE.md",
  "skillDir": "/Users/doniyorabduganiev/.claude/skills/autopilot",
  "startedAt": "2026-09-27T18:05:50+06:00",
  "updatedAt": "2026-09-27T18:47:22+06:00",
  "finishedAt": null,
  "stages": [
    { "id": "preflight", "status": "done", "finishedAt": "2026-09-27T18:06:51+06:00", "startedAt": "2026-09-27T18:05:50+06:00" },
    { "id": "manifest",  "status": "done", "finishedAt": "2026-09-27T18:12:49+06:00", "startedAt": "2026-09-27T18:06:51+06:00" },
    { "id": "briefing",  "status": "done", "startedAt": "2026-09-27T18:12:49+06:00", "finishedAt": "2026-09-27T18:12:49+06:00" },
    { "id": "spec",      "status": "done", "finishedAt": "2026-09-27T18:14:11+06:00", "startedAt": "2026-09-27T18:12:49+06:00" },
    { "id": "plan",      "status": "done", "finishedAt": "2026-09-27T18:14:53+06:00", "startedAt": "2026-09-27T18:14:11+06:00" },
    { "id": "build",     "status": "active", "startedAt": "2026-09-27T18:14:53+06:00" },
    { "id": "review",    "status": "active", "startedAt": "2026-09-27T18:21:17+06:00" },
    { "id": "final",     "status": "pending" }
  ],
  "requirements": {
    "total": 15, "done": 0, "inTicket": 0, "inSpec": 14,
    "placeholder": 0, "deferred": 0, "dropped": 0
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
      "status": "review",
      "startedAt": "2026-09-27T18:14:53+06:00",
      "retries": 0,
      "repairs": 0,
      "handoffs": 0
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
      "status": "review",
      "startedAt": "2026-09-27T18:14:53+06:00",
      "retries": 0,
      "repairs": 0,
      "handoffs": 0
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
      "status": "review",
      "startedAt": "2026-09-27T18:25:40+06:00",
      "retries": 0,
      "repairs": 0,
      "handoffs": 0
    },
    {"id": "04", "title": "Правки ревью: декоры Kronospan, RAL 9012, остров; боковины 3D цветом корпуса", "requirements": ["R05", "R02", "R10", "G01"], "blockedBy": ["01", "02"], "wave": 2, "zone": ["src/lib/kitchen/decors.ts", "src/lib/kitchen/ral.ts", "src/lib/kitchen/share.ts", "src/components/kitchen/three/"], "status": "review", "retries": 0, "repairs": 0, "handoffs": 0, "startedAt": "2026-09-27T18:35:05+06:00"}
  ],
  "singlePass": null,
  "tests": null,
  "debt": { "placeholders": [], "assumptions": ["Декоры — стартовый набор Egger/Kronospan/Lamarty по 10–12, правится по поставщику", "Экранные цвета RAL и декоров примерные — покупателю сказано", "RAL — только крашеный фасад (эмаль МДФ)", "В KY у RAL русское название"], "emptyEnv": [] },
  "additions": [],
  "coverage": {
    "findings": 2,
    "note": "полупокрыто: список декоров не в спеке — собирается в таске 01 по правилу (сверка с каталогом бренда); «сверх брифа»: поиск, код во всех выгрузках, телефон, совместимость, пометка «цвет примерный» — всё привязано к R05.1, R12i, R13i, R14i, R09"
  },
  "concerns": ["[решение] таск 03 запущен до конца ревью 01/02 — владелец торопит («tez tez»); правки ревью 01/02 — после 03"],
  "reviewers": { "manifestSpec": null, "craft": null },
  "blind": null
}
