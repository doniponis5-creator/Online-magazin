# Манифест требований

Источник: `2026-09-26-brief.md`. Строку из этого списка может снять **только пользователь**.

| ID | Из брифа (дословно) | Статус | Основание | Где |
|----|---------------------|--------|-----------|-----|
| R01 | «git pull qil» | done | ветка сессии перемотана на `origin/feature/ios-app` (7991c2e) — там вся свежая работа; `main` содержит только документы | preflight |
| R02 | «3d konstruktorni audit qil hatolari yoqmi hisob kitobta» | done | аудит `audit-calc.md` C01–C18; исправления | T02 7a5dd84, T03 cd0a9ae, T04 74ea6a7, T05 c630360, T08 233f9d1 |
| R03 | «hatolari yoqmi … chertejda» | done | аудит `audit-drawing.md` D01–D28; исправления D01–D28 | T04 74ea6a7, T06 27d19e7 |
| R04 | «kamchiliklari» | done | аудит `audit-ux.md` U01–U23 | T01 4f78c71, T05 c630360 |
| R05 | «keremas narsalari» | done | аудит `audit-ux.md` X01–X10; X06–X10 — предложения в отчёт | spec ист. 46–47 → T01 (4f78c71) |
| R06 | «klientga udobstvasi» | done | аудит `audit-ux.md` U01–U20 | T02 7a5dd84, T05 c630360, T07 a9005b0; U12, U13, U15, U19, U23 — «Вне рамок» |
| R07 | «odamlarga foydasi ?» | done | `audit-pro.md` §1, `audit-summary-uz.md` | `audit-summary-uz.md` → финальный отчёт |
| R08 | «yanayam PRO qilish uchun nima qilish kerak ?» | done | `audit-pro.md` §3; быстрые шаги — G01, остальное — план в отчёте | `audit-summary-uz.md`, `audit-pro.md` §3 → финальный отчёт |
| R09 | «/impeccable polis» | done | навык impeccable, режим polish — последний таск | T07 a9005b0 |
| R10 | «/graphify» | done | карта `graphify-out/` использована для ориентации; после правок — `graphify update .` | T07 a9005b0, T08 (graphify update) |
| R11 | «/autopilot» | done | прогон ведётся навыком | T01–T08 |
| R12i | *(подразумевается: /autopilot + аудит)* найденные ошибки в расчётах и чертеже исправлены, а не только перечислены | done | исправления с тестами | T03, T04, T06, T08 |
| R13i | *(подразумевается)* ничего рабочего не сломано: тесты зелёные, 1С и сервер SBonus не тронуты, на сайт без спроса не выкладывается | done | tsc + vitest + build после каждого таска; без push и деплоя | все таски: tsc + vitest 373 + build зелёные; без push и деплоя |
| R14i | *(подразумевается)* отчёт аудита понятен владельцу — по-узбекски, без жаргона | done | `audit-summary-uz.md` + отчёт по-узбекски | `audit-summary-uz.md` → финальный отчёт |
| G01 | «Xato + tez PRO (Tavsiya)» — avto-saqlash, WhatsApp'ga to'liq ro'yxat va narx, tovar sahifasida «Oshxonada ko'rish», PDF'da reja va telefon, «Texnika» 3-qadamga | done | ответ владельца на вопрос брифинга | T02 7a5dd84, T05 c630360, T06 27d19e7 |
