'use client'

import Link from 'next/link'
import { Fragment, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyEvent } from 'react'
import { phones, telHref, whatsappHref } from '@/data/contacts'
import { useCart } from '@/lib/cart/CartProvider'
import { formatSom } from '@/lib/format'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { inNativeApp } from '@/lib/native/bonusCard'
import { checkProject, droppedName, droppedNotice, TRIANGLE, type Check } from '@/lib/kitchen/checks'
import {
  findColors,
  FRONT_COLORS,
  FRONT_MATERIALS,
  frontColor,
  frontLabel as colorLabel,
  HANDLE_METALS,
  HANDLES,
  SPLASH_GROUPS,
  splashChoice,
  SPLASHES,
  TOP_MATERIALS,
  topChoice,
  TOPS,
  type FrontColor,
  type FrontMaterial,
  type SplashGroup,
  type TopMaterial,
} from '@/lib/kitchen/finishes'
import { DECOR_BRANDS, DECORS, type DecorBrand } from '@/lib/kitchen/decors'
import { parseRal, RAL } from '@/lib/kitchen/ral'
import { BASE_FRONTS, baseKey, OVER_FRIDGE_FRONTS, parseSceneKey, UPPER_FRONTS, upperKey } from '@/lib/kitchen/fronts'
import {
  canChangeWall,
  CEILING,
  COLUMN_HEIGHT,
  companions,
  FREE_CORNER,
  FREE_UPPER,
  freeCorners,
  freeCornerW,
  hobMinWidth,
  itemPositions,
  LIMITS,
  minA,
  moduleCenter,
  needByWall,
  detachUppers,
  addAt,
  narrowFor,
  narrowNeighbour,
  placeAt,
  type AddKind,
  resizeWalls,
  squeezeGaps,
  type Fit,
  addWidth,
  moveToWall,
  nextWallId,
  moveItem,
  nextWall,
  islandTurnOf,
  pinCabinet,
  pinnedIds,
  pinWalls,
  planKitchen,
  type Planner,
  resolveArrangement,
  stepItem,
  upperBottomOf,
  WIDTH_LIMITS,
  WINDOW_LIMITS,
  wallOf,
  wallsOf,
  type ItemPlace,
  type Module,
  type Plan,
  type RunId,
  type Run,
  type Narrow,
} from '@/lib/kitchen/layout'
import { nudgeMove, previewMove, type Preview } from '@/lib/kitchen/drag'
import { PlanView, type PlanTarget } from './PlanView'
import { pickInto, plusTarget, resetForShape } from './planGeom'
import { cartAdditions, chosenItems, CORE_SLOTS, frontsText, planInputOf, projectItems, projectTotal, wallsText, whatsappText, type ItemStatus } from '@/lib/kitchen/order'
import { DEFAULT_STATE, loadLast, queryFromState, saveLast, stateFromQuery } from '@/lib/kitchen/share'
import {
  carryCornerFronts,
  emptyRoom,
  freeAdd,
  freeAddUpper,
  freeCorner,
  freeFill,
  freeMoveUpper,
  freePlaceUpper,
  freeReflow,
  freeRemove,
  freeRemoveUpper,
  freeResizeUpper,
  freeUpperAt,
  freeUppersOverLower,
  leaveRoom,
  lowerGaps,
  reshapeRoom,
  roomFromKitchen,
  type FreeAdd,
} from '@/lib/kitchen/free'
import { cutList, extraList, frontList, hardware, modulesOf, topList, type SpecData } from '@/lib/kitchen/spec'
import { cutParts, edgeTotals, nest, type CutLook, type NestOpts, type NestResult } from '@/lib/kitchen/cutting'
import { emptyMaster, estimate, estimateLines, loadMaster, saveMaster, type MasterData } from '@/lib/kitchen/master'
import { carouselStyles, shortList, FLOORS, getStyle, getTone, STYLE_GROUPS, STYLES, WALL_COLORS, type KitchenStyle } from '@/lib/kitchen/styles'
import type { HandleKind } from '@/lib/kitchen/styles'
import {
  DINING_SEATS,
  isCabinet,
  isGap,
  isUpperCab,
  SIZED_ITEMS,
  SLOTS,
  type ApplianceInfo,
  type BaseFront,
  type CabinetId,
  type ColumnItem,
  type FixedItem,
  type FreeWall,
  type FrontVariant,
  type ItemKey,
  type KitchenAppliance,
  type KitchenState,
  type Shape,
  type SizedItem,
  type SlotKind,
  type WallId,
} from '@/lib/kitchen/types'
import { TALL_BASE, tallMin, WINDOW } from '@/lib/kitchen/dims'
import { DRAWING_CSS, elevationSvg, islandOverhang, makerList, PLAN_BOX, pickScale, planSvg, techRows, windowFor, type DrawingLabels } from './drawing'
import { PlanSketch } from './PlanSketch'
import { kitchenTexts, type KitchenTexts } from './texts'
import type { CutMap } from './pdfSheet'
import { parseVariants, type Variant } from '@/lib/kitchen/variants'
import { keepOnLink, openQuery } from './ready'
import { PublishLoader } from './PublishLoader'
import { ApplianceSheet } from './ApplianceSheet'
import { ReadyStrip } from './ReadyStrip'
import { FreePalette, type FreeTile } from './FreePalette'
import type { BuildInput, CabInfo, Dims } from './three/build'
import type { DragPhase, EngineEvents, KitchenEngine, PhotoState, Pick, View } from './three/engine'
import type { TierName } from './three/quality'
import type { Photo } from './three/photo'
import './kitchen.css'

/** Верх стены не закрепляем: для него «уже закреплены» все стены (P1, pinnedOn). */
const NO_PIN: WallId[] = ['A', 'B', 'C', 'I']

/** Четыре шага (спецификация §6): «Кухня» = форма + размер, «Техника», «Стиль» = стили + цвет + отделка, «Итог» = проверка, сумма, корзина, мастер, варианты. */
type Step = 'kitchen' | 'tech' | 'style' | 'total'
const STEPS: Step[] = ['kitchen', 'tech', 'style', 'total']
const SHAPES: Shape[] = ['straight', 'corner', 'u', 'island']
/** Слоты, которые можно выключить («Не нужно»); без остальных кухня не кухня. */
const OPTIONAL: SlotKind[] = SLOTS.filter((s) => !CORE_SLOTS.includes(s))

type Items = Partial<Record<SlotKind, KitchenAppliance | null>>

/** Какой товар стоит за переставляемым предметом (у мойки товара нет). */
const SLOT_OF: Record<ItemKey, SlotKind | null> = {
  fridge: 'fridge',
  tall: 'microwave',
  sink: null,
  dishwasher: 'dishwasher',
  washer: 'washer',
  hob: 'hob',
  pantry: null,
  pantry2: null,
  oven: 'oven',
}

/** Пустая комната: порядок — только поставленное, по стенам формы. */
function freeOrder(shape: Shape, arrangement: KitchenState['arrangement']): Record<WallId, ItemKey[]> {
  const out: Record<WallId, ItemKey[]> = { A: [], B: [], C: [], I: [] }
  for (const w of wallsOf(shape)) out[w] = [...(arrangement?.[w] ?? [])]
  return out
}

/** «Поставить» у техники, которой нет на стене: какой предмет ставить. */
const PLACE_KEY: Partial<Record<SlotKind, FixedItem>> = { fridge: 'fridge', dishwasher: 'dishwasher', washer: 'washer', hob: 'hob', hood: 'hob', oven: 'oven', microwave: 'tall' }

/** Что сейчас переставляют: предмет (техника, мойка, свой шкаф) или обычный шкаф. */
/** Подсказку по жестам видели: она показывается до первого удачного перемещения, снова — по «?». */
const HINT_SEEN = 'kp-hint-seen'
/** Сколько подсказка жестов стоит над 3D (владелец 09.10: закрывала низ кухни). Последние 0,4 с — тает (kitchen.css). */
const HINT_MS = 6000

type MoveSel = { key: ItemKey } | { cab: CabInfo; w: number; wall: WallId; center: number }

/** Меню «+» на сцене: куда ставить (пустое место или точка ряда), где показать (px от угла сцены); failed — не поместилось, предлагаем сузить соседей или другую стену. */
/** Пункты меню «+» по порядку; `tech` — шаг «Техника». */
const ADD_ITEMS = ['doors', 'drawers', 'pantry', 'tech', 'strip', 'fill'] as const
type AddItem = (typeof ADD_ITEMS)[number]
/** Меню «+»: `widths` — что встанет в каждом пункте, см (P1); `gapW` — ширина проёма-цели; `need` — нехватка неудачной постановки. */
type AddMenu = { target: PlanTarget; x: number; y: number; failed?: AddKind; narrow?: Narrow | null; need?: number; widths?: Partial<Record<AddItem, number | null>>; gapW?: number }
/** Ширина ≥ 1220 px: план — колонка слева от 3D, обе живые; уже — переключатель «3D · План». */
const PLAN_COL = '(min-width: 1220px) and (min-height: 521px)'

/** Шаг кнопок «левее / правее», см. */
const NUDGE = 5
/** Шкафы, которые раскладка ставит сама: им можно дать свою ширину. */
const FLEX: Module['kind'][] = ['doors', 'drawers', 'bottle', 'filler']

/** Всё, что нужно раскладке, из выбора покупателя. */
/** Верхний шкаф над предметом — чтобы после смены ширины карточка осталась на нём. */
function upperOver(plan: Plan, key: ItemKey): string | null {
  for (const run of plan.runs) {
    const m = run.modules.find((mod) => mod.item === key)
    if (!m) continue
    const mid = m.x + m.w / 2
    const u = run.uppers.find((up) => up.x <= mid && up.x + up.w >= mid)
    return u ? upperKey(run.id, u.x) : null
  }
  return null
}

const nonEmpty = <T extends object>(o: T): T | undefined => (Object.keys(o).length ? o : undefined)

/** three.js с версии r163 рисует только через WebGL 2 — старый WebGL 1 ему не годится. */
function hasWebGL2(): boolean {
  try {
    return Boolean(document.createElement('canvas').getContext('webgl2'))
  } catch {
    return false
  }
}

/** Почему 3D не поднялось: у каждой причины своя подсказка и свой код на экране. */
type Fail3d = 'no-webgl2' | 'load' | 'start'

/**
 * Эта же страница в Chrome — из встроенного браузера Telegram, Instagram и
 * других программ на Android. Там 3D часто выключено, а Chrome есть почти у всех.
 */
function chromeIntent(): string | null {
  if (!/Android/i.test(navigator.userAgent)) return null
  const { host, pathname, search } = window.location
  return `intent://${host}${pathname}${search}#Intent;scheme=https;package=com.android.chrome;end`
}

/** Кнопка во всплывающей строке: ссылка (WhatsApp) или действие («Отправить»). */
type ToastAct = { label: string; href?: string; run?: () => void }

/** Сразу, если страница на экране; иначе — когда человек к ней вернётся. */
function whenVisible(run: () => void) {
  if (!document.hidden) return run()
  const onShow = () => {
    if (document.hidden) return
    document.removeEventListener('visibilitychange', onShow)
    run()
  }
  document.addEventListener('visibilitychange', onShow)
}

/**
 * Встроенный браузер Instagram, Facebook, TikTok, Telegram и других программ
 * (на Android — «; wv)»): файлы там часто молча не скачиваются.
 */
function inAppBrowser(): boolean {
  return /FBAN|FBAV|FB_IAB|Instagram|Line\/|Snapchat|TikTok|musical_ly|Bytedance|Telegram|; wv\)/i.test(navigator.userAgent)
}

/**
 * Файл — в окно «Поделиться» телефона (WhatsApp, Telegram, почта, «Файлы»).
 * ok — отправили или человек сам закрыл окно; late — браузер не открыл окно
 * без нового нажатия; no — этот браузер файлами делиться не умеет.
 */
async function shareFile(file: File, text: string, title: string): Promise<'ok' | 'late' | 'no'> {
  const data: ShareData = text ? { files: [file], title, text } : { files: [file], title }
  try {
    if (!navigator.canShare?.(data)) return 'no'
    await navigator.share(data)
    return 'ok'
  } catch (e) {
    // DOMException в старых Safari — не Error, поэтому смотрим просто на имя
    const name = (e as { name?: string } | null)?.name ?? ''
    if (name === 'AbortError') return 'ok'
    if (name === 'NotAllowedError') return 'late'
    return 'no'
  }
}

/**
 * Телефон «стопкой»: 3D прилипает сверху, под ним вкладки шагов, итог внизу.
 * Тот же запрос — в kitchen.css. Телефон боком (невысокий экран) собирается
 * как компьютер: 3D слева, панель справа.
 */
const STACKED = '(max-width: 900px) and (min-height: 521px)'
const isStacked = () => window.matchMedia(STACKED).matches
/** Полный экран на компьютере: открыта ли панель настроек справа ('0' — спрятали). */
const SIDE_KEY = 'kp-full-side'
const sidePanelSaved = () => {
  try {
    return window.localStorage.getItem(SIDE_KEY) !== '0'
  } catch {
    return true
  }
}

/**
 * Режим PRO — для мебельщика и мастера: чертежи стен, спецификация, раскрой,
 * смета, RAL и декоры. Покупатель их не видит, пока не включит; выбор помнит
 * браузер ('1' — включён). PDF для мастера доступен и без PRO.
 */
const PRO_KEY = 'kp-pro'
const proSaved = () => {
  try {
    return window.localStorage.getItem(PRO_KEY) === '1'
  } catch {
    return false
  }
}

/** Стили, видные сразу; остальные — по «Все стили». Выбранный показан всегда. */
const FEATURED_STYLES: KitchenStyle['id'][] = ['marble', 'hitech', 'minimal', 'scandi', 'modern', 'classic']
/** Превью стилей рисуются по очереди: сначала видные сразу. */
const THUMB_ORDER = [...STYLES.filter((s) => FEATURED_STYLES.includes(s.id)), ...STYLES.filter((s) => !FEATURED_STYLES.includes(s.id))]

/** «Для чего» красим фасады (вся кухня, низ, верх, остров). */
type PaintTarget = 'all' | 'lower' | 'upper' | 'island'
/** Цель → поле состояния. «Вся кухня» пишет в поле низа, а верх и остров снимает — они идут «как низ». */
const PAINT_FIELD = { all: 'facade', lower: 'facade', upper: 'upperFacade', island: 'islandFacade' } as const satisfies Record<
  PaintTarget,
  keyof KitchenState
>

/** Палитра RAL по первой цифре кода: 1 — жёлтые … 9 — белые и чёрные. Считается один раз, не на каждую отрисовку. */
const RAL_GROUPS = '123456789'.split('').map((digit) => {
  const items = RAL.filter((r) => r.code[0] === digit)
  return {
    digit,
    count: items.length,
    dot: items[Math.floor(items.length / 2)].hex,
    tiles: items.flatMap((r) => {
      const c = frontColor(`ral-${r.code}`)
      return c ? [{ c, code: r.code }] : []
    }),
  }
})

/**
 * Группы выбора (role=radio и role=tab) ходят стрелками, как обычные
 * радиокнопки: ←/→/↑/↓ — соседний вариант, Home/End — крайние. Выбор сразу
 * применяется, фокус переезжает на выбранное. Tab заходит в группу один раз.
 */
