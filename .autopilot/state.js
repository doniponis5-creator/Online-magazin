window.STATE =
{
  "slug": "push-apns-fcm",
  "dir": "2026-09-27-push-apns-fcm",
  "title": "Уведомления на телефон: iPhone в боевой режим, Android через Firebase",
  "mode": "semi",
  "depth": "normal",
  "polish": null,
  "tier": "T2",
  "briefFile": "2026-09-27-brief.md",
  "memoryFile": "CLAUDE.md",
  "skillDir": "/Users/doniyorabduganiev/.claude/skills/autopilot",
  "startedAt": "2026-09-27T21:52:46+06:00",
  "updatedAt": "2026-09-27T22:48:23+06:00",
  "finishedAt": "2026-09-27T22:48:23+06:00",
  "stages": [
    {
      "id": "preflight",
      "status": "done",
      "startedAt": "2026-09-27T21:52:46+06:00",
      "finishedAt": "2026-09-27T21:56:10+06:00"
    },
    {
      "id": "manifest",
      "status": "done",
      "startedAt": "2026-09-27T21:56:10+06:00",
      "finishedAt": "2026-09-27T22:04:15+06:00"
    },
    {
      "id": "briefing",
      "status": "skipped",
      "note": "вопросов не потребовалось"
    },
    {
      "id": "spec",
      "status": "done",
      "startedAt": "2026-09-27T22:04:15+06:00",
      "finishedAt": "2026-09-27T22:10:30+06:00"
    },
    {
      "id": "plan",
      "status": "done",
      "startedAt": "2026-09-27T22:10:30+06:00",
      "finishedAt": "2026-09-27T22:11:45+06:00",
      "note": "6 тасков, ярус T2, две волны (05–06 — корзина, добавлены по ходу)"
    },
    {
      "id": "build",
      "status": "done",
      "startedAt": "2026-09-27T22:11:45+06:00",
      "note": "6 из 6 тасков готовы",
      "finishedAt": "2026-09-27T22:42:02+06:00"
    },
    {
      "id": "review",
      "status": "done",
      "startedAt": "2026-09-27T22:20:45+06:00",
      "note": "проверено 6 из 6, 1 исправление",
      "finishedAt": "2026-09-27T22:42:02+06:00"
    },
    {
      "id": "final",
      "status": "done",
      "startedAt": "2026-09-27T22:42:02+06:00",
      "finishedAt": "2026-09-27T22:48:23+06:00",
      "note": "слепая приёмка: расхождений нет; живьём на телефоне не проверено"
    }
  ],
  "requirements": {
    "total": 14,
    "done": 13,
    "inTicket": 0,
    "inSpec": 0,
    "placeholder": 0,
    "deferred": 1,
    "dropped": 0
  },
  "tickets": [
    {
      "id": "01",
      "title": "Сервер: отправка на Android через FCM рядом с Apple",
      "requirements": [
        "R03",
        "R06i",
        "R10i"
      ],
      "blockedBy": [],
      "wave": 1,
      "zone": [
        "integrations/sbonus-server/shop/"
      ],
      "status": "done",
      "retries": 0,
      "repairs": 0,
      "handoffs": 0,
      "startedAt": "2026-09-27T22:11:45+06:00",
      "finishedAt": "2026-09-27T22:26:35+06:00",
      "commit": "510ba6a",
      "tests": {
        "passed": 16,
        "failed": 0
      },
      "files": [
        "shop_push_fcm.py",
        "test_shop_push_fcm.py",
        "009_shop_push_token_len_migration.sql",
        "shop_push.py",
        "shop_admin.py",
        "deploy_shop.sh"
      ]
    },
    {
      "id": "02",
      "title": "Сайт: адрес телефона с платформой, текст «Кабинета» для Android",
      "requirements": [
        "R03",
        "R06i",
        "R07i"
      ],
      "blockedBy": [],
      "wave": 1,
      "zone": [
        "src/lib/native/",
        "src/app/api/push/",
        "src/lib/customer/gateway.ts",
        "src/components/AccountView.tsx",
        "src/lib/i18n/dictionaries.ts"
      ],
      "status": "done",
      "retries": 0,
      "repairs": 0,
      "handoffs": 0,
      "startedAt": "2026-09-27T22:11:45+06:00",
      "finishedAt": "2026-09-27T22:26:35+06:00",
      "commit": "f12537a",
      "tests": {
        "passed": 683,
        "failed": 0
      },
      "files": [
        "src/lib/native/push.ts",
        "src/app/api/push/device/route.ts",
        "src/lib/customer/gateway.ts",
        "src/components/AccountView.tsx",
        "src/lib/i18n/dictionaries.ts",
        "__tests__/push-device.test.ts",
        "__tests__/push-platform.test.ts"
      ]
    },
    {
      "id": "03",
      "title": "Приложение Android: плагин по наличию Firebase, канал, значок",
      "requirements": [
        "R03",
        "R05i",
        "R07i",
        "R08i",
        "R11i"
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
      "handoffs": 0,
      "startedAt": "2026-09-27T22:11:45+06:00",
      "finishedAt": "2026-09-27T22:26:35+06:00",
      "commit": "9b0a357",
      "tests": {
        "passed": 2,
        "failed": 0
      },
      "files": [
        "capacitor.config.ts",
        "android/app/build.gradle",
        "AndroidManifest.xml",
        "MainActivity.java",
        "strings.xml",
        "drawable/ic_stat_s.xml"
      ]
    },
    {
      "id": "04",
      "title": "Владельцу: одна команда для файлов Firebase и инструкция",
      "requirements": [
        "R02",
        "R09i",
        "R11i"
      ],
      "blockedBy": [],
      "wave": 1,
      "zone": [
        "scripts/setup-fcm.*",
        "scripts/fcm-remote.sh",
        "docs/"
      ],
      "status": "done",
      "retries": 0,
      "repairs": 0,
      "handoffs": 0,
      "startedAt": "2026-09-27T22:19:38+06:00",
      "finishedAt": "2026-09-27T22:31:38+06:00",
      "commit": "2449bf8",
      "tests": {
        "passed": 11,
        "failed": 0
      },
      "files": [
        "scripts/setup-fcm.sh",
        "scripts/setup-fcm.ps1",
        "scripts/fcm-remote.sh",
        "docs/ANDROID_PUSH_UZ.md",
        "docs/*.md"
      ]
    },
    {
      "id": "05",
      "title": "Сервер: напоминания о корзине",
      "requirements": [
        "G01",
        "G01.1i"
      ],
      "blockedBy": [
        "01"
      ],
      "wave": 2,
      "zone": [
        "integrations/sbonus-server/shop/"
      ],
      "status": "done",
      "retries": 0,
      "repairs": 0,
      "handoffs": 0,
      "startedAt": "2026-09-27T22:26:51+06:00",
      "finishedAt": "2026-09-27T22:40:47+06:00",
      "commit": "4130725",
      "tests": {
        "passed": 12,
        "failed": 0
      },
      "files": [
        "shop_cart_rules.py",
        "shop_cart_remind.py",
        "010_shop_cart_reminders_migration.sql",
        "test_shop_cart_rules.py",
        "shop_admin.py",
        "shop_router.py",
        "deploy_shop.sh"
      ]
    },
    {
      "id": "06",
      "title": "Сайт: корзина из приложения на сервер, согласие, нажатие открывает корзину",
      "requirements": [
        "G01",
        "G01.1i"
      ],
      "blockedBy": [
        "02"
      ],
      "wave": 2,
      "zone": [
        "src/lib/native/",
        "src/lib/cart/",
        "src/app/api/push/",
        "src/lib/customer/gateway.ts",
        "src/components/AccountView.tsx",
        "src/lib/i18n/dictionaries.ts"
      ],
      "status": "done",
      "retries": 0,
      "repairs": 1,
      "handoffs": 0,
      "startedAt": "2026-09-27T22:26:51+06:00",
      "repairFindings": [
        "ответ сервера 200 {ok:false} на согласие считается успехом — отказ от напоминаний теряется молча (G01.1i)"
      ],
      "finishedAt": "2026-09-27T22:42:02+06:00",
      "commit": "c9d4e29",
      "tests": {
        "passed": 728,
        "failed": 0
      },
      "files": [
        "src/app/api/push/cart/",
        "src/app/api/push/consent/",
        "src/lib/native/cartSync.ts",
        "src/lib/native/push.ts",
        "src/lib/cart/CartProvider.tsx",
        "src/lib/customer/gateway.ts",
        "src/components/AccountView.tsx",
        "src/components/account.css",
        "src/lib/i18n/dictionaries.ts",
        "__tests__/push-cart-*.test.ts"
      ]
    }
  ],
  "singlePass": null,
  "tests": {
    "passed": 756,
    "failed": 0
  },
  "debt": {
    "placeholders": [
      "android/app/google-services.json — даёт владелец из Firebase"
    ],
    "assumptions": [],
    "emptyEnv": [
      "FCM_SERVICE_ACCOUNT_B64"
    ]
  },
  "additions": [
    "Нажатие на напоминание о корзине открывает корзину — ради G01",
    "Пункт Play «Data safety»: адрес телефона от Google (Device or other IDs) — иначе декларация в Play станет неверной"
  ],
  "coverage": {
    "found": 5,
    "fixed": 5,
    "deferred": 0
  },
  "concerns": [
    "shop_push_fcm.py:163 — 404 без JSON-тела (прокси) стирает все адреса Android; стирать только по UNREGISTERED/NOT_FOUND в теле",
    "SENDER_ID_MISMATCH стирает адреса: ключ и google-services.json из разных проектов сотрут всех — setup-fcm сверяет project_id (таск 04)",
    "shop_push.py:191, shop_admin.py:343 — старые строки журнала пишут текст исключения SQLAlchemy целиком (может содержать телефон/адрес)",
    "shop_push.py — send() (выбор пути, стоп на auth, iPhone без FCM) проверен только скриптом вне репозитория; нет теста в репо",
    "test_shop_push_fcm.py:107,114 — тест чужого ключа не может покраснеть; «любое исключение» вместо ValueError",
    "shop_push.py:58 — адрес FCM send лежит не в shop_push_fcm; ключ FCM разбирается дважды; предпроверка deploy_shop.sh:69 через внутреннее имя",
    "009 миграция: колонку TEXT сузит до 1024 — не трогать колонку без предела",
    "Android: id канала «orders» дважды голой строкой (манифест + MainActivity); имени канала нет по-кыргызски (values-ky)",
    "AndroidManifest.xml:51 / capacitor.config.ts:59 — комментарий обещает показ при открытом приложении «по тем же настройкам»; проверить канал/цвет плагина",
    "capacitor.config.ts:11 — без google-services.json push молча выпадает из сборки; cap sync должен предупреждать",
    "MainActivity.java:59 — не сказано, что важность/звук созданного канала не меняются без нового id",
    "capacitor.config.ts:9 — комментарий о Firebase склеен с описанием оболочки",
    "push-platform.test — нет случая «незнакомая платформа ничего не шлёт»; флаг listening не сбрасывается между случаями",
    "push-device.test — нет случая platform:null → ios",
    "сайт: список платформ записан трижды (тип, TOKEN_SHAPE, pushPlatform)",
    "Кыргызский путь в настройках Android («Жөндөөлөр → Колдонмолор → …») не сверен носителем",
    "Android: на телефоне сборку не запускали — устройства не было",
    "fcm-remote.sh:62–71 — временный файл с env и ключом без trap: при обрыве ssh останется в /opt/sbonus",
    "fcm-remote.sh:36, setup-fcm.sh:100 — ключ с BOM проходит проверку (utf-8-sig), а сервер читает строгий utf-8 → FCMOK, но Android молчит",
    "setup-fcm.ps1 не запускался и не разбирался парсером (pwsh нет)",
    "проверки fcm-remote.sh (дубли, копия, слово-ответ) остались в черновике — не в репозитории",
    "ANDROID_PUSH_UZ.md:171–191 — в таблице ошибок нет 4 редких сообщений; «Не удалось скопировать google-services.json» — после записи ключа, «Ничего не записано» для него неверно",
    "ANDROID_PUSH_UZ.md §7 — обещает один канал «Заказы» при открытом приложении; сверить с находкой по плагину (таск 03)",
    "Серверные замечания таска 05 (SQL не выполнялся на PostgreSQL, журнал с номером, дубль при сбое счётчика, тест MAX_REMINDERS) — переданы в docs/TZ_PUSH_PROMO_1C.md §4 для PC до выкладки",
    "shop_cart_remind.py:113–140 — changed_at значит и изменение корзины, и момент согласия, и заказ",
    "Согласие «да» перезапускает расписание: выкл/вкл = ещё три напоминания на ту же корзину",
    "сайт: CartSnapshot объявлен дважды, пределы сайта (без верхней границы, 200 знаков) расходятся с сервером (999, 1e8, 120)",
    "CartProvider.tsx:99–101 — слушатель нажатий уведомлений запускается из компонента корзины",
    "Карточка согласия в «Кабинете» глазами не проверена — видна только в приложении; тестов отрисовки нет",
    "Кыргызские тексты карточки согласия — перевод исполнителя, показать носителю"
  ],
  "reviewers": {
    "manifestSpec": "a69b46ac2139b4316",
    "craft": "a61bc9605481b2095"
  },
  "blind": {
    "agreed": 13,
    "drift": 0,
    "notBuilt": [
      "G02 — рассылки «Скидка»/«Новинка» из 1С: отложено владельцем на PC (docs/TZ_PUSH_PROMO_1C.md)"
    ],
    "notVerifiable": "доставка уведомлений на телефон: нет телефона, живого сервера и файлов Firebase; сервер с этими изменениями ещё не выложен",
    "commands": [
      "npm test → 48 files / 728 passed",
      "npx next typegen && npm run typecheck → 0",
      "test_shop_push_fcm → 16 OK",
      "test_shop_cart_rules → 12 OK",
      "cap sync android + assembleDebug → BUILD SUCCESSFUL (без Firebase и с учебным файлом)",
      "setup-fcm.sh --check → понятные сообщения"
    ]
  }
}
