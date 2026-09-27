# Android da push-xabar — Firebase ga yo'riqnoma

Yangilandi: 27.09.2026, MacBook da. Shoxa (branch) `claude/push-apns-fcm`.

## 1. Bu nima

Android telefondagi mijoz ham iPhone dagidek ikki xabar oladi: «Заказ оплачен» va «Заказ готов».
Android ga xabarni Google yetkazadi. Xizmat nomi — **Firebase Cloud Messaging** (qisqasi FCM).

Ilova, sayt va server tomoni **tayyor**. Faqat ikki fayl yetishmaydi — ularni faqat siz,
o'z Google akkauntingizda olasiz:

| Fayl | Nima u | Maxfiymi |
|---|---|---|
| `google-services.json` | Ilovaning Firebase dagi «pasporti». Android loyihasiga qo'yiladi | **Yo'q** — u baribir har bir Google Play faylining ichida bo'ladi |
| `…firebase-adminsdk….json` (server kaliti) | Server shu kalit bilan Google ga «xabarni men yuboryapman» deydi | **Ha** — parol kabi |

Fayllar qo'yilmaguncha Android ilova **hozirgidek** ishlaydi: xabar tugmasi ko'rinmaydi, hech narsa buzilmaydi.

## 2. Narxi

**Bepul.** FCM ning bepul rejasi (Spark) bor, bank kartasi so'ralmaydi.
Firebase «Upgrade» yoki «Blaze» ni taklif qilsa — bosmang, bizga kerak emas.

## 3. Firebase loyihasi va Android ilova (10 daqiqa)

