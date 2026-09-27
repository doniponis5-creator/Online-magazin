# 01 — Палитра RAL и декоры ЛДСП в резолвере цвета

**Требования:** R02, R02.1 (данные), R03, R05, R05.1 (поиск), R06, R08, R09, R14i
**Blocked by:** —
**Зона:** `src/lib/kitchen/ral.ts` (новый) · `src/lib/kitchen/decors.ts` (новый) · `src/lib/kitchen/finishes.ts` · `__tests__/kitchen-colors.test.ts` (новый)
**Волна:** 1 (параллельно с 02 — зоны не пересекаются)
**Status:** ready

## Что должно заработать

`frontColor('ral-7016')` и `frontColor('dec-egger-h1145-st10')` возвращают обычный `FrontColor` — поэтому 3D, ссылка, автосохранение и раскрой сразу понимают новые цвета без своих веток.

## Из брифа, дословно

> «Istalgan RAL rangi. Mijoz yoki usta RAL kodini yozadi (masalan, RAL 7016), fasad 3D'da shu rangga kiradi.»
> «Haqiqiy LDSP dekorlari, kodi bilan. Masalan, Egger, Kronospan, Lamarty.»
> владелец: «Ommabop dekorlar» — по 10–12 ходовых декоров у каждого бренда

## Разделы спецификации

Истории 1–3, 5–7, 13; Решения §1–§4, §6; Границы (ral.ts, decors.ts, finishes.ts).

## Критерии приёмки

- [ ] `ral.ts`: `RAL` — палитра RAL Classic целиком (≈215 кодов), `{code: '7016', hex: '#383e42', ru: 'Антрацитово-серый'}`; экранные цвета — общепринятая таблица sRGB; `parseRal(input)` принимает `7016`, `RAL 7016`, `ral7016`, `RAL-7016`, пробелы → `'7016'`; несуществующий код → `null`
- [ ] `decors.ts`: `DECORS` — Egger, Kronospan, Lamarty, у каждого 10–12 ходовых декоров ЛДСП (белые/серые однотоны, дубы, бетон/камень). **Код и название сверь с официальным каталогом бренда** (сайт egger.com / kronospan / lamarty — WebSearch/WebFetch; картинки НЕ скачивать). Не нашёл подтверждения кода — декор не включай. Экранный цвет — подобран по описанию/превью вручную, это «примерно». Фактура: `wood` / `concrete` / нет (камень — как `concrete`). `id` = `dec-<бренд>-<код в нижнем регистре, пробелы → дефис>`. В начале файла — комментарий-источник (URL каталогов, дата сверки)
- [ ] `finishes.ts`: `FrontColor` += `code?: string` («RAL 7016», «Egger H1145 ST10»), `brand?`; `frontColor(id)`: `ral-NNNN` → `{material: 'enamel', color: hex, code: 'RAL NNNN', ru/ky: название}`, `dec-…` → `{material: 'laminate', texture, code: '<Бренд> <код>', …}`; прежние 52 цвета и их id — без изменений
- [ ] `findColors(query, lang?)`: ищет по коду и названию во всех видах (каталог, RAL, декоры), без учёта регистра и пробелов («h1145», «7016», «дуб»); пустой запрос → `[]`; результатов не больше разумного предела (например, 60)
- [ ] Тесты `__tests__/kitchen-colors.test.ts`: `parseRal` (форматы, мусор), `frontColor` для RAL и декора (материал, код, фактура), неизвестный `ral-0000` / `dec-x` → `undefined`, `findColors`; ссылка туда-обратно: `stateFromQuery(new URLSearchParams(queryFromState({...DEFAULT_STATE, facade:'ral-7016', upperFacade:'dec-…'})))` сохраняет оба; `cutParts` с декором-деревом → ЛДСП, текстура «да», свой label; с RAL → не из листа (МДФ); все прежние тесты зелёные
- [ ] `npx tsc --noEmit`, `npx vitest run` зелёные
