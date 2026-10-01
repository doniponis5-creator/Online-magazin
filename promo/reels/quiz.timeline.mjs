// «Угадайте цену» — 24 секунды, формат телеигры. Три товара с сайта, три варианта, таймер,
// правильный ответ и звуковой знак smarket.kg. Цены — с smarket.kg на 01.10.2026.
// Сетка — 120 BPM: доля = 0.5 с.

export const DURATION = 24;
export const FPS = 30;
export const BPM = 120;
export const OUT_NAME = 'smarket-ugadai-cenu-24s';

// Владелец (01.10.2026): писать, что приложение есть в App Store и Google Play.
export const IOS_LIVE = true;
export const ANDROID_LIVE = true;

export const ROUNDS = [
  {
    t: 2.5, img: 'midea-kettle', h: 430, name: 'Чайник MIDEA MK-SH17M301',
    options: [1850, 3900, 6500], answer: 0,
  },
  {
    t: 8.0, img: 'flagman', h: 470, name: 'Стиральная машина FLAGMAN 8 кг',
    options: [34900, 28500, 21400], answer: 2, old: 28500, off: 25,
  },
  {
    t: 13.5, img: 'lg-tv', w: 640, name: 'Телевизор LG 65NANO81',
    options: [89900, 72000, 109000], answer: 1,
  },
];
// Внутри раунда (от его начала).
export const R = { land: 0.55, name: 0.6, options: 1.0, timer: 1.5, timerLen: 2.5, reveal: 4.05, out: 5.35 };
export const T = { intro: 0, cta: 1.2, end: 19.0, endQ: 19.0, endPill: 20.0, endChips: 20.6, endApps: 21.0 };
export const PULSES = [...ROUNDS.map(r => r.t + R.reveal), T.endPill + 0.35];

export const MUSIC = { start: 0.5, calm: ROUNDS.map(r => [r.t + R.timer, r.t + R.reveal]), end: T.end + 1.0 };
export const WARMUP = [3.5, 7.0, 9.0, 12.5, 14.5, 18.0, 21.5];

export function cues() {
  const c = [];
  const add = (t, type, opt = {}) => c.push({ t, type, ...opt });
  add(0.0, 'impact', { amp: 0.8 });
  add(0.05, 'sparkle', { dur: 0.9, amp: 0.35 });
  add(T.cta, 'pop', { amp: 0.4, semis: 5 });
  ROUNDS.forEach(r => {
    add(r.t - 0.1, 'whoosh', { dur: 0.45, from: 500, to: 4000, amp: 0.4 });
    add(r.t + R.land, 'thud', { amp: 0.6 });
    add(r.t + R.name, 'pop', { amp: 0.3, semis: 2 });
    [0, 0.12, 0.24].forEach((d, i) => add(r.t + R.options + d, 'pop', { amp: 0.35, semis: 4 + i * 3 }));
    for (let i = 0; i < 3; i++) add(r.t + R.timer + i * (R.timerLen / 3), 'tock', { amp: 0.55, hi: i === 2 });
    add(r.t + R.timer, 'drumroll', { dur: R.timerLen, amp: 0.3 });
    add(r.t + R.reveal, 'logo', { amp: 0.6 });
    add(r.t + R.reveal, 'buzz', { amp: 0.25 });
    add(r.t + R.reveal + 0.05, 'sparkle', { dur: 0.8, amp: 0.35 });
    if (r.old) add(r.t + R.reveal + 0.35, 'zip', { dur: 0.3, amp: 0.3 });
  });
  add(T.end - 0.1, 'whoosh', { dur: 0.5, from: 300, to: 4500, amp: 0.45 });
  add(T.endPill + 0.35, 'impact', { amp: 0.7 });
  add(T.endPill + 0.35, 'logo', { amp: 0.75 });
  [0, 0.12].forEach((d, i) => add(T.endChips + d, 'pop', { amp: 0.35, semis: 9 + i * 3 }));
  [0, 0.12].forEach((d, i) => add(T.endApps + d, 'pop', { amp: 0.4, semis: 12 + i * 2 }));
  return c.sort((a, b) => a.t - b.t);
}
