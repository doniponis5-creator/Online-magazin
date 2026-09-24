import { describe, expect, it } from 'vitest'
import { buildPdf } from '@/components/kitchen/pdfFile'

/** Байты PDF как строка latin1: один символ — один байт, смещения совпадают. */
async function pdfBytes(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer())
  return Array.from(buf, (b) => String.fromCharCode(b)).join('')
}

// вместо настоящего JPEG — любые байты: сам PDF их не разбирает
const fakeJpeg = () => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 0xff, 0xd9])

describe('PDF для мастера', () => {
  it('собирает целый файл: заголовок, страницы, таблица смещений, конец', async () => {
    const blob = buildPdf(
      [
        { jpeg: fakeJpeg(), width: 1240, height: 1754, links: [{ x: 0.1, y: 0.1, w: 0.3, h: 0.02, url: 'https://smarket.kg/ru/kitchen?f=corner&a=300(1)' }] },
        { jpeg: fakeJpeg(), width: 1240, height: 1754 },
      ],
      'Проект кухни для мастера',
    )
    expect(blob.type).toBe('application/pdf')
    const s = await pdfBytes(blob)
    expect(s.startsWith('%PDF-1.4\n')).toBe(true)
    expect(s.trimEnd().endsWith('%%EOF')).toBe(true)
    expect(s).toContain('/Count 2')
    expect(s.match(/\/Subtype \/Image/g)).toHaveLength(2)

    // каждая строка таблицы смещений указывает ровно на начало своего объекта
    const xrefAt = Number(/startxref\n(\d+)/.exec(s)![1])
    expect(s.slice(xrefAt, xrefAt + 4)).toBe('xref')
    const [, count] = /xref\n0 (\d+)\n/.exec(s.slice(xrefAt))!.map(Number)
    const rows = s.slice(xrefAt).split('\n').slice(3, 2 + count)
    rows.forEach((row, i) => {
      expect(row).toHaveLength(19) // 10 цифр, пробел, 5 цифр, пробел, n и пробел; \n — двадцатый байт
      const at = Number(row.slice(0, 10))
      expect(s.slice(at, at + `${i + 1} 0 obj`.length)).toBe(`${i + 1} 0 obj`)
    })
  })

  it('название — любыми буквами, ссылка — с экранированными скобками', async () => {
    const s = await pdfBytes(buildPdf([{ jpeg: fakeJpeg(), width: 10, height: 10, links: [{ x: 0, y: 0, w: 1, h: 1, url: 'https://x.kg/a(b)' }] }], 'Ашкана ң'))
    // «Ашкана ң» в UTF-16: А=0410 … ң=04A3
    expect(s).toContain('/Title <FEFF04100448043A0430043D0430002004A3>')
    expect(s).toContain('/URI (https://x.kg/a\\(b\\))')
  })
})
