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

### Подводные камни кухни (24.09.2026)

- `src/app/api/kitchen/photo/route.ts`: белый список фото собран из `products[].image` при сборке сайта (`src/data/1c/catalog.json` — статический импорт) — новое фото из 1С прокси отдаст только после `deploy/site/update_site.sh`; чужой `src` → 400 без запроса наружу.
- Тот же список живёт в `store('kitchen-photo-allow')` (`src/lib/store.ts`) — в `npm run dev` переживает перезагрузку файла: правишь список — перезапусти dev.
- Заголовки безопасности (рамка, referrer, nosniff) — `headers()` в `next.config.ts`, в nginx их нет и не дублировать.
- `src/components/kitchen/three/governor.ts` — чистая функция, чёткость только в движении; `engine.ts` зовёт её лишь на телефоне-ветке, `!this.mobile` не трогать. Порог «быстро» 17,5 мс (rAF на 60 Гц = 16,7 мс, ниже никогда не сработает), рывок обрезан 80 мс.
- `lowEnd` в `engine.ts` = телефон и (`deviceMemory` ≤ 3 или ядер ≤ 4 или `LOW_END_GPU`); iPhone не называет ни память, ни видеокарту — там решают только ядра (iPhone 7 / SE 2016 → простой).
- `KitchenPlanner.tsx`: движок рисует в `.kp-scene` (`hostRef`), не в `.kp-stage` (`stageRef`) — иначе полоса видов `.kp-stage__bar` попадает в кадр и в фото. Её высота — `--kp-strip` (40 px только в телефонной раскладке).
- Раскладка телефона: одна и та же строка `(max-width: 900px) and (min-height: 521px)` — `STACKED` в `KitchenPlanner.tsx` и `@media` в `kitchen.css`; менять обе.
- Полный экран с листом настроек: `fullPanel` → класс `is-panel` ставится только вместе с `kp--full` и стилизован только внутри телефонного `@media`; на компьютере полный экран прежний.
- `src/lib/kitchen/variants.ts` `parseVariants` фильтрует `localStorage['kp-variants']` — битая запись раньше роняла страницу; сырой `JSON.parse` туда не возвращать.
- Тесты: `npx vitest run` (23 файла, 247 passed на 24.09.2026); один — `npx vitest run __tests__/kitchen.test.ts`; также `kitchen-governor.test.ts`, `kitchen-variants.test.ts`.
<!-- autopilot:end -->
