import * as THREE from 'three'
import { DenoiseMaterial, GradientEquirectTexture, WebGLPathTracer } from 'three-gpu-pathtracer'
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js'

/**
 * Фото кухни трассировкой лучей: свет считается как в жизни. Лучи отскакивают
 * от стен и шкафов, поэтому свет из окна подсвечивает комнату, углы мягко
 * темнеют, в глянце и камне отражается сама кухня. Обычное 3D так не умеет —
 * там это подделки (затенение углов, снимок комнаты для отражений).
 *
 * Грузится только по кнопке «Фото»: библиотека тяжёлая, а нужна не всем.
 */

type PrepareOpts = {
  scene: THREE.Scene
  root: THREE.Object3D
  hide: THREE.Object3D[]
  lights: PhotoLights
  evening: boolean
  /** комната в метрах: ширина, глубина, высота */
  room: { w: number; d: number; h: number }
  /** камера внутри комнаты, ниже потолка */
  inside: boolean
  /** окно в метрах: на какой стене, середина вдоль стены, ширина, подоконник и верх */
  window: { wall: 'back' | 'left'; at: number; w: number; sill: number; top: number } | null
}

/** Как обычные лампы и небо в окне светят на фото. */
export type PhotoLights = {
  hemi: THREE.HemisphereLight
  sun: THREE.DirectionalLight
  fill: THREE.DirectionalLight
  windowSun: THREE.DirectionalLight
  sky: THREE.RectAreaLight | null
}

/**
 * Свет на фото — как у фотографа интерьеров. Днём: большой мягкий свет
 * спереди (front — как окно за спиной фотографа) и сверху (top), окно
 * кухни (свет неба и солнечное пятно на полу), немного неба для отражений и
 * слабый основной свет сверху, чтобы верхние шкафы дали тень на фартук.
 * Софтбоксы на фото не видны — трассировщик их только «чувствует».
 * Вечером — лампы, подсветка и чуть-чуть рассеянного света.
 */
const DAY = { env: 0.4, sun: 0.3, fill: 0, windowSun: 2.6, sky: 3.4, skyGlow: 1.2, lamp: 0, front: 1.05, top: 0 }
/** Свет фото и где камера: в комнате (вид «в жизни») — потолок настоящий. */
type Look = typeof DAY & { inside: boolean }

/** Солнце на фото ниже, чем в 3D: его лучи входят только в окно, а не поверх стен. */
const SUN_ELEVATION = (30 * Math.PI) / 180
// Вечером светят настоящие лампы (их трассировщик находит сразу), а
// светящиеся полоски и плафоны — только чтобы было видно, что они горят:
// ярче — и по всей комнате рассыпается «зерно».
// Немного рассеянного света спереди: в тёмной комнате с маленькими лампами
// фото иначе копилось бы очень долго и оставалось «в зерне».
const NIGHT = { env: 0.08, sun: 0, fill: 0, windowSun: 0, sky: 0, skyGlow: 0.25, lamp: 0.35, front: 0.28, top: 0 }

export class PhotoTracer {
  readonly tracer: WebGLPathTracer
  private env = new GradientEquirectTexture(128)
  private denoise: FullScreenQuad
  /** замены материалов на время сборки: светящееся — как настоящий источник света */
  private swaps = new WeakMap<THREE.Material, THREE.Material>()
  /** сколько заняла последняя сборка сцены, мс */
  buildMs = 0

