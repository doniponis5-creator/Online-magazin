window.STATE =
{
  "slug": "android-app",
  "dir": "2026-09-25-android-app--wip",
  "title": "Android-приложение S Маркет для Google Play",
  "mode": "semi",
  "depth": "normal",
  "polish": null,
  "tier": "T1",
  "briefFile": "2026-09-25-brief.md",
  "memoryFile": "CLAUDE.md",
  "skillDir": "/Users/doniyorabduganiev/.claude/skills/autopilot",
  "startedAt": "2026-09-25T17:21:44+06:00",
  "updatedAt": "2026-09-25T18:19:06+06:00",
  "finishedAt": null,
  "stages": [
    {
      "id": "preflight",
      "status": "done",
      "startedAt": "2026-09-25T17:21:44+06:00",
      "finishedAt": "2026-09-25T17:24:15+06:00"
    },
    {
      "id": "manifest",
      "status": "done",
      "startedAt": "2026-09-25T17:24:15+06:00",
      "finishedAt": "2026-09-25T17:24:29+06:00"
    },
    {
      "id": "briefing",
      "status": "done",
      "startedAt": "2026-09-25T17:24:29+06:00",
      "finishedAt": "2026-09-25T17:52:28+06:00"
    },
    {
      "id": "spec",
      "status": "done",
      "startedAt": "2026-09-25T17:52:28+06:00",
      "finishedAt": "2026-09-25T17:53:34+06:00"
    },
    {
      "id": "plan",
      "status": "done",
      "startedAt": "2026-09-25T17:53:34+06:00",
      "note": "2 таска, ярус T1",
      "finishedAt": "2026-09-25T17:53:58+06:00"
    },
    {
      "id": "build",
      "status": "active",
      "startedAt": "2026-09-25T17:53:58+06:00",
      "note": "0 из 2 тасков готовы"
    },
    {
      "id": "review",
      "status": "active",
      "startedAt": "2026-09-25T18:16:46+06:00",
      "note": "проверяется таск 01"
    },
    {
      "id": "final",
      "status": "pending"
    }
  ],
  "requirements": {
    "total": 8,
    "done": 0,
    "inTicket": 8,
    "inSpec": 0,
    "placeholder": 0,
    "deferred": 0,
    "dropped": 0
  },
  "tickets": [
    {
      "id": "01",
      "title": "Оболочка, «Нет связи», каталог офлайн и вход — проверить на эмуляторе и починить",
      "requirements": [
        "R01",
        "R04i",
        "R05i",
        "R06i",
        "R07i",
        "R02"
      ],
      "blockedBy": [],
      "wave": 1,
      "zone": [
        "android/",
        "capacitor.config.ts"
      ],
      "status": "review",
      "retries": 0,
      "repairs": 0,
      "handoffs": 1,
      "startedAt": "2026-09-25T17:53:58+06:00"
    },
    {
      "id": "02",
      "title": "Бонусная карта, отпечаток и итоговый файл для Google Play",
      "requirements": [
        "R06i",
        "R08i",
        "R03i",
        "R02"
      ],
      "blockedBy": [
        "01"
      ],
      "wave": 2,
      "zone": [
        "android/",
        "capacitor.config.ts",
        "docs/ANDROID_PLAY_UZ.md"
      ],
      "status": "pending",
      "retries": 0,
      "repairs": 0,
      "handoffs": 0
    }
  ],
  "singlePass": null,
  "tests": {
    "passed": 249,
    "failed": 0
  },
  "debt": {
    "placeholders": [],
    "assumptions": [
      "Push на Android отложен: нужен Firebase (аккаунт владельца) и FCM на сервере (половина PC)",
      "Android Studio не ставим — хватает SDK + JDK 21 + command-line tools"
    ],
    "emptyEnv": []
  },
  "additions": [],
  "coverage": {
    "findings": 2,
    "actions": [
      "Android Studio (слова агента в контексте брифа) — в spec добавлено решение «не ставим» с причиной",
      "истории сверх буквального брифа — углубление R01/R02/R06i с родителями, оставлены"
    ]
  },
  "concerns": [
    "T01 craft · MainActivity.java:68-73 — скрипт моста для «Нет связи» собран копией закрытого Bridge.getJSInjector(); есть открытый JSInjector.getScriptString() — копия отстанет при обновлении Capacitor",
    "T01 craft · MainActivity.java:21,65 — имена плагинов строками второй раз; ненайденный плагин пропускается без записи в logcat",
    "T01 craft · MainActivity.java:51 — комментарий выдаёт список плагинов в JS за границу доступа; настоящая граница — адрес и главное окно"
  ],
  "reviewers": {
    "manifestSpec": "af2bc23b6012940f4",
    "craft": "ad04a17b7c69fbfe1"
  },
  "blind": null
}
