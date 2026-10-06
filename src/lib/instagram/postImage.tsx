import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { MARK } from '@/components/Brand'
import { phones } from '@/data/contacts'
import { formatSom } from '@/lib/format'
import { adalMonthly, INSTALLMENT } from '@/lib/installment'
import { readFileSync } from 'node:fs'

/** Знак MIslamic для плашки рассрочки (public/brand/mislamic-mark.svg). Нет файла — плашка без знака. */
const MIS_MARK = (() => {
  try {
    return `data:image/svg+xml;base64,${readFileSync(join(process.cwd(), 'public', 'brand', 'mislamic-mark.svg')).toString('base64')}`
  } catch {
    return ''
  }
})()

/**
 * Картинка поста Instagram «Скидка» / «Новинка» — в оформлении smarket.kg (DESIGN.md):
 * белый холст, облачная зона под фото, Manrope, графитовый текст, лимон — только знак
 * и метка скидки. Пост — 1080 × 1350 (4:5, самый крупный кадр ленты), история — 1080 × 1920:
 * у неё сверху и снизу поля под ник и строку «Ответить» Instagram, их ничего не закрывает.
 *
 * Только разметка и проверка данных; рисует и переводит в JPEG маршрут
 * src/app/api/instagram/post-image/route.tsx (его зовёт сервер SBonus, shop_ig_post.py).
 */

export type PostFormat = 'post' | 'story'

/** Размер кадра и поля: у истории Instagram кладёт поверх ник (сверху) и «Ответить» (снизу). */
export const FORMATS: Record<PostFormat, { w: number; h: number; pad: string; photoH: number }> = {
  post: { w: 1080, h: 1350, pad: '52px 64px 56px', photoH: 700 },
  story: { w: 1080, h: 1920, pad: '230px 64px 270px', photoH: 760 },
}

/** Метка на картинке — по меткам товара в 1С («Товар дня», «Скидка», «Хит», «Специально для вас», «Новинка»). */
export type PostKind = 'sale' | 'new' | 'deal' | 'hit' | 'foryou' | 'plain'
export const POST_KINDS: readonly PostKind[] = ['sale', 'new', 'deal', 'hit', 'foryou', 'plain']

export type PostData = {
  format: PostFormat
  kind: PostKind
  name: string
  price: number
  oldPrice: number
  /** фото товара как data: URI (маршрут сам скачивает его с сервера) */
  photo: string | null
  /** размер фото в пикселях — чтобы вписать в рамку без искажений */
  photoW: number
  photoH: number
  /** фон самого фото (по его углам): белое фото — белая рамка, иначе на облачном фоне виден белый прямоугольник */
  photoBg: string | null
  /** история Instagram: внизу «ответьте — пришлём ссылку» (ссылку-стикер Instagram через программу не даёт) */
  cta?: boolean
}

/** Цвета из DESIGN.md (frontmatter colors) и знак из Brand.tsx. */
const C = {
  ink: '#263244',
  soft: '#4b5b70',
  muted: '#5d6d7e',
  cloud: '#f7f9fc',
  ice: '#eaf3ff',
  cobalt: '#1d4ed8',
  lemon: '#eaf500',
  mist: '#e3e8ee',
  success: '#1e9e5a',
  mark: '#fef102',
  mbank: '#fedd2e',
  sale: '#d33b2e',
}

type Badge = { text: string; bg: string; fg: string }
const BADGES: Partial<Record<PostKind, (pct: number) => Badge>> = {
  // красная, как скидка на сайте (--color-danger), — владелец 06.10: «Скидка ёзув қизилда бўлсин»
  sale: (pct) => ({ text: pct > 0 ? `СКИДКА −${pct}%` : 'СКИДКА', bg: C.sale, fg: '#ffffff' }),
  deal: (pct) => ({ text: pct > 0 ? `ТОВАР ДНЯ −${pct}%` : 'ТОВАР ДНЯ', bg: C.lemon, fg: C.ink }),
  hit: () => ({ text: 'ХИТ ПРОДАЖ', bg: C.ice, fg: C.cobalt }),
  foryou: () => ({ text: 'СПЕЦИАЛЬНО ДЛЯ ВАС', bg: C.ice, fg: C.cobalt }),
  new: () => ({ text: 'НОВИНКА', bg: C.ice, fg: C.cobalt }),
}

