/**
 * Класс устройства и регулятор кадров для 3D-конструктора.
 *
 * Класс выбирается один раз при запуске — по указателю (палец или мышь),
 * памяти, ядрам и видеокарте. Переключателя качества нет, в хранилище
 * (localStorage) ничего не читается и не пишется. Всё здесь — чистые
 * функции без three.js: движок (`engine.ts`) читает `Tier` и применяет.
 *
 * Идея класса «телефон»: экономим на шейдерах (стандартные материалы вместо
 * физических), свете (вечерние лампы днём выключены), тенях (статичные) и
 * сглаживании (FXAA вместо MSAA) — а не на разрешении: в покое кадр рисуется
 * в родных точках экрана (до 3 на точку CSS в бюджете 4 Мп).
 */

export type TierName = 'desktop' | 'desktop-weak' | 'phone' | 'phone-low' | 'photo'

export type Tier = {
  name: TierName
  /** телефон: палец и нет мыши/тачпада */
  mobile: boolean
  /** MeshPhysical с clearcoat/sheen/anisotropy; иначе MeshStandard */
  physical: boolean
  /** «Лёгкая» сборка: без внутренностей шкафов, посуды и мелочей — меньше вызовов видеокарты */
  lite: boolean
  /** детальность картинок материалов (K): 2 — компьютер, 1 — телефон */
  detail: number
  /** карта теней солнца: 0 — без теней */
  shadow: number
  /** многосэмпловое сглаживание холста (решается до создания холста) */
  msaa: boolean
  /** дешёвое сглаживание последним проходом */
  fxaa: boolean
  /** затенение в углах, свечение, свет окна — тяжёлый композер компьютера */
  composer: boolean
  /** снимок комнаты для отражений после пересборки (6 лишних кадров) */
  roomProbe: boolean
  /** трассировка лучей для «Фото» */
  pathTrace: boolean
  /** бюджет памяти под картинки материалов, байт */
  texBudget: number
  /** бюджет точек кадра в покое */
  restBudget: number
  /** чёткость в движении (точек на точку CSS) */
  moveRatio(dpr: number): number
  /** чёткость в покое — родные точки экрана в бюджете */
  restRatio(dpr: number, cssW: number, cssH: number): number
}

export type DeviceEnv = {
  /** (pointer: coarse) */
  coarse: boolean
  /** (any-pointer: fine) */
  fine: boolean
  /** navigator.deviceMemory — называет только Chrome на Android */
  memory: number | undefined
  cores: number
  /** UNMASKED_RENDERER_WEBGL или пусто */
  gpu: string
  dpr: number
}

/** Видеокарты недорогих Android-телефонов: Mali-400/T-серии/G31–G52, PowerVR, младшие Adreno. */
export const LOW_END_GPU = /mali-(4\d\d|t\d+|g31|g51|g52)|powervr|adreno \(tm\) (3\d\d|4\d\d|50\d|51\d|60\d|610)|swiftshader|llvmpipe/i
/** Встроенная графика компьютера — тяжёлые эффекты ей не по силам в полном размере. */
const WEAK_DESKTOP_GPU = /intel|uhd|iris|mali|adreno|powervr|swiftshader|llvmpipe|basic render/i

/** Прочитать устройство из браузера. gpu — из движка (нужен контекст WebGL). */
export function readEnv(gpu = ''): DeviceEnv {
  const w = typeof window !== 'undefined' ? window : undefined
  const n = (typeof navigator !== 'undefined' ? navigator : {}) as Navigator & { deviceMemory?: number }
  const mm = (q: string) => Boolean(w?.matchMedia?.(q)?.matches)
  return {
    coarse: mm('(pointer: coarse)'),
    fine: mm('(any-pointer: fine)'),
    memory: n.deviceMemory,
    cores: n.hardwareConcurrency ?? 8,
    gpu,
    dpr: w?.devicePixelRatio || 1,
  }
}

const clampBudget = (want: number, budget: number, w: number, h: number) => Math.min(want, Math.sqrt(budget / Math.max(1, w * h)))

