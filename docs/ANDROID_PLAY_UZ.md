# Android ilova — Google Play ga yo'riqnoma

Yangilandi: 24.09.2026, MacBook da. Shoxa (branch) `feature/ios-app`.

## 1. Hozirgi holat

| Nima | Holat |
|---|---|
| Ilova fayli (AAB — Google Play qabul qiladigan fayl) | **Tayyor**: `build-play/smarket-1.0-code2.aab` |
| Imzo kaliti (ilovani sizniki deb tasdiqlaydigan fayl) | Bor: `~/smarket-keys/smarket-upload.jks`. Nusxasi fleshkada bo'lishi **shart** |
| Ikonka 512×512 | `app-icons/store/google-play-512.png` |
| Katta rasm 1024×500 (Feature graphic) | `build-play/listing/feature-graphic-1024x500.png` |
| Telefon rasmlari, 6 ta | `build-play/listing/phone-01.png` … `phone-06.png` |
| Maxfiylik sahifasi | Android va chat qo'shildi (`src/data/privacy.ts`). **Saytga chiqarish kerak** |
| Haqiqiy Android telefonda sinov | **Qilinmagan**. MacBook da Android emulyator (kompyuterdagi soxta telefon) yo'q |

`build-play/` git ga tushmaydi. Rasmlar va AAB faqat shu MacBook da.

Ilova ichida — jonli sayt `https://smarket.kg`. Saytdagi o'zgarish ilovada
darrov ko'rinadi, Google ga qayta yuborish shart emas. Qayta yuborish faqat
Android qismi (`android/`) o'zgarganda kerak.

## 2. Eng muhim ogohlantirish: 12 sinovchi × 14 kun

