window.STATE =
{
  "slug": "kitchen-master-pack",
  "dir": "2026-09-27-kitchen-master-pack--wip",
  "title": "Пакет мастера: раскрой в Excel, кромка, листы, смета мастера",
  "mode": "semi",
  "depth": "normal",
  "polish": null,
  "tier": "T2",
  "briefFile": "2026-09-27-brief.md",
  "memoryFile": "CLAUDE.md",
  "skillDir": "/Users/doniyorabduganiev/.claude/skills/autopilot",
  "startedAt": "2026-09-27T14:53:28+06:00",
  "updatedAt": "2026-09-27T14:57:30+06:00",
  "finishedAt": null,
  "stages": [
    {
      "id": "preflight",
      "status": "done",
      "startedAt": "2026-09-27T14:53:28+06:00",
      "finishedAt": "2026-09-27T14:54:14+06:00"
    },
    {
      "id": "manifest",
      "status": "done",
      "startedAt": "2026-09-27T14:54:14+06:00",
      "finishedAt": "2026-09-27T14:54:14+06:00"
    },
    {
      "id": "briefing",
      "status": "skipped",
      "startedAt": "2026-09-27T14:54:14+06:00",
      "finishedAt": "2026-09-27T14:54:14+06:00",
      "note": "вопросов не потребовалось — формат Excel взят общий (ASSUMPTION)"
    },
    {
      "id": "spec",
      "status": "done",
      "startedAt": "2026-09-27T14:54:14+06:00",
      "finishedAt": "2026-09-27T14:56:36+06:00"
    },
    {
      "id": "plan",
      "status": "done",
      "startedAt": "2026-09-27T14:56:36+06:00",
      "finishedAt": "2026-09-27T14:57:30+06:00",
      "note": "3 таска, ярус T2, 3 волны"
    },
    {
      "id": "build",
      "status": "active",
      "startedAt": "2026-09-27T14:57:30+06:00"
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
    "total": 9,
    "done": 0,
    "inTicket": 8,
    "inSpec": 0,
    "placeholder": 0,
    "deferred": 1,
    "dropped": 0
  },
  "tickets": [
    {
      "id": "01",
      "title": "Детали, кромка и раскладка по листам",
      "requirements": [
        "R02",
        "R03",
        "R04"
      ],
      "blockedBy": [],
      "wave": 1,
      "zone": [
        "src/lib/kitchen/cutting.ts"
      ],
      "status": "in-progress",
      "retries": 0,
      "repairs": 0,
      "handoffs": 0,
      "startedAt": "2026-09-27T14:57:30+06:00"
    },
    {
      "id": "02",
      "title": "Excel для пильного центра",
      "requirements": [
        "R02",
        "R03",
        "R04"
      ],
      "blockedBy": [
        "01"
      ],
      "wave": 2,
      "zone": [
        "src/lib/kitchen/xlsx.ts",
        "src/lib/kitchen/cutExcel.ts",
        "src/components/kitchen/texts.ts"
      ],
      "status": "pending",
      "retries": 0,
      "repairs": 0,
      "handoffs": 0
    },
    {
      "id": "03",
      "title": "Цены мастера, смета PDF, блок «Мастеру»",
      "requirements": [
        "R05",
        "R06",
        "R08i",
        "R09i"
      ],
      "blockedBy": [
        "01",
        "02"
      ],
      "wave": 3,
      "zone": [
        "src/lib/kitchen/master.ts",
        "src/components/kitchen/pdfSheet.ts",
        "src/components/kitchen/KitchenPlanner.tsx",
        "src/components/kitchen/kitchen.css",
        "src/components/kitchen/texts.ts"
      ],
      "status": "pending",
      "retries": 0,
      "repairs": 0,
      "handoffs": 0
    }
  ],
  "singlePass": null,
  "tests": null,
  "debt": {
    "placeholders": [],
    "assumptions": [
      "Формат Excel для распила — общий для пильных центров (образца нет)",
      "Цены мастера хранятся в браузере до кабинета (пакет 2)"
    ],
    "emptyEnv": []
  },
  "additions": [],
  "coverage": {
    "findings": 5,
    "note": "1 мм кромки назначена; карта раскроя (7a); колонки всех листов Excel; узбекский — вне рамок; пакет 2 — следующий прогон"
  },
  "concerns": [],
  "reviewers": {
    "manifestSpec": null,
    "craft": null
  },
  "blind": null
}
