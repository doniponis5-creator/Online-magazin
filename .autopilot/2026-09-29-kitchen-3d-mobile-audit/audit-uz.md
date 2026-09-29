# 3D oshxona konstruktori — telefon, siljitish, tezlik: audit (2026-09-29)

Egasi aytdi: «3D oshxonadan ko‘nglim to‘lmayapti. Telefonda noqulay, shkaflarni xohlagan joyimga
jildirolmayapman, oddiy telefonlarda qotyapti, men esa 4K tiniklik xohlagandim. Sodda, lekin eng zo‘ri
bo‘lsin. Dizayndan chiqmaylik. Telefonda ham, kompda ham juda qulay bo‘lsin.»

Tekshirildi: kod (`src/components/kitchen/`, `src/lib/kitchen/`), brauzerda telefon rejimi 375×812
va kompyuter 1440×900. Dalillar kod satrlari bilan: `audit-render.md` (3D dvigatel),
`audit-move.md` (shkaf siljitish), `audit-screen.md` (ekran tuzilishi).

Muhim: iOS va Android ilovalar bu saytning o‘zi (Capacitor qobig‘i). Saytda tuzatilgan narsa
ikkala ilovada ham darhol tuzaladi. Alohida «native» kod kerak emas.

---

## 1. Xulosa: nega ko‘ngil to‘lmayapti

Konstruktor «ishlaydi», lekin uchta narsa noto‘g‘ri qurilgan. Ular mayda tuzatish bilan tuzalmaydi.

1. **Shkaf «xohlagan joyga» bormaydi, chunki model shunday.** Har devor zich qator: shkaflar orasida
   bo‘sh joy bo‘lishi mumkin emas, bo‘sh joyni dastur o‘zi avtomatik shkaf bilan to‘ldiradi. Bitta
   shkafni surganda qo‘shnilar o‘zgaradi, yo‘qoladi, paydo bo‘ladi. Yuqori shkaflarni umuman surib
   bo‘lmaydi. Devor to‘la bo‘lsa «Не помещается» chiqadi va shkaf joyida qoladi (brauzerda tekshirildi).
2. **Barmoq bilan boshqarish chalkash.** Bir barmoq gohida aylantiradi, gohida suradi — bu tanlangan/
   tanlanmagan holatga va barmoqni qancha ushlab turganga bog‘liq. Shkaf barmoq ostida sakraydi
   (ushlagan nuqta hisobga olinmaydi). Ikki barmoq bilan kattalashtirish buziladi. «Bir joyini tuzasam,
   boshqa joyi buziladi» — aynan shu yerdan.
3. **Telefonda 3D oyna juda kichkina, sahifa esa juda uzun.** 3D rasm ~220 px (ekranning chorak qismi).
   Sahifa 5924 px, bu 7 ekran: mijoz uchun konstruktor, tayyor oshxonalar, tekshiruv, ustaga chizmalar,
   5 varaq raskroy xaritasi, usta narxlari, «mening variantlarim» — hammasi bitta sahifada.
   Asosiy tugmalar («Дальше», «Всё в корзину») sahifa oxirida, yopishib turmaydi.

Tezlik va tiniklik ham shu qatorda: telefon doim «Лёгкий» rejimda ochiladi (xira, teksturalar
4 barobar kichik), lekin ayni paytda telefon uchun og‘ir narsalar o‘chirilmagan (soyalar har kadrda
qayta chiziladi, kunduzi ham 4–6 ta «kechki» chiroq shaderda hisoblanadi, har shkaf 10–25 ta alohida
chizish buyrug‘i, har o‘zgarishda butun oshxona qaytadan quriladi).

---

## 2. Nima kam (mijozga kerak, lekin yo‘q)

| # | Nima yo‘q | Nega muhim |
|---|---|---|
| K1 | Shkafni istalgan joyga qo‘yish, bo‘sh joy qoldirish, yuqori shkafni surish | Egasi va mijozning asosiy kutgani |
| K2 | Sudrashda haqiqiy shkaf barmoq orqasidan yurishi | Hozir faqat ko‘k quti ko‘rinadi, shkaf tushirganda «sakraydi» |
| K3 | Telefonda katta 3D (ekranning yarmi) | Hozir chorak qism |
| K4 | Pastda doim turadigan panel: jami narx · «Дальше» · savat | Hozir sahifa oxirida |
| K5 | Sifat avtomatik tanlanishi | Hozir mijoz «Лёгкий/HD/4K» so‘zlarini tushunishi kerak |
| K6 | Telefonda tiniq rasm (DPR 3 telefonlarda 1× chizilyapti, ya’ni 3 barobar cho‘zilgan) | «4K» degani shu |
| K7 | Bo‘sh joyga «qo‘shish» tugmasi (shkaf/texnika qo‘shish) | Hozir faqat avtomatik to‘ldirish |
| K8 | Bir barmoq — aylantirish, ushlab turib — surish: har doim bir xil qoida | Hozir holatga qarab o‘zgaradi |
| K9 | Mijoz va usta ekranlari alohida | Hozir aralash |

## 3. Nima ortiqcha (mijoz uchun)

