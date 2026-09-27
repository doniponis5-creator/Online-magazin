@AGENTS.md

# Smart Centr — правила работы над проектом

Этот файл читает любая сессия Claude, открывшая проект: на Windows, на MacBook,
у кого угодно. Всё важное — здесь, а не в чьей-то локальной памяти.

## С кем работаешь

Владелец магазина электроники Smart Centr (Кыргызстан, KGS, сайт RU/KY).
**Не программист.** Пишет по-узбекски (латиница и кириллица) и по-русски.

Просит делать, а не объяснять («o'zing qil»). Больше всего боится, что сломается
рабочая 1С или сервер SBonus — магазин работает каждый день.

## Как отвечать

1. **Сначала ответ, потом объяснение.** Первая строка — что делать или что
   получилось. Причины ниже, и только если они меняют решение.
2. **Ни одного термина без расшифровки.** Написал термин — тут же объясни
   обычными словами в скобках.
3. **Коротко.** Не просили подробностей — не разворачивай.
4. **Не уверен — так и скажи.** «Не знаю» лучше вежливой отговорки вроде
   «зависит от конфигурации».
5. **Отчёт по одной схеме:** что сделал · сработало или нет · что делать дальше.
6. **Выбор — не больше двух вариантов**, и скажи, какой выбрал бы сам.
7. Пути, имена и команды — **точно, символ в символ**: их копируют не глядя.
8. Команды для владельца давай в блоке ```bash — у него появляется кнопка
   «запустить».
9. **Стиль по умолчанию — `caveman lite`** (навык `.claude/skills/caveman/`).
   Владелец его руками не включает: он действует с первого сообщения в любом
   новом чате. Это значит — без вежливых вступлений («конечно», «с радостью»),
   без воды и пустых оговорок, но предложения целые и термины объяснены.
   Отменить на сессию: `/caveman off`. Усилить: `/caveman full` или `ultra`.

Отвечать лучше на узбекском, если он пишет по-узбекски.

## Секреты — граница, которую нельзя переходить

Владелец регулярно вставляет пароли и токены прямо в чат и просит ими
воспользоваться. **Нельзя вводить чужие пароли и секреты самому.**

Вместо этого: дай скрипт, который он запустит сам, со скрытым вводом. Готовые
примеры — `scripts/setup-site-secret.ps1`, `scripts/setup-telegram-gateway.ps1`.
Секреты живут в `.env.local` (в git его нет) и в `/opt/sbonus/.env.production`.

Если секрет всё-таки засветился в чате — предложи его сменить.

## Что НЕ лежит в git

| Что | Как получить заново |
|---|---|
| `.env.local` | скопировать `.env.example`, заполнить; секрет сайта — `scripts/setup-site-secret.ps1` |
| `node_modules` | `npm install` |
| `integrations/1c-online-shop/build/` | `python integrations/1c-online-shop/build_extension.py ut` |
| Ключ SSH к серверу | у владельца на его компьютере |

## Правила изменений

- **Рабочую 1С не трогаем сгоряча.** Сначала тестовая копия:
  `python integrations/1c-online-shop/manage.py install test`. В рабочую —
  `install prod`, он делает резервную копию расширения сам.
- **Сервер SBonus** меняется только скриптом
  `integrations/sbonus-server/shop/deploy_shop.sh`: он делает бэкап базы,
  пробный импорт внутри работающего контейнера и откатывается сам, если API
  не поднялся. Руками файлы на сервере не правим.
- **Сайт** обновляется `deploy/site/update_site.sh` — только код, nginx не
  трогает. `install_site.sh` заводит домены и нужен редко: `smarket.kg` и
  `whitefitpro.com` настроены в nginx вручную.
- Перед деплоем: `npx tsc --noEmit`, `npx vitest run`, `npm run build`.
- Коммитим по просьбе владельца. Не коммитим: `.env.local`,
  `smartcentr-site.tar.gz`, `review/_tmp-*`, папки агентов
  (`.agent/ .agents/ .claude/ .codex/ .cursor/ .gemini/ .zcode/`).
  Одно исключение: `.claude/skills/caveman/` **коммитим** — этот навык
  общий, его должны видеть и PC, и MacBook.

## Где что лежит

| Документ | О чём |
|---|---|
| `docs/HANDOFF.md` | как всё устроено и где запускается |
| `docs/TODO_NEXT.md` | что не доделано |
| `ARCHITECTURE_UZ.md` | архитектура целиком, по-узбекски |
| `infra/SMARKET_KG_UZ.md` | домен, DNS, nginx, HTTPS, Cloudflare |
| `docs/IOS_APP_UZ.md` | приложение для App Store: что и почему |

## Устройство в двух словах

Три части, все живые:

- **Сайт** (этот репозиторий, Next.js) — `https://smarket.kg`, контейнер
  `smartcentr_site` на 127.0.0.1:18820.
- **Сервер SBonus** — 145.223.100.16, `/opt/sbonus`, контейнер `sbonus_api`.
  Пакет `app/shop`: заказы, каталог, вход покупателя, бонусы, панель сайта.
- **1С УТ 11.5** (не BAS) — расширение `ИМ_ОнлайнМагазин`: каталог на сайт
  каждые 10 минут, оплаченные заказы в 1С каждые 5 минут.

Деньги: O!Деньги → касса «О! Business» в 1С. Бонусы: SBonus, на сайте можно
закрыть `SITE_BONUS_MAX_PCT`% заказа.

Вход покупателя: код сначала в **Telegram Gateway** (0,01 $, без риска
блокировки), запасной канал — WhatsApp через Green API. Заказать можно и без
входа; вход нужен только для оплаты бонусами.

Владелец управляет сайтом из 1С: **Онлайн магазин → Панель сайта** — сводка и
настройки, которые действуют сразу.

**Онлайн-консультант.** В углу сайта одна кнопка: чат отвечает по каталогу
на русском, кыргызском и узбекском, под ним сворачиваются телефоны и
мессенджеры. Тот же «мозг» работает телеграм-ботом (@ssmartket_bot) — там он
ещё и показывает фото и принимает заказ со ссылкой на оплату. Главное правило
чата: **ничего не выдумывать**, чего нет в каталоге и в правилах. Всё в
`src/lib/assistant/` и `src/lib/telegram/`, подробности — `docs/HANDOFF.md` §2.1.
Владелец смотрит, о чём спрашивают, на `/panel/questions?key=…`.

**Отзывы покупателей.** Пишет только купивший на сайте (оплаченный заказ),
один отзыв на заказ, до 5 фото. На главной — 20 последних. Хранятся на сайте
(`/app/data/reviews/`), не в SBonus. Владелец скрывает плохие на
`/panel/reviews?key=…`. Подробности — `docs/HANDOFF.md` §2.1a.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

### Две машины (MacBook и PC)

Владелец работает на двух компьютерах. Карта лежит в git, поэтому:

1. **Перед работой всегда `git pull`.** Иначе на втором компьютере карта старая.
2. **Конфликт в `graphify-out/` руками не чинят.** Если git сказал
   «conflict» про `graph.json`, `manifest.json`, `GRAPH_REPORT.md` или
   `cache/` — выполни `graphify update .` и закоммить результат. Файлы
   помечены в `.gitattributes` как несклеиваемые, git их не портит.
3. `graph.html` в git нет намеренно. Нужна картинка — `graphify export html`.
4. **На PC команда `graphify` не работает** — её нет в PATH. Там пиши
   `python -m graphify ...`. На MacBook работает короткая форма.

### Git между двумя машинами — что нельзя

Обе машины пишут в одну ветку. Один раз это уже кончилось тем, что на MacBook
поверх свежей работы лёг старый коммит. Правила простые и без исключений.

**Никогда, ни при каких условиях:**

- `git push --force` и `--force-with-lease` — стирает чужие коммиты на сервере;
- `git reset --hard` на то, что уже отправлено;
- `git revert` или откат коммитов, сделанных на другой машине;
- `git checkout .` / `git restore .` без разбора, когда в работе чужие файлы.

Кажется, что без них никак — **остановись и спроси владельца**. Потеря чужой
работы хуже любой задержки.

**Как правильно, когда ветки разошлись:**

1. `git status` и `git log --oneline -10` — сначала посмотреть, потом трогать.
2. Закоммитить только СВОИ файлы, чужие не трогать.
3. `git pull --rebase origin <ветка>`.
4. Конфликт в `graphify-out/` — не руками, а `graphify update .` и коммит.
5. `git push origin <ветка>` без `--force`.

**Кто что ведёт.** MacBook — приложение для iPhone: `ios/`, `docs/IOS_APP_UZ.md`.
PC — сайт, расширение 1С и сервер SBonus: `src/`, `public/`, `integrations/`,
`deploy/`. Полез в чужую половину — предупреди владельца.

**Если GitHub не открывается** (в Кыргызстане так бывает): коммить локально и
жди. Не пытайся обойти через новую ветку или второй remote — разведёшь копии,
которые потом никто не сведёт.

<!-- autopilot:start -->
## Autopilot

Крупные задачи ведутся навыком `/autopilot`. Требования, спецификация и таски — в
`.autopilot/<дата>-<задача>/`, прогресс — `.autopilot/dashboard.html`. Правило:
требование из `manifest.md` может снять только владелец.

Если работа прервалась — скажи «продолжи автопилот»: состояние поднимется из
`.autopilot/state.js`, переспрашивать ничего не нужно.

### Кухня: устройство (27.09.2026)

- Вход: `src/app/[lang]/kitchen/page.tsx` → `<KitchenPlanner appliances={kitchenAppliances(products)} />`; экран — `src/components/kitchen/KitchenPlanner.tsx`; всё, что видит покупатель, — `src/components/kitchen/texts.ts` (`kitchenTexts(lang)`, RU и KY обязательны). Размеры — см, в 3D — м.
- Поток: `KitchenState` → `chosenItems` + `planInputOf(state, chosen, snap)` (`order.ts`) → `planKitchen(input, {shelves})` → `Plan` → `buildKitchen` → `Built.spec` → таблицы, развёртки, PDF; замечания — `checkProject(plan, {hoodOver})`.
- `src/lib/kitchen/layout.ts` `planKitchen` — источник правды о местах: 3D, чертёж, список и сумма читают `Plan`, свою раскладку рядом не считать.
- `Plan.dropped[]` = `{item, slot?, need, wall}`; `needByWall(plan)` — нехватка по стене; `{item:'hob', slot:'hood'}` — вытяжку под окном не повесить, в `needByWall` её нет («удлините стену» не советовать).
- Верх: `UpperKind` `corner` (`blind` 35 — глухая часть со стороны угла) и `filler` (панель без корпуса, где шкаф вышел бы уже `UPPER_MIN`); `HOOD_OVER` — одна норма для раскладки, 3D (`plan.hoodHeight.over`) и проверки.
- `PlanInput.snap`: без поля прилипают все; `[]` — места заморожены (основной план экрана); `[key]` — перетаскивание и ←/→.
- `src/lib/kitchen/checks.ts` `checkProject(plan, facts)`: `facts.hoodOver` — факт из 3D (`engine.hoodOver()` / `Built.hoodOver`); без него проверки `hoodHeight` нет.
- `src/lib/kitchen/order.ts` — сумма (`projectTotal`), «Добавить всё» (`cartAdditions`), WhatsApp (`whatsappText`), «что стоит в 3D» (`projectItems`, в сумме только `inTotal`) — только отсюда, в tsx не пересчитывать.
- `src/lib/kitchen/share.ts`: `stateFromQuery(q, known)` / `queryFromState`; `known` — Map id → техника (с Set теряется правило «колонна ≥ 200 при встраиваемой микроволновке»).
- Автосохранение: `saveLast`/`loadLast`/`clearLast` ↔ `localStorage['kp-last'] = {q, t}`; экран пишет через 400 мс и на `pagehide`, но не пока видна плашка «Продолжить».
- `kitchenLinkFor(product, lang)` → `/ru/kitchen?ov=<id>` или `null` (не кухонная техника) — кнопка «Примерить в кухне» из `src/app/[lang]/product/[id]/page.tsx`.
- `src/lib/kitchen/catalog.ts` `parseSize(specs)`: порядок — только из группы «Ш×В×Г», единицы на всю тройку (мм, если «мм» или число > 300), габариты упаковки пропускает.
- `src/components/kitchen/three/build.ts` `buildKitchen` → `Built`: `spec` (числа мебельщику, от `lite` не зависят), `hoodOver?` (см; нет вытяжки — нет поля). Каждая деталь — через `dims(obj, kind, w, h, d, at, slot?)`: рамки чертежа берутся из `userData.dims` (`x`, `y`), не из `Box3`.
- `src/lib/kitchen/dims.ts` — все размеры кухни в одном месте, в сантиметрах и без three.js: `PLINTH`, `BODY`, `BASE_H` (низ столешницы 82), `DW_OPENING`, `WINDOW`/`WINDOW_GAP`, `tallMin`, `isTall`, `up5`, `hoodNorm`, `CORNER_STRIP`, `partsOf`/`PART_MAX` (275). Новое число кухни — сюда; в метры переводит только `build.ts`/`parts.ts` (там своя метровая `WINDOW` для движка — не путать с `dims.WINDOW`).
- Выше `PART_MAX` корпус делится на корпус и антресоль, задняя панель острова режется на части (`partsOf`).
- `src/lib/kitchen/spec.ts`: `cutList`, `frontList`, `hardware`, `topList`, `modulesOf(run)` (`lower`/`upper`/`fillers`), `extraList(spec)` — «Проёмы и доборы» (мм).
- `src/components/kitchen/drawing.ts`: `elevationSvg` (развёртки), `planSvg(plan, labels, {runs})` (план сверху), `pickScale`/`printedScale` (один масштаб на лист), `cornerZones` — одно правило угла для развёртки и `makerList` («Коротко: что где стоит»).
- `src/components/kitchen/pdfSheet.ts` `sheetPdf(SheetData)` → `pdfFile.ts` `buildPdf`; `contacts` обязателен (`src/data/contacts.ts`); таблицы листа и экрана — `sheetTables()` в `KitchenPlanner.tsx`.
- Разумные числа: верх уже 20 см → добор-панель (`UPPER_MIN`); подъёмный фасад ≤ 90 см (`LIFT_MAX`), выше — распашные; одностворчатая дверь ≤ 62 см (`DOOR_MAX`); деталь ≤ 2750 мм (`PART_MAX`); низ вытяжки над панелью 65 см электро/индукция, 75 газ (`HOOD_OVER`).
- Пакет мастера (блок «Мастеру» под «Для мебельщика»): `Built.spec` → `cutParts(spec, look)` (`src/lib/kitchen/cutting.ts`, мм) → `nest(parts, {sheets})` + `edgeTotals(parts)` → `estimate(parts, nested, spec, prices)` → `estimateLines(e, projectItems, t)` (`src/lib/kitchen/master.ts`) → экран и `estimateSheet` (`pdfSheet.ts`); Excel — `cutWorkbook(spec, look, t, opts)` (`src/lib/kitchen/cutExcel.ts`, 6 листов) → `xlsx(sheets)` (`src/lib/kitchen/xlsx.ts`, свой zip без сжатия, без пакетов). Решения — `docs/adr/` (0005–0010).
- Экран (`cut` в `KitchenPlanner.tsx`) передаёт `CutLook = {facade: state.facade, upperFacade: state.upperFacade, tone, bodyEdge: master.bodyEdge, lang, tier: t.xl.tier}` — без `tone` фасады стиля уходят в раскрой белым ламинатом, без `upperFacade` верх не того цвета, что в 3D. Верх — по правилу `createMaterials` (`three/materials.ts`): id → свой цвет; `'style'` → верх тона; нет — как низ из каталога, иначе верх тона.
- `CutPart.id` — номер детали на карте листа и в «Распил». `material.kind`: `ldsp` — корпус и фасады в плёнке (16 мм, у фасада кромка 2 мм по кругу); `hdf` — 3 мм, цвет корпуса, без кромки; `mdf` — акрил/эмаль/шпон/Fenix; `shop` — стекло, рамочные и фасад стиля (фасад не из каталога → цвет тона, `material: null`). `mdf`/`shop` на листы не идут: в Excel — «Фасады» по `facade.h × facade.w`, в смете — м².
- Ряд фасада/добора — `SpecFront.upper`/`SpecExtra.upper`: ставит `build.ts` по материалу (`mats.upper`, `mats.overFridge`), не по высоте — колонна с духовкой идёт цветом низа; `SpecFront.color` (свой цвет над холодильником) — своей строкой.
- Кромка: видимая корпуса — `bodyEdge` мастера (по умолчанию 1) на передней стороне, царга 0,4, ХДФ и не из листа — 0; `edgeTotals` → `{thick, net, meters}`, `meters` +10% (`EDGE_SPARE`) вверх до 0,1 м; Д1/Ш1 в Excel — передняя.
- `nest`: `SHEET` 2800×2070, `KERF` 4, `TRIM` 10 мм; лист мастера — `opts.sheets.ldsp|hdf` (важнее `opts.sheet`); группа — `kind|label|color|thick`; гильотина полосами, перебор порядков и поворотов вдоль и поперёк листа — берётся меньше листов; `Placement.x` — вдоль длины листа; не влезла — номер в `oversize`.
- `master.ts`: `localStorage['kp-master'] = {v: 1, …MasterData}`, `loadMaster`/`saveMaster`/`emptyMaster`; `parseMaster` берёт только знакомые ключи (`PRICE_KEYS`, `edge`, `front`), цена — число ≥ 0, лист 100…6000 мм, битая запись — пусто.
- `estimate`: ЛДСП — цена `ldsp`, если `isWhiteSheet` (hex = `lam-white`), иначе `ldspDecor`; кромка — по толщине; фасады не из листа — м² по `front[finish ?? 'style']`; `top` и `work` — погонные метры столешницы; фурнитура — из `hardware(spec)`; `delivery` — 1; `markup` — % к сумме строк. `qty` округлён до сотых до умножения — сумма = напечатанному.
- `estimateLines` — одни строки для экрана (там 3 колонки) и PDF сметы; техника — только `inTotal` из `projectItems`, итог — `projectTotal`. Карта раскроя — `cutMaps()` в `KitchenPlanner.tsx`: SVG на экране и `SheetData.cutMaps` в «PDF для мастера» после таблиц.
- Файлы `smarket-raskroy-<время>.xlsx` и `smarket-smeta-<время>.pdf` (Бишкек); `cutExcel`, `xlsx`, `pdfSheet` — через `import()`; телефон — «Поделиться», компьютер — «Загрузки» (`deliver`). Поля формы цен — `id="kp-mf-<ключ>"` (`edge04`, `front-acrylic`, `ldspL`).
- Пакет цвета (27.09.2026), id отделки: каталог `lam-/acr-/en-/ven-/fx-` (52); `ral-NNNN` — эмаль (МДФ, в цех), `src/lib/kitchen/ral.ts`: `RAL` (216 кодов RAL Classic), `ralColor`, `parseRal` («RAL-7016», «ral7016» → «7016», чужое — `null`); `dec-<бренд>-<код>` — ламинат (ЛДСП из листа), `src/lib/kitchen/decors.ts`: `DECORS` (по 12 у Egger/Kronospan/Lamarty), `decor(id)`, `decorCode`; источники кодов — комментарий в шапке файла.
- `finishes.ts` `frontColor(id)` — единственный разбор id (RAL/декор собирается и кэшируется — один объект на id; `FrontColor.code` «RAL 7016»/«Egger H1145 ST10», `brand`); `frontLabel(c, lang)` — одна подпись «код + название» для раскроя, Excel, сметы, PDF, WhatsApp; `findColors(query, lang)`: код целиком → начало кода → код содержит → название, ≤ 60.
- Остров: `KitchenState.islandFacade` (id как у `facade`; нет — как низ), ссылка `if=` пишется только при `shape === 'island'` → `FinishLook.island` (3D строит ряд острова с `mats.facade = mats.island`) и `CutLook.islandFacade`; `SpecFront.island`/`SpecExtra.island` (`islandBack`) — только когда цвет острова ≠ низу (`materials.ts` сравнивает id).
- `order.ts` `facadeTiers(state)` → `{tier: 'lower'|'upper'|'island', color}[]` (без «как в стиле»; верх и остров без своего — как низ) → `frontsText(state, lang, {asStyle?, label?})` — одно правило «какой части какой цвет» для `whatsappText` и PDF (`KitchenPlanner.tsx`, с `asStyle`); у всех частей один цвет — одной строкой.
- `Mats.body` (`three/materials.ts`) = `catalogFront(frontColor('lam-white'))` — корпус белый, как в раскрое: `carcass()` в `build.ts` (боковины, дно, крыша, спинка, полки), боковины ниши и портал холодильника; фасады, доборы, планки, задняя панель острова — цвет фасада.

Тесты (`npx vitest run` → 42 файла, 668 passed на 27.09.2026; один — `npx vitest run __tests__/kitchen-layout.test.ts`):
- `kitchen-layout` — раскладка и проверки: угол, духовка под варочной, нехватка по стенам, узкий верх, окно над высокими, `snap`, вытяжка.
- `kitchen-build` — `buildKitchen` в node с заглушкой холста (`import './helpers/canvas'` — `__tests__/helpers/canvas.ts`, общая для всех тестов с `buildKitchen`; сама не тест: `include` в `vitest.config.ts` — только `*.test.ts`): перебор, пределы деталей, высота вытяжки, рамки 3D ↔ `spec` ±1 см.
- `kitchen-cutting` — детали = `cutList` + `frontList`, кромка по сторонам и `edgeTotals` вручную, `nest` на ≥ 200 кухнях, текстура не поворачивается, цвет верха как в 3D, доборы и планки, неизвестный id — отказ.
- `kitchen-xlsx` — zip и CRC, числа числами, шесть листов RU/KY, книга → .xlsx → обратно, «Фасады» из деталей, лист мастера в «Листы».
- `kitchen-master` — `kp-master` (битая запись, старая без новых полей), белый/цветной лист, на двух кухнях RU/KY каждая строка «кол-во × цена = сумма», вся `hardware` в смете, техника = `projectTotal`.
- `kitchen-colors` — RAL (216, 9012 есть, 6040 нет, `parseRal`), декоры (id, фактура, Lamarty без кода, Kronospan только ЛДСП), `findColors`, ссылка туда-обратно, раскрой: RAL → МДФ в цех, декор-дерево → ЛДСП с волокном; остров цвета низа деталей не меняет.
- `kitchen-order` — что входит в сумму, «Добавить всё» без повторов, текст WhatsApp RU/KY.
- `kitchen-drawing` — 400 случайных кухонь: цепочки размеров сходятся с длиной стены, без NaN; отметки, масштаб, план, угол в списке = на развёртке.
- `kitchen-share` — адрес туда-обратно, чужие и старые ссылки, `parseSize`, `kp-last`, `kitchenLinkFor`.
- `kitchen-texts` — `PROMO_STYLES.count` = `STYLES.length`, термины, тексты после аудита.
- `kitchen.test.ts` — старый общий набор; ещё `kitchen-governor`, `kitchen-variants`, `kitchen-pdf`, `kitchen-shader`.

### Подводные камни кухни (24.09.2026, дополнено 27.09.2026)

- `src/app/api/kitchen/photo/route.ts`: белый список фото собран из `products[].image` при сборке сайта (`src/data/1c/catalog.json` — статический импорт) — новое фото из 1С прокси отдаст только после `deploy/site/update_site.sh`; чужой `src` → 400 без запроса наружу.
- Тот же список живёт в `store('kitchen-photo-allow')` (`src/lib/store.ts`) — в `npm run dev` переживает перезагрузку файла: правишь список — перезапусти dev.
- Заголовки безопасности (рамка, referrer, nosniff) — `headers()` в `next.config.ts`, в nginx их нет и не дублировать.
- `src/components/kitchen/three/governor.ts` — чистая функция, чёткость только в движении; `engine.ts` зовёт её лишь на телефоне-ветке, `!this.mobile` не трогать. Порог «быстро» 17,5 мс (rAF на 60 Гц = 16,7 мс, ниже никогда не сработает), рывок обрезан 80 мс.
- `lowEnd` в `engine.ts` = телефон и (`deviceMemory` ≤ 3 или `LOW_END_GPU` или Android с ≤ 4 ядрами). iPhone по ядрам не судить: Safari отдаёт не настоящее число, и новый iPhone попадал в «простые». Телефон в 4K рисует в покое все точки экрана (`fineRatio`) — с ограничением в 2 точки 4K на iPhone был мыльным.
- `KitchenPlanner.tsx`: движок рисует в `.kp-scene` (`hostRef`), не в `.kp-stage` (`stageRef`) — иначе полоса видов `.kp-stage__bar` попадает в кадр и в фото. Её высота — `--kp-strip` (40 px только в телефонной раскладке).
- Раскладка телефона: одна и та же строка `(max-width: 900px) and (min-height: 521px)` — `STACKED` в `KitchenPlanner.tsx` и `@media` в `kitchen.css`; менять обе.
- Полный экран с листом настроек: `fullPanel` → класс `is-panel` ставится только вместе с `kp--full` и стилизован только внутри телефонного `@media`; на компьютере полный экран прежний.
- `src/lib/kitchen/variants.ts` `parseVariants` фильтрует `localStorage['kp-variants']` — битая запись раньше роняла страницу; сырой `JSON.parse` туда не возвращать.
- Качество «Лёгкий» (`lite`): в `engine.ts` единый `get lite()`, в сборку флаг едет только через `Mats.lite` (`materials.ts`) — новых `quality === 'lite'` не рассыпать; `Built.spec` (числа для мебельщика) от `lite` не зависит.
- Термины: только «Духовка» и «Варочная панель» (KY: духовка — «Духовка», варочная панель — «Бышыруучу панель»; «Сордургуч» — это вытяжка, не духовка) — `kitchen-texts.test.ts` падает на «Плита»/«Духовой шкаф» в любой строке `texts.ts`, кроме группы `t.stove` — там «Плита» значит отдельностоящую плиту (товар слота `hob` с `stove: true`).
- `KitchenPlanner.tsx` берёт из `./three/*` только `import type`; движок, фото и `buildKitchen` (запасной `spec` без 3D) — через `import()`: обычный импорт затянет three.js в основной бандл. Числа (окно и пр.) — из `dims.ts`, он лёгкий.
- Плашка корзины сайта `.cart-bar` (`src/app/globals.css`): на компьютере `html.kp-over .cart-bar ~ .assistant` в `kitchen.css` поднимает консультанта над ней — высота 70 px вписана числом, поменял плашку — поправь и тут; `kp-over` ставит `KitchenPlanner.tsx`, пока низ конструктора у края экрана. Та же высота — в отступе прокрутки над «Для мебельщика»: поправлять оба места. На компьютере «Дальше» и «Начать заново» — в липком ряду `.kp-next-row` (фон `--kp-panel-bg`).
- `smartcentr-site/` — распакованная копия архива из `deploy/site/pack.sh`; в git её не класть (есть в `.gitignore` и `.dockerignore`): `tsconfig` берёт `**/*.ts`, и старая копия ломает `tsc` и засоряет `graphify`.
- Язык раскроя: `cutWorkbook` берёт язык и `tier` только из `t.xl` (`look.lang` затирает); смета пишет подписи по `t.xl.lang`, но названия цветов листов (`EstimateRow.what`) уже сделал `cutParts` по `look.lang` — на экране `lang` и `t` одного языка.
- Цен по умолчанию нет и не выдумывать: пусто → `price: null`, `sum: null`, «цена не указана», не в итоге, ключ в `missing`; `0` — настоящая цена. Цветной лист (не `isWhiteSheet`: сравнение по hex, не по `label`) без `ldspDecor` — тоже «не указана», белую цену не подставлять.
- Новое поле `kp-master` — без смены `VERSION` (1): другая версия читается как пусто, и мастер теряет все цены. Новая цена: `MasterPrices`, `PRICE_KEYS` (иначе `parseMaster` молча выкинет её при чтении), `EstimateKey`, `estimate`, `estimateLines`, `PlainPrice` + `PRICE_FIELDS` в `KitchenPlanner.tsx` (иначе нет поля в форме), `t.master.fields` RU/KY; `PRICE_KEYS` и `PRICE_FIELDS` tsc не проверяет.
- Всё из `hardware(spec)` — своей строкой в `estimate` (`kitchen-master` сверяет по ключам): новое поле `Hardware` — строка сметы и цена. Фартук (`spec.splash`) — только в Excel «Фурнитура», в смете его нет.
- Текстура (`grain`, декор под дерево): `length` — вдоль волокна (у фасада — высота), поэтому бывает меньше `width`; `nest` такую деталь не поворачивает — поперёк не влезла → `oversize`.
- Неизвестный id отделки — `cutParts` бросает (белый молча не подставлять): экран ловит в `cut` → `t.master.failed`. `pdfKey` (кэш «PDF для мастера») содержит `master.bodyEdge` и `master.sheets`: новое поле мастера, меняющее раскрой, — туда же, иначе уйдёт старый файл.
- Новый цвет фасада — только строкой в `RAL`/`DECORS`/`FRONT_COLORS`: ссылка (`fc`/`uf`/`ofc`/`if`), 3D, раскрой и поиск поймут его через `frontColor`; свой разбор id рядом не писать.
- Lamarty без номеров: `code: ''`, id — по адресу страницы на lamarty.ru, печать «Lamarty <название>». Kronospan — только декоры, которые выпускаются как ЛДСП (K091/K200/K201/K203/K205 — столешницы/HPL, их нет); однотоны с буквой K (K112, не 0112).
- Экранные цвета RAL (sRGB из en.wikipedia) и декоров (вручную) — примерные, покупателю это сказано (`t.colors.approx`); фото декоров не брать — права производителя, рисунок из `wood`/`concrete`.
- «3D = раскрой»: что раскрой считает корпусом — в 3D `mats.body`, что панелью цвета фасада — цвет фасада. Новую видимую деталь 3D добавляй и в `spec`/раскрой, иначе мастер её не выпилит.
- Галерея: телефон наружу не уходит никогда — в `GalleryCard`/`GalleryComment`, ответах `/api/gallery/*`, страницах и панели только `authorName` (`authorNameOf`: первое слово, одни буквы, иначе `''` — подпись по `role`) и `authorId`; `phone` есть лишь в `StoredKitchen`/`StoredComment` (`store.ts`), новое поле наружу — только через `toCard`/`toPublic` (`gallery-pages` ловит телефон в разметке).
- `q` кухни хранится каноничным (`canonicalQuery`: `stateFromQuery` → `queryFromState`, чужие ключи выброшены, id техники только `cb-<цифры>` или UUID 1С) и выводится только как query в `/[lang]/kitchen?<q>` — не текстом и не в HTML.
- `.gitignore`: правило `data/` прятало новые файлы в `src/data/` (готовые кухни) — сразу после него `!src/data/`, не убирать. Правка `READY` → `node scripts/kitchen-ready-shots.mjs --fixture` → `npx vitest run __tests__/kitchen-ready.test.ts` → кадры `node scripts/kitchen-ready-shots.mjs <id>`: скрипт снимает то, что сейчас на `BASE` (по умолчанию `https://smarket.kg`), новое в конструкторе — после выкладки или `BASE=http://localhost:3113`.
- «Скрыть» в `/panel/gallery` (`hideKitchen`) стирает картинки сразу, «вернуть» нет; скрытая — 404 на странице, в API, `readImage` и карте сайта, при вычистке уходит первой. `DELETE` автора стирает запись целиком, слот «5 в сутки» не возвращает.

### Галерея кухонь (27.09.2026)

- Покупатель ставит кухню из конструктора в `/[lang]/kitchen/gallery` (кадр 3D + строка проекта `q`); ставить, оценивать (1–5, не свою), комментировать, жаловаться, «Я сделал такую» (фото вживую, только автор) — только вошедшему: `currentSession()` (`src/app/api/customer/route-helpers.ts`) → `{phone, name}`. Решения — `docs/adr/0011`…`0016`.
- `src/lib/gallery/rules.ts` — для браузера и сервера (без fs, сети, секретов): типы `GalleryCard`/`GalleryKitchen`/`GalleryComment`, лимиты (`PAGE_SIZE` 24, `MAX_TITLE` 80, комментарий 2–500, кадр ≤ 400 КБ, превью ≤ 80 КБ, фото вживую ≤ 5, `PUBLISH_PER_DAY` 5, `RATES_PER_MINUTE` 30, `COMMENTS_PER_KITCHEN` 300, `MAX_KITCHENS` 2000, `IMAGE_BUDGET` 3 ГБ), `rankScore` («Лучшие»: байес, априори 3,5 с весом 5), `cleanComment` (телефоны и ссылки → «…»), `canonicalQuery`, `titleOf(q, lang)`, `wallLength`, `sizeBand` (≤ 270 / ≤ 400 / больше → `small|mid|big`).
- `src/lib/gallery/author.ts` (`server-only`, отдельно — в нём секрет): `authorIdOf(phone)` = HMAC-SHA256 на `SHOP_API_SECRET` → 12 hex; без секрета в production — ошибка, в dev — sha256 с солью и предупреждением.
- `src/lib/gallery/store.ts` (`server-only`, устроен как `src/lib/reviews/store.ts`): папка `GALLERY_DIR || ASSISTANT_LOG_DIR/gallery` (по умолчанию `data/gallery`, на сервере том `/app/data`) — `kitchens.json` (новые сверху), `publishes.json` (журнал «5 в сутки»), `images/`. Запись очередью `serial`, файл целиком через временный; битый `kitchens.json` — исключение, не пустая галерея. Вычистка при публикации (`evict`): скрытые → без оценок → старые; `GALLERY_MAX`/`GALLERY_IMAGE_BUDGET` — только для тестов.
- `src/lib/gallery/image.ts`: `imageSize` по байтам заголовка, `sizeOk` (сторона ≤ `MAX_SIDE` 4000), `stripMeta(bytes, ext)` срезает EXIF/XMP/текст JPEG/PNG/WebP до записи на диск; всё зовёт `imageFrom` в `src/app/api/gallery/helpers.ts`.
- API `src/app/api/gallery/*`: `GET /api/gallery?sort=new|top&shape&author=<12hex>&real=1&mine=1&page`; `POST` multipart `q, title?, role=buyer|master, image, thumb` → `{ok, id}`; `GET`/`DELETE /api/gallery/[id]` (DELETE — автор убирает свою); `POST …/rate {stars}`, `…/comments {text}`, `…/report {commentId?}`, `…/photos` (`photos[]` + `thumbs[]`); `GET /api/gallery/image/[name]` — только картинки видимых кухонь, кеш 5 мин.
- Ошибки `{ok:false, error, reason?}` (`helpers.ts` `fail`): `login` 401, `too-many` 429 (`reason`: `day` — 5 за сутки, `often`, `photos`, `comments`), `bad-input` 400, `not-found` 404, `forbidden` 403, `no-space` 507, `save` 500. Предел по адресу — только `ipOf` = `x-real-ip` (ставит nginx; `X-Forwarded-For` клиент подделывает): публикаций 20 в сутки с адреса, без адреса (dev) не считается.
- Панель владельца `/panel/gallery?key=…` (`src/app/panel/gallery/route.ts`, ключ `ASSISTANT_LOG_KEY`, как у отзывов; не тот — 404): последние 60, с жалобами сверху, «Скрыть» кухню / комментарий / фото (POST → 303 обратно); телефонов нет.
- Страницы: `src/app/[lang]/kitchen/gallery/page.tsx` («Готовые» / «Лучшие» / «Новые», `?sort=new&shape&size=small|mid|big&real=1&mine=1&author=&page` ≤ 50, по умолчанию `top`) и `src/app/[lang]/kitchen/gallery/[id]/page.tsx` (`<16 hex>` или `ready-<id>`), обе `force-dynamic`. Данные — `src/components/gallery/data.ts` (`kitchenPage`, `galleryTiles`, `readyTiles`, `kitchenFacts`: техника и цены из текущего каталога); вид — `KitchenView.tsx`, `KitchenTile.tsx`, `social.tsx` (оценка, комментарии, фото, вход `CustomerLogin`); тексты — `src/lib/gallery/texts.ts` (`galleryTexts`, `errorText`). «Хочу такую же» → `/[lang]/kitchen?<q>`; `src/app/sitemap.ts` — готовые + `publishedIndex()`.
- Готовые кухни: `src/data/kitchen-ready.ts` `READY` (12 × `{id, q, ru, ky, image, thumb, card}`), `readyKitchen(id)`; кадры `public/kitchen/ready/<id>.jpg` 1200×750, `<id>-s.jpg` 480×300, `<id>-card.jpg` 1200×630, каждый ≤ 250 КБ. Снимает `node scripts/kitchen-ready-shots.mjs [id…]` (Playwright + установленный Chrome; `BASE`, `CHROME=`, `NO_GPU=1`); `--fixture` пишет технику живого сайта в `__tests__/fixtures/kitchen-live-appliances.json`: локальный `src/data/1c/catalog.json` устарел (нет холодильников, посудомоек, варочных), `kitchen-ready` проверяет проекты по фикстуре.
- Конструктор, шаг «Форма»: `src/components/kitchen/ReadyStrip.tsx` — 12 готовых + до 6 лучших из `GET /api/gallery?sort=top` (`topOfGallery`: avg ≥ 4 и count ≥ 3), фильтры форма / размер / бюджет (`inBudget`); своя кухня собрана → «Заменить?», своя сначала в «Мои варианты» (`openReady` в `KitchenPlanner.tsx`). `src/components/kitchen/ready.ts` (без React и three.js): `openQuery(q, appliances)` → `{state, missing}` (пропавшая модель — пустой слот, не замена), `techSum`, `keepOnLink(last, next)` — открыли по ссылке `?f=`, а в `kp-last` другая своя → сначала в «Мои варианты», иначе автосохранение через 400 мс её затрёт.
- «В галерею» — кнопка в `.kp-maker` рядом с «Поделиться» (выключена, пока `galleryWhy` ≠ null: 3D нет, потеряно или не готово) и вопрос после «Сохранить вариант». `PublishLoader.tsx` грузит `PublishDialog.tsx` через `import()` (вход и кабинет не в бандле конструктора); `Modal.tsx` — портал в `document.body`, Esc и щелчок мимо закрывают, `locked` — пока отправка. Кадр `engine.sheetShot(1200, 750)` → `shot.ts` `galleryShots`; ответ — `publish.ts` `readPublish(status, body)` → `login|limit|often|no-space|save|bad-input|other` (`limit` = `reason: day`, `other` = нет сети). Тексты — `t.gallery.*` в `texts.ts` RU/KY.
- `checks.ts`: `triangle` (стороны 115–270, сумма ≤ 790) — только если холодильник, мойка и варочная не все в одном ряду; все три в одном ряду — `workLine`: два соседних по ряду отрезка, каждый ≤ 270 (`TRIANGLE.legMax`).
- Тесты: `gallery-store`, `gallery-api` (подмена сессии), `gallery-pages` (разметка без телефонов, скрытой нет), `kitchen-ready`, `kitchen-ready-strip`, `kitchen-publish`.

### Android (25.09.2026)

- `android/` — оболочка Capacitor 8 (`kg.smarket.app`) над `https://smarket.kg`; свои плагины `BonusCard`, `AppLock`, `OfflineCatalog` регистрирует `MainActivity.onCreate` до `super.onCreate`; контракт с сайтом общий с iPhone (`src/lib/native/*.ts`) — имена плагинов и вызовов не менять.
- Java 21 keg-only, в PATH нет, `adb`/`emulator` тоже — всегда полные пути. AAB для Play, из корня: `npx cap sync android && cd android && JAVA_HOME=/opt/homebrew/opt/openjdk@21 ./gradlew bundleRelease` → `android/app/build/outputs/bundle/release/app-release.aab`; копию — в `build-play/smarket-1.0-code<versionCode>.aab` (`build-play/` вне git).
- `versionCode` в `android/app/build.gradle` — сейчас 3 (`build-play/smarket-1.0-code3.aab`); перед каждой загрузкой в Play +1, тот же номер Play не примет.
- Подпись: ключ `~/smarket-keys/smarket-upload.jks` (алиас `smarket-upload`) и `android/keystore.properties` вне git, создаёт один раз `scripts/android-keystore.sh`; без `keystore.properties` release выйдет неподписанным. Файл не открывать, пароли не печатать.
- Эмулятор: AVD `smarket-api36` (API 36 Play Store arm64, Pixel 7, датчик отпечатка) сделан руками в `~/.android/avd/` — brew-овский `avdmanager` SDK не видит. Запуск: `~/Library/Android/sdk/emulator/emulator -avd smarket-api36 -no-window -no-audio -no-boot-anim -no-snapshot-save -gpu swiftshader_indirect`.
- APK на эмулятор, из корня: `npx cap sync android && cd android && JAVA_HOME=/opt/homebrew/opt/openjdk@21 ./gradlew assembleRelease && cd .. && ~/Library/Android/sdk/platform-tools/adb install -r android/app/build/outputs/apk/release/app-release.apk`.
- Подвох: Capacitor 8 вставляет свой JS (`window.Capacitor` и плагины) только в страницы адреса `server.url`; «Нет связи» — `https://localhost/index.html` из `ios-web/` (`errorPath`, общая с iPhone), мост и `BonusCard`/`OfflineCatalog` ей даёт `MainActivity.connectOfflinePage()` (`androidx.webkit` 1.14.0). Обновил Capacitor — выключи сеть (`~/Library/Android/sdk/platform-tools/adb shell svc wifi disable`, то же `svc data disable`) и проверь кнопки «Каталог» и «Бонусная карта».
- «Повторить» на «Нет связи» открывает главную smarket.kg, не ту страницу, где был покупатель; «Назад» листает историю сайта, на первой странице сворачивает приложение.
- Вход без демо-кода (он секрет владельца, не искать): временно в `capacitor.config.ts` `server.url: 'http://10.0.2.2:3100'` и `server.cleartext: true`, сайт `SHOP_PAYMENT_MODE=mock npx next dev -p 3100` (код 1234, оплата понарошку), `npx cap sync android` и пересборка; потом вернуть `https://smarket.kg`, убрать `cleartext`, снова `npx cap sync android`.
- Конец сессии (180 дней) для «Войти по отпечатку» — перевести часы эмулятора вперёд, потом `~/Library/Android/sdk/platform-tools/adb shell settings put global auto_time 1`.
- Push на Android выключен: `android.includePlugins: []` в `capacitor.config.ts` — без Firebase плагин роняет приложение; включать только вместе с `android/app/google-services.json` (сейчас нет) и отправкой через FCM на сервере SBonus.
- Шаги для владельца (Play Console, картинки, следующая версия) — `docs/ANDROID_PLAY_UZ.md`; снимки и логи проверок — `build-play/android-check/<таск>/`.
- Play Console → «Финансовые функции» — только «В моем приложении нет финансовых функций». Бонусы SBonus отмечены как «поощрительные программы» → 26.09.2026 отказ: финансовые функции публикуют лишь аккаунты-организации, а наш аккаунт личный.
- Аккаунт Play личный: в «Рабочую версию» только после закрытого теста ≥ 12 тестировщиков × ≥ 14 дней (канал «Закрытое тестирование – Alpha», список «Smart Centr testers», страна — Киргизия). Аккаунт разработчика заведён 06–07.06.2026 (письмо Google «вы зарегистрировали новый аккаунт разработчика»), поэтому правило действует — Gmail старше, но считается дата аккаунта разработчика. «Открытое тестирование» тоже заперто до доступа к рабочей версии.
- Второй закрытый канал «Покупатели (группа)» (26.09.2026): тестировщики — Google Группа `smarket-app@googlegroups.com` (вступить может любой, писать и видеть участников — только владелец), тот же выпуск 1.0 (3). Покупатель: вступает на https://groups.google.com/g/smarket-app → https://play.google.com/apps/testing/kg.smarket.app → ставит из Play. В канале Alpha список и группа — взаимоисключающие переключатели: группу в Alpha не ставить, иначе 14 человек из списка потеряют доступ.
- 26.09.2026 в 19:12 Alpha кто-то приостановил («Неактивно»), в ~23:00 возобновлено. Приостановленный канал не раздаёт приложение тестировщикам — перед заявкой на рабочую версию проверить, что Alpha «Активно».
- `smarket.kg` за Cloudflare Bot Fight Mode: проверка ссылок Play Console получает 403 (у нас и у Googlebot — 200). Это предупреждение, не ошибка.
<!-- autopilot:end -->
