// «Запомните один адрес» — 20 секунд. Пять жизненных ситуаций и 3D-кухня, ответ всегда один: smarket.kg.
// Сетка — 120 BPM: доля = 0.5 с. Ситуация — 4 доли (2 с), кухня — 8 долей (4 с).

export const DURATION = 20;
export const FPS = 30;
export const BPM = 120;
export const OUT_NAME = 'smarket-adres-20s';

// Владелец (01.10.2026): писать, что приложение есть в App Store и Google Play.
export const IOS_LIVE = true;
export const ANDROID_LIVE = true;

export const T = {
  hello: 0.0, // «Запомните один адрес»
  slam: 0.5, // адресная строка падает в кадр
  home: 1.0, // строка уезжает на своё место внизу
  scenes: [1.5, 3.5, 5.5, 7.5, 9.5],
  kitchen: 11.5,
  end: 15.5,
  endPill: 16.0,
  endShelf: 16.55,
  endChips: 16.95,
  endApps: 17.35,
};
// 3D-кухня (от её начала): вопрос → «Соберите в 3D» → три пункта, каждый показываем на рисунке.
export const K = { headline: 1.0, f1: 1.55, f2: 2.15, f3: 2.75, free: 3.25, pulse: 3.6 };
// Сборка кухни: строки kitchen-iso.svg (рисунок с главной сайта) и когда они падают (от начала сцены).
export const KITCHEN = [
  { lines: [3, 3], t: 0.3, d: 0.4, kind: 'fade' },
  { lines: [4, 18], t: 0.25, d: 0.3, kind: 'rise', dy: 90 },
  { lines: [19, 25], t: 0.38, d: 0.28, kind: 'drop', dy: -170 },
  { lines: [26, 39], t: 0.55, d: 0.22, kind: 'drop', dy: -60 },
  { lines: [124, 133], t: 0.6, d: 0.22, kind: 'drop', dy: -110, sfx: 1 },
  { lines: [118, 123], t: 0.65, d: 0.22, kind: 'drop', dy: -110 },
  { lines: [40, 45], t: 0.7, d: 0.22, kind: 'drop', dy: -110, sfx: 1 },
  { lines: [46, 55], t: 0.75, d: 0.22, kind: 'drop', dy: -110 },
  { lines: [56, 66], t: 0.8, d: 0.22, kind: 'drop', dy: -110, sfx: 1 },
  { lines: [67, 74], t: 0.85, d: 0.22, kind: 'drop', dy: -110 },
  { lines: [75, 82], t: 0.9, d: 0.22, kind: 'drop', dy: -110, sfx: 1 },
  { lines: [83, 88], t: 0.95, d: 0.22, kind: 'drop', dy: -110 },
  { lines: [89, 92], t: 1.0, d: 0.22, kind: 'drop', dy: -110 },
  { lines: [108, 113], t: 0.95, d: 0.3, kind: 'drop', dy: -420, sfx: 2 },
  { lines: [93, 95], t: 1.05, d: 0.2, kind: 'drop', dy: -50 },
  { lines: [134, 136], t: 1.05, d: 0.2, kind: 'drop', dy: -50 },
  { lines: [96, 100], t: 1.12, d: 0.2, kind: 'drop', dy: -40 },
  { lines: [101, 105], t: 1.15, d: 0.2, kind: 'drop', dy: -40 },
  { lines: [106, 107], t: 1.18, d: 0.2, kind: 'drop', dy: -40 },
  { lines: [114, 117], t: 1.22, d: 0.22, kind: 'drop', dy: -130 },
  { lines: [177, 181], t: 1.1, d: 0.22, kind: 'drop', dy: -150, sfx: 1 },
  { lines: [172, 176], t: 1.14, d: 0.22, kind: 'drop', dy: -150 },
  { lines: [146, 150], t: 1.18, d: 0.22, kind: 'drop', dy: -150, sfx: 1 },
  { lines: [151, 155], t: 1.22, d: 0.22, kind: 'drop', dy: -150 },
  { lines: [156, 161], t: 1.26, d: 0.22, kind: 'drop', dy: -150 },
  { lines: [162, 166], t: 1.3, d: 0.22, kind: 'drop', dy: -150 },
  { lines: [167, 171], t: 1.34, d: 0.22, kind: 'drop', dy: -150, sfx: 1 },
  { lines: [137, 145], t: 1.42, d: 0.25, kind: 'pop', cx: 349, cy: 425 },
  { lines: [193, 197], t: 1.6, d: 0.35, kind: 'draw' },
  { lines: [182, 192], t: 2.8, d: 0.25, kind: 'draw' },
];
// Внутри ситуации (от её начала): вопрос, падение товара, вспышка адреса.
export const S = { land: 0.78, pulse: 1.0 };
export const PULSES = [T.slam, ...T.scenes.map(v => v + S.pulse), T.kitchen + K.pulse, T.endPill + 0.4];

