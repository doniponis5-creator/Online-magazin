import * as THREE from 'three'

/**
 * Материалы рисуются прямо в браузере: дерево, мрамор, бетон, кирпич, кафель,
 * паркет. Картинки не скачиваются, поэтому сцена открывается быстро даже по
 * мобильному интернету. Случайность фиксированная — одна и та же кухня
 * выглядит одинаково у всех.
 */

function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hsl(hex: string) {
  const c = new THREE.Color(hex)
  const out = { h: 0, s: 0, l: 0 }
  c.getHSL(out)
  return out
}

function shade(hex: string, dl: number, ds = 0) {
  const { h, s, l } = hsl(hex)
  const c = new THREE.Color().setHSL(h, Math.min(1, Math.max(0, s + ds)), Math.min(1, Math.max(0, l + dl)))
  return `#${c.getHexString()}`
}

/**
 * Тот же цвет, но прозрачный: градиент «цвет → прозрачный чёрный» даёт
 * тёмный ободок, а «цвет → тот же цвет без плотности» — мягкое пятно.
 */
function clear(hex: string) {
  const c = new THREE.Color(hex)
  return `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},0)`
}

function canvas(w: number, h: number) {
  const el = document.createElement('canvas')
  el.width = w
  el.height = h
  return { el, ctx: el.getContext('2d')! }
}

/**
 * Во сколько раз текстуры детальнее базовых. На компьютере — 2 (крупный план
 * чёткий), на телефоне — 1, для маленьких превью стилей — 0,5: так хватает
 * памяти даже на iPhone, где у картинок в браузере жёсткий предел.
 */
let K = 2

/** Сменить детальность; возвращает прежнюю, чтобы вернуть её после сборки. */
export function detail(k: number): number {
  const prev = K
  K = k
  return prev
}

/**
 * Готовые картинки и их копии с масштабом. Копия с масштабом загружается в
 * видеокарту один раз и служит всем следующим сборкам кухни — без этого каждая
 * смена цвета заново грузила бы десятки мегабайт. Давно не нужные картинки
 * выбрасываются, когда занято больше `budget`.
 */
type Entry = { tex: THREE.Texture; bytes: number; scaled: Map<string, THREE.Texture> }
const cache = new Map<string, Entry>()
const owner = new WeakMap<THREE.Texture, Entry>()
let budget = 420e6

export function setBudget(bytes: number) {
  budget = bytes
}

function finish(el: HTMLCanvasElement, _key: string, color = true): THREE.Texture {
  const tex = new THREE.CanvasTexture(el)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.anisotropy = 16
  if (color) tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function memo(key: string, make: () => THREE.Texture): THREE.Texture {
  const k = `${key}@${K}`
  const hit = cache.get(k)
  if (hit) {
    // свежесть: недавно нужная картинка уходит в конец очереди на выброс
    cache.delete(k)
    cache.set(k, hit)
    return hit.tex
  }
  const tex = make()
  const img = tex.image as HTMLCanvasElement
  const entry: Entry = { tex, bytes: img.width * img.height * 4 * 1.34, scaled: new Map() }
  cache.set(k, entry)
  owner.set(tex, entry)
  prune()
  return tex
}

function prune() {
  let total = 0
  for (const e of cache.values()) total += e.bytes
  for (const [k, e] of cache) {
    if (total <= budget || cache.size <= 8) break
    cache.delete(k)
    for (const t of e.scaled.values()) t.dispose()
    e.scaled.clear()
    total -= e.bytes
  }
}

/**
 * Копия картинки с масштабом: UV в метрах, поэтому повтор — «сколько метров
 * покрывает одна картинка». mirror — зеркальный повтор без шва, turn — поворот
 * на 90° (волокно вдоль столешницы).
 */
export function scaled(tex: THREE.Texture, meters: number, mirror = false, turn = false): THREE.Texture {
  const entry = owner.get(tex)
  const key = `${meters}|${mirror}|${turn}`
  const hit = entry?.scaled.get(key)
  if (hit) return hit
  const t = tex.clone()
  t.needsUpdate = true
  t.repeat.set(1 / meters, 1 / meters)
  if (turn) t.rotation = Math.PI / 2
  if (mirror) {
    t.wrapS = THREE.MirroredRepeatWrapping
    t.wrapT = THREE.MirroredRepeatWrapping
  }
  entry?.scaled.set(key, t)
  return t
}

/** Мелкий шум поверх заливки — чтобы поверхность не выглядела пластиком. */
function noise(ctx: CanvasRenderingContext2D, w: number, h: number, amount: number, seed: number) {
  const r = rng(seed)
  const img = ctx.getImageData(0, 0, w, h)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    const n = (r() - 0.5) * amount
    d[i] += n
    d[i + 1] += n
    d[i + 2] += n
  }
  ctx.putImageData(img, 0, 0)
}