| # | Ortiqcha | Qayerga |
|---|---|---|
| O1 | «Чёткость 3D: Лёгкий / HD / 4K» | O‘chirish, avtomatik |
| O2 | «Вечерний свет», «Размеры», «Цены» tugmalari | «Ещё» ichiga, narx yorliqlari telefonda o‘chiq |
| O3 | 4 ta ko‘rinish («С высоты глаз», «Спереди») | 2 ta qoldirish: 3D va Сверху |
| O4 | 21 stil × 3 ton, 2000 px ro‘yxat | 6–8 ta asosiy stil, qolgani «Все стили» |
| O5 | 306 rang (RAL 216 + dekor 36 + katalog), qidiruv | Mijozga 12–16 rang; RAL/dekor — usta bo‘limiga |
| O6 | 11 tutqich × 6 metall, 31 fartuk, 18 stoleshnitsa | Mijozga 5 / 8 / 6 |
| O7 | «Размер» qadamida 25 ta boshqaruv (slayder + input + ±) | Faqat input va ±; shift, oyna, penal — «Qo‘shimcha» |
| O8 | Tayyor oshxonalarda 3 qator filtr | Filtrsiz karusel, shakllardan tepada |
| O9 | 2 ta WhatsApp tugma, 5 ta «ulashish» yo‘li, 4 xil «qayta boshlash» | 1 / 2 / 1 |
| O10 | Telefonda «Фото» — ray-trace kutish, keyin oddiy rasm | Telefonda darhol rasm saqlash |
| O11 | Ustaga: chizmalar, spetsifikatsiya, raskroy 5 varaq, narx formasi (30 maydon), Excel | Alohida sahifa `/kitchen/master` yoki tugma orqali ochiladigan bo‘lim |
| O12 | «Коротко: что где стоит» matni, klaviatura maslahatlari | Usta bo‘limiga |

## 4. Nega qotadi va nega xira (qisqacha, dalil `audit-render.md`)

Qotish (oddiy telefon):
- Har o‘zgarishda butun oshxona qaytadan quriladi, hattoki texnika fotosi yuklanganda ham.
- Soyalar har kadrda qayta chiziladi, tutqichlar ham soya tashlaydi.
- Kunduzi ham 4–6 «kechki» chiroq shaderda hisoblanadi (faqat yorug‘ligi 0).
- Har shkaf 10–25 alohida chizish buyrug‘i, umumiy yuzlab; instancing yo‘q.
- Har imo-ishorada canvas qayta yaratiladi (setPixelRatio + setSize).
- Barcha materiallar «Physical» (clearcoat, sheen) — telefonda ham.
- Har uslub uchun eskiz 3D da qaytadan quriladi (21 marta), telefonda ham.
- «Фото» tugmasi telefonda path-tracer ni ishga tushiradi (15–60 s kompilyatsiya).

Xiralik (yaxshi telefon):
- Telefon doim «Лёгкий»: harakatda 1× (DPR 3 da 3 barobar cho‘zilgan), tinch holatda ko‘pi bilan 2×.
- «Лёгкий»da teksturalar 4 barobar kichik, bump yo‘q.
- «Governor» sifatni 0,6× gacha tushiradi va qaytarmaydi.
- Telefonda anti-aliasing/sharpen yo‘q.

To‘g‘ri yechim: jonli ko‘rinish va «4K foto» ni ajratish. Jonli ko‘rinish telefonda `min(dpr, 2)`
bilan chiziladi, lekin yengil materiallar, statik soya, chiroqlar o‘chiq. «4K» — faqat «Фото» tugmasi
uchun, alohida, sekin bo‘lsa ham chiroyli.

## 5. Tavsiya: nima qilish, qaysi tartibda

Prinsip: **mijozga — sodda ekran, ustaga — alohida ekran; 3D — ekranning yarmi; barmoq — bitta qoida.**

| Bosqich | Nima | Natija |
|---|---|---|
| 1. Siljitish | Ushlagan nuqta hisobga olinadi; haqiqiy shkaf barmoq orqasidan yuradi; bo‘sh joy qolishi mumkin (chiziqli «bo‘sh» ko‘rinadi, «+ shkaf» tugmasi); yuqori shkaf ham suriladi; boshqa devorga tashlash; sig‘masa qizil + «qo‘shnini toraytiraymi?» taklifi; bosish = tanlash, ushlab turish 500 ms = surish, aylantirish har doim bir barmoq bo‘sh joyda; pinch tuzatiladi | «Xohlagan joyga» ishlaydi |
| 2. Telefon ekrani | Sahifa sarlavhasi va qidiruv yashirin; 3D = 50 % ekran; pastda yopishgan panel (narx · Дальше · savat); tanlangan shkaf paneli kichik (3 qator), qolgani «Ещё»; qadamlar pastki panelda; klaviatura ochilganda 3D kichrayadi | Bir qo‘lda ishlaydi |
| 3. Tezlik + tiniklik | Sifat avtomatik: `min(dpr,2)` + yengil materiallar + statik soya + kunduzi chiroqlar o‘chiq; canvas o‘lchami qayta yaratilmaydi; shkaf geometriyasi birlashtiriladi; o‘zgarish faqat o‘sha shkafni qayta quradi; «Фото» telefonda darhol rasm; 4K faqat fotoda | Oddiy telefonda silliq, yaxshisida tiniq |
| 4. Soddalashtirish | Mijoz/usta ajratiladi (`/kitchen` va `/kitchen/master`); tanlovlar O4–O9 bo‘yicha qisqartiriladi; bitta WhatsApp, bitta ulashish | 7 ekran o‘rniga 2 |

Dizayn o‘zgarmaydi: ranglar, shrift, burchaklar `DESIGN.md` bo‘yicha. Faqat tartib va miqdor o‘zgaradi.
Limon tugma — ekranda bittagina (hozir 5–6 ta).

Qilmaslik kerak: hozirgi kodga yana «kichik tuzatishlar» qo‘shish. 24.09 va 26.09 da shunday qilingan,
natija — «bir joyi tuzalsa, boshqasi buziladi».

## 6. Egasidan kerak bo‘lgan qaror

Bitta savol: **usta bo‘limini alohida sahifaga chiqaraylikmi** (`/kitchen/master`, mijoz uni
«Ustaga» tugmasi orqali ochadi)? Tavsiya: ha. Aks holda telefon sahifasi baribir uzun qoladi.
