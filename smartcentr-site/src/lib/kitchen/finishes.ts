import type { HandleKind, Metal, SplashKind } from './styles'

/**
 * Отделка кухни, как в каталоге мебельного салона: из чего фасады и какого
 * они цвета, какая столешница, какие ручки. Покупатель выбирает здесь —
 * а в 3D материал ведёт себя как настоящий: акрил блестит как зеркало,
 * ламинат матовый, Fenix бархатный, шпон — с живым рисунком дерева.
 * Названия цветов — те, что встречаются в каталогах ЛДСП и акрила.
 */

export type FrontMaterial = 'laminate' | 'acrylic' | 'enamel' | 'veneer' | 'fenix'

export const FRONT_MATERIALS: { id: FrontMaterial; ru: string; ky: string; noteRu: string; noteKy: string }[] = [
  { id: 'laminate', ru: 'Ламинат', ky: 'Ламинат', noteRu: 'ЛДСП и МДФ в плёнке — матовые, недорогие', noteKy: 'ЛДСП жана пленкадагы МДФ — күңүрт, арзан' },
  { id: 'acrylic', ru: 'Акрил', ky: 'Акрил', noteRu: 'Глубокий зеркальный глянец', noteKy: 'Терең күзгүдөй жылтырак' },
  { id: 'enamel', ru: 'Эмаль', ky: 'Эмаль', noteRu: 'Крашеный МДФ, любой цвет, полуматовый', noteKy: 'Боёлгон МДФ, каалаган түс, жарым күңүрт' },
  { id: 'veneer', ru: 'Шпон', ky: 'Шпон', noteRu: 'Натуральное дерево под лаком', noteKy: 'Лак астындагы табигый жыгач' },
  { id: 'fenix', ru: 'Fenix', ky: 'Fenix', noteRu: 'Суперматовый нано-пластик, без отпечатков', noteKy: 'Өтө күңүрт нано-пластик, из калбайт' },
]

export type FrontColor = {
  id: string
  material: FrontMaterial
  ru: string
  ky: string
  color: string
  texture?: 'wood' | 'concrete'
}

