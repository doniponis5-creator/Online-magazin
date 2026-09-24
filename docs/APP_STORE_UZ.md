# App Store га топшириш — 8-қадам

Сана: 20.09.2026. Бу ҳужжат — топширишгача қолган ишларнинг рўйхати.

---

## Ҳозирги ҳолат

**Дастур тайёр.** Apple талаб қиладиган тўртта имконият ишлайди, улардан
каталог интернетсиз **ҳақиқий iPhone да** синалди.

**Жанговар йиғилиш текширилди 20.09.2026:** `.ipa` йиғилди, Apple
Distribution сертификати билан имзоланди, ичида `aps-environment =
production` ва `beta-reports-active = true`. Яъни имзо билан муаммо йўқ.

---

## ⚠ Топширишдан олдин шарт

### 1. Сайт ва сервер чиқарилсин

Демо-кириш ва «Удалить учётную запись» ҳозир фақат git да. Уларсиз Apple
рад этади. Серверни **PC** чиқаради.

### 2. Демо-кириш ёқилсин

```bash
bash scripts/setup-demo-login.sh
```

Скрипт рақам ва кодни сўрайди (код яширин киритилади), серверга ёзади ва
ўзи текширади. Ўша рақам ва код App Store Connect га ҳам ёзилади.

Илова App Store да чиққач, ўчириш:

```bash
bash scripts/setup-demo-login.sh --off
```

### 3. Apple калити жанговар режимга

Илова TestFlight дан push ни **production** орқали кутади. Сервер эса ҳозир
**sandbox** да. Иккаласи мос келмаса, хабар келмайди.

Шунинг учун: биринчи TestFlight йиғилиши қилинаётган пайтда PC серверда
`apns_production` ни 1 га ўтказади. Эрта ўтказилса — MacBook даги синов
йиғилишлари хабарсиз қолади.

---

## Сиздан керак — Apple сўрайдиган матнлар

Буларни ҳеч ким сиз учун ўйлаб топа олмайди: дўкон сизники.

| Нима | Чегара | Эслатма |
|---|---|---|
| **Илова номи** | 30 белги | Масалан «S Маркет» ёки «Smart Centr» |
| **Қисқа тавсиф** (subtitle) | 30 белги | Бир қатор: нима қиладиган илова |
| **Тўлиқ тавсиф** | 4000 белги | Нима сотилади, етказиб бериш, бонуслар |
| **Калит сўзлар** | 100 белги | Вергул билан: техника, бонус, Ош… |
| **Тоифа** | — | Shopping |
| **Ёш чегараси** | — | 4+ |
| **Қўллаб-қувватлаш манзили** | — | Сайт саҳифаси ёки pochta |
| **Email** | — | **Ҳали йўқ.** App Review Information да сўралади |

---

## «Маълумотлар ёрлиғи» — App Store Connect даги жавоблар

Apple «қандай маълумот йиғасиз» деб сўрайди. Ёлғон ёзиб бўлмайди: илова
текширилади. Мана тўғри жавоблар — кўчириб ёзасиз.

**Contact Info → Phone Number:** Ҳа.
- Мақсади: App Functionality (буюртма ва кириш).
- Шахсга боғланадими: **Ҳа**.
- Реклама учун кузатиш (tracking): **Йўқ**.

**Contact Info → Name:** Ҳа. Мақсади: App Functionality. Боғланади. Кузатиш йўқ.

**Contact Info → Physical Address:** Ҳа (етказиб бериш учун).
Мақсади: App Functionality. Боғланади. Кузатиш йўқ.

**Purchases → Purchase History:** Ҳа (буюртмалар ва бонуслар).
Мақсади: App Functionality. Боғланади. Кузатиш йўқ.

**Identifiers → User ID:** Ҳа (SBonus даги мижоз коди).
Мақсади: App Functionality. Боғланади. Кузатиш йўқ.

**Usage Data → Product Interaction:** Ҳа (саҳифа кўришлар санағи).
Мақсади: Analytics. Шахсга **боғланмайди**. Кузатиш йўқ.

**Ҳаммасига «Йўқ»:** жойлашув, контактлар, сурат ва видео, микрофон,
саломатлик, молия, қидирув тарихи, реклама идентификатори.

⚠ **Face ID биометрия эмас деб белгиланг.** Юз телефондан чиқмайди: илова
системадан фақат «ҳа/йўқ» жавобини олади. Apple нинг рўйхатида бу
«Sensitive Info» эмас.

**Махфийлик сиёсати манзили:** `https://smarket.kg/ru/privacy`

---

## Жанговар йиғилишни қандай қилиш

```bash
bash scripts/build-appstore.sh
```

Скрипт `.ipa` ни йиғади ва қаерда ётганини айтади. Юклаш — Xcode
Organizer орқали ёки Transporter дастури билан (Mac App Store дан бепул).

