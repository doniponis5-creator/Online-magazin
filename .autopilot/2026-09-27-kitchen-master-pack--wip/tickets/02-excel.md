# 02 — Excel для пильного центра

**Требования:** R02, R03, R04
**Blocked by:** 01
**Зона:** `src/lib/kitchen/xlsx.ts` (новый) · `src/lib/kitchen/cutExcel.ts` (новый) · `src/components/kitchen/texts.ts` (подписи колонок и листов) · тесты
**Волна:** 2
**Status:** ready

## Что должно заработать

Одна функция собирает книгу Excel: «Распил», «Фасады», «Столешница», «Фурнитура», «Кромка», «Листы»; другая пишет её в настоящий `.xlsx` без сторонних пакетов.

## Из брифа, дословно

> «Raskroyni kesish sexi (распил) uchun Excel'da berish»

## Разделы спецификации

Истории 1–3, 5, 7; Решения §1; Границы — `xlsx.ts`, `cutExcel.ts`.

## Критерии приёмки

- [ ] `xlsx(sheets)` → `Uint8Array` валидного .xlsx (zip «store», `[Content_Types].xml`, `_rels/.rels`, `xl/workbook.xml`, `xl/_rels/workbook.xml.rels`, `xl/styles.xml`, `xl/worksheets/sheetN.xml`); числа — числами, текст — inline string, кириллица и `& < > "` экранированы; ширины колонок; тест разбирает файл обратно (свой мини-разбор zip store + проверка XML) и сверяет ячейки
- [ ] Файл открывается LibreOffice без ошибок: проверь `soffice --headless --convert-to csv` если есть, иначе Python `zipfile` + разбор XML (приложи вывод)
- [ ] `cutWorkbook(spec, look, t)` — листы и колонки по историям 2–3 (все колонки заданы в спеке), «Листы» — сводка и раскладка по каждому листу, итоги кромки и листов по историям 5, 7; RU/KY подписи
- [ ] `npx tsc --noEmit`, `npx vitest run`, `npm run build` зелёные
