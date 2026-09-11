import { describe, expect, it } from 'vitest'
import { ru, ky, type Dict } from '@/lib/i18n/dictionaries'

/**
 * UI должен быть полностью двуязычным: пустые значения или «протёкший»
 * узбекский/русский текст в KY-словаре — ошибка прототипа.
 */
function assertSameShape(a: unknown, b: unknown, path: string, problems: string[]) {
  if (typeof a === 'string' || a === undefined || b === undefined) {
    if (typeof a !== 'string' || typeof b !== 'string' || a === '' || b === '') {
      problems.push(path)
    }
    return
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
      problems.push(path)
      return
    }
    a.forEach((item, i) => assertSameShape(item, (b as unknown[])[i], `${path}[${i}]`, problems))
    return
  }
  if (typeof a === 'object' && a !== null) {
    const ka = Object.keys(a as object).sort()
    const kb = Object.keys(b as object).sort()
    if (JSON.stringify(ka) !== JSON.stringify(kb)) {
      problems.push(`${path} (keys ${ka} != ${kb})`)
      return
    }
    for (const key of ka) {
      assertSameShape(
        (a as Record<string, unknown>)[key],
        (b as Record<string, unknown>)[key],
        `${path}.${key}`,
        problems,
      )
    }
  }
}

describe('i18n dictionaries', () => {
  it('KY dictionary has the same shape and no empty strings as RU', () => {
    const problems: string[] = []
    assertSameShape(ru, ky, 'dict', problems)
    expect(problems).toEqual([])
  })

  it('contains proper Kyrgyz-specific letters Ң Ң/Ө/Ү somewhere in KY copy', () => {
    const flat = JSON.stringify(ky)
    expect(flat).toMatch(/ө/i)
    expect(flat).toMatch(/ү/i)
  })

  it('ky dictionary satisfies the Dict type', () => {
    const d: Dict = ky
    expect(d.nav.cart).toBe('Себет')
  })
})
