# Манифест требований

Источник: `2026-09-27-brief.md`. Строку из этого списка может снять **только пользователь**.

| ID | Из брифа (дословно) | Статус | Основание | Где |
|----|---------------------|--------|-----------|-----|
| R01 | «1» — пакет цвета, не пакет света | in-ticket | ответ «1»; пакет света — не в этом прогоне | spec весь прогон → T01–03 |
| R02 | «Istalgan RAL rangi. Mijoz yoki usta RAL kodini yozadi (masalan, RAL 7016)» | in-ticket | ASSUMPTION — палитра RAL Classic целиком, экранные цвета по общепринятой таблице; ввод кода «7016» / «RAL 7016» или выбор из палитры | spec ист. 1–2 → T01, 03 |
| R03 | «fasad 3D'da shu rangga kiradi» | in-ticket | решается в спецификации | spec ист. 3 → T01 |
| R04 | «Emal va bo'yoq ustalari RAL kodi bilan ishlaydi» | in-ticket | ASSUMPTION — RAL — это крашеный фасад (эмаль МДФ): в раскрое — «в цех фасадов» с кодом RAL; корпус ЛДСП в RAL не красится | spec ист. 4 → T01, 03 |
| R05 | «Haqiqiy LDSP dekorlari, kodi bilan. Masalan, Egger, Kronospan, Lamarty» | in-ticket | владелец: «Ommabop dekorlar (Recommended)» — Egger, Kronospan, Lamarty, по 10–12 ходовых декоров, код и название из официального каталога | spec ист. 5–6 → T01 |
| R06 | «Dekor 3D'da ko'rinadi» | in-ticket | решается в спецификации | spec ист. 7 → T01 |
| R07 | «va Excel raskroyga kodi bilan tushadi, shuning uchun usta listni xato buyurtma qilmaydi» | in-ticket | решается в спецификации | spec ист. 8 → T03 |
| R08 | «Bishkekda qaysi brendlar sotilishini siz aytasiz» | in-ticket | владелец выбрал стартовый набор трёх брендов; список правится в одном файле по поставщику | spec Решения §4 → T01 |
| R09 | «Aniq teksturalar uchun rasmlar kerak bo'lishi mumkin» | in-ticket | ASSUMPTION — фото декоров не качаем (права производителя): рисунок декора строится кодом (дерево/бетон/камень/однотон) в цвете декора, с пометкой «цвет на экране примерный — смотрите образец»; фото образцов владельца потом подкладываются | spec ист. 7 → T01, 03 |
| R10 | «Orol (ostrov) uchun uchinchi rang» | in-ticket | ASSUMPTION — у фасадов острова (и его задней панели) своя отделка: каталог, декор ЛДСП или RAL | spec ист. 9–10 → T02, 03 |
| R11 | «mijoz 3D'da ko'rgan rang real buyurtmadagi rang bilan bir xil bo'ladi» | in-ticket | решается в спецификации | spec ист. 11 → T02, 03 |
| R12i | *(подразумевается R11)* код цвета/декора доходит до всего, что уходит мастеру и в магазин: смета, PDF мастеру, WhatsApp, ссылка на проект | in-ticket | решается в спецификации | spec ист. 11 → T03 |
| R13i | *(подразумевается)* покупателю и мастеру удобно: телефон, RU/KY; найти цвет по коду или названию быстро | in-ticket | решается в спецификации | spec ист. 6, 12 → T03 |
| R14i | *(подразумевается)* ничего не сломано: прежние ссылки и сохранённые кухни открываются как были, тесты зелёные; выкладка только по слову владельца | in-ticket | решается в спецификации | spec ист. 13 → T01–03 |
| G01 | «3D'da korpus rangi» — видимые боковины корпусов в 3D цветом корпуса, как в раскрое | in-ticket | владелец, ответ на вопрос 2026-09-27; ревью таска 02 нашло расхождение 3D ↔ раскрой | spec ист. 14 → T04 |