/** Откуда можно брать фото товара: только наш сервер и сайт — чужой адрес не скачиваем. */
export const PHOTO_HOSTS = new Set(['api.smartcentr.store', 'smarket.kg'])

export function photoAllowed(url: string): boolean {
  try {
    const u = new URL(url)
    return u.protocol === 'https:' && PHOTO_HOSTS.has(u.hostname)
  } catch {
    return false
  }
}

/** Скидка в процентах — как её считает покупатель: от старой цены, вниз до целого. */
export function discountPct(price: number, oldPrice: number): number {
  if (!(price > 0) || !(oldPrice > price)) return 0
  // Целые числа до деления: (20000 − 14200) / 20000 × 100 в дробях даёт 28,999… → «28», а подпись поста — «29».
  return Math.floor(((oldPrice - price) * 100) / oldPrice)
}

/** Название без звёздочек 1С и лишних пробелов; длинное — обрезаем по слову, чтобы влезло в три строки. */
export function postName(name: string, max = 86): string {
  const clean = name.replace(/\*+/g, '').replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  const cut = clean.slice(0, max)
  const space = cut.lastIndexOf(' ')
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`
}

/** Крупнее короткое название, мельче длинное: цена и фото не должны съезжать. */
function nameSize(name: string): number {
  if (name.length <= 34) return 60
  if (name.length <= 60) return 52
  return 46
}

/** Вписать фото в рамку w × h с сохранением пропорций. */
export function fitBox(pw: number, ph: number, w: number, h: number): { w: number; h: number } {
  if (!(pw > 0) || !(ph > 0)) return { w, h }
  const k = Math.min(w / pw, h / ph)
  return { w: Math.round(pw * k), h: Math.round(ph * k) }
}

const PHOTO_W = 952
// Сверху и снизу поле больше: в углу метка «Скидка», фото под неё не заходит.
const PAD_X = 56
const PAD_Y = 92

export function PostCard({ data }: { data: PostData }) {
  const name = postName(data.name)
  const pct = discountPct(data.price, data.oldPrice)
  // Старая цена из 1С — честный факт при любой метке: «Хит» со скидкой показывает и её.
  const showOld = data.oldPrice > data.price
  const frame = FORMATS[data.format]
  // У истории ещё плашка «Жооп жазыңыз»: с плашкой рассрочки фото ниже на 120 — иначе название уходит под цену.
  const photoH = frame.photoH - (data.format === 'story' && adalMonthly(data.price) ? 120 : 0)
  const img = fitBox(data.photoW, data.photoH, PHOTO_W - PAD_X * 2, photoH - PAD_Y * 2)
  // Лимон — только скидка и «Товар дня» (выгода), остальные метки — ледяные, как выбранный язык на сайте.
  const badge = BADGES[data.kind]?.(pct) ?? null

  return (
    <div
      style={{
        width: frame.w,
        height: frame.h,
        display: 'flex',
        flexDirection: 'column',
        background: '#ffffff',
        padding: frame.pad,
        fontFamily: 'Manrope',
        color: C.ink,
      }}
    >
      {/* Шапка как на сайте: знак S + «Смарт Центр», справа адрес сайта. */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <svg width={42} height={75} viewBox="0 0 55.96 100">
            <path fill={C.mark} d={MARK} />
          </svg>
          <div style={{ marginLeft: 16, fontSize: 40, fontWeight: 800, letterSpacing: '-0.035em' }}>Смарт Центр</div>
        </div>
        <div style={{ fontSize: 30, fontWeight: 600, color: C.soft }}>smarket.kg</div>
      </div>

      {/* Фото на облачной поверхности (карточка товара сайта), метка — в углу. */}
      <div
        style={{
          marginTop: 36,
          width: PHOTO_W,
          height: photoH,
          // Длинное название (три строки) не помещается — уступает фото, а не название: оно уходило под цену.
          flexShrink: 1,
          minHeight: photoH - 160,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          background: data.photo && data.photoBg ? data.photoBg : C.cloud,
          border: `2px solid ${C.mist}`,
          borderRadius: 32,
        }}
      >
        {data.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={data.photo} width={img.w} height={img.h} alt="" style={{ width: img.w, height: img.h }} />
        ) : (
          <svg width={160} height={286} viewBox="0 0 55.96 100">
            <path fill={C.mist} d={MARK} />
          </svg>
        )}
        {badge ? (
          <div
            style={{
              position: 'absolute',
              top: 28,
              left: 28,
              display: 'flex',
              padding: '14px 26px',
              borderRadius: 16,
              background: badge.bg,
              color: badge.fg,
              fontSize: 34,
              fontWeight: 800,
              letterSpacing: '0.01em',
            }}
          >
            {badge.text}
          </div>
        ) : null}
      </div>

      {/* Название и цена — главное после фото, их не мельчим (The Compact Commerce Rule). */}
      <div
        style={{
          marginTop: 34,
          display: 'flex',
          fontSize: nameSize(name),
          fontWeight: 800,
          lineHeight: 1.14,
          letterSpacing: '-0.025em',
          maxHeight: nameSize(name) * 1.14 * 3,
          flexShrink: 0,
          overflow: 'hidden',
        }}
      >
        {name}
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', marginTop: 'auto' }}>
        <div style={{ fontSize: 88, fontWeight: 800, letterSpacing: '-0.045em', lineHeight: 1 }}>{formatSom(data.price)}</div>
        {showOld ? (
          <div
            style={{
              marginLeft: 28,
              fontSize: 44,
              fontWeight: 600,
              color: C.muted,
              textDecoration: 'line-through',
              lineHeight: 1,
            }}
          >
            {formatSom(data.oldPrice)}
          </div>
        ) : null}
      </div>

      {/* Рассрочка — как плашка на странице товара (владелец 06.10: «шунака стильда чиқсин», «русс тилида болсин»): светло-жёлтая
          карточка, знак MIslamic в белом круге, «Айына 5 975 сом × 4 ай» и подпись. Только в лимите «Адал»
          (2 000–40 000, src/lib/installment.ts); дороже — плашки нет. */}
      {adalMonthly(data.price) ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            alignSelf: 'flex-start',
            marginTop: 22,
            padding: '16px 26px 16px 16px',
            borderRadius: 22,
            background: '#fffbea',
            border: '2px solid #f3e3a6',
          }}
        >
          {MIS_MARK ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 72,
                height: 72,
                marginRight: 20,
                borderRadius: 36,
                background: '#ffffff',
                border: '2px solid #f3e3a6',
              }}
            >
              <img src={MIS_MARK} width={34} height={37} alt="" />
            </div>
          ) : null}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 38, fontWeight: 800, color: C.ink, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              {`${formatSom(adalMonthly(data.price)!)} в месяц × ${INSTALLMENT.adal.months} месяца`}
            </div>
            <div style={{ marginTop: 6, fontSize: 26, fontWeight: 600, color: C.muted, lineHeight: 1.2 }}>
              «Адал рассрочка» MIslamic — без процентов и переплаты
            </div>
          </div>
        </div>
      ) : null}

      {/* Подвал: наличие (зелёный — только настоящий статус) и куда писать. */}
      <div
        style={{
          marginTop: 30,
          paddingTop: 26,
          borderTop: `2px solid ${C.mist}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 30,
          fontWeight: 600,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', color: C.success }}>
          <div style={{ width: 16, height: 16, borderRadius: 8, background: C.success, marginRight: 14 }} />
          В наличии · Бар
        </div>
        <div style={{ display: 'flex', color: C.soft }}>Direct · WhatsApp {phones[0].display}</div>
      </div>

      {/* История: переход на сайт — через ответ. Робот на ответ присылает фото и ссылку на товар.
          Лимон — это главное действие кадра (The Lemon Signal Rule), стрелка — к строке «Ответить» Instagram. */}
      {data.format === 'story' && data.cta ? (
        <div
          style={{
            marginTop: 40,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '26px 34px',
            borderRadius: 24,
            background: C.lemon,
            color: C.ink,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 38, fontWeight: 800, letterSpacing: '-0.02em' }}>Жооп жазыңыз — шилтеме жиберебиз</div>
            <div style={{ fontSize: 28, fontWeight: 600, marginTop: 6 }}>Ответьте — пришлём ссылку на сайт</div>
          </div>
          <svg width={56} height={56} viewBox="0 0 24 24">
            <path d="M12 4v14M5 12l7 7 7-7" stroke={C.ink} strokeWidth={2.6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      ) : null}
    </div>
  )
}

