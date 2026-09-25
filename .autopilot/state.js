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
  "updatedAt": "2026-09-25T21:14:22+06:00",
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
      "note": "1 из 2 тасков готов"
    },
    {
      "id": "review",
      "status": "active",
      "startedAt": "2026-09-25T18:16:46+06:00",
      "note": "проверяется таск 02"
    },
    {
      "id": "final",
      "status": "pending"
    }
  ],
  "requirements": {
    "total": 8,
    "done": 2,
    "inTicket": 6,
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
      "status": "done",
      "retries": 0,
      "repairs": 0,
      "handoffs": 1,
      "startedAt": "2026-09-25T17:53:58+06:00",
      "finishedAt": "2026-09-25T18:21:18+06:00",
      "commit": "41d6105",
      "tests": {
        "passed": 249,
        "failed": 0
      },
      "files": [
        "android/app/src/main/java/kg/smarket/app/MainActivity.java",
        "android/app/build.gradle",
        "android/app/src/main/res/values/styles.xml",
        "android/app/src/main/res/values/colors.xml",
        "android/app/src/main/res/drawable-nodpi/splash_logo.png"
      ],
      "concerns": [
        "истории 5 (оплата) и 6 (фото в чат) перенесены в таск 02"
      ]
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
      "status": "review",
      "retries": 0,
      "repairs": 0,
      "handoffs": 2,
      "startedAt": "2026-09-25T18:21:18+06:00"
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
    "T01 craft · MainActivity.java:51 — комментарий выдаёт список плагинов в JS за границу доступа; настоящая граница — адрес и главное окно",
    "T02 · сайт (src/, половина PC) — на Android блок «Быстрый вход» пишет «войдёте лицом», а там отпечаток пальца",
    "План: таск 02 потребовал 2 передачи (3 контекста) — нарезка была крупной: проверка на эмуляторе + сборка + инструкция в одном таске",
    "T02 craft · docs/ANDROID_PLAY_UZ.md:178,254,263-266 — номер версии в четырёх местах (code3, «hozir 3», «keyingisi — 4», cp …code4.aab); после следующего повышения cp положит code5 под именем code4",
    "T02 craft · docs/ANDROID_PLAY_UZ.md:15,20-33 — раздел 1.1 «что проверено» не перечисляет проверки таска 01 (заставка, «Назад», внешние ссылки, офлайн-каталог)",
    "T02 manifest · docs/ANDROID_PLAY_UZ.md:32 — история 6 «Ishlaydi» без оговорки, что сайт отправляет фото сразу при выборе (превью нет); для истории 5 ограничение раскрыто, для 6 — нет"
  ],
  "reviewers": {
    "manifestSpec": "a5deef7a16496a83a",
    "craft": "ad04a17b7c69fbfe1"
  },
  "blind": null
}
