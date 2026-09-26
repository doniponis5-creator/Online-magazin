# Манифест требований

Источник: `2026-09-26-brief.md`. Строку из этого списка может снять **только пользователь**.

| ID | Из брифа (дословно) | Статус | Основание | Где |
|----|---------------------|--------|-----------|-----|
| R01 | «git pull qil» | done | ветка сессии перемотана на `origin/feature/ios-app` (7991c2e) — там вся свежая работа; `main` содержит только документы | preflight |
| R02 | «3d konstruktorni audit qil hatolari yoqmi hisob kitobta» | in-ticket | аудит `audit-calc.md` C01–C18; исправления | spec ист. 3–20 → T02, T03, T04, T05 |
| R03 | «hatolari yoqmi … chertejda» | in-ticket | аудит `audit-drawing.md` D01–D28; исправления D01–D28 | spec ист. 21–32, 31a → T04, T06 |
| R04 | «kamchiliklari» | in-ticket | аудит `audit-ux.md` U01–U23 | spec ист. 33–45 → T01, T05 |
| R05 | «keremas narsalari» | in-ticket | аудит `audit-ux.md` X01–X10; X06–X10 — предложения в отчёт | spec ист. 46–47 → T01 |
| R06 | «klientga udobstvasi» | in-ticket | аудит `audit-ux.md` U01–U20 | spec ист. 33–44 → T02, T05, T07 |
| R07 | «odamlarga foydasi ?» | done | `audit-pro.md` §1, `audit-summary-uz.md` | `audit-summary-uz.md` → финальный отчёт |
| R08 | «yanayam PRO qilish uchun nima qilish kerak ?» | done | `audit-pro.md` §3; быстрые шаги — G01, остальное — план в отчёте | `audit-summary-uz.md`, `audit-pro.md` §3 → финальный отчёт |
| R09 | «/impeccable polis» | in-ticket | навык impeccable, режим polish — последний таск | spec ист. 48 → T07 |
| R10 | «/graphify» | in-ticket | карта `graphify-out/` использована для ориентации; после правок — `graphify update .` | spec ист. 50 → T07 |
| R11 | «/autopilot» | in-ticket | прогон ведётся навыком | весь прогон, T01–T07 |
| R12i | *(подразумевается: /autopilot + аудит)* найденные ошибки в расчётах и чертеже исправлены, а не только перечислены | in-ticket | исправления с тестами | spec ист. 3–32 → T03, T04, T06 |
| R13i | *(подразумевается)* ничего рабочего не сломано: тесты зелёные, 1С и сервер SBonus не тронуты, на сайт без спроса не выкладывается | in-ticket | tsc + vitest + build после каждого таска; без push и деплоя | spec ист. 49 → все таски |
| R14i | *(подразумевается)* отчёт аудита понятен владельцу — по-узбекски, без жаргона | done | `audit-summary-uz.md` + отчёт по-узбекски | `audit-summary-uz.md` → финальный отчёт |
| G01 | «Xato + tez PRO (Tavsiya)» — avto-saqlash, WhatsApp'ga to'liq ro'yxat va narx, tovar sahifasida «Oshxonada ko'rish», PDF'da reja va telefon, «Texnika» 3-qadamga | in-ticket | ответ владельца на вопрос брифинга | spec ист. 29, 30, 33, 36, 37, 40 → T02, T05, T06 |
