import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import '@/components/kitchen/three/engine'

/*
  Защита рельефа от деления на ноль вставляется заменой текста в формуле
  three.js. Обновят three.js и формула поменяется — замена молча не сработает,
  и на телефоне снова почернеют кухни. Этот тест заметит это первым.
*/
describe('3D: рельеф без деления на ноль', () => {
  it('в формулу рельефа вставлена защита', () => {
    const chunk = THREE.ShaderChunk.bumpmap_pars_fragment
    expect(chunk).toContain('if ( dot( dpx, dpx ) <= 1e-12 || dot( dpy, dpy ) <= 1e-12 ) return surf_norm;')
    expect(chunk).toContain('vec3 vSigmaY = normalize( dpy );')
    expect(chunk).toContain('return dot( bumped, bumped ) > 1e-12 ? normalize( bumped ) : surf_norm;')
    expect(chunk).not.toMatch(/normalize\(\s*dFdx\(\s*surf_pos/)
  })
})