export const FRONT_COLORS: FrontColor[] = [
  // ламинат (ЛДСП, МДФ в плёнке)
  { id: 'lam-white', material: 'laminate', ru: 'Белый премиум', ky: 'Премиум ак', color: '#f1f0ec' },
  { id: 'lam-cashmere', material: 'laminate', ru: 'Кашемир', ky: 'Кашемир', color: '#d0c5b7' },
  { id: 'lam-grey', material: 'laminate', ru: 'Серый шифер', ky: 'Боз шифер', color: '#8e9194' },
  { id: 'lam-graphite', material: 'laminate', ru: 'Графит', ky: 'Графит', color: '#3e4144' },
  { id: 'lam-black', material: 'laminate', ru: 'Чёрный', ky: 'Кара', color: '#232426' },
  { id: 'lam-sonoma', material: 'laminate', ru: 'Дуб Сонома', ky: 'Сонома эмени', color: '#c9a67b', texture: 'wood' },
  { id: 'lam-halifax', material: 'laminate', ru: 'Дуб Галифакс', ky: 'Галифакс эмени', color: '#a77b53', texture: 'wood' },
  { id: 'lam-walnut', material: 'laminate', ru: 'Орех Пацифик', ky: 'Пацифик жаңгагы', color: '#6e4d36', texture: 'wood' },
  { id: 'lam-concrete', material: 'laminate', ru: 'Бетон Чикаго', ky: 'Чикаго бетону', color: '#a19f9a', texture: 'concrete' },
  { id: 'lam-craft', material: 'laminate', ru: 'Дуб Крафт золотой', ky: 'Крафт алтын эмени', color: '#c08e57', texture: 'wood' },
  { id: 'lam-wotan', material: 'laminate', ru: 'Дуб Вотан', ky: 'Вотан эмени', color: '#7b6857', texture: 'wood' },
  { id: 'lam-stone', material: 'laminate', ru: 'Серый камень', ky: 'Боз таш', color: '#b4afa7' },
  // акрил — глянец
  { id: 'acr-white', material: 'acrylic', ru: 'Белый глянец', ky: 'Ак жылтырак', color: '#f6f6f5' },
  { id: 'acr-vanilla', material: 'acrylic', ru: 'Ваниль', ky: 'Ваниль', color: '#efe5cf' },
  { id: 'acr-cappuccino', material: 'acrylic', ru: 'Капучино', ky: 'Капучино', color: '#b7a188' },
  { id: 'acr-grey', material: 'acrylic', ru: 'Серый металлик', ky: 'Боз металлик', color: '#9ba1a7' },
  { id: 'acr-anthracite', material: 'acrylic', ru: 'Антрацит', ky: 'Антрацит', color: '#3b3f44' },
  { id: 'acr-black', material: 'acrylic', ru: 'Чёрный глянец', ky: 'Кара жылтырак', color: '#121315' },
  { id: 'acr-bordeaux', material: 'acrylic', ru: 'Бордо', ky: 'Бордо', color: '#5f1b26' },
  { id: 'acr-emerald', material: 'acrylic', ru: 'Изумруд', ky: 'Зумурут', color: '#1f4e45' },
  { id: 'acr-navy', material: 'acrylic', ru: 'Тёмно-синий', ky: 'Кочкул көк', color: '#243a5e' },
  { id: 'acr-powder', material: 'acrylic', ru: 'Пудра', ky: 'Упа', color: '#e3cbc2' },
  { id: 'acr-sage', material: 'acrylic', ru: 'Шалфей глянец', ky: 'Жылтырак шалфей', color: '#a3af9b' },
  { id: 'acr-teal', material: 'acrylic', ru: 'Петроль', ky: 'Петроль', color: '#1f4f58' },
  // эмаль — крашеный МДФ
  { id: 'en-white', material: 'enamel', ru: 'Белый мат', ky: 'Ак күңүрт', color: '#eeede9' },
  { id: 'en-sand', material: 'enamel', ru: 'Песок', ky: 'Кум', color: '#d3c4ae' },
  { id: 'en-sage', material: 'enamel', ru: 'Шалфей', ky: 'Шалфей', color: '#9ba691' },
  { id: 'en-olive', material: 'enamel', ru: 'Олива', ky: 'Зайтун', color: '#7e805f' },
  { id: 'en-sky', material: 'enamel', ru: 'Небесный', ky: 'Асман', color: '#9fb6c9' },
  { id: 'en-rose', material: 'enamel', ru: 'Пыльная роза', ky: 'Чаңдуу роза', color: '#c69c95' },
  { id: 'en-terracotta', material: 'enamel', ru: 'Терракота', ky: 'Терракота', color: '#b56d52' },
  { id: 'en-mocha', material: 'enamel', ru: 'Мокко', ky: 'Мокко', color: '#6f5747' },
  { id: 'en-graphite', material: 'enamel', ru: 'Графит', ky: 'Графит', color: '#3b3f44' },
  { id: 'en-ivory', material: 'enamel', ru: 'Слоновая кость', ky: 'Пил сөөгү', color: '#f0e8d8' },
  { id: 'en-mustard', material: 'enamel', ru: 'Горчица', ky: 'Кычы', color: '#b58a35' },
  { id: 'en-lavender', material: 'enamel', ru: 'Лаванда', ky: 'Лаванда', color: '#a9a2bf' },
  { id: 'en-forest', material: 'enamel', ru: 'Хвойный', ky: 'Карагай жашыл', color: '#2f4a3d' },
  { id: 'en-plum', material: 'enamel', ru: 'Баклажан', ky: 'Баклажан', color: '#4c2f3c' },
  // шпон
  { id: 'ven-oak', material: 'veneer', ru: 'Дуб натуральный', ky: 'Табигый эмен', color: '#b88e63', texture: 'wood' },
  { id: 'ven-bleached', material: 'veneer', ru: 'Дуб белёный', ky: 'Агартылган эмен', color: '#dac8ac', texture: 'wood' },
  { id: 'ven-walnut', material: 'veneer', ru: 'Орех американский', ky: 'Америка жаңгагы', color: '#604431', texture: 'wood' },
  { id: 'ven-smoked', material: 'veneer', ru: 'Дуб копчёный', ky: 'Ышталган эмен', color: '#4f3c2d', texture: 'wood' },
  { id: 'ven-ash', material: 'veneer', ru: 'Ясень', ky: 'Ясень', color: '#d6c3a2', texture: 'wood' },
  { id: 'ven-teak', material: 'veneer', ru: 'Тик', ky: 'Тик', color: '#8a5a33', texture: 'wood' },
  // Fenix — суперматовый
  { id: 'fx-nero', material: 'fenix', ru: 'Nero Ingo', ky: 'Nero Ingo', color: '#1b1c1e' },
  { id: 'fx-londra', material: 'fenix', ru: 'Grigio Londra', ky: 'Grigio Londra', color: '#6c6e71' },
  { id: 'fx-kos', material: 'fenix', ru: 'Bianco Kos', ky: 'Bianco Kos', color: '#eceae6' },
  { id: 'fx-arizona', material: 'fenix', ru: 'Beige Arizona', ky: 'Beige Arizona', color: '#c9baa4' },
  { id: 'fx-comodoro', material: 'fenix', ru: 'Verde Comodoro', ky: 'Verde Comodoro', color: '#4d5b4d' },
  { id: 'fx-ottawa', material: 'fenix', ru: 'Castoro Ottawa', ky: 'Castoro Ottawa', color: '#877c70' },
  { id: 'fx-jaipur', material: 'fenix', ru: 'Rosso Jaipur', ky: 'Rosso Jaipur', color: '#8a3b2f' },
  { id: 'fx-fes', material: 'fenix', ru: 'Blu Fes', ky: 'Blu Fes', color: '#303f55' },
]

