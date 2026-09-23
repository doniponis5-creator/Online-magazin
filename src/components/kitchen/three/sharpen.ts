import { Vector2 } from 'three'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'

/**
 * Последний шаг кадра — прямо на экран:
 * 1) честное уменьшение: кадр рисуется в 1,5–3 раза крупнее экрана, и каждая
 *    точка экрана — среднее из всех точек под ней (браузер сам уменьшил бы
 *    грубо, через одну — отсюда «пиксели» и мерцание кромок);
 * 2) тонкая резкость (по мотивам AMD CAS): усиливает только мелкие перепады —
 *    кромки фасадов, швы, ручки, — ровные места не трогает, без ореолов.
 * scale — во сколько раз кадр крупнее экрана.
 * 3) лёгкое затемнение углов, как у объектива камеры (vignette); frameOffset
 *    и frameScale — какая часть общего кадра (для склейки картинки 4K).
 */
export function sharpenPass(strength = 0.35): ShaderPass {
  return new ShaderPass({
    uniforms: {
      tDiffuse: { value: null },
      strength: { value: strength },
      scale: { value: 1 },
      vignette: { value: 0.16 },
      frameOffset: { value: new Vector2(0, 0) },
      frameScale: { value: new Vector2(1, 1) },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D tDiffuse;
      uniform float strength;
      uniform float scale;
      uniform float vignette;
      uniform vec2 frameOffset;
      uniform vec2 frameScale;
      varying vec2 vUv;

      // среднее по площади одной точки экрана: 4 билинейные выборки
      vec3 cell(vec2 uv, vec2 texel) {
        if (scale < 1.01) return texture2D(tDiffuse, uv).rgb;
        vec2 o = texel * scale * 0.25;
        return 0.25 * (
          texture2D(tDiffuse, uv + vec2(-o.x, -o.y)).rgb +
          texture2D(tDiffuse, uv + vec2( o.x, -o.y)).rgb +
          texture2D(tDiffuse, uv + vec2(-o.x,  o.y)).rgb +
          texture2D(tDiffuse, uv + vec2( o.x,  o.y)).rgb);
      }

      void main() {
        vec2 texel = 1.0 / vec2(textureSize(tDiffuse, 0));
        vec2 px = texel * max(scale, 1.0);
        vec3 b = cell(vUv + vec2(0.0, -px.y), texel);
        vec3 d = cell(vUv + vec2(-px.x, 0.0), texel);
        vec3 e = cell(vUv, texel);
        vec3 f = cell(vUv + vec2(px.x, 0.0), texel);
        vec3 h = cell(vUv + vec2(0.0, px.y), texel);
        vec3 mn = min(min(min(d, e), min(f, b)), h);
        vec3 mx = max(max(max(d, e), max(f, b)), h);
        vec3 amp = sqrt(clamp(min(mn, 2.0 - mx) / max(mx, vec3(1e-4)), 0.0, 1.0));
        vec3 w = amp * (-1.0 / mix(8.0, 5.0, strength));
        vec3 col = (b * w + d * w + f * w + h * w + e) / (1.0 + 4.0 * w);
        vec2 q = (frameOffset + vUv * frameScale) - 0.5;
        col *= 1.0 - vignette * smoothstep(0.25, 0.75, length(q * vec2(1.0, 0.85)));
        gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
      }`,
  })
}