  constructor(private renderer: THREE.WebGLRenderer) {
    const t = new WebGLPathTracer(renderer)
    // пять отскоков света — комната уже светлая в углах; больше — дольше, а разницы не видно
    t.bounces = 5
    t.transmissiveBounces = 3
    // блики на глянце без «светлячков» — ярких точек от окна в мраморе и лаке
    t.filterGlossyFactor = 1
    t.minSamples = 1
    t.fadeDuration = 0
    t.renderDelay = 0
    t.dynamicLowRes = false
    t.rasterizeScene = true
    t.renderToCanvas = true
    t.tiles.set(2, 2)
    t.multipleImportanceSampling = true
    // Случайные числа — последовательность Соболя. Способ по умолчанию
    // (стратифицированный) на Windows с видеокартой NVIDIA не менялся от
    // прохода к проходу: вместо фото получался «лабиринт» из чёрных и белых точек.
    ;(t as unknown as { _pathTracer: { material: { setDefine: (k: string, v: number) => void } } })._pathTracer.material.setDefine('RANDOM_TYPE', 1)
    this.tracer = t
    // небо: светлое сверху, тёплое у земли
    this.env.topColor.set('#f5f7fb')
    this.env.bottomColor.set('#cfc7bb')
    this.env.exponent = 1.6
    this.env.update()
    this.denoise = new FullScreenQuad(
      new DenoiseMaterial({
        blending: THREE.NoBlending,
        premultipliedAlpha: renderer.getContextAttributes()?.premultipliedAlpha ?? true,
      }),
    )
    // на готовом фото — лёгкое сглаживание шума, края и рисунок остаются
    const d = this.denoise.material as DenoiseMaterial
    d.sigma = 2.2
    d.kSigma = 1.2
    d.threshold = 0.06
  }