export function frontColor(id: string | undefined): FrontColor | undefined {
  return id ? FRONT_COLORS.find((c) => c.id === id) : undefined
}

/* ───────── столешницы ───────── */

export type TopMaterial = 'laminate' | 'acrylic' | 'quartz' | 'ceramic' | 'wood'

/** Как выглядит камень или дерево: рисунок, основной цвет, прожилки. */
export type TopLook = { pattern: 'marble' | 'speckle' | 'concrete' | 'wood' | 'solid'; base: string; vein?: string; gloss: number }

export type TopChoice = { id: string; material: TopMaterial; ru: string; ky: string; look: TopLook; cm: number }

export const TOP_MATERIALS: { id: TopMaterial; ru: string; ky: string; noteRu: string; noteKy: string }[] = [
  { id: 'laminate', ru: 'Ламинат', ky: 'Ламинат', noteRu: 'ЛДСП 38 мм — самая доступная', noteKy: 'ЛДСП 38 мм — эң арзаны' },
  { id: 'acrylic', ru: 'Акриловый камень', ky: 'Акрил таш', noteRu: 'Без швов, мойка из того же камня', noteKy: 'Тигишсиз, жуугуч ошол эле таштан' },
  { id: 'quartz', ru: 'Кварц', ky: 'Кварц', noteRu: 'Прочный, не боится горячего', noteKy: 'Бекем, ысыктан коркпойт' },
  { id: 'ceramic', ru: 'Керамика', ky: 'Керамика', noteRu: 'Тонкая плита 12 мм, как мрамор', noteKy: 'Жука 12 мм плита, мрамордой' },
  { id: 'wood', ru: 'Массив дерева', ky: 'Жыгач массиви', noteRu: 'Тёплое дерево под маслом', noteKy: 'Май сиңген жылуу жыгач' },
]