function make(name: TierName, mobile: boolean): Tier {
  switch (name) {
    case 'desktop':
      return {
        name,
        mobile,
        physical: true,
        lite: false,
        detail: 2,
        shadow: 4096,
        msaa: true,
        fxaa: false,
        composer: true,
        roomProbe: true,
        pathTrace: true,
        texBudget: 480e6,
        restBudget: 8.3e6,
        moveRatio: (dpr) => Math.min(Math.max(dpr, 1.5), 2),
        restRatio: (dpr, w, h) => Math.max(1, clampBudget(Math.min(dpr * 3, 3), 8.3e6, w, h)),
      }
    case 'desktop-weak':
      return {
        name,
        mobile,
        physical: true,
        lite: false,
        detail: 2,
        shadow: 2048,
        msaa: true,
        fxaa: false,
        composer: true,
        roomProbe: true,
        pathTrace: true,
        texBudget: 420e6,
        restBudget: 4e6,
        moveRatio: (dpr) => Math.min(dpr, 1.5),
        restRatio: (dpr, w, h) => Math.max(1, clampBudget(Math.min(dpr * 2, 2), 4e6, w, h)),
      }
    case 'phone':
      return {
        name,
        mobile,
        physical: false,
        lite: false,
        detail: 1,
        shadow: 2048,
        msaa: true,
        fxaa: false,
        composer: false,
        roomProbe: false,
        pathTrace: false,
        texBudget: 200e6,
        restBudget: 4e6,
        moveRatio: (dpr) => Math.min(dpr, 1.5),
        restRatio: (dpr, w, h) => Math.max(1, clampBudget(Math.min(dpr, 3), 4e6, w, h)),
      }
    case 'phone-low':
      return {
        name,
        mobile,
        physical: false,
        lite: true,
        detail: 1,
        shadow: 1024,
        msaa: false,
        fxaa: true,
        composer: false,
        roomProbe: false,
        pathTrace: false,
        texBudget: 110e6,
        restBudget: 2.4e6,
        moveRatio: () => 1,
        restRatio: (dpr, w, h) => Math.max(1, clampBudget(Math.min(dpr, 2), 2.4e6, w, h)),
      }
    case 'photo':
      // временный класс для снимка 4K на телефоне: полные материалы и тени,
      // картинки как на компьютере (простому телефону — K = 1: память)
      return {
        name,
        mobile,
        physical: true,
        lite: false,
        detail: 2,
        shadow: 2048,
        msaa: false,
        fxaa: true,
        composer: false,
        roomProbe: true,
        pathTrace: false,
        texBudget: 200e6,
        restBudget: 4e6,
        moveRatio: () => 1,
        restRatio: () => 1,
      }
  }
}

/**
 * Класс устройства. env — по умолчанию из браузера; force — временный класс
 * (`photo` для снимка 4K на телефоне).
 */
/** Телефон: палец и нет мыши/тачпада (одно правило для класса устройства и для холста движка). */
export const isPhone = (env: Pick<DeviceEnv, 'coarse' | 'fine'>): boolean => env.coarse && !env.fine

export function pickTier(env: DeviceEnv = readEnv(), force?: TierName): Tier {
  const mobile = isPhone(env)
  if (force) {
    const t = make(force, mobile)
    if (force === 'photo' && isLowPhone(env)) t.detail = 1
    return t
  }
  if (mobile) return make(isLowPhone(env) ? 'phone-low' : 'phone', true)
  return make(WEAK_DESKTOP_GPU.test(env.gpu) ? 'desktop-weak' : 'desktop', false)
}

/**
 * Простой телефон: 2–3 ГБ памяти (называет только Chrome на Android), слабая
 * видеокарта или ≤ 4 ядер. iPhone по ядрам не судим: Safari называет не
 * настоящее число (защита от слежки), а видеокарту — «Apple GPU» у всех.
 */
function isLowPhone(env: DeviceEnv): boolean {
  const apple = /apple/i.test(env.gpu)
  return (env.memory !== undefined && env.memory <= 3) || (!apple && env.cores <= 4) || LOW_END_GPU.test(env.gpu)
}

/* ───────────── регулятор кадров ───────────── */

/** Сколько последних кадров усредняем, решая, что стало медленно. */
export const GOVERNOR_SAMPLES = 10
/** Средний кадр дольше этого — шаг вниз. */
export const GOVERNOR_SLOW_MS = 30
/** Кадр дольше этого откладывает восстановление. */
export const GOVERNOR_BUSY_MS = 25
/** Столько времени без медленных кадров — шаг вверх. */
export const GOVERNOR_RECOVER_MS = 3000
/** Один рывок (сборка шейдера) в среднее входит не длиннее этого. */
export const GOVERNOR_CAP_MS = 80
/** Ниже резкость не падает при dpr ≥ 2 (и 0,75 на экранах попроще). */
export const GOVERNOR_MIN_RATIO_HIDPI = 0.85
export const GOVERNOR_MIN_RATIO = 0.75
/** Ступени: тени 1024 → тени выкл → картинки K/2 → резкость ×0,75 → резкость минимум. */
export const GOVERNOR_MAX_LEVEL = 5

