window.STATE =
{
  "slug": "kitchen-master-pack",
  "dir": "2026-09-27-kitchen-master-pack",
  "title": "Пакет мастера: раскрой в Excel, кромка, листы, смета мастера",
  "mode": "semi",
  "depth": "normal",
  "polish": null,
  "tier": "T2",
  "briefFile": "2026-09-27-brief.md",
  "memoryFile": "CLAUDE.md",
  "skillDir": "/Users/doniyorabduganiev/.claude/skills/autopilot",
  "startedAt": "2026-09-27T14:53:28+06:00",
  "updatedAt": "2026-09-27T17:25:00+06:00",
  "finishedAt": "2026-09-27T17:25:00+06:00",
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
      "status": "done",
      "startedAt": "2026-09-27T14:57:30+06:00",
      "note": "3 из 4 тасков готовы"
    },
    {
      "id": "review",
      "status": "done",
      "startedAt": "2026-09-27T15:08:22+06:00"
    },
    {
      "id": "final",
      "status": "done"
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
      "status": "done",
      "retries": 0,
      "repairs": 0,
      "handoffs": 0,
      "startedAt": "2026-09-27T14:57:30+06:00",
      "finishedAt": "2026-09-27T15:19:44+06:00",
      "commit": "1f45806",
      "tests": {
        "passed": 459,
        "failed": 0
      }
    },
    {
      "id": "01b",
      "title": "Второй цвет верха, доборы и планки в раскрое",
      "requirements": [
        "R02",
        "R04"
      ],
      "blockedBy": [
        "01",
        "02"
      ],
      "wave": 3,
      "zone": [
        "src/lib/kitchen/cutting.ts",
        "src/lib/kitchen/spec.ts",
        "src/components/kitchen/three/build.ts"
      ],
      "status": "done",
      "retries": 0,
      "repairs": 0,
      "handoffs": 0,
      "startedAt": "2026-09-27T15:24:45+06:00",
      "finishedAt": "2026-09-27T15:44:04+06:00",
      "commit": "45bf426",
      "tests": {
        "passed": 490,
        "failed": 0
      }
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
      "status": "done",
      "retries": 0,
      "repairs": 0,
      "handoffs": 0,
      "startedAt": "2026-09-27T15:08:22+06:00",
      "finishedAt": "2026-09-27T15:24:45+06:00",
      "commit": "9b7e54e",
      "tests": {
        "passed": 471,
        "failed": 0
      }
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
        "01b",
        "02"
      ],
      "wave": 4,
      "zone": [
        "src/lib/kitchen/master.ts",
        "src/components/kitchen/pdfSheet.ts",
        "src/components/kitchen/KitchenPlanner.tsx",
        "src/components/kitchen/kitchen.css",
        "src/components/kitchen/texts.ts"
      ],
      "status": "done",
      "retries": 0,
      "repairs": 0,
      "handoffs": 0,
      "startedAt": "2026-09-27T15:44:04+06:00",
      "finishedAt": "2026-09-27T16:08:00+06:00",
      "commit": "0453919",
      "tests": {
        "passed": 496,
        "failed": 0
      }
    },
    {
      "id": "04",
      "title": "Смета без пропусков: вся фурнитура, цветной лист, проверенные строки",
      "requirements": ["R05", "R06", "R08i"],
      "blockedBy": ["03"],
      "wave": 5,
      "zone": ["src/lib/kitchen/master.ts", "src/components/kitchen/KitchenPlanner.tsx", "src/components/kitchen/texts.ts", "__tests__/kitchen-master.test.ts"],
      "status": "done",
      "retries": 0,
      "repairs": 1,
      "handoffs": 0,
      "startedAt": "2026-09-27T16:15:00+06:00",
      "finishedAt": "2026-09-27T17:15:00+06:00",
      "commit": "f21de40, d49ee12",
      "tests": {
        "passed": 519,
        "failed": 0
      }
    },
    {
      "id": "05",
      "title": "Тесты раскроя и Excel ловят поломки",
      "requirements": ["R02", "R03", "R04", "R09i"],
      "blockedBy": ["01", "01b", "02"],
      "wave": 5,
      "zone": ["__tests__/kitchen-cutting.test.ts", "__tests__/kitchen-xlsx.test.ts"],
      "status": "done",
      "retries": 0,
      "repairs": 0,
      "handoffs": 0,
      "startedAt": "2026-09-27T16:15:00+06:00",
      "finishedAt": "2026-09-27T16:40:00+06:00",
      "commit": "6618561",
      "tests": {
        "passed": 519,
        "failed": 0
      }
    }
  ],
  "singlePass": null,
  "tests": {
    "passed": 521,
    "failed": 0
  },
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
  "concerns": [
    "[FIX → 05] M01 · kitchen-cutting.test.ts — тесты не ловят: один проход вместо 12 попыток, игнор opts.sheets, снятую кромку с крыши/боковины ниши, текстуру фасада по длинной стороне; нижняя граница повторяет формулу кода; проверяются точные координаты",
    "[REPORT] M01 · cutting.ts:320-337 frontSides копирует формулы cutList",
    "[DROP (1 лист в 3% групп — пильный центр всё равно переоптимизирует)] M01 · экономность: 60 перезапусков с перестановкой экономят лист в 20 из 655 групп (в основном ХДФ)",
    "[FIX → 05] M02 · kitchen-xlsx.test.ts — мутации (X↔Y, материал без цвета, фасады >1 шт, имена листов) не ловятся; заглушка холста — шестая копия в __tests__",
    "[FIX → 05] M01b · build.ts:271 и cutting.ts:123 — две ветки цвета не закреплены тестом (верх колонны с духовкой цветом низа; 'style' + каталог + тон без верха)",
    "[REPORT] M01b · доборы/планки/панель острова — кромка 2 мм по всем 4 сторонам, включая у стены",
    "[FIX → 04] M03 · строки сметы форматируются в KitchenPlanner.tsx:2058 без теста «кол-во × цена = сумма»; блок техники в PDF тоже без теста",
    "[FIX → 04 (D01)] M03 · в смете нет Gola, толкателей, ножек, цоколя, навесов — итог клиенту занижен (вопрос владельцу); лист ЛДСП декор и белый — одна цена",
    "[FIX → 04 (подпись «за метр столешницы»)] M03 · работа за метр — по длине столешницы (master.ts:183): колонны не считаются, остров считается",
    "[FIX → 04] M03 · наценка в подписи округляется до десятых (KitchenPlanner.tsx:4103); название направляющих вырезается из текста по запятой (1992)",
    "[FIX → 04] M03 · форма цен: фокус не держится в окне; длина листа без ширины молча не сохраняется (KitchenPlanner.tsx:3641)",
    "[DROP (замерено 0,6–1,9 мс)] M03 · раскрой+раскладка+смета считаются у каждого покупателя (≈1–2 мс на компьютере, замерено) — можно считать только при открытом блоке",
    "[REPORT] M03 · KitchenPlanner.tsx +375 строк — блок «Мастеру» просится в свой компонент",
    "[REPORT] M05 · x.test «Листы» X↔Y опирается на раскладку трёх панелей 900×500 в ряд — надёжнее деталь 2400×300",
    "[REPORT] M05 · frontPairs в kitchen-cutting.test.ts — третья копия формул размеров фасадов (spec.ts, cutting.ts frontSides)",
    "[REPORT] M05 · перебор кухонь: area > 0 упадёт на материале без единого листа; под нагрузкой машины тесты раскроя 71 с (тайм-аут 120 с)",
    "[FIX → 04 доработка] M04 · плита в смете подписана «Варочная панель» (master.ts:316); подсказка листа обещает 2800×2070, а не сохраняет ничего; таблица на 375 рвёт «кол-во × цена»; Gola 4,8 в «Для мебельщика» vs 4,78 в смете",
    "[REPORT] M04 · тест наценки считает той же формулой, что код; master.ts зависит от order.ts и типа KitchenTexts из components (как cutExcel.ts)"
  ],
  "reviewers": {
    "manifestSpec": null,
    "craft": null
  },
  "blind": {
    "at": "2026-09-27T17:18:00+06:00",
    "ran": "npx next dev -p 3107 → 200; Playwright headless (без 3D) RU/KY, 1280×900 и 375×812; xlsx разобран python — 0 проблем; PDF → png",
    "verdict": [
      {
        "req": "R02 Excel для распила",
        "blind": "реализовано",
        "manifest": "done"
      },
      {
        "req": "R03 кромка по сторонам, 0,4/1/2, метры",
        "blind": "реализовано",
        "manifest": "done"
      },
      {
        "req": "R04 листы 2800×2070, раскладка, отход",
        "blind": "реализовано",
        "manifest": "done"
      },
      {
        "req": "R05 свои цены мастера",
        "blind": "реализовано",
        "manifest": "done"
      },
      {
        "req": "R06 PDF-смета с именем и телефоном",
        "blind": "реализовано",
        "manifest": "done"
      },
      {
        "req": "R07 кабинет мастера + бонус SBonus",
        "blind": "нет",
        "manifest": "deferred"
      }
    ],
    "drift": [],
    "notes": [
      "подсказка формы «скрытые — 0,4 мм» не совпадала с раскроем — исправлено (d49ee12)",
      "в консоли 401 при загрузке страницы — вход покупателя, к пакету не относится"
    ]
  }
}