export const TOPS: TopChoice[] = [
  { id: 'tl-marble', material: 'laminate', ru: 'Мрамор Каррара', ky: 'Каррара мрамору', cm: 3.8, look: { pattern: 'marble', base: '#efeeea', vein: '#9d9a95', gloss: 0.2 } },
  { id: 'tl-concrete', material: 'laminate', ru: 'Бетон', ky: 'Бетон', cm: 3.8, look: { pattern: 'concrete', base: '#9f9d98', gloss: 0.1 } },
  { id: 'tl-oak', material: 'laminate', ru: 'Дуб Галифакс', ky: 'Галифакс эмени', cm: 3.8, look: { pattern: 'wood', base: '#b08457', gloss: 0.15 } },
  { id: 'tl-slate', material: 'laminate', ru: 'Тёмный сланец', ky: 'Кочкул сланец', cm: 3.8, look: { pattern: 'speckle', base: '#3b3d40', vein: '#6f7276', gloss: 0.12 } },
  { id: 'ta-white', material: 'acrylic', ru: 'Белый', ky: 'Ак', cm: 4, look: { pattern: 'solid', base: '#f3f2ee', gloss: 0.35 } },
  { id: 'ta-sand', material: 'acrylic', ru: 'Песчаный', ky: 'Кумдуу', cm: 4, look: { pattern: 'speckle', base: '#ddd2bf', vein: '#b4a58b', gloss: 0.35 } },
  { id: 'ta-granite', material: 'acrylic', ru: 'Серый гранит', ky: 'Боз гранит', cm: 4, look: { pattern: 'speckle', base: '#9a9b9b', vein: '#4f5153', gloss: 0.35 } },
  { id: 'ta-black', material: 'acrylic', ru: 'Чёрный', ky: 'Кара', cm: 4, look: { pattern: 'speckle', base: '#1a1b1d', vein: '#55585c', gloss: 0.4 } },
  { id: 'ta-terrazzo', material: 'acrylic', ru: 'Терраццо', ky: 'Терраццо', cm: 4, look: { pattern: 'speckle', base: '#e8e2d8', vein: '#b0785a', gloss: 0.35 } },
  { id: 'tq-calacatta', material: 'quartz', ru: 'Calacatta Gold', ky: 'Calacatta Gold', cm: 2, look: { pattern: 'marble', base: '#f4f2ee', vein: '#b49a74', gloss: 0.7 } },
  { id: 'tq-grey', material: 'quartz', ru: 'Серый бетон', ky: 'Боз бетон', cm: 2, look: { pattern: 'concrete', base: '#8f8e8a', gloss: 0.5 } },
  { id: 'tq-black', material: 'quartz', ru: 'Чёрный кварц', ky: 'Кара кварц', cm: 2, look: { pattern: 'speckle', base: '#131416', vein: '#8b8d91', gloss: 0.8 } },
  { id: 'tq-taj', material: 'quartz', ru: 'Таж Махал', ky: 'Таж Махал', cm: 2, look: { pattern: 'marble', base: '#efe8dc', vein: '#c3a987', gloss: 0.6 } },
  { id: 'tc-statuario', material: 'ceramic', ru: 'Статуарио', ky: 'Статуарио', cm: 1.2, look: { pattern: 'marble', base: '#f3f3f1', vein: '#7f8286', gloss: 0.85 } },
  { id: 'tc-nero', material: 'ceramic', ru: 'Неро Маркина', ky: 'Неро Маркина', cm: 1.2, look: { pattern: 'marble', base: '#151517', vein: '#e2e0dc', gloss: 0.85 } },
  { id: 'tc-travertine', material: 'ceramic', ru: 'Травертин', ky: 'Травертин', cm: 1.2, look: { pattern: 'marble', base: '#d9ccb6', vein: '#b7a283', gloss: 0.3 } },
  { id: 'tw-oak', material: 'wood', ru: 'Дуб', ky: 'Эмен', cm: 4, look: { pattern: 'wood', base: '#c49a6c', gloss: 0.25 } },
  { id: 'tw-walnut', material: 'wood', ru: 'Орех', ky: 'Жаңгак', cm: 4, look: { pattern: 'wood', base: '#6b4a33', gloss: 0.25 } },
]

export function topChoice(id: string | undefined): TopChoice | undefined {
  return id ? TOPS.find((c) => c.id === id) : undefined
}

/* ───────── фартук ───────── */

export type SplashGroup = 'stone' | 'glass' | 'tile' | 'plain'