export type GovernorState = {
  /** 0 — всё как задаёт класс; выше — ступени экономии */
  readonly level: number
  /** длительности последних кадров, мс */
  readonly times: readonly number[]
  /** когда последний раз было медленно (или сменили уровень), мс часов */
  readonly calmSince: number
}

export function newGovernor(now = 0): GovernorState {
  return { level: 0, times: [], calmSince: now }
}

/** Один кадр в движении длительностью dtMs, часы now (performance.now). */
export function governStep(s: GovernorState, dtMs: number, now: number): GovernorState {
  const dt = Math.min(dtMs, GOVERNOR_CAP_MS)
  const times = s.times.length >= GOVERNOR_SAMPLES ? [...s.times.slice(1 - GOVERNOR_SAMPLES), dt] : [...s.times, dt]
  if (times.length === GOVERNOR_SAMPLES && times.reduce((a, t) => a + t, 0) / times.length > GOVERNOR_SLOW_MS) {
    return { level: Math.min(GOVERNOR_MAX_LEVEL, s.level + 1), times: [], calmSince: now }
  }
  if (dt > GOVERNOR_BUSY_MS) return { ...s, times, calmSince: now }
  const up = governIdle({ ...s, times }, now)
  return up === s ? { ...s, times } : up
}

/** Покой или быстрые кадры: прошло 3 с без медленных — ступень вверх. */
export function governIdle(s: GovernorState, now: number): GovernorState {
  if (s.level > 0 && now - s.calmSince >= GOVERNOR_RECOVER_MS) return { level: s.level - 1, times: [], calmSince: now }
  return s
}

/** Что применить на ступени level: карта теней, детальность картинок, чёткость в движении. */
/**
 * Сколько сэмплов MSAA у цели кадра. Компьютер: кадр в 2 раза крупнее холста
 * уже сглажен — 0. Телефон: в покое кадр = точкам экрана (ratio = холст), и без
 * сэмплов швы дверец рвутся в пунктир (P4) — 4, а на большом кадре 2: память
 * цели с сэмплами растёт в разы (полный экран iPhone — 2,7 Мп).
 */
export function msaaSamples(tier: Tier, ratio: number, canvas: number, cssW: number, cssH: number): number {
  if (!tier.msaa) return 0
  if (!tier.mobile) return ratio >= 1.99 ? 0 : 4
  if (ratio / Math.max(canvas, 0.01) >= 1.99) return 0
  const px = ratio * ratio * cssW * cssH
  return px <= MSAA4_PX ? 4 : px <= MSAA2_PX ? 2 : 0
}
/** Что видеокарта сказала про многосэмпловую цель кадра (HalfFloat). */
export type MsaaSupport = {
  /** есть `EXT_color_buffer_half_float` или `EXT_color_buffer_float` */
  halfFloat: boolean
  /** цель с сэмплами дала ошибку GL или неполный кадровый буфер */
  glError: boolean
}
/**
 * Запасной путь MSAA (P4, ревью): на части Android и старых iOS многосэмпловый
 * half-float не поддерживается — чёрный кадр. Тогда 0 сэмплов и FXAA, как у
 * phone-low; поддержка есть — тот же класс (тот же объект).
 */
export function msaaFallback(tier: Tier, s: MsaaSupport): Tier {
  if (!tier.msaa || (s.halfFloat && !s.glError)) return tier
  return { ...tier, msaa: false, fxaa: true }
}
const MSAA4_PX = 1.6e6
const MSAA2_PX = 3e6

export function governorPlan(level: number, tier: Tier, dpr: number): { shadow: number; detail: number; ratio: number } {
  const base = tier.moveRatio(dpr)
  const min = dpr >= 2 ? GOVERNOR_MIN_RATIO_HIDPI : GOVERNOR_MIN_RATIO
  const shadow = level >= 2 ? 0 : level >= 1 ? Math.min(tier.shadow, 1024) : tier.shadow
  const detail = level >= 3 ? tier.detail / 2 : tier.detail
  const ratio = level >= 5 ? Math.min(base, min) : level >= 4 ? Math.max(min, base * 0.75) : base
  return { shadow, detail, ratio }
}