/** Древесина: волокна вдоль высоты. Текстура покрывает ~1 м. */
export function wood(base: string, seed = 7): THREE.Texture {
  return memo(`wood:${base}:${seed}`, () => {
    const W = 512 * K
    const H = 1024 * K
    const { el, ctx } = canvas(W, H)
    const r = rng(seed)
    ctx.fillStyle = base
    ctx.fillRect(0, 0, W, H)
    // широкие полосы тона — разные доски шпона
    for (let x = 0; x < W; ) {
      const bw = (60 + r() * 120) * K
      ctx.fillStyle = shade(base, (r() - 0.5) * 0.05)
      ctx.globalAlpha = 0.35
      ctx.fillRect(x, 0, bw, H)
      x += bw
    }
    ctx.globalAlpha = 1
    // волокна
    for (let i = 0; i < 520 * K; i++) {
      const x0 = r() * W
      const dark = r() < 0.6
      ctx.strokeStyle = shade(base, dark ? -0.08 - r() * 0.08 : 0.05 + r() * 0.04)
      ctx.globalAlpha = 0.12 + r() * 0.25
      ctx.lineWidth = (0.6 + r() * 1.8) * K * 0.75
      ctx.beginPath()
      const amp = (2 + r() * 6) * K
      const freq = (0.004 + r() * 0.01) / K
      const ph = r() * 10
      for (let y = 0; y <= H; y += 16) {
        const x = x0 + Math.sin(y * freq + ph) * amp + Math.sin((y * 0.031) / K + ph * 2) * 1.2 * K
        if (y === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
    // «катедраль» — дуги годичных колец
    for (let k = 0; k < 6; k++) {
      const cx = r() * W
      const cy = r() * H
      for (let j = 0; j < 7; j++) {
        ctx.strokeStyle = shade(base, -0.08)
        ctx.globalAlpha = 0.06
        ctx.lineWidth = 1.2 * K
        ctx.beginPath()
        ctx.ellipse(cx, cy + j * 14 * K, (8 + j * 5) * K, (70 + j * 16) * K, 0, Math.PI * 1.1, Math.PI * 1.9)
        ctx.stroke()
      }
    }
    ctx.globalAlpha = 1
    noise(ctx, W, H, 10, seed)
    return finish(el, `wood:${base}:${seed}`)
  })
}

/**
 * Мрамор: прожилки случайным блужданием с размытием. bold > 1 — прожилки
 * крупнее и заметнее (керамика под мрамор на фасадах видна издалека).
 */
export function marble(base: string, vein: string, seed = 3, bold = 1): THREE.Texture {
  return memo(`marble:${base}:${vein}:${seed}:${bold}`, () => {
    const S = 1024 * K
    const { el, ctx } = canvas(S, S)
    const r = rng(seed)
    ctx.fillStyle = base
    ctx.fillRect(0, 0, S, S)
    // облака
    for (let i = 0; i < 26; i++) {
      const x = r() * S
      const y = r() * S
      const g = ctx.createRadialGradient(x, y, 0, x, y, (160 + r() * 260) * K)
      const tint = shade(base, (r() - 0.5) * 0.035)
      g.addColorStop(0, tint)
      g.addColorStop(1, clear(tint))
      ctx.fillStyle = g
      ctx.globalAlpha = 0.3
      ctx.fillRect(0, 0, S, S)
    }
    const walk = (width: number, alpha: number, blur: number, steps: number) => {
      ctx.filter = `blur(${blur * K}px)`
      ctx.strokeStyle = vein
      ctx.globalAlpha = alpha
      ctx.lineWidth = width * K
      ctx.beginPath()
      let x = r() * S
      let y = -20
      let a = Math.PI / 2 + (r() - 0.5) * 0.9
      ctx.moveTo(x, y)
      for (let i = 0; i < steps; i++) {
        a += (r() - 0.5) * 0.5
        a = Math.PI / 2 + Math.max(-0.9, Math.min(0.9, a - Math.PI / 2))
        x += Math.cos(a) * 12 * K
        y += Math.sin(a) * 12 * K
        ctx.lineTo(x, y)
        if (r() < 0.04) {
          ctx.stroke()
          ctx.lineWidth = width * K * (0.4 + r() * 0.9)
          ctx.beginPath()
          ctx.moveTo(x, y)
        }
      }
      ctx.stroke()
    }
    for (let i = 0; i < 3; i++) walk((8 + r() * 6) * bold, Math.min(0.2, 0.1 * bold), 8 * bold, 110)
    for (let i = 0; i < 6; i++) walk((1.2 + r() * 1.6) * bold, Math.min(0.75, 0.42 * Math.sqrt(bold)), 0.7 * bold, 100)
    for (let i = 0; i < 12; i++) walk(0.5 * Math.sqrt(bold), 0.3, 0.3, 60)
    ctx.filter = 'none'
    ctx.globalAlpha = 1
    noise(ctx, S, S, 5, seed)
    return finish(el, `marble:${base}:${vein}:${seed}:${bold}`)
  })
}

/**
 * Керамогранит под мрамор 60×120 см — такой кладут на кухнях чаще всего.
 * Текстура = 1,2 × 1,2 м: две плиты по 60 см в ряд, швы тонкие, в тон камню.
 */
export function marbleTile(base: string, vein: string): THREE.Texture {
  return memo(`marbleTile:${base}:${vein}`, () => {
    const src = marble(base, vein, 17).image as HTMLCanvasElement
    const S = src.width
    const { el, ctx } = canvas(S, S)
    ctx.drawImage(src, 0, 0)
    ctx.fillStyle = shade(base, -0.14)
    const g = Math.max(2, Math.round(1.5 * K))
    ctx.fillRect(0, 0, g, S)
    ctx.fillRect(S / 2 - g / 2, 0, g, S)
    ctx.fillRect(0, 0, S, g)
    return finish(el, `marbleTile:${base}:${vein}`)
  })
}

/** Кварц: ровный тон и мелкая крошка. */
export function speckle(base: string, fleck: string, density: number, seed = 11): THREE.Texture {
  return memo(`speckle:${base}:${fleck}:${density}`, () => {
    const S = 512
    const { el, ctx } = canvas(S, S)
    const r = rng(seed)
    ctx.fillStyle = base
    ctx.fillRect(0, 0, S, S)
    for (let i = 0; i < S * S * density; i++) {
      ctx.fillStyle = r() < 0.5 ? fleck : shade(base, (r() - 0.5) * 0.2)
      ctx.globalAlpha = 0.25 + r() * 0.6
      const s = 0.6 + r() * 1.6
      ctx.fillRect(r() * S, r() * S, s, s)
    }
    ctx.globalAlpha = 1
    noise(ctx, S, S, 6, seed)
    return finish(el, `speckle:${base}:${fleck}:${density}`)
  })
}

/**
 * Бетон и микроцемент: мягкие облака тона, мелкая рябь и редкие поры.
 * Пятна не должны читаться отдельными кругами — поэтому контраст низкий,
 * а облака крупные и рисуются с повтором через край (текстура бесшовная).
 */
export function concrete(base: string, seed = 5): THREE.Texture {
  return memo(`concrete:${base}:${seed}`, () => {
    const S = 1024 * K
    const { el, ctx } = canvas(S, S)
    const r = rng(seed)
    ctx.fillStyle = base
    ctx.fillRect(0, 0, S, S)
    const cloud = (count: number, rMin: number, rMax: number, amount: number, alpha: number) => {
      for (let i = 0; i < count; i++) {
        const x = r() * S
        const y = r() * S
        const rad = (rMin + r() * (rMax - rMin)) * K
        const color = shade(base, (r() - 0.5) * amount)
        // рисуем и со сдвигом на размер текстуры — у краёв нет шва
        for (const dx of [-S, 0, S]) {
          for (const dy of [-S, 0, S]) {
            const cx = x + dx
            const cy = y + dy
            if (cx + rad < 0 || cx - rad > S || cy + rad < 0 || cy - rad > S) continue
            const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad)
            g.addColorStop(0, color)
            g.addColorStop(1, clear(color))
            ctx.fillStyle = g
            ctx.globalAlpha = alpha
            ctx.fillRect(cx - rad, cy - rad, rad * 2, rad * 2)
          }
        }
      }
    }
    cloud(14, 260, 520, 0.05, 0.5)
    cloud(160, 30, 90, 0.035, 0.28)
    // поры
    ctx.globalAlpha = 0.28
    for (let i = 0; i < 1600 * K; i++) {
      ctx.fillStyle = shade(base, -0.12 - r() * 0.08)
      ctx.beginPath()
      ctx.arc(r() * S, r() * S, (0.35 + r() * 1.1) * K, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
    noise(ctx, S, S, 9, seed)
    return finish(el, `concrete:${base}:${seed}`)
  })
}

/**
 * Плитка и кирпич: сетка с швами. `tileW`/`tileH` — размер элемента в
 * пикселях; текстура покрывает `meters` по ширине — масштаб задаёт материал.
 */
function grid(
  key: string,
  opts: {
    W: number
    H: number
    tileW: number
    tileH: number
    grout: number
    groutColor: string
    color: () => string
    offset: number
    bevel: number
    seed: number
  },
): THREE.Texture {
  return memo(key, () => {
    const { el, ctx } = canvas(opts.W, opts.H)
    const r = rng(opts.seed)
    ctx.fillStyle = opts.groutColor
    ctx.fillRect(0, 0, opts.W, opts.H)
    const rows = Math.round(opts.H / opts.tileH)
    for (let row = 0; row < rows; row++) {
      const shift = row % 2 ? opts.offset * opts.tileW : 0
      for (let x = -opts.tileW; x < opts.W + opts.tileW; x += opts.tileW) {
        const tx = x + shift + opts.grout / 2
        const ty = row * opts.tileH + opts.grout / 2
        const tw = opts.tileW - opts.grout
        const th = opts.tileH - opts.grout
        const c = opts.color()
        ctx.fillStyle = c
        ctx.fillRect(tx, ty, tw, th)
        if (opts.bevel > 0) {
          const g = ctx.createLinearGradient(tx, ty, tx, ty + th)
          g.addColorStop(0, 'rgba(255,255,255,0.35)')
          g.addColorStop(0.18, 'rgba(255,255,255,0)')
          g.addColorStop(0.82, 'rgba(0,0,0,0)')
          g.addColorStop(1, 'rgba(0,0,0,0.18)')
          ctx.fillStyle = g
          ctx.fillRect(tx, ty, tw, th)
        }
        // пятна глазури / обжига
        for (let k = 0; k < 3; k++) {
          ctx.fillStyle = shade(c, (r() - 0.5) * 0.08)
          ctx.globalAlpha = 0.35
          ctx.beginPath()
          ctx.ellipse(tx + r() * tw, ty + r() * th, tw * (0.1 + r() * 0.3), th * (0.1 + r() * 0.3), r() * 3, 0, Math.PI * 2)
          ctx.fill()
          ctx.globalAlpha = 1
        }
      }
    }
    noise(ctx, opts.W, opts.H, 8, opts.seed)
    return finish(el, key)
  })
}

/** «Кабанчик» 15×7,5 см; текстура = 60×60 см. */
export function subway(color: string): THREE.Texture {
  const r = rng(21)
  return grid(`subway:${color}`, {
    W: 512,
    H: 512,
    tileW: 128,
    tileH: 64,
    grout: 4,
    groutColor: shade(color, -0.12),
    color: () => shade(color, (r() - 0.5) * 0.025),
    offset: 0.5,
    bevel: 1,
    seed: 21,
  })
}

/** Ручная плитка 10×10 см с неровной глазурью; текстура = 60×60 см. */
export function zellige(color: string): THREE.Texture {
  const r = rng(31)
  return grid(`zellige:${color}`, {
    W: 600,
    H: 600,
    tileW: 100,
    tileH: 100,
    grout: 4,
    groutColor: shade(color, -0.1),
    color: () => shade(color, (r() - 0.5) * 0.09, (r() - 0.5) * 0.05),
    offset: 0,
    bevel: 1,
    seed: 31,
  })
}

/** Кирпич 25×6,5 см; текстура = 1 м × 0,5 м. */
export function brick(color: string): THREE.Texture {
  const r = rng(41)
  return grid(`brick:${color}`, {
    W: 1000,
    H: 500,
    tileW: 250,
    tileH: 76,
    grout: 10,
    groutColor: '#b9b0a4',
    color: () => {
      const k = r()
      // обычный кирпич, изредка тёмный (пережжённый) или светлый
      return shade(color, k < 0.12 ? -0.1 - r() * 0.06 : k > 0.9 ? 0.07 : (r() - 0.5) * 0.08, -0.08 + (r() - 0.5) * 0.08)
    },
    offset: 0.5,
    bevel: 0,
    seed: 41,
  })
}

/** Керамогранит 60×60 см; текстура = 1,2 × 1,2 м. */
export function floorTile(color: string): THREE.Texture {
  const r = rng(51)
  return grid(`tile:${color}`, {
    W: 1024,
    H: 1024,
    tileW: 512,
    tileH: 512,
    grout: 3,
    groutColor: shade(color, -0.14),
    color: () => shade(color, (r() - 0.5) * 0.03),
    offset: 0,
    bevel: 0,
    seed: 51,
  })
}

/** Паркетная доска: длинные доски 18 см; текстура = 1,44 × 1,44 м. */
export function planks(base: string, seed = 61): THREE.Texture {
  return memo(`planks:${base}`, () => {
    const S = 1024 * K
    const { el, ctx } = canvas(S, S)
    const r = rng(seed)
    const grain = wood(base, seed).image as HTMLCanvasElement
    const pw = 128 * K
    for (let col = 0; col < S / pw; col++) {
      let y = -r() * 600 * K
      while (y < S) {
        const len = (500 + r() * 500) * K
        ctx.save()
        ctx.beginPath()
        ctx.rect(col * pw, y, pw, len)
        ctx.clip()
        ctx.drawImage(grain, r() * -300 * K, r() * -400 * K, 512 * K, 1024 * K * 1.4)
        ctx.fillStyle = shade(base, (r() - 0.5) * 0.045)
        ctx.globalAlpha = 0.3
        ctx.fillRect(col * pw, y, pw, len)
        ctx.restore()
        ctx.globalAlpha = 0.6
        ctx.fillStyle = shade(base, -0.25)
        ctx.fillRect(col * pw, y, pw, 2 * K)
        ctx.fillRect(col * pw, y, 2 * K, len)
        ctx.globalAlpha = 1
        y += len
      }
    }
    return finish(el, `planks:${base}`)
  })
}

/**
 * Ёлочка: планки 60×15 см. Узор повторяется по векторам (W, W) и (L, −L);
 * после поворота на 45° это прямоугольник √2·W × √2·L, поэтому L подобрана
 * так, чтобы текстура складывалась без шва. Текстура ≈ 1,7 × 1,7 м.
 */
export function herringbone(base: string, seed = 71): THREE.Texture {
  return memo(`herring:${base}`, () => {
    const S = 1024 * K
    const L = S / 2 / Math.SQRT2
    const W = L / 4
    const { el, ctx } = canvas(S, S)
    const r = rng(seed)
    ctx.fillStyle = shade(base, -0.22)
    ctx.fillRect(0, 0, S, S)
    ctx.save()
    ctx.translate(S / 2, S / 2)
    ctx.rotate(-Math.PI / 4)
    const plank = (x: number, y: number, w: number, h: number, along: 'x' | 'y') => {
      const c = shade(base, (r() - 0.5) * 0.1, (r() - 0.5) * 0.04)
      ctx.fillStyle = c
      ctx.fillRect(x + 1, y + 1, w - 2, h - 2)
      ctx.save()
      ctx.beginPath()
      ctx.rect(x + 1, y + 1, w - 2, h - 2)
      ctx.clip()
      for (let i = 0; i < 14; i++) {
        ctx.strokeStyle = shade(c, r() < 0.6 ? -0.07 : 0.05)
        ctx.globalAlpha = 0.25 + r() * 0.3
        ctx.lineWidth = (0.6 + r() * 1.4) * K
        ctx.beginPath()
        const off = r()
        if (along === 'x') {
          const yy = y + off * h
          ctx.moveTo(x, yy)
          ctx.bezierCurveTo(x + w * 0.3, yy + (r() - 0.5) * 6, x + w * 0.7, yy + (r() - 0.5) * 6, x + w, yy)
        } else {
          const xx = x + off * w
          ctx.moveTo(xx, y)
          ctx.bezierCurveTo(xx + (r() - 0.5) * 6, y + h * 0.3, xx + (r() - 0.5) * 6, y + h * 0.7, xx, y + h)
        }
        ctx.stroke()
      }
      ctx.globalAlpha = 1
      ctx.restore()
    }
    const reach = Math.ceil(S / W) + 4
    for (let m = -8; m <= 8; m++) {
      for (let k = -reach; k <= reach; k++) {
        const ox = m * L + k * W
        const oy = -m * L + k * W
        if (Math.abs(ox) > S * 1.2 || Math.abs(oy) > S * 1.2) continue
        plank(ox, oy, L, W, 'x')
        plank(ox, oy + W, W, L, 'y')
      }
    }
    ctx.restore()
    noise(ctx, S, S, 7, seed)
    return finish(el, `herring:${base}`)
  })
}

/**
 * Фактура крашеного фасада: мелкое неровное «зерно» в шероховатости. Без
 * неё матовая краска выглядит пластиком из компьютерной игры.
 */
export function grain(): THREE.Texture {
  return memo('grain', () => {
    const S = 256
    const { el, ctx } = canvas(S, S)
    ctx.fillStyle = '#9a9a9a'
    ctx.fillRect(0, 0, S, S)
    const r = rng(101)
    for (let i = 0; i < 90; i++) {
      const x = r() * S
      const y = r() * S
      const g = ctx.createRadialGradient(x, y, 0, x, y, 10 + r() * 40)
      g.addColorStop(0, r() < 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)')
      g.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, S, S)
    }
    noise(ctx, S, S, 26, 103)
    return finish(el, 'grain', false)
  })
}

/** Рельеф рифлёного фасада: вертикальные желобки (карта высот, 1 шаг = 1 рейка). */
export function flutes(): THREE.Texture {
  return memo('flutes', () => {
    const W = 64
    const { el, ctx } = canvas(W, 4)
    for (let x = 0; x < W; x++) {
      const v = Math.round(255 * Math.pow(Math.sin((Math.PI * (x + 0.5)) / W), 0.6))
      ctx.fillStyle = `rgb(${v},${v},${v})`
      ctx.fillRect(x, 0, 1, 4)
    }
    return finish(el, 'flutes', false)
  })
}

/** Крашеная стена: почти ровная, с лёгкой фактурой валика. */
export function paint(base: string): THREE.Texture {
  return memo(`paint:${base}`, () => {
    const S = 256
    const { el, ctx } = canvas(S, S)
    ctx.fillStyle = base
    ctx.fillRect(0, 0, S, S)
    noise(ctx, S, S, 5, 91)
    return finish(el, `paint:${base}`)
  })
}

/** Варочная поверхность: конфорки на чёрном стекле. */
export function hobTop(kind: 'electric' | 'induction' | 'gas', burners: number, finishColor: string): THREE.Texture {
  return memo(`hob:${kind}:${burners}:${finishColor}`, () => {
    const W = 600
    const H = 520
    const { el, ctx } = canvas(W, H)
    ctx.fillStyle = finishColor
    ctx.fillRect(0, 0, W, H)
    const spots: [number, number, number][] =
      burners <= 2
        ? [[W / 2, H * 0.3, 95], [W / 2, H * 0.72, 80]]
        : burners === 3
          ? [[W * 0.3, H * 0.32, 95], [W * 0.3, H * 0.72, 75], [W * 0.72, H * 0.5, 110]]
          : [[W * 0.28, H * 0.3, 95], [W * 0.28, H * 0.72, 75], [W * 0.72, H * 0.3, 75], [W * 0.72, H * 0.72, 100]]
    for (const [x, y, rad] of spots) {
      if (kind === 'gas') {
        ctx.fillStyle = '#2a2b2d'
        ctx.beginPath()
        ctx.arc(x, y, rad * 0.55, 0, Math.PI * 2)
        ctx.fill()
        continue
      }
      ctx.strokeStyle = kind === 'induction' ? 'rgba(210,210,210,0.55)' : 'rgba(170,170,170,0.5)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(x, y, rad, 0, Math.PI * 2)
      ctx.stroke()
      if (kind === 'electric') {
        ctx.beginPath()
        ctx.arc(x, y, rad * 0.62, 0, Math.PI * 2)
        ctx.stroke()
      } else {
        for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
          ctx.beginPath()
          ctx.moveTo(x + dx * rad * 0.9, y + dy * rad * 0.9)
          ctx.lineTo(x + dx * rad * 1.08, y + dy * rad * 1.08)
          ctx.stroke()
        }
      }
    }
    // сенсорная панель
    ctx.fillStyle = 'rgba(200,200,200,0.55)'
    for (let i = 0; i < 6; i++) {
      ctx.beginPath()
      ctx.arc(W * 0.3 + i * 42, H * 0.93, 5, 0, Math.PI * 2)
      ctx.fill()
    }
    return finish(el, `hob:${kind}:${burners}:${finishColor}`)
  })
}

/** Небо за окном: мягкий градиент, днём светлый, вечером сумеречный. */
export function sky(evening: boolean): THREE.Texture {
  return memo(`sky:${evening}`, () => {
    const { el, ctx } = canvas(16, 256)
    const g = ctx.createLinearGradient(0, 0, 0, 256)
    if (evening) {
      g.addColorStop(0, '#1d2a44')
      g.addColorStop(0.7, '#4a4f6b')
      g.addColorStop(1, '#c98a5e')
    } else {
      g.addColorStop(0, '#bcd6f2')
      g.addColorStop(0.75, '#e9f1f8')
      g.addColorStop(1, '#fbf7ee')
    }
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 16, 256)
    return finish(el, `sky:${evening}`)
  })
}
