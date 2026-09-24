/**
 * Губернатор кадров: подбирает рабочую чёткость 3D в движении по времени
 * кадра. На слабом телефоне кухня иначе дёргается; на хорошей видеокарте
 * кадры 8–16 мс, и он молчит. Чистая функция без браузера — движок
 * (`engine.ts`) зовёт `governStep` на каждом кадре, пока кухню крутят, и
 * применяет `ratio`. Покой (дорисовка с запасом чёткости) сюда не заходит.
 */

/** Сколько последних кадров усредняем, решая, что стало медленно. */
export const GOVERNOR_SAMPLES = 10
/** Средний кадр дольше этого — чёткость вниз на шаг. */
export const GOVERNOR_SLOW_MS = 30
/**
 * «Быстрый» кадр — 17,5 мс, а не 14: на экране 60 Гц rAF даёт ровно 16,7 мс,
 * и порог ниже никогда бы не сработал — телефон с 60 Гц остался бы на
 * пониженной чёткости до перезагрузки; 0,8 мс сверху — запас на дрожание.
 */
export const GOVERNOR_FAST_MS = 17.5
/** Столько быстрых кадров подряд — чёткость вверх на шаг. */
export const GOVERNOR_FAST_FRAMES = 30
export const GOVERNOR_STEP = 0.25
/** Ниже — картинка уже мыло даже на маленьком экране. */
export const GOVERNOR_MIN_RATIO = 0.6
/**
 * Один рывок (видеокарта собирает шейдер после пересборки) в среднее входит
 * не длиннее этого — иначе один рывок ронял бы чёткость до конца сеанса.
 */
export const GOVERNOR_CAP_MS = 80

export type GovernorState = {
  /** базовая чёткость в движении — выше неё губернатор не поднимает */
  readonly base: number
  /** рабочая чёткость сейчас */
  readonly ratio: number
  /** длительности последних кадров, мс (не больше GOVERNOR_SAMPLES) */
  readonly times: readonly number[]
  /** сколько подряд кадров были быстрыми */
  readonly fastRun: number
}

/** Свежее состояние: счётчики пустые, чёткость = ratio (по умолчанию базовая). */
export function newGovernor(base: number, ratio = base): GovernorState {
  return { base, ratio: Math.min(base, ratio), times: [], fastRun: 0 }
}

/** Один кадр в движении длительностью dtMs → новое состояние. */
export function governStep(s: GovernorState, dtMs: number): GovernorState {
  const dt = Math.min(dtMs, GOVERNOR_CAP_MS)
  const times = s.times.length >= GOVERNOR_SAMPLES ? [...s.times.slice(1 - GOVERNOR_SAMPLES), dt] : [...s.times, dt]
  const fastRun = dt < GOVERNOR_FAST_MS ? s.fastRun + 1 : 0
  if (times.length === GOVERNOR_SAMPLES && times.reduce((a, t) => a + t, 0) / times.length > GOVERNOR_SLOW_MS) {
    return { ...s, ratio: Math.max(GOVERNOR_MIN_RATIO, s.ratio - GOVERNOR_STEP), times: [], fastRun: 0 }
  }
  if (fastRun >= GOVERNOR_FAST_FRAMES && s.ratio < s.base) {
    return { ...s, ratio: Math.min(s.base, s.ratio + GOVERNOR_STEP), times: [], fastRun: 0 }
  }
  return { ...s, times, fastRun }
}
