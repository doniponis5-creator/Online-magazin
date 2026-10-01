// Единый хронометраж ролика «Как заказать на smarket.kg»: по нему двигается картинка (anim.js)
// и звучат эффекты (audio.mjs). Сетка — 120 BPM: доля = 0.5 с.

export const DURATION = 30;
export const FPS = 30;
export const BPM = 120;
export const OUT_NAME = 'smarket-30s';
// Музыка: где убрать бочку (пауза-напряжение) и где финал.
export const MUSIC = { calm: [[7.0, 10.75]], end: 27.6 };
// Кадры, которые рендер показывает заранее, чтобы картинки успели загрузиться.
export const WARMUP = [3.0, 4.5, 6.0, 8.0, 16.0, 19.0, 20.3, 22.0, 26.8, 29.0];

// Где приложение уже есть. iOS вышел 27.09.2026 («S Маркет — Смарт Центр»),
// Google Play — ещё нет. Когда выйдет Android — поставить true и перерендерить.
export const IOS_LIVE = true;
export const ANDROID_LIVE = false;

export const T = {
  // Крючок: три слова на доли, потом они становятся шагами наверху.
  words: [0.0, 0.5, 1.0],
  wordSub: 1.5,
  toPhone: 2.1,

  // Шаг 1. Листает каталог и отмечает две машинки.
  swipes: [[3.15, 3.8], [4.25, 4.9]],
  tapA: 5.6,
  tapB: 6.4,

  // Шаг 2. Сомневается → «Спросить» → вопрос → ответ.
  scaleIn: 7.0,
  askFly: 9.9,
  tapAsk: 10.85,
  chatOpen: 11.0,
  type: [11.65, 13.35],
  tapSend: 13.6,
  dots: [13.95, 15.1],
  answer: 15.2,
  pick: 17.3,

  // Шаг 3. Корзина → оформление → оплачено.
  tapHit: 18.45,
  productIn: 18.6,
  tapAdd: 19.65,
  bar: 19.95,
  tapCheckout: 20.75,
  checkoutIn: 20.9,
  typeName: [21.55, 22.35],
  typePhone: [22.55, 23.45],
  tapDelivery: 23.85,
  typeAddr: [24.15, 24.85],
  scrollPay: [25.0, 25.5],
  tapPay: 25.75,
  success: 26.35,

  end: 27.6,
};

// Подписи сверху: когда появляются и что говорят.
export const CAPTIONS = [
  [2.55, 'Листайте каталог'],
  [7.15, 'Не знаете, какую взять?'],
  [9.95, 'Нажмите «Спросить»'],
  [11.5, 'Напишите вопрос'],
  [14.0, 'Консультант ответит сразу'],
  [18.3, 'Добавьте в корзину'],
  [20.8, 'Оформите заказ'],
  [26.3, 'Готово! Подтверждение придёт в WhatsApp'],
];
export const STEPS = [[2.55, 0], [7.15, 1], [18.3, 2], [27.6, 3]];

// Звуковые события из того же хронометража.
export function cues() {
  const c = [];
  const add = (t, type, opt = {}) => c.push({ t, type, ...opt });
  T.words.forEach((t, i) => add(t, 'impact', { amp: 0.75 - i * 0.1 }));
  add(T.wordSub, 'pop', { amp: 0.35, semis: 5 });
  add(T.toPhone, 'whoosh', { dur: 0.6, from: 400, to: 4000, amp: 0.45 });
  T.swipes.forEach(([a, b]) => add(a + 0.05, 'whoosh', { dur: b - a + 0.25, from: 1200, to: 3800, amp: 0.3 }));
  [T.tapA, T.tapB].forEach((t, i) => { add(t, 'click', { amp: 0.6 }); add(t + 0.12, 'pop', { amp: 0.45, semis: i * 4 }); });
  add(T.scaleIn + 0.35, 'thud', { amp: 0.5 });
  [7.9, 8.5, 9.1].forEach((t, i) => add(t, 'tick', { amp: 0.18, f: 900 + i * 120 }));
  add(T.askFly, 'whoosh', { dur: 0.6, from: 3000, to: 700, amp: 0.4 });
  add(T.askFly + 0.6, 'pop', { amp: 0.45, semis: 7 });
  add(T.tapAsk, 'click', { amp: 0.65 });
  add(T.chatOpen, 'whoosh', { dur: 0.45, from: 500, to: 3000, amp: 0.35 });
  for (let t = T.type[0]; t < T.type[1]; t += 0.075) add(t, 'key', { amp: 0.2 });
  add(T.tapSend, 'click', { amp: 0.6 });
  add(T.tapSend + 0.08, 'whoosh', { dur: 0.3, from: 1500, to: 5000, amp: 0.25 });
  add(T.answer, 'coin', { amp: 0.5, semis: 0 });
  add(T.pick, 'pop', { amp: 0.4, semis: 9 });
  add(T.tapHit, 'click', { amp: 0.6 });
  add(T.productIn, 'whoosh', { dur: 0.4, from: 700, to: 3500, amp: 0.3 });
  add(T.tapAdd, 'click', { amp: 0.6 });
  add(T.tapAdd + 0.1, 'coin', { amp: 0.5, semis: 4 });
  add(T.bar, 'whoosh', { dur: 0.35, from: 600, to: 2500, amp: 0.22 });
  add(T.tapCheckout, 'click', { amp: 0.6 });
  add(T.checkoutIn, 'whoosh', { dur: 0.4, from: 700, to: 3500, amp: 0.3 });
  for (const [a, b] of [T.typeName, T.typePhone, T.typeAddr]) for (let t = a; t < b; t += 0.07) add(t, 'key', { amp: 0.18 });
  add(T.tapDelivery, 'click', { amp: 0.55 });
  add(T.tapPay, 'click', { amp: 0.7 });
  add(T.success, 'success', { amp: 0.6 });
  add(26.9, 'riser', { dur: 0.7, amp: 0.35 });
  add(T.end, 'impact', { amp: 0.8 });
  return c.sort((a, b) => a.t - b.t);
}
