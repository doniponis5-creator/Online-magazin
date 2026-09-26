# 3D oshxona konstruktori — audit xulosasi (2026-09-26)

To'liq isbotlar: `audit-calc.md` (hisob-kitob, C01–C18), `audit-drawing.md` (chizma va PDF, D01–D28),
`audit-ux.md` (qulaylik U01–U23, matnlar T01–T18, keraksiz X01–X10), `audit-pro.md` (PRO va foyda).

## Xatolar bormi?

Ha. Hisob-kitobda 18 ta, chizmada 28 ta. Hammasi kodni ishga tushirib isbotlangan
(40 000 ta tasodifiy oshxona, 400 ta chizma). Modullar devorga teshiksiz, ustma-ust tushmasdan
joylashadi — asos to'g'ri. Xatolar chekka holatlarda.

Eng jiddiylari:
1. Joy yetmasa, rakovina va plita jimgina yo'qoladi, narxda esa qoladi (C01).
2. Oddiy mikroto'lqinli pech ro'yxatda narxi bilan turadi, lekin jamiga ham, savatga ham tushmaydi (C02, U02).
3. Idish yuvish mashinasi uchun raskroyga ortiqcha 2 ta yon devor chiqadi: teshik 41,8 sm, mashina 44,8 sm (D01).
4. Keng vytyajka (90 sm) tor plita (60 sm) ustida yonidagi shkaflarga 15 sm dan kirib ketadi (D03, C10).
5. Kir yuvish mashinasi 85 sm, stoleshnitsa ostida 82 sm — sig'maydi, ogohlantirish yo'q (C11, D04).
6. Tor planka (1–14 sm) ustida «shkaf» chiziladi — 8 mm lik detallar, yasab bo'lmaydi (C06, D02).
7. Baland shiftda detallar 3,1 m gacha — LDSP listi 2,8 m (C08).
8. Chizmada B va C devorda burchakdagi 60 sm yo'q: 180 ko'rsatilgan, devor 240 (D06).
9. Havola orqali ochilganda «eshik o'ngga» boshqa shkafga o'tadi (C12).
10. 1C dan o'lcham noto'g'ri o'qilishi mumkin: «В×Ш×Г» — xolodilnik 185 sm keng bo'lib qoladi (C15).

## Kamchiliklar va mijozga qulaylik

- Menyu orqali qaytsa, ish yo'qoladi — avto-saqlash yo'q (U01).
- «Hammasini savatga» ikki marta bosilsa, har biridan 2 tadan tushadi (U04).
- Texnika — do'kon pul topadigan joy — 5-chi, oxirgi qadamda (U06).
- Konstruktordan tovar sahifasiga o'tib bo'lmaydi (U05).
- WhatsApp'ga faqat havola ketadi, tugma sahifa pastida (U09).
- «Поделиться» havola o'rniga og'ir PDF yuboradi (U10).
- Kompyuterda aylantirmoqchi bo'lsa, shkaf siljib ketadi (U08).
- PDF'da tepadan ko'rinish, do'kon telefoni, vytyajka balandligi yo'q (D19, D22, D16).

## Keraksiz narsalar

- `smartcentr-site/` — butun saytning eski nusxasi, 25.09 da tasodifan gitga tushgan. Hech narsa ishlatmaydi. O'chirish xavfsiz (X01).
- 10 ta ishlatilmaydigan matn; sarlavhada «15 stil», aslida 21 ta (X02, T16).
- «Отделка»da ~225 variant — mebel sotilmaydi, mijozning vaqti shu yerga ketadi (X06).

## Odamlarga foydasi

- Mijoz: 10–15 daqiqada telefonda oshxonasini haqiqiy texnika bilan ko'radi.
- Usta (mebelchi): tayyor chizma va raskroy oladi, qayta chizmaydi.
- Do'kon: bitta duxovka emas, to'liq to'plam sotiladi; «sig'adimi?» qo'ng'iroqlari kamayadi.
- To'siq: saytda varochnaya panel 0 ta — bu 1C ma'lumoti, kod emas.

## PRO qilish uchun

1. 1C ga o'rnatiladigan texnika va «o'rnatish o'lchami» (egasi qiladi).
2. Har bir model nishaga sig'adimi — tekshiruv va PDF'da o'rnatish o'lchamlari jadvali.
3. WhatsApp'ga to'liq ro'yxat, narx va jami; tugma jami yonida.
4. Tovar sahifasida «Oshxonada ko'rish» tugmasi.
5. PDF'da reja (tepadan), rozetka/suv/gaz nuqtalari, do'kon telefoni.
6. Avto-saqlash; keyin — kabinetda loyihani saqlash.

Qilmaslik kerak: mebel narxini ko'rsatish — Bishkekda narxlar 3–4 barobar farq qiladi.