export const SPLASH_GROUPS: { id: SplashGroup; ru: string; ky: string; noteRu: string; noteKy: string }[] = [
  { id: 'stone', ru: 'Камень', ky: 'Таш', noteRu: 'Мрамор, травертин, бетон — или как столешница', noteKy: 'Мрамор, травертин, бетон — же столешницадай' },
  { id: 'glass', ru: 'Цветное стекло', ky: 'Түстүү айнек', noteRu: 'Скинали: крашеное стекло, моется одним движением', noteKy: 'Скинали: боёлгон айнек, бир сүртүү менен тазаланат' },
  { id: 'tile', ru: 'Плитка', ky: 'Плитка', noteRu: 'Кабанчик, зеллидж, кирпич', noteKy: 'Кабанчик, зеллидж, кирпич' },
  { id: 'plain', ru: 'Простой', ky: 'Жөнөкөй', noteRu: 'Гладкая панель или просто крашеная стена', noteKy: 'Жылмакай панель же жөн гана боёлгон дубал' },
]

export type SplashChoice = { id: string; group: SplashGroup; ru: string; ky: string; kind: SplashKind; color: string; vein?: string }

export const SPLASHES: SplashChoice[] = [
  { id: 'sp-top', group: 'stone', ru: 'Как столешница', ky: 'Столешницадай', kind: 'slab', color: '#cfcac2' },
  { id: 'sp-carrara', group: 'stone', ru: 'Белый мрамор', ky: 'Ак мрамор', kind: 'stone', color: '#f2f0ec', vein: '#8d8a86' },
  { id: 'sp-calacatta', group: 'stone', ru: 'Калакатта', ky: 'Калакатта', kind: 'stone', color: '#f4f2ee', vein: '#b49a74' },
  { id: 'sp-nero', group: 'stone', ru: 'Неро Маркина', ky: 'Неро Маркина', kind: 'stone', color: '#151517', vein: '#e2e0dc' },
  { id: 'sp-travertine', group: 'stone', ru: 'Травертин', ky: 'Травертин', kind: 'stone', color: '#d9ccb6', vein: '#b7a283' },
  { id: 'sp-concrete', group: 'stone', ru: 'Бетон', ky: 'Бетон', kind: 'concrete', color: '#a09e99' },
  { id: 'sp-g-white', group: 'glass', ru: 'Белое', ky: 'Ак', kind: 'glass', color: '#f1f1ee' },
  { id: 'sp-g-beige', group: 'glass', ru: 'Бежевое', ky: 'Беж', kind: 'glass', color: '#e5d8c2' },
  { id: 'sp-g-grey', group: 'glass', ru: 'Серое', ky: 'Боз', kind: 'glass', color: '#8e9398' },
  { id: 'sp-g-graphite', group: 'glass', ru: 'Графит', ky: 'Графит', kind: 'glass', color: '#2e3135' },
  { id: 'sp-g-emerald', group: 'glass', ru: 'Изумруд', ky: 'Зумурут', kind: 'glass', color: '#1f4e45' },
  { id: 'sp-g-terracotta', group: 'glass', ru: 'Терракота', ky: 'Терракота', kind: 'glass', color: '#b3664b' },
  { id: 'sp-g-sky', group: 'glass', ru: 'Небесное', ky: 'Асман', kind: 'glass', color: '#a8c2d5' },
  { id: 'sp-g-olive', group: 'glass', ru: 'Олива', ky: 'Зайтун', kind: 'glass', color: '#7e805f' },
  { id: 'sp-g-powder', group: 'glass', ru: 'Пудровое', ky: 'Упа түстүү', kind: 'glass', color: '#e3cbc2' },
  { id: 'sp-g-teal', group: 'glass', ru: 'Петроль', ky: 'Петроль', kind: 'glass', color: '#1f4f58' },
  { id: 'sp-t-white', group: 'tile', ru: 'Кабанчик белый', ky: 'Ак кабанчик', kind: 'subway', color: '#f4f3ef' },
  { id: 'sp-t-green', group: 'tile', ru: 'Кабанчик зелёный', ky: 'Жашыл кабанчик', kind: 'subway', color: '#6f8f7a' },
  { id: 'sp-t-navy', group: 'tile', ru: 'Кабанчик синий', ky: 'Көк кабанчик', kind: 'subway', color: '#2f4462' },
  { id: 'sp-t-black', group: 'tile', ru: 'Кабанчик чёрный', ky: 'Кара кабанчик', kind: 'subway', color: '#222325' },
  { id: 'sp-t-sage', group: 'tile', ru: 'Кабанчик шалфей', ky: 'Шалфей кабанчик', kind: 'subway', color: '#a3af9b' },
  { id: 'sp-z-white', group: 'tile', ru: 'Зеллидж белый', ky: 'Ак зеллидж', kind: 'zellige', color: '#efe9df' },
  { id: 'sp-z-sage', group: 'tile', ru: 'Зеллидж шалфей', ky: 'Шалфей зеллидж', kind: 'zellige', color: '#9fb3a2' },
  { id: 'sp-z-terracotta', group: 'tile', ru: 'Зеллидж терракота', ky: 'Терракота зеллидж', kind: 'zellige', color: '#c07a5c' },
  { id: 'sp-z-blue', group: 'tile', ru: 'Зеллидж синий', ky: 'Көк зеллидж', kind: 'zellige', color: '#4e78a3' },
  { id: 'sp-brick', group: 'tile', ru: 'Кирпич', ky: 'Кирпич', kind: 'brick', color: '#8c4c38' },
  { id: 'sp-brick-white', group: 'tile', ru: 'Белый кирпич', ky: 'Ак кирпич', kind: 'brick', color: '#e6e1da' },
  { id: 'sp-panel-white', group: 'plain', ru: 'Белая панель', ky: 'Ак панель', kind: 'panel', color: '#f0efeb' },
  { id: 'sp-panel-grey', group: 'plain', ru: 'Серая панель', ky: 'Боз панель', kind: 'panel', color: '#b9bbbd' },
  { id: 'sp-panel-black', group: 'plain', ru: 'Чёрная панель', ky: 'Кара панель', kind: 'panel', color: '#232426' },
  { id: 'sp-paint', group: 'plain', ru: 'Без фартука — крашеная стена', ky: 'Фартуксуз — боёлгон дубал', kind: 'paint', color: '' },
]

