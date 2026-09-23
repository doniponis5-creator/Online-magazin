'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { phones, whatsappHref } from '@/data/contacts'
import { useCart } from '@/lib/cart/CartProvider'
import { formatSom } from '@/lib/format'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { defaultPick } from '@/lib/kitchen/catalog'
import { checkProject, type Check } from '@/lib/kitchen/checks'
import {
  FRONT_COLORS,
  FRONT_MATERIALS,
  frontColor,
  HANDLE_METALS,
  HANDLES,
  SPLASH_GROUPS,
  splashChoice,
  SPLASHES,
  TOP_MATERIALS,
  topChoice,
  TOPS,
  type FrontMaterial,
  type SplashGroup,
  type TopMaterial,
} from '@/lib/kitchen/finishes'
import { BASE_FRONTS, UPPER_FRONTS } from '@/lib/kitchen/fronts'
import {
  canChangeWall,
  CEILING,
  itemPositions,
  LIMITS,
  minA,
  moduleCenter,
  moveItem,
  nextWall,
  pinCabinet,
  planKitchen,
  resolveArrangement,
  stepItem,
  WINDOW_LIMITS,
  wallOf,
  type Plan,
} from '@/lib/kitchen/layout'
import { DEFAULT_STATE, queryFromState, stateFromQuery } from '@/lib/kitchen/share'
import { cutList, frontList, hardware, modulesOf, topList, type SpecData } from '@/lib/kitchen/spec'
import { FLOORS, getStyle, getTone, STYLE_GROUPS, STYLES, WALL_COLORS, type KitchenStyle } from '@/lib/kitchen/styles'
import type { HandleKind } from '@/lib/kitchen/styles'
import {
  isCabinet,
  SLOTS,
  type BaseFront,
  type CabinetId,
  type FrontVariant,
  type ItemKey,
  type KitchenAppliance,
  type KitchenState,
  type Shape,
  type SlotKind,
  type WallId,
} from '@/lib/kitchen/types'
import { DRAWING_CSS, elevationSvg } from './drawing'
import { PlanSketch } from './PlanSketch'
import { sheetHtml } from './printSheet'
import { kitchenTexts, type KitchenTexts } from './texts'
import type { BuildInput, CabInfo, Dims } from './three/build'
import type { DragTarget, KitchenEngine, Pick, Quality, View } from './three/engine'
import type { Photo } from './three/photo'
import './kitchen.css'

type Step = 'shape' | 'size' | 'style' | 'finish' | 'tech'
const STEPS: Step[] = ['shape', 'size', 'style', 'finish', 'tech']
const SHAPES: Shape[] = ['straight', 'corner', 'u', 'island']
/** Без этих трёх кухня не кухня: если в каталоге пусто — ставим типовую модель. */
const CORE: SlotKind[] = ['oven', 'hob', 'hood']
const OPTIONAL: SlotKind[] = ['fridge', 'dishwasher', 'microwave', 'washer']

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

/** Сохранённый вариант кухни: ссылка-адрес и картинка. */
type Variant = { id: string; name: string; label: string; q: string; img: string; at: number }

/** Что сейчас переставляют: предмет (техника, мойка, свой шкаф) или обычный шкаф. */
type MoveSel = { key: ItemKey } | { cab: CabInfo; w: number; wall: WallId; center: number }

function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas')
    return Boolean(c.getContext('webgl2') ?? c.getContext('webgl'))
  } catch {
    return false
  }
}