const GROUP_OF: Record<string, string> = { radio: 'radiogroup', tab: 'tablist' }
const CHECKED_OF: Record<string, string> = { radio: 'aria-checked', tab: 'aria-selected' }
function groupItems(group: Element, role: string): HTMLElement[] {
  return Array.from(group.querySelectorAll<HTMLElement>(`[role="${role}"]`)).filter(
    (el) => el.closest(`[role="${GROUP_OF[role]}"]`) === group && !(el as HTMLButtonElement).disabled,
  )
}
function groupKeys(e: ReactKeyEvent<HTMLElement>) {
  const el = e.target as HTMLElement
  const role = el.getAttribute('role') ?? ''
  if (!GROUP_OF[role] || e.altKey || e.ctrlKey || e.metaKey) return
  const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
  if (!step && e.key !== 'Home' && e.key !== 'End') return
  const group = el.closest(`[role="${GROUP_OF[role]}"]`)
  const items = group ? groupItems(group, role) : []
  const i = items.indexOf(el)
  if (i < 0 || items.length < 2) return
  // стрелка в группе — выбор варианта, а не сдвиг шкафа (обработчик окна)
  e.preventDefault()
  e.stopPropagation()
  const next = e.key === 'Home' ? items[0] : e.key === 'End' ? items[items.length - 1] : items[(i + step + items.length) % items.length]
  next.focus()
  if (next.getAttribute(CHECKED_OF[role]) !== 'true') next.click()
}
/** Остановка Tab в группе — выбранный вариант (или первый), остальные — стрелками. */
function roving(group: Element) {
  const role = group.getAttribute('role') === 'tablist' ? 'tab' : 'radio'
  const items = groupItems(group, role)
  const on = items.find((el) => el.getAttribute(CHECKED_OF[role]) === 'true') ?? items[0]
  for (const el of items) el.tabIndex = el === on ? 0 : -1
}
/** Невысокий экран — телефон боком: конструктор встаёт ровно в экран. Тот же запрос — в kitchen.css. */
const isShort = () => window.matchMedia('(max-height: 520px)').matches
const smooth = (): ScrollBehavior => (window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth')

export function KitchenPlanner({
  appliances,
  info,
  mode = 'client',
}: {
  appliances: KitchenAppliance[]
  info?: Record<string, ApplianceInfo>
  /** «master» — лист мастера (/kitchen/master): без шагов покупателя, с чертежами и раскроем */
  mode?: 'client' | 'master'
}) {
  const masterPage = mode === 'master'
  const { lang } = useI18n()
  const t = kitchenTexts(lang)
  const cart = useCart()

  const [state, setState] = useState<KitchenState>(DEFAULT_STATE)
  const [hydrated, setHydrated] = useState(false)
  const [step, setStep] = useState<Step>('kitchen')
  const [open, setOpen] = useState<SlotKind | null>(null)
  const [selected, setSelected] = useState<SlotKind | null>(null)
  /** что сейчас переставляют кнопками под 3D */
  const [moving, setMoving] = useState<MoveSel | null>(null)
  /** размеры того, что нажали */
  const [measure, setMeasure] = useState<Dims | null>(null)
  /** шкаф, которому выбирают фасады */
  const [editing, setEditing] = useState<CabInfo | null>(null)
  const [saving, setSaving] = useState(false)
  const [evening, setEvening] = useState(false)
  const [view, setView] = useState<View>('angle')
  /** сцена: 3D или план сверху (спецификация §4); на широком экране план — колонка рядом с 3D */
  const [scene, setScene] = useState<'3d' | 'plan'>('3d')
  const [planCol, setPlanCol] = useState(false)
  /** предпросмотр перемещения — общий для 3D и плана (из previewMove) */
  const [preview, setPreview] = useState<Preview | null>(null)
  const [add, setAdd] = useState<AddMenu | null>(null)
  /** камера 3D на исходном кадре всей кухни; увели — видна «Показать всё» (engine.onHome) */
  const [camHome, setCamHome] = useState(true)
  // меню «+» закрылось (поставили, не влезло, передумали) — план снова вписывает кухню целиком (P4, 7)
  const [planFit, setPlanFit] = useState(0)
  const hadAdd = useRef(false)
  useEffect(() => {
    if (add) hadAdd.current = true
    else if (hadAdd.current) {
      hadAdd.current = false
      setPlanFit((n) => n + 1)
    }
  }, [add])
  const addRef = useRef<HTMLDivElement>(null)
  /** «+» → «Технику»: куда поставить выбранную в шаге «Техника» модель; ушли с шага — забыто */
  const addTargetRef = useRef<PlanTarget | null>(null)
  // Ушли с «Техники» — камера с духовки (focus) обратно на всю кухню, рамка техники снята:
  // иначе смену стиля и цвета не видно (P2, 6).
  const stepWas = useRef(step)
  useEffect(() => {
    if (step !== 'tech') addTargetRef.current = null
    const was = stepWas.current
    stepWas.current = step
    if (was !== 'tech' || step === 'tech') return
    setSelected(null)
    engineRef.current?.reframe()
  }, [step])
  useEffect(() => {
    const mq = window.matchMedia(PLAN_COL)
    const on = () => setPlanCol(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  /** телефон стоя (STACKED): нижняя панель, лист выбранного ≤ 40svh, «Ещё параметры»; ценники в 3D по умолчанию выключены (R20i.4) */
  const [stacked, setStacked] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia(STACKED)
    const on = () => setStacked(mq.matches)
    on()
    if (mq.matches) setPrices(false)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  /** лист выбранного на телефоне: петли, высота, цвет над холодильником раскрыты */
  const [selMore, setSelMore] = useState(false)
  /** план на экране — только тогда предпросмотр перемещения идёт в состояние (иначе каждый pointermove перерисовывал бы планировщик) */
  const planShownRef = useRef(false)
  // меню «+» закрывается нажатием мимо него
  useEffect(() => {
    if (!add) return
    const onDown = (e: PointerEvent) => {
      if (!addRef.current?.contains(e.target as Node)) setAdd(null)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [add])
  const [prices, setPrices] = useState(true)
  const [full, setFull] = useState(false)
  // Полный экран: панель настроек. Телефон стоя — лист поверх 3D, вход в полный
  // экран всегда со спрятанным листом. Компьютер и телефон боком — панель справа
  // от 3D (сцена сужается), открыта или нет — как оставили (localStorage).
  const [fullPanel, setFullPanel] = useState(false)
  /** отделка: что красим (вся кухня, низ, верх, остров) и какой вид цвета открыт — материал, RAL или декоры */
  const [paintFor, setPaintFor] = useState<PaintTarget>('all')
  const [frontMat, setFrontMat] = useState<FrontMaterial>('laminate')
  // «Точный код (RAL / декор)»: раскрыт ли блок и какая вкладка в нём
  const [exact, setExact] = useState(false)
  const [exactKind, setExactKind] = useState<'ral' | 'decor'>('ral')
  // «Все стили» раскрыты; «Ещё N» у ручек / столешниц / фартуков
  const [allStyles, setAllStyles] = useState(false)
  const [moreOf, setMoreOf] = useState<{ handles?: boolean; tops?: boolean; splash?: boolean }>({})
  /** режим PRO (инструменты мастера: пустая комната, особые фасады, колонна tb=) — из браузера, после гидратации */
  const [pro, setPro] = useState(false)
  useEffect(() => setPro(proSaved()), [])
  const togglePro = (on: boolean) => {
    setPro(on)
    try {
      window.localStorage.setItem(PRO_KEY, on ? '1' : '0')
    } catch {
      // браузер не даёт хранить — PRO просто выключится в следующий раз
    }
  }
  const [decorBrand, setDecorBrand] = useState<DecorBrand>('egger')
  const [colorQuery, setColorQuery] = useState('')
  /** выдача поиска цвета — на компьютере докручиваем до неё, чтобы не пряталась под рядом «Дальше» */
  const foundRef = useRef<HTMLDivElement>(null)
  /** открытые группы RAL (первая цифра кода); пока не трогали — открыта группа выбранного цвета */
  const [ralOpen, setRalOpen] = useState<ReadonlySet<string>>()
  const [ofMat, setOfMat] = useState<FrontMaterial | null>(null)
  const [topMat, setTopMat] = useState<TopMaterial>('quartz')
  const [splashGroup, setSplashGroup] = useState<SplashGroup>('stone')
  /** столешницы и фартуки открытой вкладки — один фильтр на список и на счётчик «Ещё N» */
  const topsOfMat = useMemo(() => TOPS.filter((c) => c.material === topMat), [topMat])
  const splashesOfGroup = useMemo(() => SPLASHES.filter((c) => c.group === splashGroup), [splashGroup])
  /** lost — телефон несколько раз подряд забрал видеокарту: ждём нажатия «Запустить 3D снова» */
  const [engineState, setEngineState] = useState<'loading' | 'ready' | 'error' | 'lost'>('loading')
  const [built, setBuilt] = useState(false)
  const [spec, setSpec] = useState<SpecData | null>(null)
  /** фактическая высота низа вытяжки над панелью в 3D — для проверки проекта */
  const [hoodOver, setHoodOver] = useState<number | undefined>(undefined)
  const [photosVersion, setPhotosVersion] = useState(0)
  const [thumbs, setThumbs] = useState<Partial<Record<string, string>>>({})
  const [cartResult, setCartResult] = useState<{ ok: number; failed: number } | null>(null)
  /** всплывающая строка внизу; act — кнопка в ней («Отправить», «WhatsApp») */
  const [note, setNote] = useState<{ text: string; act?: ToastAct } | null>(null)
  const setToast = useCallback((text: string | null) => setNote(text ? { text } : null), [])
  /** ширины всех шкафов прямо в 3D */
  const [showDims, setShowDims] = useState(false)
  const [variants, setVariants] = useState<Variant[]>([])
  /** после «Сохранить вариант» — вопрос «Показать всем в галерее?» */
  const [askGallery, setAskGallery] = useState(false)
  /** открыта форма «В галерею» */
  const [publishing, setPublishing] = useState(false)
  const [, setHistTick] = useState(0)
  const [hint, setHint] = useState(true)
  useEffect(() => {
    try {
      if (localStorage.getItem(HINT_SEEN) === '1') setHint(false)
    } catch {
      // хранилище недоступно — подсказка покажется
    }
  }, [])
  const markHintSeen = () => {
    setHint(false)
    try {
      localStorage.setItem(HINT_SEEN, '1')
    } catch {
      // хранилище недоступно
    }
  }
  const [origin, setOrigin] = useState('')
  /** телефон: меню «ещё» с вечером, ценами, размерами и чёткостью */
  const [menu, setMenu] = useState(false)
  /** фото трассировкой лучей: null — обычное 3D */
  const [photo, setPhoto] = useState<PhotoState | null>(null)
  /** трассировка на этом устройстве не пошла: панель фото остаётся, «Сохранить фото» даёт обычную картинку 4K */
  const [photoFallback, setPhotoFallback] = useState(false)
  /** номер запуска 3D: после сброса видеокарты 3D создаётся заново */
  const [engineKey, setEngineKey] = useState(0)
  /** сколько раз 3D пришлось запускать заново, пока страница была на экране */
  const restarts = useRef(0)
  const [fail3d, setFail3d] = useState<Fail3d | null>(null)

  const rootRef = useRef<HTMLDivElement>(null)
  // в каждой группе выбора одна остановка Tab (см. groupKeys). Пересчёт — только
  // когда группа появилась, в ней сменились варианты или выбранный: перетаскивание,
  // ползунок и прогресс фото эти атрибуты не трогают и DOM не обходят.
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const GROUPS = '[role="radiogroup"], [role="tablist"]'
    root.querySelectorAll(GROUPS).forEach(roving)
    const mo = new MutationObserver((list) => {
      const touched = new Set<Element>()
      for (const m of list) {
        const g = (m.target as Element).closest?.(GROUPS)
        if (g) touched.add(g)
        for (const n of m.addedNodes) {
          if (!(n instanceof Element)) continue
          if (n.matches(GROUPS)) touched.add(n)
          n.querySelectorAll(GROUPS).forEach((x) => touched.add(x))
        }
      }
      touched.forEach(roving)
    })
    mo.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ['aria-checked', 'aria-selected', 'disabled'] })
    return () => mo.disconnect()
  }, [])
  // stageRef — весь прилипший блок (3D + полоса видов на телефоне);
  // hostRef — только та его часть, где рисует движок: он меряет свой размер
  // по этому элементу, и полоса под холстом не должна попадать в кадр.
  const stageRef = useRef<HTMLDivElement>(null)
  const hostRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLElement>(null)
  const stepsRef = useRef<HTMLElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const toolsRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const moreRef = useRef<HTMLButtonElement>(null)
  const engineRef = useRef<KitchenEngine | null>(null)
  const photos = useRef(new Map<string, Photo | null>())
  const autoView = useRef(false)
  const editingRef = useRef<CabInfo | null>(null)
  editingRef.current = editing
  const movingRef = useRef<MoveSel | null>(null)
  movingRef.current = moving
  const measureRef = useRef<Dims | null>(null)
  measureRef.current = measure
  /** ширину поменяли у верхнего шкафа — после перестройки найти его над этим предметом */
  const followRef = useRef<ItemKey | null>(null)
  /** после перестройки открыть дверцы этого шкафа (выбрали сторону открывания) */
  const openAfterRef = useRef<string | null>(null)
  /** «+» поставил шкаф — после перестройки выбрать его так же, как нажатием (одна карточка, P2, 8) */
  const pickAfterRef = useRef<ItemKey | null>(null)

  /* ───────── каталог ───────── */

  const bySlot = useMemo(() => {
    const out = {} as Record<SlotKind, KitchenAppliance[]>
    for (const slot of SLOTS) out[slot] = appliances.filter((a) => a.slot === slot)
    return out
  }, [appliances])
  const byId = useMemo(() => new Map(appliances.map((a) => [a.id, a])), [appliances])

  const style = getStyle(state.style)
  const tone = getTone(style, state.tone)
  const ceiling = state.ceiling ?? CEILING.base

  const chosen: Items = useMemo(() => chosenItems(state.picks, appliances), [state.picks, appliances])

  // preview — для карточки стиля: с тем, с чем стиль задуман (колонны, духовка наверху)
  const planFor = useCallback(
    (s: KitchenStyle, preview = false): Plan =>
      planKitchen({ ...planInputOf(state, chosen, []), ...(preview ? s.layout : undefined) }, { shelves: s.shelves }),
    // только то, от чего зависит раскладка: смена отделки план не пересчитывает
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      state.shape,
      state.a,
      state.b,
      state.c,
      state.island,
      state.arrangement,
      state.tallOven,
      state.pantries,
      state.noWindow,
      state.windowW,
      state.fridgeOpen,
      state.ovenApart,
      state.cabinets,
      state.at,
      state.widths,
      state.free,
      state.dining,
      state.islandTurn,
      state.diningTurn,
      chosen,
    ],
  )
  const plan = useMemo(() => planFor(style), [planFor, style])
  // пустая комната: только то, что поставили сами (правила не добавляют мойку и плиту)
  const order = useMemo(
    () => (state.free ? freeOrder(state.shape, state.arrangement) : resolveArrangement(state.shape, state.arrangement, state.cabinets, state.gaps)),
    [state.shape, state.arrangement, state.cabinets, state.gaps, state.free],
  )
  const positions = useMemo(() => itemPositions(plan), [plan])

  /* пустая комната (PRO): выбранная стена и выбранный свой верхний шкаф — до карточки выбора */
  const walls = wallsOf(state.shape)
  const [freeWallPick, setFreeWall] = useState<WallId>('A')
  // стены больше нет (сменили форму) — снова A
  const freeWall: WallId = walls.includes(freeWallPick) ? freeWallPick : 'A'
  /** после перестройки показать размеры этого предмета (только что поставили с палитры) */
  const measureAfterRef = useRef<ItemKey | null>(null)

  /** Пустая комната: свой верхний шкаф по ключу из 3D («a120») — стена, номер в списке, ширина, середина. */
  const freeUpperOf = (key: string) => {
    if (!state.free) return null
    const run = plan.runs.find((r) => r.id === key[0].toUpperCase())
    const x = Number(key.slice(1))
    const u = run?.uppers.find((up) => Math.round(up.x) === x)
    if (!run || !u || run.id === 'I') return null
    const wall = run.id as FreeWall
    const index = freeUpperAt(state, wall, moduleCenter(run, u))
    const fu = state.free.uppers?.[wall]?.[index]
    return fu ? { wall, index, w: fu.w, c: fu.c } : null
  }
  /** Выбран угловой шкаф пустой комнаты: какой конец стены A. */
  const freeCornerSel = useMemo((): 'start' | 'end' | null => {
    if (!state.free || !editing?.corner) return null
    const run = plan.runs.find((r) => r.id === editing.key[0])
    const x = Number(editing.key.slice(1))
    const m = run?.modules.find((mod) => Math.round(mod.x) === x)
    return m?.kind === 'corner' ? (m.blindAt ?? null) : null
  }, [state.free, editing, plan])

  /** Выбран свой верхний шкаф (не над холодильником, не угловой, не вытяжка). */
  const freeUpper = useMemo(
    () => (editing?.row === 'upper' && !editing.fridge && !editing.column ? freeUpperOf(editing.key) : null),
    // freeUpperOf читает только state и plan
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state, plan, editing],
  )


  /** Состав проекта и деньги — только из order.ts: сумма, корзина, WhatsApp. */
  const project = useMemo(() => projectItems(state, plan, appliances), [state, plan, appliances])
  /**
   * Что стоит в 3D — по тому же составу: модель (и духовка под панелью),
   * undefined — типовая модель, null — в кухне нет (не нужно, нет в наличии,
   * не поместилось, отдельностоящая микроволновка на столешнице).
   */
  const items: Items = useMemo(() => {
    const out: Items = {}
    for (const slot of SLOTS) out[slot] = null
    for (const i of project) {
      if (i.status === 'placed' || i.status === 'underHob') out[i.slot] = i.appliance
      else if (i.status === 'typical') out[i.slot] = undefined
    }
    return out
  }, [project])
  const totals = projectTotal(project)
  const inProject = useMemo(() => project.flatMap((i) => (i.inTotal && i.appliance ? [i.appliance] : [])), [project])
  const missing = cartAdditions(project, cart.lines)

  /* ───────── адрес страницы ───────── */

  /** Сохранённая кухня ждёт ответа «Продолжить / Начать заново»; пока ждёт — не перезаписываем её. */
  const [resume, setResume] = useState<KitchenState | null>(null)
  /** кухня из автосохранения, которую ссылка заменила: положить в «Мои варианты» */
  const [linkKeep, setLinkKeep] = useState<KitchenState | null>(null)
  // адрес читается один раз на монтирование: новая identity `byId` (каталог
  // пришёл заново) не должна переигрывать stateFromQuery и тост keepOnLink (ревью C1)
  const linkRead = useRef(false)
  useEffect(() => {
    if (linkRead.current) return
    linkRead.current = true
    setOrigin(window.location.origin)
    const q = new URLSearchParams(window.location.search)
    const last = loadLast(byId)
    if (q.has('f')) {
      // по ссылке («Хочу такую же», «Поделиться») — своя несохранённая кухня уходит в «Мои варианты»
      const next = stateFromQuery(q, byId)
      setState(next)
      // лист мастера только показывает кухню и не пишет kp-last — своя кухня цела, плашка не нужна (P6)
      if (!masterPage && keepOnLink(last, next)) setLinkKeep(last)
    } else {
      // адрес с одной моделью (кнопка «Примерить в кухне» на карточке товара) —
      // ставим её в сохранённую кухню, а нет сохранённой — в кухню по умолчанию
      // без URLSearchParams.size: в Safari до 17 его нет, и модель терялась
      const picks = q.toString() !== '' ? stateFromQuery(q, byId).picks : {}
      const base = last ?? DEFAULT_STATE
      if (Object.keys(picks).length > 0) setState({ ...base, picks: { ...base.picks, ...picks } })
      else if (last) setResume(last)
    }
    setHydrated(true)
  }, [byId])

  // Адрес и автосохранение — с задержкой: ползунок размера не пишет на каждом шаге.
  // Пока видна плашка «Продолжить / Начать заново», прошлая кухня не перезаписывается.
  const pendingSave = useRef<KitchenState | null>(null)
  useEffect(() => {
    if (!hydrated) return
    pendingSave.current = resume ? null : state
    const timer = setTimeout(() => {
      window.history.replaceState(window.history.state, '', `${window.location.pathname}?${queryFromState(state)}`)
      pendingSave.current = null
      if (!resume && !masterPage) saveLast(state)
    }, 400)
    return () => clearTimeout(timer)
  }, [state, hydrated, resume])
  // Ушли со страницы раньше таймера — последняя правка всё равно сохраняется.
  // Адрес здесь не трогаем: при переходе внутри сайта он уже чужой.
  useEffect(() => {
    const flush = () => {
      const s = pendingSave.current
      pendingSave.current = null
      if (s) saveLast(s)
    }
    window.addEventListener('pagehide', flush)
    return () => {
      window.removeEventListener('pagehide', flush)
      flush()
    }
  }, [])

  const query = queryFromState(state)
  const shareUrl = `${origin}/${lang}/kitchen?${query}`

  // Шапка сайта уезжает при прокрутке вниз и возвращается при прокрутке вверх.
  // 3D на телефоне прилипает прямо под ней — поэтому следим за её высотой.
  // Мерить один раз мало: шапка приходит через Suspense, и в первый миг её
  // высота бывает нулевой (было: 3D уезжал под шапку, а кнопка «Добавить всё
  // в корзину» на компьютере — за нижний край экрана). Поэтому шапку ищем
  // заново при каждом измерении и перемеряем при прокрутке и смене размера.
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    let header: HTMLElement | null = null
    let last = ''
    let lastStage = ''
    let frame = 0
    const size = new ResizeObserver(() => update())
    const cls = new MutationObserver(() => update())
    // страница проявилась или выросла — шапка к этому времени уже на месте
    const page = new ResizeObserver(() => update())
    page.observe(document.body)
    const stageEl = root.querySelector('.kp-stage')
    if (stageEl) page.observe(stageEl)
    function update() {
      const found = document.querySelector<HTMLElement>('header.header')
      if (found !== header) {
        size.disconnect()
        cls.disconnect()
        header = found
        if (found) {
          size.observe(found)
          cls.observe(found, { attributes: true, attributeFilter: ['class'] })
        }
      }
      if (!header || !root) return
      const h = Math.round(header.getBoundingClientRect().height)
      // Телефон стоя: человек листает настройки под 3D — шапка сайта не
      // возвращается при каждом движении пальца вверх. Иначе она то
      // появлялась, то пряталась, и 3D с вкладками прыгали на её высоту.
      // Долистал выше конструктора или ниже него — шапка снова как везде.
      const work = root.querySelector('.kp-work')?.getBoundingClientRect()
      // Телефон боком — так же: конструктор занимает весь экран, и шапка
      // с меню сайта закрывали бы треть 3D (раньше поверх вставали кнопки).
      const pinned = Boolean(work && (isStacked() || isShort()) && work.top <= h + 2 && work.bottom > window.innerHeight * 0.6)
      document.documentElement.classList.toggle('kp-pinned', pinned)
      // Компьютер: пока низ конструктора (кнопка «Добавить всё в корзину») у
      // нижнего края экрана, кнопка консультанта стоит в углу 3D. Пролистали
      // ниже — возвращается в обычный угол, а не висит посреди страницы.
      const edge = window.innerHeight - 90
      document.documentElement.classList.toggle('kp-over', Boolean(work && work.top < edge && work.bottom > edge))
      // Телефон стоя: кнопка консультанта — в полосе видов под 3D, где бы сцена ни стояла
      // (под шапкой или у края экрана); иначе она ложилась на «+» плана (P4, 5)
      const stageBox = root.querySelector('.kp-stage')?.getBoundingClientRect()
      const sb = stageBox ? `${Math.round(stageBox.bottom)}px` : ''
      if (sb !== lastStage) {
        lastStage = sb
        if (sb) document.documentElement.style.setProperty('--kp-stage-bottom', sb)
        else document.documentElement.style.removeProperty('--kp-stage-bottom')
      }
      const top = header.classList.contains('is-hidden') ? 0 : h
      if (`${h}:${top}` === last) return
      last = `${h}:${top}`
      root.style.setProperty('--kp-header', `${h}px`)
      root.style.setProperty('--kp-top', `${top}px`)
    }
    const later = () => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        update()
      })
    }
    update()
    window.addEventListener('scroll', later, { passive: true })
    window.addEventListener('resize', later)
    window.addEventListener('load', later)
    return () => {
      size.disconnect()
      cls.disconnect()
      page.disconnect()
      cancelAnimationFrame(frame)
      document.documentElement.classList.remove('kp-pinned', 'kp-over')
      document.documentElement.style.removeProperty('--kp-stage-bottom')
      window.removeEventListener('scroll', later)
      window.removeEventListener('resize', later)
      window.removeEventListener('load', later)
    }
  }, [])

  // Строка инструментов над 3D на узком экране переносится во вторую строку —
  // карточка размеров встаёт под ней, а не поверх кнопок. Меряем до низа
  // кнопки «на весь экран»: она всегда в верхней строке, а сама панель
  // инструментов на невысоком экране растянута на всю сцену.
  useEffect(() => {
    const tools = toolsRef.current
    const stage = stageRef.current
    if (!tools || !stage) return
    const measureTools = () => {
      const last = tools.querySelector('.kp-tools__full') ?? tools
      const h = last.getBoundingClientRect().bottom - tools.getBoundingClientRect().top
      stage.style.setProperty('--kp-tools-h', `${Math.round(h)}px`)
    }
    const size = new ResizeObserver(measureTools)
    size.observe(tools)
    return () => size.disconnect()
  }, [engineState])

  // Меню «ещё» закрывается нажатием мимо него.
  useEffect(() => {
    if (!menu) return
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node
      if (menuRef.current?.contains(target) || moreRef.current?.contains(target)) return
      setMenu(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [menu])

  /* ───────── 3D ───────── */

  const pickRef = useRef<(pick: Pick) => void>(() => {})
  pickRef.current = ({ slot, item, dims, cab }) => {
    // пустая комната: палитра ставит на ту стену, где выбрали
    if (state.free) {
      const wall = item ? positions[item]?.wall : cab ? (cab.key[0].toUpperCase() as WallId) : undefined
      if (wall && walls.includes(wall)) setFreeWall(wall)
    }
    setSelected(slot)
    // угловой стоит в углу: его не двигают, у него выбирают фасады (и ширину в пустой комнате)
    setMoving(item ? { key: item } : cab?.row === 'base' && !cab.corner ? cabSel(cab) : null)
    setMeasure(dims)
    setEditing(cab)
    if (slot) {
      setStep('tech')
      setOpen(slot)
    }
  }
  /* ───────── перетаскивание: одна связка для 3D и плана (контракт onDrag в interfaces.md) ───────── */

  /** С чего начали тащить: ключ модели и состояние, где модуль уже можно ставить placeAt (автошкаф — уже свой kN, верх стены — уже ручной). */
  type DragBase = { key: ItemKey; state: KitchenState; plan: Plan; cab: CabInfo | null; walls: WallId[]; soft: ItemKey[] }
  const dragRef = useRef<DragBase | null>(null)
  /** подписи «до угла / до соседа» в движении, см — HTML-метки drag:left / drag:right */
  const [dragLabels, setDragLabels] = useState<{ left: number; right: number } | null>(null)

  /** Ключ сцены (sink, k1, A120, a120) → ключ модели и состояние на старте. Картинка от перевода не меняется. */
  const dragBaseFor = (raw: string): DragBase | null => {
    const start = dragStart(raw)
    return start && pinnedOn(start, positions[start.key]?.wall ?? itemPositions(start.plan)[start.key]?.wall)
  }

  /**
   * P1: автошкафы низа стены закрепляются (`pinWalls`) — соседи сохраняют вид и ширину,
   * меняются только пустые места. Стена откуда — на старте, стена куда — при первом заходе
   * на неё (предпросмотр и постановка считают по тому же плану). Верх не трогаем.
   */
  const pinnedOn = (d: DragBase, wall: WallId | undefined): DragBase => {
    if (!wall || d.walls.includes(wall)) return d
    const next = pinWalls(d.state, d.plan, [wall])
    // закреплённые автошкафы — мягкие: не помещается под пальцем — уступают (свои шкафы покупателя — «Сузить»)
    return next === d.state ? { ...d, walls: [...d.walls, wall] } : { ...d, state: next, plan: trial(next), walls: [...d.walls, wall], soft: [...d.soft, ...pinnedIds(d.state, next)] }
  }

  const dragStart = (raw: string): DragBase | null => {
    if (positions[raw as ItemKey]) return { key: raw as ItemKey, state, plan, cab: null, walls: positions[raw as ItemKey]?.row === 'upper' ? NO_PIN : [], soft: [] }
    const sk = parseSceneKey(raw)
    const run = sk && plan.runs.find((r) => r.id === sk.wall)
    if (!sk || !run) return null
    const x = sk.x
    const wall = run.id as WallId
    if (sk.row === 'base') {
      // автошкаф становится своим (kN) на том же месте
      const m = run.modules.find((mod) => Math.round(mod.x) === x)
      if (!m) return null
      const front: BaseFront = (state.fronts?.[raw] as BaseFront | undefined) ?? (m.kind === 'drawers' ? 'drawers3' : 'doors')
      const center = moduleCenter(run, m)
      const pinned = pinCabinet(order, state.cabinets ?? {}, { w: m.w, front }, wall, center, positions)
      const fronts = { ...state.fronts }
      delete fronts[raw]
      const next: KitchenState = { ...state, arrangement: pinned.order, cabinets: pinned.cabinets as KitchenState['cabinets'], fronts: nonEmpty(fronts), at: { ...frozen([]), [pinned.id]: center } }
      return { key: pinned.id, state: next, plan: trial(next), cab: { key: pinned.id, row: 'base', variant: front }, walls: [], soft: [] }
    }
    // верхний автошкаф: верх стены становится ручным (detachUppers), шкаф — uN с той же серединой
    const u = run.uppers.find((up) => Math.round(up.x) === x)
    if (!u) return null
    const next = detachUppers(state, wall, plan)
    const p = trial(next)
    const c = moduleCenter(run, u)
    const key = (Object.entries(itemPositions(p)) as [ItemKey, ItemPlace][]).find(([k, pl]) => isUpperCab(k) && pl.wall === wall && pl.row === 'upper' && Math.abs(pl.center - c) < 0.6)?.[0]
    return key ? { key, state: next, plan: p, cab: { key: raw, row: 'upper', variant: (state.fronts?.[raw] as CabInfo['variant'] | undefined) ?? 'doors' }, walls: NO_PIN, soft: [] } : null
  }

  /**
   * Сузить соседа на `by` см: свой шкаф, верхний, пустое место или предмет с шириной. Сосед
   * остаётся прижат к дальнему от `toward` (середина ставимого) краю — иначе сужение вокруг его
   * середины освободит только by/2 и «Сузить» не поставит модуль (C2, 24).
   */
  const narrowed = narrowNeighbour

  /** Модуль встал: состояние принято, выбор остаётся на нём (у верхнего ключ сцены — по новому началу в ряду). */
  const commitPlaced = (d: DragBase, next: KitchenState, fit: Fit, wall: WallId) => {
    replace(next)
    markHintSeen()
    if (fit.row === 'upper') {
      const u = trial(next).runs.find((r) => r.id === wall)?.uppers.find((up) => up.item === d.key)
      const cab: CabInfo = { key: u ? upperKey(wall, u.x) : d.key, row: 'upper', variant: d.cab?.variant ?? 'doors' }
      editingRef.current = cab
      setEditing(cab)
      setMoving(null)
      return
    }
    if (d.cab) {
      editingRef.current = d.cab
      setEditing(d.cab)
    }
    setMoving({ key: d.key })
  }

  /** Одна связка для 3D и плана: `from` — откуда жест; план считает снап ещё и к противоположному ряду (`opposite`). */
  const onDragRef = useRef<(phase: DragPhase, key: string, wall: WallId, cm: number, grab: number, from?: 'scene' | 'plan') => void>(() => {})
  /** вердикты пробного обмена на время жеста (P3): одна раскладка на соседа, а не на каждый шаг пальца */
  const swapMemoRef = useRef<{ d: DragBase | null; m: Map<string, boolean> }>({ d: null, m: new Map() })
  /** пустая комната: тащат свой верх (free.uppers) — какой и откуда */
  const freeDragRef = useRef<{ wall: FreeWall; index: number; w: number; c: number } | null>(null)
  /** пустая комната: тащат низ (технику или свой шкаф) — его ключ */
  const freeLowRef = useRef<ItemKey | null>(null)
  onDragRef.current = (phase, raw, wall, cm, grab, from = 'scene') => {
    const engine = engineRef.current
    // Пустая комната, свой верх: тот же жест, место — по правилу free.ts (ближайшее свободное на стене)
    const fu0 = state.free ? (phase === 'start' ? freeUpperOf(raw) : freeDragRef.current) : null
    if (fu0) {
      if (phase === 'start') {
        freeDragRef.current = { wall: fu0.wall, index: fu0.index, w: fu0.w, c: fu0.c }
        return
      }
      const fd = fu0
      const center = Math.round((cm - grab) * 2) / 2
      const res = wall === 'I' ? null : freePlaceUpper(state, plan, fd.wall, fd.index, wall as FreeWall, center, phase === 'end' ? (s) => trial(s) : undefined)
      const ok = res !== null && !('fail' in res)
      if (phase === 'move') {
        const c = ok ? (res.state.free?.uppers?.[wall as FreeWall]?.[res.index]?.c ?? center) : center
        // подписи в см: до соседнего верхнего шкафа или края стены
        const run = plan.runs.find((r) => r.id === wall)
        const others = (run?.uppers ?? []).map((u) => ({ c: moduleCenter(run!, u), w: u.w })).filter((u) => !(wall === fd.wall && Math.abs(u.c - fd.c) < 0.6))
        const l = c - fd.w / 2
        const r = c + fd.w / 2
        const left = Math.max(0, l - Math.max(0, ...others.filter((u) => u.c < c).map((u) => u.c + u.w / 2)))
        const right = Math.max(0, Math.min(run?.length ?? r, ...others.filter((u) => u.c > c).map((u) => u.c - u.w / 2)) - r)
        const pv: Preview = { center: c, width: fd.w, wall, fits: ok, snap: null, labels: { left, right }, narrow: null, need: 0 }
        engine?.setPreview(pv)
        if (planShownRef.current) setPreview(pv)
        setDragLabels((prev) => (prev && prev.left === left && prev.right === right ? prev : pv.labels))
        return
      }
      freeDragRef.current = null
      setDragLabels(null)
      setPreview(null)
      if (phase === 'cancel') return
      if (!ok) {
        engine?.revertDrag()
        setToast(res && 'fail' in res && res.fail === 'noRoom' ? t.free.noRoom(res.free) : t.noRoom)
        return
      }
      update(res.state)
      selectUpperAt(res.state, wall as FreeWall, res.state.free?.uppers?.[wall as FreeWall]?.[res.index]?.c)
      return
    }
    // Пустая комната, низ: путь free.ts (moveItem + at, раскладка freeReflow) — наш placeAt
    // с закреплёнными стенами тут отказывает («нет места» даже на пустой стене). Жест тот же.
    if (state.free) {
      if (phase === 'start') {
        freeLowRef.current = positions[raw as ItemKey] && positions[raw as ItemKey]?.row !== 'upper' ? (raw as ItemKey) : null
        return
      }
      const key = freeLowRef.current
      if (!key) return
      const pos = Math.round((cm - grab) * 2) / 2
      const patch: Partial<KitchenState> = { arrangement: moveItem(order, key, wall, pos, positions), at: { ...frozen([key]), [key]: pos } }
      if (phase === 'move') {
        const p = trial({ ...state, ...patch }, [key])
        const place = itemPositions(p)[key]
        const on = place && place.wall === wall ? place : null
        const c = on?.center ?? pos
        const w = on?.w ?? positions[key]?.w ?? 60
        const others = (Object.entries(itemPositions(p)) as [ItemKey, ItemPlace][]).filter(([k, q]) => k !== key && q.wall === wall && q.row !== 'upper')
        const runLen = p.runs.find((r) => r.id === wall)?.length ?? c + w / 2
        const left = Math.max(0, c - w / 2 - Math.max(0, ...others.filter(([, q]) => q.center < c).map(([, q]) => q.center + q.w / 2)))
        const right = Math.max(0, Math.min(runLen, ...others.filter(([, q]) => q.center > c).map(([, q]) => q.center - q.w / 2)) - (c + w / 2))
        const pv: Preview = { center: c, width: w, wall, fits: Boolean(on) && p.dropped.length <= plan.dropped.length, snap: null, labels: { left, right }, narrow: null, need: 0 }
        engine?.setPreview(pv)
        if (planShownRef.current) setPreview(pv)
        setDragLabels((prev) => (prev && prev.left === left && prev.right === right ? prev : pv.labels))
        return
      }
      freeLowRef.current = null
      setDragLabels(null)
      setPreview(null)
      if (phase === 'cancel') return
      if (apply(patch, [key])) setMoving({ key })
      else engine?.revertDrag()
      return
    }
    if (phase === 'start') {
      dragRef.current = dragBaseFor(raw)
      return
    }
    const d0 = dragRef.current
    if (!d0) return
    const d = phase === 'cancel' ? d0 : pinnedOn(d0, wall)
    if (d !== d0) dragRef.current = d
    if (phase === 'move') {
      // предпросмотр — из drag.previewMove; движок и план только рисуют
      if (swapMemoRef.current.d !== d) swapMemoRef.current = { d, m: new Map() }
      const pv = previewMove(d.plan, d.key, wall, cm, grab, { opposite: from === 'plan', soft: d.soft, trial: { state: d.state, planner: trial, memo: swapMemoRef.current.m } })
      engine?.setPreview(pv)
      if (planShownRef.current) setPreview(pv)
      setDragLabels((prev) => (!pv ? null : prev && prev.left === pv.labels.left && prev.right === pv.labels.right ? prev : pv.labels))
      return
    }
    dragRef.current = null
    setDragLabels(null)
    setPreview(null)
    if (phase === 'cancel') return
    const placed = placeAt(d.state, d.key, wall, cm, trial, grab, { soft: d.soft })
    if (placed.fit?.ok) {
      commitPlaced(d, placed.state, placed.fit, wall)
      return
    }
    // не встал: модуль обратно; кнопка «Сузить» — только если после сужения соседа модуль правда встаёт
    engine?.revertDrag()
    const narrow = narrowFor(d.plan, d.key, wall, cm - grab) ?? placed.fit?.narrow ?? null
    const narrowedState = narrow ? narrowed(d.state, narrow.neighbour, narrow.by, d.plan, cm - grab) : null
    const again = narrow && narrowedState ? placeAt(narrowedState, d.key, wall, cm, trial, grab, { soft: d.soft }) : null
    if (!narrow || !again?.fit?.ok) {
      setToast(t.noRoom)
      return
    }
    setNote({
      text: t.noRoomNarrow(nameOfKey(narrow.neighbour), narrow.by),
      act: { label: t.narrowAct, run: () => commitPlaced(d, again.state, again.fit!, wall) },
    })
  }

  /* ───────── план сверху: выбор общий с 3D, меню «+» ───────── */

  /** Ключ выбранного, как в сцене: его движок берёт под палец, план рисует кобальтом. */
  // лист мастера только показывает кухню: тянуть нечего (P2, 11)
  const grabKey = masterPage ? null : moving ? ('key' in moving ? moving.key : moving.cab.key) : editing?.row === 'upper' ? editing.key : null

  /** Нажали на плане — тот же выбор, что даёт 3D; размеры берём у движка, если он готов. */
  const pickFromPlan = (key: string | null) => {
    if (!key) return pickRef.current({ slot: null, item: null, dims: null, cab: null })
    const engine = engineRef.current
    const isItem = Boolean(positions[key as ItemKey])
    const byCab = engine?.measureCab(key) ?? null
    const byItem = !byCab && isItem ? (engine?.measureItem(key as ItemKey) ?? null) : null
    pickRef.current({ slot: isItem ? (SLOT_OF[key as ItemKey] ?? null) : null, item: isItem ? (key as ItemKey) : null, dims: byCab?.dims ?? byItem?.dims ?? null, cab: byCab?.cab ?? null })
  }

  /** Меню «+»: цель — пустое место или точка ряда; без цели (кнопка в углу) — справа от выбранного или середина стены A. */
  const openAdd = (target: PlanTarget | null, at: { x: number; y: number }) => {
    if (masterPage) return
    const r = stageRef.current?.getBoundingClientRect()
    const x = r ? Math.max(8, Math.min(at.x - r.left, r.width - 248)) : 8
    const y = r ? Math.max(8, Math.min(at.y - r.top, r.height - 300)) : 8
    // нижняя «+» без точки: виден проём со своим «+» — ведёт к нему (P1), иначе справа от выбранного / середина A
    const tg = target ?? plusTarget(plan, grabKey ? positions[grabKey as ItemKey] : null)
    const run = plan.runs.find((rr) => rr.id === tg.wall)
    const gapW = tg.gap ? run?.gaps?.find((g) => g.item === tg.gap)?.w : undefined
    const kinds = ADD_ITEMS.filter((k): k is Exclude<AddItem, 'tech'> => k !== 'tech' && (Boolean(tg.gap) || (k !== 'strip' && k !== 'fill')))
    const widths = Object.fromEntries(kinds.map((k) => [k, addWidth(state, plan, tg.wall, tg.cm, k)]))
    // меню заменяет карточку прежнего выбора: вместе они закрывали почти весь экран телефона (P6, 5)
    closeSelection()
    setAdd({ target: tg, x, y, widths, gapW })
  }

  /** Поставлено: история, выбор — на новом. */
  const commitAdd = (next: KitchenState, key: ItemKey | null) => {
    track()
    setCartResult(null)
    setState(next)
    setAdd(null)
    if (key) {
      closeMeasure()
      setMoving({ key })
      pickAfterRef.current = key
    }
  }

  const addFrom = (menu: AddMenu, kind: AddKind | 'tech') => {
    if (kind === 'tech') {
      // техника выбирается в шаге «Техника»: открываем первый пустой слот, место запоминаем (setPick → addPicked);
      // вся техника уже выбрана — покупатель сам решает, что перенести: место запоминаем, выбор модели в любом слоте ставит её сюда (ревью 32)
      setAdd(null)
      addTargetRef.current = menu.target
      const slot = (['dishwasher', 'washer', 'fridge'] as SlotKind[]).find((s) => items[s] === null)
      if (slot) return openSlot(slot)
      goStep('tech')
      setToast(t.plus.allBusy)
      return
    }
    const res = addAt(state, menu.target.wall, menu.target.cm, kind, trial)
    if (res.key || res.state !== state) return commitAdd(res.state, res.key)
    if (kind === 'fill' || kind === 'strip') return setAdd(null)
    // не поместилось — сузить соседей или на другую стену
    setAdd({ ...menu, failed: kind, narrow: res.fit?.narrow ?? null, need: res.fit?.need })
  }

  /** Сузить соседей: кого и на сколько — из `fit` неудачной постановки (addAt), ширину заново не считаем. */
  const addNarrow = (menu: AddMenu) => {
    const kind = menu.failed!
    const narrow = menu.narrow
    const again = narrow ? addAt(narrowed(state, narrow.neighbour, narrow.by, plan, menu.target.cm), menu.target.wall, menu.target.cm, kind, trial) : null
    if (again?.key) return commitAdd(again.state, again.key)
    setAdd(null)
    setToast(t.plus.failed)
  }

  const addOtherWall = (menu: AddMenu) => {
    const kind = menu.failed!
    for (const w of wallsOf(state.shape).filter((x) => x !== menu.target.wall)) {
      const run = plan.runs.find((r) => r.id === w)
      if (!run) continue
      const res = addAt(state, w, run.length / 2, kind, trial)
      if (res.key) return commitAdd(res.state, res.key)
    }
    setAdd(null)
    setToast(t.plus.failed)
  }

  useEffect(() => {
    if (!hasWebGL2()) {
      setFail3d('no-webgl2')
      setEngineState('error')
      return
    }
    let engine: KitchenEngine | null = null
    let cancelled = false
    // dev: класс качества из адреса `kp-tier=phone-low` — e2e меряет кадр слабого телефона (C2, 48).
    // В production не читается никогда; читаем до import(), пока автосохранение не переписало адрес.
    const kpTier = process.env.NODE_ENV !== 'production' ? new URLSearchParams(window.location.search).get('kp-tier') : null
    const force = (['phone', 'phone-low', 'desktop', 'desktop-weak'] as const).find((n: TierName) => n === kpTier)
    // Файл 3D на медленном интернете иногда не приходит с первого раза —
    // пробуем ещё дважды, а не пишем сразу «не работает».
    const load = (tries: number): Promise<typeof import('./three/engine')> =>
      import('./three/engine').catch((e: unknown) => {
        if (tries <= 0 || cancelled) throw Object.assign(new Error('load'), { cause: e, fail: 'load' as const })
        return new Promise((ok) => setTimeout(ok, 1500)).then(() => load(tries - 1))
      })
    load(2)
      .then(({ KitchenEngine }) => {
        if (cancelled || !hostRef.current) return
        const events: EngineEvents = {
          onPick: (pick) => pickRef.current(pick),
          onDrag: (phase, key, wall, cm, grab) => onDragRef.current(phase, key, wall, cm, grab),
          onHome: (home) => setCamHome(home),
          onError: () => {
            // Видеокарту забрали. На телефоне так бывает часто: ушли в WhatsApp
            // отправить ссылку и вернулись, или не хватило памяти. Запускаем 3D
            // заново, когда страница снова на экране, — а не пишем «не работает».
            // Сбрасывается раз за разом прямо на глазах — не мучаем телефон:
            // показываем кнопку «Запустить 3D снова».
            setPhoto(null)
            setBuilt(false)
            if (!document.hidden && restarts.current >= 2) {
              setEngineState('lost')
              return
            }
            if (!document.hidden) restarts.current++
            setEngineState('loading')
            whenVisible(() => setEngineKey((k) => k + 1))
          },
        }
        // Обычный запуск упал (капризная видеокарта, мало памяти) — второй раз
        // запускаем бережно: без сглаживания, без мощного режима, в «Лёгком».
        try {
          engine = new KitchenEngine(hostRef.current, events, false, force)
        } catch {
          hostRef.current.querySelector('canvas')?.remove()
          try {
            engine = new KitchenEngine(hostRef.current, events, true)
          } catch (e) {
            throw Object.assign(new Error('start'), { cause: e, fail: 'start' as const })
          }
        }
        engineRef.current = engine
        // только при разработке: доступ к 3D из консоли браузера для проверок
        if (process.env.NODE_ENV !== 'production') (window as unknown as { __kp?: KitchenEngine }).__kp = engine
        setFail3d(null)
        setEngineState('ready')
      })
      .catch((e: { fail?: Fail3d }) => {
        if (cancelled) return
        setFail3d(e?.fail ?? 'start')
        setEngineState('error')
      })
    return () => {
      cancelled = true
      engine?.dispose()
      engineRef.current = null
    }
  }, [engineKey])

  // Фото выбранной техники: грузим и перестраиваем, когда пришло.
  useEffect(() => {
    const need = inProject.map((a) => a.image).filter((src): src is string => Boolean(src) && !photos.current.has(src!))
    if (need.length === 0) return
    import('./three/photo').then(({ loadPhoto }) => {
      for (const src of need) {
        loadPhoto(src).then((p) => {
          photos.current.set(src, p)
          setPhotosVersion((v) => v + 1)
        })
      }
    })
  }, [inProject])

  const wallColor = WALL_COLORS[state.wallColor ?? 0]?.color ?? null
  // Ручки: «без ручек» — профиль Gola; иначе выбранные или те, что у стиля.
  const handleless = state.handleless ?? style.handle === 'gola'
  const metal = HANDLE_METALS.find((m) => m.id === (state.handleMetal ?? style.metal))
  const handle: HandleKind = handleless ? 'gola' : (state.handle ?? (style.handle === 'gola' ? 'rail' : style.handle))
  const topSel = topChoice(state.top)
  const splashSel = splashChoice(state.splash)
  const lookStyle = useMemo(
    () => ({
      ...style,
      handle,
      handleMetal: state.handleMetal,
      topCm: topSel?.cm ?? style.topCm,
      ...(splashSel ? { splash: splashSel.kind, splashColor: splashSel.color, splashVein: splashSel.vein } : {}),
    }),
    [style, handle, state.handleMetal, topSel, splashSel],
  )
  // низ верхнего ряда — как в 3D: встроенная вытяжка поднимает весь ряд
  const upperBottom = useMemo(() => upperBottomOf(plan, items.hood, lookStyle), [plan, items.hood, lookStyle])
  const finish = useMemo(
    () => ({
      facade: frontColor(state.facade),
      upper: state.upperFacade === 'style' ? ('style' as const) : frontColor(state.upperFacade),
      top: topSel,
      overFridge: frontColor(state.overFridgeFacade),
      island: state.shape === 'island' ? frontColor(state.islandFacade) : undefined,
    }),
    [state.facade, state.upperFacade, topSel, state.overFridgeFacade, state.shape, state.islandFacade],
  )
  const buildInput: BuildInput = useMemo(
    () => ({
      plan,
      style: lookStyle,
      tone,
      items,
      photos: photos.current,
      evening: false,
      room: { ceiling, toCeiling: !state.lowUppers, floor: state.floor, wall: wallColor },
      fronts: state.fronts ?? {},
      finish,
      columns: state.heights,
      tallBase: state.tallBase,
      doorsRight: state.doorsRight,
    }),
    // photosVersion — фото пришло, картинку на технике надо обновить
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [plan, lookStyle, tone, items, photosVersion, ceiling, state.lowUppers, state.floor, wallColor, state.fronts, finish, state.heights, state.tallBase, state.doorsRight],
  )

  // 3D на этом телефоне нет (старый телефон, браузер без видеокарты) — чертёж
  // и PDF для мастера всё равно считаем: та же сборка кухни, только без показа.
  // Раньше без 3D кнопка «Скачать PDF» была серой, хотя страница обещала лист.
  useEffect(() => {
    if (engineState !== 'error' && engineState !== 'lost') return
    let cancelled = false
    const timer = setTimeout(() => {
      import('./three/build')
        .then(({ buildKitchen }) => {
          if (cancelled) return
          const kitchen = buildKitchen(buildInput)
          setSpec(kitchen.spec)
          setHoodOver(kitchen.hoodOver)
          kitchen.dispose()
        })
        .catch(() => {
          // не собралось и без 3D — остаётся короткий список «что где стоит»
        })
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [engineState, buildInput])

  // Выбор — до перестройки: setKitchen сам обводит выбранное заново, пока
  // новая техника ещё на месте. Позже рамка ловила её в прыжке «замены»
  // (+35 см) и так и висела над ней.
  useEffect(() => {
    engineRef.current?.setSelected(selected)
  }, [selected, engineState, buildInput])

  const prev = useRef<{ style: string; tone: number; shape: Shape; ids: string } | null>(null)
  useEffect(() => {
    const engine = engineRef.current
    if (!engine || engineState !== 'ready') return
    const ids = SLOTS.map((s) => items[s]?.id ?? '-').join('|')
    const before = prev.current
    let motion: Parameters<KitchenEngine['setKitchen']>[1] = null
    if (before && (before.style !== state.style || before.tone !== state.tone)) motion = { kind: 'style' }
    else if (before && before.ids !== ids) {
      const was = before.ids.split('|')
      const changed = SLOTS.find((s, i) => was[i] !== (items[s]?.id ?? '-') && items[s])
      if (changed) motion = { kind: 'swap', slot: changed }
    } else if (before && moving && 'key' in moving && SLOT_OF[moving.key] && items[SLOT_OF[moving.key]!]) {
      // переставили — техника мягко «опускается» на новое место
      motion = { kind: 'swap', slot: SLOT_OF[moving.key]! }
    }
    engine.setKitchen(buildInput, motion, Boolean(before && before.shape !== state.shape))
    prev.current = { style: state.style, tone: state.tone, shape: state.shape, ids }
    setBuilt(true)
    setSpec(engine.spec())
    setHoodOver(engine.hoodOver())
    // Шкафу поменяли фасады или ширину — карточка остаётся на нём же, с
    // новыми размерами. Верхний шкаф ищем заново: его начало могло сдвинуться.
    let cab = editingRef.current
    const follow = followRef.current
    followRef.current = null
    const fresh = pickAfterRef.current
    pickAfterRef.current = null
    if (follow && cab?.row === 'upper') {
      const key = upperOver(buildInput.plan, follow)
      if (key) cab = { ...cab, key }
    }
    if (fresh) {
      // только что поставлен «+» — тот же выбор, что нажатием: размеры, фасады, ширина, перестановка
      pickFromPlan(fresh)
    } else {
      const again = cab ? engine.measureCab(cab.key) : null
      // у мойки, плиты и пенала фасадов не выбирают — размеры держим по предмету
      const mv = movingRef.current
      // только что поставили с палитры пустой комнаты — размеры по нему
      const placedNow = measureAfterRef.current
      measureAfterRef.current = null
      const byItem = !again && mv && 'key' in mv && (measureRef.current || placedNow === mv.key) ? engine.measureItem(mv.key) : null
      setMeasure(again?.dims ?? byItem?.dims ?? null)
      setEditing(again?.cab ?? null)
    }
    // поменяли сторону открывания — дверцы сразу открываются: видно, куда
    if (openAfterRef.current) {
      engine.openDoors(openAfterRef.current)
      openAfterRef.current = null
    }
    // moving намеренно не в списке: анимация — только при перестройке кухни
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildInput, engineState, items, state.style, state.tone, state.shape])

  // Пока человек собирает кухню, видеокарта в фоне готовит «Фото» —
  // нажмёт кнопку, и фото начнёт рисоваться сразу, без минуты ожидания.
  useEffect(() => {
    if (engineState !== 'ready' || !built) return
    const timer = setTimeout(() => engineRef.current?.prewarmPhoto(), 6000)
    return () => clearTimeout(timer)
  }, [engineState, built])

  // Размер поменяли — через полсекунды камера отъезжает, чтобы всё влезло.
  const sizeKey = `${state.a}:${state.b}:${state.c}:${state.island}:${ceiling}`
  const firstSize = useRef(sizeKey)
  useEffect(() => {
    if (sizeKey === firstSize.current) return
    const timer = setTimeout(() => engineRef.current?.reframe(), 450)
    return () => clearTimeout(timer)
  }, [sizeKey])

  useEffect(() => {
    engineRef.current?.setEvening(evening)
  }, [evening, engineState])

  // На весь экран: страница под 3D не прокручивается, Esc — свернуть.
  const toggleFull = (on: boolean) => {
    setFull(on)
    setFullPanel(on && !isStacked() && sidePanelSaved())
  }
  // компьютер: панель справа — запомнить выбор и перецентровать кухню под новую ширину сцены
  useEffect(() => {
    if (!full || isStacked()) return
    try {
      window.localStorage.setItem(SIDE_KEY, fullPanel ? '1' : '0')
    } catch {
      // браузер не даёт хранить — панель просто откроется в следующий раз
    }
    const timer = setTimeout(() => engineRef.current?.reframe(), 80)
    return () => clearTimeout(timer)
  }, [full, fullPanel])
  useEffect(() => {
    if (!full) return
    document.documentElement.classList.add('kp-lock')
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setFull(false)
      setFullPanel(false)
    }
    window.addEventListener('keydown', onKey)
    const timer = setTimeout(() => engineRef.current?.reframe(), 80)
    return () => {
      document.documentElement.classList.remove('kp-lock')
      window.removeEventListener('keydown', onKey)
      clearTimeout(timer)
      setTimeout(() => engineRef.current?.reframe(), 80)
    }
  }, [full])

  const changeView = (v: View, auto = false) => {
    autoView.current = auto
    setView(v)
    engineRef.current?.setView(v)
  }
  /** «3D · План»: два вида; «С высоты глаз» и «Спереди» — в «Ещё», возврат в «3D» ставит обычную камеру. */
  const pickScene = (s: '3d' | 'plan') => {
    setScene(s)
    if (s === '3d' && (view === 'eye' || view === 'front')) changeView('angle')
  }

  /**
   * Показать часть панели. На компьютере панель листается сама. На телефоне
   * листается страница, а сверху прилипли 3D и вкладки шагов, — ставим
   * элемент прямо под них. Шапка сайта при прокрутке вниз уезжает, при
   * прокрутке вверх возвращается и занимает место — это тоже учитываем.
   */
  const reveal = (el: Element | null | undefined, under: 'stage' | 'steps') => {
    const root = rootRef.current
    const stage = stageRef.current
    const steps = stepsRef.current
    if (!el || !root || !stage || !steps) return
    if (!isStacked()) {
      el.scrollIntoView({ block: 'nearest', behavior: smooth() })
      return
    }
    const cover = stage.offsetHeight + (under === 'steps' ? steps.offsetHeight + 8 : 0)
    const y = window.scrollY + el.getBoundingClientRect().top - cover
    // в конструкторе (kp-pinned) шапка не возвращается и при прокрутке вверх
    const pinned = document.documentElement.classList.contains('kp-pinned')
    const headerStays = y <= 140 || (!pinned && y <= window.scrollY)
    const header = headerStays ? parseFloat(root.style.getPropertyValue('--kp-header')) || 0 : 0
    window.scrollTo({ top: Math.max(0, y - header), behavior: smooth() })
  }

  // На шаге «Размер» кухня показывается сверху, как чертёж.
  // Новый шаг всегда открывается с начала, а не там, где листали прошлый.
  const goStep = (s: Step) => {
    setStep(s)
    requestAnimationFrame(() => {
      bodyRef.current?.scrollTo({ top: 0 })
      // в полном экране страница под 3D заперта — её не двигаем
      if (isStacked() && !full) reveal(panelRef.current, 'stage')
    })
  }

  /** Последний шаг пройден — «Итог»: проверка проекта, сумма, корзина, лист мастера, варианты. */
  const finishSteps = () => goStep('total')

  // Превью стилей — ваша же кухня в каждом стиле.
  const thumbKey = `${state.shape}:${sizeKey}:${SLOTS.map((s) => items[s]?.id ?? '-').join('|')}:${photosVersion}:${state.lowUppers ? 0 : 1}:${state.floor ?? ''}:${state.wallColor ?? 0}:${state.noWindow ? 0 : 1}`
  const doneThumbs = useRef('')
  useEffect(() => {
    const engine = engineRef.current
    // эскизы — только у карточек карусели (8 и выбранный), после простоя движка (thumbnailAsync, таск 02)
    const key = `${thumbKey}:${state.style}`
    if (step !== 'style' || engineState !== 'ready' || !built || !engine || doneThumbs.current === key) return
    let cancelled = false
    void (async () => {
      for (const s of carouselStyles(state.style)) {
        if (cancelled) return
        const url = await engine.thumbnailAsync({ ...buildInput, style: s, tone: s.tones[0], plan: planFor(s, true), fronts: {}, finish: undefined })
        if (cancelled) return
        if (url) setThumbs((prevThumbs) => ({ ...prevThumbs, [s.id]: url }))
      }
      doneThumbs.current = key
    })()
    return () => {
      cancelled = true
    }
  }, [step, engineState, built, thumbKey, buildInput, planFor, state.style])

  useEffect(() => {
    if (!note) return
    // длинное сообщение висит дольше — чтобы успели прочитать; с кнопкой — ещё дольше
    const timer = setTimeout(() => setNote(null), note.act ? 12000 : Math.max(2400, note.text.length * 60))
    return () => clearTimeout(timer)
  }, [note])

  /* ───────── действия ───────── */

  /**
   * История для «Отменить / Вернуть». Быстрые изменения подряд (ползунок
   * размера) сливаются в один шаг — отмена возвращает к началу движения.
   */
  const stateRef = useRef(state)
  stateRef.current = state
  const hist = useRef<{ past: KitchenState[]; future: KitchenState[]; at: number }>({ past: [], future: [], at: 0 })
  // from — что вернёт «Отменить», если это не текущая кухня (сохранённая с плашки)
  const track = (from?: KitchenState) => {
    const h = hist.current
    const now = Date.now()
    if (from || now - h.at > 600) {
      h.past.push(from ?? stateRef.current)
      if (h.past.length > 60) h.past.shift()
    }
    h.at = now
    h.future = []
    setHistTick((n) => n + 1)
  }
  const travel = (from: KitchenState[], to: KitchenState[]) => {
    const target = from.pop()
    if (!target) return
    to.push(stateRef.current)
    hist.current.at = 0
    setCartResult(null)
    setState(target)
    setHistTick((n) => n + 1)
  }
  const undo = () => travel(hist.current.past, hist.current.future)
  const redo = () => travel(hist.current.future, hist.current.past)

  const update = (patch: Partial<KitchenState>) => {
    track()
    setCartResult(null)
    setState((s) => ({ ...s, ...patch }))
  }
  /** Готовое состояние целиком (из layout: `stateWith` опускает пустые `gaps`/`at`/`manualUppers` — сливать с прежним нельзя). */
  const replace = (next: KitchenState) => {
    track()
    setCartResult(null)
    setState(next)
  }
  const setPick = (slot: SlotKind, id: string | null) => {
    // пришли сюда из меню «+» → «Технику»: выбранная модель встаёт в запомненное место
    const tg = addTargetRef.current
    addTargetRef.current = null
    const planner: Planner = (st, snap) => planKitchen(planInputOf(st, chosenItems(st.picks, appliances), snap), { shelves: style.shelves })
    // модель выбрана, но в запомненное место не встала — сказать, а не молчать (ревью 32)
    if (tg && id && !pickInto(state, slot, id, tg, planner).placed) setToast(t.noRoom)
    // функциональная форма: два быстрых выбора не затирают друг друга (ревью C1)
    track()
    setCartResult(null)
    setState((s) => pickInto(s, slot, id, tg, planner).state)
  }
  // Своя расстановка сбрасывается вместе со своими шкафами: иначе они
  // оставались в адресе и в счётчике «Вернуть шкафы как было», но не в кухне.
  // Пустые места, ручной верх и его шкафы — тоже от прежней формы (ревью таска 03): resetForShape сбрасывает всё разом.
  const setShape = (shape: Shape) => {
    // пустая комната: другая форма — поставленное на оставшихся стенах на месте, новая стена пустая (с отменой)
    if (state.free) {
      if (shape === state.shape) return
      const { state: next, dropped } = reshapeRoom(state, shape)
      update(next)
      const island = shape === 'island' && state.shape !== 'island'
      // добавили остров — палитра сразу ставит на него
      if (island) {
        setFreeWall('I')
        setStep('kitchen')
      }
      setNote({ text: dropped ? t.free.shapeDropped : island ? t.free.islandAdded : t.free.shapeKept, act: { label: t.undo, run: undo } })
      return
    }
    update(resetForShape(state, shape))
  }

  /**
   * Длину стены поменяли — свои и пустые места сохраняются (resizeWalls): за
   * новым краем предмет придвигается, пустое место ужимается или уходит.
   */
  const resize = (patch: Partial<KitchenState>) => {
    // стена A стала короче острова — остров поджимается к ней (C14)
    const island = patch.a !== undefined && state.island > patch.a ? { island: patch.a } : {}
    // пустая комната: всё стоит в тех же сантиметрах от угла — места не сбрасываем;
    // угловой у конца стены A сдвинулся вместе с ней — его фасады едут за ним
    if (state.free) {
      const next = { ...state, ...patch, ...island }
      const carried = carryCornerFronts(state, next, plan, trial(next))
      update({ ...patch, ...island, fronts: carried.fronts, doorsRight: carried.doorsRight })
      return
    }
    // только заданные стены: `b: undefined` затирал бы длину стены B (страница падала на чертеже)
    const sizes: Partial<{ a: number; b: number; c: number; island: number }> = {}
    for (const k of ['a', 'b', 'c'] as const) if (patch[k] !== undefined) sizes[k] = patch[k]
    if ((island.island ?? patch.island) !== undefined) sizes.island = island.island ?? patch.island
    replace(resizeWalls(state, sizes, plan))
  }

  /** Продолжить сохранённую кухню (плашка при входе без адреса). */
  const resumeLast = () => {
    if (!resume) return
    track()
    setResume(null)
    setState(resume)
  }
  /**
   * Начать заново: кухня по умолчанию, отмена возвращает прежнюю. С плашки
   * «Продолжить» прежняя — сохранённая кухня, а не то, что на экране (история 34).
   */
  const startOver = () => {
    track(resume ?? undefined)
    setResume(null)
    setCartResult(null)
    setState(DEFAULT_STATE)
    setNote({ text: t.startedOver, act: { label: t.undo, run: undo } })
  }

  /** Раскладка для пробы: что будет, если принять изменение. */
  // snap — какие места прилипают к соседям: только то, что двигают сейчас (C16)
  const trial = (s: KitchenState, snap: ItemKey[] = []) => planKitchen(planInputOf(s, chosen, snap), { shelves: style.shelves })

  /**
   * Все предметы остаются там, где стоят сейчас, кроме перечисленных: двигают
   * одно — меняются только шкафы рядом с ним, а не вся стена.
   */
  const frozen = (except: ItemKey[]): NonNullable<KitchenState['at']> => {
    const at: NonNullable<KitchenState['at']> = {}
    for (const [k, p] of Object.entries(positions) as [ItemKey, ItemPlace][]) if (!except.includes(k)) at[k] = p.center
    return at
  }

  /**
   * Принять изменение расстановки или ширины. Если из-за него что-то не
   * помещается на стене — не принимаем и говорим почему. Свои места
   * записываем туда, где предметы встали на самом деле: соседи и края стены
   * могли не пустить дальше.
   */
  const apply = (patch: Partial<KitchenState>, snap: ItemKey[] = []): boolean => {
    const next = { ...state, ...patch }
    const p = trial(next, snap)
    if (p.dropped.length > plan.dropped.length) {
      setToast(t.noRoom)
      return false
    }
    if (next.at) {
      const pos = itemPositions(p)
      const at: NonNullable<KitchenState['at']> = {}
      for (const k of Object.keys(next.at) as ItemKey[]) if (pos[k]) at[k] = Math.round(pos[k]!.center * 2) / 2
      patch = { ...patch, at: nonEmpty(at), arrangement: next.arrangement ?? order }
    }
    update(patch)
    return true
  }
  /**
   * Стиль ставится целиком — с его отделкой (своя отделка сбрасывается, тост
   * с отменой). Мебель прошлого стиля («Колонны», «Портал»), которую
   * покупатель не трогал, снимается (U07).
   */
  const pickStyle = (s: KitchenStyle) => {
    if (s.id === state.style) return
    const finish: Partial<KitchenState> = {
      facade: undefined,
      upperFacade: undefined,
      islandFacade: undefined,
      top: undefined,
      splash: undefined,
      handle: undefined,
      handleMetal: undefined,
      handleless: undefined,
    }
    const own = (Object.keys(finish) as (keyof KitchenState)[]).some((k) => state[k] !== undefined)
    const left: Partial<KitchenState> = {}
    for (const [k, v] of Object.entries(style.layout ?? {}) as [keyof KitchenState, unknown][]) {
      if (state[k] === v) Object.assign(left, { [k]: undefined })
    }
    update({ ...finish, ...left, style: s.id, tone: 0, ...(s.layout ?? {}) })
    if (own) setNote({ text: t.styleFinish, act: { label: t.undo, run: undo } })
  }
  const setFront = (key: string, v: FrontVariant) => {
    track()
    setState((s) => {
      // у своего шкафа фасады хранятся в нём самом
      if (isCabinet(key) && s.cabinets?.[key]) return { ...s, cabinets: { ...s.cabinets, [key]: { ...s.cabinets[key], front: v as BaseFront } } }
      return { ...s, fronts: { ...s.fronts, [key]: v } }
    })
  }
  // свои фасады, свои шкафы, свои места и ширины — всё, что «Вернуть как было» сбросит

  // Перестановка кнопками. У левой стены и у острова ряд идёт справа налево — поэтому наоборот.
  const present = useMemo(() => new Set(Object.keys(positions) as ItemKey[]), [positions])

  /** Обычный шкаф, на который нажали: где стоит, ширина, фасады. */
  function cabSel(cab: CabInfo): Extract<MoveSel, { cab: CabInfo }> | null {
    const sk = parseSceneKey(cab.key)
    const run = sk && plan.runs.find((r) => r.id === sk.wall)
    const m = run?.modules.find((mod) => Math.round(mod.x) === sk!.x)
    if (!run || !m) return null
    return { cab, w: m.w, wall: run.id as WallId, center: moduleCenter(run, m) }
  }

  /**
   * Обычный шкаф становится своим (k1, k2…): встаёт на своё место в порядке и
   * забирает свои фасады. Можно сразу дать ширину (w), место (at) и
   * действие с порядком (act — другая стена). keep — выбран верхний шкаф над
   * ним: карточка остаётся на верхнем.
   */
  function commitPinned(
    sel: Extract<MoveSel, { cab: CabInfo }>,
    opts: {
      w?: number
      at?: number
      act?: (o: ReturnType<typeof resolveArrangement>, id: CabinetId) => ReturnType<typeof resolveArrangement>
      keep?: boolean
    } = {},
  ) {
    const front: BaseFront = sel.cab.narrow ? 'doors' : ((sel.cab.variant as BaseFront) ?? 'doors')
    const pinned = pinCabinet(order, state.cabinets ?? {}, { w: opts.w ?? sel.w, front }, sel.wall, sel.center, positions)
    const fronts = { ...state.fronts }
    delete fronts[sel.cab.key]
    const ok = apply({
      arrangement: opts.act ? opts.act(pinned.order, pinned.id) : pinned.order,
      cabinets: pinned.cabinets as KitchenState['cabinets'],
      fronts: nonEmpty(fronts),
      ...(opts.at !== undefined ? { at: { ...frozen([]), [pinned.id]: opts.at } } : {}),
    })
    if (!ok) return
    if (opts.keep) {
      followRef.current = pinned.id
      return
    }
    const nextCab: CabInfo = { key: pinned.id, row: 'base', variant: front }
    editingRef.current = nextCab
    setEditing(nextCab)
    setMoving({ key: pinned.id })
  }

  /**
   * «Левее / правее»: на 5 см, соседние шкафы подстраиваются. Упёрся в
   * технику или в другой предмет — перепрыгивает через него.
   */
  const nudge = (dir: 1 | -1) => {
    if (freeUpper) return nudgeUpper(dir)
    if (!moving) return
    // пустая комната: угловой шкаф стоит в углу, его не двигают
    if (state.free) return 'key' in moving ? nudgeFree(moving.key, dir) : undefined
    if (!('key' in moving)) {
      const sign = moving.wall === 'B' || moving.wall === 'I' ? -dir : dir
      commitPinned(moving, { at: moving.center + sign * NUDGE })
      return
    }
    const step = nudgeMove(state, plan, moving.key, dir, trial, NUDGE)
    if (step) apply(step.patch, step.snap)
  }
  // кнопку держат — сдвигается дальше, как клавиша на клавиатуре
  const nudgeRef = useRef(nudge)
  nudgeRef.current = nudge
  const repeat = useRef(0)
  const stopRepeat = () => {
    clearTimeout(repeat.current)
    clearInterval(repeat.current)
    repeat.current = 0
  }
  const startRepeat = (dir: 1 | -1) => {
    stopRepeat()
    nudgeRef.current(dir)
    repeat.current = window.setTimeout(() => {
      repeat.current = window.setInterval(() => nudgeRef.current(dir), 110)
    }, 420)
  }
  useEffect(() => stopRepeat, [])
  // выбор закрыли, пока кнопку держали, — кнопки уже нет, повтор останавливаем
  useEffect(() => {
    if (!moving && !freeUpper) stopRepeat()
  }, [moving, freeUpper])

  /** «На другую стену» — то же правило, что перетаскивание (P1): moveToWall ищет место через placeAt; не встало — тот же тост с «Сузить», соседи молча не сужаются. */
  const toOtherWall = () => {
    if (!moving) return
    if (state.free) {
      // пустая комната: свой шкаф на другую стену не переносят — только мойку и технику
      if (!('key' in moving) || isCabinet(moving.key) || isGap(moving.key) || isUpperCab(moving.key)) return
      const rest = { ...state.at }
      delete rest[moving.key]
      const arrangement = nextWall(order, moving.key, state.shape)
      // где встал на другой стене — там его место (иначе съедет, когда рядом что-то уберут)
      const placed = itemPositions(trial({ ...state, arrangement, at: nonEmpty(rest) }))[moving.key]
      if (placed) rest[moving.key] = Math.round(placed.center * 2) / 2
      apply({ arrangement, at: nonEmpty(rest) })
      return
    }
    const d0 = dragBaseFor('key' in moving ? moving.key : moving.cab.key)
    const from = d0 && itemPositions(d0.plan)[d0.key]
    const to = d0 && from ? nextWallId(state.shape, from.wall, d0.key) : null
    if (!d0 || !to) return
    const d = pinnedOn(d0, to)
    const placed = moveToWall(d.state, d.key, to, trial)
    if (placed.fit?.ok) return commitPlaced(d, placed.state, placed.fit, to)
    const narrow = placed.fit?.narrow ?? null
    const narrowedState = narrow && placed.fit ? narrowed(d.state, narrow.neighbour, narrow.by, d.plan, placed.fit.center) : null
    const again = narrow && narrowedState ? moveToWall(narrowedState, d.key, to, trial) : null
    if (!narrow || !again?.fit?.ok) return setToast(t.noRoom)
    setNote({ text: t.noRoomNarrow(nameOfKey(narrow.neighbour), narrow.by), act: { label: t.narrowAct, run: () => commitPlaced(d, again.state, again.fit!, to) } })
  }

  /* ───────── ширина ───────── */

  /** Модуль, к которому относится выбранное: сам шкаф или шкаф под выбранным верхним. */
  const target = useMemo((): { run: Run; m: Module } | null => {
    const find = (ok: (run: Run, m: Module) => boolean) => {
      for (const run of plan.runs) for (const m of run.modules) if (ok(run, m)) return { run, m }
      return null
    }
    if (moving && 'key' in moving) return find((_, m) => m.item === moving.key)
    if (moving) {
      const sk = parseSceneKey(moving.cab.key)
      return sk && find((run, m) => run.id === sk.wall && Math.round(m.x) === sk.x)
    }
    if (editing?.row === 'upper') {
      const sk = parseSceneKey(editing.key)
      const run = sk && plan.runs.find((r) => r.id === sk.wall)
      const u = run?.uppers.find((up) => Math.round(up.x) === sk!.x)
      if (!run || !u) return null
      const mid = u.x + u.w / 2
      const m = run.modules.find((mod) => mod.x <= mid && mod.x + mod.w >= mid)
      return m ? { run, m } : null
    }
    return null
  }, [plan, moving, editing])

  /**
   * Ширина выбранного: свой шкаф, мойка, шкаф под плитой, пенал или обычный
   * шкаф (он сперва становится своим). У техники ширина — её собственная.
   */
  const widthCtl = useMemo(() => {
    // пустая комната: свой верхний шкаф — своя ширина, от низа не зависит
    if (freeUpper) return { value: Math.round(freeUpper.w), ...FREE_UPPER }
    // пустая комната: угловой шкаф — своя ширина (глухая часть 60 + дверца)
    if (freeCornerSel) return { value: freeCornerW(state.free, freeCornerSel), ...FREE_CORNER }
    if (!target) return null
    const { m } = target
    const k = m.item
    if (k && isCabinet(k)) {
      const c = state.cabinets?.[k]
      return c ? { value: Math.round(c.w), ...WIDTH_LIMITS.cabinet } : null
    }
    if (k && (SIZED_ITEMS as ItemKey[]).includes(k)) {
      const lim = WIDTH_LIMITS[k as SizedItem]
      return { value: Math.round(m.w), min: k === 'hob' ? hobMinWidth(items.hob) : lim.min, max: lim.max }
    }
    if (!k && FLEX.includes(m.kind)) return { value: Math.round(m.w), ...WIDTH_LIMITS.cabinet }
    return null
  }, [target, state.cabinets, items.hob, freeUpper, freeCornerSel, state.free])

  /** Ширина по 5 см: 78 → 80 → 85, и обратно 78 → 75. Соседние шкафы подстраиваются. */
  const setWidth = (dir: 1 | -1) => {
    if (!widthCtl) return
    const cur = widthCtl.value
    const snapped = dir > 0 ? Math.floor(cur / 5) * 5 + 5 : Math.ceil(cur / 5) * 5 - 5
    const next = Math.max(widthCtl.min, Math.min(widthCtl.max, snapped))
    if (next === cur) return
    if (freeCornerSel) {
      const end = freeCornerSel
      const patch: Partial<KitchenState> = { free: { ...state.free, cornerW: { ...state.free?.cornerW, [end]: next } } }
      // шире — соседи на стене A отодвигаются по порядку; места нет — не меняем
      const centers = freeReflow({ ...state, ...patch }, plan, 'A')
      if (!centers) return setToast(t.noRoom)
      const at = { ...frozen([]), ...centers }
      const p = trial({ ...state, ...patch, at })
      // фасады углового едут за ним (ключ — от его места в ряду)
      const carried = carryCornerFronts(state, { ...state, ...patch, at }, plan, p)
      if (!apply({ ...patch, at, fronts: carried.fronts, doorsRight: carried.doorsRight })) return
      // у конца стены угловой начинается левее — ключ выбора другой
      const a = p.runs.find((r) => r.id === 'A')
      const m = a?.modules.find((mod) => mod.kind === 'corner' && mod.blindAt === end)
      if (m && editing) {
        const cab: CabInfo = { ...editing, key: baseKey('A', m.x) }
        editingRef.current = cab
        setEditing(cab)
      }
      return
    }
    if (freeUpper) {
      const res = freeResizeUpper(state, plan, freeUpper.wall, freeUpper.index, next, (s) => trial(s))
      if ('fail' in res) return setToast(res.fail === 'noRoom' ? t.free.noRoom(res.free) : t.noRoom)
      update(res.state)
      selectUpperAt(res.state, freeUpper.wall, res.state.free?.uppers?.[freeUpper.wall]?.[freeUpper.index]?.c)
      return
    }
    if (!target) return
    const { run, m } = target
    const k = m.item
    const upper = editing?.row === 'upper'
    // Все стоят на местах, выбранное растёт от своей середины — меняются
    // только шкафы рядом с ним; соседнее пустое место ужимается (squeezeGaps), а не выпадает.
    // `sq` — готовое состояние из layout: пустые gaps/at/manualUppers в нём опущены, поэтому в патч — явно.
    if (state.free && k) {
      // Пустая комната: растёт на своём месте, соседи отодвигаются туда, где свободно;
      // на стене места нет — ширина не меняется (раньше шкаф перескакивал на другое место).
      const patch: Partial<KitchenState> = isCabinet(k)
        ? { cabinets: { ...state.cabinets, [k]: { ...state.cabinets![k], w: next } } }
        : { widths: { ...state.widths, [k]: next } }
      const wall = positions[k]?.wall
      // настоящая ширина (мойка, варочная — со своими пределами) — из пробной раскладки
      const w = trial({ ...state, ...patch, at: frozen([]) }, [k]).runs.flatMap((r) => r.modules).find((m) => m.item === k)?.w ?? next
      const centers = wall ? freeReflow({ ...state, ...patch }, plan, wall, { key: k, w }) : null
      if (!centers) return setToast(t.free.noRoom(0))
      if (apply({ ...patch, at: { ...frozen([]), ...centers } }) && upper) followRef.current = k
      return
    }
    if (k) {
      const sq = squeezeGaps(state, plan, k, next)
      const size = isCabinet(k) ? { cabinets: { ...sq.cabinets, [k]: { ...sq.cabinets![k], w: next } } } : { widths: { ...sq.widths, [k]: next } }
      const at = sq === state ? frozen([]) : sq.at
      if (apply({ ...size, arrangement: sq.arrangement, gaps: sq.gaps, manualUppers: sq.manualUppers, at }) && upper) followRef.current = k
      return
    }
    const key = baseKey(run.id, m.x)
    const cab: CabInfo = {
      key,
      row: 'base',
      variant: (state.fronts?.[key] as BaseFront | undefined) ?? (m.kind === 'drawers' ? 'drawers3' : 'doors'),
      narrow: m.kind === 'bottle' || m.kind === 'filler',
    }
    const center = moduleCenter(run, m)
    commitPinned({ cab, w: m.w, wall: run.id as WallId, center }, { w: next, at: center, keep: upper })
  }

  /**
   * Высота пенала и колонны с духовкой: по умолчанию — до верха (потолка
   * или верхних шкафов), можно ниже. В колонну с духовкой и микроволновкой
   * обе должны влезть — ниже 2 м её не сделать.
   */
  const heightCtl = useMemo(() => {
    const k = target?.m.item
    if (k !== 'pantry' && k !== 'pantry2' && k !== 'tall') return null
    // верх колонн — как в 3D (build.ts, heights): до потолка или до верха шкафов,
    // а над холодильником в нише — не ниже его и антресоли 30 см
    const ceil = ceiling - 0.4
    let top = ceil
    if (state.lowUppers) {
      top = Math.min(upperBottom + style.upperCm, ceil)
      if (items.fridge && !state.fridgeOpen) top = Math.min(ceil, Math.max(top, items.fridge.h + 35))
    }
    const max = Math.floor(top)
    const min = k === 'tall' ? tallMin(Boolean(items.microwave?.builtIn), state.tallBase) : COLUMN_HEIGHT.min
    return { key: k as ColumnItem, value: Math.min(max, Math.round(state.heights?.[k as ColumnItem] ?? max)), min, max }
  }, [target, ceiling, state.lowUppers, state.fridgeOpen, state.heights, state.tallBase, style.upperCm, upperBottom, items.fridge, items.microwave])

  /**
   * Нижний шкаф колонны с духовкой — от пола до духовки: ниже — духовка ниже,
   * а колонна своей высоты. Выше — пока над ним помещаются духовка (и микроволновка).
   */
  const baseCtl = useMemo(() => {
    if (!heightCtl || heightCtl.key !== 'tall') return null
    const value = Math.round(state.tallBase ?? TALL_BASE.base)
    // над нижним шкафом: духовка (и микроволновка) и верх колонны — как требует tallMin
    const room = heightCtl.value - (tallMin(Boolean(items.microwave?.builtIn)) - TALL_BASE.base)
    return { value, min: TALL_BASE.min, max: Math.max(value, Math.min(TALL_BASE.max, Math.floor(room))) }
  }, [heightCtl, state.tallBase, items.microwave])

  const setBase = (dir: 1 | -1) => {
    if (!baseCtl) return
    const cur = baseCtl.value
    const snapped = dir > 0 ? Math.floor(cur / 5) * 5 + 5 : Math.ceil(cur / 5) * 5 - 5
    const next = Math.max(baseCtl.min, Math.min(baseCtl.max, snapped))
    if (next === cur) return
    update({ tallBase: next === TALL_BASE.base ? undefined : next })
  }

  const setHeight = (dir: 1 | -1) => {
    if (!heightCtl) return
    const cur = heightCtl.value
    const snapped = dir > 0 ? Math.floor(cur / 5) * 5 + 5 : Math.ceil(cur / 5) * 5 - 5
    const next = Math.max(heightCtl.min, Math.min(heightCtl.max, snapped))
    if (next === cur) return
    const heights = { ...state.heights }
    // до самого верха — это «как было», в адрес не пишем
    if (next >= heightCtl.max) delete heights[heightCtl.key]
    else heights[heightCtl.key] = next
    update({ heights: nonEmpty(heights) })
  }

  /**
   * В какую сторону открывается дверца: только у шкафа с одной распашной
   * дверцей (двустворчатые открываются в обе стороны). Ключ — как в 3D:
   * у верхнего шкафа его ключ, у нижнего — предмет или ряд и начало.
   */
  const hingeKey = useMemo((): string | null => {
    const single = (wCm: number) => wCm >= 20 && wCm <= 62
    if (editing?.row === 'upper') {
      // над холодильником дверцы всегда парой — открываются в обе стороны
      if (editing.fridge) return null
      if (editing.variant !== 'doors' && editing.variant !== 'glass' && editing.variant !== 'mirror') return null
      const sk = parseSceneKey(editing.key)
      const run = sk && plan.runs.find((r) => r.id === sk.wall)
      const u = run?.uppers.find((up) => Math.round(up.x) === sk!.x)
      return u && single(u.w) ? editing.key : null
    }
    if (!target) return null
    const { run, m } = target
    const key = m.item ?? baseKey(run.id, m.x)
    // у колонны с духовкой низ может быть ящиками или полками — тогда сторону открывания не спрашиваем
    if (m.kind === 'tall') {
      const v = (state.fronts?.tall as BaseFront | undefined) ?? 'doors'
      return v === 'doors' || v === 'mix' ? key : null
    }
    if (m.kind === 'pantry') return key
    if (m.kind === 'sink') return single(m.w) ? key : null
    if (m.kind === 'doors' || m.kind === 'drawers' || m.kind === 'hob') {
      if (m.kind === 'hob' && m.oven) return null
      const front =
        m.item && isCabinet(m.item)
          ? state.cabinets?.[m.item]?.front
          : ((state.fronts?.[baseKey(run.id, m.x)] as BaseFront | undefined) ?? (m.kind === 'doors' ? 'doors' : 'drawers3'))
      return (front === 'doors' || front === 'mix') && single(m.w) ? key : null
    }
    return null
  }, [editing, target, plan, state.cabinets, state.fronts])
  const doorRight = Boolean(hingeKey && state.doorsRight?.includes(hingeKey))

  const setDoorSide = (right: boolean) => {
    if (!hingeKey || right === doorRight) return
    const list = new Set(state.doorsRight)
    if (right) list.add(hingeKey)
    else list.delete(hingeKey)
    openAfterRef.current = hingeKey
    update({ doorsRight: list.size ? [...list] : undefined })
  }

  const removeCab = () => {
    // пустая комната: убрать можно всё — свой шкаф, мойку, технику, свой верх
    if (freeUpper) {
      closeSelection()
      update(freeRemoveUpper(state, freeUpper.wall, freeUpper.index, plan))
      return
    }
    if (state.free && moving && 'key' in moving) {
      const key = moving.key
      closeSelection()
      update(freeRemove(state, key))
      return
    }
    if (!moving || !('key' in moving) || !isCabinet(moving.key)) return
    const id = moving.key
    const cabinets = { ...state.cabinets }
    delete cabinets[id]
    const at = { ...state.at }
    delete at[id]
    const arrangement = Object.fromEntries(Object.entries(order).map(([w, list]) => [w, list.filter((k) => k !== id)]))
    setMoving(null)
    closeMeasure()
    update({ arrangement, cabinets: nonEmpty(cabinets), at: nonEmpty(at) })
  }

  /* ───────── пустая комната (PRO) ───────── */

  /** Выбрать верхний шкаф стены там, где середина center: после перестройки карточка останется на нём. */
  const selectUpperAt = (s: KitchenState, wall: FreeWall, center: number | undefined) => {
    if (center === undefined) return
    const run = trial(s).runs.find((r) => r.id === wall)
    if (!run) return
    const u = run.uppers.find((up) => Math.abs(moduleCenter(run, up) - center) <= up.w / 2 + 0.5)
    if (!u) return
    const key = upperKey(run.id, u.x)
    const cab: CabInfo = { key, row: 'upper', variant: (s.fronts?.[key] as FrontVariant | undefined) ?? 'doors' }
    editingRef.current = cab
    setEditing(cab)
    setMoving(null)
  }

  /** Пустая комната, «левее / правее»: на 5 см; упёрся — встаёт по ту сторону соседа. */
  const nudgeFree = (key: ItemKey, dir: 1 | -1) => {
    const p = positions[key]
    if (!p) return
    const sign = (p.wall === 'B' || p.wall === 'I' ? -dir : dir) as 1 | -1
    const at = { ...frozen([key]), [key]: p.center + sign * NUDGE }
    const moved = itemPositions(trial({ ...state, at }, [key]))[key]
    if (moved && moved.wall === p.wall && Math.abs(moved.center - p.center) >= 1) {
      apply({ at }, [key])
      return
    }
    const ahead = (Object.entries(positions) as [ItemKey, ItemPlace][])
      .filter(([k, q]) => k !== key && q.wall === p.wall && (sign > 0 ? q.center > p.center : q.center < p.center))
      .sort((x, y) => sign * (x[1].center - y[1].center))[0]
    if (!ahead) return
    apply({ at: { ...frozen([key]), [key]: ahead[1].center + sign * (ahead[1].w / 2 + p.w / 2) } }, [key])
  }

  /** Свой верхний шкаф — на 5 см; у стены B ряд идёт справа налево. */
  const nudgeUpper = (dir: 1 | -1) => {
    if (!freeUpper) return
    const sign = freeUpper.wall === 'B' ? -dir : dir
    const next = freeMoveUpper(state, plan, freeUpper.wall, freeUpper.index, sign * NUDGE, (s) => trial(s))
    if (!next) return
    update(next)
    selectUpperAt(next, freeUpper.wall, next.free?.uppers?.[freeUpper.wall]?.[freeUpper.index]?.c)
  }

  /**
   * Войти в пустую комнату — с пустых стен или из этой кухни. Своя кухня
   * сначала уходит в «Мои варианты»; «Отменить» возвращает её на экран.
   */
  const enterFree = (from: 'empty' | 'kitchen') => {
    const kept = Boolean(ownKitchen) && !ownSaved && addVariant(state, engineRef.current?.snapshot(360, 225) ?? '')
    track()
    setCartResult(null)
    closeSelection()
    setState(from === 'empty' ? emptyRoom(state) : roomFromKitchen(state, plan))
    setFreeWall('A')
    goStep('kitchen')
    setNote({ text: kept ? `${t.free.on} ${t.free.saved}` : t.free.on, act: { label: t.undo, run: undo } })
  }
  const leaveFree = () => {
    track()
    setCartResult(null)
    closeSelection()
    setState(leaveRoom(state))
    setNote({ text: t.free.left, act: { label: t.undo, run: undo } })
  }

  /** Выбрать поставленное — как нажатие в 3D: карточка с размерами и стрелками. */
  const selectItem = (key: ItemKey) => {
    closeMeasure()
    setSelected(SLOT_OF[key] ?? null)
    setMoving({ key })
    // перестройки не будет — размеры показываем сразу
    const d = engineRef.current?.measureItem(key)
    if (d) setMeasure(d.dims)
  }

  /** Поставить с палитры на стену: рядом с выбранным или в первое свободное место. */
  const freePut = (what: FreeAdd, wall: WallId = freeWall): boolean => {
    let base = state
    if (what.kind === 'item') {
      if (positions[what.key]) {
        selectItem(what.key)
        setToast(t.free.exists)
        return false
      }
      // модель выключили («Не нужно») — ставим ту, что по умолчанию
      const slot = SLOT_OF[what.key]
      if (slot && state.picks[slot] === null) base = { ...state, picks: { ...state.picks, [slot]: undefined } }
    }
    const near = moving && 'key' in moving && positions[moving.key]?.wall === wall ? moving.key : undefined
    const res = freeAdd(base, base === state ? plan : trial(base), (s) => trial(s), wall, what, near)
    if ('fail' in res) {
      if (res.fail === 'exists') selectItem(res.key)
      setToast(res.fail === 'noRoom' ? t.free.noRoom(res.free) : t.free.exists)
      return false
    }
    update(res.state)
    if (res.key) {
      closeMeasure()
      setSelected(SLOT_OF[res.key] ?? null)
      setMoving({ key: res.key })
      measureAfterRef.current = res.key
    }
    return true
  }
  /** «Поставить» у техники без места: на выбранную стену, нет места — на другую. */
  const placeSlot = (slot: SlotKind) => {
    const key = PLACE_KEY[slot]
    if (!key) return
    for (const w of [freeWall, ...walls.filter((x) => x !== freeWall)]) {
      const probe = freeAdd(state, plan, (s) => trial(s), w, { kind: 'item', key })
      if ('state' in probe) {
        setFreeWall(w)
        freePut({ kind: 'item', key }, w)
        return
      }
    }
    setToast(t.free.noRoom(0))
  }
  /** Повесить свой верхний шкаф: над выбранным низом этой стены или в первое свободное место. */
  const freeUpperPut = (w: number) => {
    // выбран свой верх — новый рядом с ним; выбран низ — над ним; иначе — стена палитры
    const lower = moving && 'key' in moving ? positions[moving.key] : undefined
    const wall = (freeUpper?.wall ?? (lower && lower.wall !== 'I' ? lower.wall : freeWall)) as WallId
    if (wall === 'I') return
    const near = freeUpper ? { center: freeUpper.c, w: freeUpper.w } : lower && lower.wall === wall ? lower : undefined
    const res = freeAddUpper(state, plan, wall as FreeWall, w, near)
    if ('fail' in res) return setToast(res.fail === 'noRoom' ? t.free.noRoom(res.free) : t.noRoom)
    update(res.state)
    const list = res.state.free?.uppers?.[wall as FreeWall] ?? []
    selectUpperAt(res.state, wall as FreeWall, list[list.length - 1]?.c)
  }
  /** Угловой шкаф: поставить или убрать (снятый угол — с отменой). */
  const toggleCorner = (end: 'start' | 'end', on: boolean) => {
    if (!on) closeSelection()
    update(freeCorner(state, end, on))
  }

  /** Плитки палитры: мойка, техника, колонны, угловые — стоит ли и можно ли поставить. */
  const freeTiles = useMemo((): FreeTile[] => {
    if (!state.free) return []
    const stove = Boolean(chosen.hob?.stove)
    const names = t.free.items
    const out: FreeTile[] = []
    const keys: FixedItem[] = ['sink', 'hob', 'oven', 'dishwasher', 'washer', 'fridge', 'tall', 'pantry', 'pantry2']
    for (const key of keys) {
      // на остров высокое не ставят
      if (freeWall === 'I' && (key === 'fridge' || key === 'tall' || key === 'pantry' || key === 'pantry2')) continue
      const slot = SLOT_OF[key]
      const noModel = slot === 'fridge' || slot === 'dishwasher' || slot === 'washer' ? bySlot[slot].length === 0 : false
      const off = key === 'oven' && stove ? t.stove.ovenInStove : noModel ? t.free.noModel : undefined
      const on = positions[key]?.wall
      out.push({ key, name: key === 'hob' && stove ? t.stove.name : names[key], on, off: on ? undefined : off })
    }
    if (freeWall === 'A') {
      const have = freeCorners(state.shape, state.free)
      for (const end of ['start', 'end'] as const) {
        if (end === 'start' ? state.shape !== 'corner' && state.shape !== 'u' : state.shape !== 'u') continue
        out.push({ key: `corner:${end}`, name: `${names.corner} · ${end === 'start' ? 'B' : 'C'}`, on: have.includes(end) ? 'A' : undefined })
      }
    }
    return out
  }, [state.free, state.shape, chosen.hob, t, freeWall, bySlot, positions])
  const freeGapsNow = state.free ? lowerGaps(state, plan, freeWall) : []
  const freeSpace = Math.round(freeGapsNow.reduce((sum, [a, b]) => sum + b - a, 0))
  /** Пустое место — полками ровно по ширине; сразу выбраны: можно поменять на дверцы или ящики. */
  const fillGap = (gap: [number, number]) => {
    const res = freeFill(state, (s) => trial(s), freeWall, gap)
    if ('fail' in res) return setToast(res.fail === 'noRoom' ? t.free.noRoom(res.free) : t.noRoom)
    update(res.state)
    if (res.key) {
      closeMeasure()
      setMoving({ key: res.key })
      measureAfterRef.current = res.key
      const cab: CabInfo = { key: res.key, row: 'base', variant: 'open' }
      editingRef.current = cab
      setEditing(cab)
    }
  }
  const onFreeTile = (tile: FreeTile) => {
    if (tile.key === 'corner:start' || tile.key === 'corner:end') return toggleCorner(tile.key === 'corner:start' ? 'start' : 'end', !tile.on)
    const key = tile.key as ItemKey
    if (positions[key]) return selectItem(key)
    freePut({ kind: 'item', key: key as FixedItem })
  }

  // Выбранное пальцем можно сразу тащить — без удержания.
  useEffect(() => {
    engineRef.current?.setGrab(grabKey)
  }, [grabKey, engineState])

  const hobHasOven = plan.runs.some((r) => r.modules.some((m) => m.kind === 'hob' && m.oven)) && items.oven !== null
  const movingKey = moving && 'key' in moving ? moving.key : null

  // Клавиши для тех, кто собирает кухню на компьютере.
  const keysRef = useRef<(e: KeyboardEvent) => void>(() => {})
  keysRef.current = (e) => {
    if (e.target instanceof Element && e.target.closest('input, textarea, select, [contenteditable="true"]')) return
    const mod = e.ctrlKey || e.metaKey
    const key = e.key.toLowerCase()
    if (mod && key === 'z') {
      e.preventDefault()
      if (e.shiftKey) redo()
      else undo()
      return
    }
    if (mod && key === 'y') {
      e.preventDefault()
      redo()
      return
    }
    if (mod || e.altKey) return
    if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && (moving || freeUpper)) {
      e.preventDefault()
      nudge(e.key === 'ArrowLeft' ? -1 : 1)
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && ((movingKey && (isCabinet(movingKey) || state.free)) || freeUpper)) {
      e.preventDefault()
      removeCab()
    } else if (e.key === 'Escape') {
      setMenu(false)
      closeSelection()
    } else if (['1', '2', '3', '4'].includes(e.key) && engineState === 'ready') {
      changeView((['angle', 'eye', 'front', 'top'] as View[])[Number(e.key) - 1])
    } else if (e.code === 'KeyS' && full && !isStacked()) {
      // S — показать или спрятать панель настроек в полном экране на компьютере
      e.preventDefault()
      setFullPanel((p) => !p)
    }
  }
  useEffect(() => {
    const on = (e: KeyboardEvent) => keysRef.current(e)
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [])
  /** Имя модуля для подписей и тостов: шкаф с шириной, пустое место, техника. */
  const nameOfKey = (k: ItemKey): string =>
    isGap(k)
      ? t.emptyPlace
      : isUpperCab(k)
        ? t.cabName(Math.round(positions[k]?.w ?? state.upperCabs?.[k]?.w ?? 60))
        : isCabinet(k)
        ? t.cabName(Math.round(state.cabinets?.[k]?.w ?? 60))
        : k === 'pantry' || k === 'pantry2'
          ? t.pantryName
          : k === 'sink'
            ? t.sink
            : k === 'tall'
              ? t.tallName
              : k === 'hob' && hobHasOven
                ? t.hobOven
                : t.slots[SLOT_OF[k]!]
  /** автомодуль: бутылочница и планка — своим названием, не «Шкаф 22 см» (P3) */
  const autoName = (sel: Extract<MoveSel, { cab: CabInfo }>) => {
    const sk = parseSceneKey(sel.cab.key)
    const kind = sk && plan.runs.find((r) => r.id === sk.wall)?.modules.find((mod) => Math.round(mod.x) === sk.x)?.kind
    return kind === 'bottle' || kind === 'filler' ? `${t.dimsKinds[kind]} ${Math.round(sel.w)} ${t.cm}` : t.cabName(Math.round(sel.w))
  }
  const movingName = !moving ? '' : !movingKey ? autoName(moving as Extract<MoveSel, { cab: CabInfo }>) : nameOfKey(movingKey)
  const movingShown = Boolean(moving && (movingKey ? present.has(movingKey) : true))
  const otherWallLabel = !moving
    ? ''
    : state.shape === 'island'
      ? (movingKey ? wallOf(order, movingKey) : (moving as { wall: WallId }).wall) === 'I'
        ? t.toWall
        : t.toIsland
      : t.otherWall
  const canOtherWall = moving ? canChangeWall(state.shape, movingKey ?? 'k1') : false

  // поворот острова и обеденная зона — одни и те же на шаге «Кухня»
  const islandTurnCtl =
    state.shape === 'island' ? (
      <TurnControl t={t} title={t.turn.island} turn={islandTurnOf(state.islandTurn)} onTurn={(deg) => update({ islandTurn: deg || undefined })} />
    ) : null
  const diningCtl = (
    <>
      <div className="kp-oven">
        <span className="kp-switch__text">
          {t.dining.title}
          <small>{t.dining.note}</small>
        </span>
        <div className="kp-seg kp-seg--wide" role="radiogroup" aria-label={t.dining.title}>
          {[undefined, ...DINING_SEATS].map((n) => (
            <button key={n ?? 0} type="button" role="radio" aria-checked={state.dining === n} className="kp-seg__btn" onClick={() => update({ dining: n })}>
              {n ? t.dining.seats(n) : t.dining.none}
            </button>
          ))}
        </div>
      </div>
      {state.dining && (
        <TurnControl t={t} title={t.turn.table} turn={islandTurnOf(state.diningTurn)} onTurn={(deg) => update({ diningTurn: deg || undefined })} />
      )}
    </>
  )

  const freeCard = (
    <>
            {step === 'kitchen' && (pro || state.free) && (
              <section className={`kp-free-entry${state.free ? ' is-on' : ''}`} aria-labelledby="kp-free-title">
                <div className="kp-free-entry__head">
                  <span className="kp-pro__badge">{t.pro.badge}</span>
                  <h3 id="kp-free-title" className="kp-own__title">
                    {t.free.title}
                  </h3>
                </div>
                <p className="kp-note">{state.free ? t.free.on : t.free.lead}</p>
                {state.free ? (
                  <div className="kp-free-entry__row">
                    <button type="button" className="btn btn--ghost btn--sm" onClick={leaveFree}>
                      {t.free.leave}
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="kp-free-entry__row">
                      <button type="button" className="btn btn--primary btn--sm" onClick={() => enterFree('empty')}>
                        {t.free.fromEmpty}
                      </button>
                      <button type="button" className="btn btn--outline btn--sm" onClick={() => enterFree('kitchen')}>
                        {t.free.fromKitchen}
                      </button>
                    </div>
                    <p className="kp-note kp-note--tight">{t.free.fromKitchenNote}</p>
                  </>
                )}
              </section>
            )}
    </>
  )

  // Выбрали шкаф или технику. На телефоне его карточка выезжает снизу —
  // кнопка консультанта на это время прячется, чтобы не закрыть её кнопки.
  const sheetOpen = engineState === 'ready' && built && Boolean(measure || (moving && movingShown))
  useEffect(() => {
    document.documentElement.classList.toggle('kp-picking', sheetOpen)
    if (!sheetOpen) setSelMore(false)
    return () => document.documentElement.classList.remove('kp-picking')
  }, [sheetOpen])

  // Подсказка жестов уходит сама через HINT_MS — до следующего захода или кнопки «?». Насовсем
  // (kp-hint-seen) — только после первого удачного переноса (markHintSeen), как раньше.
  const hintShown = engineState === 'ready' && built && hint && !photo && !sheetOpen
  useEffect(() => {
    if (!hintShown) return
    const id = window.setTimeout(() => setHint(false), HINT_MS)
    return () => window.clearTimeout(id)
  }, [hintShown])

  /*
    Карточка выбранного на компьютере, планшете и телефоне боком стоит над 3D.
    Раньше — всегда слева сверху, и у верхних шкафов закрывала тот самый
    шкаф, который меняют. Теперь из четырёх углов берём тот, где карточка
    меньше всего закрывает выбранное. Не нашлось свободного угла (окно узкое,
    карточка большая) — картинка 3D сама отъезжает, и шкаф встаёт рядом с
    карточкой. Повернули кухню — всё выбирается заново. Пока человек нажимает
    кнопки в самой карточке, она не прыгает: иначе следующее «+» попало бы
    мимо. На телефоне стоя карточка — лист снизу экрана, под 3D.
  */
  const cardRef = useRef<HTMLDivElement>(null)
  const cardBusyUntil = useRef(0)
  const placeCard = useCallback((force = false) => {
    const card = cardRef.current
    const stage = stageRef.current
    if (!card || !stage) return
    const engine = engineRef.current
    if (isStacked()) {
      card.style.left = ''
      card.style.top = ''
      card.style.maxHeight = ''
      engine?.setShift(0, 0)
      return
    }
    const first = !card.dataset.placed
    // компьютер с колонкой плана: карточка — в колонке под планом, над 3D её нет —
    // выбранный шкаф ею не закрыт, картинку не сдвигаем (P6, 8–10)
    const planBox = stage.classList.contains('has-col') ? stage.querySelector<HTMLElement>('.kp-plan') : null
    if (planBox) {
      const top = planBox.offsetTop + planBox.offsetHeight + 8
      card.style.left = '8px'
      card.style.top = `${top}px`
      card.style.maxHeight = `${Math.max(120, stage.clientHeight - top - 8)}px`
      card.dataset.placed = '1'
      engine?.setShift(0, 0)
      return
    }
    if (!first && !force && performance.now() < cardBusyUntil.current) return
    // где выбранное стояло бы без сдвига картинки: сдвиг — ровный перенос на экране
    const now = engine?.selectionRect() ?? null
    const was = engine?.getShift() ?? { x: 0, y: 0 }
    const sel = now && { ...now, x: now.x - was.x, y: now.y - was.y }
    // карточка ≤ 30 % холста (P4, 4): выше не растёт, лишнее листается внутри
    const host = hostRef.current
    if (host) card.style.maxHeight = `${Math.max(160, Math.floor((0.3 * host.clientWidth * host.clientHeight) / Math.max(card.offsetWidth, 1)))}px`
    const W = stage.clientWidth
    const H = stage.clientHeight
    const cw = card.offsetWidth
    const ch = card.offsetHeight
    const pad = 14
    const top = pad + (parseFloat(stage.style.getPropertyValue('--kp-tools-h')) || 42) + 10
    // полоса отдельно от карточки (пустое место); внутри карточки она не пол сцены
    const move = stage.querySelector<HTMLElement>('.kp-sel > .kp-move')
    // одно место — справа сверху 3D (слева колонка плана), откуда бы ни выбрали (P2, 8);
    // шкаф не прячется под карточку: сдвигается картинка, а не карточка
    const spots = [{ left: W - pad - cw, top }].filter((p) => p.left >= pad - 1)
    // Каждый угол пробуем как есть и со сдвигом картинки: шкаф встаёт под
    // карточку, над ней, справа или слева, но не уходит за края 3D. Берём, где
    // карточка закрывает меньше всего; сдвиг стоит «штраф», чтобы картинка
    // не ездила ради пары точек.
    const floor = move ? move.offsetTop - 8 : H - pad
    const clamp = (v: number, lo: number, hi: number) => (lo > hi ? 0 : Math.min(hi, Math.max(lo, v)))
    const overlap = (p: { left: number; top: number }, s: { x: number; y: number; w: number; h: number }) => {
      const ix = Math.min(p.left + cw, s.x + s.w) - Math.max(p.left, s.x)
      const iy = Math.min(p.top + ch, s.y + s.h) - Math.max(p.top, s.y)
      return ix > 0 && iy > 0 ? ix * iy : 0
    }
    let best = { spot: spots[0] ?? { left: pad, top }, shift: { x: 0, y: 0 }, cost: Infinity }
    for (const spot of spots.length ? spots : [best.spot]) {
      const tries = [{ x: 0, y: 0 }]
      if (sel) {
        const m = 12
        tries.push(
          { x: 0, y: spot.top + ch + m - sel.y },
          { x: 0, y: spot.top - m - (sel.y + sel.h) },
          { x: spot.left + cw + m - sel.x, y: 0 },
          { x: spot.left - m - (sel.x + sel.w), y: 0 },
        )
      }
      for (const t of tries) {
        // «без сдвига» — как есть; сдвиг — не дальше краёв 3D
        const d =
          sel && (t.x || t.y)
            ? { x: clamp(t.x, pad - sel.x, W - pad - sel.x - sel.w), y: clamp(t.y, pad + 20 - sel.y, floor - sel.y - sel.h) }
            : t
        const covered = sel ? overlap(spot, { ...sel, x: sel.x + d.x, y: sel.y + d.y }) : 0
        const cost = covered + Math.hypot(d.x, d.y) * (sel ? sel.w * sel.h * 0.002 : 0)
        if (cost < best.cost - 1) best = { spot, shift: d, cost }
      }
    }
    engine?.setShift(best.shift.x, best.shift.y)
    // первый раз встаёт сразу, дальше — переезжает плавно
    if (first) card.style.transition = 'none'
    card.style.left = `${Math.round(best.spot.left)}px`
    card.style.top = `${Math.round(best.spot.top)}px`
    if (first) {
      card.dataset.placed = '1'
      requestAnimationFrame(() => (card.style.transition = ''))
    }
  }, [])
  // карточку закрыли — картинка 3D возвращается на место
  useEffect(() => {
    if (!sheetOpen || !measure) engineRef.current?.setShift(0, 0)
  }, [sheetOpen, measure])
  useLayoutEffect(() => {
    if (!sheetOpen) return
    const card = cardRef.current
    const canvas = hostRef.current?.querySelector('.kp-canvas')
    placeCard()
    let timer = 0
    const settle = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => placeCard(true), 250)
    }
    const busy = () => (cardBusyUntil.current = performance.now() + 1500)
    // техника: камера подлетает к ней почти секунду — ставим ещё раз, когда долетела
    const flown = window.setTimeout(() => placeCard(), 900)
    const size = new ResizeObserver(() => placeCard())
    if (card) {
      size.observe(card)
      card.addEventListener('pointerdown', busy)
    }
    canvas?.addEventListener('pointerup', settle)
    canvas?.addEventListener('wheel', settle, { passive: true })
    window.addEventListener('resize', settle)
    return () => {
      window.clearTimeout(timer)
      window.clearTimeout(flown)
      size.disconnect()
      card?.removeEventListener('pointerdown', busy)
      canvas?.removeEventListener('pointerup', settle)
      canvas?.removeEventListener('wheel', settle)
      window.removeEventListener('resize', settle)
    }
  }, [sheetOpen, measure, placeCard])

  // Компьютер: высота редактора — от его места на странице до низа окна (`--kp-work-top`),
  // шапка сайта и заголовок не выталкивают «Дальше» за край (P2, 7).
  useLayoutEffect(() => {
    const root = rootRef.current
    const work = root?.querySelector<HTMLElement>('.kp-work')
    if (!root || !work) return
    const put = () => root.style.setProperty('--kp-work-top', `${Math.round(work.getBoundingClientRect().top + window.scrollY)}px`)
    put()
    const head = new ResizeObserver(put)
    const top = document.querySelector('header')
    if (top) head.observe(top)
    window.addEventListener('resize', put)
    return () => {
      head.disconnect()
      window.removeEventListener('resize', put)
    }
  }, [])

  // Телефон, полный экран: лист выбранного поднимает низ сцены (`--kp-sel-h`) — кухня
  // вписывается в видимую часть 3D, «3D / План» остаётся над листом (P2, 5).
  useLayoutEffect(() => {
    const root = document.documentElement
    const sel = full && sheetOpen && stacked ? document.querySelector<HTMLElement>('.kp-sel') : null
    if (!sel) {
      root.style.removeProperty('--kp-sel-h')
      return
    }
    const put = () => root.style.setProperty('--kp-sel-h', `${Math.round(sel.offsetHeight)}px`)
    put()
    const size = new ResizeObserver(put)
    size.observe(sel)
    return () => {
      size.disconnect()
      root.style.removeProperty('--kp-sel-h')
    }
  }, [full, sheetOpen, stacked])

  // Телефон, полный экран: лист шага (is-panel) лежит поверх 3D — камера вписывает кухню
  // в часть холста над листом (P6, 6); лист закрыли — снова весь холст.
  useLayoutEffect(() => {
    const body = full && fullPanel && stacked ? rootRef.current?.querySelector<HTMLElement>('.kp-body') : null
    const host = hostRef.current
    if (!body || !host) {
      engineRef.current?.setInset(0)
      return
    }
    const put = () => engineRef.current?.setInset(host.getBoundingClientRect().bottom - body.getBoundingClientRect().top)
    put()
    // лист выезжает анимацией — меряем ещё раз, когда встал
    const settled = window.setTimeout(put, 420)
    const size = new ResizeObserver(put)
    size.observe(body)
    size.observe(host)
    return () => {
      window.clearTimeout(settled)
      size.disconnect()
      engineRef.current?.setInset(0)
    }
  }, [full, fullPanel, stacked])

  const openSlot = (slot: SlotKind) => {
    const opening = !(step === 'tech' && open === slot)
    setStep('tech')
    setOpen(opening ? slot : null)
    setSelected(slot)
    engineRef.current?.focus(slot)
    // список вариантов — сразу на виду, а не где-то ниже под итогом
    if (opening) requestAnimationFrame(() => reveal(document.getElementById(`kp-slot-${slot}`), 'steps'))
  }

  // Кладём только то, чего в корзине ещё нет: второе нажатие не удваивает технику (U04).
  const addAll = () => {
    let ok = 0
    let failed = 0
    for (const a of missing) {
      if (cart.add(a.id, 'std', 1)) ok++
      else failed++
    }
    setCartResult({ ok, failed })
  }
  const waText = whatsappText(project, state, shareUrl, lang)
  /** одна ссылка WhatsApp с проектом — для «Итога» покупателя и листа мастера */
  const waHref = whatsappHref(phones[0], waText)

  const download = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 5000)
  }

  /**
   * Фото: кухня рисуется трассировкой лучей — свет, тени и отражения как на
   * настоящей фотографии. Вторая кнопка — выйти обратно в обычное 3D.
   */
  const togglePhoto = async () => {
    const engine = engineRef.current
    if (!engine) return
    if (engine.isPhoto()) {
      engine.stopPhoto()
      return
    }
    if (photoFallback) {
      setPhotoFallback(false)
      return
    }
    // Телефон: трассировки нет (`getTier().pathTrace = false`) — сразу снимок 4K
    // в «Поделиться», без экрана ожидания. `startPhoto` там вернул бы 'failed'
    // как сигнал «нет трассировки», а не как ошибку (ревью 02).
    if (!engine.getTier().pathTrace) return void savePhoto()
    closeSelection()
    setMenu(false)
    setHint(false)
    const res = await engine.startPhoto(setPhoto)
    // панель остаётся: «Сохранить фото» в ней сохранит обычную картинку 4K
    if (res === 'failed') setPhotoFallback(true)
  }

  /**
   * Большое фото 4K файлом. На телефоне и там, где трассировка не работает, —
   * обычная картинка 4K. Фото отменили крестиком — ничего не скачиваем.
   */
  const savePhoto = async () => {
    const engine = engineRef.current
    if (!engine || saving) return
    setSaving(true)
    let blob: Blob | null = null
    // Телефон — сразу лёгкий путь: большое фото трассировкой копится там
    // долго и может не поместиться в память. Трассировка уже не пошла —
    // тоже он, без второй попытки.
    const light = photoFallback || !engine.getTier().pathTrace
    const started = light ? 'failed' : engine.isPhoto() ? 'ok' : await engine.startPhoto(setPhoto)
    if (started === 'ok') blob = await engine.photoBig()
    else if (started === 'failed') {
      // не пошла только что — панель остаётся с обычной картинкой
      if (!light) setPhotoFallback(true)
      // даём кнопке показать «Готовим фото…», потом рисуем
      await new Promise((r) => setTimeout(r, 30))
      blob = await engine.snapshot4k()
    }
    setSaving(false)
    if (!blob) return
    const name = started === 'ok' ? 'smarket-kitchen-photo-4k.jpg' : 'smarket-kitchen-4k.jpg'
    // Телефон и наше приложение — окно «Поделиться»: в нём «Сохранить
    // изображение» (в «Фото»), WhatsApp, Telegram. Скачивание файла в
    // приложении S Маркет не работает совсем: ссылка молча ничего не делает.
    if (window.matchMedia('(pointer: coarse)').matches || inAppBrowser() || inNativeApp()) {
      const file = new File([blob], name, { type: 'image/jpeg' })
      const res = await shareFile(file, '', name)
      if (res === 'ok') return
      // фото рисовалось долго — телефон просит нажать ещё раз
      if (res === 'late') return setNote({ text: t.photoReady, act: { label: t.photoSaveNow, run: () => void shareFile(file, '', name) } })
    }
    download(blob, name)
    // во встроенном браузере Instagram или Telegram файл часто молча не сохраняется
    if (inAppBrowser()) setToast(t.photoInApp)
  }


  const closeMeasure = () => {
    setMeasure(null)
    setEditing(null)
    engineRef.current?.showMeasure(null)
  }
  /** Одно нажатие «закрыть» убирает всё про выбранное: размеры, фасады, перестановку. */
  const closeSelection = () => {
    closeMeasure()
    setMoving(null)
    setSelected(null)
  }
  // «Итог» — проверка всей кухни: карточка шкафа поверх 3D там не нужна (P4, 12)
  useEffect(() => {
    if (step === 'total') closeSelection()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])
  // ряд «Какой сделать этот шкаф?» — к выделенному типу при каждом выборе (P4, 10); страницу не листаем
  useEffect(() => {
    const on = cardRef.current?.querySelector<HTMLElement>('.kp-fronts__list [aria-checked="true"]')
    const list = on?.parentElement
    if (!on || !list) return
    const a = on.getBoundingClientRect()
    const b = list.getBoundingClientRect()
    if (a.left >= b.left && a.right <= b.right) return
    list.scrollLeft += a.left - b.left - (b.width - a.width) / 2
  }, [editing?.key, editing?.variant])

  const measureTitle = (d: Dims) => {
    if (d.kind === 'appliance' && d.slot) return items[d.slot]?.name ?? t.slots[d.slot]
    return `${t.dimsKinds[d.kind]} ${fmt(d.w)} ${t.cm}`
  }
  const mwBuiltIn = Boolean(items.microwave?.builtIn)
  /** выбрана отдельностоящая плита: духовка в ней (то же правило, что в order.ts) */
  const stoveOn = Boolean(chosen.hob?.stove)
  const ovenPlace: 'hob' | 'tall' | 'apart' = state.ovenApart ? 'apart' : state.tallOven || mwBuiltIn ? 'tall' : 'hob'

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: t.title, url: shareUrl })
        return
      } catch {
        // отменили — просто скопируем ссылку
      }
    }
    try {
      await navigator.clipboard.writeText(shareUrl)
      setToast(t.linkCopied)
    } catch {
      setToast(t.copyFailed)
    }
  }

  /* ───────── мои варианты ───────── */

  useEffect(() => {
    try {
      setVariants(parseVariants(window.localStorage.getItem('kp-variants')))
    } catch {
      // нет доступа к хранилищу — просто без сохранённых вариантов
    }
  }, [])
  // Открыли по ссылке, а своя кухня была другой — кладём её в «Мои варианты»
  // (варианты к этому времени уже прочитаны), «Отменить» возвращает её на экран.
  useEffect(() => {
    if (!linkKeep) return
    setLinkKeep(null)
    const prev = linkKeep
    if (variants.some((v) => v.q === queryFromState(prev))) return
    const dropped = variants.length >= 8 ? variants[variants.length - 1].name : null
    if (!addVariant(prev, '')) return setToast(t.variantFailed)
    setNote({
      text: dropped ? `${t.gallery.keptLast} ${t.gallery.droppedOld(dropped)}` : t.gallery.keptLast,
      act: {
        label: t.undo,
        run: () => {
          track()
          setState(prev)
        },
      },
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkKeep])
  /** Сохраняет список; false — браузер не дал записать (приватный режим, нет места). */
  const storeVariants = (list: Variant[]): boolean => {
    setVariants(list)
    try {
      window.localStorage.setItem('kp-variants', JSON.stringify(list))
      return true
    } catch {
      return false
    }
  }
  /** Кладёт кухню в «Мои варианты»; img — кадр 3D, пусто — без картинки. */
  const addVariant = (s: KitchenState, img: string): boolean => {
    const n = variants.reduce((max, v) => Math.max(max, Number(v.name.replace(/\D/g, '')) || 0), 0) + 1
    const st = getStyle(s.style)
    const label = `${t.shapes[s.shape][0]} · ${lang === 'ky' ? st.ky : st.ru}`
    return storeVariants([{ id: Date.now().toString(36), name: t.variantName(n), label, q: queryFromState(s), img, at: Date.now() }, ...variants].slice(0, 8))
  }
  const saveVariant = () => {
    const saved = addVariant(state, engineRef.current?.snapshot(360, 225) ?? '')
    // «Показать всем?» — только когда есть кадр 3D; иначе сразу говорим, почему нельзя
    setToast(saved ? (galleryWhy ? `${t.variantSaved}. ${galleryWhy}` : t.variantSaved) : t.variantFailed)
    setAskGallery(saved && !galleryWhy)
  }
  /** почему «В галерею» сейчас недоступна; null — можно */
  const galleryWhy = fail3d
    ? t.gallery.no3d
    : engineState === 'lost'
      ? t.gallery.lost3d
      : engineState !== 'ready'
        ? t.gallery.wait3d
        : state.free && plan.runs.every((r) => r.modules.length === 0)
          ? t.free.empty
          : null

  /* ───────── готовые кухни ───────── */

  /** Своя кухня (не по умолчанию); нетронутую готовую узнаёт полоса. */
  const ownQuery = queryFromState(resume ?? state)
  const ownKitchen = ownQuery !== queryFromState(DEFAULT_STATE) ? ownQuery : null
  /** своя уже лежит в «Мои варианты» — второй раз не кладём */
  const ownSaved = variants.some((v) => v.q === ownQuery)
  /** Открыть готовую (или из галереи) как по ссылке; save — своя сначала уходит в «Мои варианты». */
  const openReady = (q: string, name: string, save: boolean) => {
    if (save && !ownSaved && !addVariant(resume ?? state, resume ? '' : (engineRef.current?.snapshot(360, 225) ?? ''))) {
      // не записалось (приватный режим, нет места) — свою кухню не теряем
      setToast(t.variantFailed)
      return
    }
    const { state: next, missing: gone } = openQuery(q, appliances)
    track(resume ?? undefined)
    setResume(null)
    setCartResult(null)
    setState(next)
    const text = gone.length > 0 ? t.gallery.missing(gone.map((s) => t.slots[s]).join(', ')) : t.gallery.opened(name)
    setNote({ text, act: { label: t.undo, run: undo } })
  }
  const openVariant = (v: Variant) => {
    track()
    setCartResult(null)
    setState(stateFromQuery(new URLSearchParams(v.q), byId))
    rootRef.current?.querySelector('.kp-work')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  /* ───────── проверка проекта ───────── */

  // толщина столешницы та же, что в 3D (выбранная или стиля), — для проверки «плита вровень со столешницей»
  const checks = useMemo(() => checkProject(plan, { hoodOver, topCm: lookStyle.topCm, upperBottom }), [plan, hoodOver, lookStyle.topCm, upperBottom])
  const checksOk = checks.filter((c) => c.level === 'ok').length
  const checkText = (c: Check): string => {
    // при плите правила те же, что у варочной панели, — но говорим «плита»
    const st = plan.stove ? t.stove.checks : null
    switch (c.id) {
      case 'triangle':
        return c.level === 'ok' ? t.checks.triangleOk(c.sum) : t.checks.triangleWarn(c.legs, c.sum)
      case 'workLine':
        return c.level === 'ok' ? t.checks.workLineOk : t.checks.workLineWarn(c.legs, c.order, TRIANGLE.legMax)
      case 'hobSides':
        if (st) return c.level === 'ok' ? st.sidesOk(c.left, c.right) : st.sidesWarn(c.left, c.right)
        return c.level === 'ok' ? t.checks.hobSidesOk(c.left, c.right) : t.checks.hobSidesWarn(c.left, c.right)
      case 'hobWindow':
        return st ? st.window : t.checks.hobWindow
      case 'hobFridge':
        return st ? st.fridge(c.gap) : t.checks.hobFridge(c.gap)
      case 'sinkDw':
        return c.level === 'ok' ? t.checks.sinkDwOk : t.checks.sinkDwWarn
      case 'sinkWindow':
        return t.checks.sinkWindow
      case 'fits': {
        if (c.level === 'ok') return t.checks.fitsOk
        // вытяжку над панелью у окна стена длиннее не спасёт — говорим про панель
        const hoods = plan.dropped.filter((d) => d.slot === 'hood').length
        const rest = c.count - hoods
        return [hoods > 0 ? t.hoodNoPlace : '', rest > 0 ? t.checks.fitsWarn(rest) : ''].filter(Boolean).join(' ')
      }
      case 'tallUnderWindow':
        return t.checks.tallUnderWindow
      case 'cornerBlocked':
        return t.checks.cornerBlocked(c.wall)
      case 'applianceWider':
        return t.checks.applianceWider(c.slot, c.w, c.room)
      case 'underCounterHeight':
        return t.checks.underCounter(c.slot, c.h, c.max)
      case 'hoodHeight':
        if (st) return c.level === 'ok' ? st.hoodOk(c.over, c.gas) : st.hoodWarn(c.over, c.min, c.gas)
        return c.level === 'ok' ? t.checks.hoodHeightOk(c.over, c.gas) : t.checks.hoodHeightWarn(c.over, c.min, c.gas)
      case 'stoveHeight':
        return c.level === 'ok' ? t.stove.heightOk(c.h, c.top) : t.stove.heightWarn(c.h, c.top)
      case 'upperRaised':
        return t.checks.upperRaised(c.over)
      case 'hoodOffHob':
        return t.checks.hoodOffHob(c.off)
    }
  }

  // техника без размеров в каталоге: мастеру — «размер примерный, уточнить по паспорту»
  const makerText = useMemo(() => makerList(plan, items, t, inProject), [plan, items, t, inProject])
  const copyList = async () => {
    try {
      await navigator.clipboard.writeText(`${t.makerTitle}\n\n${makerText}\n\n${shareUrl}`)
      setToast(t.copied)
    } catch {
      setToast(t.listCopyFailed)
    }
  }

  /* ───────── для мебельщика ───────── */

  // стены одной строкой — та же, что в WhatsApp (order.ts)
  const wallsLine = wallsText(state, lang)
  const [zoomWall, setZoomWall] = useState<string | null>(null)
  const drawing = useMemo(() => {
    if (!spec) return null
    const labels: DrawingLabels = { cm: t.cm, appliance: (slot: string) => t.techShort[slot as SlotKind] ?? slot, ...t.drawing, stove: t.stove.name }
    const winOf = (id: string) => windowFor(plan, id, ceiling, WINDOW)
    const overhang = islandOverhang(spec.runs)
    // один масштаб на все развёртки листа: самый крупный, при котором влезает самая большая стена
    const scale = pickScale((n) => spec.runs.map((r) => elevationSvg(r, spec.heights, labels, winOf(r.id), { scale: n, overhang })))
    const walls = spec.runs.map((r) => ({
      id: r.id,
      title: t.wall(r.id, Math.round(r.length)),
      svg: elevationSvg(r, spec.heights, labels, winOf(r.id), { scale, overhang }),
    }))
    const planLabels = { cm: t.cm, ...t.plan }
    const planScale = pickScale((n) => [planSvg(plan, planLabels, { scale: n, runs: spec.runs })], PLAN_BOX)
    const top = planSvg(plan, planLabels, { scale: planScale, runs: spec.runs })
    const fronts = frontList(spec.runs)
    const cuts = cutList(spec.carcasses, spec.panels)
    const hw = hardware(spec)
    const tops = topList(spec.runs)
    const modules = spec.runs.reduce((s, r) => {
      const m = modulesOf(r)
      return s + m.lower.filter((b) => b.kind !== 'appliance').length + m.upper.filter((b) => b.kind !== 'panel').length
    }, 0)
    const frontsTotal = fronts.reduce((s, f) => s + f.count, 0)
    return { walls, scale, top, planScale, fronts, cuts, hw, tops, modules, frontsTotal }
  }, [spec, plan, ceiling, t])

  /** Отделка словами — для мастера: материал и цвет фасадов, ручки, столешница. */
  const nameOf = (x: { ru: string; ky: string } | undefined) => (x ? (lang === 'ky' ? x.ky : x.ru) : '')
  const frontDescOf = (c: FrontColor) => `${nameOf(FRONT_MATERIALS.find((m) => m.id === c.material))} · ${colorLabel(c, lang)}`
  const frontDesc = (id: string | undefined) => {
    const c = frontColor(id)
    return c ? frontDescOf(c) : ''
  }
  /** свой цвет острова — только у кухни с островом */
  const islandOwn = state.shape === 'island' ? state.islandFacade : undefined
  const finishFacts = () => {
    // кто какого цвета — то же правило, что в WhatsApp (order.ts); здесь ещё материал и «как в стиле» словами
    const fronts = frontsText(state, lang, { asStyle: `${nameOf(style)} · ${nameOf(tone)}`, label: frontDescOf })
    const handleName = handleless
      ? t.handleless
      : `${nameOf(HANDLES.find((h) => h.id === handle))} · ${nameOf(HANDLE_METALS.find((m) => m.id === (state.handleMetal ?? style.metal)))}`
    const topName = topSel ? `${nameOf(TOP_MATERIALS.find((m) => m.id === topSel.material))} · ${nameOf(topSel)}, ${topSel.cm * 10} мм` : ''
    return [
      { label: t.frontsTitle2, value: fronts },
      { label: t.handlesTitle, value: handleName },
      ...(topName ? [{ label: t.topTitle, value: topName }] : []),
      ...(splashSel ? [{ label: t.splashTitle, value: `${nameOf(SPLASH_GROUPS.find((g) => g.id === splashSel.group))} · ${nameOf(splashSel)}` }] : []),
    ]
  }

  /** Что выбрано в каждом разделе отделки — подпись в свёрнутой строке. */
  const ownFront = (id: string | undefined) => (id && id !== 'style' ? frontDesc(id) : '')
  const finishNow = {
    fronts: (() => {
      const lower = ownFront(state.facade) || `${t.asStyle} · ${nameOf(tone)}`
      const both = state.upperFacade ? `${lower} / ${ownFront(state.upperFacade) || t.asStyle}` : lower
      return islandOwn ? `${both} / ${t.finishTarget.island}: ${ownFront(islandOwn)}` : both
    })(),
    handles: handleless
      ? t.handleless
      : `${nameOf(HANDLES.find((h) => h.id === handle))} · ${nameOf(HANDLE_METALS.find((m) => m.id === (state.handleMetal ?? style.metal)))}`,
    top: topSel ? `${nameOf(TOP_MATERIALS.find((m) => m.id === topSel.material))} · ${nameOf(topSel)}` : t.asStyle,
    splash: splashSel ? `${nameOf(SPLASH_GROUPS.find((g) => g.id === splashSel.group))} · ${nameOf(splashSel)}` : t.asStyle,
    floor: nameOf(FLOORS.find((f) => f.id === (state.floor ?? style.floor))),
    walls: nameOf(WALL_COLORS[state.wallColor ?? 0]),
  }

  /* ───────── «Фасады»: для чего красим, выбор цвета (каталог, RAL, декор, поиск) ───────── */
  const tc = t.colors
  const paintTargets = state.shape === 'island' ? (['all', 'lower', 'upper', 'island'] as const) : (['all', 'lower', 'upper'] as const)
  // «Остров» выбран, а кухню сделали без острова — красим всю кухню
  const paintTarget: PaintTarget = paintFor === 'island' && state.shape !== 'island' ? 'all' : paintFor
  /** свой цвет цели сейчас (undefined — «как в стиле» / «как у низа») */
  const paintOwn = state[PAINT_FIELD[paintTarget]]
  // «вся кухня» отмечена, только когда у верха и острова нет своего цвета
  const paintWhole = paintTarget !== 'all' || (!state.upperFacade && !islandOwn)
  const isOn = (id: string) => paintWhole && paintOwn === id
  /** покрасить цель; undefined — снять свой цвет */
  const pickFront = (id: string | undefined) => {
    if (paintTarget === 'all') return update({ facade: id, upperFacade: undefined, islandFacade: undefined })
    const patch: Partial<KitchenState> = {}
    patch[PAINT_FIELD[paintTarget]] = id
    // свой цвет низа: верх, шедший «как низ», остаётся «как в стиле»
    if (paintTarget === 'lower' && id) patch.upperFacade = state.upperFacade ?? 'style'
    update(patch)
  }
  const colorTile = (c: FrontColor, code?: string) => (
    <button key={c.id} type="button" role="radio" aria-checked={isOn(c.id)} className="kp-color" onClick={() => pickFront(c.id)}>
      <span className={`kp-color__chip kp-color__chip--${c.material}`} style={{ background: colorSwatch(c.color, c.texture) }} />
      {code ? (
        <span className="kp-color__txt">
          <span className="kp-color__code">{code}</span>
          <small>{lang === 'ky' ? c.ky : c.ru}</small>
        </span>
      ) : (
        <span>{lang === 'ky' ? c.ky : c.ru}</span>
      )}
    </button>
  )
  // «как в стиле» (у острова — «как у низа»): свой цвет снят
  const lowerNow = frontColor(state.facade)
  const resetTile = (
    <button
      type="button"
      role="radio"
      aria-checked={paintWhole && !paintOwn}
      className="kp-color"
      onClick={() => pickFront(undefined)}
    >
      <span
        className="kp-color__chip"
        style={{ background: paintTarget === 'island' && lowerNow ? colorSwatch(lowerNow.color, lowerNow.texture) : toneSwatch(tone.facade, tone.upper, tone.texture) }}
      />
      <span>{paintTarget === 'island' ? tc.asLower : t.asStyle}</span>
    </button>
  )
  const found = colorQuery.trim() ? findColors(colorQuery, lang) : []
  /** выбран «точный» цвет (RAL / декор) — его плитка идёт первой среди 16 */
  const exactOwn = paintOwn && !FRONT_COLORS.some((c) => c.id === paintOwn) ? (frontColor(paintOwn) ?? null) : null
  // группы RAL: плитки есть только у открытых; пока их не трогали — открыта группа выбранного цвета
  const ralNow = paintOwn ? parseRal(paintOwn) : null
  const ralOpenNow = ralOpen ?? new Set(ralNow ? [ralNow[0]] : [])
  const toggleRal = (digit: string, open: boolean) => {
    if (open === ralOpenNow.has(digit)) return
    const next = new Set(ralOpenNow)
    if (open) next.add(digit)
    else next.delete(digit)
    setRalOpen(next)
  }
  /** код из поля «Код RAL»; false — такого цвета нет (прежний остаётся). Группа цвета раскрывается. */
  const applyRal = (code: string) => {
    if (!frontColor(`ral-${code}`)) return false
    pickFront(`ral-${code}`)
    setRalOpen(new Set(ralOpenNow).add(code[0]))
    return true
  }

  const sheetTables = () => {
    if (!drawing || !spec) return []
    const size = (a: number, b: number) => `${a} × ${b}`
    const handleName = nameOf(HANDLES.find((h) => h.id === handle))
    const hwRows: (string | number)[][] = [
      [t.hw.hinges, `${drawing.hw.hinges} ${t.pcs}`],
      [t.hw.lifts, `${drawing.hw.lifts} ${t.pcs}`],
      [t.hw.runners, `${drawing.hw.runners}`],
      [handleName ? `${t.hw.handles} (${handleName})` : t.hw.handles, `${drawing.hw.handles} ${t.pcs}`],
      [t.hw.push, `${drawing.hw.push} ${t.pcs}`],
      [t.hw.legs, `${drawing.hw.legs} ${t.pcs}`],
      [t.hw.hangers, `${drawing.hw.hangers} ${t.pcs}`],
      // метры и м² — до сотых, как в смете мастера и в Excel: «4,78 м», не «4,8 м»
      [t.hw.gola, `${fmt2(drawing.hw.gola)} ${t.meters}`],
      [t.hw.plinth, `${fmt2(drawing.hw.plinth)} ${t.meters}`],
      [t.hw.splash, `${fmt2(spec.splash)} ${t.m2}`],
    ].filter((r) => !/^0([.,]0+)?\s/.test(String(r[1])))
    return [
      {
        title: t.frontsTitle,
        head: [t.colPart, t.colSize, t.colQty],
        // свой цвет (шкаф над холодильником) — словами, чтобы мастер заказал его отдельно
        rows: drawing.fronts.map((f) => [f.color ? `${t.frontTypes[f.type]} · ${frontDesc(f.color)}` : t.frontTypes[f.type], size(f.w, f.h), f.count]),
      },
      { title: t.cutTitle, head: [t.colPart, t.colSize, t.colQty], rows: drawing.cuts.map((c) => [t.cutNames[c.name], size(c.a, c.b), c.count]) },
      {
        title: t.topTitle,
        head: [t.colWhat, t.colSize, t.colQty],
        rows: drawing.tops.rows.map((r) => [t.topRow(r.run, r.sink, r.hob), `${r.length} × ${r.depth} × ${r.thick}`, 1]),
        note: t.topTotal(fmt(drawing.tops.total)),
      },
      {
        title: t.extrasTitle,
        head: [t.colPart, t.colSize, t.colQty],
        rows: extraList(spec).map((r) => [r.kind === 'stoveOpening' ? t.stove.opening : t.extraNames[r.kind], r.hMax ? `${r.w} × ${r.h}–${r.hMax}` : size(r.w, r.h), r.count]),
      },
      { title: t.hardwareTitle, head: [t.colWhat, t.colQtyUnit], rows: hwRows },
    ]
  }

  /* ───────── пакет мастера: раскрой, листы, кромка, смета ───────── */

  // цены и данные мастера — только в этом браузере (`kp-master`); читаем после гидратации
  const [master, setMaster] = useState<MasterData>(emptyMaster)
  const [masterForm, setMasterForm] = useState<MasterDraft | null>(null)
  const [client, setClient] = useState('')
  const [masterBusy, setMasterBusy] = useState<'xl' | 'est' | null>(null)
  useEffect(() => setMaster(loadMaster()), [])

  /** Раскрой из той же спецификации: отделка как в 3D (фасад, верх, тон стиля), кромка и листы — мастера. */
  const cut = useMemo(() => {
    if (!spec) return null
    const look: CutLook = {
      facade: state.facade,
      upperFacade: state.upperFacade,
      islandFacade: state.shape === 'island' ? state.islandFacade : undefined,
      tone,
      bodyEdge: master.bodyEdge,
      lang,
      tier: t.xl.tier,
    }
    const opts: NestOpts = { sheets: master.sheets }
    try {
      const parts = cutParts(spec, look)
      const nested = nest(parts, opts)
      return { ok: true as const, look, opts, nested, edges: edgeTotals(parts), est: estimate(parts, nested, spec, master.prices) }
    } catch {
      // неизвестная отделка, фасад без размеров — блок «Мастеру» объясняет, страница живёт дальше
      return { ok: false as const }
    }
  }, [spec, state.facade, state.upperFacade, state.shape, state.islandFacade, tone, master, lang, t])

  const sheetName = (r: NestResult) =>
    `${t.xl.kinds[r.material.kind === 'hdf' ? 'hdf' : 'ldsp']}${r.material.thick ? ` ${r.material.thick} ${t.master.mm}` : ''} · ${r.material.label}`
  /** Карта раскроя: каждый лист — прямоугольники деталей с номерами, как в Excel. */
  const cutMaps = (): CutMap[] =>
    cut?.ok
      ? cut.nested.flatMap((r) =>
          r.sheets.map((sh, i) => ({
            title: t.master.mapOf(sheetName(r), i + 1, r.sheets.length),
            L: r.sheetL,
            W: r.sheetW,
            rects: sh.placements.map((p) => ({ x: p.x, y: p.y, l: p.l, w: p.w, label: p.id })),
          })),
        )
      : []

  /** Строки сметы — те же, что в PDF: `estimateLines` из `master.ts`. */
  const estLines = cut?.ok ? estimateLines(cut.est, project, t) : null

  /** Время Бишкека (UTC+6): дата на листе и в имени файла. */
  const bishkekNow = () => {
    const b = new Date(Date.now() + 6 * 3600 * 1000)
    return { b, stamp: b.toISOString().slice(0, 16).replace('T', '-').replace(':', '') }
  }

  /** Файл мастеру: на телефоне — окно «Поделиться», как у PDF мастеру; на компьютере — в «Загрузки». */
  const deliver = async (file: File, saved: string) => {
    if (window.matchMedia('(pointer: coarse)').matches || inAppBrowser()) {
      const res = await shareFile(file, '', file.name)
      if (res === 'ok') return
      if (res === 'late') return setNote({ text: t.master.fileReady, act: { label: t.pdfSendNow, run: () => void shareFile(file, '', file.name) } })
    }
    download(file, file.name)
    setToast(saved)
  }

  const saveExcel = async () => {
    if (!spec || !cut?.ok || masterBusy) return
    setMasterBusy('xl')
    let file: File | null = null
    try {
      const [{ cutWorkbook }, { xlsx }] = await Promise.all([import('@/lib/kitchen/cutExcel'), import('@/lib/kitchen/xlsx')])
      const bytes = xlsx(cutWorkbook(spec, cut.look, t, cut.opts))
      file = new File([bytes as Uint8Array<ArrayBuffer>], `smarket-raskroy-${bishkekNow().stamp}.xlsx`, {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
    } catch {
      file = null
    }
    setMasterBusy(null)
    if (!file) return setToast(t.master.excelFailed)
    await deliver(file, t.master.excelSaved)
  }

  const saveEstimate = async () => {
    if (!estLines || masterBusy) return
    setMasterBusy('est')
    const m = t.master
    const e = estLines
    const { b, stamp } = bishkekNow()
    let file: File | null = null
    try {
      const { estimateSheet } = await import('./pdfSheet')
      const blob = await estimateSheet({
        title: m.pdfTitle,
        date: t.sheetDate(b.getUTCDate(), b.getUTCMonth(), b.getUTCFullYear()),
        master: { name: master.name, phone: master.phone, shop: master.shop },
        lines: [client.trim() ? m.pdfClient(client.trim()) : '', m.pdfKitchen(`${t.shapes[state.shape][0]} · ${wallsLine}`)].filter(Boolean),
        // кол-во — до сотых, как считалась сумма: 4,78 м × 5 500 = 26 290 видно глазами
        table: { title: m.tableTitle, head: e.head, rows: e.rows },
        totals: e.totals,
        missing: e.missing,
        tech: e.tech ? { table: { title: m.techTitle, head: e.tech.head, rows: e.tech.rows, grow: 1 }, total: e.tech.total } : undefined,
        url: shareUrl,
        urlLabel: t.pdfOpen3d,
        shop: { text: m.shopLine(phones[0].display), url: whatsappHref(phones[0]) },
        note: m.note,
        page: t.pdfPage,
      })
      file = new File([blob], `smarket-smeta-${stamp}.pdf`, { type: 'application/pdf' })
    } catch {
      file = null
    }
    setMasterBusy(null)
    if (!file) return setToast(m.estimateFailed)
    await deliver(file, m.estimateSaved)
  }

  /* форма «Мои цены и данные»: черновик, сохраняется кнопкой */
  // фокус: при открытии — в окно, Tab не уходит за окно, при закрытии — на кнопку, которая открыла
  const masterOpener = useRef<HTMLElement | null>(null)
  const masterBox = useRef<HTMLFormElement | null>(null)
  const masterOpen = masterForm !== null
  useEffect(() => {
    if (masterOpen) masterBox.current?.focus()
  }, [masterOpen])
  const closeMasterForm = () => {
    setMasterForm(null)
    const back = masterOpener.current
    requestAnimationFrame(() => back?.focus())
  }
  const masterKeys = (e: ReactKeyEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      closeMasterForm()
      return
    }
    const box = masterBox.current
    if (e.key !== 'Tab' || !box) return
    const list = [...box.querySelectorAll<HTMLElement>('button, input, select, textarea, a[href]')].filter((el) => !el.hasAttribute('disabled'))
    if (!list.length) return
    const first = list[0]
    const last = list[list.length - 1]
    const at = document.activeElement
    if (e.shiftKey && (at === first || at === box || !box.contains(at))) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && (at === last || !box.contains(at))) {
      e.preventDefault()
      first.focus()
    }
  }
  /** размер листа: одна сторона без другой или вне 100…6000 мм — подсказка у поля, а не молчаливый пропуск */
  const sheetHint = (L?: number, W?: number): string | null =>
    (L === undefined) !== (W === undefined)
      ? t.master.sheetHalf
      : [L, W].some((v) => v !== undefined && (v < 100 || v > 6000))
        ? t.master.sheetRange
        : null
  const openMasterForm = (from: HTMLElement) => {
    masterOpener.current = from
    setMasterForm({
      ...master,
      prices: { ...master.prices, edge: { ...master.prices.edge }, front: { ...master.prices.front } },
      sz: { ldspL: master.sheets.ldsp?.L, ldspW: master.sheets.ldsp?.W, hdfL: master.sheets.hdf?.L, hdfW: master.sheets.hdf?.W },
    })
  }
  const draftPrice = (f: MasterDraft, k: PriceField) => (k in EDGE_FIELD ? f.prices.edge?.[EDGE_FIELD[k as keyof typeof EDGE_FIELD]] : f.prices[k as PlainPrice])
  const setDraftPrice = (k: PriceField, v: number | undefined) =>
    setMasterForm((f) =>
      !f
        ? f
        : k in EDGE_FIELD
          ? { ...f, prices: { ...f.prices, edge: { ...f.prices.edge, [EDGE_FIELD[k as keyof typeof EDGE_FIELD]]: v } } }
          : { ...f, prices: { ...f.prices, [k]: v } },
    )
  const saveMasterForm = () => {
    if (!masterForm) return
    const { sz, ...d } = masterForm
    // размер листа не дописан — не сохраняем молча без него: фокус на поле с подсказкой
    const bad = (['ldsp', 'hdf'] as const).find((k) => sheetHint(sz[`${k}L`], sz[`${k}W`]))
    if (bad) {
      const L = sz[`${bad}L`]
      const side = L === undefined || L < 100 || L > 6000 ? 'L' : 'W'
      document.getElementById(`kp-mf-${bad}${side}`)?.focus()
      return
    }
    const size = (L?: number, W?: number) => (L && W && L >= 100 && W >= 100 && L <= 6000 && W <= 6000 ? { L, W } : undefined)
    const ldsp = size(sz.ldspL, sz.ldspW)
    const hdf = size(sz.hdfL, sz.hdfW)
    const next: MasterData = { ...d, name: d.name.trim(), phone: d.phone.trim(), shop: d.shop.trim(), sheets: { ...(ldsp && { ldsp }), ...(hdf && { hdf }) } }
    saveMaster(next)
    setMaster(next)
    closeMasterForm()
    setToast(t.master.saved)
  }
  const numField = (key: string, label: string, value: number | undefined, set: (v: number | undefined) => void, hint?: string) => (
    <label key={key} className="kp-mform__field">
      <span>{label}</span>
      <input
        id={`kp-mf-${key}`}
        aria-invalid={hint ? true : undefined}
        aria-describedby={hint}
        type="number"
        inputMode="decimal"
        min={0}
        step="any"
        value={value ?? ''}
        onChange={(e) => {
          const n = e.target.valueAsNumber
          set(e.target.value !== '' && Number.isFinite(n) && n >= 0 ? n : undefined)
        }}
      />
    </label>
  )

  /* ───────── PDF для мастера ───────── */

  /*
    Лист для мастера — настоящий файл PDF, он делается прямо в телефоне.
    «Скачать» кладёт его в «Загрузки», «Отправить» открывает окно
    «Поделиться» телефона — и PDF уходит в WhatsApp или Telegram файлом.
    Готовый файл помним, пока кухня не изменилась: второе нажатие — сразу.
  */
  const pdfKey = `${lang}|${query}|${master.bodyEdge}|${JSON.stringify(master.sheets)}`
  const pdfDone = useRef<{ key: string; file: File } | null>(null)
  const pdfJob = useRef<{ key: string; job: Promise<File | null> } | null>(null)
  const [pdfBusy, setPdfBusy] = useState(false)

  const makePdf = (): Promise<File | null> => {
    if (!drawing || !spec) return Promise.resolve(null)
    const key = pdfKey
    if (pdfDone.current?.key === key) return Promise.resolve(pdfDone.current.file)
    if (pdfJob.current?.key === key) return pdfJob.current.job
    const engine = engineRef.current
    const job = (async () => {
      const { sheetPdf } = await import('./pdfSheet')
      // дата и имя файла — по времени Бишкека (UTC+6), с часами и минутами
      const bishkek = new Date(Date.now() + 6 * 3600 * 1000)
      const stamp = bishkek.toISOString().slice(0, 16).replace('T', '-').replace(':', '')
      const blob = await sheetPdf({
        title: t.sheetTitle,
        subtitle: t.sheetOf(t.shapes[state.shape][0], lang === 'ky' ? style.ky : style.ru, lang === 'ky' ? tone.ky : tone.ru),
        date: t.sheetDate(bishkek.getUTCDate(), bishkek.getUTCMonth(), bishkek.getUTCFullYear()),
        url: shareUrl,
        urlLabel: t.pdfOpen3d,
        // картинка — всегда общий вид кухни, даже если сейчас подлетели к духовке
        image: engine && built ? engine.sheetShot(1600, 1000) : null,
        facts: [
          { label: t.factWalls, value: wallsLine },
          { label: t.factCeiling, value: `${ceiling} ${t.cm}` },
          { label: t.factModules, value: String(drawing.modules) },
          { label: t.factFronts, value: String(drawing.frontsTotal) },
          { label: t.factTop, value: `${fmt(drawing.tops.total)} ${t.meters}` },
          ...finishFacts(),
        ],
        wallsTitle: t.wallsTitle,
        walls: drawing.walls.map((w) => ({ title: w.title, svg: w.svg })),
        wallsScale: drawing.scale,
        scaleLabel: t.scaleLabel,
        list: { title: t.makerTitle, text: makerText },
        plan: { title: t.planTitle, svg: drawing.top, scale: drawing.planScale },
        contacts: { text: t.pdfContacts(phones[0].display), url: whatsappHref(phones[0]) },
        tables: [
          {
            title: t.techTitle,
            head: [t.colWhat, t.colModel, t.colDims],
            rows: techRows(inProject, t),
            grow: 1,
          },
          ...sheetTables(),
        ],
        cutMaps: { title: t.master.mapTitle, maps: cutMaps() },
        note: t.specNote,
        page: t.pdfPage,
      })
      const file = new File([blob], `smarket-kitchen-${stamp}.pdf`, { type: 'application/pdf' })
      pdfDone.current = { key, file }
      return file
    })()
      .catch(() => null)
      .finally(() => {
        if (pdfJob.current?.key === key) pdfJob.current = null
      })
    pdfJob.current = { key, job }
    return job
  }

  // PDF готовим заранее, пока человек листает лист для мастера: тогда
  // «Отправить» открывает окно «Поделиться» сразу. Если файл делать после
  // нажатия, iPhone может решить, что нажатие было слишком давно.
  const specRef = useRef<HTMLElement>(null)
  const makerRef = useRef<HTMLElement>(null)
  const [pdfNear, setPdfNear] = useState(false)
  useEffect(() => {
    const els = [specRef.current, makerRef.current].filter((el): el is HTMLElement => Boolean(el))
    if (!els.length || typeof IntersectionObserver === 'undefined') return
    const seen = new Set<Element>()
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) seen.add(e.target)
          else seen.delete(e.target)
        }
        setPdfNear(seen.size > 0)
      },
      { rootMargin: '300px 0px' },
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [step])
  const makePdfRef = useRef(makePdf)
  makePdfRef.current = makePdf
  useEffect(() => {
    // 3D ещё собирается — ждём, иначе в PDF не попадёт картинка кухни
    if (!pdfNear || !drawing || engineState === 'loading' || (engineState === 'ready' && !built)) return
    const timer = setTimeout(() => void makePdfRef.current(), 800)
    return () => clearTimeout(timer)
  }, [pdfNear, pdfKey, drawing, engineState, built])

  const withPdf = async (use: (file: File) => Promise<void>) => {
    if (pdfBusy) return
    setPdfBusy(true)
    const file = await makePdf()
    setPdfBusy(false)
    if (!file) {
      setToast(t.pdfFailed)
      return
    }
    await use(file)
  }

  /** PDF готов, но браузер не открыл «Поделиться» без нового нажатия — просим нажать ещё раз. */
  const offerSend = (file: File, text: string) =>
    setNote({ text: t.pdfReady, act: { label: t.pdfSendNow, run: () => void shareFile(file, text, t.sheetTitle) } })

  const savePdf = () =>
    withPdf(async (file) => {
      // во встроенном браузере Instagram или Telegram файлы обычно не скачиваются —
      // там пробуем окно «Поделиться»: из него PDF можно и сохранить, и отправить
      if (inAppBrowser()) {
        const res = await shareFile(file, '', t.sheetTitle)
        if (res === 'ok') return
        if (res === 'late') return offerSend(file, '')
        download(file, file.name)
        setToast(t.pdfInApp)
        return
      }
      download(file, file.name)
      setToast(t.pdfSaved)
    })

  /** Мастеру — PDF и текст со ссылкой. */
  const sendPdf = () => {
    if (!drawing) return
    return withPdf(async (file) => {
      const text = t.sendText(shareUrl, wallsLine)
      const res = await shareFile(file, text, t.sheetTitle)
      if (res === 'ok') return
      if (res === 'late') return offerSend(file, text)
      // Отправлять файлы этот браузер не умеет (компьютер, старый телефон):
      // PDF — в «Загрузки», а текст со ссылкой — в WhatsApp или в буфер.
      download(file, file.name)
      setNote({ text: t.pdfAttach, act: { label: 'WhatsApp', href: `https://wa.me/?text=${encodeURIComponent(text)}` } })
    })
  }

  /* ───────── вёрстка ───────── */

  const steps = STEPS
  const stepIndex = steps.indexOf(step)
  const placedTags = SLOTS.filter((s) => items[s] && built)
  const wallLabels = {
    a: `A · ${state.a} ${t.cm}`,
    b: state.shape === 'corner' || state.shape === 'u' ? `B · ${state.b} ${t.cm}` : undefined,
    c: state.shape === 'u' ? `C · ${state.c} ${t.cm}` : undefined,
  }
  /** план на экране: колонкой (широкий экран) или вместо 3D; на фото — никогда */
  const planShown = !photo && !photoFallback && (planCol || scene === 'plan')
  /** ряд перестановки выбранного: ← → · на другую стену · ×; «+» у пустого места */
  const moveBar = (
    <div className="kp-move" role="group" aria-label={movingName}>
      <span className="kp-move__name">
        {movingName}
        <small>{t.moveHint2}</small>
      </span>
      {/* выбрано пустое место: «+» — что сюда поставить */}
      {movingKey && isGap(movingKey) && (
        <button
          type="button"
          className="kp-move__btn kp-move__add"
          aria-label={t.plus.btn}
          title={t.plus.btn}
          onClick={(e) => {
            const p = positions[movingKey]
            if (p) openAdd({ wall: p.wall, cm: p.center, gap: movingKey }, { x: e.clientX, y: e.clientY })
          }}
        >
          +
        </button>
      )}
      {/* по 5 см; держите кнопку — едет дальше; упёрлось — перепрыгнет соседа */}
      <button
        type="button"
        className="kp-move__btn"
        aria-label={t.moveLeft}
        title={t.moveLeft}
        onPointerDown={(e) => {
          if (e.button === 0) startRepeat(-1)
        }}
        onPointerUp={stopRepeat}
        onPointerLeave={stopRepeat}
        onPointerCancel={stopRepeat}
        onClick={(e) => {
          // клавиатура и программы чтения экрана нажимают без пальца (detail = 0)
          if (e.detail === 0) nudge(-1)
        }}
      >
        <IconArrow flip />
      </button>
      <button
        type="button"
        className="kp-move__btn"
        aria-label={t.moveRight}
        title={t.moveRight}
        onPointerDown={(e) => {
          if (e.button === 0) startRepeat(1)
        }}
        onPointerUp={stopRepeat}
        onPointerLeave={stopRepeat}
        onPointerCancel={stopRepeat}
        onClick={(e) => {
          if (e.detail === 0) nudge(1)
        }}
      >
        <IconArrow />
      </button>
      {canOtherWall && (
        <button type="button" className="kp-move__wall" onClick={toOtherWall}>
          {otherWallLabel}
        </button>
      )}
      <button type="button" className="kp-move__btn kp-move__close" aria-label={t.close} onClick={closeSelection}>
        <IconClose />
      </button>
    </div>
  )
  /** план ВМЕСТО 3D (узкий экран): только тогда прячем ценники и подписи 3D; в колонке 3D живёт со всеми метками */
  const planOver = planShown && !planCol
  useEffect(() => {
    planShownRef.current = planShown
  }, [planShown])
  const editOptions: FrontVariant[] = editing ? (editing.row === 'base' ? BASE_FRONTS : editing.fridge || editing.column ? OVER_FRIDGE_FRONTS : UPPER_FRONTS) : []
  const frontLabel = (v: FrontVariant) =>
    editing?.fridge || editing?.column
      ? (t.overFridgeFronts[v as keyof typeof t.overFridgeFronts] ?? '')
      : editing?.row === 'upper'
        ? t.upperFronts[v as keyof typeof t.upperFronts]
        : t.baseFronts[v as keyof typeof t.baseFronts]
  // цвет фасада шкафа над холодильником: у открытого фасада нет — и цвета тоже
  const overFridgeColors = Boolean(editing?.fridge && editing.variant !== 'open')
  // вкладка материала: выбранная руками, иначе — материал уже выбранного цвета
  const ofMatShown: FrontMaterial = ofMat ?? frontColor(state.overFridgeFacade)?.material ?? 'laminate'
  // «как у гарнитура» — образец того цвета, который у верха сейчас
  const kitchenUpper = state.upperFacade === 'style' ? undefined : frontColor(state.upperFacade ?? state.facade)
  const kitchenUpperSwatch = kitchenUpper
    ? colorSwatch(kitchenUpper.color, kitchenUpper.texture)
    : toneSwatch(tone.upper ?? tone.facade, undefined, tone.upper ? tone.upperTexture : tone.texture)

  /** «Коротко: что где стоит» — одна разметка для «Итога» покупателя и листа мастера (ревью 05). */
  const makerSection = () => (
      <section className="kp-maker" aria-labelledby="kp-maker-title" ref={makerRef}>
        <div className="kp-maker__text">
          <h2 id="kp-maker-title" className="kp-maker__title kp-maker__title--small">
            {t.makerTitle}
          </h2>
          {masterPage && <pre className="kp-maker__list">{makerText}</pre>}
          <div className="kp-maker__actions">
            {masterPage && (
              <button type="button" className="btn btn--outline btn--sm" onClick={copyList}>
                {t.copy}
              </button>
            )}
            <button type="button" className="btn btn--outline btn--sm" onClick={() => void share()}>
              {t.share}
            </button>
            {!masterPage && (
              <button
                type="button"
                className="btn btn--outline btn--sm"
                onClick={() => setPublishing(true)}
                disabled={galleryWhy !== null}
                title={galleryWhy ?? undefined}
              >
                {t.gallery.toGallery}
              </button>
            )}
            {/* покупателю — один WhatsApp (в .kp-sum); мастеру ссылка остаётся */}
            {masterPage && (
              <a className="btn btn--ghost btn--sm" href={waHref} target="_blank" rel="noopener noreferrer">
                {t.ask}
              </a>
            )}
          </div>
          {!masterPage && galleryWhy && <p className="kp-note">{galleryWhy}</p>}
        </div>
        <PlanSketch plan={plan} labels={wallLabels} showWidths names={t.planNames} modules={t.modules} className="kp-maker__sketch" />
      </section>
  )

  return (
    <div
      className={`kp${masterPage ? ' kp--master' : ''}${full ? ' kp--full' : ''}${full && fullPanel ? ' is-panel' : ''}${stacked && !masterPage ? ' kp--bar' : ''}${step === 'total' ? ' is-total' : ''}${sheetOpen || add ? ' is-picking' : ''}`}
      ref={rootRef}
      onKeyDown={groupKeys}
    >
      <header className="kp-head">
        <h1 className="kp-head__title">{masterPage ? t.masterPageTitle : t.title}</h1>
        <p className="kp-head__lead">{masterPage ? t.masterPageLead : t.lead}</p>
        {masterPage && (
          <Link href={`/${lang}/kitchen?${query}`} className="kp-head__back">
            ← {t.masterBack}
          </Link>
        )}
      </header>

      <div className="kp-work">
        <div className={`kp-stage${planOver ? ' is-plan' : ''}${planCol ? ' has-col' : ''}`} ref={stageRef}>
          {/* сюда движок кладёт холст; на телефоне под ним остаётся полоса видов */}
          <div className="kp-scene" ref={hostRef} />
          {/* план сверху: поверх 3D на узком экране, колонкой слева — на широком; выбор и предпросмотр общие */}
          {planShown && (
            <PlanView
              plan={plan}
              selected={grabKey}
              preview={preview}
              onPick={pickFromPlan}
              onDrag={(phase, key, wall, cm, grab) => onDragRef.current(phase, key, wall, cm, grab, 'plan')}
              onAdd={openAdd}
              labels={wallLabels}
              names={t.planNames}
              cm={t.cm}
              addLabel={t.plus.btn}
              fit={planFit}
              fitLabel={t.planFit}
              ariaLabel={t.planViewTitle}
              facade={tone.facade}
            />
          )}
          {add && (
            <div className="kp-add" role="menu" aria-label={t.plus.title} style={{ '--kp-add-x': `${add.x}px`, '--kp-add-y': `${add.y}px` } as React.CSSProperties} ref={addRef}>
              <span className="kp-add__title">
                {add.failed ? (add.target.gap && add.need ? t.plus.noFit(add.need) : t.plus.noGap) : add.gapW ? `${t.plus.title} · ${t.plus.gap(fmt(add.gapW))}` : t.plus.title}
              </span>
              {add.failed ? (
                <>
                  <button type="button" role="menuitem" className="kp-add__btn" onClick={() => addNarrow(add)}>
                    {t.plus.narrowAll}
                  </button>
                  <button type="button" role="menuitem" className="kp-add__btn" onClick={() => addOtherWall(add)}>
                    {t.plus.otherWall}
                  </button>
                </>
              ) : (
                ADD_ITEMS.filter((k) => add.target.gap || (k !== 'strip' && k !== 'fill')).map((k) => {
                  const w = add.widths?.[k]
                  return (
                    <button key={k} type="button" role="menuitem" className="kp-add__btn" data-add-kind={k} data-add-w={w ?? undefined} onClick={() => addFrom(add, k)}>
                      <AddIcon kind={k} />
                      <span className="kp-add__name">{t.plus[k]}</span>
                      {w != null && (
                        <span className="kp-add__w">
                          {fmt(w)} {t.cm}
                        </span>
                      )}
                    </button>
                  )
                })
              )}
              <button type="button" className="kp-add__close" aria-label={t.close} onClick={() => setAdd(null)}>
                <IconClose />
              </button>
            </div>
          )}
          {/*
            Телефон стоя: полоса под 3D — сплошной фон для переключателя видов
            (он остаётся в строке инструментов и встаёт сюда абсолютно) и место
            справа под кнопку консультанта. На картинке кнопок внизу нет —
            кухню крутят, не задевая их. На компьютере полосы нет.
          */}
          <div className="kp-stage__bar" aria-hidden="true" />
          {/* камеру увели далеко, вверх или за кухню — один нажим возвращает исходный кадр (двойной тап по пустому — то же) */}
          {built && !camHome && !planOver && !photo && (
            <button type="button" className="kp-fit3d" onClick={() => engineRef.current?.showAll()}>
              {t.planFit}
            </button>
          )}
          {engineState !== 'error' && engineState !== 'lost' && !built && (
            <div className="kp-loading" role="status">
              <span className="kp-loading__bar" />
              {t.loading}
            </div>
          )}
          {engineState === 'error' && (
            <div className="kp-fallback">
              <p>
                {fail3d === 'load' ? t.fail3dLoad : fail3d === 'start' ? t.fail3dStart : inAppBrowser() ? t.fail3dInApp : t.noWebgl}
                {fail3d !== 'no-webgl2' || inAppBrowser() ? ` ${t.fail3dRest}` : ''}
              </p>
              {inAppBrowser() && chromeIntent() && (
                <a className="btn btn--primary btn--sm" href={chromeIntent() ?? undefined}>
                  {t.openInChrome}
                </a>
              )}
              {inAppBrowser() && !chromeIntent() && <p className="kp-fallback__hint">{t.openInSafariHint}</p>}
              {fail3d !== 'no-webgl2' && (
                <button
                  type="button"
                  className="btn btn--outline btn--sm"
                  onClick={() => {
                    restarts.current = 0
                    setFail3d(null)
                    setEngineState('loading')
                    setEngineKey((k) => k + 1)
                  }}
                >
                  {t.retry3d}
                </button>
              )}
              {/* по коду владелец со скриншота видит, что именно случилось */}
              {fail3d && (
                <small className="kp-fallback__code">
                  {t.fail3dCode}: {fail3d}
                </small>
              )}
            </div>
          )}
          {engineState === 'lost' && (
            <div className="kp-fallback">
              <p>{t.lost3d}</p>
              <button
                type="button"
                className="btn btn--primary btn--sm"
                onClick={() => {
                  restarts.current = 0
                  setEngineState('loading')
                  setEngineKey((k) => k + 1)
                }}
              >
                {t.restart3d}
              </button>
            </div>
          )}

          {engineState === 'ready' && built && (
            <div className="kp-tags">
              {/* пока показаны размеры выбранного, ценники молчат — иначе цифры ложатся друг на друга */}
              {prices &&
                view !== 'top' &&
                !measure &&
                !photo &&
                placedTags.map((slot) => {
                  const a = items[slot]!
                  return (
                    <button
                      key={slot}
                      type="button"
                      className={`kp-tag${selected === slot ? ' is-on' : ''}`}
                      data-slot={slot}
                      ref={(el) => engineRef.current?.setTag(slot, el)}
                      onClick={() => openSlot(slot)}
                      aria-label={`${a.stove ? t.stove.name : t.slots[slot]}: ${a.name}, ${formatSom(a.price)}. ${t.pickHint}`}
                    >
                      <span className="kp-tag__in">
                        <span className="kp-tag__brand">{a.brand || (a.stove ? t.stove.name : t.slots[slot])}</span>
                        <span className="kp-tag__price">{formatSom(a.price)}</span>
                      </span>
                    </button>
                  )
                })}
              {measure &&
                (['w', 'h', 'd'] as const).map((k) => (
                  <span key={k} className={`kp-dim kp-dim--measure kp-dim--m-${k}`} ref={(el) => engineRef.current?.setTag(`m:${k}`, el)}>
                    <span className="kp-dim__in">
                      {fmt(measure[k])} {t.cm}
                    </span>
                  </span>
                ))}
              {/* пока тащат — сколько столешницы останется слева и справа */}
              {dragLabels &&
                (['left', 'right'] as const).map((side) => (
                  <span key={`drag:${side}`} className="kp-dim kp-dim--gap" ref={(el) => engineRef.current?.setTag(`drag:${side}`, el)}>
                    <span className="kp-dim__in">
                      {fmt(dragLabels[side])} {t.cm}
                    </span>
                  </span>
                ))}
              {showDims &&
                !photo &&
                plan.runs.flatMap((run) =>
                  run.modules.map((m, i) =>
                    m.w >= 15 ? (
                      <span key={`mw:${run.id}:${i}`} className="kp-dim kp-dim--mod" ref={(el) => engineRef.current?.setTag(`mw:${run.id}:${i}`, el)}>
                        <span className="kp-dim__in">{fmt(Math.round(m.w * 10) / 10)}</span>
                      </span>
                    ) : null,
                  ),
                )}
              {view === 'top' &&
                (['a', 'b', 'c', 'i'] as const).map((k) => {
                  const value = k === 'a' ? state.a : k === 'b' ? state.b : k === 'c' ? state.c : state.island
                  const shown = k === 'a' || (k === 'b' && wallLabels.b) || (k === 'c' && wallLabels.c) || (k === 'i' && state.shape === 'island')
                  if (!shown) return null
                  return (
                    <span key={k} className="kp-dim" ref={(el) => engineRef.current?.setTag(`dim:${k}`, el)}>
                      <span className="kp-dim__in">
                        {k === 'i' ? '' : `${k.toUpperCase()} · `}
                        {value} {t.cm}
                      </span>
                    </span>
                  )
                })}
            </div>
          )}

          {/*
            Инструменты над 3D. На компьютере — одной строкой. На телефоне
            сверху только «отменить / вернуть», «ещё» и «на весь экран», виды —
            внизу по центру, а вечер, цены, размеры и чёткость — в меню «ещё»
            с подписями: значки без слов покупателю непонятны.
          */}
          {engineState === 'ready' && (
            <div className="kp-tools" role="toolbar" aria-label={t.toolsLabel} ref={toolsRef}>
              {/* два вида: 3D и план; редкие камеры («С высоты глаз», «Спереди») — в «ещё» */}
              <div className="kp-seg kp-views" role="radiogroup" aria-label={t.viewLabel}>
                {(['3d', 'plan'] as const).map((s) => (
                  <button key={s} type="button" role="radio" aria-checked={scene === s} className="kp-seg__btn" data-scene={s} onClick={() => pickScene(s)}>
                    {s === '3d' ? t.view.angle : t.view.plan}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="kp-toggle kp-toggle--icon kp-tools__undo"
                aria-label={t.undo}
                title={`${t.undo} (Ctrl+Z)`}
                disabled={!hist.current.past.length}
                onClick={undo}
              >
                <IconUndo />
              </button>
              <button
                type="button"
                className="kp-toggle kp-toggle--icon kp-tools__redo"
                aria-label={t.redo}
                title={`${t.redo} (Ctrl+Shift+Z)`}
                disabled={!hist.current.future.length}
                onClick={redo}
              >
                <IconUndo redo />
              </button>
              <button
                type="button"
                className="kp-toggle kp-tools__photo"
                aria-pressed={Boolean(photo || photoFallback)}
                title={photo || photoFallback ? t.photoExit : t.photoTitle}
                onClick={togglePhoto}
              >
                <IconCamera />
                <span>{t.photo}</span>
              </button>
              <button
                type="button"
                ref={moreRef}
                className="kp-toggle kp-toggle--icon kp-tools__more"
                aria-expanded={menu}
                aria-controls="kp-tools-extra"
                aria-label={t.toolsMore}
                title={t.toolsMore}
                onClick={() => setMenu((m) => !m)}
              >
                <IconDots />
                <span className="kp-tools__more-text" aria-hidden="true">
                  {t.toolsMoreShort}
                </span>
              </button>
              <div className={`kp-tools__extra${menu ? ' is-open' : ''}`} id="kp-tools-extra" ref={menuRef}>
                <div className="kp-seg kp-camera" role="radiogroup" aria-label={t.camera}>
                  <span className="kp-seg__label" aria-hidden="true">
                    {t.camera}
                  </span>
                  {(['eye', 'front'] as View[]).map((v) => (
                    <button
                      key={v}
                      type="button"
                      role="radio"
                      aria-checked={scene === '3d' && view === v}
                      className="kp-seg__btn"
                      onClick={() => {
                        setScene('3d')
                        changeView(view === v ? 'angle' : v)
                      }}
                    >
                      {t.view[v]}
                    </button>
                  ))}
                </div>
                <button type="button" className="kp-toggle kp-tools__evening" aria-pressed={evening} onClick={() => setEvening((e) => !e)}>
                  {evening ? <IconMoon /> : <IconSun />}
                  <span className="kp-toggle__text">{evening ? t.evening : t.day}</span>
                  <span className="kp-toggle__menu">{t.eveningLight}</span>
                </button>
                <button
                  type="button"
                  className="kp-toggle kp-tools__prices"
                  aria-pressed={prices}
                  onClick={() => {
                    setPrices((p) => !p)
                    setShowDims(false)
                  }}
                >
                  <IconTag />
                  <span className="kp-toggle__text">{t.prices}</span>
                  <span className="kp-toggle__menu">{t.prices}</span>
                </button>
                <button
                  type="button"
                  className="kp-toggle kp-toggle--icon kp-tools__dims"
                  aria-pressed={showDims}
                  aria-label={t.dimsToggle}
                  title={t.dimsToggle}
                  onClick={() => {
                    // размеры и цены вместе закрывают кухню — показываем что-то одно
                    setShowDims((d) => !d)
                    setPrices(showDims)
                  }}
                >
                  <IconRuler />
                  <span className="kp-toggle__menu">{t.dimsToggle}</span>
                </button>
                {/* «?» — подсказка по жестам снова (история 38); переключателя чёткости нет: качество автоматическое */}
                <button
                  type="button"
                  className="kp-toggle kp-tools__help"
                  aria-label={t.helpShow}
                  onClick={() => {
                    setMenu(false)
                    setHint(true)
                  }}
                >
                  <span className="kp-tools__help-mark" aria-hidden="true">
                    ?
                  </span>
                  <span className="kp-toggle__menu">{t.helpShow}</span>
                </button>
              </div>
              <button
                type="button"
                className="kp-toggle kp-toggle--icon kp-tools__full"
                aria-pressed={full}
                aria-label={full ? t.fullOff : t.fullOn}
                title={full ? t.fullOff : t.fullOn}
                onClick={() => toggleFull(!full)}
              >
                {full ? <IconShrink /> : <IconExpand />}
              </button>
              {/* полный экран на компьютере: панель настроек справа от 3D — открыть или спрятать (клавиша S) */}
              {full && (
                <button
                  type="button"
                  className="kp-toggle kp-tools__panel"
                  aria-pressed={fullPanel}
                  aria-controls="kp-panel"
                  title={`${t.panelToggle} (S)`}
                  onClick={() => setFullPanel((p) => !p)}
                >
                  <IconPanel />
                  <span>{t.panelToggle}</span>
                </button>
              )}
            </div>
          )}

          {/*
            Выбранный шкаф или техника: размеры, фасады, ширина, перестановка.
            На компьютере — карточка сверху и полоска снизу 3D; на телефоне
            всё вместе выезжает снизу экрана, а 3D остаётся открытым.
          */}
          {sheetOpen && (
            <div className="kp-sel">
              {measure && (
                <div
                  ref={cardRef}
                  className={`kp-size-card${editing || widthCtl ? ' kp-size-card--edit' : ''}`}
                  role="group"
                  aria-label={measureTitle(measure)}
                >
                  <span className="kp-size-card__title">{measureTitle(measure)}</span>
                  <span className="kp-size-card__nums">
                    {fmt(measure.w)} × {fmt(measure.h)} × {fmt(measure.d)} {t.cm}
                    <small className="kp-size-card__abbr" aria-hidden="true">
                      {t.sizeAxesShort}
                    </small>
                  </span>
                  <span className="kp-size-card__axes">{t.sizeAxes}</span>
                  <button type="button" className="kp-size-card__close" aria-label={t.close} onClick={closeSelection}>
                    <IconClose />
                  </button>
                  {editing && !editing.narrow && (
                    <div className="kp-fronts" role="radiogroup" aria-label={t.cabAsk}>
                      {/* колонна с духовкой: у верха и у нижнего шкафа — свой выбор */}
                      <span className="kp-fronts__ask">{editing.key === 'tallup' ? t.tallUpAsk : editing.key === 'tall' ? t.tallLowAsk : t.cabAsk}</span>
                      <div className="kp-fronts__list">
                        {editOptions.map((v) => (
                          <button
                            key={v}
                            type="button"
                            role="radio"
                            aria-checked={editing.variant === v}
                            className="kp-front-opt"
                            onClick={() => editing.variant !== v && setFront(editing.key, v)}
                          >
                            <FrontIcon variant={v} row={editing.row} />
                            <span>{frontLabel(v)}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* ширина — у каждого шкафа, у мойки и пенала; соседние шкафы подстраиваются */}
                  {widthCtl && (
                    <div className="kp-cabw">
                      <span className="kp-cabw__label">
                        {t.widthLabel}
                        {editing?.row === 'upper' && !freeUpper && <small>{t.widthWithLower}</small>}
                      </span>
                      <button
                        type="button"
                        className="kp-size__step"
                        aria-label={`${t.less}: ${t.widthLabel}`}
                        disabled={widthCtl.value <= widthCtl.min}
                        onClick={() => setWidth(-1)}
                      >
                        −
                      </button>
                      <output className="kp-counter__value" aria-live="polite">
                        {widthCtl.value} {t.cm}
                      </output>
                      <button
                        type="button"
                        className="kp-size__step"
                        aria-label={`${t.more}: ${t.widthLabel}`}
                        disabled={widthCtl.value >= widthCtl.max}
                        onClick={() => setWidth(1)}
                      >
                        +
                      </button>
                      {movingKey && isCabinet(movingKey) && (
                        <button type="button" className="kp-cabw__remove" onClick={removeCab}>
                          {t.removeCab}
                        </button>
                      )}
                    </div>
                  )}
                  {/* телефон: лист ≤ 40svh — тип, ширина, перемещение; петли, высота и цвет над холодильником — за «Ещё параметры» */}
                  {stacked && (hingeKey || heightCtl || overFridgeColors) && (
                    <button type="button" className="kp-sel__more" aria-expanded={selMore} onClick={() => setSelMore((m) => !m)}>
                      {selMore ? t.lessParams : t.moreParams}
                    </button>
                  )}
                  {/* в какую сторону открывается дверца — как удобнее самому */}
                  {hingeKey && (!stacked || selMore) && (
                    <div className="kp-cabw" role="radiogroup" aria-label={t.openLabel}>
                      <span className="kp-cabw__label">{t.openLabel}</span>
                      <div className="kp-seg">
                        <button type="button" role="radio" aria-checked={!doorRight} className="kp-seg__btn" onClick={() => setDoorSide(false)}>
                          ← {t.openLeft}
                        </button>
                        <button type="button" role="radio" aria-checked={doorRight} className="kp-seg__btn" onClick={() => setDoorSide(true)}>
                          {t.openRight} →
                        </button>
                      </div>
                    </div>
                  )}
                  {/* высота пенала и колонны с духовкой — можно ниже потолка */}
                  {heightCtl && (!stacked || selMore) && (
                    <div className="kp-cabw">
                      <span className="kp-cabw__label">{t.heightLabel}</span>
                      <button
                        type="button"
                        className="kp-size__step"
                        aria-label={`${t.less}: ${t.heightLabel}`}
                        disabled={heightCtl.value <= heightCtl.min}
                        onClick={() => setHeight(-1)}
                      >
                        −
                      </button>
                      <output className="kp-counter__value" aria-live="polite">
                        {heightCtl.value} {t.cm}
                      </output>
                      <button
                        type="button"
                        className="kp-size__step"
                        aria-label={`${t.more}: ${t.heightLabel}`}
                        disabled={heightCtl.value >= heightCtl.max}
                        onClick={() => setHeight(1)}
                      >
                        +
                      </button>
                    </div>
                  )}
                  {/* шкаф над холодильником: свой цвет фасада (у стекла — рамки) из того же каталога, что в «Отделке» */}
                  {overFridgeColors && (!stacked || selMore) && (
                    <div className="kp-fronts" role="group" aria-label={editing?.variant === 'glass' ? t.overFridgeGlassColor : t.overFridgeColor}>
                      <span className="kp-fronts__ask">{editing?.variant === 'glass' ? t.overFridgeGlassColor : t.overFridgeColor}</span>
                      <div className="kp-fronts__list" role="tablist" aria-label={t.frontsTitle2}>
                        {FRONT_MATERIALS.map((m) => (
                          <button key={m.id} type="button" role="tab" aria-selected={ofMatShown === m.id} className="kp-chip" onClick={() => setOfMat(m.id)}>
                            {lang === 'ky' ? m.ky : m.ru}
                          </button>
                        ))}
                      </div>
                      <div className="kp-fronts__list" role="radiogroup" aria-label={t.overFridgeColor}>
                        <button
                          type="button"
                          role="radio"
                          aria-checked={!state.overFridgeFacade}
                          className="kp-color"
                          onClick={() => state.overFridgeFacade && update({ overFridgeFacade: undefined })}
                        >
                          <span className="kp-color__chip" style={{ background: kitchenUpperSwatch }} />
                          <span>{t.asKitchen}</span>
                        </button>
                        {FRONT_COLORS.filter((c) => c.material === ofMatShown).map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            role="radio"
                            aria-checked={state.overFridgeFacade === c.id}
                            className="kp-color"
                            onClick={() => state.overFridgeFacade !== c.id && update({ overFridgeFacade: c.id })}
                          >
                            <span className={`kp-color__chip kp-color__chip--${c.material}`} style={{ background: colorSwatch(c.color, c.texture) }} />
                            <span>{lang === 'ky' ? c.ky : c.ru}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* колонна с духовкой: нижний шкаф — ниже или выше, сама колонна не меняется */}
                  {baseCtl && (
                    <div className="kp-cabw">
                      <span className="kp-cabw__label">
                        {t.tallBaseLabel}
                        <small>{t.tallBaseNote}</small>
                      </span>
                      <button
                        type="button"
                        className="kp-size__step"
                        aria-label={`${t.less}: ${t.tallBaseLabel}`}
                        disabled={baseCtl.value <= baseCtl.min}
                        onClick={() => setBase(-1)}
                      >
                        −
                      </button>
                      <output className="kp-counter__value" aria-live="polite">
                        {baseCtl.value} {t.cm}
                      </output>
                      <button
                        type="button"
                        className="kp-size__step"
                        aria-label={`${t.more}: ${t.tallBaseLabel}`}
                        disabled={baseCtl.value >= baseCtl.max}
                        onClick={() => setBase(1)}
                      >
                        +
                      </button>
                    </div>
                  )}
                  {moving && movingShown && !stacked && !freeCornerSel && !freeUpper && moveBar}
                </div>
              )}

              {freeCornerSel && (
                <div className="kp-move" role="group" aria-label={t.free.items.corner}>
                  <span className="kp-move__name">{t.free.items.corner}</span>
                  <button type="button" className="kp-move__wall" onClick={() => toggleCorner(freeCornerSel, false)}>
                    {t.free.removeCorner}
                  </button>
                  <button type="button" className="kp-move__btn kp-move__close" aria-label={t.close} onClick={closeSelection}>
                    <IconClose />
                  </button>
                </div>
              )}
              {freeUpper && (
                <div className="kp-move" role="group" aria-label={t.free.upperName(Math.round(freeUpper.w))}>
                  <span className="kp-move__name">
                    {t.free.upperName(Math.round(freeUpper.w))}
                    <small>{t.moveHint2}</small>
                  </span>
                  <button
                    type="button"
                    className="kp-move__btn"
                    aria-label={t.moveLeft}
                    title={t.moveLeft}
                    onPointerDown={(e) => {
                      if (e.button === 0) startRepeat(-1)
                    }}
                    onPointerUp={stopRepeat}
                    onPointerLeave={stopRepeat}
                    onPointerCancel={stopRepeat}
                    onClick={(e) => {
                      if (e.detail === 0) nudge(-1)
                    }}
                  >
                    <IconArrow flip />
                  </button>
                  <button
                    type="button"
                    className="kp-move__btn"
                    aria-label={t.moveRight}
                    title={t.moveRight}
                    onPointerDown={(e) => {
                      if (e.button === 0) startRepeat(1)
                    }}
                    onPointerUp={stopRepeat}
                    onPointerLeave={stopRepeat}
                    onPointerCancel={stopRepeat}
                    onClick={(e) => {
                      if (e.detail === 0) nudge(1)
                    }}
                  >
                    <IconArrow />
                  </button>
                  <button type="button" className="kp-move__wall" onClick={removeCab}>
                    {t.free.remove}
                  </button>
                  <button type="button" className="kp-move__btn kp-move__close" aria-label={t.close} onClick={closeSelection}>
                    <IconClose />
                  </button>
                </div>
              )}
              {/* телефон стоя: перестановка — своим рядом под карточкой листа; компьютер — внутри карточки (P6, 10) */}
              {moving && movingShown && !freeCornerSel && !freeUpper && (stacked || !measure) && moveBar}
            </div>
          )}

          {/* фото: сколько готово, скачать 4K, выйти; трассировка не пошла — обычная картинка 4K */}
          {!photo && photoFallback && (
            <div className="kp-photo" role="status" aria-live="polite">
              <span className="kp-photo__info">
                <span className="kp-photo__text">{t.photoFailed}</span>
              </span>
              <button type="button" className="kp-photo__save" disabled={saving} aria-busy={saving} onClick={savePhoto}>
                {saving ? t.saving : t.photoSave}
              </button>
              <button type="button" className="kp-photo__close" aria-label={t.photoExit} title={t.photoExit} onClick={() => setPhotoFallback(false)}>
                <IconClose />
              </button>
            </div>
          )}
          {photo && (
            <div className="kp-photo" role="status" aria-live="polite">
              <span className="kp-photo__info">
                <span className="kp-photo__text">
                  {photo.phase === 'build'
                    ? t.photoBuild
                    : photo.phase === 'done'
                      ? t.photoDone
                      : photo.big
                        ? t.photoBig(Math.round(photo.progress * 100))
                        : t.photoTrace(Math.round(photo.progress * 100))}
                  <small>{photo.phase === 'done' ? t.photoTurn : photo.phase === 'build' ? t.photoFirst : t.photoWait}</small>
                </span>
                {photo.phase !== 'done' && (
                  <span className="kp-photo__bar" aria-hidden="true">
                    <span style={{ transform: `scaleX(${photo.progress.toFixed(3)})` }} />
                  </span>
                )}
              </span>
              <button type="button" className="kp-photo__save" disabled={photo.phase === 'build' || photo.big || saving} aria-busy={saving} onClick={savePhoto}>
                {saving ? t.saving : t.photoSave}
              </button>
              <button type="button" className="kp-photo__close" aria-label={t.photoExit} title={t.photoExit} onClick={() => engineRef.current?.stopPhoto()}>
                <IconClose />
              </button>
            </div>
          )}

          {hintShown && (
            <p className="kp-hint">
              <span className="kp-hint__long">
                {t.hint}
                <small className="kp-hint__keys">{t.keysHint}</small>
              </span>
              <span className="kp-hint__short">{t.touchHint}</span>
            </p>
          )}
        </div>

        {!masterPage && (
        <aside className="kp-panel" id="kp-panel" aria-label={t.panelLabel} ref={panelRef}>
          {resume && (
            <div className="kp-resume" role="status">
              <p>{t.resumeLead}</p>
              <div className="kp-resume__row">
                <button type="button" className="btn btn--outline btn--sm" aria-label={t.resume} onClick={resumeLast}>
                  {t.resumeShort}
                </button>
                <button type="button" className="btn btn--ghost btn--sm" aria-label={t.startOver} onClick={startOver}>
                  {t.startOverShort}
                </button>
              </div>
            </div>
          )}
          <Dropped plan={plan} state={state} t={t} onFix={resize} />
          <nav className="kp-steps" aria-label={t.stepsLabel} ref={stepsRef}>
            {steps.map((s, i) => (
              <button
                key={s}
                type="button"
                className="kp-steps__btn"
                aria-current={step === s ? 'step' : undefined}
                onClick={() => {
                  // полный экран на телефоне: та же вкладка прячет или показывает
                  // лист настроек, другая — открывает свой шаг листом.
                  // На компьютере вкладки в полном экране под сценой — как было.
                  if (!full || !isStacked()) return goStep(s)
                  if (step === s) return setFullPanel((p) => !p)
                  goStep(s)
                  setFullPanel(true)
                }}
              >
                <span className="kp-steps__icon">{STEP_ICON[s]}</span>
                <span className="kp-steps__label">{t.steps[s]}</span>
                <span className={`kp-steps__bar${i <= stepIndex ? ' is-done' : ''}`} />
              </button>
            ))}
          </nav>

          <div className="kp-body" ref={bodyRef}>
            {/* шапка листа в полном экране: какой шаг открыт и «Скрыть» — прячет только лист */}
            {full && (
              <div className="kp-body__head">
                <span className="kp-body__title">{t.steps[step]}</span>
                <button type="button" className="kp-toggle kp-toggle--hide" aria-label={t.panelHide} title={t.panelHide} onClick={() => setFullPanel(false)}>
                  <IconClose />
                  <span>{t.panelHide}</span>
                </button>
              </div>
            )}
            {/* пустая комната (PRO): если она включена — первым делом, иначе — под формами */}
            {step === 'kitchen' && state.free && freeCard}
            {/* готовые кухни — выше карточек форм (аудит §6.11) */}
            {step === 'kitchen' && <ReadyStrip lang={lang} t={t} appliances={appliances} own={ownKitchen} dropName={!ownSaved && variants.length >= 8 ? variants[variants.length - 1].name : null} onOpen={openReady} />}
            {step === 'kitchen' && <h2 className="kp-sub">{t.shapeTitle}</h2>}
            {step === 'kitchen' && (
              <div className="kp-shapes" role="radiogroup" aria-label={t.shapeTitle}>
                {SHAPES.map((s) => (
                  <button key={s} type="button" role="radio" aria-checked={state.shape === s} className="kp-shape" onClick={() => setShape(s)}>
                    <ShapeIcon shape={s} />
                    <span className="kp-shape__name">{t.shapes[s][0]}</span>
                    <span className="kp-shape__note">{t.shapes[s][1]}</span>
                  </button>
                ))}
              </div>
            )}
            {step === 'kitchen' && !state.free && freeCard}
            {step === 'kitchen' && state.free && (
              <FreePalette
                t={t}
                walls={walls}
                wall={freeWall}
                lengths={{ A: state.a, B: state.b, C: state.c, I: Math.round(Math.min(state.island, state.a)) }}
                free={freeSpace}
                tiles={freeTiles}
                gaps={freeGapsNow}
                onWall={setFreeWall}
                onAdd={(what) => freePut(what)}
                onFill={fillGap}
                onTile={onFreeTile}
                onUpper={freeUpperPut}
                onOverLower={() => freeWall !== 'I' && update(freeUppersOverLower(state, plan, freeWall as FreeWall))}
                extra={
                  <>
                    {islandTurnCtl && (
                      <>
                        <h3 className="kp-free__title">{t.free.island}</h3>
                        {islandTurnCtl}
                      </>
                    )}
                    <h3 className="kp-free__title">{t.dining.section}</h3>
                    {diningCtl}
                  </>
                }
              />
            )}

            {step === 'kitchen' && (
              <div className="kp-sizes">
                <h2 className="kp-sub">{t.sizeTitle}</h2>
                <PlanSketch plan={plan} labels={wallLabels} className="kp-sketch" />
                <p className="kp-note">{t.measureHint}</p>
                <SizeField label={`A · ${t.walls.a}`} value={state.a} min={minA(state.shape)} max={LIMITS.a.max} t={t} stageRef={stageRef} onChange={(a) => resize({ a })} />
                {(state.shape === 'corner' || state.shape === 'u') && (
                  <SizeField label={`B · ${t.walls.b}`} value={state.b} min={LIMITS.b.min} max={LIMITS.b.max} t={t} stageRef={stageRef} onChange={(b) => resize({ b })} />
                )}
                {state.shape === 'u' && (
                  <SizeField label={`C · ${t.walls.c}`} value={state.c} min={LIMITS.c.min} max={LIMITS.c.max} t={t} stageRef={stageRef} onChange={(c) => resize({ c })} />
                )}
                {state.shape === 'island' && (
                  <SizeField
                    label={t.walls.island}
                    value={state.island}
                    min={LIMITS.island.min}
                    max={Math.min(LIMITS.island.max, state.a)}
                    t={t}
                    stageRef={stageRef}
                    onChange={(island) => resize({ island })}
                  />
                )}
                {islandTurnCtl}

                <h2 className="kp-sub">{t.roomTitle}</h2>
                <SizeField
                  label={t.ceiling}
                  note={t.ceilingNote}
                  value={ceiling}
                  min={CEILING.min}
                  max={CEILING.max}
                  t={t}
                  stageRef={stageRef}
                  onChange={(v) => update({ ceiling: v === CEILING.base ? undefined : v })}
                />
                <Switch
                  className="kp-gap"
                  checked={!state.noWindow}
                  title={t.windowOn}
                  note={t.windowNote}
                  onChange={(on) => update({ noWindow: on ? undefined : true })}
                />
                {!state.noWindow && plan.window && (
                  <SizeField
                    label={t.windowW}
                    value={plan.window.w}
                    min={WINDOW_LIMITS.min}
                    max={WINDOW_LIMITS.max}
                    t={t}
                    stageRef={stageRef}
                    onChange={(windowW) => update({ windowW })}
                  />
                )}

                <h2 className="kp-sub">{t.dining.section}</h2>
                {diningCtl}
              </div>
            )}

            {step === 'style' && (
              <div className="kp-styles">
                <Switch checked={!state.lowUppers} title={t.toCeiling} note={t.toCeilingNote} onChange={(on) => update({ lowUppers: on ? undefined : true })} />
                <p className="kp-note kp-note--after">{t.styleHint}</p>
                {/* карусель из 8 (флаг featured в каталоге) без заметок; «Все стили» — полный список группами (история 25) */}
                {(() => {
                  const card = (st: KitchenStyle) => (
                    <button key={st.id} type="button" role="radio" aria-checked={state.style === st.id} className="kp-style" onClick={() => pickStyle(st)}>
                      <span className="kp-style__img" style={{ background: styleSwatch(st) }}>
                        {thumbs[st.id] && <img src={thumbs[st.id]} alt="" />}
                      </span>
                      <span className="kp-style__name">{lang === 'ky' ? st.ky : st.ru}</span>
                    </button>
                  )
                  return (
                    <>
                      {/* полный список раскрыт — карусель спрятана: выбранный стиль отмечен в одной группе */}
                      {!allStyles && (
                        <div className="kp-carousel" role="radiogroup" aria-label={t.steps.style}>
                          {carouselStyles(state.style).map((st) => card(st))}
                        </div>
                      )}
                      <button
                        type="button"
                        className="btn btn--outline btn--sm kp-styles__all"
                        aria-expanded={allStyles}
                        aria-controls="kp-styles-all"
                        onClick={() => setAllStyles((v) => !v)}
                      >
                        {allStyles ? t.fewerStyles : t.allStyles}
                      </button>
                      {allStyles && (
                        <div id="kp-styles-all" className="kp-styles__list">
                          {STYLE_GROUPS.map((g) => (
                            <section key={g} className="kp-style-group" aria-label={t.styleGroups[g]}>
                              <h3 className="kp-style-group__title">{t.styleGroups[g]}</h3>
                              <div className="kp-style-grid" role="radiogroup" aria-label={t.styleGroups[g]}>
                                {STYLES.filter((st) => st.group === g).map((st) => card(st))}
                              </div>
                            </section>
                          ))}
                        </div>
                      )}
                    </>
                  )
                })()}
                <h2 className="kp-sub">{t.toneTitle}</h2>
                <div className="kp-tones" role="radiogroup" aria-label={t.toneTitle}>
                  {style.tones.map((tn, i) => (
                    <button key={tn.ru} type="button" role="radio" aria-checked={state.tone === i} className="kp-tone" onClick={() => update({ tone: i })}>
                      <span className="kp-tone__chip" style={{ background: toneSwatch(tn.facade, tn.upper, tn.texture) }} />
                      <span>{lang === 'ky' ? tn.ky : tn.ru}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 'style' && (
              <div className="kp-finish">
                <h2 className="kp-sub">{t.finishTitle}</h2>
                <p className="kp-note">{t.finishLead}</p>
                {/*
                  Шесть разделов отделки свёрнуты в строки: в каждой — что
                  выбрано сейчас. Открыт один раздел за раз, а не простыня
                  из сотни образцов.
                */}
                <div className="kp-parts">
                  <Part title={t.frontsTitle2} value={finishNow.fronts} open onOpen={(el) => reveal(el, 'steps')}>
                    <div className="kp-seg kp-seg--wide" role="radiogroup" aria-label={t.frontsTitle2}>
                      {paintTargets.map((k) => (
                        <button key={k} type="button" role="radio" aria-checked={paintTarget === k} className="kp-seg__btn" onClick={() => setPaintFor(k)}>
                          {t.finishTarget[k]}
                        </button>
                      ))}
                    </div>
                    {/* 16 цветов материала сразу; «точный» цвет (RAL / декор), если выбран, — первым (история 25) */}
                    <div className="kp-chips" role="tablist" aria-label={t.frontsTitle2}>
                      {FRONT_MATERIALS.map((m) => (
                        <button key={m.id} type="button" role="tab" aria-selected={frontMat === m.id} className="kp-chip" onClick={() => setFrontMat(m.id)}>
                          {lang === 'ky' ? m.ky : m.ru}
                        </button>
                      ))}
                    </div>
                    <p className="kp-note kp-note--tight">
                      {(() => {
                        const m = FRONT_MATERIALS.find((x) => x.id === frontMat)!
                        return lang === 'ky' ? m.noteKy : m.noteRu
                      })()}
                    </p>
                    <div className="kp-colors" role="radiogroup" aria-label={t.frontsTitle2}>
                      {resetTile}
                      {exactOwn && colorTile(exactOwn, exactOwn.code)}
                      {shortList(
                        FRONT_COLORS.filter((c) => c.material === frontMat),
                        exactOwn ? 15 : 16,
                        (c) => isOn(c.id),
                      ).map((c) => colorTile(c))}
                    </div>
                    <button
                      type="button"
                      className="btn btn--outline btn--sm kp-colors__exact"
                      aria-expanded={exact}
                      aria-controls="kp-exact"
                      onClick={() => setExact((v) => !v)}
                    >
                      {exact ? tc.exactHide : tc.exactCode}
                    </button>
                    {exact && (
                      <div id="kp-exact" className="kp-exact">
                        <label className="kp-csearch">
                      <span className="visually-hidden">{tc.search}</span>
                      <input
                        type="search"
                        className="kp-csearch__input"
                        value={colorQuery}
                        onChange={(e) => {
                          setColorQuery(e.target.value)
                          // на компьютере выдача не уходит под липкий ряд «Дальше»: первая плитка — в видимую часть
                          if (!isStacked()) {
                            requestAnimationFrame(() => {
                              const box = foundRef.current
                              ;(box?.children[1] ?? box)?.scrollIntoView({ block: 'nearest' })
                            })
                          }
                        }}
                        placeholder={tc.searchPlaceholder}
                        enterKeyHint="search"
                        autoComplete="off"
                        spellCheck={false}
                      />
                    </label>
                        {colorQuery.trim() ? (
                          <>
                            {!found.length && <p className="kp-note kp-note--tight">{tc.notFound(colorQuery.trim())}</p>}
                        <div ref={foundRef} className="kp-colors kp-colors--codes kp-found" role="radiogroup" aria-label={tc.search}>
                          {resetTile}
                          {found.map((c) => colorTile(c, c.code))}
                        </div>
                        <p className="kp-note kp-note--tight kp-approx">{tc.approx}</p>
                          </>
                        ) : (
                          <>
                            <div className="kp-chips" role="tablist" aria-label={tc.exactCode}>
                              {(['ral', 'decor'] as const).map((k) => (
                                <button key={k} type="button" role="tab" aria-selected={exactKind === k} className="kp-chip" onClick={() => setExactKind(k)}>
                                  {tc[k]}
                                </button>
                              ))}
                            </div>
                            {exactKind === 'ral' ? (
                              <>
                                <p className="kp-note kp-note--tight">{tc.ralNote}</p>
                            <RalCodeForm tc={tc} onApply={applyRal} />
                            <div className="kp-colors kp-colors--codes" role="radiogroup" aria-label={t.frontsTitle2}>
                              {resetTile}
                            </div>
                            <div className="kp-ralgroups">
                              {RAL_GROUPS.map((g, i) => (
                                <details
                                  key={g.digit}
                                  className="kp-ralgroup"
                                  open={ralOpenNow.has(g.digit)}
                                  onToggle={(e) => toggleRal(g.digit, e.currentTarget.open)}
                                >
                                  <summary>
                                    <span className="kp-ralgroup__dot" style={{ background: g.dot }} />
                                    {g.digit} — {tc.ralGroups[i]} <small>{g.count}</small>
                                  </summary>
                                  {ralOpenNow.has(g.digit) && (
                                    <div className="kp-colors kp-colors--codes" role="radiogroup" aria-label={tc.ralGroups[i]}>
                                      {g.tiles.map((x) => colorTile(x.c, x.code))}
                                    </div>
                                  )}
                                </details>
                              ))}
                            </div>
                            <p className="kp-note kp-note--tight kp-approx">{tc.approx}</p>
                              </>
                            ) : (
                              <>
                                <div className="kp-chips" role="tablist" aria-label={tc.decor}>
                              {DECOR_BRANDS.map((b) => (
                                <button key={b.id} type="button" role="tab" aria-selected={decorBrand === b.id} className="kp-chip" onClick={() => setDecorBrand(b.id)}>
                                  {b.name}
                                </button>
                              ))}
                            </div>
                            <p className="kp-note kp-note--tight">{tc.decorNote}</p>
                            <div className="kp-colors kp-colors--codes" role="radiogroup" aria-label={tc.decor}>
                              {resetTile}
                              {DECORS.filter((d) => d.brand === decorBrand).map((d) => {
                                const c = frontColor(d.id)
                                return c ? colorTile(c, d.code) : null
                              })}
                            </div>
                            <p className="kp-note kp-note--tight kp-approx">{tc.approx}</p>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </Part>

                  <Part title={t.handlesTitle} value={finishNow.handles} onOpen={(el) => reveal(el, 'steps')}>
                    <Switch
                      checked={handleless}
                      title={t.handleless}
                      note={t.handlelessNote}
                      onChange={(on) => update({ handleless: on === (style.handle === 'gola') ? undefined : on })}
                    />
                    {!handleless && (
                      <>
                        <MoreList items={HANDLES} n={5} isOn={(h) => h.id === handle} open={moreOf.handles} onToggle={() => setMoreOf((m) => ({ ...m, handles: !m.handles }))} t={t}>
                          {(shown) => (
                            <div className="kp-handles" role="radiogroup" aria-label={t.handlesTitle}>
                              {shown.map((h) => (
                                <button
                                  key={h.id}
                                  type="button"
                                  role="radio"
                                  aria-checked={handle === h.id}
                                  className="kp-handle"
                                  onClick={() => update({ handle: h.id === style.handle ? undefined : h.id })}
                                >
                                  <HandleIcon kind={h.id} />
                                  <span>{lang === 'ky' ? h.ky : h.ru}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </MoreList>
                        <div className="kp-metals" role="radiogroup" aria-label={t.handleMetal}>
                          <span className="kp-metals__label">
                            {t.handleMetal}
                            {metal && <b>: {lang === 'ky' ? metal.ky : metal.ru}</b>}
                          </span>
                          {HANDLE_METALS.map((m) => (
                            <button
                              key={m.id}
                              type="button"
                              role="radio"
                              aria-checked={(state.handleMetal ?? style.metal) === m.id}
                              aria-label={lang === 'ky' ? m.ky : m.ru}
                              title={lang === 'ky' ? m.ky : m.ru}
                              className="kp-metal"
                              style={{ background: m.swatch }}
                              onClick={() => update({ handleMetal: m.id === style.metal ? undefined : m.id })}
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </Part>

                  <Part title={t.topTitle} value={finishNow.top} onOpen={(el) => reveal(el, 'steps')}>
                    <div className="kp-chips" role="tablist" aria-label={t.topTitle}>
                      {TOP_MATERIALS.map((m) => (
                        <button key={m.id} type="button" role="tab" aria-selected={topMat === m.id} className="kp-chip" onClick={() => setTopMat(m.id)}>
                          {lang === 'ky' ? m.ky : m.ru}
                        </button>
                      ))}
                    </div>
                    <p className="kp-note kp-note--tight">
                      {(() => {
                        const m = TOP_MATERIALS.find((x) => x.id === topMat)!
                        return lang === 'ky' ? m.noteKy : m.noteRu
                      })()}
                    </p>
                    <MoreList items={topsOfMat} n={6} isOn={(c) => state.top === c.id} open={moreOf.tops} onToggle={() => setMoreOf((m) => ({ ...m, tops: !m.tops }))} t={t}>
                      {(shown) => (
                        <div className="kp-colors" role="radiogroup" aria-label={t.topTitle}>
                          <button type="button" role="radio" aria-checked={!state.top} className="kp-color" onClick={() => update({ top: undefined })}>
                            <span className="kp-color__chip" style={{ background: style.splashColor }} />
                            <span>{t.asStyle}</span>
                          </button>
                          {shown.map((c) => (
                            <button key={c.id} type="button" role="radio" aria-checked={state.top === c.id} className="kp-color" onClick={() => update({ top: c.id })}>
                              <span className="kp-color__chip" style={{ background: topSwatch(c.look) }} />
                              <span>
                                {lang === 'ky' ? c.ky : c.ru}
                                <small>{c.cm * 10} мм</small>
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </MoreList>
                  </Part>

                  <Part title={t.splashTitle} value={finishNow.splash} onOpen={(el) => reveal(el, 'steps')}>
                    <div className="kp-chips" role="tablist" aria-label={t.splashTitle}>
                      {SPLASH_GROUPS.map((g) => (
                        <button key={g.id} type="button" role="tab" aria-selected={splashGroup === g.id} className="kp-chip" onClick={() => setSplashGroup(g.id)}>
                          {lang === 'ky' ? g.ky : g.ru}
                        </button>
                      ))}
                    </div>
                    <p className="kp-note kp-note--tight">
                      {(() => {
                        const g = SPLASH_GROUPS.find((x) => x.id === splashGroup)!
                        return lang === 'ky' ? g.noteKy : g.noteRu
                      })()}
                    </p>
                    <MoreList items={splashesOfGroup} n={8} isOn={(c) => state.splash === c.id} open={moreOf.splash} onToggle={() => setMoreOf((m) => ({ ...m, splash: !m.splash }))} t={t}>
                      {(shown) => (
                        <div className="kp-colors" role="radiogroup" aria-label={t.splashTitle}>
                          <button type="button" role="radio" aria-checked={!state.splash} className="kp-color" onClick={() => update({ splash: undefined })}>
                            <span className="kp-color__chip" style={{ background: style.splashColor }} />
                            <span>{t.asStyle}</span>
                          </button>
                          {shown.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              role="radio"
                              aria-checked={state.splash === c.id}
                              className="kp-color"
                              onClick={() => update({ splash: c.id })}
                            >
                              <span
                                className={`kp-color__chip${c.kind === 'glass' ? ' kp-color__chip--acrylic' : ''}`}
                                style={{ background: splashSwatch(c, topSel?.look.base ?? style.splashColor, wallColor ?? style.wall) }}
                              />
                              <span>{lang === 'ky' ? c.ky : c.ru}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </MoreList>
                  </Part>

                  <Part title={t.floorTitle} value={finishNow.floor} onOpen={(el) => reveal(el, 'steps')}>
                    <div className="kp-swatches" role="radiogroup" aria-label={t.floorTitle}>
                      {FLOORS.map((f) => {
                        const on = (state.floor ?? style.floor) === f.id
                        return (
                          <button
                            key={f.id}
                            type="button"
                            role="radio"
                            aria-checked={on}
                            className="kp-swatch"
                            onClick={() => update({ floor: f.id === style.floor ? undefined : f.id })}
                          >
                            <span className="kp-swatch__chip" style={{ background: f.swatch }} />
                            <span>{lang === 'ky' ? f.ky : f.ru}</span>
                          </button>
                        )
                      })}
                    </div>
                  </Part>

                  <Part title={t.wallTitle} value={finishNow.walls} onOpen={(el) => reveal(el, 'steps')}>
                    <div className="kp-swatches" role="radiogroup" aria-label={t.wallTitle}>
                      {WALL_COLORS.map((c, i) => (
                        <button
                          key={c.ru}
                          type="button"
                          role="radio"
                          aria-checked={(state.wallColor ?? 0) === i}
                          className="kp-swatch"
                          onClick={() => update({ wallColor: i || undefined })}
                        >
                          <span className="kp-swatch__chip" style={{ background: c.color ?? style.wall }} />
                          <span>{lang === 'ky' ? c.ky : c.ru}</span>
                        </button>
                      ))}
                    </div>
                  </Part>
                </div>
              </div>
            )}

            {step === 'kitchen' && (
              <div className="kp-extra">
                <h2 className="kp-sub">{t.furnitureTitle}</h2>
                {stoveOn && (
                  <div className="kp-oven kp-oven--stove">
                    <span className="kp-switch__text">
                      {t.ovenTitle}
                      <small>{t.stove.ovenNote}</small>
                    </span>
                  </div>
                )}
                {!stoveOn && items.oven !== null && !state.free && (
                  <div className="kp-oven">
                    <span className="kp-switch__text">
                      {t.ovenTitle}
                      <small>{mwBuiltIn && ovenPlace === 'tall' ? t.tallOvenLocked : t.ovenNote[ovenPlace]}</small>
                    </span>
                    <div className="kp-seg kp-seg--wide kp-seg--wrap" role="radiogroup" aria-label={t.ovenTitle}>
                      {(['hob', 'tall', 'apart'] as const).map((k) => (
                        <button
                          key={k}
                          type="button"
                          role="radio"
                          aria-checked={ovenPlace === k}
                          disabled={k === 'hob' && mwBuiltIn}
                          className="kp-seg__btn"
                          onClick={() => update({ tallOven: k === 'tall' || undefined, ovenApart: k === 'apart' || undefined })}
                        >
                          {t.ovenPlace[k]}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {!state.free && (
                <div className="kp-counter">
                  <span className="kp-switch__text">
                    {t.pantries}
                    <small>{t.pantriesNote}</small>
                  </span>
                  <button
                    type="button"
                    className="kp-size__step"
                    aria-label={`${t.less}: ${t.pantries}`}
                    disabled={!state.pantries}
                    onClick={() => update({ pantries: Math.max(0, (state.pantries ?? 0) - 1) || undefined })}
                  >
                    −
                  </button>
                  <output className="kp-counter__value">{state.pantries ?? 0}</output>
                  <button
                    type="button"
                    className="kp-size__step"
                    aria-label={`${t.more}: ${t.pantries}`}
                    disabled={(state.pantries ?? 0) >= 2}
                    onClick={() => update({ pantries: Math.min(2, (state.pantries ?? 0) + 1) })}
                  >
                    +
                  </button>
                </div>
                )}
                {items.fridge && (
                  <Switch
                    className="kp-gap"
                    checked={!state.fridgeOpen}
                    title={t.fridgeNiche}
                    note={t.fridgeNicheNote}
                    onChange={(on) => update({ fridgeOpen: on ? undefined : true })}
                  />
                )}
              </div>
            )}

            {step === 'tech' && (
              <ul className="kp-slots">
                {SLOTS.map((slot) => (
                  <SlotRow
                    key={slot}
                    slot={slot}
                    list={bySlot[slot]}
                    current={chosen[slot]}
                    pickedNone={chosen[slot] === null && project.find((i) => i.slot === slot)?.status !== 'noStock'}
                    status={project.find((i) => i.slot === slot)?.status}
                    info={info}
                    supplyHref={whatsappHref(phones[0], t.askSupplyText(t.slots[slot], shareUrl))}
                    open={open === slot}
                    style={style}
                    t={t}
                    onToggle={() => openSlot(slot)}
                    onPick={(id) => setPick(slot, id)}
                    onPlace={state.free && PLACE_KEY[slot] ? () => placeSlot(slot) : undefined}
                  />
                ))}
              </ul>
            )}

            {/* «Итог»: проверка проекта, ссылка мастеру и PDF, поделиться, варианты; сумма и корзина — kp-sum ниже (на телефоне — нижняя панель) */}
            {step === 'total' && !masterPage && (
              <div className="kp-total">
      <section className="kp-check" aria-labelledby="kp-check-title">
        <div className="kp-check__head">
          <h2 id="kp-check-title" className="kp-maker__title kp-maker__title--small">
            {t.checkTitle}
          </h2>
          <span className={`kp-check__score${checksOk === checks.length ? ' is-ok' : ''}`}>{t.checkScore(checksOk, checks.length)}</span>
        </div>
        <p className="kp-note">{t.checkLead}</p>
        <ul className="kp-check__list">
          {checks.map((c) => (
            <li key={c.id} className={`kp-check__item is-${c.level}`}>
              <span className="kp-check__icon" aria-hidden="true">
                {c.level === 'ok' ? '✓' : '!'}
              </span>
              <span>{checkText(c)}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Покупателю: чертежи и раскрой — на отдельной странице мастера. Здесь только
          ссылка на неё и «Отправить PDF». PDF готовится заранее, когда карточка на экране (specRef). */}
        <section className="kp-spec kp-spec--link" aria-labelledby="kp-spec-title" ref={specRef}>
          <div className="kp-spec__head">
            <div>
              <h2 id="kp-spec-title" className="kp-maker__title">
                {t.specTitle}
              </h2>
              <p className="kp-maker__lead">{t.masterOpenLead}</p>
            </div>
            <div className="kp-spec__actions">
              <Link href={`/${lang}/kitchen/master?${query}`} className="btn btn--outline">
                <IconFile />
                {t.masterOpen}
              </Link>
              <button type="button" className="btn btn--outline" onClick={sendPdf} disabled={!drawing || pdfBusy} aria-busy={pdfBusy}>
                {pdfBusy ? t.specPreparing : t.pdfMaster}
              </button>
            </div>
          </div>
          {/* PRO — инструменты мастера в конструкторе («Пустая комната» на шаге «Кухня»); чертежи и раскрой — только на /kitchen/master */}
          <div className={`kp-pro${pro ? ' is-on' : ''}`}>
            <span className="kp-pro__badge">{t.pro.badge}</span>
            <p className="kp-pro__text">{pro ? t.pro.onLead : t.pro.offLead}</p>
            <button type="button" className={`btn btn--sm ${pro ? 'btn--ghost' : 'btn--outline'}`} aria-pressed={pro} onClick={() => togglePro(!pro)}>
              {pro ? t.pro.hide : t.pro.show}
            </button>
          </div>
        </section>

      {makerSection()}
      <section className="kp-variants" aria-labelledby="kp-variants-title">
        <div className="kp-check__head">
          <div>
            <h2 id="kp-variants-title" className="kp-maker__title kp-maker__title--small">
              {t.variantsTitle}
            </h2>
            <p className="kp-note">{t.variantsLead}</p>
          </div>
          <button type="button" className="btn btn--outline btn--sm" onClick={saveVariant} disabled={engineState !== 'ready'}>
            {t.saveVariant}
          </button>
        </div>
        {askGallery && !galleryWhy && (
          <div className="kp-ask" role="group" aria-label={t.gallery.ask}>
            <span className="kp-ask__text">{t.gallery.ask}</span>
            <button
              type="button"
              className="btn btn--outline btn--sm"
              onClick={() => {
                setAskGallery(false)
                setPublishing(true)
              }}
            >
              {t.gallery.yes}
            </button>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setAskGallery(false)}>
              {t.gallery.no}
            </button>
          </div>
        )}
        {variants.length > 0 && (
          <ul className="kp-variants__list">
            {variants.map((v) => (
              <li key={v.id} className="kp-variant">
                {v.img ? <img src={v.img} alt="" className="kp-variant__img" /> : <span className="kp-variant__img" />}
                <span className="kp-variant__name">{v.name}</span>
                <span className="kp-variant__label">{v.label}</span>
                <span className="kp-variant__actions">
                  <button type="button" className="btn btn--outline btn--sm" onClick={() => openVariant(v)}>
                    {t.openVariant}
                  </button>
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => storeVariants(variants.filter((x) => x.id !== v.id))}>
                    {t.removeVariant}
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
              </div>
            )}

            {/* на компьютере ряд прилипает к низу панели — «Начать заново» рядом с «Дальше», а не под ней */}
            <div className="kp-next-row">
              {step === 'kitchen' && (
                <button type="button" className="btn btn--ghost btn--sm kp-restart" onClick={startOver}>
                  {t.startOver}
                </button>
              )}
              {stepIndex < steps.length - 1 ? (
                <button type="button" className="btn btn--outline kp-next" onClick={() => goStep(steps[stepIndex + 1])}>
                  {t.next}: {t.steps[steps[stepIndex + 1]]}
                  <IconArrow />
                </button>
              ) : null}
            </div>
          </div>

          <div className="kp-sum">
            <div className="kp-sum__row">
              <span className="kp-sum__label">{t.totalShort(totals.count)}</span>
              <span className="kp-sum__price">{formatSom(totals.sum)}</span>
            </div>
            {cartResult || (totals.count > 0 && missing.length === 0) ? (
              <p className="kp-sum__done" role="status">
                {cartResult && cartResult.ok > 0 ? t.added(cartResult.ok) : cartResult && cartResult.failed > 0 ? t.addFailed : t.allInCart}{' '}
                {(!cartResult || cartResult.ok > 0 || cartResult.failed === 0) && (
                  <Link href={`/${lang}/cart`} className="kp-sum__link">
                    {t.toCart}
                  </Link>
                )}
              </p>
            ) : (
              <button type="button" className="btn btn--primary kp-sum__cta" disabled={totals.count === 0} onClick={addAll}>
                {t.addAllShort}
              </button>
            )}
            <div className="kp-sum__ask">
              <a className="btn btn--outline btn--sm kp-sum__wa" href={waHref} target="_blank" rel="noopener noreferrer">
                {t.askWa}
              </a>
              <a className="btn btn--ghost btn--sm kp-sum__tel" href={telHref(phones[0])}>
                {t.call}
              </a>
            </div>
            <p className="kp-sum__honest">{t.honestShort}</p>
          </div>
        </aside>
        )}
      </div>

      {/* Телефон стоя: липкая нижняя панель 60 px — сумма техники · «Дальше» / «Всё в корзину» · корзина с числом. Лимонная кнопка одна. */}
      {stacked && !masterPage && (
        <div className="kp-bar" role="region" aria-label={t.barLabel}>
          <button type="button" className="kp-bar__sum" onClick={() => goStep('total')}>
            <span className="kp-bar__label">{t.totalShort(totals.count)}</span>
            <span className="kp-bar__price">{formatSom(totals.sum)}</span>
          </button>
          {step !== 'total' ? (
            <button type="button" className="btn btn--primary kp-bar__next" onClick={() => goStep(STEPS[stepIndex + 1])}>
              {t.next}
              <IconArrow />
            </button>
          ) : cartResult || (totals.count > 0 && missing.length === 0) ? (
            <Link href={`/${lang}/cart`} className="btn btn--primary kp-bar__next">
              {t.toCart}
            </Link>
          ) : (
            <button type="button" className="btn btn--primary kp-bar__next" disabled={totals.count === 0} onClick={addAll}>
              {t.addAllShort}
            </button>
          )}
          <Link href={`/${lang}/cart`} className="kp-bar__cart" aria-label={`${t.barCart}: ${cart.itemsCount}`}>
            <IconCart />
            {cart.itemsCount > 0 && <span className="kp-bar__count">{cart.itemsCount}</span>}
          </Link>
        </div>
      )}

      {masterPage && (
      <section className="kp-spec" aria-labelledby="kp-spec-title" ref={specRef}>
        <style>{DRAWING_CSS}</style>
        <div className="kp-spec__head">
          <div>
            <h2 id="kp-spec-title" className="kp-maker__title">
              {t.specTitle}
            </h2>
            <p className="kp-maker__lead">{t.specLead}</p>
          </div>
          <div className="kp-spec__actions">
            <button type="button" className="btn btn--primary" onClick={savePdf} disabled={!drawing || pdfBusy} aria-busy={pdfBusy}>
              <IconFile />
              {pdfBusy ? t.specPreparing : t.specPdf}
            </button>
            <button type="button" className="btn btn--outline" onClick={() => void sendPdf()} disabled={!drawing || pdfBusy}>
              {t.specSend}
            </button>
          </div>
        </div>

        {drawing && (
          <>
            <dl className="kp-facts">
              <div>
                <dt>{t.factWalls}</dt>
                <dd>{wallsLine}</dd>
              </div>
              <div>
                <dt>{t.factCeiling}</dt>
                <dd>
                  {ceiling} {t.cm}
                </dd>
              </div>
              <div>
                <dt>{t.factModules}</dt>
                <dd>{drawing.modules}</dd>
              </div>
              <div>
                <dt>{t.factFronts}</dt>
                <dd>{drawing.frontsTotal}</dd>
              </div>
              <div>
                <dt>{t.factTop}</dt>
                <dd>
                  {fmt(drawing.tops.total)} {t.meters}
                </dd>
              </div>
            </dl>
            <div className="kp-walls">
              {drawing.walls.map((w) => (
                <figure key={w.id} className="kp-wall">
                  <figcaption>{w.title}</figcaption>
                  {/* на телефоне цифры мелкие — нажатие открывает чертёж на весь экран */}
                  <button type="button" className="kp-wall__open" onClick={() => setZoomWall(w.id)} aria-label={`${t.drawingOpen}: ${w.title}`}>
                    <span className="kp-wall__svg" dangerouslySetInnerHTML={{ __html: w.svg }} />
                  </button>
                </figure>
              ))}
            </div>
            {(() => {
              const w = drawing.walls.find((x) => x.id === zoomWall)
              if (!w) return null
              return (
                <div className="kp-zoom" role="dialog" aria-modal="true" aria-label={w.title} onKeyDown={(e) => e.key === 'Escape' && setZoomWall(null)}>
                  <div className="kp-zoom__bar">
                    <span>{w.title}</span>
                    <button type="button" className="btn btn--outline btn--sm" onClick={() => setZoomWall(null)} autoFocus>
                      {t.close}
                    </button>
                  </div>
                  <div className="kp-zoom__body">
                    <div className="kp-zoom__svg" dangerouslySetInnerHTML={{ __html: w.svg }} />
                  </div>
                </div>
              )
            })()}
            <details className="kp-more">
              <summary>{t.specMore}</summary>
              <div className="kp-tables">
                {sheetTables().map((tb) => (
                  <section key={tb.title} className="kp-table">
                    <h3>{tb.title}</h3>
                    <table>
                      <thead>
                        <tr>
                          {tb.head.map((h, i) => (
                            <th key={h} className={i ? 'is-num' : undefined}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {tb.rows.map((r, ri) => (
                          <tr key={ri}>
                            {r.map((c, i) => (
                              <td key={i} className={i ? 'is-num' : undefined}>
                                {c}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {'note' in tb && tb.note && <p className="kp-note">{tb.note}</p>}
                  </section>
                ))}
              </div>
              <p className="kp-note">{t.specNote}</p>
            </details>
          </>
        )}

        {/* Мастеру: раскрой в Excel, листы и кромка, смета клиенту — ниже всего, что видит покупатель */}
        {spec && (
          <section className="kp-mstr" aria-labelledby="kp-mstr-title">
            <div className="kp-mstr__head">
              <div>
                <h3 id="kp-mstr-title" className="kp-mstr__title">
                  {t.master.title}
                </h3>
                <p className="kp-note">{t.master.lead}</p>
              </div>
              <button type="button" className="btn btn--outline btn--sm" onClick={(e) => openMasterForm(e.currentTarget)}>
                {t.master.prices}
              </button>
            </div>
            {cut && !cut.ok && (
              <p className="kp-mstr__fail" role="alert">
                {t.master.failed}
              </p>
            )}
            {cut?.ok && (
              <>
                <ul className="kp-mstr__sum">
                  {cut.nested
                    .filter((r) => r.sheets.length)
                    .map((r) => (
                      <li key={`${r.material.kind}|${r.material.label}|${r.material.color}`}>{t.master.sheetLine(sheetName(r), r.sheets.length, Math.round(r.waste * 100))}</li>
                    ))}
                  {cut.edges.length > 0 && <li>{t.master.edgeLine(cut.edges.map((e) => t.master.edgePart(fmt(e.thick), fmt(e.meters))).join(', '))}</li>}
                  <li className="kp-mstr__total">
                    {cut.est.rows.some((r) => r.price !== null) ? (
                      <>
                        <b>{t.master.sum(formatSom(cut.est.total))}</b>
                        {cut.est.missing.length > 0 && <span className="kp-note"> · {t.master.sumMissing(cut.est.rows.filter((r) => r.price === null).length)}</span>}
                      </>
                    ) : (
                      <span className="kp-mstr__hint">{t.master.noPrices}</span>
                    )}
                  </li>
                </ul>
                {estLines && cut.est.rows.some((r) => r.price !== null) && (
                  <details className="kp-more">
                    <summary>{t.master.lines}</summary>
                    <div className="kp-tables">
                      {/* те же строки, что в PDF; «4,78 м × 5 500» и сумма не рвутся, на телефоне «кол-во × цена» — строкой под названием (kitchen.css, .kp-table--est) */}
                      {[
                        {
                          title: t.master.tableTitle,
                          head: [t.master.colName, t.master.colQty, t.master.colSum],
                          rows: estLines.rows.map(([name, qty, price, sum]) => [name, sum === '—' ? `${qty} · ${price}` : `${qty} × ${price}`, sum]),
                          totals: estLines.totals,
                        },
                        ...(estLines.tech
                          ? [{ title: t.master.techTitle, head: [t.colModel, t.master.colPrice], rows: estLines.tech.rows.map(([slot, model, price]) => [`${slot}: ${model}`, price]), totals: [estLines.tech.total] }]
                          : []),
                      ].map((tb) => (
                        <section key={tb.title} className="kp-table kp-table--est">
                          <h3>{tb.title}</h3>
                          <table>
                            <thead>
                              <tr>
                                {tb.head.map((h, i) => (
                                  <th key={h} className={i === tb.head.length - 1 ? 'is-num' : i ? 'is-mid' : undefined}>
                                    {h}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {tb.rows.map((r, ri) => (
                                <tr key={ri}>
                                  {r.map((c, i) => (
                                    <td key={i} className={i === r.length - 1 ? 'is-num' : i ? 'is-mid' : undefined}>
                                      {c}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {tb.totals.map((x) => (
                            <p key={x.label} className="kp-note">
                              {x.label}: <b>{x.value}</b>
                            </p>
                          ))}
                        </section>
                      ))}
                    </div>
                    {estLines.missing && <p className="kp-note">{estLines.missing}</p>}
                  </details>
                )}
                <label className="kp-mstr__client">
                  <span>{t.master.client}</span>
                  <input type="text" value={client} maxLength={80} onChange={(e) => setClient(e.target.value)} autoComplete="off" />
                </label>
                <div className="kp-mstr__actions">
                  <button type="button" className="btn btn--primary" onClick={() => void saveExcel()} disabled={Boolean(masterBusy)} aria-busy={masterBusy === 'xl'}>
                    <IconFile />
                    {masterBusy === 'xl' ? t.master.preparing : t.master.excel}
                  </button>
                  <button type="button" className="btn btn--outline" onClick={() => void saveEstimate()} disabled={Boolean(masterBusy)} aria-busy={masterBusy === 'est'}>
                    {masterBusy === 'est' ? t.master.preparing : t.master.estimatePdf}
                  </button>
                </div>
                <h4 className="kp-mstr__sub">{t.master.mapTitle}</h4>
                <div className="kp-cutmap">
                  {cutMaps().map((m) => (
                    <figure key={m.title} className="kp-cutmap__sheet">
                      <figcaption>{m.title}</figcaption>
                      <svg viewBox={`0 0 ${m.L} ${m.W}`} role="img" aria-label={m.title}>
                        <rect x={0} y={0} width={m.L} height={m.W} className="kp-cutmap__waste" />
                        {m.rects.map((r) => (
                          <g key={`${r.label}-${r.x}-${r.y}`}>
                            <rect x={r.x} y={r.y} width={r.l} height={r.w} className="kp-cutmap__part" />
                            {r.w > 70 && r.l > 70 && (
                              <text x={r.x + r.l / 2} y={r.y + r.w / 2} className="kp-cutmap__id" style={{ fontSize: Math.min(110, r.w * 0.6, (r.l / Math.max(1, r.label.length)) * 1.3) }}>
                                {r.label}
                              </text>
                            )}
                          </g>
                        ))}
                      </svg>
                    </figure>
                  ))}
                </div>
                {cut.nested.some((r) => r.oversize.length) && <p className="kp-mstr__fail">{t.master.oversize(cut.nested.flatMap((r) => r.oversize).join(', '))}</p>}
                <p className="kp-note">{t.master.mapNote}</p>
              </>
            )}
          </section>
        )}
        {masterForm && (
          <div className="kp-mform" role="dialog" aria-modal="true" aria-labelledby="kp-mform-title" onKeyDown={masterKeys}>
            <form
              ref={masterBox}
              tabIndex={-1}
              className="kp-mform__box"
              onSubmit={(e) => {
                e.preventDefault()
                saveMasterForm()
              }}
            >
              <div className="kp-mform__bar">
                <h3 id="kp-mform-title">{t.master.prices}</h3>
                <button type="button" className="btn btn--outline btn--sm" onClick={closeMasterForm}>
                  {t.close}
                </button>
              </div>
              <div className="kp-mform__body">
                <p className="kp-note">{t.master.formLead}</p>
                <fieldset>
                  <legend>{t.master.you}</legend>
                  <div className="kp-mform__grid">
                    {(['name', 'phone', 'shop'] as const).map((k) => (
                      <label key={k} className="kp-mform__field">
                        <span>{t.master[k]}</span>
                        <input
                          type={k === 'phone' ? 'tel' : 'text'}
                          autoComplete={k === 'name' ? 'name' : k === 'phone' ? 'tel' : 'organization'}
                          maxLength={120}
                          value={masterForm[k]}
                          onChange={(e) => {
                            const v = e.target.value
                            setMasterForm((f) => f && { ...f, [k]: v })
                          }}
                        />
                      </label>
                    ))}
                  </div>
                </fieldset>
                <fieldset>
                  <legend>{t.master.pricesTitle}</legend>
                  <div className="kp-mform__grid">
                    {PRICE_FIELDS.map((k) => numField(k, t.master.fields[k], draftPrice(masterForm, k), (v) => setDraftPrice(k, v)))}
                  </div>
                </fieldset>
                <fieldset>
                  <legend>{t.master.frontTitle}</legend>
                  <div className="kp-mform__grid">
                    {[...FRONT_MATERIALS.map((x) => ({ id: x.id, label: nameOf(x) })), { id: 'style' as const, label: t.master.frontStyle }].map((x) =>
                      numField(`front-${x.id}`, x.label, masterForm.prices.front?.[x.id], (v) =>
                        setMasterForm((f) => f && { ...f, prices: { ...f.prices, front: { ...f.prices.front, [x.id]: v } } }),
                      ),
                    )}
                  </div>
                </fieldset>
                <fieldset>
                  <legend>{t.master.edgeTitle}</legend>
                  <div className="kp-mform__seg" role="radiogroup" aria-label={t.master.edgeTitle}>
                    {([0.4, 1, 2] as const).map((v) => (
                      <button key={v} type="button" role="radio" aria-checked={masterForm.bodyEdge === v} onClick={() => setMasterForm((f) => f && { ...f, bodyEdge: v })}>
                        {fmt(v)} {t.master.mm}
                      </button>
                    ))}
                  </div>
                  <p className="kp-note">{t.master.edgeHint}</p>
                </fieldset>
                <fieldset>
                  <legend>{t.master.sheetTitle}</legend>
                  <div className="kp-mform__grid">
                    {(['ldsp', 'hdf'] as const).flatMap((kind) =>
                      (['L', 'W'] as const).map((side) => {
                        const key = `${kind}${side}` as keyof MasterDraft['sz']
                        const hint = sheetHint(masterForm.sz[`${kind}L`], masterForm.sz[`${kind}W`]) ? `kp-mf-${kind}-hint` : undefined
                        return numField(
                          key,
                          `${t.xl.kinds[kind]}, ${side === 'L' ? t.master.sheetL : t.master.sheetW}`,
                          masterForm.sz[key],
                          (v) => setMasterForm((f) => f && { ...f, sz: { ...f.sz, [key]: v } }),
                          hint,
                        )
                      }),
                    )}
                  </div>
                  {(['ldsp', 'hdf'] as const).map((kind) => {
                    const hint = sheetHint(masterForm.sz[`${kind}L`], masterForm.sz[`${kind}W`])
                    return hint ? (
                      <p key={kind} id={`kp-mf-${kind}-hint`} className="kp-mstr__fail" role="status">
                        {t.xl.kinds[kind]}: {hint}
                      </p>
                    ) : null
                  })}
                </fieldset>
              </div>
              <div className="kp-mform__foot">
                <button type="submit" className="btn btn--primary">
                  {t.master.save}
                </button>
              </div>
            </form>
          </div>
        )}
      </section>
      )}



      {masterPage && (
      makerSection()
      )}

      {publishing && (
        <PublishLoader
          lang={lang}
          t={t}
          q={query}
          shot={() => engineRef.current?.sheetShot(1200, 750) ?? null}
          onClose={() => setPublishing(false)}
        />
      )}

      {note && (
        <div className={`kp-toast${note.act ? ' kp-toast--act' : ''}`} role="status">
          <span>{note.text}</span>
          {note.act?.href && (
            <a className="kp-toast__act" href={note.act.href} target="_blank" rel="noopener noreferrer" onClick={() => setNote(null)}>
              {note.act.label}
            </a>
          )}
          {note.act?.run && (
            <button
              type="button"
              className="kp-toast__act"
              onClick={() => {
                note.act?.run?.()
                setNote(null)
              }}
            >
              {note.act.label}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/* ───────── части панели ───────── */

/**
 * Раздел отделки: строка «название — что выбрано сейчас», по нажатию
 * раскрывается. Открыт один раздел за раз (name у details). Открыли рукой —
 * раздел встаёт на виду целиком; первый раздел открыт сразу и никуда не листает.
 */
/**
 * Поле «Код RAL» со своим состоянием: набор цифр перерисовывает только эту форму,
 * а не весь конструктор с палитрой. `onApply(code)` — false, если такого цвета нет.
 */
function RalCodeForm({ tc, onApply }: { tc: KitchenTexts['colors']; onApply: (code: string) => boolean }) {
  const [value, setValue] = useState('')
  const [miss, setMiss] = useState(false)
  return (
    <form
      className="kp-ralcode"
      onSubmit={(e) => {
        e.preventDefault()
        const code = parseRal(value)
        // неизвестный код — подпись, прежний цвет остаётся
        setMiss(!(code && onApply(code)))
      }}
    >
      <label className="kp-ralcode__label" htmlFor="kp-ral-code">
        {tc.ralCode}
      </label>
      <div className="kp-ralcode__row">
        <input
          id="kp-ral-code"
          className="kp-csearch__input"
          inputMode="numeric"
          enterKeyHint="done"
          autoComplete="off"
          value={value}
          placeholder={tc.ralPlaceholder}
          aria-invalid={miss}
          aria-describedby={miss ? 'kp-ral-miss' : undefined}
          onChange={(e) => {
            setValue(e.target.value)
            setMiss(false)
          }}
        />
        <button type="submit" className="btn btn--sm kp-ralcode__apply">
          {tc.ralApply}
        </button>
      </div>
      {miss && (
        <p id="kp-ral-miss" className="kp-ralcode__miss" role="alert">
          {tc.ralMissing}
        </p>
      )}
    </form>
  )
}

/**
 * Короткий список с кнопкой «Ещё N» (ручки 5, столешницы 6, фартуки 8): одно правило,
 * какие n показать (`shortList` — выбранный всегда виден) и когда нужна кнопка.
 * Кнопка — соседка блока, который вернули `children` (`.kp-handles + .kp-more-btn` в e2e).
 */
function MoreList<T>(props: {
  items: readonly T[]
  n: number
  isOn: (x: T) => boolean
  open: boolean | undefined
  onToggle: () => void
  t: KitchenTexts
  children: (shown: T[]) => React.ReactNode
}) {
  const { items, n, isOn, open, onToggle, t } = props
  return (
    <>
      {props.children(shortList(items, open ? items.length : n, isOn))}
      {items.length > n && (
        <button type="button" className="btn btn--outline btn--sm kp-more-btn" aria-expanded={Boolean(open)} onClick={onToggle}>
          {open ? t.showLess : t.showMore(items.length - n)}
        </button>
      )}
    </>
  )
}

function Part(props: { title: string; value: string; open?: boolean; onOpen: (el: HTMLElement) => void; children: React.ReactNode }) {
  const byHand = useRef(false)
  return (
    <details
      className="kp-part"
      name="kp-finish"
      open={props.open}
      onToggle={(e) => {
        const hand = byHand.current
        byHand.current = false
        if (hand && e.currentTarget.open) props.onOpen(e.currentTarget)
      }}
    >
      <summary
        className="kp-part__head"
        onClick={() => {
          byHand.current = true
        }}
      >
        <span className="kp-part__title">{props.title}</span>
        <span className="kp-part__value">{props.value}</span>
      </summary>
      <div className="kp-part__body">{props.children}</div>
    </details>
  )
}

/**
 * Поворот острова или стола: ↺/↻ — по 1°, зажатая кнопка крутит дальше
 * (через 0,4 с, 14 шагов в секунду), ползунок — сразу на любой угол,
 * ↺ 45° / ↻ 45° — крупным шагом, «Вернуть на место» — 0°.
 */
function TurnControl({ t, title, turn, onTurn }: { t: KitchenTexts; title: string; turn: number; onTurn: (deg: number) => void }) {
  const timer = useRef<number | null>(null)
  const held = useRef(false)
  const cur = useRef(turn)
  cur.current = turn
  const stop = () => {
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = null
  }
  useEffect(() => stop, [])
  const down = (step: 1 | -1) => {
    stop()
    held.current = false
    let v = cur.current
    const tick = () => {
      held.current = true
      v = islandTurnOf(v + step)
      cur.current = v
      onTurn(v)
      timer.current = window.setTimeout(tick, 70)
    }
    timer.current = window.setTimeout(tick, 400)
  }
  // щелчок — один шаг; после зажатия щелчок не считаем, шаги уже сделаны
  const click = (step: 1 | -1) => {
    if (held.current) {
      held.current = false
      return
    }
    // угол помним сразу: два быстрых щелчка до перерисовки — два шага
    cur.current = islandTurnOf(cur.current + step)
    onTurn(cur.current)
  }
  const btn = (step: 1 | -1, label: string, sign: string) => (
    <button
      type="button"
      className="kp-size__step"
      aria-label={label}
      title={label}
      onPointerDown={() => down(step)}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onClick={() => click(step)}
    >
      {sign}
    </button>
  )
  const jump = (by: number) => {
    stop()
    cur.current = islandTurnOf(cur.current + by)
    onTurn(cur.current)
  }
  return (
    <div className="kp-turn">
      <span className="kp-switch__text">
        {title}
        <small>{t.turn.note}</small>
      </span>
      <div className="kp-turn__row">
        {btn(1, t.turn.left, '↺')}
        <input
          type="range"
          className="kp-turn__range"
          min={0}
          max={359}
          step={1}
          value={turn}
          aria-label={title}
          onChange={(e) => onTurn(islandTurnOf(Number(e.target.value)))}
        />
        {btn(-1, t.turn.right, '↻')}
        <output className="kp-turn__value">{turn}°</output>
      </div>
      <div className="kp-turn__presets">
        <button type="button" className="kp-chip" onClick={() => jump(45)}>
          ↺ 45°
        </button>
        <button type="button" className="kp-chip" onClick={() => jump(-45)}>
          ↻ 45°
        </button>
        <button type="button" className="kp-chip" disabled={!turn} onClick={() => onTurn(0)}>
          {t.turn.reset}
        </button>
      </div>
    </div>
  )
}

function Switch(props: { checked: boolean; disabled?: boolean; title: string; note?: string; className?: string; onChange: (on: boolean) => void }) {
  return (
    <label className={`kp-switch${props.className ? ` ${props.className}` : ''}`}>
      <input type="checkbox" checked={props.checked} disabled={props.disabled} onChange={(e) => props.onChange(e.target.checked)} />
      <span className="kp-switch__track" aria-hidden="true" />
      <span className="kp-switch__text">
        {props.title}
        {props.note && <small>{props.note}</small>}
      </span>
    </label>
  )
}

function SizeField({
  label,
  note,
  value,
  min,
  max,
  t,
  stageRef,
  onChange,
}: {
  label: string
  note?: string
  value: number
  min: number
  max: number
  t: KitchenTexts
  /** сцена (липкая над листом): поле держится под её низом, а не под клавиатурой */
  stageRef: React.RefObject<HTMLElement | null>
  onChange: (v: number) => void
}) {
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v / 5) * 5))
  const [draft, setDraft] = useState(String(value))
  /** число вышло за пределы — говорим, до чего поправили; округление до 5 не повод */
  const [fixed, setFixed] = useState<number | null>(null)
  // пока печатают, значение снаружи (то же, что уже применили с задержкой) поле не перезаписывает
  const focused = useRef(false)
  const valueRef = useRef(value)
  valueRef.current = value
  const live = useRef(0)
  useEffect(() => {
    if (!focused.current) setDraft(String(value))
  }, [value])
  // Своё число — в пределах и кратно 5. Если после поправки оно совпало с
  // прежним, поле всё равно показывает поправленное, а не то, что набрали.
  const commit = () => {
    window.clearTimeout(live.current)
    const typed = Number(draft)
    const next = clamp(typed || value)
    setFixed(typed && (typed < min || typed > max) ? next : null)
    setDraft(String(next))
    if (next !== value) onChange(next)
  }
  // Набрали число в пределах — применяется через 300 мс, не дожидаясь blur (спецификация §5)
  const onType = (raw: string) => {
    const v = raw.replace(/\D/g, '').slice(0, 3)
    setDraft(v)
    window.clearTimeout(live.current)
    live.current = window.setTimeout(() => {
      const n = Number(v)
      if (!n || n < min || n > max) return
      const next = clamp(n)
      if (next !== valueRef.current) onChange(next)
    }, 300)
  }
  // Телефон: пока печатают, сцена 25svh (класс kp-typing) и поле держится в видимой части
  // над клавиатурой — visualViewport меняется, когда клавиатура выезжает.
  const fieldRef = useRef<HTMLInputElement>(null)
  const keepInView = () => {
    const el = fieldRef.current
    const vv = window.visualViewport
    if (!el || !vv || !focused.current) return
    const r = el.getBoundingClientRect()
    const stage = stageRef.current?.getBoundingClientRect()
    const top = Math.max(vv.offsetTop, stage ? stage.bottom : 0) + 8
    const bottom = vv.offsetTop + vv.height - 8
    if (r.bottom > bottom) window.scrollBy({ top: r.bottom - bottom })
    else if (r.top < top) window.scrollBy({ top: r.top - top })
  }
  const startTyping = () => {
    focused.current = true
    document.documentElement.classList.add('kp-typing')
    window.visualViewport?.addEventListener('resize', keepInView)
    window.visualViewport?.addEventListener('scroll', keepInView)
    window.setTimeout(keepInView, 350)
  }
  const stopTyping = () => {
    focused.current = false
    document.documentElement.classList.remove('kp-typing')
    window.visualViewport?.removeEventListener('resize', keepInView)
    window.visualViewport?.removeEventListener('scroll', keepInView)
  }
  // размонтирование поля в фокусе (смена шага, «Начать заново») — снять kp-typing и слушатели (ревью 05)
  useEffect(
    () => () => {
      window.clearTimeout(live.current)
      if (focused.current) stopTyping()
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  // У русских и кыргызских подписей все буквы — «не \w»: прежний id выходил
  // одинаковым у потолка и окна, и нажатие на подпись ставило курсор не туда.
  const id = useId()
  return (
    <div className="kp-size">
      <label className="kp-size__label" htmlFor={id}>
        {label}
        {note && <small>{note}</small>}
        <small className="kp-size__limits">{t.range(min, max)}</small>
      </label>
      <div className="kp-size__row">
        <button type="button" className="kp-size__step" aria-label={`${t.less} ${label}`} onClick={() => onChange(clamp(value - 5))} disabled={value <= min}>
          −
        </button>
        {/* вся рамка — подпись к полю: палец попадает не только в цифры, а в любое место */}
        <label className="kp-size__field">
          <input
            id={id}
            ref={fieldRef}
            inputMode="numeric"
            value={draft}
            // нажали — число выделено: новое набирается сразу, без стирания старого.
            // Через кадр: iPhone иначе сбрасывает выделение, ставя курсор под палец.
            onFocus={(e) => {
              const el = e.currentTarget
              startTyping()
              requestAnimationFrame(() => el.setSelectionRange(0, el.value.length))
            }}
            onChange={(e) => onType(e.target.value)}
            onBlur={() => {
              stopTyping()
              commit()
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit()
            }}
          />
          <span>{t.cm}</span>
        </label>
        <button type="button" className="kp-size__step" aria-label={`${t.more} ${label}`} onClick={() => onChange(clamp(value + 5))} disabled={value >= max}>
          +
        </button>
      </div>
      <input
        type="range"
        className="kp-size__range"
        min={min}
        max={max}
        step={5}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {fixed !== null && (
        <p className="kp-size__fixed" role="status">
          {t.clamped(fixed)}
        </p>
      )}
    </div>
  )
}

/**
 * Что не поместилось — на любом шаге. Нехватка считается по каждой стене
 * отдельно, и кнопка называет стену, которую удлиняет (C04). Вытяжка над
 * панелью у окна — не «удлините стену», а «перенесите панель».
 */
function Dropped({ plan, state, t, onFix }: { plan: Plan; state: KitchenState; t: KitchenTexts; onFix: (p: Partial<KitchenState>) => void }) {
  if (!droppedNotice(plan)) return null
  const need = needByWall(plan)
  const hood = plan.dropped.some((d) => d.slot === 'hood')
  const nameOf = (d: Plan['dropped'][number]) => droppedName(d, state, t)
  return (
    <div className="kp-warn" role="status">
      {plan.ovenMovedUnderHob && <p>{t.ovenUnderHob}</p>}
      {hood && <p>{t.hoodNoPlace}</p>}
      {(Object.keys(need) as RunId[]).map((wall) => {
        const names = plan.dropped
          .filter((d) => d.wall === wall && d.slot !== 'hood')
          .map(nameOf)
          .filter((n, i, all) => all.indexOf(n) === i)
          .join(', ')
        const n = Math.ceil((need[wall] ?? 0) / 5) * 5
        const key = wall === 'B' ? 'b' : wall === 'C' ? 'c' : wall === 'I' ? 'island' : 'a'
        const next = state[key] + n
        // остров не длиннее стены A (C14)
        const fits = next <= LIMITS[key].max && (key !== 'island' || next <= state.a)
        return (
          <div key={wall} className="kp-warn__row">
            <p>{t.dropped(names, n)}</p>
            {fits && (
              <button type="button" className="btn btn--outline btn--sm" onClick={() => onFix({ [key]: next })}>
                {t.droppedFix(wall, next)}
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}

function SlotRow(props: {
  status?: ItemStatus
  /** фото, описание и характеристики для окна «Подробнее» */
  info?: Record<string, ApplianceInfo>
  supplyHref: string
  slot: SlotKind
  list: KitchenAppliance[]
  current: KitchenAppliance | null | undefined
  pickedNone: boolean
  open: boolean
  style: KitchenStyle
  t: KitchenTexts
  onToggle: () => void
  onPick: (id: string | null) => void
  /** пустая комната: поставить на стену (модель выбрана, но на стене её нет) */
  onPlace?: () => void
}) {
  const { slot, list, current, pickedNone, status, open, style, t } = props
  const size = (a: KitchenAppliance) =>
    (a.slot === 'fridge' || a.slot === 'washer' || a.stove ? `${fmt(a.w)}×${fmt(a.h)} ${t.cm}` : `${t.width} ${fmt(a.w)} ${t.cm}`) +
    (a.sizeKnown ? '' : ` · ${t.typicalSize}`)
  const none = pickedNone
  const optional = OPTIONAL.includes(slot)
  const listId = `kp-opts-${slot}`
  // Духовка при плите — внутри плиты: без выбора, без цены и без ссылки на товар.
  const inStove = status === 'inStove'
  const shown = inStove ? null : current
  // Варочная панель и плита — один слот: плиты в списке отдельной группой.
  const panels = list.filter((a) => !a.stove)
  const stoves = list.filter((a) => a.stove)
  // «Подробнее» — окно внутри конструктора, а не страница товара в новой вкладке
  const [detail, setDetail] = useState<KitchenAppliance | null>(null)
  return (
    <li className={`kp-slot${open && !inStove ? ' is-open' : ''}${status === 'dropped' ? ' is-dropped' : ''}${inStove ? ' is-fixed' : ''}`} id={`kp-slot-${slot}`}>
      <button
        type="button"
        className="kp-slot__head"
        aria-expanded={inStove ? undefined : open}
        aria-controls={inStove ? undefined : listId}
        aria-disabled={inStove || undefined}
        onClick={inStove ? undefined : props.onToggle}
      >
        <span className="kp-slot__thumb">{shown?.image && !none ? <img src={shown.image} alt="" loading="lazy" /> : <SlotIcon slot={slot} />}</span>
        <span className="kp-slot__text">
          <span className="kp-slot__kind">{current?.stove && !none ? t.stove.name : t.slots[slot]}</span>
          <span className="kp-slot__name">{inStove ? t.stove.ovenInStove : none ? t.none : current ? current.name : t.noStock}</span>
          {status === 'dropped' && <span className="kp-slot__warn">{t.notFit}</span>}
          {status === 'counter' && <span className="kp-slot__note">{t.counterNote}</span>}
          {status === 'underHob' && <span className="kp-slot__note">{t.ovenPlace.hob}</span>}
          {status === 'typical' && <span className="kp-slot__note">{t.typicalNote}</span>}
          {status === 'unplaced' && <span className="kp-slot__warn">{t.free.notOnWall}</span>}
        </span>
        <span className="kp-slot__price">{shown && !none ? formatSom(shown.price) : ''}</span>
      </button>
      {shown && !none && (
        <button type="button" className="kp-slot__more" aria-haspopup="dialog" onClick={() => setDetail(shown)}>
          {t.details}
        </button>
      )}
      {status === 'unplaced' && props.onPlace && (
        <button type="button" className="kp-slot__more kp-slot__place" onClick={props.onPlace}>
          {t.free.place}
        </button>
      )}
      {!current && !none && !inStove && (
        <a className="kp-slot__more kp-slot__supply" href={props.supplyHref} target="_blank" rel="noopener noreferrer">
          {t.askSupply}
        </a>
      )}
      {open && !inStove && (
        <div className="kp-opts" id={listId} role="radiogroup" aria-label={t.slots[slot]}>
          {optional && (
            <label className="kp-opt">
              <input type="radio" name={listId} checked={none} onChange={() => props.onPick(null)} />
              <span className="kp-opt__thumb kp-opt__thumb--none">
                <SlotIcon slot={slot} />
              </span>
              <span className="kp-opt__text">
                <span className="kp-opt__name">{t.none}</span>
              </span>
            </label>
          )}
          {list.length === 0 && (
            <p className="kp-note">
              {t.noStock}.{' '}
              {none && (
                <a className="kp-slot__supply" href={props.supplyHref} target="_blank" rel="noopener noreferrer">
                  {t.askSupply}
                </a>
              )}
            </p>
          )}
          {[...panels, ...stoves].map((a, i) => (
            <Fragment key={a.id}>
              {a.stove && i === panels.length && <p className="kp-opts__group">{t.stove.group}</p>}
              <label className="kp-opt">
                <input type="radio" name={listId} checked={!none && current?.id === a.id} onChange={() => props.onPick(a.id)} />
                <span className="kp-opt__thumb">{a.image ? <img src={a.image} alt="" loading="lazy" /> : <SlotIcon slot={slot} />}</span>
                <span className="kp-opt__text">
                  <span className="kp-opt__name">{a.name}</span>
                  {/* кнопка внутри label: нажатие открывает окно и не выбирает модель */}
                  <button
                    type="button"
                    className="kp-opt__more"
                    aria-haspopup="dialog"
                    onClick={(e) => {
                      e.preventDefault()
                      setDetail(a)
                    }}
                  >
                    {t.details}
                  </button>
                  <span className="kp-opt__meta">
                    {size(a)}
                    {slot === 'dishwasher' && a.builtIn && ` · ${t.hidden}`}
                    {slot === 'microwave' && a.builtIn && ` · ${t.builtInMicrowave}`}
                  </span>
                  {style.finishes.includes(a.finish) && <span className="kp-opt__badge">{t.matches}</span>}
                </span>
                <span className="kp-opt__price">
                  {formatSom(a.price)}
                  {a.oldPrice ? <s>{formatSom(a.oldPrice)}</s> : null}
                </span>
              </label>
            </Fragment>
          ))}
        </div>
      )}
      {detail && (
        <ApplianceSheet
          item={detail}
          info={props.info?.[detail.id]}
          size={size(detail)}
          matches={style.finishes.includes(detail.finish)}
          chosen={!none && current?.id === detail.id}
          t={t}
          onPick={() => props.onPick(detail.id)}
          onClose={() => setDetail(null)}
        />
      )}
    </li>
  )
}

/* форма цен мастера */
type MasterDraft = MasterData & { sz: Partial<Record<'ldspL' | 'ldspW' | 'hdfL' | 'hdfW', number>> }
const EDGE_FIELD = { edge04: '0.4', edge1: '1', edge2: '2' } as const
type PlainPrice = 'ldsp' | 'ldspDecor' | 'hdf' | 'top' | 'hinge' | 'runner' | 'lift' | 'handle' | 'push' | 'leg' | 'hanger' | 'gola' | 'plinth' | 'work' | 'delivery' | 'markup'
type PriceField = PlainPrice | keyof typeof EDGE_FIELD
const PRICE_FIELDS: PriceField[] = ['ldsp', 'ldspDecor', 'hdf', 'edge04', 'edge1', 'edge2', 'top', 'hinge', 'runner', 'lift', 'handle', 'push', 'leg', 'hanger', 'gola', 'plinth', 'work', 'delivery', 'markup']

const fmt = (v: number) => (Number.isInteger(v) ? String(v) : (Math.round(v * 10) / 10).toFixed(1).replace('.', ','))
/** до сотых, лишние нули не пишем — как `num` в `master.ts`: 4.78 → «4,78», 4.8 → «4,8» */
const fmt2 = (v: number) => String(Math.round(v * 100) / 100).replace('.', ',')

/** Образец цвета из каталога: шпон и дерево — с полосками, бетон — с пятнами. */
function colorSwatch(color: string, texture?: 'wood' | 'concrete'): string {
  if (texture === 'wood') return `repeating-linear-gradient(95deg, rgb(0 0 0 / 0%) 0 3px, rgb(0 0 0 / 12%) 3px 4px), ${color}`
  if (texture === 'concrete') return `radial-gradient(circle at 30% 35%, rgb(255 255 255 / 20%), transparent 55%), ${color}`
  return color
}

/** Образец фартука: камень — с прожилкой, плитка — с сеткой швов, кирпич — кладкой. */
function splashSwatch(c: { kind: string; color: string; vein?: string }, top: string, wall: string): string {
  if (c.kind === 'slab') return top
  if (c.kind === 'paint') return wall
  if (c.kind === 'stone') return topSwatch({ pattern: 'marble', base: c.color, vein: c.vein })
  if (c.kind === 'concrete') return colorSwatch(c.color, 'concrete')
  if (c.kind === 'subway')
    return `linear-gradient(90deg, rgb(0 0 0 / 14%) 1px, transparent 1px) 0 0 / 14px 7px, linear-gradient(rgb(0 0 0 / 14%) 1px, ${c.color} 1px) 0 0 / 14px 7px`
  if (c.kind === 'zellige')
    return `linear-gradient(90deg, rgb(0 0 0 / 12%) 1px, transparent 1px) 0 0 / 9px 9px, linear-gradient(rgb(0 0 0 / 12%) 1px, ${c.color} 1px) 0 0 / 9px 9px`
  if (c.kind === 'brick') return `linear-gradient(rgb(255 255 255 / 45%) 1px, transparent 1px) 0 0 / 16px 8px, ${c.color}`
  return c.color
}

function topSwatch(look: { pattern: string; base: string; vein?: string }): string {
  if (look.pattern === 'marble') return `linear-gradient(125deg, transparent 0 44%, ${look.vein} 45% 47%, transparent 48%), ${look.base}`
  if (look.pattern === 'speckle') return `radial-gradient(${look.vein} 12%, transparent 13%) 0 0 / 6px 6px, ${look.base}`
  if (look.pattern === 'wood') return colorSwatch(look.base, 'wood')
  if (look.pattern === 'concrete') return colorSwatch(look.base, 'concrete')
  return look.base
}

function styleSwatch(s: KitchenStyle): string {
  const tone = s.tones[0]
  return `linear-gradient(160deg, ${s.wall} 0 38%, ${tone.upper ?? tone.facade} 38% 52%, ${s.splashColor} 52% 60%, ${tone.facade} 60% 100%)`
}

/** Кружок цвета фасада: сверху — верхние шкафы, у шпона и камня — рисунок. */
function toneSwatch(facade: string, upper?: string, texture?: string): string {
  const pattern =
    texture === 'wood'
      ? 'repeating-linear-gradient(100deg, rgb(0 0 0 / 0%) 0 3px, rgb(0 0 0 / 10%) 3px 4px), '
      : texture === 'stone'
        ? 'linear-gradient(125deg, transparent 0 46%, rgb(255 255 255 / 55%) 47% 49%, transparent 50%), '
        : texture === 'concrete'
          ? 'radial-gradient(circle at 30% 40%, rgb(255 255 255 / 18%), transparent 60%), '
          : ''
  const base = upper ? `linear-gradient(180deg, ${upper} 0 42%, ${facade} 42% 100%)` : facade
  return `${pattern}${base}`
}

/* ───────── иконки ───────── */

function ShapeIcon({ shape }: { shape: Shape }) {
  const wall = 'var(--kp-ink)'
  const cab = 'var(--kp-accent)'
  return (
    <svg className="kp-shape__icon" viewBox="0 0 64 48" aria-hidden="true">
      <path
        d={shape === 'u' ? 'M6 44V6h52v38' : shape === 'straight' || shape === 'island' ? 'M6 6h52' : 'M6 44V6h52'}
        fill="none"
        stroke={wall}
        strokeWidth="3"
        strokeLinecap="round"
      />
      <rect x="8" y="8" width="48" height="9" rx="2" fill={cab} />
      {(shape === 'corner' || shape === 'u') && <rect x="8" y="8" width="9" height="34" rx="2" fill={cab} />}
      {shape === 'u' && <rect x="47" y="8" width="9" height="34" rx="2" fill={cab} />}
      {shape === 'island' && <rect x="18" y="30" width="28" height="11" rx="2" fill={cab} opacity="0.75" />}
    </svg>
  )
}

/** Маленький рисунок фасада: как шкаф будет выглядеть спереди. */
function FrontIcon({ variant, row }: { variant: FrontVariant; row: 'base' | 'upper' }) {
  const s = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinejoin: 'round' as const }
  const body = <rect x="3" y="3" width="26" height="22" rx="1.5" {...s} />
  const lines: Record<string, React.ReactNode> = {
    doors: <path d="M16 3v22M13 14h.01M19 14h.01" {...s} />,
    drawers1: <path d="M13 8h6" {...s} />,
    drawers2: <path d="M3 14h26M13 8.5h6M13 19.5h6" {...s} />,
    drawers3: <path d="M3 9h26M3 17h26M13 6h6M13 13h6M13 21h6" {...s} />,
    drawers4: <path d="M3 8.5h26M3 14h26M3 19.5h26M13 5.8h6M13 11.2h6M13 16.8h6M13 22.3h6" {...s} />,
    mix: <path d="M3 9h26M16 9v16M13 6h6M13.5 17h.01M18.5 17h.01" {...s} />,
    open: <path d="M3 11h26M3 18h26" {...s} />,
    glass: <path d="M16 3v22M6 6h7v16H6zM19 6h7v16h-7z" {...s} />,
    mirror: <path d="M16 3v22M7 11l4-4M7 16l6-6M20 11l4-4M20 16l6-6" {...s} />,
    lift: <path d="M3 25h26M10 22h12M16 9l-4 4M16 9l4 4" {...s} />,
    none: <path d="M8 8l16 12M24 8L8 20" {...s} strokeDasharray="2 2" />,
  }
  return (
    <svg viewBox="0 0 32 28" className="kp-front-opt__icon" aria-hidden="true">
      {variant === 'none' ? <rect x="3" y="3" width="26" height="22" rx="1.5" {...s} strokeDasharray="3 2" /> : body}
      {lines[variant === 'open' && row === 'upper' ? 'open' : variant]}
    </svg>
  )
}

function SlotIcon({ slot }: { slot: SlotKind }) {
  const paths: Record<SlotKind, string> = {
    fridge: 'M8 3h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM7 10h10M10 6v2M10 13v3',
    oven: 'M4 4h16v16H4zM4 8h16M7 11h10v6H7zM8 6h.01M16 6h.01',
    hob: 'M3 7h18v10H3zM8 12m-2.2 0a2.2 2.2 0 1 0 4.4 0a2.2 2.2 0 1 0-4.4 0M16 12m-2.2 0a2.2 2.2 0 1 0 4.4 0a2.2 2.2 0 1 0-4.4 0',
    hood: 'M10 3h4v7h-4zM4 14l6-4h4l6 4zM4 14h16v2H4z',
    dishwasher: 'M5 3h14v18H5zM5 7h14M9 5h.01M15 5h.01M8 12h8M8 16h8',
    microwave: 'M3 6h18v12H3zM5 8h10v8H5zM18 9v.01M18 12v.01',
    washer: 'M5 3h14v18H5zM5 7h14M12 14m-4 0a4 4 0 1 0 8 0a4 4 0 1 0-8 0M8 5h.01',
  }
  return (
    <svg viewBox="0 0 24 24" className="kp-icon" aria-hidden="true">
      <path d={paths[slot]} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const iconProps = { viewBox: '0 0 24 24', className: 'kp-icon', 'aria-hidden': true as const }
const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

const STEP_ICON: Record<Step, React.ReactNode> = {
  kitchen: (
    <svg {...iconProps}>
      <path d="M4 20V4h16M4 9h11M3 15l4-4 4 4" {...stroke} />
    </svg>
  ),
  tech: (
    <svg {...iconProps}>
      <path d="M5 3h14v18H5zM5 8h14M9 5.5h.01M12 14m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0" {...stroke} />
    </svg>
  ),
  style: (
    <svg {...iconProps}>
      <path d="M4 4h7v16H4zM13 4h7v7h-7zM13 13h7v7h-7z" {...stroke} />
    </svg>
  ),
  total: (
    <svg {...iconProps}>
      <path d="M5 12l4 4L19 6" {...stroke} />
    </svg>
  ),
}

/** Корзина — в нижней панели телефона. */
function IconCart() {
  return (
    <svg {...iconProps}>
      <path d="M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h9.4a1 1 0 0 0 1-.8L21 8H7M9 20h.01M17 20h.01" {...stroke} />
    </svg>
  )
}

/** Значок ручки: как она выглядит на дверце. */
function HandleIcon({ kind }: { kind: HandleKind }) {
  const s = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  const door = <rect x="4" y="3" width="24" height="26" rx="1.5" {...s} strokeOpacity={0.45} />
  const parts: Partial<Record<HandleKind, React.ReactNode>> = {
    edge: <path d="M9 3.5h14" {...s} strokeWidth={3} />,
    rail: <path d="M22 9v12" {...s} strokeWidth={2.4} />,
    long: <path d="M22 6v20" {...s} strokeWidth={2.4} />,
    knurled: <path d="M22 10v11M20.5 12h3M20.5 14.5h3M20.5 17h3M20.5 19.5h3" {...s} />,
    tbar: <path d="M22 11v9M22 15.5h-2" {...s} strokeWidth={2.2} />,
    bar: <path d="M22 10v11M20 10h2M20 21h2" {...s} strokeWidth={1.8} />,
    ring: (
      <>
        <circle cx="22" cy="12" r="1.4" {...s} />
        <circle cx="22" cy="16" r="3" {...s} />
      </>
    ),
    leather: <path d="M20 10q5 5.5 0 11" {...s} strokeWidth={2.6} stroke="#8a5a3b" />,
    cup: <path d="M11 15h10a5 3.5 0 0 1-10 0z" {...s} />,
    knob: <circle cx="22" cy="16" r="1.8" {...s} strokeWidth={2.2} />,
    bow: <path d="M22 10q3 5.5 0 11" {...s} strokeWidth={1.8} />,
  }
  return (
    <svg viewBox="0 0 32 32" className="kp-handle__icon" aria-hidden="true">
      {door}
      {parts[kind]}
    </svg>
  )
}

function IconSun() {
  return (
    <svg {...iconProps}>
      <path
        d="M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
        {...stroke}
      />
    </svg>
  )
}

function IconMoon() {
  return (
    <svg {...iconProps}>
      <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" {...stroke} />
    </svg>
  )
}

function IconTag() {
  return (
    <svg {...iconProps}>
      <path d="M3 12V4h8l10 10-8 8zM7.5 8.5h.01" {...stroke} />
    </svg>
  )
}

function IconCamera() {
  return (
    <svg {...iconProps}>
      <path d="M4 8h3l2-3h6l2 3h3v11H4zM12 10.5a3.25 3.25 0 1 0 0 6.5a3.25 3.25 0 1 0 0-6.5" {...stroke} />
    </svg>
  )
}

function IconExpand() {
  return (
    <svg {...iconProps}>
      <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" {...stroke} />
    </svg>
  )
}

function IconShrink() {
  return (
    <svg {...iconProps}>
      <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" {...stroke} />
    </svg>
  )
}

function IconRuler() {
  return (
    <svg {...iconProps}>
      <path d="M3 16l13-13 5 5L8 21zM7 12l2 2M10 9l1.5 1.5M13 6l2 2M5 14l1 1" {...stroke} />
    </svg>
  )
}

function IconUndo({ redo = false }: { redo?: boolean }) {
  return (
    <svg {...iconProps} style={redo ? { transform: 'scaleX(-1)' } : undefined}>
      <path d="M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11" {...stroke} />
    </svg>
  )
}

function IconFile() {
  return (
    <svg {...iconProps}>
      <path d="M6 3h8l4 4v14H6zM14 3v4h4M9 13h6M9 17h6" {...stroke} />
    </svg>
  )
}

function IconArrow({ flip = false, down = false }: { flip?: boolean; down?: boolean }) {
  return (
    <svg {...iconProps} style={flip ? { transform: 'scaleX(-1)' } : down ? { transform: 'rotate(90deg)' } : undefined}>
      <path d="M5 12h14M13 6l6 6-6 6" {...stroke} />
    </svg>
  )
}

function IconPanel() {
  return (
    <svg {...iconProps}>
      <path d="M4 5h16v14H4zM14 5v14M16.5 9h1.5M16.5 12h1.5" {...stroke} />
    </svg>
  )
}

function IconDots() {
  return (
    <svg {...iconProps}>
      <path d="M5.5 12h.01M12 12h.01M18.5 12h.01" {...stroke} strokeWidth={3.2} />
    </svg>
  )
}

/** Значок пункта меню «+» (P1): вид модуля спереди — дверцы, ящики, пенал, техника, планка, автозаполнение. */
function AddIcon({ kind }: { kind: AddItem }) {
  const d: Record<AddItem, string> = {
    doors: 'M5 4h14v16H5zM12 4v16M10 11v2M14 11v2',
    drawers: 'M5 4h14v16H5zM5 9.5h14M5 15h14M10.5 7h3M10.5 12.2h3M10.5 17.5h3',
    pantry: 'M8 2.5h8v19H8zM8 10h8M13.5 5.5v2M13.5 13v3',
    tech: 'M5 3.5h14v17H5zM5 7.5h14M12 14m-3.5 0a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0 -7 0',
    strip: 'M10.5 3.5h3v17h-3zM4 12h4M16 12h4',
    fill: 'M4 5h7v14H4zM13 5h7v6.5h-7zM13 13.5h7V19h-7z',
  }
  return (
    <svg {...iconProps} className="kp-icon kp-add__icon">
      <path d={d[kind]} {...stroke} />
    </svg>
  )
}

function IconClose() {
  return (
    <svg {...iconProps}>
      <path d="M6 6l12 12M18 6L6 18" {...stroke} />
    </svg>
  )
}