export type CoverData = {
  /** сколько товаров в карусели после обложки */
  count: number
  /** самая большая скидка среди них, % (0 — не писать) */
  maxPct: number
  /** «04.10 – 10.10» — неделя, за которую скидки */
  week: string
}

/**
 * Обложка карусели «Скидки недели» (первая картинка поста): тот же холст и шапка, что у карточек товара,
 * крупный заголовок по-кыргызски и по-русски и «листайте →» — дальше идут карточки товаров.
 */
export function CoverCard({ data }: { data: CoverData }) {
  const frame = FORMATS.post
  return (
    <div
      style={{
        width: frame.w,
        height: frame.h,
        display: 'flex',
        flexDirection: 'column',
        background: '#ffffff',
        padding: frame.pad,
        fontFamily: 'Manrope',
        color: C.ink,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <svg width={42} height={75} viewBox="0 0 55.96 100">
            <path fill={C.mark} d={MARK} />
          </svg>
          <div style={{ marginLeft: 16, fontSize: 40, fontWeight: 800, letterSpacing: '-0.035em' }}>Смарт Центр</div>
        </div>
        <div style={{ fontSize: 30, fontWeight: 600, color: C.soft }}>smarket.kg</div>
      </div>

      <div
        style={{
          marginTop: 36,
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '0 64px',
          background: C.cloud,
          border: `2px solid ${C.mist}`,
          borderRadius: 32,
        }}
      >
        <div style={{ display: 'flex' }}>
          <div style={{ display: 'flex', padding: '14px 26px', borderRadius: 16, background: C.lemon, fontSize: 34, fontWeight: 800 }}>
            {data.maxPct > 0 ? `−${data.maxPct}% ЧЕЙИН · ДО −${data.maxPct}%` : 'СКИДКИ'}
          </div>
        </div>
        <div style={{ marginTop: 40, fontSize: 96, fontWeight: 800, lineHeight: 1.02, letterSpacing: '-0.045em' }}>Аптанын арзандатуулары</div>
        <div style={{ marginTop: 22, fontSize: 52, fontWeight: 800, color: C.soft, letterSpacing: '-0.025em' }}>Скидки недели</div>
        <div style={{ marginTop: 40, fontSize: 34, fontWeight: 600, color: C.muted }}>{data.week}</div>
      </div>

      <div
        style={{
          marginTop: 30,
          paddingTop: 26,
          borderTop: `2px solid ${C.mist}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 30,
          fontWeight: 600,
        }}
      >
        <div style={{ display: 'flex', color: C.soft }}>{`${data.count} товар · Direct · WhatsApp ${phones[0].display}`}</div>
        <div style={{ display: 'flex', alignItems: 'center', fontWeight: 800, color: C.ink }}>
          Жылдырыңыз
          <svg width={40} height={40} viewBox="0 0 24 24" style={{ marginLeft: 10 }}>
            <path d="M4 12h14M12 5l7 7-7 7" stroke={C.ink} strokeWidth={2.6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
    </div>
  )
}

let fonts: Promise<{ name: string; data: Buffer; weight: 600 | 800; style: 'normal' }[]> | null = null

/** Manrope 600 и 800 — статичные срезы manrope-variable.ttf: переменный шрифт Satori рисует самым тонким. */
export function postFonts() {
  fonts ??= Promise.all(
    ([600, 800] as const).map(async (weight) => ({
      name: 'Manrope',
      data: await readFile(join(process.cwd(), 'public', 'fonts', `manrope-${weight}.ttf`)),
      weight,
      style: 'normal' as const,
    })),
  ).catch((error) => {
    // Не прочитали — не запоминаем отказ навсегда: следующий запрос попробует снова.
    fonts = null
    throw error
  })
  return fonts
}