export function splashChoice(id: string | undefined): SplashChoice | undefined {
  return id ? SPLASHES.find((c) => c.id === id) : undefined
}

/* ───────── ручки ───────── */

/** Ручки на выбор — от самых модных. Без ручек — отдельной галочкой. */
export const HANDLES: { id: HandleKind; ru: string; ky: string }[] = [
  { id: 'edge', ru: 'Торцевая', ky: 'Четки' },
  { id: 'rail', ru: 'Профиль', ky: 'Профиль' },
  { id: 'long', ru: 'Длинная', ky: 'Узун' },
  { id: 'knurled', ru: 'С насечкой', ky: 'Кертиктүү' },
  { id: 'tbar', ru: 'Т-образная', ky: 'Т-сымал' },
  { id: 'bar', ru: 'Рейлинг', ky: 'Рейлинг' },
  { id: 'ring', ru: 'Кольцо', ky: 'Шакек' },
  { id: 'leather', ru: 'Кожаная петля', ky: 'Тери илмек' },
  { id: 'cup', ru: 'Ракушка', ky: 'Чөмүч' },
  { id: 'knob', ru: 'Кнобка', ky: 'Кнопка' },
  { id: 'bow', ru: 'Скоба', ky: 'Скоба' },
]

export const HANDLE_METALS: { id: Metal; ru: string; ky: string; swatch: string }[] = [
  { id: 'black', ru: 'Чёрный мат', ky: 'Кара күңүрт', swatch: '#1d1e20' },
  { id: 'brass', ru: 'Латунь', ky: 'Жез', swatch: 'linear-gradient(135deg, #e3c68f, #b08a52)' },
  { id: 'gunmetal', ru: 'Графит', ky: 'Графит', swatch: 'linear-gradient(135deg, #7a7d82, #43464b)' },
  { id: 'steel', ru: 'Сталь', ky: 'Болот', swatch: 'linear-gradient(135deg, #f0f2f4, #b9bec3)' },
  { id: 'chrome', ru: 'Хром', ky: 'Хром', swatch: 'linear-gradient(135deg, #ffffff, #a9aeb4 60%, #e9ecef)' },
  { id: 'bronze', ru: 'Бронза', ky: 'Коло', swatch: 'linear-gradient(135deg, #9b8161, #5f4b33)' },
]
