import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { itemPositions } from '@/lib/kitchen/layout'
import type { ItemKey, SlotKind, WallId } from '@/lib/kitchen/types'
import type { SpecData } from '@/lib/kitchen/spec'
import type { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { sharpenPass } from './sharpen'
import { buildKitchen, CEILING_LAYER, WALL_H, WINDOW, type BuildInput, type Built, type CabInfo, type Dims } from './build'
import type { PhotoTracer } from './photoreal'
import { setBudget } from './textures'

/**
 * Фото трассировкой лучей: build — собираем сцену, trace — копим кадр
 * (progress 0…1), done — готово. big — большое фото для сохранения.
 */
export type PhotoState = { phase: 'build' | 'trace' | 'done'; progress: number; big: boolean }

type PhotoRun = {
  onState: (s: PhotoState | null) => void
  /** сколько проходов копить */
  target: number
  building: boolean
  /** камера сдвинулась — начать копить заново, когда остановится */
  dirty: boolean
  /** готовый кадр уже на холсте */
  shown: boolean
  /** кусков кадра за один кадр экрана: подстраивается под видеокарту */
  perFrame: number
  last: number
  started: number
  pct: number
  big: { resolve: (b: Blob | null) => void } | null
}

/** Дольше этого фото на экране не копится (если проходов уже хватает на чистую картинку). */
const PHOTO_MAX_MS = 30000

/**
 * 3D-сцена конструктора. Рисует только когда что-то меняется: камера,
 * анимация, новая кухня. На телефоне это бережёт батарею.
 */

/** eye — «как в жизни»: с высоты глаз человека, стоящего в комнате */
export type View = 'angle' | 'front' | 'top' | 'eye'

/**
 * Чёткость 3D. HD — бережёт батарею и слабые видеокарты. 4K — в покое кадр
 * рисуется до 3840 точек в ширину (и в движении не ниже полуторной чёткости),
 * картинки материалов — самые подробные.
 */
export type Quality = 'hd' | '4k'

export type Pick = { slot: SlotKind | null; item: ItemKey | null; dims: Dims | null; cab: CabInfo | null }

/** Что тащат: предмет (техника, мойка, свой шкаф) или обычный нижний шкаф. */
export type DragTarget = { item: ItemKey } | { cab: CabInfo; w: number }

/**
 * Куда предмет встанет на самом деле, если отпустить его здесь: середина и
 * ширина (см от угла), свободная столешница по бокам и помещается ли всё.
 */
export type DragPreview = { center: number; w: number; gaps: { center: number; w: number }[]; fits: boolean }

export type EngineEvents = {
  /** нажали на технику или мойку (или мимо — тогда всё null) */
  onPick: (pick: Pick) => void
  /** предмет перетащили: стена и точка вдоль неё, см от угла */
  onMove: (target: DragTarget, wall: WallId, pos: number) => void
  /** предмет тащат: где он встанет (null — отпустили или увели со стены) */
  onPreview?: (q: { what: DragTarget; wall: WallId; pos: number } | null) => DragPreview | null
  onError: () => void
}

type OpenInfo = { kind: 'swing' | 'lift' | 'fold' | 'slide'; dir: number }

/** Сколько открывается дверца по нажатию. */
const OPEN_AMOUNT: Record<OpenInfo['kind'], number> = { swing: 1.5, lift: 1.15, fold: 1.42, slide: 0.36 }
/** Сколько держать палец на предмете, чтобы взять его. */
const HOLD_MS = 380

type Tween = { start: number; duration: number; step: (t: number) => void; done?: () => void }

// Днём главный свет — из окна; общий свет спереди слабее, чтобы остались
// объём и полутени, как на фотографии интерьера. room — яркость снимка
// самой комнаты (отражения и отражённый свет), sky — свет неба в окне.
const DAY = { hemi: 0.3, key: 1.45, fill: 0.6, env: 0.5, room: 0.85, window: 3.2, sky: 3.2, bloom: 0.08, threshold: 0.95 }
const NIGHT = { hemi: 0.05, key: 0, fill: 0.06, env: 0.12, room: 0.55, window: 0, sky: 0, bloom: 0.18, threshold: 0.7 }

const easeOut = (t: number) => 1 - Math.pow(1 - t, 4)
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

export class KitchenEngine {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(36, 1, 0.05, 60)
  private controls: OrbitControls
  private hemi = new THREE.HemisphereLight('#fbf8f2', '#a89c8b', DAY.hemi)
  /** основной свет сверху-спереди: тени от верхних шкафов на фартуке */
  private sun = new THREE.DirectionalLight('#fff4e6', DAY.key)
  /** мягкий свет со стороны окна, без теней */
  private fill = new THREE.DirectionalLight('#eaf2ff', DAY.fill)
  /** солнце в окне: светлое пятно на столешнице и полу, тень от рамы */
  private windowSun = new THREE.DirectionalLight('#ffeccc', 0)
  /** лёгкое свечение ярких мест: солнечное пятно, подсветка, лампы */
  private bloom: UnrealBloomPass | null = null
  /** мягкий свет неба из окна — светлее у окна, темнее в глубине */
  private skyLight: THREE.RectAreaLight | null = null
  /**
   * Снимок самой комнаты во все стороны: в глянце, камне и стали отражаются
   * её окно, стены и шкафы, а отражённый свет несёт цвет пола и дерева.
   */
  private studioEnv: THREE.Texture
  private roomEnv: THREE.Texture | null = null
  private probe: { rt: THREE.WebGLCubeRenderTarget; cam: THREE.CubeCamera } | null = null
  private pmrem: THREE.PMREMGenerator
  private probeDirty = false
  /** на компьютере — мягкие тени в углах и стыках (ambient occlusion) */
  private composer: EffectComposer | null = null
  private built: Built | null = null
  private input: BuildInput | null = null
  private tweens: Tween[] = []
  private raf = 0
  private evening = false
  private selected: SlotKind | null = null
  private outline: THREE.LineSegments | null = null
  private tags = new Map<string, HTMLElement>()
  private tagPoints = new Map<string, THREE.Vector3>()
  private resizeObserver: ResizeObserver
  private reduced: boolean
  private mobile: boolean
  private view: View = 'angle'
  private disposed = false
  private down: { x: number; y: number; t: number } | null = null
  private hold: { timer: number } | null = null
  /**
   * Нажали на то, что можно тащить сразу, без удержания: мышью — что угодно,
   * пальцем — уже выбранное. Тащить начинаем, когда палец сдвинется.
   */
  private press: { what: DragTarget; x: number; y: number; id: number } | null = null
  /** выбранный предмет или шкаф (его пальцем можно тащить сразу) */
  private grab: string | null = null
  private drag: { what: DragTarget; w: number; target: { wall: WallId; pos: number } | null } | null = null
  private marker: THREE.Group | null = null
  /** линии размеров вокруг выбранного предмета */
  private measureLines: THREE.Group | null = null
  /** чёткость: в движении — обычная, в покое — с запасом (как у фотоаппарата) */
  private baseRatio = 1
  private refined = false
  private refineTimer = 0
  private hoverFrame = 0
  /** детальность картинок в сборке кухни */
  private detail = 2
  /**
   * На компьютере холст — ровно в точках экрана, а кадр рисуется крупнее
   * (renderRatio) и честно уменьшается последним проходом (см. sharpen.ts).
   */
  private canvasRatio = 1
  private renderRatio = 1
  private finalPass: ShaderPass | null = null
  private quality: Quality = 'hd'
  private raycaster = new THREE.Raycaster()
  /** трассировщик лучей: создаётся по первой кнопке «Фото» и живёт дальше */
  private pt: PhotoTracer | null = null
  private photo: PhotoRun | null = null
  /** встроенная или мобильная видеокарта: фото заранее не готовим */
  private weakGpu = false

  constructor(
    private host: HTMLElement,
    private events: EngineEvents,
  ) {
    this.mobile = window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 768
    this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    const r = this.renderer
    // 4K — сразу на хорошей видеокарте; на телефоне и встроенной графике — HD.
    // Выбор покупателя помним.
    const weak = this.mobile || /intel|uhd|iris|mali|adreno|powervr|swiftshader|llvmpipe|basic render/i.test(this.gpuName())
    this.weakGpu = weak
    let saved: string | null = null
    try {
      saved = window.localStorage.getItem('kp-quality')
    } catch {
      saved = null
    }
    this.quality = saved === 'hd' || saved === '4k' ? saved : weak ? 'hd' : '4k'
    this.applyQuality()
    this.canvasRatio = Math.min(window.devicePixelRatio || 1, 2)
    r.setPixelRatio(this.mobile ? this.baseRatio : this.canvasRatio)
    r.outputColorSpace = THREE.SRGBColorSpace
    r.toneMapping = THREE.NeutralToneMapping
    r.toneMappingExposure = 1
    r.shadowMap.enabled = true
    r.shadowMap.type = THREE.PCFShadowMap
    r.domElement.className = 'kp-canvas'
    r.domElement.setAttribute('aria-hidden', 'true')
    host.prepend(r.domElement)
    r.domElement.addEventListener('webglcontextlost', (e) => {
      e.preventDefault()
      this.events.onError()
    })

    this.pmrem = new THREE.PMREMGenerator(r)
    this.studioEnv = this.pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    this.scene.environment = this.studioEnv
    this.scene.environmentIntensity = DAY.env
    this.scene.background = new THREE.Color('#eef0f3')

    this.sun.castShadow = true
    const size = this.mobile ? 2048 : 4096
    this.sun.shadow.mapSize.set(size, size)
    this.sun.shadow.bias = -0.0003
    this.sun.shadow.normalBias = 0.015
    this.sun.shadow.radius = 4
    this.scene.add(this.hemi, this.sun, this.sun.target, this.fill, this.fill.target)
    // Потолок виден только снизу (вид «как в жизни») и бросает тень лишь от
    // солнца в окне — иначе основной свет сверху не прошёл бы в комнату.
    this.camera.layers.enable(CEILING_LAYER)
    if (!this.mobile) {
      this.windowSun.castShadow = true
      this.windowSun.shadow.mapSize.set(2048, 2048)
      this.windowSun.shadow.bias = -0.0004
      this.windowSun.shadow.normalBias = 0.02
      this.windowSun.shadow.radius = 3
      this.windowSun.shadow.camera.layers.enable(CEILING_LAYER)
      this.scene.add(this.windowSun, this.windowSun.target)
      RectAreaLightUniformsLib.init()
      this.skyLight = new THREE.RectAreaLight('#dfe8f7', 0, 1, 1)
      this.scene.add(this.skyLight)
    }

    if (!this.mobile) {
      const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 })
      const composer = new EffectComposer(r, target)
      composer.addPass(new RenderPass(this.scene, this.camera))
      const ao = new GTAOPass(this.scene, this.camera, 1, 1)
      ao.updateGtaoMaterial({ radius: 0.28, distanceExponent: 1.2, thickness: 1.0, scale: 1.1, samples: 16, distanceFallOff: 1 })
      // сильнее сглаживаем шум затенения — без «пунктира» по краям шкафов
      ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 })
      ao.blendIntensity = 0.9
      composer.addPass(ao)
      const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), DAY.bloom, 0.45, DAY.threshold)
      // днём свечение выключено — оно смягчает кадр; вечером светятся лампы
      bloom.enabled = false
      composer.addPass(bloom)
      this.bloom = bloom
      composer.addPass(new OutputPass())
      // последним — честное уменьшение до точек экрана и тонкая резкость
      const finalPass = sharpenPass(0.35)
      composer.addPass(finalPass)
      this.finalPass = finalPass
      this.composer = composer
    }

    this.controls = new OrbitControls(this.camera, r.domElement)
    const c = this.controls
    c.enableDamping = true
    c.dampingFactor = 0.08
    c.enablePan = false
    c.minPolarAngle = 0.02
    c.maxPolarAngle = 1.42
    c.minAzimuthAngle = -1.25
    c.maxAzimuthAngle = 1.25
    c.rotateSpeed = 0.7
    c.zoomSpeed = 0.8
    // Левой кнопкой мыши шкафы переставляют, поэтому вращать можно и правой —
    // она работает всегда, даже если под мышью шкаф.
    c.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE }
    c.addEventListener('change', () => this.invalidate())
    c.addEventListener('start', () => {
      this.tweens = this.tweens.filter((t) => !(t as Tween & { camera?: boolean }).camera)
    })

    const el = r.domElement
    // Раньше OrbitControls: нажали на шкаф — кухня не должна начать вращаться.
    el.addEventListener('pointerdown', (e) => this.onDown(e), { capture: true })
    el.addEventListener('pointerup', (e) => this.onUp(e))
    el.addEventListener('pointermove', (e) => this.onMove(e))
    el.addEventListener('pointercancel', () => {
      this.press = null
      this.controls.enabled = true
      this.stopDrag(false)
    })
    // долгое нажатие на телефоне не должно открывать меню браузера
    el.addEventListener('contextmenu', (e) => e.preventDefault())

    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(host)
    this.resize()
  }

  /* ───────── кухня ───────── */

  /** Пересобрать кухню. motion: как показать изменение. */
  setKitchen(input: BuildInput, motion: { kind: 'style' } | { kind: 'swap'; slot: SlotKind } | null, reframe: boolean) {
    // Кухня изменилась — фото старой кухни не годится: рисуем фото новой.
    // (Перестройка бывает и сама — пришло фото товара, — фото не выключаем.)
    const photoState = this.photo?.onState ?? null
    this.stopPhoto()
    const first = !this.built
    const old = this.built
    this.input = input
    this.built = buildKitchen({ ...input, evening: this.evening, detail: this.detail })
    this.scene.add(this.built.root)
    if (old) {
      this.scene.remove(old.root)
      old.dispose()
    }
    this.showMeasure(null)
    this.applyEvening()
    this.applyOverhead()
    this.placeSun()
    this.updateTagPoints()
    // снимок комнаты — когда кухня встанет и анимация закончится
    this.probeDirty = true
    if (first || reframe) this.frame(first ? 'instant' : 'glide')
    if (this.selected) this.setSelected(this.selected)
    if (motion && !this.reduced) this.animate(motion)
    this.invalidate()
    if (photoState) void this.startPhoto(photoState)
  }

  private animate(motion: { kind: 'style' } | { kind: 'swap'; slot: SlotKind }) {
    const b = this.built
    if (!b) return
    const now = performance.now()
    if (motion.kind === 'swap') {
      const obj = b.objects[motion.slot]
      if (!obj) return
      const y = obj.position.y
      obj.position.y = y + 0.35
      this.tweens.push({ start: now, duration: 650, step: (t) => (obj.position.y = y + 0.35 * (1 - easeOut(t))) })
      return
    }
    const maxDelay = Math.max(0.001, ...b.anims.map((a) => a.delay))
    const spread = Math.min(1, 0.7 / maxDelay)
    for (const a of b.anims) {
      const o = a.obj
      const delay = a.delay * spread * 1000
      const set = (k: number) => {
        if (a.kind === 'swing') o.rotation.y = a.dir * 1.2 * k
        else if (a.kind === 'lift') o.rotation.x = a.dir * 0.9 * k
        else if (a.kind === 'slide') o.position.z = baseZ + 0.22 * k
        else if (a.kind === 'fold') o.rotation.x = a.dir * 1.2 * k
      }
      const baseZ = o.position.z
      set(1)
      this.tweens.push({ start: now + delay, duration: 620, step: (t) => set(1 - easeOut(t)) })
    }
  }

  setEvening(on: boolean) {
    if (this.evening === on) return
    this.evening = on
    // Материалы окна и подсветки зависят от времени суток — пересобираем.
    if (this.input) this.setKitchen(this.input, null, false)
    else this.applyEvening()
  }

  private applyEvening() {
    const e = this.evening
    const k = e ? NIGHT : DAY
    this.hemi.intensity = k.hemi
    this.sun.intensity = k.key
    this.fill.intensity = k.fill
    const win = Boolean(this.input?.plan.window)
    this.windowSun.intensity = win ? k.window : 0
    if (this.skyLight) this.skyLight.intensity = win ? k.sky : 0
    this.scene.environmentIntensity = this.scene.environment === this.roomEnv && this.roomEnv ? k.room : k.env
    if (this.bloom) {
      this.bloom.enabled = e
      this.bloom.strength = k.bloom
      this.bloom.threshold = k.threshold
    }
    ;(this.scene.background as THREE.Color).set(e ? '#2b3240' : '#eef0f3')
    for (const l of this.built?.eveningLights ?? []) {
      const light = l as THREE.Light
      light.intensity = e ? (light.userData.on as number) : 0
    }
  }

  /**
   * Основной свет — сверху и спереди, как от потолка и окна за спиной:
   * верхние шкафы бросают тень на фартук, холодильник — на стену.
   * Второй, мягкий — со стороны окна.
   */
  private placeSun() {
    const plan = this.input?.plan
    if (!plan) return
    const W = plan.room.w / 100
    const D = plan.room.d / 100
    this.sun.position.set(W * 0.35 - 1.2, 5.2, D + 2.6)
    this.sun.target.position.set(W * 0.5, 0.4, 0.2)
    const cam = this.sun.shadow.camera
    const span = Math.max(W, D) * 0.75 + 1
    cam.left = -span
    cam.right = span
    cam.top = span
    cam.bottom = -span
    cam.near = 0.5
    cam.far = 18
    cam.updateProjectionMatrix()
    const win = plan.window
    const at = (win?.at ?? plan.room.w * 0.3) / 100
    if (win?.wall === 'left') {
      this.fill.position.set(-3, 3.2, at)
      this.fill.target.position.set(W * 0.6, 0.8, at - 0.2)
    } else {
      this.fill.position.set(at, 3.4, -3)
      this.fill.target.position.set(at, 0.8, 1.5)
    }
    // Солнце снаружи, чуть сбоку и сверху: луч проходит в окно и ложится
    // пятном на столешницу и пол; над стеной он уходит за пределы комнаты.
    const ws = this.windowSun
    // высокое солнце: пятно ложится на столешницу и пол у шкафов, а не посреди комнаты
    if (win?.wall === 'left') {
      ws.position.set(-3, 5.2, at - 1.1)
      ws.target.position.set(1.4, 0, at + 0.2)
    } else {
      ws.position.set(at - 1.2, 5.2, -3)
      ws.target.position.set(at + 0.35, 0, 1.4)
    }
    // свет неба — прямоугольник во всё окно, светит в комнату
    const sky = this.skyLight
    if (sky && win) {
      const sill = (win.wall === 'left' ? 90 : 100) / 100
      const top = Math.min(2.3, (this.built?.wallH ?? WALL_H) - 0.25)
      sky.width = win.w / 100 - 0.12
      sky.height = top - sill - 0.12
      const mid = (sill + top) / 2
      if (win.wall === 'left') {
        sky.position.set(0.03, mid, at)
        sky.lookAt(2, mid - 0.4, at)
      } else {
        sky.position.set(at, mid, 0.03)
        sky.lookAt(at, mid - 0.4, 2)
      }
    }
    const wc = ws.shadow.camera
    wc.left = -span
    wc.right = span
    wc.top = span
    wc.bottom = -span
    wc.near = 0.5
    wc.far = 14
    wc.updateProjectionMatrix()
  }

  /* ───────── камера ───────── */

  /** Камера смотрит на саму кухню (а не на пустой пол) и держит её целиком в кадре. */
  private framing(view: View) {
    const plan = this.input!.plan
    const W = plan.room.w / 100
    if (view === 'eye') return this.eyeFraming()
    const side = plan.runs.filter((r) => r.id === 'B' || r.id === 'C').map((r) => r.length / 100)
    const deep = plan.island ? (plan.island.z + 40) / 100 : side.length ? Math.max(...side) : 0.9
    const target = new THREE.Vector3(W / 2, view === 'top' ? 0.2 : 1.1, deep / 2)
    const radius = 0.5 * Math.hypot(W, deep, view === 'top' ? 0 : 2.3)
    const vfov = (this.camera.fov * Math.PI) / 180
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * this.camera.aspect)
    // Сверху — издалека: так меньше перспективы и план похож на чертёж.
    const fit = (radius / Math.sin(Math.min(vfov, hfov) / 2)) * (view === 'top' ? 1.3 : 1)
    const azimuth = view === 'angle' ? (plan.shape === 'u' ? 0.3 : plan.shape === 'straight' ? 0.42 : 0.55) : 0
    const polar = view === 'top' ? 0.02 : view === 'front' ? 1.3 : 1.05
    const pos = new THREE.Vector3().setFromSphericalCoords(fit, polar, azimuth).add(target)
    return { target, pos, dist: fit }
  }

  /**
   * «Как в жизни»: человек стоит у входа в кухню, глаза на высоте 1,6 м,
   * смотрит на рабочую стену. Объектив пошире — как у камеры телефона.
   */
  private eyeFraming() {
    const plan = this.input!.plan
    const W = plan.room.w / 100
    const D = plan.room.d / 100
    const shape = plan.shape
    const target = new THREE.Vector3(W * (shape === 'corner' ? 0.42 : 0.5), 1.18, shape === 'u' ? D * 0.35 : 0.5)
    // стоим у открытого края комнаты, чтобы в кадр вошла вся рабочая стена
    const pos = new THREE.Vector3(
      shape === 'u' ? W * 0.52 : shape === 'corner' ? W * 0.84 : W * 0.66,
      1.62,
      Math.max(2.6, D + 0.45),
    )
    return { target, pos, dist: pos.distanceTo(target) }
  }

  private frame(mode: 'instant' | 'glide', view: View = this.view) {
    if (!this.input) return
    const { target, pos, dist } = this.framing(view)
    // шире объектив «как в жизни», у обзорных видов — поуже, без искажений
    const fov = view === 'eye' ? 54 : 36
    if (this.camera.fov !== fov) {
      this.camera.fov = fov
      this.camera.updateProjectionMatrix()
    }
    this.controls.minDistance = dist * 0.35
    this.controls.maxDistance = dist * 1.6
    if (mode === 'instant' || this.reduced) {
      this.camera.position.copy(pos)
      this.controls.target.copy(target)
      this.controls.update()
      this.invalidate()
      return
    }
    this.glideTo(pos, target)
  }

  private glideTo(pos: THREE.Vector3, target: THREE.Vector3) {
    const fromPos = this.camera.position.clone()
    const fromTarget = this.controls.target.clone()
    const tween: Tween & { camera: boolean } = {
      camera: true,
      start: performance.now(),
      duration: 800,
      step: (t) => {
        const k = easeInOut(t)
        this.camera.position.lerpVectors(fromPos, pos, k)
        this.controls.target.lerpVectors(fromTarget, target, k)
      },
    }
    this.tweens = this.tweens.filter((t) => !(t as Tween & { camera?: boolean }).camera)
    this.tweens.push(tween)
    this.invalidate()
  }

  setView(view: View) {
    this.view = view
    this.applyOverhead()
    this.frame('glide', view)
  }

  private applyOverhead() {
    for (const o of this.built?.overhead ?? []) o.visible = this.view !== 'top'
    this.invalidate()
  }

  /** Кухня стала больше или меньше — плавно отъехать, чтобы она влезла в кадр. */
  reframe() {
    this.frame('glide')
  }

  /** Подлететь к технике, чтобы её было хорошо видно. */
  focus(slot: SlotKind) {
    const p = this.built?.anchors[slot]
    if (!p || this.reduced) return
    const dir = this.camera.position.clone().sub(this.controls.target).normalize()
    const target = p.clone()
    const pos = target.clone().add(dir.multiplyScalar(3.3))
    pos.y = Math.max(pos.y, 1.3)
    this.glideTo(pos, target)
  }

  /* ───────── выбор ───────── */

  setSelected(slot: SlotKind | null) {
    this.selected = slot
    if (this.outline) {
      this.scene.remove(this.outline)
      this.outline.geometry.dispose()
      ;(this.outline.material as THREE.Material).dispose()
      this.outline = null
    }
    const obj = slot ? this.built?.objects[slot] : null
    if (obj) {
      const b = new THREE.Box3().setFromObject(obj).expandByScalar(0.012)
      const geom = new THREE.EdgesGeometry(new THREE.BoxGeometry(...b.getSize(new THREE.Vector3()).toArray()))
      const line = new THREE.LineSegments(geom, new THREE.LineBasicMaterial({ color: '#2563eb', transparent: true, opacity: 0.95, depthTest: false }))
      line.position.copy(b.getCenter(new THREE.Vector3()))
      line.renderOrder = 10
      this.outline = line
      this.scene.add(line)
    }
    this.invalidate()
  }

  private hit(e: PointerEvent): THREE.Intersection | null {
    if (!this.built) return null
    const rect = this.renderer.domElement.getBoundingClientRect()
    const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1)
    this.raycaster.setFromCamera(ndc, this.camera)
    const shown = (o: THREE.Object3D | null): boolean => !o || (o.visible && shown(o.parent))
    return this.raycaster.intersectObject(this.built.root, true).find((h) => shown(h.object)) ?? null
  }

  private pickOf(hit: THREE.Intersection | null): Pick {
    const d = hit?.object.userData
    const owner = this.dimsOwner(hit?.object ?? null)
    return {
      slot: (d?.slot as SlotKind | undefined) ?? null,
      item: (d?.item as ItemKey | undefined) ?? null,
      dims: (owner?.userData.dims as Dims | undefined) ?? null,
      cab: (this.cabOwner(hit?.object ?? null)?.userData.cab as CabInfo | undefined) ?? null,
    }
  }

  private cabOwner(o: THREE.Object3D | null): THREE.Object3D | null {
    for (let cur = o; cur && cur !== this.built?.root; cur = cur.parent) if (cur.userData.cab) return cur
    return null
  }

  /**
   * После перестройки снова показать размеры того же шкафа (покупатель
   * поменял ему фасады). Возвращает новые размеры или null, если шкафа нет.
   */
  measureCab(key: string): { dims: Dims | null; cab: CabInfo } | null {
    let found: THREE.Object3D | null = null
    this.built?.root.traverse((o) => {
      if (!found && (o.userData.cab as CabInfo | undefined)?.key === key) found = o
    })
    if (!found) return null
    const obj = found as THREE.Object3D
    this.showMeasure(obj)
    return { dims: (obj.userData.dims as Dims | undefined) ?? null, cab: obj.userData.cab as CabInfo }
  }

  /**
   * То же для предмета (мойка, плита, пенал, техника): после перестройки
   * размеры остаются на нём. Берём сам шкаф предмета — верхний из помеченных.
   */
  measureItem(key: ItemKey): { dims: Dims | null } | null {
    let found: THREE.Object3D | null = null
    this.built?.root.traverse((o) => {
      if (!found && o.userData.item === key && o.userData.dims && o.parent?.userData.item !== key) found = o
    })
    if (!found) return null
    const obj = found as THREE.Object3D
    this.showMeasure(obj)
    return { dims: (obj.userData.dims as Dims | undefined) ?? null }
  }

  /** Спецификация для мебельщика — ровно то, что нарисовано. */
  spec(): SpecData | null {
    return this.built?.spec ?? null
  }

  private dimsOwner(o: THREE.Object3D | null): THREE.Object3D | null {
    for (let cur = o; cur && cur !== this.built?.root; cur = cur.parent) if (cur.userData.dims) return cur
    return null
  }

  /** Выбранное снаружи (карточка шкафа открыта) — его пальцем можно тащить сразу. */
  setGrab(key: string | null) {
    this.grab = key
  }

  private keyOf(what: DragTarget): string {
    return 'item' in what ? what.item : what.cab.key
  }

  private onDown(e: PointerEvent) {
    this.down = { x: e.clientX, y: e.clientY, t: performance.now() }
    // на фото кухню только разглядывают — вращают и приближают
    if (this.photo) return
    if (!e.isPrimary) {
      // второй палец — приближают, а не переставляют
      this.cancelHold()
      if (this.press) {
        this.press = null
        this.controls.enabled = true
      }
      return
    }
    if (e.button !== 0) return
    const pick = this.pickOf(this.hit(e))
    // Взять можно технику, мойку и любой нижний шкаф.
    let what: DragTarget | null = null
    if (pick.item) what = { item: pick.item }
    // планку уже 15 см не таскаем: своим шкафом она стала бы шире — только выбрать
    else if (pick.cab?.row === 'base' && pick.dims && pick.dims.w >= 15) what = { cab: pick.cab, w: pick.dims.w }
    if (!what) return
    // Мышью тянут сразу. Пальцем — сразу только выбранное: иначе одним
    // пальцем нельзя было бы повернуть кухню, ведь почти везде шкафы.
    if (e.pointerType === 'mouse' || this.grab === this.keyOf(what)) {
      this.controls.enabled = false
      this.press = { what, x: e.clientX, y: e.clientY, id: e.pointerId }
      // отпустят за краем 3D — «отпускание» всё равно придёт сюда, и вращение вернётся
      try {
        this.renderer.domElement.setPointerCapture(e.pointerId)
      } catch {
        // указатель уже отпущен
      }
      return
    }
    const target = what
    const timer = window.setTimeout(() => this.startDrag(target, e), HOLD_MS)
    this.hold = { timer }
  }

  private onUp(e: PointerEvent) {
    this.cancelHold()
    if (this.press) {
      this.press = null
      this.controls.enabled = true
    }
    if (this.drag) {
      this.stopDrag(true)
      this.down = null
      return
    }
    const d = this.down
    this.down = null
    if (!d || this.photo) return
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6 || performance.now() - d.t > 600) return
    const hit = this.hit(e)
    const pick = this.pickOf(hit)
    // размеры считаем по закрытым дверцам — до того, как дверца поедет
    this.showMeasure(this.dimsOwner(hit?.object ?? null))
    const door = this.openableOf(hit?.object ?? null)
    if (door) this.toggleOpen(door)
    this.events.onPick(pick)
  }

  private onMove(e: PointerEvent) {
    if (this.hold && this.down && Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y) > 8) this.cancelHold()
    const p = this.press
    if (p && e.pointerId === p.id && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 5) {
      this.press = null
      try {
        this.renderer.domElement.setPointerCapture(e.pointerId)
      } catch {
        // указатель уже отпущен — тащить нечего
      }
      this.startDrag(p.what, e)
      return
    }
    if (this.drag) {
      this.moveDrag(e)
      return
    }
    if (e.pointerType !== 'mouse' || this.down) return
    cancelAnimationFrame(this.hoverFrame)
    this.hoverFrame = requestAnimationFrame(() => {
      const hit = this.hit(e)
      const pk = this.pickOf(hit)
      // шкаф и технику можно тащить — «перенести»; дверцу — открыть; мимо — вращать
      const movable = pk.item || pk.cab?.row === 'base'
      this.renderer.domElement.style.cursor = movable ? 'move' : pk.slot || pk.cab || this.openableOf(hit?.object ?? null) ? 'pointer' : 'grab'
    })
  }

  /* ───────── открыть дверцу ───────── */

  private openableOf(o: THREE.Object3D | null): THREE.Object3D | null {
    for (let cur = o; cur && cur !== this.built?.root; cur = cur.parent) if (cur.userData.open) return cur
    return null
  }

  private toggleOpen(pivot: THREE.Object3D) {
    const info = pivot.userData.open as OpenInfo
    const opened = !pivot.userData.isOpen
    pivot.userData.isOpen = opened
    if (pivot.userData.baseZ === undefined) pivot.userData.baseZ = pivot.position.z
    const amount = OPEN_AMOUNT[info.kind] * info.dir
    const read = () =>
      info.kind === 'swing' ? pivot.rotation.y : info.kind === 'slide' ? pivot.position.z - pivot.userData.baseZ : pivot.rotation.x
    const write = (v: number) => {
      if (info.kind === 'swing') pivot.rotation.y = v
      else if (info.kind === 'slide') pivot.position.z = pivot.userData.baseZ + v
      else pivot.rotation.x = v
    }
    const from = read()
    const to = opened ? amount : 0
    if (this.reduced) {
      write(to)
      this.invalidate()
      return
    }
    this.tweens.push({ start: performance.now(), duration: 520, step: (t) => write(from + (to - from) * easeInOut(t)) })
    this.invalidate()
  }

  /* ───────── размеры ───────── */

  /**
   * Размерные линии, как на чертеже мебельщика: ширина по переднему краю
   * сверху, высота — сбоку, глубина — по верху. Числа — HTML-метки m:w, m:h, m:d.
   */
  showMeasure(obj: THREE.Object3D | null) {
    if (this.measureLines) {
      this.scene.remove(this.measureLines)
      this.measureLines.traverse((o) => {
        if (o instanceof THREE.LineSegments) {
          o.geometry.dispose()
          ;(o.material as THREE.Material).dispose()
        }
      })
      this.measureLines = null
    }
    for (const k of ['m:w', 'm:h', 'm:d']) this.tagPoints.delete(k)
    if (!obj) {
      this.invalidate()
      return
    }
    obj.updateWorldMatrix(true, true)
    const box = new THREE.Box3().setFromObject(obj)
    const q = obj.getWorldQuaternion(new THREE.Quaternion())
    const front = new THREE.Vector3(0, 0, 1).applyQuaternion(q)
    // лицо смотрит вдоль x или вдоль z (кухня стоит под прямыми углами)
    const alongX = Math.abs(front.x) > Math.abs(front.z)
    const fs = Math.sign(alongX ? front.x : front.z) || 1
    const off = 0.05
    const tick = 0.03
    const pts: number[] = []
    const seg = (a: THREE.Vector3, b: THREE.Vector3) => pts.push(a.x, a.y, a.z, b.x, b.y, b.z)
    // p(ширина, высота, глубина) → мир: ширина — вдоль стены, глубина — к лицу
    const wMin = alongX ? box.min.z : box.min.x
    const wMax = alongX ? box.max.z : box.max.x
    const dFront = fs > 0 ? (alongX ? box.max.x : box.max.z) : alongX ? box.min.x : box.min.z
    const dBack = fs > 0 ? (alongX ? box.min.x : box.min.z) : alongX ? box.max.x : box.max.z
    const P = (w: number, y: number, d: number) => (alongX ? new THREE.Vector3(d, y, w) : new THREE.Vector3(w, y, d))
    const top = box.max.y + off
    const fwd = dFront + fs * off
    // ширина
    seg(P(wMin, top, fwd), P(wMax, top, fwd))
    seg(P(wMin, top - tick, fwd), P(wMin, top + tick, fwd))
    seg(P(wMax, top - tick, fwd), P(wMax, top + tick, fwd))
    // высота — у правого края
    const side = wMax + off
    seg(P(side, box.min.y, fwd), P(side, box.max.y, fwd))
    seg(P(side - tick, box.min.y, fwd), P(side + tick, box.min.y, fwd))
    seg(P(side - tick, box.max.y, fwd), P(side + tick, box.max.y, fwd))
    // глубина — по верху справа
    seg(P(side, top, dBack), P(side, top, dFront))
    seg(P(side, top - tick, dBack), P(side, top + tick, dBack))
    const geom = new THREE.BufferGeometry()
    geom.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    const lines = new THREE.LineSegments(geom, new THREE.LineBasicMaterial({ color: '#2563eb', depthTest: false, transparent: true }))
    lines.renderOrder = 12
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(...box.getSize(new THREE.Vector3()).toArray())),
      new THREE.LineBasicMaterial({ color: '#2563eb', transparent: true, opacity: 0.55, depthTest: false }),
    )
    edges.position.copy(box.getCenter(new THREE.Vector3()))
    edges.renderOrder = 11
    const g = new THREE.Group()
    g.add(lines, edges)
    this.measureLines = g
    this.scene.add(g)
    this.tagPoints.set('m:w', P((wMin + wMax) / 2, top + 0.02, fwd))
    this.tagPoints.set('m:h', P(side + 0.02, (box.min.y + box.max.y) / 2, fwd))
    this.tagPoints.set('m:d', P(side, top + 0.02, (dBack + dFront) / 2))
    this.invalidate()
  }

  /* ───────── перетащить предмет ───────── */

  private cancelHold() {
    if (!this.hold) return
    clearTimeout(this.hold.timer)
    this.hold = null
  }

  private startDrag(what: DragTarget, e: PointerEvent) {
    this.hold = null
    const plan = this.input?.plan
    if (!plan) return
    const w = 'item' in what ? itemPositions(plan)[what.item]?.w : what.w
    if (!w) return
    this.drag = { what, w: w / 100, target: null }
    this.controls.enabled = false
    this.renderer.domElement.style.cursor = 'grabbing'
    navigator.vibrate?.(12)
    this.moveDrag(e)
  }

  /** Куда встанет предмет: ближайшая стена и точка вдоль неё. */
  private moveDrag(e: PointerEvent) {
    const drag = this.drag
    const plan = this.input?.plan
    if (!drag || !plan) return
    const rect = this.renderer.domElement.getBoundingClientRect()
    const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1)
    this.raycaster.setFromCamera(ndc, this.camera)
    const point = new THREE.Vector3()
    if (!this.raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.9), point)) return
    let best: { run: (typeof plan.runs)[number]; x: number; score: number } | null = null
    for (const run of plan.runs) {
      // стены и остров
      if (!run.wall && run.id !== 'I') continue
      const L = run.length / 100
      const m = new THREE.Matrix4().makeRotationY(run.rot).setPosition(run.ox / 100, 0, run.oz / 100)
      const local = point.clone().applyMatrix4(m.invert())
      if (local.x < -0.4 || local.x > L + 0.4 || local.z < -0.5 || local.z > 2.2) continue
      const score = Math.abs(local.z - 0.3)
      if (!best || score < best.score) best = { run, x: local.x, score }
    }
    if (!best) {
      drag.target = null
      if (this.marker) this.marker.visible = false
      this.invalidate()
      return
    }
    const { run } = best
    const L = run.length / 100
    const lo = run.id === 'C' ? 0.6 : 0
    const hi = run.id === 'B' ? L - 0.6 : L
    const x = Math.min(hi - drag.w / 2, Math.max(lo + drag.w / 2, best.x))
    const logical = run.id === 'B' ? L - x : x
    const wall = run.id as WallId
    const pos = Math.round(logical * 100)
    drag.target = { wall, pos }
    // Рамка стоит там, где предмет встанет на самом деле: соседи и края
    // стены его не пустят дальше. Сбоку — сколько останется столешницы.
    const pv = this.events.onPreview?.({ what: drag.what, wall, pos }) ?? null
    const toLocal = (c: number) => (run.id === 'B' ? L - c / 100 : c / 100)
    this.showMarker(run, pv ? toLocal(pv.center) : x, pv ? pv.w / 100 : drag.w, pv?.fits ?? true)
    for (const k of [...this.tagPoints.keys()]) if (k.startsWith('gap:')) this.tagPoints.delete(k)
    pv?.gaps.forEach((g, i) => this.tagPoints.set(`gap:${i}`, this.runPoint(run, toLocal(g.center), 0.95, 0.64)))
  }

  /** Точка ряда: вдоль стены x, высота y, от стены z (метры) — в мировые координаты. */
  private runPoint(run: { ox: number; oz: number; rot: number }, x: number, y: number, z: number) {
    const cos = Math.cos(run.rot)
    const sin = Math.sin(run.rot)
    return new THREE.Vector3(run.ox / 100 + x * cos + z * sin, y, run.oz / 100 - x * sin + z * cos)
  }

  private showMarker(run: { ox: number; oz: number; rot: number }, x: number, w: number, fits = true) {
    if (!this.marker) {
      const g = new THREE.Group()
      const size = new THREE.Vector3(1, 0.9, 0.62)
      const fill = new THREE.Mesh(
        new THREE.BoxGeometry(size.x, size.y, size.z),
        new THREE.MeshBasicMaterial({ color: '#2563eb', transparent: true, opacity: 0.16, depthWrite: false }),
      )
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(fill.geometry), new THREE.LineBasicMaterial({ color: '#2563eb', depthTest: false, transparent: true }))
      edges.renderOrder = 11
      g.add(fill, edges)
      this.marker = g
      this.scene.add(g)
    }
    const g = this.marker
    g.visible = true
    g.scale.set(w, 1, 1)
    // не помещается — рамка красная: отпустите, и что-то уйдёт из кухни
    const color = fits ? '#2563eb' : '#dc2626'
    g.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments) (o.material as THREE.MeshBasicMaterial).color.set(color)
    })
    g.position.copy(this.runPoint(run, x, 0.45, 0.31))
    g.rotation.y = run.rot
    this.invalidate()
  }

  private stopDrag(commit: boolean) {
    const drag = this.drag
    this.drag = null
    this.controls.enabled = true
    this.renderer.domElement.style.cursor = 'grab'
    if (this.marker) this.marker.visible = false
    for (const k of [...this.tagPoints.keys()]) if (k.startsWith('gap:')) this.tagPoints.delete(k)
    this.invalidate()
    if (drag) this.events.onPreview?.(null)
    if (commit && drag?.target) this.events.onMove(drag.what, drag.target.wall, drag.target.pos)
  }

  /* ───────── ценники и размеры ───────── */

  setTag(key: string, el: HTMLElement | null) {
    if (el) this.tags.set(key, el)
    else this.tags.delete(key)
    this.invalidate()
  }

  private updateTagPoints() {
    this.tagPoints.clear()
    const b = this.built
    const input = this.input
    if (!b || !input) return
    for (const [slot, p] of Object.entries(b.anchors)) this.tagPoints.set(slot, p)
    const plan = input.plan
    const cm = (v: number) => v / 100
    const top = (b.wallH ?? WALL_H) + 0.08
    const a = plan.runs.find((r) => r.id === 'A')
    if (a) this.tagPoints.set('dim:a', new THREE.Vector3(cm(a.length) / 2, top, -0.06))
    const bRun = plan.runs.find((r) => r.id === 'B')
    if (bRun) this.tagPoints.set('dim:b', new THREE.Vector3(-0.06, top, cm(bRun.length) / 2))
    const cRun = plan.runs.find((r) => r.id === 'C')
    if (cRun) this.tagPoints.set('dim:c', new THREE.Vector3(cm(cRun.ox) + 0.06, top, cm(cRun.length) / 2))
    if (plan.island) this.tagPoints.set('dim:i', new THREE.Vector3(cm(plan.island.x + plan.island.w / 2), 1.0, cm(plan.island.z) + 0.3))
    // ширина каждого нижнего модуля — у пола перед фасадом (кнопка «Размеры»)
    for (const run of plan.runs) {
      const cos = Math.cos(run.rot)
      const sin = Math.sin(run.rot)
      run.modules.forEach((m, i) => {
        const lx = cm(m.x + m.w / 2)
        const lz = 0.66
        this.tagPoints.set(`mw:${run.id}:${i}`, new THREE.Vector3(cm(run.ox) + lx * cos + lz * sin, 0.05, cm(run.oz) - lx * sin + lz * cos))
      })
    }
  }

  private placeTags() {
    const rect = this.renderer.domElement.getBoundingClientRect()
    const v = new THREE.Vector3()
    for (const [key, el] of this.tags) {
      const p = this.tagPoints.get(key)
      if (!p) {
        el.style.visibility = 'hidden'
        continue
      }
      v.copy(p).project(this.camera)
      const visible = v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05
      el.style.visibility = visible ? 'visible' : 'hidden'
      if (!visible) continue
      let x = ((v.x + 1) / 2) * rect.width
      let y = ((1 - v.y) / 2) * rect.height
      // Подпись стены («A · 300 см») стоит за стеной и на узком экране
      // уезжала за край или под кнопки. Держим её внутри сцены.
      if (key.startsWith('dim:')) {
        x = Math.min(rect.width - 58, Math.max(58, x))
        y = Math.min(rect.height - 56, Math.max(96, y))
      }
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`
    }
  }

  /* ───────── фото трассировкой лучей ───────── */

  /** Сколько проходов копить: на хорошей видеокарте — больше, картинка чище. */
  private photoTarget(): number {
    // вечером свет от маленьких ламп — проходов нужно больше
    const k = this.evening ? 1.6 : 1
    if (this.mobile) return Math.round(96 * k)
    return Math.round((this.quality === '4k' ? 256 : 160) * k)
  }

  /** Что не должно попасть на фото: рамки выбора, размеры, контуры убранных шкафов. */
  private overlays(): THREE.Object3D[] {
    return [this.outline, this.measureLines, this.marker, ...(this.built?.ghosts ?? [])].filter((o): o is THREE.Object3D => Boolean(o))
  }

  /**
   * Включить фото: кухня рисуется трассировкой лучей и с каждым проходом
   * становится чище. Камеру можно вращать — пока едет, видно обычное 3D,
   * остановилась — фото копится заново. stopped — пока готовили, фото
   * выключили или кухню перестроили; failed — не получилось (нет нужных
   * функций WebGL, не хватило памяти).
   */
  async startPhoto(onState: (s: PhotoState | null) => void): Promise<'ok' | 'stopped' | 'failed'> {
    if (!this.built || this.disposed) return 'failed'
    if (this.photo) {
      this.photo.onState = onState
      return 'ok'
    }
    clearTimeout(this.refineTimer)
    this.refineTimer = 0
    const now = performance.now()
    const run: PhotoRun = { onState, target: this.photoTarget(), building: true, dirty: false, shown: false, perFrame: 1, last: 0, started: now, pct: -1, big: null }
    this.photo = run
    onState({ phase: 'build', progress: 0, big: false })
    this.showMeasure(null)
    try {
      const { PhotoTracer } = await import('./photoreal')
      if (this.photo !== run || this.disposed || !this.built) return 'stopped'
      this.pt ??= new PhotoTracer(this.renderer)
      // камера доезжает до конца — фото копится с неподвижной
      for (const tw of this.tweens) tw.step(1)
      this.tweens = []
      this.controls.update()
      await this.pt.load({
        scene: this.scene,
        camera: this.camera,
        root: this.built.root,
        hide: this.overlays(),
        lights: { hemi: this.hemi, sun: this.sun, fill: this.fill, windowSun: this.windowSun, sky: this.skyLight },
        evening: this.evening,
        room: { w: (this.input?.plan.room.w ?? 300) / 100, d: (this.input?.plan.room.d ?? 270) / 100, h: this.built.wallH },
        inside: this.camera.position.y < this.built.wallH - 0.05,
        window: this.photoWindow(),
      })
      if (this.photo !== run) return 'stopped'
      if (process.env.NODE_ENV !== 'production') console.info(`kitchen photo: сцена собрана за ${this.pt.buildMs} мс`)
      run.building = false
      run.started = performance.now()
      this.invalidate()
      return 'ok'
    } catch (err) {
      console.error('kitchen photo', err)
      if (this.photo === run) {
        this.photo = null
        onState(null)
      }
      this.invalidate()
      return 'failed'
    }
  }

  /**
   * Заранее, пока человек собирает кухню, подготовить трассировщик: видеокарта
   * в первый раз собирает его программу от 15 секунд до минуты, и лучше это
   * сделать до нажатия «Фото». Сборка идёт в фоне и экран не подвешивает.
   * На телефоне не готовим — бережём батарею и память.
   */
  async prewarmPhoto() {
    if (this.mobile || this.weakGpu || this.pt || this.disposed) return
    try {
      const { PhotoTracer } = await import('./photoreal')
      if (!this.disposed) this.pt ??= new PhotoTracer(this.renderer)
    } catch {
      // не вышло — соберём по кнопке
    }
  }

  /** Окно в метрах — для солнца на фото. */
  private photoWindow() {
    const win = this.input?.plan.window
    if (!win || !this.built) return null
    const top = Math.min(WINDOW.top, this.built.wallH - 0.25)
    return { wall: win.wall, at: win.at / 100, w: win.w / 100, sill: win.wall === 'back' ? WINDOW.backSill : WINDOW.leftSill, top }
  }

  /** Выйти из фото: снова обычное 3D. */
  stopPhoto() {
    const run = this.photo
    if (!run) return
    this.photo = null
    if (run.big) {
      run.big.resolve(null)
      run.big = null
      this.controls.enabled = true
      this.resize()
    }
    run.onState(null)
    this.invalidate()
  }

  isPhoto(): boolean {
    return Boolean(this.photo)
  }

  private tracePhoto(run: PhotoRun, now: number) {
    const pt = this.pt
    if (!pt) return
    const buf = this.renderer.getDrawingBufferSize(new THREE.Vector2())
    const pixels = buf.x * buf.y
    if (run.dirty) {
      pt.fitTiles(pixels)
      pt.restart()
      run.dirty = false
      run.shown = false
      run.started = now
      run.pct = -1
    }
    // Видеокарта ещё собирает программу трассировки — на холсте остаётся
    // обычное 3D, ждём (сборка идёт в фоне).
    if (pt.compiling) {
      run.started = now
      if (run.pct !== -2) {
        run.pct = -2
        run.onState({ phase: 'build', progress: 0, big: Boolean(run.big) })
      }
      this.invalidate()
      return
    }
    // На слабой видеокарте не ждём бесконечно: хватает и 64 проходов со сглаживанием.
    const enough = pt.samples >= run.target || (pt.samples >= 64 && now - run.started > (run.big ? PHOTO_MAX_MS * 2.5 : PHOTO_MAX_MS))
    if (!enough) {
      // Сколько кусков кадра успевать за кадр экрана: быстрая видеокарта —
      // больше, медленная — по одному, чтобы экран не подвисал. И не больше
      // ~1,2 млн точек за кадр: дольше видеокарту держать нельзя.
      const dt = run.last ? now - run.last : 16
      run.last = now
      const most = Math.max(1, Math.floor(1.2e6 / pt.tilePixels(pixels)))
      if (dt < 24) run.perFrame = Math.min(most, run.perFrame + 1)
      else if (dt > 45) run.perFrame = Math.max(1, run.perFrame - 1)
      run.perFrame = Math.min(run.perFrame, most)
      this.renderer.setRenderTarget(null)
      pt.step(run.perFrame)
      const pct = Math.floor((pt.samples / run.target) * 100)
      if (pct !== run.pct) {
        run.pct = pct
        run.onState({ phase: 'trace', progress: Math.min(0.99, pt.samples / run.target), big: Boolean(run.big) })
      }
      this.invalidate()
      return
    }
    if (run.shown) return
    this.renderer.setRenderTarget(null)
    pt.showFinal()
    run.shown = true
    if (run.big) this.finishBig(run)
    else run.onState({ phase: 'done', progress: 1, big: false })
  }

  /**
   * Фото в большом размере — для сохранения: 3840 точек в ширину (на телефоне
   * 2048). Копится прямо на экране, потом отдаётся файлом.
   */
  photoBig(): Promise<Blob | null> {
    const run = this.photo
    if (!run || run.building || run.big || !this.pt) return Promise.resolve(null)
    return new Promise((resolve) => {
      const r = this.renderer
      const W = this.mobile ? 2048 : 3840
      const H = Math.round(Math.min(W, Math.max(W * 0.42, W / Math.max(0.5, this.camera.aspect))) / 2) * 2
      run.big = { resolve }
      // пока копится большое фото, камеру не трогаем — иначе всё заново
      this.controls.enabled = false
      r.setPixelRatio(1)
      r.setSize(W, H, false)
      this.camera.aspect = W / H
      this.camera.updateProjectionMatrix()
      run.target = this.mobile ? 96 : 200
      run.dirty = true
      this.invalidate()
    })
  }

  private finishBig(run: PhotoRun) {
    const big = run.big
    if (!big) return
    run.big = null
    this.controls.enabled = true
    // холст WebGL читается только сразу после кадра — копируем сейчас же
    const src = this.renderer.domElement
    const out = document.createElement('canvas')
    out.width = src.width
    out.height = src.height
    out.getContext('2d')?.drawImage(src, 0, 0)
    run.target = this.photoTarget()
    this.resize()
    run.onState({ phase: 'trace', progress: 0, big: false })
    out.toBlob((b) => big.resolve(b), 'image/jpeg', 0.94)
  }

  /** После служебной отрисовки (превью, картинка для листа) вернуть на холст фото. */
  private redraw() {
    const run = this.photo
    if (run?.shown && this.pt) {
      this.renderer.setRenderTarget(null)
      this.pt.showFinal()
    } else if (!run) this.draw()
    else this.invalidate()
  }

  /* ───────── кадры ───────── */

  invalidate() {
    if (this.raf || this.disposed) return
    this.raf = requestAnimationFrame(() => this.tick())
  }

  private tick() {
    this.raf = 0
    const now = performance.now()
    let busy = false
    this.tweens = this.tweens.filter((tw) => {
      const t = (now - tw.start) / tw.duration
      if (t < 0) {
        busy = true
        return true
      }
      tw.step(Math.min(1, t))
      if (t >= 1) {
        tw.done?.()
        return false
      }
      busy = true
      return true
    })
    const moved = this.controls.update()
    const ph = this.photo
    if (ph) {
      // пока сцена собирается для фото, холст не трогаем — там последний кадр
      if (ph.building) {
        this.placeTags()
        return
      }
      if (busy || moved) {
        // камера едет — показываем обычное 3D, фото начнём копить, когда встанет
        ph.dirty = true
        ph.shown = false
      } else {
        this.tracePhoto(ph, now)
        this.placeTags()
        return
      }
    }
    if (!busy && this.probeDirty) this.captureRoom()
    if ((busy || moved) && this.refined) this.setRatio(this.baseRatio)
    this.draw()
    this.placeTags()
    if (busy || moved) {
      clearTimeout(this.refineTimer)
      this.refineTimer = 0
      this.invalidate()
    } else if (!this.refined && !this.refineTimer) {
      // Остановились — через миг перерисуем с запасом чёткости.
      this.refineTimer = window.setTimeout(() => {
        this.refineTimer = 0
        // включили фото — холст теперь его
        if (this.photo) return
        this.setRatio(this.fineRatio())
        this.draw()
        this.placeTags()
      }, 160)
    }
  }

  /**
   * Чёткость в покое. HD — до двух точек на точку экрана (~4 млн точек),
   * 4K — до трёх, но не больше 3840×2160 (8,3 млн точек).
   */
  /**
   * Снимок комнаты из её середины на высоте 1,35 м: 6 сторон, потом из него
   * карта отражений. Тени берём уже готовые — второй раз не считаем.
   */
  private captureRoom() {
    this.probeDirty = false
    const plan = this.input?.plan
    if (!plan || !this.built) return
    if (!this.probe) {
      const rt = new THREE.WebGLCubeRenderTarget(this.mobile ? 128 : 256, { type: THREE.HalfFloatType })
      const cam = new THREE.CubeCamera(0.05, 30, rt)
      cam.layers.enable(CEILING_LAYER)
      this.probe = { rt, cam }
    }
    const hidden = [this.outline, this.measureLines, this.marker, ...this.built.ghosts].filter((o): o is NonNullable<typeof o> => Boolean(o && o.visible))
    for (const o of hidden) o.visible = false
    const r = this.renderer
    const auto = r.shadowMap.autoUpdate
    r.shadowMap.autoUpdate = false
    r.shadowMap.needsUpdate = true
    this.scene.environment = this.studioEnv
    this.scene.environmentIntensity = (this.evening ? NIGHT : DAY).env
    this.probe.cam.position.set(plan.room.w / 200, 1.35, (plan.room.d / 100) * 0.45)
    this.probe.cam.update(r, this.scene)
    r.shadowMap.autoUpdate = auto
    for (const o of hidden) o.visible = true
    this.roomEnv?.dispose()
    this.roomEnv = this.pmrem.fromCubemap(this.probe.rt.texture).texture
    this.scene.environment = this.roomEnv
    this.scene.environmentIntensity = (this.evening ? NIGHT : DAY).room
  }

  private fineRatio(): number {
    const w = this.host.clientWidth
    const h = this.host.clientHeight
    const dpr = window.devicePixelRatio || 1
    const k4 = this.quality === '4k'
    const budget = k4 ? (this.mobile ? 5e6 : 8.3e6) : this.mobile ? 2.4e6 : 4e6
    // без своего уменьшения (телефон) — ровно точки экрана: крупнее браузер ужал бы грубо
    const want = !this.composer ? dpr : k4 ? Math.min(dpr * 3, 3) : Math.min(dpr * 2, 2)
    return Math.max(this.baseRatio, Math.min(want, Math.sqrt(budget / Math.max(1, w * h))))
  }

  /** Какую часть общего кадра рисуем — чтобы затемнение углов было одно на весь 4K. */
  private frameTile(x: number, y: number, w: number, h: number) {
    if (!this.finalPass) return
    this.finalPass.uniforms.frameOffset.value.set(x, y)
    this.finalPass.uniforms.frameScale.value.set(w, h)
  }

  private gpuName(): string {
    try {
      const gl = this.renderer.getContext()
      const ext = gl.getExtension('WEBGL_debug_renderer_info')
      return String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER))
    } catch {
      return ''
    }
  }

  /** Параметры чёткости: в движении, детальность картинок, память под них. */
  private applyQuality() {
    const dpr = window.devicePixelRatio || 1
    if (this.quality === '4k') {
      this.baseRatio = Math.min(Math.max(dpr, 1.5), 2)
      this.detail = 2
      setBudget(this.mobile ? 200e6 : 480e6)
    } else {
      this.baseRatio = Math.min(dpr, 1.5)
      this.detail = this.mobile ? 1 : 2
      setBudget(this.mobile ? 110e6 : 420e6)
    }
  }

  getQuality(): Quality {
    return this.quality
  }

  setQuality(q: Quality) {
    if (q === this.quality) return
    this.quality = q
    try {
      window.localStorage.setItem('kp-quality', q)
    } catch {
      // приватный режим — выбор просто не запомнится
    }
    const prevDetail = this.detail
    this.applyQuality()
    // телефон в 4K берёт картинки материалов подробнее — кухню пересобираем
    if (this.detail !== prevDetail && this.input) this.setKitchen(this.input, null, false)
    this.resize()
  }

  /** Сколько точек в кадре в покое — для подписи на кнопке. */
  restPixels(): { w: number; h: number } {
    const r = this.fineRatio()
    return { w: Math.round(this.host.clientWidth * r), h: Math.round(this.host.clientHeight * r) }
  }

  private setRatio(ratio: number) {
    this.refined = ratio > this.baseRatio
    if (Math.abs(this.renderRatio - ratio) < 0.01) return
    this.applyRatio(ratio, this.host.clientWidth, this.host.clientHeight)
  }

  /** Кадр в ratio раз крупнее точек CSS; холст остаётся в точках экрана. */
  private applyRatio(ratio: number, w: number, h: number, samples?: number) {
    this.renderRatio = ratio
    if (!this.composer) {
      this.renderer.setPixelRatio(ratio)
      this.renderer.setSize(w, h, false)
      return
    }
    const canvas = this.renderer.getPixelRatio()
    this.setSamples(samples ?? (ratio >= 1.99 ? 0 : 4))
    this.composer.setPixelRatio(ratio)
    this.composer.setSize(w, h)
    if (this.finalPass) this.finalPass.uniforms.scale.value = ratio / canvas
  }

  /**
   * При двойной чёткости и выше сглаживание уже есть — многосэмпловое (MSAA)
   * выключаем: оно заняло бы сотни мегабайт видеопамяти на 4K.
   */
  private setSamples(samples: number) {
    const c = this.composer
    if (!c) return
    for (const rt of [c.renderTarget1, c.renderTarget2]) {
      if (rt.samples === samples) continue
      rt.samples = samples
      rt.dispose()
    }
  }

  private draw() {
    if (this.composer) this.composer.render()
    else this.renderer.render(this.scene, this.camera)
  }

  private resize() {
    const w = this.host.clientWidth
    const h = this.host.clientHeight
    if (w === 0 || h === 0) return
    // большое фото копится в своём размере — окно подождёт
    if (this.photo?.big) return
    if (this.photo) {
      this.photo.dirty = true
      this.photo.shown = false
    }
    this.refined = false
    this.renderer.setPixelRatio(this.composer ? this.canvasRatio : this.baseRatio)
    this.renderer.setSize(w, h, false)
    this.applyRatio(this.baseRatio, w, h)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.invalidate()
  }

  /** Картинка текущего вида для сохранения или отправки. */
  snapshot(width = 1600, height = 1000): string {
    const r = this.renderer
    const prev = r.getSize(new THREE.Vector2())
    const prevRatio = r.getPixelRatio()
    const prevAspect = this.camera.aspect
    const hidden = [this.outline, this.measureLines, this.marker, ...(this.built?.ghosts ?? [])].filter((o): o is NonNullable<typeof o> => Boolean(o && o.visible))
    for (const o of hidden) o.visible = false
    const prevRender = this.renderRatio
    r.setPixelRatio(1)
    r.setSize(width, height, false)
    // в полтора раза крупнее и честно уменьшить — ровные кромки на картинке
    this.applyRatio(this.composer ? 1.5 : 1, width, height, 0)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.draw()
    const url = r.domElement.toDataURL('image/jpeg', 0.9)
    r.setPixelRatio(prevRatio)
    r.setSize(prev.x, prev.y, false)
    this.applyRatio(prevRender, prev.x, prev.y)
    this.camera.aspect = prevAspect
    this.camera.updateProjectionMatrix()
    for (const o of hidden) o.visible = true
    this.redraw()
    return url
  }

  /**
   * Картинка 4K (3840 точек в ширину). Рисуем четырьмя кусками и склеиваем:
   * так хватает памяти даже на ноутбуке, а тени в углах сохраняются.
   */
  async snapshot4k(): Promise<Blob | null> {
    // 3840 точек в ширину, пропорции — как у окна с 3D: что видно, то и в файле
    const W = 3840
    const H = Math.round(Math.min(3840, Math.max(1600, W / Math.max(0.5, this.camera.aspect))) / 2) * 2
    const tw = W / 2
    const th = H / 2
    const out = document.createElement('canvas')
    out.width = W
    out.height = H
    const ctx = out.getContext('2d')
    if (!ctx) return null
    const r = this.renderer
    // камера могла ещё доезжать — ставим её в итоговое положение
    for (const tw of this.tweens) tw.step(1)
    this.tweens = []
    this.controls.update()
    const prevRatio = r.getPixelRatio()
    const prevSize = r.getSize(new THREE.Vector2())
    const prevAspect = this.camera.aspect
    const hidden = [this.outline, this.measureLines, this.marker, ...(this.built?.ghosts ?? [])].filter((o): o is NonNullable<typeof o> => Boolean(o && o.visible))
    for (const o of hidden) o.visible = false
    const prevRender = this.renderRatio
    r.setPixelRatio(1)
    r.setSize(tw, th, false)
    this.applyRatio(this.composer ? 1.5 : 1, tw, th, 0)
    this.camera.aspect = W / H
    const bloomOn = this.bloom?.enabled ?? false
    if (this.bloom) this.bloom.enabled = false
    for (let ty = 0; ty < 2; ty++) {
      for (let tx = 0; tx < 2; tx++) {
        this.camera.setViewOffset(W, H, tx * tw, ty * th, tw, th)
        this.camera.updateProjectionMatrix()
        this.frameTile(tx * tw / W, 1 - ((ty + 1) * th) / H, tw / W, th / H)
        this.draw()
        ctx.drawImage(r.domElement, tx * tw, ty * th)
      }
    }
    this.camera.clearViewOffset()
    this.frameTile(0, 0, 1, 1)
    if (this.bloom) this.bloom.enabled = bloomOn
    this.camera.aspect = prevAspect
    this.camera.updateProjectionMatrix()
    for (const o of hidden) o.visible = true
    r.setPixelRatio(prevRatio)
    r.setSize(prevSize.x, prevSize.y, false)
    this.applyRatio(prevRender, prevSize.x, prevSize.y)
    this.redraw()
    return new Promise((resolve) => out.toBlob((b) => resolve(b), 'image/jpeg', 0.93))
  }

  /** Превью другого стиля на этой же кухне — для карточек выбора стиля. */
  thumbnail(input: BuildInput, width = 480, height = 320): string {
    if (!this.built || !this.input) return ''
    const r = this.renderer
    // превью маленькое — ему хватает картинок вчетверо мельче
    const temp = buildKitchen({ ...input, evening: false, detail: 0.5 })
    const prevEvening = this.evening
    this.built.root.visible = false
    if (this.outline) this.outline.visible = false
    this.scene.add(temp.root)
    this.evening = false
    this.applyDaylightFor(temp)
    const cam = this.camera.clone()
    const { target, pos } = this.framing('angle')
    cam.aspect = width / height
    cam.position.copy(pos).sub(target).multiplyScalar(0.78).add(target)
    cam.lookAt(target)
    cam.updateProjectionMatrix()
    const overlays = [this.measureLines, this.marker].filter((o): o is NonNullable<typeof o> => Boolean(o && o.visible))
    for (const o of overlays) o.visible = false
    // Рисуем в уголок того же холста, не меняя его размер: пересоздание
    // холста стоило бы полсекунды на каждое превью.
    const el = r.domElement
    const ratio = r.getPixelRatio()
    const w = Math.min(width, el.width)
    const h = Math.min(height, el.height)
    r.setScissorTest(true)
    r.setViewport(0, 0, w / ratio, h / ratio)
    r.setScissor(0, 0, w / ratio, h / ratio)
    r.render(this.scene, cam)
    const shot = document.createElement('canvas')
    shot.width = w
    shot.height = h
    shot.getContext('2d')?.drawImage(el, 0, el.height - h, w, h, 0, 0, w, h)
    const url = shot.toDataURL('image/jpeg', 0.82)
    r.setScissorTest(false)
    r.setViewport(0, 0, el.width / ratio, el.height / ratio)
    this.scene.remove(temp.root)
    temp.dispose()
    this.built.root.visible = true
    if (this.outline) this.outline.visible = true
    for (const o of overlays) o.visible = true
    this.evening = prevEvening
    if (this.roomEnv) this.scene.environment = this.roomEnv
    this.applyEvening()
    this.redraw()
    return url
  }

  private applyDaylightFor(temp: Built) {
    this.scene.environment = this.studioEnv
    this.hemi.intensity = DAY.hemi
    this.sun.intensity = DAY.key
    this.fill.intensity = DAY.fill
    this.windowSun.intensity = 0
    if (this.skyLight) this.skyLight.intensity = 0
    this.scene.environmentIntensity = DAY.env
    ;(this.scene.background as THREE.Color).set('#eef0f3')
    for (const l of temp.eveningLights) (l as THREE.Light).intensity = 0
  }

  dispose() {
    this.disposed = true
    this.photo = null
    this.pt?.dispose()
    this.cancelHold()
    clearTimeout(this.refineTimer)
    cancelAnimationFrame(this.raf)
    cancelAnimationFrame(this.hoverFrame)
    this.resizeObserver.disconnect()
    this.controls.dispose()
    this.built?.dispose()
    this.composer?.dispose()
    this.roomEnv?.dispose()
    this.studioEnv.dispose()
    this.probe?.rt.dispose()
    this.pmrem.dispose()
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }
}