Google Play akkaunti **shaxsiy** (personal) bo'lsa va 2023-yil noyabridan
keyin ochilgan bo'lsa, Google ilovani darrov hammaga chiqarishga ruxsat
bermaydi. Men bilgan qoida shunday (raqamlar o'zgargan bo'lishi mumkin —
Play Console Dashboard da aniq talab yozilgan bo'ladi). Oldin:

1. **Yopiq sinov** (Closed testing) ochiladi.
2. Unga kamida **12 kishi** qo'shiladi (ularning Gmail manzili kerak).
3. Ular **14 kun ketma-ket** sinovda turadi (ilova telefonida o'rnatilgan).
4. Shundan keyingina «Production» (hamma uchun) so'raladi.

Akkaunt **tashkilot** (organization) bo'lsa, bu talab yo'q.

Qaysi biri ekanini Play Console da ko'rish mumkin: **Settings → Developer account → About you**.
Shaxsiy bo'lsa — hozirdan 12 ta tanish-bilish, xodim, doimiy mijozning Gmail
manzilini yig'ing. Bu eng uzoq bosqich.

## 3. Play Console da qadamlar (tartib bilan)

Manzil: `https://play.google.com/console`

### 3.1. Ilova yaratish

**Create app** tugmasi:

- App name: `S Маркет — Смарт Центр`
- Default language: `Russian – ru-RU`
- App or game: **App**
- Free or paid: **Free**
- Ikkala «Declarations» belgisini qo'ying.

### 3.2. Ilova haqida savollar (Dashboard → «Set up your app»)

| Bo'lim | Javob |
|---|---|
| Privacy policy | `https://smarket.kg/ru/privacy` |
| App access | «All or some functionality is restricted» → pastdagi 3.3 ga qarang |
| Ads | **No**, reklama yo'q |
| Content rating | Pastdagi 3.4 |
| Target audience | **18 and over**. Bolalar uchun emas — shunda qo'shimcha tekshiruv bo'lmaydi |
| News app | **No** |
| Data safety | Pastdagi 3.5 |
| Government app | **No** |
| Financial features | **My app doesn't provide any financial features**. O!Деньги orqali tovar uchun to'lov bu yerga kirmaydi |
| Health | **No** |
| Account deletion | Pastdagi 3.6 |

### 3.3. App access — Google tekshiruvchisi qanday kiradi

Kirish — telefon raqami va Telegram/WhatsApp kodi. Google xodimi kodni ololmaydi.
Apple uchun sayt kodida maxsus sinov raqami bor: u sayt sozlamalaridagi
`SITE_DEMO_PHONE` va `SITE_DEMO_CODE` bilan yoqiladi. Serverda ular
yozilganmi — bilmayman. Apple ga bergan raqam va kodni Google ga ham bering.
Yozilmagan bo'lsa ham qo'rqinchli emas: katalog, savat va buyurtma kirishsiz
ishlaydi, tekshiruvchi faqat bonus qismini ko'rmaydi.

Play Console da **Add instructions**:

- Name: `Demo account`
- Username / phone: sinov raqami — **o'zingiz yozasiz**
- Password: sinov kodi — **o'zingiz yozasiz**
- Other information:

```
Catalog, cart and ordering work without login. Login is only needed for SBonus+ bonuses.
To log in: open "Кабинет" (bottom right), enter the phone number above, then enter the code above.
Payment goes through O!Dengi (Kyrgyzstan) for physical goods — no need to pay during review.
```

Raqam va kodni men yozmayman — bu sizning maxfiy ma'lumotingiz.

### 3.4. Content rating (yosh reytingi)

- Email: sizning Gmail
- Category: **All other app types**
- Zo'ravonlik, qo'rqinchli narsa, jinsiy, so'kinish, giyohvand, qimor — hammasiga **No**.
- «Users can interact or exchange content»: **No** (chat — robot bilan, odamlar bir-biri bilan yozishmaydi).
- «Shares user's current physical location»: **No**.
- «Allows users to purchase digital goods»: **No** (faqat haqiqiy tovar).

Natija odatda: 3+ / Everyone.

### 3.5. Data safety (qanday ma'lumot yig'iladi)

Umumiy savollar:

- Collect or share user data: **Yes**
- Encrypted in transit: **Yes** (hammasi HTTPS orqali)
- Users can request deletion: **Yes**

Ma'lumot turlari. Hammasida: **Collected — Yes, Shared — No**
(SBonus, 1С, O!Деньги, Telegram, Gemini — biz uchun ishlaydigan xizmatlar,
Google qoidasida bu «Shared» hisoblanmaydi).

| Tur | Nega (Purpose) | Majburiymi |
|---|---|---|
| Personal info → **Name** | App functionality, Account management | Optional (buyurtmada so'raladi) |
| Personal info → **Phone number** | App functionality, Account management | Optional |
| Personal info → **Address** | App functionality (yetkazish) | Optional |
| Financial info → **Purchase history** | App functionality | Optional |
| Messages → **Other in-app messages** (chatdagi savollar) | App functionality, Analytics | Optional |
| Photos and videos → **Photos** (chatga yuborilgan rasm) | App functionality | Optional |
| App activity → **App interactions** (sahifalar hisoblagichi) | Analytics | — |

**Yig'ilmaydi**: joylashuv, kontaktlar, karta ma'lumoti, qurilma ID si,
mikrofon. Android da push-xabar yo'q.

### 3.6. Account deletion (hisobni o'chirish)

- Ilovada o'chirish bormi: **Yes** — «Кабинет» → «Удалить учётную запись».
- Veb-manzil: `https://smarket.kg/ru/privacy` (6-bo'limda yo'l yozilgan).

### 3.7. Do'kon sahifasi (Main store listing)

- App name: `S Маркет — Смарт Центр`
- Short description, full description: pastdagi 4-bo'limdan nusxa oling.
- App icon: `app-icons/store/google-play-512.png`
- Feature graphic: `build-play/listing/feature-graphic-1024x500.png`
- Phone screenshots: `build-play/listing/phone-01.png` … `phone-06.png`
- Category: **Shopping**
- Email: sizning Gmail (hammaga ko'rinadi)
- Phone: do'kon raqami
- Website: `https://smarket.kg`

Qirg'iz tilini qo'shish: **Store listing → Manage translations → Add your own translations → Kyrgyz**.

### 3.8. AAB faylini yuklash

1. **Testing → Closed testing** (shaxsiy akkaunt) yoki **Internal testing** (birinchi o'zingiz sinash uchun).
2. **Create new release**.
3. «Play App Signing» taklif qilinsa — **rozi bo'ling**. Google o'z kalitini
   saqlaydi, bizning kalit faqat yuklash uchun.
4. Fayl: `build-play/smarket-1.0-code2.aab`
5. Release notes (ru-RU):

```
Первая версия приложения магазина Смарт Центр.
```

## 4. Do'kon matnlari (nusxa olish uchun)

### Rus tili (ru-RU)

Short description (80 belgigacha):

```
Техника и электроника Смарт Центр: доставка по Кыргызстану и бонусы SBonus+
```

Full description:

```
S Маркет — приложение магазина электроники и бытовой техники «Смарт Центр» (Smart Centr). Магазин работает с 2011 года в Араванском районе Ошской области и доставляет технику по всему Кыргызстану.

Что можно сделать в приложении:

• Смотреть каталог: холодильники, стиральные машины, телевизоры, кухонная и мелкая техника, климат, уборка. Цены и наличие приходят прямо из учётной системы магазина.
• Оформить заказ без регистрации и оплатить онлайн через O!Деньги — из приложения почти любого банка Кыргызстана. Или забрать товар в магазине.
• Копить и тратить бонусы SBonus+. Счёт один — в магазине и в приложении. Бонусами можно оплатить часть заказа.
• Показать бонусную карту на кассе. QR-код открывается даже без интернета.
• Смотреть каталог без интернета — последний загруженный список товаров хранится в телефоне.
• Входить по отпечатку пальца вместо кода.
• Спросить онлайн-консультанта. Он отвечает по каталогу магазина на русском, кыргызском и узбекском. Цену и наличие подтверждает сотрудник.
• Собрать кухню в 3D-конструкторе и поставить в неё настоящую технику из наличия.

Гарантия. На всю технику действует официальная гарантия производителя. Гарантийный талон и чек выдаём вместе с товаром.

Рассрочка оформляется в магазине для клиентов SBonus+.

Вход по номеру телефона нужен только для бонусов. Приложение на русском и кыргызском языках.
```

### Qirg'iz tili (ky-KG)

⚠ Qirg'iz tilini biluvchi odamga bir o'qitib chiqing — men yozdim, xato bo'lishi mumkin.

Short description:

```
Смарт Центр техникасы: Кыргызстан боюнча жеткирүү жана SBonus+ бонустары
```

Full description:

```
S Маркет — «Смарт Центр» (Smart Centr) электроника жана тиричилик техникасы дүкөнүнүн тиркемеси. Дүкөн 2011-жылдан бери Ош облусунун Араван районунда иштейт жана техниканы бүт Кыргызстан боюнча жеткирет.

Тиркемеде эмне кылса болот:

• Каталогду кароо: муздаткычтар, кир жуугуч машиналар, телевизорлор, ашкана жана майда техника, климат, тазалоо. Баалар жана бар-жогу дүкөндүн эсепке алуу системасынан түз келет.
• Каттоосуз буйрутма берүү жана O!Деньги аркылуу онлайн төлөө — Кыргызстандагы дээрлик бардык банктын тиркемесинен. Же товарды дүкөндөн алып кетүү.
• SBonus+ бонустарын топтоо жана коротуу. Эсеп бирөө — дүкөндө да, тиркемеде да. Бонустар менен буйрутманын бир бөлүгүн төлөсө болот.
• Бонус картаны кассада көрсөтүү. QR-код интернетсиз да ачылат.
• Каталогду интернетсиз кароо — акыркы жүктөлгөн товарлар тизмеси телефондо сакталат.
• Код күтпөй, манжа изи менен кирүү.
• Онлайн-консультанттан суроо. Ал дүкөндүн каталогу боюнча орусча, кыргызча жана өзбекче жооп берет. Бааны жана бар-жогун кызматкер тастыктайт.
• 3D-конструктордо ашкана куруп, ага дүкөндө бар чыныгы техниканы коюу.

Кепилдик. Бардык техникага өндүрүүчүнүн расмий кепилдиги бар. Кепилдик талонун жана чекти товар менен кошо беребиз.

Бөлүп төлөө дүкөндө, SBonus+ кардарлары үчүн тариздейт.

Телефон номери менен кирүү бонустар үчүн гана керек. Тиркеме орус жана кыргыз тилдеринде.
```

## 5. Keyingi versiyani yig'ish

Faqat `android/` papkasida nimadir o'zgarsa kerak. Avval
`android/app/build.gradle` da `versionCode` ni 1 ga oshiring (hozir 2).
Keyin:

```bash
cd ~/Online-magazin && npx cap sync android && cd android && JAVA_HOME=/opt/homebrew/opt/openjdk@21 ./gradlew bundleRelease
```

Tayyor fayl: `android/app/build/outputs/bundle/release/app-release.aab`.

Rasmlarni qayta chizish skriptlari git da yo'q — kerak bo'lsa Claude qayta yasaydi
(sayt telefon o'lchamida suratga olinadi, ustiga sarlavha qo'yiladi).
