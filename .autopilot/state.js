window.STATE =
{
  "slug": "kitchen-3d-audit-pro",
  "dir": "2026-09-26-kitchen-3d-audit-pro--wip",
  "title": "3D-конструктор кухни: аудит расчётов и чертежа, удобство, PRO",
  "mode": "semi",
  "depth": "normal",
  "polish": null,
  "tier": "T2",
  "briefFile": "2026-09-26-brief.md",
  "memoryFile": "CLAUDE.md",
  "skillDir": "/Users/doniyorabduganiev/.claude/skills/autopilot",
  "startedAt": "2026-09-26T22:48:52+06:00",
  "updatedAt": "2026-09-27T00:42:53+06:00",
  "finishedAt": null,
  "stages": [
    {
      "id": "preflight",
      "status": "done",
      "startedAt": "2026-09-26T22:48:52+06:00",
      "finishedAt": "2026-09-26T22:53:40+06:00"
    },
    {
      "id": "manifest",
      "status": "done",
      "startedAt": "2026-09-26T22:50:10+06:00",
      "finishedAt": "2026-09-26T22:51:30+06:00"
    },
    {
      "id": "briefing",
      "status": "done",
      "startedAt": "2026-09-26T22:53:40+06:00",
      "finishedAt": "2026-09-26T23:31:28+06:00"
    },
    {
      "id": "spec",
      "status": "done",
      "startedAt": "2026-09-26T23:31:28+06:00",
      "finishedAt": "2026-09-26T23:37:00+06:00"
    },
    {
      "id": "plan",
      "status": "done",
      "startedAt": "2026-09-26T23:37:00+06:00",
      "finishedAt": "2026-09-26T23:37:00+06:00",
      "note": "7 тасков, ярус T2, 6 волн"
    },
    {
      "id": "build",
      "status": "active",
      "startedAt": "2026-09-26T23:37:00+06:00",
      "note": "4 из 7 тасков готовы"
    },
    {
      "id": "review",
      "status": "active",
      "startedAt": "2026-09-26T23:45:48+06:00",
      "note": "проверено 4 из 7"
    },
    {
      "id": "final",
      "status": "pending"
    }
  ],
  "requirements": {
    "total": 15,
    "done": 4,
    "inTicket": 11,
    "inSpec": 0,
    "placeholder": 0,
    "deferred": 0,
    "dropped": 0
  },
  "tickets": [
    {
      "id": "01",
      "title": "Уборка и тексты",
      "requirements": [
        "R05",
        "R04.1",
        "R13i"
      ],
      "blockedBy": [],
      "wave": 1,
      "zone": [
        "smartcentr-site/",
        "src/components/kitchen/texts.ts",
        "src/components/kitchen/KitchenPromo.tsx",
        "src/app/[lang]/kitchen/page.tsx",
        "src/lib/kitchen/finishes.ts",
        ".gitignore",
        ".dockerignore"
      ],
      "status": "done",
      "retries": 0,
      "repairs": 0,
      "handoffs": 0,
      "startedAt": "2026-09-26T23:37:07+06:00",
      "finishedAt": "2026-09-26T23:51:21+06:00",
      "commit": "4f78c71",
      "tests": {
        "passed": 292,
        "failed": 0
      },
      "files": [
        "smartcentr-site/ (удалена)",
        ".gitignore",
        ".dockerignore",
        "src/components/kitchen/texts.ts",
        "src/components/kitchen/KitchenPromo.tsx",
        "src/app/[lang]/kitchen/page.tsx",
        "src/lib/kitchen/finishes.ts",
        "__tests__/kitchen-texts.test.ts"
      ]
    },
    {
      "id": "02",
      "title": "Ссылка, автосохранение, размеры из 1С, кнопка на карточке товара",
      "requirements": [
        "R02",
        "G01",
        "R06.1"
      ],
      "blockedBy": [],
      "wave": 1,
      "zone": [
        "src/lib/kitchen/share.ts",
        "src/lib/kitchen/catalog.ts",
        "src/app/[lang]/product/",
        "src/components/ProductDetail.tsx",
        "src/lib/i18n/dictionaries.ts"
      ],
      "status": "done",
      "retries": 0,
      "repairs": 0,
      "handoffs": 0,
      "startedAt": "2026-09-26T23:37:07+06:00",
      "finishedAt": "2026-09-26T23:51:21+06:00",
      "commit": "7a5dd84",
      "tests": {
        "passed": 292,
        "failed": 0
      },
      "files": [
        "src/lib/kitchen/share.ts",
        "src/lib/kitchen/catalog.ts",
        "src/app/[lang]/product/[id]/page.tsx",
        "src/components/ProductDetail.tsx",
        "src/lib/i18n/dictionaries.ts",
        "__tests__/kitchen-share.test.ts"
      ]
    },
    {
      "id": "03",
      "title": "Раскладка и проверки: ничего не пропадает молча",
      "requirements": [
        "R02",
        "R12i",
        "R03.6"
      ],
      "blockedBy": [
        "01"
      ],
      "wave": 2,
      "zone": [
        "src/lib/kitchen/layout.ts",
        "src/lib/kitchen/checks.ts",
        "src/lib/kitchen/types.ts",
        "src/components/kitchen/texts.ts"
      ],
      "status": "done",
      "retries": 0,
      "repairs": 1,
      "handoffs": 0,
      "startedAt": "2026-09-26T23:51:21+06:00",
      "repairFindings": [
        "над плитой у окна шкаф doors — только hood/none (BLOCKING ревью)",
        "мойка остаётся суженной после вытеснения плиты (решение оркестратора: неверная ширина покупателю)",
        "проверка высоты вытяжки — тавтология констант (решение оркестратора: ложное «безопасно»)"
      ],
      "finishedAt": "2026-09-27T00:15:31+06:00",
      "commit": "cd0a9ae",
      "tests": {
        "passed": 328,
        "failed": 0
      },
      "files": [
        "src/lib/kitchen/layout.ts",
        "src/lib/kitchen/checks.ts",
        "src/components/kitchen/texts.ts",
        "__tests__/kitchen-layout.test.ts",
        "src/components/kitchen/KitchenPlanner.tsx (+8 checkText)",
        "src/components/kitchen/three/build.ts (временные case)"
      ]
    },
    {
      "id": "04",
      "title": "3D-сборка и спецификация мебельщику",
      "requirements": [
        "R02",
        "R03",
        "R12i"
      ],
      "blockedBy": [
        "03"
      ],
      "wave": 3,
      "zone": [
        "src/components/kitchen/three/build.ts",
        "src/components/kitchen/three/parts.ts",
        "src/components/kitchen/three/appliances.ts",
        "src/lib/kitchen/spec.ts",
        "src/components/kitchen/texts.ts"
      ],
      "status": "done",
      "retries": 0,
      "repairs": 1,
      "handoffs": 1,
      "startedAt": "2026-09-27T00:15:31+06:00",
      "repairFindings": [
        "задняя панель острова 2800 мм длиннее листа — делить (BLOCKING ревью)"
      ],
      "finishedAt": "2026-09-27T00:42:53+06:00",
      "commit": "74ea6a7",
      "tests": {
        "passed": 346,
        "failed": 0
      },
      "files": [
        "src/components/kitchen/three/build.ts",
        "src/lib/kitchen/spec.ts",
        "src/components/kitchen/texts.ts",
        "__tests__/kitchen-build.test.ts"
      ]
    },
    {
      "id": "05",
      "title": "Экран: честная сумма, WhatsApp, автосохранение, техника третьим шагом",
      "requirements": [
        "G01",
        "R02",
        "R06",
        "R04"
      ],
      "blockedBy": [
        "02",
        "03"
      ],
      "wave": 4,
      "zone": [
        "src/components/kitchen/KitchenPlanner.tsx",
        "src/lib/kitchen/order.ts",
        "src/components/kitchen/three/engine.ts",
        "src/components/kitchen/kitchen.css",
        "src/components/kitchen/texts.ts"
      ],
      "status": "in-progress",
      "retries": 0,
      "repairs": 0,
      "handoffs": 0,
      "startedAt": "2026-09-27T00:42:53+06:00"
    },
    {
      "id": "06",
      "title": "Чертёж и PDF: все размеры, угол, план сверху, контакты",
      "requirements": [
        "R03",
        "G01",
        "R12i"
      ],
      "blockedBy": [
        "04",
        "05"
      ],
      "wave": 5,
      "zone": [
        "src/components/kitchen/drawing.ts",
        "src/components/kitchen/pdfSheet.ts",
        "src/components/kitchen/pdfFile.ts",
        "src/components/kitchen/PlanSketch.tsx",
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
      "id": "07",
      "title": "Доводка внешнего вида и карта кода",
      "requirements": [
        "R09",
        "R10",
        "R06"
      ],
      "blockedBy": [
        "06"
      ],
      "wave": 6,
      "zone": [
        "src/components/kitchen/KitchenPlanner.tsx",
        "src/components/kitchen/kitchen.css",
        "src/components/kitchen/texts.ts",
        "graphify-out/"
      ],
      "status": "pending",
      "retries": 0,
      "repairs": 0,
      "handoffs": 0
    }
  ],
  "singlePass": null,
  "tests": {
    "passed": 346,
    "failed": 0
  },
  "debt": {
    "placeholders": [],
    "assumptions": [],
    "emptyEnv": []
  },
  "additions": [],
  "coverage": {
    "findings": 9,
    "missing": 1,
    "half": 4,
    "extra": 4,
    "note": "вариант 1 дописан в бриф и спецификацию, D26/D28 вернулись в рамки; R01 — история 0; WhatsApp — состав текста; текст кнопки RU/KY; польза — история 1a; «лишнее» признано углублением R05/R06"
  },
  "concerns": [
    "T01 · page.tsx:17, KitchenPromo.tsx:40, texts.ts goods — правило множественного числа написано трижды",
    "T01 · __tests__/kitchen-texts.test.ts:61-107 — дословные сверки строк сломаются при правке формулировок в T07; T18-тест должен пережить слияние кнопок фото",
    "T01 · __tests__/kitchen-texts.test.ts:27-40 — проверка терминов обходит только kitchenTexts и одну ветку функций",
    "T02 · share.ts:163 — TALL_MIN 160/200 дублирует числа экрана; нужна одна константа",
    "T02 · catalog.ts:59/:89 — два порога «миллиметры» (400 и 300)",
    "T02 · share.ts:57/:64 — правила токенов записаны дважды (TOKEN и регулярка)",
    "T02 · __tests__/kitchen-share.test.ts:26-36 — нет теста разбора буквального старого адреса",
    "T02 · ProductDetail.tsx:47-51 — лишний div только у кухонной техники; кнопка берёт чужой класс purchase__ask",
    "T02 · share.ts:318 — fx (фасады) не проходит перенумерацию cabinetOrder; проверить, ключи ли там k*",
    "T03 · __tests__/kitchen-layout.test.ts:297-354 — переборы C09/C10 принимают «предупреждение» вместо исправления; исправление доказывают только одиночные случаи",
    "T03 · layout.ts:834 и checks.ts:32 — список высоких модулей заведён дважды; checks.ts:101 число 60 вместо DEPTH",
    "T03 · checks.ts:34 — UNDER_COUNTER = 82 собран вручную, не из высот цоколя/корпуса сборки",
    "T03 · layout.ts:216/:660/:802 — «округлить вверх до 5 см» трижды",
    "T03 · __tests__/kitchen-layout.test.ts:52-89 — генератор не создаёт свои шкафы, at, snap",
    "T03 · __tests__/kitchen-layout.test.ts:60 — sort(() => r()-0.5) зависит от движка сортировки",
    "T03 · checks.ts:142 — вытяжка под окном входит в fits и советует «удлините стену»; таск 05 должен показать t.hoodNoPlace",
    "T04 · build.ts:163/:1077/:1206 — hoodOver пишется внутри hoodAt, вызывается вложенно, в mantel стирается; тест D16 сверяет число с самим собой, низ меша вытяжки никто не меряет",
    "T04 · build.ts:163 — запасной выбор нормы по газу повторяет layout.ts:816",
    "T04 · build.ts:610 — проём ПММ 82/87 числами, а не из BASE_H (и UNDER_COUNTER=82 в checks.ts)",
    "T04 · build.ts:568-573/:1135/:655/:755 — планка углового 0.03 и STRIP; точка деления длинной детали считается в двух местах",
    "T04 · build.ts:1008 — цикл открытых полок верен только для двух полок; тест D13 сверяет с копией чисел",
    "T04 · __tests__/kitchen-build.test.ts:352-354 — паритет сопоставляет по порядку обхода",
    "T04 · __tests__/kitchen-build.test.ts:120,126 — корпус ПММ ищется по старой форме",
    "T04 · build.ts:1842 — запасной путь Box3 стал мёртвым",
    "T04 · __tests__/kitchen-build.test.ts:101-105 — 192 сборки на уровне модуля, падение без имени кухни",
    "T04 · parts.ts — стержневая ручка 32 см на фасадах уже 32 см (бутылочница 16, антресоль 20) в 3D",
    "T04 · build.ts hoodAt — без plan.hoodHeight 3D сама выбирает газ/электро; после таска 05 высота должна браться только из плана",
    "T04 · spec.ts modulesOf().fillers — доборы в двух списках; таск 06 строит таблицу только из extraList, fillers — лишь для чертежа"
  ],
  "reviewers": {
    "manifestSpec": "a30dafafe6ec2f04c",
    "craft": "a5bbe33e95a136d1b"
  },
  "blind": null
}