export const MUSIC = { start: 1.5, calm: [], end: T.end };
export const WARMUP = [2.6, 4.6, 6.6, 8.6, 10.6, 14.5, 17.5];

// Звуковые события.
export function cues() {
  const c = [];
  const add = (t, type, opt = {}) => c.push({ t, type, ...opt });
  add(T.hello, 'whoosh', { dur: 0.4, from: 500, to: 3000, amp: 0.35 });
  add(T.slam, 'impact', { amp: 0.9 });
  add(T.home, 'whoosh', { dur: 0.45, from: 2500, to: 600, amp: 0.35 });
  PULSES.forEach((t, i) => add(t, 'logo', { amp: i === PULSES.length - 1 ? 0.75 : 0.55 }));
  T.scenes.forEach(v => {
    add(v - 0.12, 'whoosh', { dur: 0.45, from: 400, to: 4200, amp: 0.4 });
    add(v + S.land, 'thud', { amp: 0.65 });
  });
  const [v1, v2, v3, v4, v5] = T.scenes;
  add(v1 + 0.1, 'rattle', { dur: 0.6, amp: 0.35 });
  add(v1 + S.land + 0.02, 'poof', { amp: 0.5 });
  [0.18, 0.26, 0.34].forEach((d, i) => add(v2 + d, 'pop', { amp: 0.35, semis: i * 3 }));
  add(v2 + S.land + 0.12, 'thud', { amp: 0.4 });
  add(v2 + 1.1, 'steam', { dur: 0.7, amp: 0.25 });
  add(v3 + 0.28, 'thud', { amp: 0.45 });
  add(v3 + 0.5, 'pop', { amp: 0.55, semis: 7 });
  add(v3 + 0.52, 'sparkle', { dur: 0.8, amp: 0.4 });
  add(v4 + 0.14, 'knock', { amp: 0.45 });
  add(v4 + 0.26, 'knock', { amp: 0.4 });
  add(v4 + S.land + 0.14, 'thud', { amp: 0.4 });
  add(v5 + 0.45, 'whoosh', { dur: 0.4, from: 800, to: 3200, amp: 0.3 });
  add(v5 + 0.6, 'suck', { dur: 0.65, amp: 0.4 });
  add(v5 + 1.2, 'sparkle', { dur: 0.6, amp: 0.35 });
  const k0 = T.kitchen;
  add(k0 - 0.12, 'whoosh', { dur: 0.45, from: 400, to: 4200, amp: 0.4 });
  for (const g of KITCHEN) if (g.sfx) add(k0 + g.t + g.d * 0.75, g.sfx === 2 ? 'thud' : 'knock', { amp: g.sfx === 2 ? 0.55 : 0.35 });
  add(k0 + K.headline, 'whoosh', { dur: 0.35, from: 900, to: 3000, amp: 0.25 });
  add(k0 + K.f1, 'zip', { dur: 0.4, amp: 0.35 });
  add(k0 + K.f1, 'pop', { amp: 0.35, semis: 2 });
  [0, 0.25, 0.5].forEach((d, i) => add(k0 + K.f2 + d, 'pop', { amp: 0.32, semis: 4 + i * 3 }));
  add(k0 + K.f3, 'pop', { amp: 0.35, semis: 9 });
  add(k0 + K.f3 + 0.15, 'coin', { amp: 0.4, semis: 5 });
  add(k0 + K.free, 'thud', { amp: 0.4 });
  add(T.end - 0.12, 'whoosh', { dur: 0.5, from: 300, to: 4500, amp: 0.45 });
  add(T.endPill + 0.4, 'impact', { amp: 0.7 });
  [0, 1, 2, 3, 4].forEach(i => add(T.endShelf + i * 0.08, 'pop', { amp: 0.3, semis: 2 + i * 2 }));
  [0, 0.12].forEach((d, i) => add(T.endChips + d, 'pop', { amp: 0.35, semis: 9 + i * 3 }));
  [0, 0.12].forEach((d, i) => add(T.endApps + d, 'pop', { amp: 0.4, semis: 12 + i * 2 }));
  return c.sort((a, b) => a.t - b.t);
}
