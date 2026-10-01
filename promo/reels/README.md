# smarket.kg — Instagram uchun videolar (SVG animatsiya)

Кадр 1080×1920 (Reels / Stories), ҳар бир видео — битта SVG. Ҳамма нарса сайтдан: логотип, ранглар (`#eaf500`, `#263244`), Manrope шрифти, ҳақиқий товарлар, нархлар ва матнлар. Брендга кўра — фақат оқ-лимон ранг, катта қора фон йўқ.

| Видео | Файллар | Натижа |
|---|---|---|
| «Как заказать» — 30 с: варақлаш → иккиланиш → «Спросить» → буюртма | `order.anim.js`, `order.timeline.mjs` | `out/smarket-30s.mp4` |
| «Запомните один адрес» — 20 с: 5 ҳаётий вазият + 3D ошхона, жавоб доим smarket.kg | `address.anim.js`, `address.timeline.mjs` | `out/smarket-adres-20s.mp4` |
| «Угадайте цену» — 24 с, телеўйин: 3 товар, A/B/C, таймер «3-2-1», тўғри жавоб | `quiz.anim.js`, `quiz.timeline.mjs` | `out/smarket-ugadai-cenu-24s.mp4` |

Умумий қисмлар: `lib.js` (ранглар, белги, матн, ҳаракат), `audio.mjs` (мусиқа ва эффектлар), `render.mjs`.

## Буйруқлар

```bash
npm install
VIDEO=address npm run render
VIDEO=order npm run render
VIDEO=quiz npm run render
```

Ҳар бир видео учун: `out/<ном>.mp4` (овоз билан), `out/<ном>-silent.mp4` (Instagram мусиқаси учун), `out/<ном>-cover.png` (муқова).

Кўриш: `node serve.mjs` → http://127.0.0.1:4815/?v=address (ёки `?v=order`, `?v=quiz`; `&t=12` — шу сонияда тўхтайди).

Товар расмини фондан қирқиш: `node cutout.mjs <номи>:<чегара>` (масалан `lg-tv:20`; кулранг фон учун `40`).

Иловалар: `IOS_LIVE` / `ANDROID_LIVE` — ҳар бир видеонинг `*.timeline.mjs` файлида.