Юклашдан олдин App Store Connect да илова яратилган бўлиши керак:
appstoreconnect.apple.com → My Apps → «+» → New App.
Bundle ID: `kg.smarket.app`.

---

## Экран расмлари

Apple **6.9 дюймли** iPhone учун расм сўрайди (iPhone 17 Pro Max ўлчами).
Улар сайт серверга чиқарилгандан кейин тайёрланади — акс ҳолда расмларда
эски кўриниш қолади.

Керакли экранлар: бош саҳифа, каталог, товар карточкаси, бонус картаси
(QR), «Кабинет», каталог интернетсиз.

---

## Рад этилса

Қўрқмаслик керак: биринчи мартада рад этиш оддий ҳол. Apple сабабини
ёзади. Сабабни менга юборасиз — тузатиб, қайта топширамиз. Иккинчи
топшириш одатда тезроқ ўтади.

---

## 1-рад этиш: 4.2.3(i), 23.09.2026 (build 1.0 (3))

**Сабаби.** Текширувчи кириш экранида фақат иккита йўлни кўрди: «Войти через
WhatsApp» ва «Получить код в Telegram». Унинг телефонида иккаласи ҳам йўқ эди.
Apple: илова бошқа илова ўрнатмасдан ишлаши керак.

**Танланган йўл — пулсиз (24.09.2026, эга билан келишилди):** SMS қўшмаймиз,
Apple га тушунтирамиз — илова киришсиз тўлиқ ишлайди, кириш фақат бонуслар учун.
Apple яна қайтарса — SMS захира (SMSPRO, `smspro.nikita.kg`, 1 SMS = 1 сом).

**Нима ўзгарди (сайт, илова қайта йиғилмайди):**
- Иловада кириш формаси (рақам + код) энди **биринчи**, очиқ турибди;
  WhatsApp — ундан пастда, «или» дан кейин. Браузерда ҳаммаси аввалгидек.
- «Кабинет» да ёзув: «Вход нужен только для бонусов SBonus. Каталог,
  конструктор кухни, корзина и заказ работают без входа.» Фақат «Панели
  сайта» да киришсиз буюртма ёқиқ бўлса кўринади.
- Демо-рақам энди «код отправлен в Telegram» демайди: «Введите код для номера».
- Код: `src/components/CustomerLogin.tsx`, `src/components/AccountView.tsx`,
  `src/components/account.css`, `src/lib/customer/gateway.ts` (канал `demo`),
  `src/lib/i18n/dictionaries.ts`. Тест: `__tests__/demo-login.test.ts`.

**Сайт чиқарилди 24.09.2026** (бэкап `/opt/smartcentr-site-backups/20260924_115417`).
Симуляторда синалди: иловада форма биринчи, «или», кейин WhatsApp.
Қайта топшириш учун **build 1.0 (4)** тайёрланди — ичида фақат рақам ўзгарди,
кириш экрани жонли сайтдан келади.

**⚠ «Панели сайта» да киришсиз буюртмани (`guestCheckout`) ўчирманг**, илова
App Store да бўлса ҳам. Ўчса — киришсиз буюртма бўлмайди ва бу рад этишнинг
сабаби қайтади.

**Apple га жавоб — App Store Connect → App Review → хабарга жавоб:**

```text
Hello, and thank you for the review.

We would like to clarify how S Market works: the app does not require
WhatsApp, Telegram or any other app to be used.

1. No sign-in is needed to use the app. Without an account, anyone can:
   - browse and search the full catalog of our store;
   - open the saved catalog offline, without internet;
   - design a kitchen in the 3D kitchen planner, with real appliances
     from our store and live prices;
   - add products to the cart and place an order.

2. Sign-in is optional. It is used only for the SBonus loyalty program:
   the bonus balance, the bonus QR card for our store checkout (it works
   offline) and Face ID quick sign-in. The sign-in screen now says this
   directly: "Sign-in is needed only for SBonus bonuses. The catalog,
   kitchen planner, cart and ordering work without signing in."

3. To review the loyalty features, please use the demo account from
   App Review Information. No other app is needed:
   - open the "Кабинет" (Account) tab;
   - enter the demo phone number and tap "Получить код" (Get code);
   - enter the demo code and tap "Войти" (Sign in).
   For the demo number no message is sent anywhere: the code is entered
   directly in the app.

We have also changed the sign-in screen in the app: the phone number and
code form is now shown first, above the WhatsApp option.

Thank you!
```

**App Review Information → Notes** (қисқаси, ўша ерга):

```text
Sign-in is optional: catalog, offline catalog, 3D kitchen planner, cart and
ordering work without an account. Sign-in is only for SBonus loyalty (bonus
QR card, Face ID). Demo account: Account tab → enter the demo phone → "Получить
код" → enter the demo code → "Войти". No SMS, Telegram or WhatsApp needed.
```