Manzil: `https://console.firebase.google.com` — Google akkauntingiz bilan kiring
(Play Console dagi Gmail bo'lsa yaxshi, lekin shart emas).

1. **Create a project** («Создать проект»). Nomi: `smarket` (boshqa nom ham bo'ladi).
2. Gemini yoki Google Analytics taklif qilinsa — **o'chiring**, bizga kerak emas. **Create project**.
3. Loyiha ochilgach: **Add app** («Добавить приложение») → **Android** belgisi (yashil robot).
4. **Android package name** — aynan shunday, harfma-harf: `kg.smarket.app`
   - App nickname: `S Маркет`
   - Debug signing certificate SHA-1 — **bo'sh qoldiring**.
   - **Register app**.
5. **Download google-services.json** — fayl «Загрузки» (Downloads) papkasiga tushadi.
6. Keyingi ikki qadam (SDK qo'shish) — biz qilganmiz: **Next** → **Next** → **Continue to console**.

## 4. Server kaliti (5 daqiqa)

1. Chap tepada tishli g'ildirak ⚙ → **Project settings** («Настройки проекта»).
2. **Service accounts** («Сервисные аккаунты») yorlig'i.
3. «Firebase Admin SDK» tanlangan holda → **Generate new private key** («Создать закрытый ключ») → **Generate key**.
4. Fayl «Загрузки» ga tushadi. Nomi taxminan: `smarket-ab12c-firebase-adminsdk-xy9z-1a2b3c4d5e.json`.

⚠ Bu fayl — **parol kabi**. Hech kimga yubormang, chatga, Telegram ga tashlamang.
Uni serverga keyingi qadamdagi buyruq o'zi yuboradi — ekranga chiqarmasdan.

## 5. Bitta buyruq — ikkala faylni joyiga qo'yish

**Mac da** — Terminal ni oching va yozing:

```bash
cd ~/Online-magazin
bash scripts/setup-fcm.sh
```

**Windows da** — PowerShell da, loyiha papkasida:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\setup-fcm.ps1
```

Skript nima qiladi:

1. Ikkala faylni «Загрузки» dan o'zi topadi va so'raydi: «Использовать его?» — **Enter** bosing.
   Topmasa — faylni sichqoncha bilan Terminal oynasiga olib kelib tashlang (sudrab) va Enter bosing.
2. Tekshiradi: ilova nomi `kg.smarket.app` mi, kalit haqiqiy server kalitimi,
   ikkala fayl bitta Firebase loyihasidanmi.
3. Kalitni serverga yuboradi. **Server paroli** so'raladi (ssh so'raydi, skript parolni ko'rmaydi).
   Server kalitni yana bir bor tekshiradi, eski sozlamalar faylining nusxasini saqlaydi
   (`.env.production.bak_…`) va kalitni yozadi.
4. Faqat shundan keyin `google-services.json` ni `android/app/` ga qo'yadi.

Oxirida «Готово» chiqsa — hammasi joyida. Xato bo'lsa — skript sababini bir qatorda yozadi
va **hech narsa yozilmaydi**. Nima qilish kerakligi — 8-bo'limda.

Faqat tekshirib ko'rmoqchi bo'lsangiz (serverga hech narsa yubormaydi, hech narsa ko'chirmaydi):

```bash
bash scripts/setup-fcm.sh --check
```

`google-services.json` ni git ga saqlash kerak (u maxfiy emas). Claude ga «готово» deb yozing —
u saqlaydi. Yoki o'zingiz:

```bash
git add android/app/google-services.json && git commit -m "android: google-services.json"
```

Server kaliti fayli endi «Загрузки» da kerak emas — uni o'chirib qo'yishingiz mumkin.
Kerak bo'lsa Firebase yangisini istalgan payt beradi.

## 6. Keyin: uchta buyruq

Hammasi loyiha papkasida (`cd ~/Online-magazin`), shu o'zgarishlar kiritilgan
(birlashtirilgan) holatda. Ishonchingiz komil bo'lmasa — Claude ga «Firebase fayllari tayyor»
deb yozing, qolganini u tayyorlab beradi.

### 6.1. Server

Uchta buyruq, ketma-ket. Har birida server paroli so'raladi:

```bash
ssh root@145.223.100.16 "rm -rf /tmp/sb_shop"
scp -r integrations/sbonus-server/shop root@145.223.100.16:/tmp/sb_shop
ssh root@145.223.100.16 "bash /tmp/sb_shop/deploy_shop.sh"
```

Oxirgisi serverni yangilaydi va qayta ishga tushiradi — yangi kalit shunda ishga tushadi.

### 6.2. Sayt

```bash
bash scripts/update-all.sh --only-site
```

### 6.3. Android — yangi fayl Google Play uchun

`versionCode` allaqachon **4** qilingan — qo'lda o'zgartirmang.
Buyruqlar `ANDROID_PLAY_UZ.md` ning 5-bo'limidagi bilan bir xil. Avval yig'ish:

```bash
cd ~/Online-magazin && npx cap sync android && cd android && JAVA_HOME=/opt/homebrew/opt/openjdk@21 ./gradlew bundleRelease
```

Keyin nusxa qilish:

```bash
cd ~/Online-magazin
CODE=$(sed -nE 's/^[[:space:]]*versionCode[[:space:]=]+([0-9]+).*/\1/p' android/app/build.gradle)
AAB=android/app/build/outputs/bundle/release/app-release.aab
F="build-play/smarket-1.0-code$CODE.aab"
if [ -z "$CODE" ]; then echo "XATO: build.gradle da versionCode topilmadi"
elif [ -e "$F" ]; then echo "TO'XTADI: $F allaqachon bor — versionCode oshirilmagan"
elif [ android/app/build.gradle -nt "$AAB" ]; then echo "TO'XTADI: $AAB eski — yig'ish xato bilan tugagan, yuqoridagi buyruqni qayta ishga tushiring"
else cp "$AAB" "$F" && echo "Tayyor: $F"
fi
```

«Tayyor: build-play/smarket-1.0-code4.aab» chiqsa — shu faylni Play Console ga yuklang
(`ANDROID_PLAY_UZ.md`, 3.8-bo'lim). Release notes (ru-RU), masalan:

```
Уведомления о заказах: «Заказ оплачен» и «Заказ готов».
```

«TO'XTADI: … allaqachon bor» chiqsa — `code4` fayli Firebase siz oldinroq yig'ilgan.
O'zingiz hech narsani o'chirmang, Claude ga yozing.

Bu Mac da `.aab` ni Claude ham yig'a oladi (imzo kaliti shu yerda). Serverni, saytni
yangilash va Google Play ga yuklash — sizning «ha» ingizdan keyin.

**Play Console da yana bir joy:** App content → **Data safety** → ma'lumot turlariga
**Device or other IDs** qo'shing: Collected — Yes, Shared — No, Purpose — **App functionality**.
Xabar yuborish uchun telefonning Google bergan «manzili» saqlanadi — Google shuni so'raydi.

## 7. Tekshirish

1. Android telefonga yangi versiyani Play dan o'rnating (yopiq yoki ichki sinov orqali).
2. Ilova → «Кабинет» → telefon raqami bilan kiring.
3. Android 13 va yangisida «Разрешить отправку уведомлений?» oynasi chiqadi → **Разрешить**.
   Rad etilgan bo'lsa — «Кабинет» da yo'l yoziladi: Настройки → Приложения → S Маркет → Уведомления.
4. Buyurtma bering va to'lang → telefonga «Заказ оплачен» keladi.
   Xabar ilova ochiq turganda ham chiqadi, belgisi — oq «S».
5. Telefon sozlamalarida: Ilovalar → S Маркет → Уведомления → **«Заказы»** kanali ko'rinadi.

Sinov xabarini Claude ham yubora oladi — telefon raqamingizni ayting.

## 8. Skript xabarlari — nima qilish kerak

Har bir xatoda skript «Ничего не записано» deydi: hech narsa o'zgarmagan, qayta urinish xavfsiz.

| Skript yozdi | Sababi | Nima qilish kerak |
|---|---|---|
| «Файл не найден: …» | Yo'l noto'g'ri | Faylni qaytadan Terminal ga sudrab tashlang |
| «… не читается как JSON — это не google-services.json» | Fayl buzilgan yoki boshqa fayl | 3-bo'lim, 5-qadam: `google-services.json` ni qayta yuklab oling |
| «… не похож на google-services.json» | Boshqa JSON fayl berilgan | Xuddi shu: Project settings → Your apps → Android → `google-services.json` |
| «В google-services.json нет приложения kg.smarket.app (в файле: …)» | Android ilova boshqa nom bilan qo'shilgan | 3-bo'lim, 3–5 qadam: `kg.smarket.app` nomi bilan yangi Android ilova qo'shing va faylni qayta oling |
| «Файлы перепутаны: …» | Ikki fayl o'rni almashgan | Enter bosishdan oldin nomiga qarang: birinchi — `google-services.json`, ikkinchi — `…firebase-adminsdk….json` |
| «Ключ … не читается как JSON» | Kalit fayli buzilgan | 4-bo'lim: yangi kalit yarating |
| «Это не ключ сервисного аккаунта Firebase» | Boshqa fayl berilgan | 4-bo'lim: aynan **Service accounts → Generate new private key** |
| «В ключе нет поля …» | Fayl to'liq emas | 4-bo'lim: yangi kalit yarating |
| «Файлы из разных проектов Firebase: …» | Fayllar ikki xil loyihadan | Ikkalasini ham bitta loyihada oling (chap tepada loyiha nomiga qarang) |
| «Не удалось подключиться к серверу» / «Сервер не ответил» | Internet yo'q yoki parol noto'g'ri | Internetni tekshiring, qayta ishga tushiring |
| «На сервере нет /opt/sbonus/.env.production» | Server hali o'rnatilmagan | Claude ga yozing — avval `deploy_shop.sh` kerak |
| «Сервер не смог прочитать ключ» | Fayl yo'lda buzildi | Skriptni qayta ishga tushiring |
| «Сервер говорит: это не ключ сервисного аккаунта» | Server kalitni qabul qilmadi | 4-bo'lim: yangi kalit yarating |
| «На сервере нет python3» yoki «…резервную копию…» | Server muammosi | Claude ga yozing |
| «Не найден python3» (Mac da) | Mac da dasturchi vositalari yo'q | `xcode-select --install`, keyin qayta |

Hammasi to'g'ri bo'lsa-yu, xabar kelmasa: Firebase → Project settings → **Cloud Messaging** →
«Firebase Cloud Messaging API (V1)» — **Enabled** bo'lishi kerak (yangi loyihada o'zi yoqilgan).
Bo'lmasa — Claude ga yozing.

## 9. Kalit begona qo'lga tushsa

Firebase → Project settings → Service accounts → **Manage service account permissions** →
kalitni o'chiring (Keys → 🗑). Keyin 4-bo'lim bilan yangi kalit oling va
`bash scripts/setup-fcm.sh` ni qayta ishga tushiring. Skript eski kalitni serverda almashtiradi.
