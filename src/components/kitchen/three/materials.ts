import * as THREE from 'three'
import type { FrontColor, TopChoice } from '@/lib/kitchen/finishes'
import type { FrontTexture, KitchenStyle, Metal, Tone } from '@/lib/kitchen/styles'
import type { Finish, FloorKind } from '@/lib/kitchen/types'
import * as T from './textures'

/**
 * Материалы одной кухни. UV геометрии заданы в метрах (см. parts.box), поэтому
 * у текстуры повтор — «сколько метров покрывает одна картинка».
 */

const scaled = T.scaled

export type Mats = ReturnType<typeof createMaterials>

/** Комната покупателя: свой пол и цвет стен вместо заданных стилем. */
export type RoomLook = { floor?: FloorKind; wall?: string | null }

/** Отделка из каталога вместо цвета стиля: фасады низа и верха, столешница. */
/** upper: 'style' — верх в цвете стиля, даже если низ из каталога (двухцветная кухня) */
export type FinishLook = { facade?: FrontColor; upper?: FrontColor | 'style'; top?: TopChoice }

export function createMaterials(style: KitchenStyle, tone: Tone, evening: boolean, room: RoomLook = {}, finish: FinishLook = {}) {
  const owned: THREE.Material[] = []
  const keep = <M extends THREE.Material>(m: M) => {
    owned.push(m)
    return m
  }
  // Картинки живут в общем кэше (textures.ts) и переходят к следующей сборке.
  const tex = (t: THREE.Texture) => t

  const roughness = THREE.MathUtils.lerp(0.62, 0.1, style.gloss)
  // Матовая краска — с живой фактурой; глянец и шпон — без неё.
  const paintGrain = style.gloss < 0.5 ? tex(scaled(T.grain(), 0.35)) : null
  const front = (color: string, texture?: FrontTexture) => {
    // Бетон — матовая шершавая плита; керамика под мрамор — полированный камень.
    if (texture === 'concrete') {
      return keep(new THREE.MeshStandardMaterial({ map: tex(scaled(T.concrete(color, 17), 1.3, true)), roughness: 0.84 }))
    }
    if (texture === 'stone') {
      const st = tone.stone ?? { base: color, vein: '#9a948b' }
      return keep(
        new THREE.MeshPhysicalMaterial({
          map: tex(scaled(T.marble(st.base, st.vein, 21, 2.2), 1.8, true)),
          roughness: 0.16,
          clearcoat: 0.85,
          clearcoatRoughness: 0.06,
        }),
      )
    }
    const woodGrain = texture === 'wood'
    const woodMap = woodGrain ? tex(scaled(T.wood(color), 1, true)) : null
    return keep(
      new THREE.MeshPhysicalMaterial({
        color: woodGrain ? '#ffffff' : color,
        map: woodMap,
        // волокна чуть рельефны — дерево не выглядит напечатанным
        bumpMap: woodMap,
        bumpScale: 0.45,
        roughness: woodGrain ? 0.55 : roughness,
        roughnessMap: woodGrain ? null : paintGrain,
        clearcoat: style.gloss > 0.5 ? 1 : style.gloss > 0.1 ? 0.25 : 0,
        clearcoatRoughness: style.gloss > 0.5 ? 0.04 : 0.4,
        sheen: style.gloss < 0.08 ? 0.35 : 0,
        sheenRoughness: 0.8,
        sheenColor: new THREE.Color(color).multiplyScalar(0.4),
      }),
    )
  }

  /**
   * Фасад из каталога: материал ведёт себя как настоящий. Акрил — зеркальный
   * глянец с отражениями, Fenix — бархатный мат, эмаль — полуматовая краска,
   * ламинат — матовый (или с рисунком дерева и бетона), шпон — дерево под лаком.
   */
  const catalogFront = (c: FrontColor) => {
    const grain = tex(scaled(T.grain(), 0.35))
    switch (c.material) {
      case 'acrylic':
        return keep(new THREE.MeshPhysicalMaterial({ color: c.color, roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.015, reflectivity: 0.65 }))
      case 'fenix':
        return keep(
          new THREE.MeshPhysicalMaterial({ color: c.color, roughness: 0.95, sheen: 0.3, sheenRoughness: 0.95, sheenColor: new THREE.Color(c.color).multiplyScalar(0.5) }),
        )
      case 'enamel':
        return keep(new THREE.MeshPhysicalMaterial({ color: c.color, roughness: 0.42, roughnessMap: grain, clearcoat: 0.18, clearcoatRoughness: 0.5 }))
      case 'veneer': {
        const map = tex(scaled(T.wood(c.color, 31), 1, true))
        return keep(new THREE.MeshPhysicalMaterial({ map, bumpMap: map, bumpScale: 0.6, roughness: 0.46, clearcoat: 0.3, clearcoatRoughness: 0.35 }))
      }
      case 'laminate':
        if (c.texture === 'wood') {
          const map = tex(scaled(T.wood(c.color, 41), 1, true))
          return keep(new THREE.MeshStandardMaterial({ map, bumpMap: map, bumpScale: 0.35, roughness: 0.6 }))
        }
        if (c.texture === 'concrete') return keep(new THREE.MeshStandardMaterial({ map: tex(scaled(T.concrete(c.color, 17), 1.3, true)), roughness: 0.82 }))
        return keep(new THREE.MeshStandardMaterial({ color: c.color, roughness: 0.58, roughnessMap: grain }))
    }
  }

  const facade = finish.facade ? catalogFront(finish.facade) : front(tone.facade, tone.texture)
  // Рифлёная версия того же материала: рельеф реек, 3 см шаг.
  const flutedCache = new Map<THREE.Material, THREE.Material>()
  const fluted = (base: THREE.Material): THREE.Material => {
    const found = flutedCache.get(base)
    if (found) return found
    const m = (base as THREE.MeshPhysicalMaterial).clone()
    m.bumpMap = tex(scaled(T.flutes(), 0.03))
    m.bumpScale = 1.6
    keep(m)
    flutedCache.set(base, m)
    return m
  }
  // Верх: свой цвет из каталога; иначе — как низ из каталога; иначе — по стилю.
  const styleUpper = () => (tone.upper ? front(tone.upper, tone.upperTexture) : finish.facade ? front(tone.facade, tone.texture) : facade)
  const upper =
    finish.upper === 'style' ? styleUpper() : finish.upper ? catalogFront(finish.upper) : finish.facade ? facade : tone.upper ? front(tone.upper, tone.upperTexture) : facade
  /** у фасада своя фактура — рисунок надо сдвигать от дверцы к дверце */
  const texturedOf = (c: FrontColor | undefined, t: FrontTexture | undefined) => (c ? Boolean(c.texture) || c.material === 'veneer' : Boolean(t))
  const textured = texturedOf(finish.facade, tone.texture)
  const upperTextured =
    finish.upper === 'style'
      ? Boolean(tone.upper ? tone.upperTexture : tone.texture)
      : finish.upper
        ? texturedOf(finish.upper, undefined)
        : finish.facade
          ? textured
          : tone.upper
            ? Boolean(tone.upperTexture)
            : textured

  const catalogTop = (c: TopChoice) => {
    const { look } = c
    const roughness = THREE.MathUtils.lerp(0.62, 0.08, look.gloss)
    const coat = look.gloss > 0.5 ? { clearcoat: 0.9, clearcoatRoughness: 0.05 } : { clearcoat: look.gloss * 0.6, clearcoatRoughness: 0.3 }
    switch (look.pattern) {
      case 'marble':
        return keep(new THREE.MeshPhysicalMaterial({ map: tex(scaled(T.marble(look.base, look.vein ?? '#8d8a86', 9, 1.5), 1.6, true)), roughness, ...coat }))
      case 'speckle':
        return keep(new THREE.MeshPhysicalMaterial({ map: tex(scaled(T.speckle(look.base, look.vein ?? '#888', 0.04), 0.6)), roughness, ...coat }))
      case 'concrete':
        return keep(new THREE.MeshPhysicalMaterial({ map: tex(scaled(T.concrete(look.base, 11), 1.4, true)), roughness, ...coat }))
      case 'wood':
        return keep(new THREE.MeshPhysicalMaterial({ map: tex(scaled(T.wood(look.base, 23), 1.2, true, true)), roughness, ...coat }))
      case 'solid':
        return keep(new THREE.MeshPhysicalMaterial({ color: look.base, roughness, ...coat }))
    }
  }

  const top = finish.top ? catalogTop(finish.top) : (() => {
    switch (style.top) {
      case 'marbleWhite':
        return keep(new THREE.MeshPhysicalMaterial({ map: tex(scaled(T.marble('#f3f1ed', '#8d8a86'), 1.6, true)), roughness: 0.18, clearcoat: 0.6, clearcoatRoughness: 0.12 }))
      case 'marbleBlack':
        return keep(new THREE.MeshPhysicalMaterial({ map: tex(scaled(T.marble('#18181a', '#c2a26b', 13), 1.6, true)), roughness: 0.14, clearcoat: 0.9, clearcoatRoughness: 0.06 }))
      case 'marbleDark':
        return keep(new THREE.MeshPhysicalMaterial({ map: tex(scaled(T.marble('#4b3b31', '#cdb899', 9), 1.6, true)), roughness: 0.2, clearcoat: 0.7, clearcoatRoughness: 0.1 }))
      case 'quartzLight':
        return keep(new THREE.MeshStandardMaterial({ map: tex(scaled(T.speckle('#e7e4de', '#b9b4ab', 0.05), 0.6)), roughness: 0.42 }))
      case 'quartzBlack':
        return keep(new THREE.MeshPhysicalMaterial({ map: tex(scaled(T.speckle('#131416', '#8b8d91', 0.02), 0.6)), roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.05 }))
      case 'concrete':
        return keep(new THREE.MeshStandardMaterial({ map: tex(scaled(T.concrete('#9d9b96'), 1.4, true)), roughness: 0.78 }))
      case 'oak':
        return keep(new THREE.MeshStandardMaterial({ map: tex(scaled(T.wood('#c49a6c', 23), 1.2, true, true)), roughness: 0.48 }))
      case 'travertine':
        return keep(new THREE.MeshPhysicalMaterial({ map: tex(scaled(T.marble('#d9ccb6', '#b7a283', 7, 1.2), 1.6, true)), roughness: 0.34, clearcoat: 0.3, clearcoatRoughness: 0.2 }))
      case 'stone': {
        const st = tone.stone ?? { base: '#f2f0ec', vein: '#8d8a86' }
        return keep(new THREE.MeshPhysicalMaterial({ map: tex(scaled(T.marble(st.base, st.vein, 9, 1.8), 1.6, true)), roughness: 0.14, clearcoat: 0.85, clearcoatRoughness: 0.06 }))
      }
    }
  })()

  const splash = (() => {
    switch (style.splash) {
      case 'marble':
        return keep(new THREE.MeshPhysicalMaterial({ map: tex(scaled(T.marble('#f3f1ed', '#8d8a86', 5), 1.2, true)), roughness: 0.15, clearcoat: 0.5 }))
      case 'subway':
        return keep(new THREE.MeshPhysicalMaterial({ map: tex(scaled(T.subway(style.splashColor), 0.6)), roughness: 0.18, clearcoat: 0.8, clearcoatRoughness: 0.1 }))
      case 'zellige':
        return keep(new THREE.MeshPhysicalMaterial({ map: tex(scaled(T.zellige(style.splashColor), 0.6)), roughness: 0.2, clearcoat: 0.9, clearcoatRoughness: 0.15 }))
      case 'brick':
        return keep(new THREE.MeshStandardMaterial({ map: tex(scaled(T.brick(style.splashColor), 1)), roughness: 0.9 }))
      case 'glass':
        return keep(new THREE.MeshPhysicalMaterial({ color: style.splashColor, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.02, metalness: 0 }))
      case 'slab':
        return top
      case 'stone':
        return keep(
          new THREE.MeshPhysicalMaterial({ map: tex(scaled(T.marble(style.splashColor, style.splashVein ?? '#8d8a86', 5, 1.4), 1.2, true)), roughness: 0.14, clearcoat: 0.7, clearcoatRoughness: 0.08 }),
        )
      case 'concrete':
        return keep(new THREE.MeshStandardMaterial({ map: tex(scaled(T.concrete(style.splashColor, 13), 1.3, true)), roughness: 0.8 }))
      case 'panel':
        return keep(new THREE.MeshStandardMaterial({ color: style.splashColor, roughness: 0.48 }))
      case 'paint':
        // фартука нет — ниже его не рисуем вовсе
        return top
    }
  })()

  const wallMap = tex(scaled(T.paint(room.wall ?? style.wall), 0.8))
  // лёгкая фактура штукатурки
  const wall = keep(new THREE.MeshStandardMaterial({ map: wallMap, bumpMap: wallMap, bumpScale: 0.5, roughness: 0.92 }))
  // Белый потолок светлый от отражённого света — чуть светится сам.
  const ceiling = keep(new THREE.MeshStandardMaterial({ color: '#f7f6f3', roughness: 0.95, emissive: '#f3f1ec', emissiveIntensity: evening ? 0.06 : 0.42 }))
  // На фото (трассировка лучей) потолок светлеет от настоящего отражённого света.
  ceiling.userData.photo = 'ceiling'
  // Лофт: стена за кухней — целиком кирпич.
  const featureWall = style.splash === 'brick' ? splash : wall

  /** Пол: швы досок и плитки чуть утоплены — рельеф из той же картинки. */
  const relief = <M extends THREE.MeshStandardMaterial>(m: M, scale: number) => {
    m.bumpMap = m.map
    m.bumpScale = scale
    return m
  }
  const floor = (() => {
    switch (room.floor ?? style.floor) {
      case 'herringbone':
        return relief(keep(new THREE.MeshStandardMaterial({ map: tex(scaled(T.herringbone('#b39374'), 1.25)), roughness: 0.55 })), 1.1)
      case 'herringboneDark':
        return relief(keep(new THREE.MeshStandardMaterial({ map: tex(scaled(T.herringbone('#5f4633'), 1.25)), roughness: 0.5 })), 1.1)
      case 'terracotta':
        return relief(keep(new THREE.MeshStandardMaterial({ map: tex(scaled(T.floorTile('#a9765c'), 0.6)), roughness: 0.72 })), 1.0)
      case 'oak':
        return relief(keep(new THREE.MeshStandardMaterial({ map: tex(scaled(T.planks('#c8a57f'), 1.44)), roughness: 0.6 })), 1.1)
      case 'darkOak':
        return relief(keep(new THREE.MeshStandardMaterial({ map: tex(scaled(T.planks('#6d5038'), 1.44)), roughness: 0.62 })), 1.1)
      case 'tile':
        return relief(keep(new THREE.MeshPhysicalMaterial({ map: tex(scaled(T.floorTile('#b9bcbf'), 1.2)), roughness: 0.3, clearcoat: 0.25 })), 0.9)
      case 'concrete':
        return relief(keep(new THREE.MeshStandardMaterial({ map: tex(scaled(T.concrete('#8f8e8a', 8), 2, true)), roughness: 0.7 })), 0.35)
      case 'marble':
        return relief(keep(new THREE.MeshPhysicalMaterial({ map: tex(scaled(T.marbleTile('#f1efeb', '#a9a49c'), 1.2)), roughness: 0.22, clearcoat: 0.35, clearcoatRoughness: 0.12 })), 0.5)
    }
  })()

  const metals = new Map<Metal, THREE.Material>()
  const metal = (kind: Metal): THREE.Material => {
    const found = metals.get(kind)
    if (found) return found
    const made = makeMetal(kind)
    metals.set(kind, made)
    return made
  }
  const makeMetal = (kind: Metal) => {
    switch (kind) {
      case 'brass':
        return keep(new THREE.MeshStandardMaterial({ color: '#c8a26a', metalness: 1, roughness: 0.28 }))
      case 'chrome':
        return keep(new THREE.MeshStandardMaterial({ color: '#eceef0', metalness: 1, roughness: 0.06 }))
      case 'black':
        return keep(new THREE.MeshStandardMaterial({ color: '#1d1e20', metalness: 0.55, roughness: 0.42 }))
      case 'steel':
        return keep(new THREE.MeshPhysicalMaterial({ color: '#e2e5e7', metalness: 0.75, roughness: 0.28, anisotropy: 0.6 }))
      case 'wood':
        return keep(new THREE.MeshStandardMaterial({ map: tex(scaled(T.wood('#c09062', 13), 0.3)), roughness: 0.5 }))
      case 'bronze':
        return keep(new THREE.MeshStandardMaterial({ color: '#7a6446', metalness: 0.9, roughness: 0.42 }))
      case 'gunmetal':
        return keep(new THREE.MeshStandardMaterial({ color: '#55595e', metalness: 0.85, roughness: 0.33 }))
    }
  }

  const handle = metal(style.handleMetal ?? style.metal)
  const leather = keep(new THREE.MeshStandardMaterial({ color: style.handleMetal === 'black' ? '#3a2a20' : '#8a5a3b', roughness: 0.62 }))
  const faucet = metal(style.faucet)
  const plinth =
    style.id === 'classic' || style.id === 'neoclassic'
      ? facade
      : style.metal === 'steel'
        ? metal('steel')
        : keep(new THREE.MeshStandardMaterial({ color: '#2b2c2e', roughness: 0.6 }))
  // Профиль Gola и рамки стеклянных фасадов — в цвет металла стиля.
  const trimMetal = metal(style.metal === 'wood' ? 'steel' : style.metal)
  const carcass = keep(new THREE.MeshStandardMaterial({ color: '#ebe7e0', roughness: 0.7 }))
  const sink =
    style.sink === 'steel'
      ? keep(new THREE.MeshPhysicalMaterial({ color: '#c9ccce', metalness: 1, roughness: 0.28, anisotropy: 0.5 }))
      : style.sink === 'white'
        ? keep(new THREE.MeshPhysicalMaterial({ color: '#f4f3f0', roughness: 0.2, clearcoat: 1 }))
        : keep(new THREE.MeshStandardMaterial({ color: '#2a2b2d', roughness: 0.5 }))
  const shelf = keep(new THREE.MeshStandardMaterial({ map: tex(scaled(T.wood(style.id === 'loft' ? '#7a5a3e' : '#c9a37a', 17), 1)), roughness: 0.55 }))
  const glass = keep(
    new THREE.MeshPhysicalMaterial({ color: '#dfe9ee', roughness: 0.02, metalness: 0, transparent: true, opacity: 0.22, depthWrite: false }),
  )
  const skyMat = keep(new THREE.MeshBasicMaterial({ map: T.sky(evening), toneMapped: false }))
  // на фото небо в окне светит в комнату по-настоящему, а стекло не даёт тени
  skyMat.userData.photo = 'sky'
  glass.userData.photo = 'glass'
  const trim = keep(
    new THREE.MeshStandardMaterial({ color: style.id === 'loft' ? '#1e1f21' : '#f6f6f4', roughness: style.id === 'loft' ? 0.5 : 0.35, metalness: style.id === 'loft' ? 0.4 : 0 }),
  )
  const led = keep(new THREE.MeshBasicMaterial({ color: evening ? '#fff1d6' : '#f3efe6', toneMapped: !evening }))
  led.userData.photo = 'lamp'
  const shade = keep(new THREE.MeshStandardMaterial({ color: '#555', roughness: 0.6 }))

  const finishes = new Map<Finish, THREE.Material>()
  const appliance = (finish: Finish): THREE.Material => {
    const found = finishes.get(finish)
    if (found) return found
    const m = (() => {
      switch (finish) {
        case 'black':
          return new THREE.MeshPhysicalMaterial({ color: '#0e0f11', roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.04 })
        case 'white':
          return new THREE.MeshPhysicalMaterial({ color: '#efefed', roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.2 })
        case 'inox':
          return new THREE.MeshPhysicalMaterial({ color: '#e4e6e8', metalness: 0.72, roughness: 0.3, anisotropy: 0.7 })
        case 'gray':
          return new THREE.MeshPhysicalMaterial({ color: '#5e6266', metalness: 0.55, roughness: 0.34, clearcoat: 0.5 })
        case 'beige':
          return new THREE.MeshPhysicalMaterial({ color: '#e3dac9', roughness: 0.3, clearcoat: 0.6 })
      }
    })()
    keep(m)
    finishes.set(finish, m)
    return m
  }
  // Внутри шкафов — светлый ЛДСП, как у настоящей мебели.
  const interior = keep(new THREE.MeshStandardMaterial({ color: '#eeebe5', roughness: 0.62 }))
  const inside = (color: string, roughness: number, metalness = 0) =>
    keep(new THREE.MeshStandardMaterial({ color, roughness, metalness, side: THREE.BackSide }))
  const enamel = inside('#1c1c1f', 0.35)
  const tub = keep(new THREE.MeshPhysicalMaterial({ color: '#d2d5d8', metalness: 0.85, roughness: 0.3, side: THREE.BackSide }))
  const fridgeInside = inside('#f4f5f6', 0.4)
  const plastic = keep(new THREE.MeshStandardMaterial({ color: '#f1f2f3', roughness: 0.4 }))
  const wire = keep(new THREE.MeshStandardMaterial({ color: '#9ea4a9', metalness: 0.8, roughness: 0.35 }))
  const ceramic = keep(new THREE.MeshPhysicalMaterial({ color: '#f5f3ef', roughness: 0.2, clearcoat: 0.8 }))
  const shelfGlass = keep(new THREE.MeshPhysicalMaterial({ color: '#dfeef0', roughness: 0.05, transparent: true, opacity: 0.35, depthWrite: false }))
  const vitrine = keep(new THREE.MeshPhysicalMaterial({ color: '#e7eff2', roughness: 0.03, transparent: true, opacity: 0.16, depthWrite: false, clearcoat: 1 }))
  const warm = keep(new THREE.MeshBasicMaterial({ color: '#ffcf8a', toneMapped: false }))
  warm.userData.photo = 'lamp'
  const darkGlass = keep(new THREE.MeshPhysicalMaterial({ color: '#07080a', roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.02 }))
  const rubber = keep(new THREE.MeshStandardMaterial({ color: '#17181a', roughness: 0.8 }))

  return {
    facade,
    upper,
    textured,
    upperTextured,
    trimMetal,
    fluted,
    top,
    splash,
    wall,
    featureWall,
    floor,
    handle,
    leather,
    ceiling,
    faucet,
    plinth,
    carcass,
    sink,
    shelf,
    glass,
    sky: skyMat,
    trim,
    led,
    shade,
    darkGlass,
    rubber,
    interior,
    enamel,
    tub,
    fridgeInside,
    plastic,
    wire,
    ceramic,
    shelfGlass,
    vitrine,
    warm,
    appliance,
    metal,
    /** своя копия с картинкой спереди — для фото техники */
    photo(map: THREE.Texture) {
      return keep(new THREE.MeshPhysicalMaterial({ map, roughness: 0.25, clearcoat: 0.6, clearcoatRoughness: 0.08 }))
    },
    plain(color: string, roughness = 0.6, metalness = 0) {
      return keep(new THREE.MeshStandardMaterial({ color, roughness, metalness }))
    },
    dispose() {
      for (const m of owned) m.dispose()
    },
  }
}
