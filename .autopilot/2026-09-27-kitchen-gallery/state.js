window.STATE =
{
  "slug": "kitchen-gallery",
  "dir": "2026-09-27-kitchen-gallery",
  "title": "Галерея кухонь и готовые кухни: публикация, оценки, комментарии",
  "mode": "semi",
  "depth": "deep",
  "polish": null,
  "tier": "T2",
  "briefFile": "2026-09-27-brief.md",
  "memoryFile": "CLAUDE.md",
  "skillDir": "/Users/doniyorabduganiev/.claude/skills/autopilot",
  "startedAt": "2026-09-27T19:53:45+06:00",
  "updatedAt": "2026-09-27T21:14:42+06:00",
  "finishedAt": "2026-09-27T21:14:42+06:00",
  "stages": [
    {
      "id": "preflight",
      "status": "done",
      "startedAt": "2026-09-27T19:53:45+06:00",
      "finishedAt": "2026-09-27T19:53:45+06:00"
    },
    {
      "id": "manifest",
      "status": "done",
      "startedAt": "2026-09-27T19:53:45+06:00",
      "finishedAt": "2026-09-27T19:54:32+06:00"
    },
    {
      "id": "briefing",
      "status": "done",
      "startedAt": "2026-09-27T19:54:32+06:00",
      "finishedAt": "2026-09-27T19:54:32+06:00"
    },
    {
      "id": "spec",
      "status": "done",
      "startedAt": "2026-09-27T19:54:32+06:00",
      "finishedAt": "2026-09-27T19:59:54+06:00"
    },
    {
      "id": "plan",
      "status": "done",
      "startedAt": "2026-09-27T19:59:54+06:00",
      "finishedAt": "2026-09-27T19:59:54+06:00"
    },
    {
      "id": "build",
      "status": "done",
      "startedAt": "2026-09-27T19:59:54+06:00",
      "finishedAt": "2026-09-27T20:59:02+06:00"
    },
    {
      "id": "review",
      "status": "done",
      "startedAt": "2026-09-27T20:14:26+06:00",
      "finishedAt": "2026-09-27T20:59:02+06:00"
    },
    {
      "id": "final",
      "status": "done",
      "startedAt": "2026-09-27T20:59:02+06:00",
      "finishedAt": "2026-09-27T21:14:42+06:00"
    }
  ],
  "requirements": {
    "total": 17,
    "done": 16,
    "inTicket": 0,
    "inSpec": 0,
    "placeholder": 0,
    "deferred": 1,
    "dropped": 0
  },
  "tickets": [
    {
      "id": "01",
      "title": "Хранилище галереи, API и панель владельца",
      "requirements": [
        "R05",
        "R06",
        "R07",
        "R08",
        "R09",
        "R10",
        "R11",
        "R12",
        "R13"
      ],
      "blockedBy": [],
      "wave": 1,
      "zone": [
        "src/lib/gallery/",
        "src/app/api/gallery/",
        "src/app/panel/gallery/"
      ],
      "status": "done",
      "retries": 0,
      "repairs": 2,
      "handoffs": 0,
      "startedAt": "2026-09-27T19:59:54+06:00",
      "finishedAt": "2026-09-27T20:48:23+06:00",
      "commit": "8087ed8"
    },
    {
      "id": "02",
      "title": "12 готовых кухонь: проекты и картинки",
      "requirements": [
        "R01",
        "R02",
        "R03",
        "R14i"
      ],
      "blockedBy": [],
      "wave": 1,
      "zone": [
        "src/data/kitchen-ready.ts",
        "public/kitchen/ready/"
      ],
      "status": "done",
      "retries": 0,
      "repairs": 1,
      "handoffs": 0,
      "startedAt": "2026-09-27T19:59:54+06:00",
      "finishedAt": "2026-09-27T20:33:13+06:00",
      "commit": "5d3a7ab, 2dca8ad"
    },
    {
      "id": "03",
      "title": "Страницы галереи и кухни",
      "requirements": [
        "R03",
        "R07",
        "R08",
        "R09",
        "R10",
        "R14i",
        "R15i",
        "R16i"
      ],
      "blockedBy": [
        "01",
        "02"
      ],
      "wave": 2,
      "zone": [
        "src/app/[lang]/kitchen/gallery/",
        "src/components/gallery/",
        "src/app/sitemap.ts"
      ],
      "status": "done",
      "retries": 0,
      "repairs": 1,
      "handoffs": 0,
      "startedAt": "2026-09-27T20:14:26+06:00",
      "finishedAt": "2026-09-27T20:48:23+06:00",
      "commit": "8087ed8"
    },
    {
      "id": "04",
      "title": "В конструкторе: готовые кухни и «В галерею»",
      "requirements": [
        "R01",
        "R02",
        "R05",
        "R06",
        "R11",
        "R15i"
      ],
      "blockedBy": [
        "01",
        "02"
      ],
      "wave": 2,
      "zone": [
        "src/components/kitchen/"
      ],
      "status": "done",
      "retries": 0,
      "repairs": 2,
      "handoffs": 0,
      "startedAt": "2026-09-27T20:14:26+06:00",
      "finishedAt": "2026-09-27T20:59:02+06:00",
      "commit": "df13f11"
    },
    {
      "id": "05",
      "title": "Треугольник не проверяется в одном ряду; места у больших готовых кухонь",
      "requirements": [
        "R01",
        "R17i"
      ],
      "blockedBy": [
        "02"
      ],
      "wave": 3,
      "zone": [
        "src/lib/kitchen/checks.ts"
      ],
      "status": "done",
      "retries": 0,
      "repairs": 0,
      "handoffs": 0,
      "startedAt": "2026-09-27T20:33:13+06:00",
      "finishedAt": "2026-09-27T20:43:37+06:00",
      "commit": "2dca8ad"
    },
    {
      "id": "06",
      "title": "«Рабочая линия» для кухни в один ряд",
      "requirements": [
        "R01",
        "R17i"
      ],
      "blockedBy": [
        "05",
        "04"
      ],
      "wave": 4,
      "zone": [
        "src/lib/kitchen/checks.ts",
        "src/components/kitchen/texts.ts"
      ],
      "status": "done",
      "retries": 0,
      "repairs": 0,
      "handoffs": 0,
      "startedAt": "2026-09-27T20:45:13+06:00",
      "finishedAt": "2026-09-27T20:59:02+06:00",
      "commit": "226262f"
    }
  ],
  "singlePass": null,
  "tests": {
    "passed": 674,
    "failed": 0
  },
  "debt": {
    "placeholders": [],
    "assumptions": [
      "Бюджет готовых кухонь = сумма техники",
      "12 готовых кухонь собирает агент из каталога"
    ],
    "emptyEnv": []
  },
  "additions": [],
  "coverage": {
    "findings": 6,
    "note": "добавлен фильтр размера; «только имя» — без фамилии (исправлено в спеке и в таске 01 на лету); фото «в жизни» рядом с 3D; цитата про кабинет и план «лучшие → к готовым» дописаны в Дополнения брифа; жалобы, «убрать своё», лимиты, SEO — углубление R09/R10/R05/R07 и цель «клиенты»"
  },
  "concerns": [
    "[решение] волна 2 (03, 04) запущена до конца ревью 01 и доработки 02 — владелец торопит; интерфейсы 01/02 стабильны",
    "[REPORT] M02 · фикстура техники заморожена на 27.09 — модели закончатся, картинки устареют; перед правкой READY — `--fixture`",
    "[FIX later] M02 · скрипт рендера шлёт POST /api/visit (фальшивые посетители) — блокировать; путь Chrome для Windows в шапке",
    "[FIX → 06] M05 · одна линия: вместо треугольника — пункт «рабочая линия» (холодильник—варочная ≤ 270); тест «мойка на острове → треугольник есть»",
    "[FIX → 04b] M04 · суточный предел публикаций — свой reason `day`, readPublish читает reason; ready.ts — sizeBand из rules (не тексты галереи); Modal не закрывается во время отправки; PublishLoader — «Загрузка…»",
    "[REPORT] M01 · WebP с нечётным последним чанком без заполнителя отклоняется; APP13 у JPEG не срезается (только загрузка в обход формы)"
  ],
  "reviewers": {
    "manifestSpec": "ac4b48f057bc2fac8",
    "craft": "ac4b48f057bc2fac8"
  },
  "blind": {
    "at": "2026-09-27T21:10:43+06:00",
    "ran": "npx next dev -p 3116 (GALLERY_DIR во временной папке, SHOP_PAYMENT_MODE=mock, свой ASSISTANT_LOG_KEY); Playwright + Chrome metal, 3D работает; вход — экран сайта в тестовом режиме (код 1234), не живой Telegram",
    "verdict": [
      {
        "req": "R01–R03 готовые кухни, фильтры, открытие, OG-картинка",
        "blind": "реализовано",
        "manifest": "done"
      },
      {
        "req": "R05–R06 сохранить и «показать всем»",
        "blind": "реализовано",
        "manifest": "done"
      },
      {
        "req": "R07–R09 смотреть, оценки, комментарии",
        "blind": "реализовано",
        "manifest": "done"
      },
      {
        "req": "R10–R12 видно сразу, вход, только имя",
        "blind": "реализовано",
        "manifest": "done"
      },
      {
        "req": "R13 советы: фото вживую, портфолио мастера, шеринг",
        "blind": "реализовано",
        "manifest": "done"
      },
      {
        "req": "R13 приз SBonus («позже»)",
        "blind": "нет",
        "manifest": "deferred"
      },
      {
        "req": "R14i–R16i техника → товары, лучшие к готовым, «Хочу такую же»",
        "blind": "реализовано",
        "manifest": "done"
      }
    ],
    "drift": [],
    "notes": [
      "локальный каталог устарел — готовые кухни локально открываются с пустыми слотами (на сервере каталог свежий)",
      "KY: ошибка гидрации в комментариях — исправлено",
      "панель: счётчик комментариев считал скрытые — исправлено"
    ]
  }
}