export function KitchenPlanner({ appliances }: { appliances: KitchenAppliance[] }) {
  const { lang } = useI18n()
  const t = kitchenTexts(lang)
  const cart = useCart()

  const [state, setState] = useState<KitchenState>(DEFAULT_STATE)
  const [hydrated, setHydrated] = useState(false)
  const [step, setStep] = useState<Step>('shape')
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
  const [prices, setPrices] = useState(true)
  const [full, setFull] = useState(false)
  const [quality, setQuality] = useState<Quality>('hd')
  const [qualityPx, setQualityPx] = useState('')
  /** отделка: что красим (весь гарнитур, низ, верх) и какой материал открыт */
  const [paintFor, setPaintFor] = useState<'all' | 'lower' | 'upper'>('all')
  const [frontMat, setFrontMat] = useState<FrontMaterial>('laminate')
  const [topMat, setTopMat] = useState<TopMaterial>('quartz')
  const [splashGroup, setSplashGroup] = useState<SplashGroup>('stone')
  const [engineState, setEngineState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [built, setBuilt] = useState(false)
  const [spec, setSpec] = useState<SpecData | null>(null)
  const [photosVersion, setPhotosVersion] = useState(0)
  const [thumbs, setThumbs] = useState<Partial<Record<string, string>>>({})
  const [cartResult, setCartResult] = useState<{ ok: number; failed: number } | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  /** ширины всех шкафов прямо в 3D */
  const [showDims, setShowDims] = useState(false)
  const [variants, setVariants] = useState<Variant[]>([])
  const [, setHistTick] = useState(0)
  const [hint, setHint] = useState(true)
  const [origin, setOrigin] = useState('')

  const rootRef = useRef<HTMLDivElement>(null)
  const hostRef = useRef<HTMLDivElement>(null)
  const engineRef = useRef<KitchenEngine | null>(null)
  const photos = useRef(new Map<string, Photo | null>())
  const autoView = useRef(false)
  const editingRef = useRef<CabInfo | null>(null)
  editingRef.current = editing

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

  const chosen: Items = useMemo(() => {
    const out: Items = {}
    for (const slot of SLOTS) {
      const pick = state.picks[slot]
      if (pick === null) out[slot] = null
      else if (pick && byId.get(pick)?.slot === slot) out[slot] = byId.get(pick)
      else {
        const id = defaultPick(slot, bySlot[slot])
        out[slot] = id ? byId.get(id) : CORE.includes(slot) ? undefined : null
      }
    }
    return out
  }, [state.picks, byId, bySlot])

  const planFor = useCallback(
    (s: KitchenStyle): Plan =>
      planKitchen(
        {
          shape: state.shape,
          a: state.a,
          b: state.b,
          c: state.c,
          island: state.island,
          fridge: chosen.fridge,
          dishwasher: chosen.dishwasher,
          washer: chosen.washer,
          microwave: chosen.microwave,
          hob: chosen.hob,
          arrangement: state.arrangement,
          tallOven: state.tallOven,
          pantries: state.pantries,
          noWindow: state.noWindow,
          windowW: state.windowW,
          fridgeOpen: state.fridgeOpen,
          ovenApart: state.ovenApart,
          noOven: chosen.oven === null,
          cabinets: state.cabinets,
        },
        { shelves: s.shelves },
      ),
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
      chosen,
    ],
  )
  const plan = useMemo(() => planFor(style), [planFor, style])
  const dropped = useMemo(() => new Set(plan.dropped.map((d) => d.slot).filter((s): s is SlotKind => Boolean(s))), [plan])
  const order = useMemo(() => resolveArrangement(state.shape, state.arrangement, state.cabinets), [state.shape, state.arrangement, state.cabinets])
  const positions = useMemo(() => itemPositions(plan), [plan])

  /** Что реально стоит в кухне: без того, что не поместилось. */
  const items: Items = useMemo(() => {
    const out: Items = { ...chosen }
    for (const slot of dropped) out[slot] = null
    // Встраиваемая микроволновка живёт в пенале; отдельностоящую в 3D не ставим.
    if (out.microwave && !out.microwave.builtIn) out.microwave = null
    return out
  }, [chosen, dropped])

  const inProject = useMemo(() => SLOTS.map((s) => items[s]).filter((a): a is KitchenAppliance => Boolean(a)), [items])
  const total = inProject.reduce((sum, a) => sum + a.price, 0)

  /* ───────── адрес страницы ───────── */

  useEffect(() => {
    setOrigin(window.location.origin)
    const q = new URLSearchParams(window.location.search)
    if (q.has('f')) setState(stateFromQuery(q, new Set(byId.keys())))
    setHydrated(true)
  }, [byId])

  useEffect(() => {
    if (!hydrated) return
    const timer = setTimeout(() => {
      window.history.replaceState(window.history.state, '', `${window.location.pathname}?${queryFromState(state)}`)
    }, 300)
    return () => clearTimeout(timer)
  }, [state, hydrated])

  const shareUrl = `${origin}/${lang}/kitchen?${queryFromState(state)}`

  // Шапка сайта уезжает при прокрутке вниз и возвращается при прокрутке вверх.
  // 3D на телефоне прилипает прямо под ней — поэтому следим за её высотой.
  useEffect(() => {
    const header = document.querySelector<HTMLElement>('header.header')
    const root = rootRef.current
    if (!header || !root) return
    const update = () => {
      const h = Math.round(header.getBoundingClientRect().height)
      root.style.setProperty('--kp-header', `${h}px`)
      root.style.setProperty('--kp-top', header.classList.contains('is-hidden') ? '0px' : `${h}px`)
    }
    update()
    const size = new ResizeObserver(update)
    size.observe(header)
    const cls = new MutationObserver(update)
    cls.observe(header, { attributes: true, attributeFilter: ['class'] })
    return () => {
      size.disconnect()
      cls.disconnect()
    }
  }, [])

  /* ───────── 3D ───────── */

  const pickRef = useRef<(pick: Pick) => void>(() => {})
  pickRef.current = ({ slot, item, dims, cab }) => {
    setHint(false)
    setSelected(slot)
    setMoving(item ? { key: item } : cab?.row === 'base' ? cabSel(cab) : null)
    setMeasure(dims)
    setEditing(cab)
    if (slot) {
      setStep('tech')
      setOpen(slot)
    }
  }
  const moveRef = useRef<(what: DragTarget, wall: WallId, pos: number) => void>(() => {})
  moveRef.current = (what, wall, pos) => {
    setHint(false)
    if ('item' in what) {
      setMoving({ key: what.item })
      update({ arrangement: moveItem(order, what.item, wall, pos, positions) })
      return
    }
    // обычный шкаф становится своим и встаёт туда, куда его отпустили
    const sel = cabSel(what.cab)
    if (!sel) return
    commitPinned({ ...sel, wall, center: pos }, (o) => o)
  }

  useEffect(() => {
    if (!hasWebGL()) {
      setEngineState('error')
      return
    }
    let engine: KitchenEngine | null = null
    let cancelled = false
    import('./three/engine')
      .then(({ KitchenEngine }) => {
        if (cancelled || !hostRef.current) return
        engine = new KitchenEngine(hostRef.current, {
          onPick: (pick) => pickRef.current(pick),
          onMove: (item, wall, pos) => moveRef.current(item, wall, pos),
          onError: () => setEngineState('error'),
        })
        engineRef.current = engine
        setQuality(engine.getQuality())
        setEngineState('ready')
      })
      .catch(() => setEngineState('error'))
    return () => {
      cancelled = true
      engine?.dispose()
      engineRef.current = null
    }
  }, [])

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
  const finish = useMemo(
    () => ({ facade: frontColor(state.facade), upper: state.upperFacade === 'style' ? ('style' as const) : frontColor(state.upperFacade), top: topSel }),
    [state.facade, state.upperFacade, topSel],
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
    }),
    // photosVersion — фото пришло, картинку на технике надо обновить
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [plan, lookStyle, tone, items, photosVersion, ceiling, state.lowUppers, state.floor, wallColor, state.fronts, finish],
  )

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
    // Шкафу поменяли фасады — карточка остаётся на нём же, с новыми размерами.
    const cab = editingRef.current
    const again = cab ? engine.measureCab(cab.key) : null
    setMeasure(again?.dims ?? null)
    setEditing(again?.cab ?? null)
    // moving намеренно не в списке: анимация — только при перестройке кухни
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildInput, engineState, items, state.style, state.tone, state.shape])

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

  useEffect(() => {
    engineRef.current?.setSelected(selected)
  }, [selected, engineState, buildInput])

  // На весь экран: страница под 3D не прокручивается, Esc — свернуть.
  useEffect(() => {
    if (!full) return
    document.documentElement.classList.add('kp-lock')
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFull(false)
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

  const changeQuality = (q: Quality) => {
    setQuality(q)
    engineRef.current?.setQuality(q)
  }
  const qualityTitle = () => {
    const px = engineRef.current?.restPixels()
    if (px) setQualityPx(t.qualityPixels(px.w, px.h))
  }

  const changeView = (v: View, auto = false) => {
    autoView.current = auto
    setView(v)
    engineRef.current?.setView(v)
  }

  // На шаге «Размер» кухня показывается сверху, как чертёж.
  const goStep = (s: Step) => {
    setStep(s)
    if (s === 'size' && view !== 'top') changeView('top', true)
    else if (s !== 'size' && autoView.current && view === 'top') changeView('angle', true)
  }

  // Превью стилей — ваша же кухня в каждом стиле.
  const thumbKey = `${state.shape}:${sizeKey}:${SLOTS.map((s) => items[s]?.id ?? '-').join('|')}:${photosVersion}:${state.lowUppers ? 0 : 1}:${state.floor ?? ''}:${state.wallColor ?? 0}:${state.noWindow ? 0 : 1}`
  const doneThumbs = useRef('')
  useEffect(() => {
    const engine = engineRef.current
    if (step !== 'style' || engineState !== 'ready' || !built || doneThumbs.current === thumbKey) return
    let cancelled = false
    let i = 0
    const next = () => {
      if (cancelled) return
      if (i >= STYLES.length) {
        doneThumbs.current = thumbKey
        return
      }
      const s = STYLES[i++]
      const url = engine?.thumbnail({ ...buildInput, style: s, tone: s.tones[0], plan: planFor(s), fronts: {}, finish: undefined })
      if (url) setThumbs((prevThumbs) => ({ ...prevThumbs, [s.id]: url }))
      timer = window.setTimeout(next, 40)
    }
    let timer = window.setTimeout(next, 260)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [step, engineState, built, thumbKey, buildInput, planFor])

  useEffect(() => {
    if (!hint) return
    const timer = setTimeout(() => setHint(false), 9000)
    return () => clearTimeout(timer)
  }, [hint])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 2400)
    return () => clearTimeout(timer)
  }, [toast])

  /* ───────── действия ───────── */

  /**
   * История для «Отменить / Вернуть». Быстрые изменения подряд (ползунок
   * размера) сливаются в один шаг — отмена возвращает к началу движения.
   */
  const stateRef = useRef(state)
  stateRef.current = state
  const hist = useRef<{ past: KitchenState[]; future: KitchenState[]; at: number }>({ past: [], future: [], at: 0 })
  const track = () => {
    const h = hist.current
    const now = Date.now()
    if (now - h.at > 600) {
      h.past.push(stateRef.current)
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
  const setPick = (slot: SlotKind, id: string | null) => {
    track()
    setCartResult(null)
    setState((s) => ({ ...s, picks: { ...s.picks, [slot]: id } }))
  }
  const setShape = (shape: Shape) => update({ shape, a: Math.max(state.a, minA(shape)), arrangement: undefined })
  const setFront = (key: string, v: FrontVariant) => {
    track()
    setState((s) => {
      // у своего шкафа фасады хранятся в нём самом
      if (isCabinet(key) && s.cabinets?.[key]) return { ...s, cabinets: { ...s.cabinets, [key]: { ...s.cabinets[key], front: v as BaseFront } } }
      return { ...s, fronts: { ...s.fronts, [key]: v } }
    })
  }
  const frontCount = Object.keys(state.fronts ?? {}).length + Object.keys(state.cabinets ?? {}).length

  // Перестановка кнопками. У левой стены и у острова ряд идёт справа налево — поэтому наоборот.
  const present = useMemo(() => new Set(Object.keys(positions) as ItemKey[]), [positions])

  /** Обычный шкаф, на который нажали: где стоит, ширина, фасады. */
  function cabSel(cab: CabInfo): Extract<MoveSel, { cab: CabInfo }> | null {
    const run = plan.runs.find((r) => r.id === cab.key[0])
    const x = Number(cab.key.slice(1))
    const m = run?.modules.find((mod) => Math.round(mod.x) === x)
    if (!run || !m) return null
    return { cab, w: m.w, wall: run.id as WallId, center: moduleCenter(run, m) }
  }

  /**
   * Обычный шкаф становится своим (k1, k2…): встаёт на своё место в порядке,
   * забирает свои фасады, и к нему применяется действие act (сдвиг, другая стена).
   */
  function commitPinned(
    sel: Extract<MoveSel, { cab: CabInfo }>,
    act: (o: ReturnType<typeof resolveArrangement>, id: CabinetId) => ReturnType<typeof resolveArrangement>,
    w = sel.w,
  ) {
    const front = (sel.cab.variant as BaseFront) ?? 'doors'
    const pinned = pinCabinet(order, state.cabinets ?? {}, { w, front }, sel.wall, sel.center, positions)
    const fronts = { ...state.fronts }
    delete fronts[sel.cab.key]
    const nextCab: CabInfo = { key: pinned.id, row: 'base', variant: front }
    editingRef.current = nextCab
    setEditing(nextCab)
    setMoving({ key: pinned.id })
    update({
      arrangement: act(pinned.order, pinned.id),
      cabinets: pinned.cabinets as KitchenState['cabinets'],
      fronts: Object.keys(fronts).length ? fronts : undefined,
    })
  }

  const stepMoving = (dir: 1 | -1) => {
    if (!moving) return
    const wallOfSel = 'key' in moving ? wallOf(order, moving.key) : moving.wall
    const delta = (wallOfSel === 'B' || wallOfSel === 'I' ? -dir : dir) as 1 | -1
    if ('key' in moving) {
      update({ arrangement: stepItem(order, moving.key, delta, present) })
      return
    }
    commitPinned(moving, (o, id) => stepItem(o, id, delta, new Set([...present, id])))
  }
  const toOtherWall = () => {
    if (!moving) return
    if ('key' in moving) update({ arrangement: nextWall(order, moving.key, state.shape) })
    else commitPinned(moving, (o, id) => nextWall(o, id, state.shape))
  }
  /** Ширина шкафа: свой меняем сразу, обычный сперва становится своим. */
  const movingCabW = !moving ? null : 'key' in moving ? (isCabinet(moving.key) ? (state.cabinets?.[moving.key]?.w ?? null) : null) : Math.round(moving.w)
  /** Ширина по 5 см: 78 → 80 → 85, и обратно 78 → 75. */
  const setCabWidth = (dir: 1 | -1) => {
    if (!moving || movingCabW === null) return
    const snapped = dir > 0 ? Math.floor(movingCabW / 5) * 5 + 5 : Math.ceil(movingCabW / 5) * 5 - 5
    const next = Math.max(15, Math.min(120, snapped))
    if ('key' in moving) {
      const id = moving.key
      if (!isCabinet(id) || !state.cabinets?.[id]) return
      update({ cabinets: { ...state.cabinets, [id]: { ...state.cabinets[id], w: next } } })
      return
    }
    commitPinned(moving, (o) => o, next)
  }
  const removeCab = () => {
    if (!moving || !('key' in moving) || !isCabinet(moving.key)) return
    const id = moving.key
    const cabinets = { ...state.cabinets }
    delete cabinets[id]
    const arrangement = Object.fromEntries(Object.entries(order).map(([w, list]) => [w, list.filter((k) => k !== id)]))
    setMoving(null)
    closeMeasure()
    update({ arrangement, cabinets: Object.keys(cabinets).length ? cabinets : undefined })
  }

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
    if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && moving) {
      e.preventDefault()
      stepMoving(e.key === 'ArrowLeft' ? -1 : 1)
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && movingKey && isCabinet(movingKey)) {
      e.preventDefault()
      removeCab()
    } else if (e.key === 'Escape') {
      closeMeasure()
      setMoving(null)
    } else if (['1', '2', '3', '4'].includes(e.key) && engineState === 'ready') {
      changeView((['angle', 'eye', 'front', 'top'] as View[])[Number(e.key) - 1])
    }
  }
  useEffect(() => {
    const on = (e: KeyboardEvent) => keysRef.current(e)
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [])
  const movingName = !moving
    ? ''
    : !movingKey
      ? t.cabName(Math.round((moving as { w: number }).w))
      : isCabinet(movingKey)
        ? t.cabName(Math.round(state.cabinets?.[movingKey]?.w ?? 60))
        : movingKey === 'pantry' || movingKey === 'pantry2'
          ? t.pantryName
          : movingKey === 'sink'
            ? t.sink
            : movingKey === 'tall'
              ? t.tallName
              : movingKey === 'hob' && hobHasOven
                ? t.hobOven
                : t.slots[SLOT_OF[movingKey]!]
  const movingShown = Boolean(moving && (movingKey ? present.has(movingKey) : true))
  const otherWallLabel = !moving
    ? ''
    : state.shape === 'island'
      ? (movingKey ? wallOf(order, movingKey) : (moving as { wall: WallId }).wall) === 'I'
        ? t.toWall
        : t.toIsland
      : t.otherWall
  const canOtherWall = moving ? canChangeWall(state.shape, movingKey ?? 'k1') : false

  const openSlot = (slot: SlotKind) => {
    setStep('tech')
    setOpen((o) => (o === slot ? null : slot))
    setSelected(slot)
    engineRef.current?.focus(slot)
  }

  const addAll = () => {
    let ok = 0
    let failed = 0
    for (const a of inProject) {
      if (cart.add(a.id, 'std', 1)) ok++
      else failed++
    }
    setCartResult({ ok, failed })
  }

  const saveImage = async () => {
    const engine = engineRef.current
    if (!engine || saving) return
    setSaving(true)
    // даём кнопке показать «Готовим 4K…», потом рисуем
    await new Promise((r) => setTimeout(r, 30))
    const blob = await engine.snapshot4k()
    setSaving(false)
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'smarket-kitchen-4k.jpg'
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 5000)
  }

  const closeMeasure = () => {
    setMeasure(null)
    setEditing(null)
    engineRef.current?.showMeasure(null)
  }

  const measureTitle = (d: Dims) => {
    if (d.kind === 'appliance' && d.slot) return items[d.slot]?.name ?? t.slots[d.slot]
    return t.dimsKinds[d.kind]
  }
  const mwBuiltIn = Boolean(items.microwave?.builtIn)
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
      setToast(shareUrl)
    }
  }

  /* ───────── мои варианты ───────── */

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem('kp-variants')
      if (raw) setVariants(JSON.parse(raw) as Variant[])
    } catch {
      // нет доступа к хранилищу — просто без сохранённых вариантов
    }
  }, [])
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
  const saveVariant = () => {
    const img = engineRef.current?.snapshot(360, 225) ?? ''
    const n = variants.reduce((max, v) => Math.max(max, Number(v.name.replace(/\D/g, '')) || 0), 0) + 1
    const label = `${t.shapes[state.shape][0]} · ${lang === 'ky' ? style.ky : style.ru}`
    const saved = storeVariants(
      [{ id: Date.now().toString(36), name: t.variantName(n), label, q: queryFromState(state), img, at: Date.now() }, ...variants].slice(0, 8),
    )
    if (saved) setToast(t.variantSaved)
  }
  const openVariant = (v: Variant) => {
    track()
    setCartResult(null)
    setState(stateFromQuery(new URLSearchParams(v.q), new Set(byId.keys())))
    rootRef.current?.querySelector('.kp-work')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  /* ───────── проверка проекта ───────── */

  const checks = useMemo(() => checkProject(plan), [plan])
  const checksOk = checks.filter((c) => c.level === 'ok').length
  const checkText = (c: Check): string => {
    switch (c.id) {
      case 'triangle':
        return c.level === 'ok' ? t.checks.triangleOk(c.sum) : t.checks.triangleWarn(c.legs, c.sum)
      case 'hobSides':
        return c.level === 'ok' ? t.checks.hobSidesOk(c.left, c.right) : t.checks.hobSidesWarn(c.left, c.right)
      case 'hobWindow':
        return t.checks.hobWindow
      case 'hobFridge':
        return t.checks.hobFridge(c.gap)
      case 'sinkDw':
        return c.level === 'ok' ? t.checks.sinkDwOk : t.checks.sinkDwWarn
      case 'sinkWindow':
        return t.checks.sinkWindow
      case 'fits':
        return c.level === 'ok' ? t.checks.fitsOk : t.checks.fitsWarn(c.count)
    }
  }

  const makerText = useMemo(() => makerList(plan, items, t), [plan, items, t])
  const copyList = async () => {
    try {
      await navigator.clipboard.writeText(`${t.makerTitle}\n\n${makerText}\n\n${shareUrl}`)
      setToast(t.copied)
    } catch {
      setToast(null)
    }
  }

  /* ───────── для мебельщика ───────── */

  const wallsLine = plan.runs.map((r) => `${r.id} ${Math.round(r.length)} ${t.cm}`).join(', ')
  const drawing = useMemo(() => {
    if (!spec) return null
    const labels = { cm: t.cm, appliance: (slot: string) => t.techShort[slot as SlotKind] ?? slot }
    const win = plan.window
    const walls = spec.runs.map((r) => ({
      id: r.id,
      title: t.wall(r.id, Math.round(r.length)),
      svg: elevationSvg(
        r,
        spec.heights,
        labels,
        win && r.id === 'A' && win.wall === 'back' ? { at: win.at, w: win.w, sill: 100, top: Math.min(230, ceiling - 25) } : null,
      ),
    }))
    const fronts = frontList(spec.runs)
    const cuts = cutList(spec.carcasses, spec.panels)
    const hw = hardware(spec)
    const tops = topList(spec.runs)
    const modules = spec.runs.reduce((s, r) => {
      const m = modulesOf(r)
      return s + m.lower.filter((b) => b.kind !== 'appliance').length + m.upper.filter((b) => b.kind !== 'panel').length
    }, 0)
    const frontsTotal = fronts.reduce((s, f) => s + f.count, 0)
    return { walls, fronts, cuts, hw, tops, modules, frontsTotal }
  }, [spec, plan.window, ceiling, t])

  /** Отделка словами — для мастера: материал и цвет фасадов, ручки, столешница. */
  const nameOf = (x: { ru: string; ky: string } | undefined) => (x ? (lang === 'ky' ? x.ky : x.ru) : '')
  const frontDesc = (id: string | undefined) => {
    const c = frontColor(id)
    return c ? `${nameOf(FRONT_MATERIALS.find((m) => m.id === c.material))} · ${nameOf(c)}` : ''
  }
  const finishFacts = () => {
    const lower = frontDesc(state.facade) || `${nameOf(style)} · ${nameOf(tone)}`
    const upper = state.upperFacade && state.upperFacade !== 'style' ? frontDesc(state.upperFacade) : ''
    const handleName = handleless
      ? t.handleless
      : `${nameOf(HANDLES.find((h) => h.id === handle))} · ${nameOf(HANDLE_METALS.find((m) => m.id === (state.handleMetal ?? style.metal)))}`
    const topName = topSel ? `${nameOf(TOP_MATERIALS.find((m) => m.id === topSel.material))} · ${nameOf(topSel)}, ${topSel.cm * 10} мм` : ''
    return [
      { label: t.frontsTitle2, value: upper ? `${lower} / ${upper}` : lower },
      { label: t.handlesTitle, value: handleName },
      ...(topName ? [{ label: t.topTitle, value: topName }] : []),
      ...(splashSel ? [{ label: t.splashTitle, value: `${nameOf(SPLASH_GROUPS.find((g) => g.id === splashSel.group))} · ${nameOf(splashSel)}` }] : []),
    ]
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
      [t.hw.gola, `${fmt(drawing.hw.gola)} ${t.meters}`],
      [t.hw.plinth, `${fmt(drawing.hw.plinth)} ${t.meters}`],
      [t.hw.splash, `${fmt(spec.splash)} ${t.m2}`],
    ].filter((r) => !/^0([.,]0+)?\s/.test(String(r[1])))
    return [
      { title: t.frontsTitle, head: [t.colPart, t.colSize, t.colQty], rows: drawing.fronts.map((f) => [t.frontTypes[f.type], size(f.w, f.h), f.count]) },
      { title: t.cutTitle, head: [t.colPart, t.colSize, t.colQty], rows: drawing.cuts.map((c) => [t.cutNames[c.name], size(c.a, c.b), c.count]) },
      {
        title: t.topTitle,
        head: [t.colWhat, t.colSize, t.colQty],
        rows: drawing.tops.rows.map((r) => [t.topRow(r.run, r.sink, r.hob), `${r.length} × ${r.depth} × ${r.thick}`, 1]),
        note: t.topTotal(fmt(drawing.tops.total)),
      },
      { title: t.hardwareTitle, head: [t.colWhat, t.colQtyUnit], rows: hwRows },
    ]
  }

  const [sheetBusy, setSheetBusy] = useState(false)
  const openSheet = () => {
    const engine = engineRef.current
    if (!drawing || !spec || sheetBusy) return
    // окно открываем сразу по нажатию — иначе браузер его заблокирует
    const win = window.open('', '_blank')
    setSheetBusy(true)
    const image = engine ? engine.snapshot(1600, 1000) : null
    const date = new Date().toLocaleDateString(lang === 'ky' ? 'ky-KG' : 'ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
    const html = sheetHtml({
      lang,
      title: t.sheetTitle,
      subtitle: t.sheetOf(t.shapes[state.shape][0], lang === 'ky' ? style.ky : style.ru, lang === 'ky' ? tone.ky : tone.ru),
      date,
      url: shareUrl,
      image,
      facts: [
        { label: t.factWalls, value: wallsLine },
        { label: t.factCeiling, value: `${ceiling} ${t.cm}` },
        { label: t.factModules, value: String(drawing.modules) },
        { label: t.factFronts, value: String(drawing.frontsTotal) },
        ...finishFacts(),
      ],
      walls: drawing.walls.map((w) => ({ title: w.title, svg: w.svg })),
      tables: sheetTables(),
      note: t.specNote,
      printLabel: t.specPdf,
      wallsTitle: t.wallsTitle,
    })
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }))
    if (win) win.location.href = url
    else {
      // окна запрещены — отдаём лист файлом, он откроется в браузере
      const a = document.createElement('a')
      a.href = url
      a.download = 'smarket-kitchen-master.html'
      a.click()
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000)
    setSheetBusy(false)
  }

  const sendMaster = `https://wa.me/?text=${encodeURIComponent(t.sendText(shareUrl, wallsLine))}`

  /* ───────── вёрстка ───────── */

  const stepIndex = STEPS.indexOf(step)
  const placedTags = SLOTS.filter((s) => items[s] && built)
  const wallLabels = {
    a: `A · ${state.a} ${t.cm}`,
    b: state.shape === 'corner' || state.shape === 'u' ? `B · ${state.b} ${t.cm}` : undefined,
    c: state.shape === 'u' ? `C · ${state.c} ${t.cm}` : undefined,
  }
  const editOptions: FrontVariant[] = editing ? (editing.row === 'base' ? BASE_FRONTS : UPPER_FRONTS) : []
  const frontLabel = (v: FrontVariant) =>
    editing?.row === 'upper' ? t.upperFronts[v as keyof typeof t.upperFronts] : t.baseFronts[v as keyof typeof t.baseFronts]

  return (
    <div className={`kp${full ? ' kp--full' : ''}`} ref={rootRef}>
      <header className="kp-head">
        <h1 className="kp-head__title">{t.title}</h1>
        <p className="kp-head__lead">{t.lead}</p>
      </header>

      <div className="kp-work">
        <div className="kp-stage" ref={hostRef} onPointerDown={() => setHint(false)}>
          {engineState !== 'error' && !built && (
            <div className="kp-loading" role="status">
              <span className="kp-loading__bar" />
              {t.loading}
            </div>
          )}
          {engineState === 'error' && <p className="kp-fallback">{t.noWebgl}</p>}

          {engineState === 'ready' && built && (
            <div className="kp-tags">
              {prices &&
                view !== 'top' &&
                placedTags.map((slot) => {
                  const a = items[slot]!
                  return (
                    <button
                      key={slot}
                      type="button"
                      className={`kp-tag${selected === slot ? ' is-on' : ''}`}
                      ref={(el) => engineRef.current?.setTag(slot, el)}
                      onClick={() => openSlot(slot)}
                      aria-label={`${t.slots[slot]}: ${a.name}, ${formatSom(a.price)}. ${t.pickHint}`}
                    >
                      <span className="kp-tag__in">
                        <span className="kp-tag__brand">{a.brand || t.slots[slot]}</span>
                        <span className="kp-tag__price">{formatSom(a.price)}</span>
                      </span>
                    </button>
                  )
                })}
              {measure &&
                (['w', 'h', 'd'] as const).map((k) => (
                  <span key={k} className="kp-dim kp-dim--measure" ref={(el) => engineRef.current?.setTag(`m:${k}`, el)}>
                    <span className="kp-dim__in">
                      {fmt(measure[k])} {t.cm}
                    </span>
                  </span>
                ))}
              {showDims &&
                plan.runs.flatMap((run) =>
                  run.modules.map((m, i) =>
                    m.w >= 15 ? (
                      <span key={`mw:${run.id}:${i}`} className="kp-dim kp-dim--mod" ref={(el) => engineRef.current?.setTag(`mw:${run.id}:${i}`, el)}>
                        <span className="kp-dim__in">{fmt(Math.round(m.w * 10) / 10)}</span>
                      </span>
                    ) : null,
                  ),
                )}
              {(step === 'size' || view === 'top') &&
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

          {engineState === 'ready' && (
            <div className="kp-tools" role="toolbar" aria-label={t.viewLabel}>
              <div className="kp-seg" role="radiogroup" aria-label={t.viewLabel}>
                {(['angle', 'eye', 'front', 'top'] as View[]).map((v) => (
                  <button key={v} type="button" role="radio" aria-checked={view === v} className="kp-seg__btn" onClick={() => changeView(v)}>
                    {t.view[v]}
                  </button>
                ))}
              </div>
              <button type="button" className="kp-toggle" aria-pressed={evening} onClick={() => setEvening((e) => !e)}>
                {evening ? <IconMoon /> : <IconSun />}
                <span>{evening ? t.evening : t.day}</span>
              </button>
              <button
                type="button"
                className="kp-toggle"
                aria-pressed={prices}
                onClick={() => {
                  setPrices((p) => !p)
                  setShowDims(false)
                }}
              >
                <IconTag />
                <span>{t.prices}</span>
              </button>
              <button
                type="button"
                className="kp-toggle kp-toggle--icon"
                aria-pressed={full}
                aria-label={full ? t.fullOff : t.fullOn}
                title={full ? t.fullOff : t.fullOn}
                onClick={() => setFull((f) => !f)}
              >
                {full ? <IconShrink /> : <IconExpand />}
              </button>
              <button
                type="button"
                className="kp-toggle kp-toggle--icon"
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
              </button>
              <button
                type="button"
                className="kp-toggle kp-toggle--icon"
                aria-label={t.undo}
                title={`${t.undo} (Ctrl+Z)`}
                disabled={!hist.current.past.length}
                onClick={undo}
              >
                <IconUndo />
              </button>
              <button
                type="button"
                className="kp-toggle kp-toggle--icon"
                aria-label={t.redo}
                title={`${t.redo} (Ctrl+Shift+Z)`}
                disabled={!hist.current.future.length}
                onClick={redo}
              >
                <IconUndo redo />
              </button>
              <div
                className="kp-seg kp-quality"
                role="radiogroup"
                aria-label={t.qualityLabel}
                title={qualityPx || t.qualityLabel}
                onPointerEnter={qualityTitle}
                onFocus={qualityTitle}
              >
                {(['hd', '4k'] as Quality[]).map((q) => (
                  <button key={q} type="button" role="radio" aria-checked={quality === q} className="kp-seg__btn" onClick={() => changeQuality(q)}>
                    {q === 'hd' ? 'HD' : '4K'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {engineState === 'ready' && built && measure && (
            <div className={`kp-size-card${editing ? ' kp-size-card--edit' : ''}`} role="group" aria-label={measureTitle(measure)}>
              <span className="kp-size-card__title">{measureTitle(measure)}</span>
              <span className="kp-size-card__nums">
                {fmt(measure.w)} × {fmt(measure.h)} × {fmt(measure.d)} {t.cm}
              </span>
              <span className="kp-size-card__axes">{t.sizeAxes}</span>
              <button type="button" className="kp-size-card__close" aria-label={t.close} onClick={closeMeasure}>
                <IconClose />
              </button>
              {movingCabW !== null && editing?.row === 'base' && (
                <div className="kp-cabw">
                  <span className="kp-cabw__label">{t.widthLabel}</span>
                  <button
                    type="button"
                    className="kp-size__step"
                    aria-label={`${t.less}: ${t.widthLabel}`}
                    disabled={movingCabW <= 15}
                    onClick={() => setCabWidth(-1)}
                  >
                    −
                  </button>
                  <output className="kp-counter__value">
                    {movingCabW} {t.cm}
                  </output>
                  <button
                    type="button"
                    className="kp-size__step"
                    aria-label={`${t.more}: ${t.widthLabel}`}
                    disabled={movingCabW >= 120}
                    onClick={() => setCabWidth(1)}
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
              {editing && (
                <div className="kp-fronts" role="radiogroup" aria-label={t.cabAsk}>
                  <span className="kp-fronts__ask">{t.cabAsk}</span>
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
            </div>
          )}

          {engineState === 'ready' && built && moving && movingShown && (
            <div className="kp-move" role="group" aria-label={movingName}>
              <span className="kp-move__name">
                {movingName}
                <small>{t.moveHint2}</small>
              </span>
              <button type="button" className="kp-move__btn" aria-label={t.moveLeft} onClick={() => stepMoving(-1)}>
                <IconArrow flip />
              </button>
              <button type="button" className="kp-move__btn" aria-label={t.moveRight} onClick={() => stepMoving(1)}>
                <IconArrow />
              </button>
              {canOtherWall && (
                <button type="button" className="kp-move__wall" onClick={toOtherWall}>
                  {otherWallLabel}
                </button>
              )}
              <button type="button" className="kp-move__btn kp-move__close" aria-label={t.close} onClick={() => setMoving(null)}>
                <IconClose />
              </button>
            </div>
          )}

          {engineState === 'ready' && built && hint && !moving && !measure && (
            <p className="kp-hint">
              <span className="kp-hint__long">
                {t.hint}
                <small className="kp-hint__keys">{t.keysHint}</small>
              </span>
              <span className="kp-hint__short">{t.touchHint}</span>
            </p>
          )}
        </div>

        <aside className="kp-panel" aria-label={t.title}>
          <nav className="kp-steps" aria-label={t.title}>
            {STEPS.map((s, i) => (
              <button key={s} type="button" className="kp-steps__btn" aria-current={step === s ? 'step' : undefined} onClick={() => goStep(s)}>
                <span className="kp-steps__icon">{STEP_ICON[s]}</span>
                <span className="kp-steps__label">{t.steps[s]}</span>
                <span className={`kp-steps__bar${i <= stepIndex ? ' is-done' : ''}`} />
              </button>
            ))}
          </nav>

          <div className="kp-body">
            {step === 'shape' && (
              <div className="kp-shapes" role="radiogroup" aria-label={t.steps.shape}>
                {SHAPES.map((s) => (
                  <button key={s} type="button" role="radio" aria-checked={state.shape === s} className="kp-shape" onClick={() => setShape(s)}>
                    <ShapeIcon shape={s} />
                    <span className="kp-shape__name">{t.shapes[s][0]}</span>
                    <span className="kp-shape__note">{t.shapes[s][1]}</span>
                  </button>
                ))}
              </div>
            )}

            {step === 'size' && (
              <div className="kp-sizes">
                <PlanSketch plan={plan} labels={wallLabels} className="kp-sketch" />
                <p className="kp-note">{t.measureHint}</p>
                <SizeField label={`A · ${t.walls.a}`} value={state.a} min={minA(state.shape)} max={LIMITS.a.max} t={t} onChange={(a) => update({ a })} />
                {(state.shape === 'corner' || state.shape === 'u') && (
                  <SizeField label={`B · ${t.walls.b}`} value={state.b} min={LIMITS.b.min} max={LIMITS.b.max} t={t} onChange={(b) => update({ b })} />
                )}
                {state.shape === 'u' && (
                  <SizeField label={`C · ${t.walls.c}`} value={state.c} min={LIMITS.c.min} max={LIMITS.c.max} t={t} onChange={(c) => update({ c })} />
                )}
                {state.shape === 'island' && (
                  <SizeField
                    label={t.walls.island}
                    value={state.island}
                    min={LIMITS.island.min}
                    max={Math.min(LIMITS.island.max, state.a)}
                    t={t}
                    onChange={(island) => update({ island })}
                  />
                )}
                <Dropped plan={plan} state={state} t={t} onFix={update} />

                <h2 className="kp-sub">{t.roomTitle}</h2>
                <SizeField
                  label={t.ceiling}
                  note={t.ceilingNote}
                  value={ceiling}
                  min={CEILING.min}
                  max={CEILING.max}
                  t={t}
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
                    onChange={(windowW) => update({ windowW })}
                  />
                )}
              </div>
            )}

            {step === 'style' && (
              <div className="kp-styles">
                <Switch checked={!state.lowUppers} title={t.toCeiling} note={t.toCeilingNote} onChange={(on) => update({ lowUppers: on ? undefined : true })} />
                <p className="kp-note kp-note--after">{t.styleHint}</p>
                <div role="radiogroup" aria-label={t.steps.style}>
                  {STYLE_GROUPS.map((g) => (
                    <section key={g} className="kp-style-group" aria-label={t.styleGroups[g]}>
                      <h3 className="kp-style-group__title">{t.styleGroups[g]}</h3>
                      <div className="kp-style-grid">
                        {STYLES.filter((s) => s.group === g).map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            role="radio"
                            aria-checked={state.style === s.id}
                            className="kp-style"
                            onClick={() => update({ style: s.id, tone: 0 })}
                          >
                            <span className="kp-style__img" style={{ background: styleSwatch(s) }}>
                              {thumbs[s.id] && <img src={thumbs[s.id]} alt="" />}
                            </span>
                            <span className="kp-style__name">{lang === 'ky' ? s.ky : s.ru}</span>
                            <span className="kp-style__note">{lang === 'ky' ? s.noteKy : s.noteRu}</span>
                          </button>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
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

            {step === 'finish' && (
              <div className="kp-finish">
                <p className="kp-note">{t.finishLead}</p>
                <h2 className="kp-sub kp-sub--first">{t.frontsTitle2}</h2>
                <div className="kp-seg kp-seg--wide" role="radiogroup" aria-label={t.frontsTitle2}>
                  {(['all', 'lower', 'upper'] as const).map((k) => (
                    <button key={k} type="button" role="radio" aria-checked={paintFor === k} className="kp-seg__btn" onClick={() => setPaintFor(k)}>
                      {t.finishTarget[k]}
                    </button>
                  ))}
                </div>
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
                  <button
                    type="button"
                    role="radio"
                    aria-checked={paintFor === 'upper' ? !state.upperFacade : !state.facade}
                    className="kp-color"
                    onClick={() =>
                      paintFor === 'upper'
                        ? update({ upperFacade: undefined })
                        : paintFor === 'lower'
                          ? update({ facade: undefined })
                          : update({ facade: undefined, upperFacade: undefined })
                    }
                  >
                    <span className="kp-color__chip" style={{ background: toneSwatch(tone.facade, tone.upper, tone.texture) }} />
                    <span>{t.asStyle}</span>
                  </button>
                  {FRONT_COLORS.filter((c) => c.material === frontMat).map((c) => {
                    const on = paintFor === 'upper' ? state.upperFacade === c.id : state.facade === c.id && (paintFor === 'lower' || !state.upperFacade)
                    return (
                      <button
                        key={c.id}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        className="kp-color"
                        onClick={() =>
                          paintFor === 'upper'
                            ? update({ upperFacade: c.id })
                            : paintFor === 'lower'
                              ? update({ facade: c.id, upperFacade: state.upperFacade ?? 'style' })
                              : update({ facade: c.id, upperFacade: undefined })
                        }
                      >
                        <span className={`kp-color__chip kp-color__chip--${c.material}`} style={{ background: colorSwatch(c.color, c.texture) }} />
                        <span>{lang === 'ky' ? c.ky : c.ru}</span>
                      </button>
                    )
                  })}
                </div>

                <h2 className="kp-sub">{t.handlesTitle}</h2>
                <Switch
                  checked={handleless}
                  title={t.handleless}
                  note={t.handlelessNote}
                  onChange={(on) => update({ handleless: on === (style.handle === 'gola') ? undefined : on })}
                />
                {!handleless && (
                  <>
                    <div className="kp-handles" role="radiogroup" aria-label={t.handlesTitle}>
                      {HANDLES.map((h) => (
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
                    <div className="kp-metals" role="radiogroup" aria-label={t.handleMetal}>
                      <span className="kp-metals__label">{t.handleMetal}</span>
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

                <h2 className="kp-sub">{t.topTitle}</h2>
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
                <div className="kp-colors" role="radiogroup" aria-label={t.topTitle}>
                  <button type="button" role="radio" aria-checked={!state.top} className="kp-color" onClick={() => update({ top: undefined })}>
                    <span className="kp-color__chip" style={{ background: style.splashColor }} />
                    <span>{t.asStyle}</span>
                  </button>
                  {TOPS.filter((c) => c.material === topMat).map((c) => (
                    <button key={c.id} type="button" role="radio" aria-checked={state.top === c.id} className="kp-color" onClick={() => update({ top: c.id })}>
                      <span className="kp-color__chip" style={{ background: topSwatch(c.look) }} />
                      <span>
                        {lang === 'ky' ? c.ky : c.ru}
                        <small>{c.cm * 10} мм</small>
                      </span>
                    </button>
                  ))}
                </div>

                <h2 className="kp-sub">{t.splashTitle}</h2>
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
                <div className="kp-colors" role="radiogroup" aria-label={t.splashTitle}>
                  <button type="button" role="radio" aria-checked={!state.splash} className="kp-color" onClick={() => update({ splash: undefined })}>
                    <span className="kp-color__chip" style={{ background: style.splashColor }} />
                    <span>{t.asStyle}</span>
                  </button>
                  {SPLASHES.filter((c) => c.group === splashGroup).map((c) => (
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

                <h2 className="kp-sub">{t.floorTitle}</h2>
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
                <h2 className="kp-sub">{t.wallTitle}</h2>
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
                {(state.facade || state.upperFacade || state.top || state.splash || state.handle || state.handleMetal || state.handleless !== undefined) && (
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm kp-reset"
                    onClick={() =>
                      update({
                        facade: undefined,
                        upperFacade: undefined,
                        top: undefined,
                        splash: undefined,
                        handle: undefined,
                        handleMetal: undefined,
                        handleless: undefined,
                      })
                    }
                  >
                    {t.resetFinish}
                  </button>
                )}
                {frontCount > 0 && (
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm kp-reset"
                    onClick={() => update({ fronts: undefined, cabinets: undefined, arrangement: undefined })}
                  >
                    {t.resetFronts(frontCount)}
                  </button>
                )}
              </div>
            )}

            {step === 'tech' && (
              <div className="kp-extra">
                <h2 className="kp-sub kp-sub--first">{t.furnitureTitle}</h2>
                {items.oven !== null && (
                  <div className="kp-oven">
                    <span className="kp-switch__text">
                      {t.ovenTitle}
                      <small>{mwBuiltIn && ovenPlace === 'tall' ? t.tallOvenLocked : t.ovenNote[ovenPlace]}</small>
                    </span>
                    <div className="kp-seg kp-seg--wide" role="radiogroup" aria-label={t.ovenTitle}>
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
                {items.fridge && (
                  <Switch
                    className="kp-gap"
                    checked={!state.fridgeOpen}
                    title={t.fridgeNiche}
                    note={t.fridgeNicheNote}
                    onChange={(on) => update({ fridgeOpen: on ? undefined : true })}
                  />
                )}
                <h2 className="kp-sub">{t.steps.tech}</h2>
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
                    pickedNone={state.picks[slot] === null || (chosen[slot] === null && !CORE.includes(slot))}
                    dropped={dropped.has(slot)}
                    open={open === slot}
                    style={style}
                    t={t}
                    onToggle={() => openSlot(slot)}
                    onPick={(id) => setPick(slot, id)}
                  />
                ))}
              </ul>
            )}

            {step !== 'tech' && (
              <button type="button" className="btn btn--outline kp-next" onClick={() => goStep(STEPS[stepIndex + 1])}>
                {t.next}: {t.steps[STEPS[stepIndex + 1]]}
                <IconArrow />
              </button>
            )}
          </div>

          <div className="kp-sum">
            <div className="kp-sum__row">
              <span className="kp-sum__label">
                {t.total} · {t.pieces(inProject.length)}
              </span>
              <span className="kp-sum__price">{formatSom(total)}</span>
            </div>
            {cartResult ? (
              <p className="kp-sum__done" role="status">
                {cartResult.ok > 0 ? t.added(cartResult.ok) : t.addFailed}{' '}
                {cartResult.ok > 0 && (
                  <Link href={`/${lang}/cart`} className="kp-sum__link">
                    {t.toCart}
                  </Link>
                )}
              </p>
            ) : (
              <button type="button" className="btn btn--primary kp-sum__cta" disabled={inProject.length === 0} onClick={addAll}>
                {t.addAll}
              </button>
            )}
            <p className="kp-sum__honest">{t.honest}</p>
          </div>
        </aside>
      </div>

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

      <section className="kp-spec" aria-labelledby="kp-spec-title">
        <style>{DRAWING_CSS}</style>
        <div className="kp-spec__head">
          <div>
            <h2 id="kp-spec-title" className="kp-maker__title">
              {t.specTitle}
            </h2>
            <p className="kp-maker__lead">{t.specLead}</p>
          </div>
          <div className="kp-spec__actions">
            <button type="button" className="btn btn--primary" onClick={openSheet} disabled={!drawing || sheetBusy} aria-busy={sheetBusy}>
              <IconFile />
              {sheetBusy ? t.specPreparing : t.specPdf}
            </button>
            <a className="btn btn--outline" href={sendMaster} target="_blank" rel="noopener noreferrer">
              {t.specSend}
            </a>
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
                  <div className="kp-wall__svg" dangerouslySetInnerHTML={{ __html: w.svg }} />
                </figure>
              ))}
            </div>
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
      </section>

      <section className="kp-maker" aria-labelledby="kp-maker-title">
        <div className="kp-maker__text">
          <h2 id="kp-maker-title" className="kp-maker__title kp-maker__title--small">
            {t.makerTitle}
          </h2>
          <pre className="kp-maker__list">{makerText}</pre>
          <div className="kp-maker__actions">
            <button type="button" className="btn btn--outline btn--sm" onClick={copyList}>
              {t.copy}
            </button>
            {engineState === 'ready' && (
              <button type="button" className="btn btn--outline btn--sm" onClick={saveImage} disabled={saving} aria-busy={saving}>
                {saving ? t.saving : t.saveImage}
              </button>
            )}
            <button type="button" className="btn btn--outline btn--sm" onClick={share}>
              {t.share}
            </button>
            <a className="btn btn--ghost btn--sm" href={whatsappHref(phones[0], t.askText(shareUrl))} target="_blank" rel="noopener noreferrer">
              {t.ask}
            </a>
          </div>
        </div>
        <PlanSketch plan={plan} labels={wallLabels} showWidths className="kp-maker__sketch" />
      </section>

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
        {variants.length > 0 && (
          <ul className="kp-variants__list">
            {variants.map((v) => (
              <li key={v.id} className="kp-variant">
                {v.img ? <img src={v.img} alt="" className="kp-variant__img" /> : <span className="kp-variant__img" />}
                <span className="kp-variant__name">{v.name}</span>
                <span className="kp-variant__label">{v.label}</span>
                <span className="kp-variant__actions">
                  <button type="button" className="btn btn--primary btn--sm" onClick={() => openVariant(v)}>
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

      {toast && (
        <p className="kp-toast" role="status">
          {toast}
        </p>
      )}
    </div>
  )
}

/* ───────── части панели ───────── */

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
  onChange,
}: {
  label: string
  note?: string
  value: number
  min: number
  max: number
  t: KitchenTexts
  onChange: (v: number) => void
}) {
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v / 5) * 5))
  const [draft, setDraft] = useState(String(value))
  useEffect(() => setDraft(String(value)), [value])
  const id = `kp-size-${label.replace(/\W+/g, '-')}`
  return (
    <div className="kp-size">
      <label className="kp-size__label" htmlFor={id}>
        {label}
        {note && <small>{note}</small>}
      </label>
      <div className="kp-size__row">
        <button type="button" className="kp-size__step" aria-label={`${t.less} ${label}`} onClick={() => onChange(clamp(value - 5))} disabled={value <= min}>
          −
        </button>
        <span className="kp-size__field">
          <input
            id={id}
            inputMode="numeric"
            value={draft}
            onChange={(e) => setDraft(e.target.value.replace(/\D/g, '').slice(0, 3))}
            onBlur={() => onChange(clamp(Number(draft) || value))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onChange(clamp(Number(draft) || value))
            }}
          />
          <span>{t.cm}</span>
        </span>
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
    </div>
  )
}

function Dropped({ plan, state, t, onFix }: { plan: Plan; state: KitchenState; t: KitchenTexts; onFix: (p: Partial<KitchenState>) => void }) {
  if (plan.dropped.length === 0) return null
  const names = plan.dropped
    .map((d) =>
      d.slot ? t.slots[d.slot] : isCabinet(d.item) ? t.cabName(Math.round(state.cabinets?.[d.item]?.w ?? 60)) : d.item === 'tall' ? t.tallName : t.pantryName,
    )
    .filter((n, i, all) => all.indexOf(n) === i)
    .join(', ')
  const need = Math.ceil(Math.max(...plan.dropped.map((d) => d.need)) / 5) * 5
  // удлиняем ту стену, где не поместилось
  const wall = plan.dropped[0].wall
  const key = wall === 'B' ? 'b' : wall === 'C' ? 'c' : wall === 'I' ? 'island' : 'a'
  const next = state[key] + need
  const fits = next <= LIMITS[key].max
  return (
    <div className="kp-warn" role="status">
      <p>{t.dropped(names, need)}</p>
      {fits && (
        <button type="button" className="btn btn--outline btn--sm" onClick={() => onFix({ [key]: next })}>
          {t.droppedFix(next)}
        </button>
      )}
    </div>
  )
}

function SlotRow(props: {
  slot: SlotKind
  list: KitchenAppliance[]
  current: KitchenAppliance | null | undefined
  pickedNone: boolean
  dropped: boolean
  open: boolean
  style: KitchenStyle
  t: KitchenTexts
  onToggle: () => void
  onPick: (id: string | null) => void
}) {
  const { slot, list, current, pickedNone, dropped, open, style, t } = props
  const size = (a: KitchenAppliance) =>
    (a.slot === 'fridge' || a.slot === 'washer' ? `${fmt(a.w)}×${fmt(a.h)} ${t.cm}` : `${t.width} ${fmt(a.w)} ${t.cm}`) +
    (a.sizeKnown ? '' : ` · ${t.typicalSize}`)
  const none = pickedNone || current === null
  const optional = OPTIONAL.includes(slot)
  const listId = `kp-opts-${slot}`
  return (
    <li className={`kp-slot${open ? ' is-open' : ''}${dropped ? ' is-dropped' : ''}`}>
      <button type="button" className="kp-slot__head" aria-expanded={open} aria-controls={listId} onClick={props.onToggle}>
        <span className="kp-slot__thumb">{current?.image && !none ? <img src={current.image} alt="" loading="lazy" /> : <SlotIcon slot={slot} />}</span>
        <span className="kp-slot__text">
          <span className="kp-slot__kind">{t.slots[slot]}</span>
          <span className="kp-slot__name">{none ? t.none : current ? current.name : t.soon}</span>
          {dropped && <span className="kp-slot__warn">{t.notFit}</span>}
        </span>
        <span className="kp-slot__price">{current && !none ? formatSom(current.price) : ''}</span>
      </button>
      {open && (
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
          {list.length === 0 && <p className="kp-note">{t.soon}</p>}
          {list.map((a) => (
            <label key={a.id} className="kp-opt">
              <input type="radio" name={listId} checked={!none && current?.id === a.id} onChange={() => props.onPick(a.id)} />
              <span className="kp-opt__thumb">{a.image ? <img src={a.image} alt="" loading="lazy" /> : <SlotIcon slot={slot} />}</span>
              <span className="kp-opt__text">
                <span className="kp-opt__name">{a.name}</span>
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
          ))}
        </div>
      )}
    </li>
  )
}

const fmt = (v: number) => (Number.isInteger(v) ? String(v) : (Math.round(v * 10) / 10).toFixed(1).replace('.', ','))

/** Текст для мебельщика: по стенам, слева направо, низ и верх. */
function makerList(plan: Plan, items: Items, t: KitchenTexts): string {
  const lines: string[] = []
  for (const run of plan.runs) {
    // ряд B в плане идёт от зрителя к углу — мастеру удобнее от угла
    const order = run.id === 'B' ? [...run.modules].reverse() : run.modules
    const lower = order.map((m) => {
      let name = t.modules[m.kind]
      if (m.kind === 'hob' && m.oven && items.oven !== null) name = t.ovenUnder
      if (m.kind === 'fridge' && items.fridge) name = `${name} (${items.fridge.brand || items.fridge.name})`
      return `${name} ${Math.round(m.w)}`
    })
    lines.push(t.wall(run.id, Math.round(run.length)))
    lines.push(`  ${t.lower}: ${lower.join(' · ')}`)
    if (run.uppers.length) {
      const uppersOrder = run.id === 'B' ? [...run.uppers].reverse() : run.uppers
      const upper = uppersOrder.filter((u) => u.kind !== 'none').map((u) => `${t.uppers[u.kind]} ${Math.round(u.w)}`)
      if (upper.length) lines.push(`  ${t.upper}: ${upper.join(' · ')}`)
    }
    lines.push('')
  }
  return lines.join('\n').trim()
}

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
    drawers2: <path d="M3 14h26M13 8.5h6M13 19.5h6" {...s} />,
    drawers3: <path d="M3 9h26M3 17h26M13 6h6M13 13h6M13 21h6" {...s} />,
    drawers4: <path d="M3 8.5h26M3 14h26M3 19.5h26M13 5.8h6M13 11.2h6M13 16.8h6M13 22.3h6" {...s} />,
    mix: <path d="M3 9h26M16 9v16M13 6h6M13.5 17h.01M18.5 17h.01" {...s} />,
    open: <path d="M3 11h26M3 18h26" {...s} />,
    glass: <path d="M16 3v22M6 6h7v16H6zM19 6h7v16h-7z" {...s} />,
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
  shape: (
    <svg {...iconProps}>
      <path d="M4 20V4h16M4 9h11" {...stroke} />
    </svg>
  ),
  size: (
    <svg {...iconProps}>
      <path d="M3 15l12-12 6 6-12 12zM7 11l2 2M10 8l2 2M13 5l2 2" {...stroke} />
    </svg>
  ),
  style: (
    <svg {...iconProps}>
      <path d="M4 4h7v16H4zM13 4h7v7h-7zM13 13h7v7h-7z" {...stroke} />
    </svg>
  ),
  finish: (
    <svg {...iconProps}>
      <path
        d="M12 3a9 9 0 1 0 0 18c1.1 0 1.6-.9 1.2-1.8-.5-1.1.2-2.2 1.4-2.2H17a4 4 0 0 0 4-4c0-5-4-10-9-10zM7.5 11h.01M10 7h.01M14.5 7h.01M17 11h.01"
        {...stroke}
      />
    </svg>
  ),
  tech: (
    <svg {...iconProps}>
      <path d="M5 3h14v18H5zM5 8h14M9 5.5h.01M12 14m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0" {...stroke} />
    </svg>
  ),
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

function IconArrow({ flip = false }: { flip?: boolean }) {
  return (
    <svg {...iconProps} style={flip ? { transform: 'scaleX(-1)' } : undefined}>
      <path d="M5 12h14M13 6l6 6-6 6" {...stroke} />
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
