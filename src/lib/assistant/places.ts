/**
 * Откуда покупатель и везём ли туда — по справочнику сёл (placesData.ts, из OpenStreetMap).
 *
 * Владелец 08.10: «Кашка-Суудан», «Токмокко» бот не понимал и отвечал «руководство айтат». Теперь
 * село → район → область → правило доставки, и модель получает это подсказкой (после NOW_MARK —
 * у каждого разговора своя, кэш Gemini не трогает). Улицу и дом не разбираем: они нужны водителю.
 */
import { DISTRICTS, PLACES, REGIONS } from './placesData'

/** Туда своей машины нет (владелец 08.10) — предлагаем бесплатно до Бишкека, дальше покупатель сам. */
export const NO_CAR_PLACES = ['Токмак', 'Кара-Балта']
export const NO_CAR_REGIONS = ['Таласская область', 'Нарынская область']

/** Село района → центр, до которого везём бесплатно (policy.ts FREE_DELIVERY_POINTS). */
const FREE_BY_DISTRICT: Record<string, string> = {
  'Ноокатский район': 'Ноокат',
  'Базар-Коргонский район': 'Базар-Коргон',
  'Аксыйский район': 'Аксы (Кербен)',
  'Баткенский район': 'Баткен',
  'Лейлекский район': 'Раззаков (Исфана)',
  'Узгенский район': 'Узген',
  'Ала-Букинский район': 'Ала-Бука',
}
const FREE_BY_NAME: Record<string, string> = {
  'Ош': 'Ош', 'Бишкек': 'Бишкек', 'Ноокат': 'Ноокат', 'Базар-Коргон': 'Базар-Коргон', 'Кербен': 'Аксы (Кербен)',
  'Баткен': 'Баткен', 'Исфана': 'Раззаков (Исфана)', 'Кызыл-Кия': 'Кызыл-Кия', 'Узген': 'Узген', 'Куршаб': 'Куршаб',
  'Ала-Бука': 'Ала-Бука', 'Джалал-Абад': 'Джалал-Абад',
  // Джалал-Абад в OpenStreetMap уже «Манас» (новое название); в списке владельца есть оба
  'Манас': 'Джалал-Абад (Манас)',
  'Майлуу-Суу': 'Майлуу-Суу',
}
const FREE_BY_REGION: Record<string, string> = { 'город Бишкек': 'Бишкек', 'Ош': 'Ош' }
/** Сёла, подчинённые городу (в OpenStreetMap — «район» города) */
const FREE_BY_CITY_DISTRICT: Record<string, string> = { 'город Майлуу-Суу': 'Майлуу-Суу' }
const FREE_VILLAGES: Record<string, string> = { 'Куршаб': 'Узгенский район', 'Ала-Бука': 'Ала-Букинский район' }

export type Place = { name: string; district: string; region: string; rule: string }

/** Как в build_places.py key(): одни буквы, кыргызские и узбекские — русскими, «дж» = «ж». */
export function placeKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/ё/g, 'е').replace(/ң/g, 'н').replace(/ө/g, 'о').replace(/[үў]/g, 'у')
    .replace(/қ/g, 'к').replace(/ғ/g, 'г').replace(/ҳ/g, 'х').replace(/дж/g, 'ж')
    .replace(/[^a-zа-я]/g, '')
}

let index: Map<string, number[]> | null = null
function lookup(): Map<string, number[]> {
  if (index) return index
  index = new Map()
  PLACES.forEach(([, , , , keys], i) => {
    for (const k of keys) index!.set(k, [...(index!.get(k) ?? []), i])
  })
  return index
}

function ruleOf(name: string, kind: string, district: string, region: string): string {
  if (NO_CAR_PLACES.includes(name) || NO_CAR_REGIONS.includes(region))
    return 'своей машины туда нет: предложи бесплатно довезти до Бишкека (до центра), оттуда покупатель забирает сам; другой доставки туда не обещай'
  // по названию — только сам город (село «Кызыл-Кия» на Иссык-Куле — не город Кызыл-Кия); Куршаб и Ала-Бука
  // в OpenStreetMap сёла — их узнаём по своему району
  const byName = kind !== 'village' || FREE_VILLAGES[name] === district ? FREE_BY_NAME[name] : undefined
  const free = byName ?? FREE_BY_DISTRICT[district] ?? FREE_BY_CITY_DISTRICT[district] ?? FREE_BY_REGION[region]
  if (free) return `бесплатно до центра: ${free} (не до дома; оттуда покупатель забирает сам)`
  if (district === 'Араванский район') return 'рядом с магазином (магазин в Араване): можно приехать и забрать; до Оша довезём бесплатно'
  return 'привезём; стоимость доставки скажет руководство после оформления'
}

/**
 * Сёла, названные в тексте. Слово с окончанием («Ноокаттан», «Таластанмын») — отрезаем до семи букв с конца;
 * название из двух-трёх слов («Кызыл Кия», «Жаңы Алыш») склеиваем. Короче 4 букв не ищем.
 */
export function placesIn(text: string): Place[] {
  const words = text.split(/[^\p{L}\d-]+/u).flatMap((w) => w.split('-')).map(placeKey).filter(Boolean)
  const map = lookup()
  const found = new Map<number, number>() // место → позиция слова (последнее упоминание важнее)
  for (let i = 0; i < words.length; i++) {
    if (words[i] === 'туп' && words[i + 1]?.startsWith('нуск')) continue // «түп нуска» — «оригинал», не село Түп
    for (let span = 3; span >= 1; span--) {
      if (i + span > words.length) continue
      const joined = words.slice(i, i + span).join('')
      let hit: number[] | undefined
      for (let cut = 0; cut <= 7 && joined.length - cut >= 4 && !hit; cut++) hit = map.get(joined.slice(0, joined.length - cut))
      if (hit) {
        for (const p of hit) found.set(p, i)
        i += span - 1
        break
      }
    }
  }
  const seen = new Set<string>()
  return [...found.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([p]) => {
      const [name, d, r, kind] = PLACES[p]
      return { name, district: DISTRICTS[d], region: REGIONS[r], rule: ruleOf(name, kind, DISTRICTS[d], REGIONS[r]) }
    })
    .filter((p) => {
      const k = `${p.name}|${p.district}`
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
}

/** Подсказка модели: где это и как туда везём. Пусто — ничего не нашли. */
export function placeBlock(recent: string): string {
  const places = placesIn(recent).slice(0, 4)
  if (!places.length) return ''
  const names = new Set(places.map((p) => p.name))
  const twin = names.size < places.length
  const lines = places.map((p) => `• ${p.name} — ${[p.district, p.region].filter(Boolean).join(', ')} → ${p.rule}`)
  return `МЕСТО, КОТОРОЕ НАЗВАЛ ПОКУПАТЕЛЬ (справочник сёл; используй, только если речь о доставке, адресе или «откуда вы»)
${lines.join('\n')}${twin ? '\nСёл с таким названием несколько — если от этого зависит доставка, спроси район.' : ''}`
}