  /**
   * Собрать сцену для трассировки. Пока собирается, светящееся становится
   * настоящим светом, оверлеи прячутся; потом всё возвращается как было —
   * трассировщик уже скопировал себе, что нужно.
   */
  async load(opts: PrepareOpts & { camera: THREE.Camera }) {
    // сперва пусть на экране появится «Готовим фото…» — сборка занимает миг
    await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)))
    const restore = this.prepare(opts)
    const t0 = performance.now()
    try {
      this.tracer.setScene(opts.scene, opts.camera)
    } finally {
      restore()
    }
    this.buildMs = Math.round(performance.now() - t0)
  }

  private prepare(o: PrepareOpts): () => void {
    const k: Look = { ...(o.evening ? NIGHT : DAY), inside: o.inside }
    const undo: (() => void)[] = []
    // Возвращаем, только если за время сборки никто не поменял сам: кухню
    // могли перестроить, а свет — переключить на вечер.
    const set = <T, K extends keyof T>(obj: T, key: K, value: T[K]) => {
      const was = obj[key]
      obj[key] = value
      undo.push(() => {
        if (obj[key] === value) obj[key] = was
      })
    }
    for (const h of o.hide) if (h.visible) set(h, 'visible', false)
    const meshes: THREE.Mesh[] = []
    o.root.traverseVisible((obj) => {
      if (obj instanceof THREE.Mesh) meshes.push(obj)
    })
    for (const mesh of meshes) {
      if (Array.isArray(mesh.material)) {
        this.split(mesh, k, set, undo)
        continue
      }
      const next = this.photoMaterial(mesh.material, k)
      if (next !== mesh.material) set(mesh, 'material', next)
    }
    const L = o.lights
    set(L.sun, 'intensity', L.sun.intensity > 0 ? k.sun : 0)
    set(L.fill, 'intensity', k.fill)
    // Солнце в окне. Потолок у комнаты есть только снизу (сверху на кухню
    // смотрят сквозь него), и солнце из 3D светило бы поверх стен: верх стен
    // и шкафов горел персиковым, по полу — лишние пятна. На фото солнце —
    // узкий луч прямо в окно: свет попадает в комнату только через раму.
    set(L.windowSun, 'intensity', 0)
    const extra: THREE.Object3D[] = []
    const win = o.window
    if (win && k.windowSun > 0) {
      const mid = (win.sill + win.top) / 2
      const center = win.wall === 'back' ? new THREE.Vector3(win.at, mid, 0) : new THREE.Vector3(0, mid, win.at)
      // к солнцу: наружу, чуть вбок и вверх на SUN_ELEVATION
      const out = win.wall === 'back' ? new THREE.Vector3(-0.35, 0, -1) : new THREE.Vector3(-1, 0, -0.35)
      out.normalize()
      out.y = Math.tan(SUN_ELEVATION)
      out.normalize()
      const dist = 7
      const half = Math.max(win.w, win.top - win.sill) / 2 + 0.25
      const sun = new THREE.SpotLight('#ffeccc', k.windowSun, 0, Math.atan(half / dist) * 1.2, 0.25, 0)
      sun.position.copy(center).addScaledVector(out, dist)
      sun.target.position.copy(center)
      // размер солнца: мягкий край пятна, как в жизни
      ;(sun as THREE.SpotLight & { radius?: number }).radius = 0.12
      extra.push(sun, sun.target)
    }
    if (L.sky) set(L.sky, 'intensity', L.sky.intensity > 0 ? k.sky : 0)
    // Выключенный свет трассировщику не показываем: он выбирает источник
    // наугад, и каждый выбор тёмной лампы — пропавший луч и лишний шум.
    // У включённых светильников — размер: край светового пятна мягкий, как у
    // настоящей лампы, а не ножом.
    o.scene.traverse((obj) => {
      if (obj instanceof THREE.Light && obj.visible && obj.intensity <= 0) set(obj, 'visible', false)
      else if (obj instanceof THREE.SpotLight || obj instanceof THREE.PointLight) set(obj as THREE.Light & { radius?: number }, 'radius', 0.06)
    })
    set(o.scene, 'environment', this.env)
    set(o.scene, 'environmentIntensity', k.env)
    // Софтбоксы: спереди — во всю кухню, чуть сверху; над комнатой — светит
    // вниз сквозь потолок (потолок пропускает свет с обратной стороны).
    const { w, d, h } = o.room
    const soft: THREE.RectAreaLight[] = []
    if (k.front > 0) {
      const front = new THREE.RectAreaLight('#ffffff', k.front, w * 1.3 + 1, h)
      front.position.set(w / 2, h * 0.62, d + 2.4)
      front.lookAt(w / 2, 1.0, 0)
      soft.push(front)
    }
    if (k.top > 0) {
      const top = new THREE.RectAreaLight('#f3f6fc', k.top, w, d)
      top.position.set(w / 2, h + 0.8, d / 2)
      top.lookAt(w / 2, 0, d / 2)
      soft.push(top)
    }
    const added: THREE.Object3D[] = [...soft, ...extra]
    for (const l of added) o.scene.add(l)
    o.scene.updateMatrixWorld(true)
    undo.push(() => {
      for (const l of added) {
        o.scene.remove(l)
        if (l instanceof THREE.Light) l.dispose()
      }
    })
    return () => {
      for (let i = undo.length - 1; i >= 0; i--) undo[i]()
    }
  }

  /**
   * Стена — это коробка с шестью материалами (лицо, торцы, срез сверху).
   * Трассировщик путает материалы у таких предметов: всё, что после них,
   * получало чужой цвет (пол — цвет цоколя, дверцы — цвет лимона). Поэтому на
   * время сборки делим коробку на куски с одним материалом каждый.
   */
  private split(
    mesh: THREE.Mesh,
    k: Look,
    set: <T, K extends keyof T>(obj: T, key: K, value: T[K]) => void,
    undo: (() => void)[],
  ) {
    const geom = mesh.geometry
    const mats = mesh.material as THREE.Material[]
    const parent = mesh.parent
    if (!parent) return
    const parts: THREE.Mesh[] = []
    for (const g of geom.groups) {
      const mat = mats[g.materialIndex ?? 0]
      if (!mat || !mat.visible) continue
      const sub = new THREE.BufferGeometry()
      for (const [name, attr] of Object.entries(geom.attributes)) sub.setAttribute(name, attr)
      const count = Math.min(g.count, (geom.index ? geom.index.count : geom.attributes.position.count) - g.start)
      const index = new Uint32Array(count)
      for (let i = 0; i < count; i++) index[i] = geom.index ? geom.index.getX(g.start + i) : g.start + i
      sub.setIndex(new THREE.BufferAttribute(index, 1))
      const part = new THREE.Mesh(sub, this.photoMaterial(mat, k))
      part.position.copy(mesh.position)
      part.quaternion.copy(mesh.quaternion)
      part.scale.copy(mesh.scale)
      parts.push(part)
    }
    set(mesh, 'visible', false)
    for (const p of parts) parent.add(p)
    parent.updateMatrixWorld(true)
    undo.push(() => {
      for (const p of parts) parent.remove(p)
    })
  }

  /**
   * Материал для фото. Небо в окне и лампы светят по-настоящему; потолок
   * без «подсветки», которой обычное 3D его осветляло; стекло окна не даёт
   * тени — иначе солнце не прошло бы в комнату.
   */
  private photoMaterial(m: THREE.Material, k: Look): THREE.Material {
    const role = m.userData.photo as 'sky' | 'lamp' | 'ceiling' | 'glass' | undefined
    if (!role) return m
    const key = `${role}:${k.skyGlow}:${k.lamp}:${k.inside}`
    const cached = this.swaps.get(m)
    if (cached && cached.userData.key === key) return cached
    let out: THREE.Material
    if (role === 'sky' || role === 'lamp') {
      const basic = m as THREE.MeshBasicMaterial
      const glow = role === 'sky' ? k.skyGlow : k.lamp
      out = new THREE.MeshStandardMaterial({
        color: glow > 0 ? '#000000' : basic.color,
        roughness: 0.9,
        emissive: glow > 0 ? basic.color : '#000000',
        emissiveMap: glow > 0 ? basic.map : null,
        emissiveIntensity: glow,
        side: basic.side,
      })
    } else if (role === 'ceiling') {
      out = (m as THREE.MeshStandardMaterial).clone()
      ;(out as THREE.MeshStandardMaterial).emissiveIntensity = 0
      // камера в комнате — потолок настоящий: не пропускает свет сверху
      if (k.inside) out.side = THREE.DoubleSide
    } else {
      out = m.clone()
      ;(out as THREE.Material & { castShadow?: boolean }).castShadow = false
    }
    out.userData.key = key
    this.swaps.set(m, out)
    return out
  }

  get samples(): number {
    return this.tracer.samples
  }

  /** Видеокарта ещё собирает программу трассировки (в типах библиотеки этого поля нет). */
  get compiling(): boolean {
    return Boolean((this.tracer as unknown as { isCompiling?: boolean }).isCompiling)
  }

  /**
   * Кадр делится на куски примерно по 170 тысяч точек: один кусок видеокарта
   * считает за доли секунды. Иначе Windows решит, что видеокарта зависла, и
   * сбросит её — 3D на странице пропадёт.
   */
  fitTiles(pixels: number) {
    const n = Math.max(2, Math.min(8, Math.ceil(Math.sqrt(pixels / 170e3))))
    if (this.tracer.tiles.x !== n) this.tracer.tiles.set(n, n)
  }

  /** Точек в одном куске — чтобы решить, сколько кусков успеть за кадр экрана. */
  tilePixels(pixels: number): number {
    return pixels / (this.tracer.tiles.x * this.tracer.tiles.y)
  }

  /** Посчитать n кусков кадра; на холст — один раз, в конце. */
  step(n = 1) {
    const t = this.tracer
    t.renderToCanvas = false
    for (let i = 1; i < n; i++) t.renderSample()
    t.renderToCanvas = true
    t.renderSample()
  }

  /**
   * Готовое фото на холст: накопленный кадр через сглаживание шума. Чем
   * меньше проходов успели, тем сильнее сглаживаем; края и рисунок камня
   * остаются — сглаживание не переходит через резкую смену цвета.
   */
  showFinal() {
    const target = this.tracer.target
    const d = this.denoise.material as DenoiseMaterial
    const spp = this.tracer.samples
    d.sigma = spp < 96 ? 3.4 : spp < 200 ? 2.8 : 2.2
    d.threshold = spp < 96 ? 0.12 : spp < 200 ? 0.09 : 0.06
    d.map = target.texture
    const r = this.renderer
    const auto = r.autoClear
    r.autoClear = false
    r.setRenderTarget(null)
    this.denoise.render(r)
    r.autoClear = auto
  }

  /** Камера сдвинулась или изменился размер кадра — копим заново. */
  restart() {
    this.tracer.updateCamera()
  }

  dispose() {
    this.tracer.dispose()
    this.denoise.dispose()
    this.denoise.material.dispose()
    this.env.dispose()
  }
}
