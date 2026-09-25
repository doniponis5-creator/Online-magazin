/**
 * Самый простой PDF без библиотек: каждая страница — одна картинка JPEG на
 * весь лист A4, поверх неё — ссылки, по которым можно нажать.
 *
 * Почему картинками: буквы рисует сам браузер тем же шрифтом, что на сайте,
 * и кыргызские ң, ө, ү выходят без вшитых шрифтов. Файл получается обычным
 * PDF — открывается в WhatsApp, Telegram, «Файлах» и печатается.
 */

/** Ссылка на странице: доли листа от левого верхнего угла (0…1). */
export type PdfLink = { x: number; y: number; w: number; h: number; url: string }
export type PdfPage = { jpeg: Uint8Array<ArrayBuffer>; width: number; height: number; links?: PdfLink[] }

/** A4 в пунктах PDF (1/72 дюйма) */
export const A4 = { w: 595.28, h: 841.89 }

const enc = new TextEncoder()

/** Строка PDF для любых букв: UTF-16 с меткой порядка байтов, в шестнадцатеричном виде. */
function pdfText(s: string): string {
  let hex = 'FEFF'
  for (let i = 0; i < s.length; i++) hex += s.charCodeAt(i).toString(16).padStart(4, '0').toUpperCase()
  return `<${hex}>`
}

/** Адрес ссылки — только ASCII, скобки и обратная черта экранируются. */
function pdfUri(url: string): string {
  const ascii = encodeURI(decodeURISafe(url))
  return `(${ascii.replace(/[\\()]/g, (c) => `\\${c}`)})`
}

function decodeURISafe(url: string): string {
  try {
    return decodeURI(url)
  } catch {
    return url
  }
}

const num = (v: number) => (Math.round(v * 100) / 100).toString()

export function buildPdf(pages: PdfPage[], title: string): Blob {
  const chunks: Uint8Array<ArrayBuffer>[] = []
  const offsets: number[] = []
  let length = 0
  const push = (part: string | Uint8Array<ArrayBuffer>) => {
    const bytes = typeof part === 'string' ? enc.encode(part) : part
    chunks.push(bytes)
    length += bytes.length
  }
  let next = 1
  const alloc = () => next++
  const catalog = alloc()
  const pagesId = alloc()
  const info = alloc()
  const ids = pages.map((p) => ({ page: alloc(), image: alloc(), content: alloc(), links: (p.links ?? []).map(() => alloc()) }))

  const open = (id: number) => {
    offsets[id] = length
    push(`${id} 0 obj\n`)
  }
  const obj = (id: number, body: string) => {
    open(id)
    push(`${body}\nendobj\n`)
  }

  // заголовок и строка из байтов больше 127: так программы понимают, что файл двоичный
  push('%PDF-1.4\n')
  push(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]))

  obj(catalog, `<< /Type /Catalog /Pages ${pagesId} 0 R >>`)
  obj(pagesId, `<< /Type /Pages /Kids [${ids.map((i) => `${i.page} 0 R`).join(' ')}] /Count ${pages.length} >>`)
  obj(info, `<< /Title ${pdfText(title)} /Producer (smarket.kg) >>`)

  pages.forEach((p, n) => {
    const id = ids[n]
    const links = p.links ?? []
    const annots = id.links.length ? ` /Annots [${id.links.map((l) => `${l} 0 R`).join(' ')}]` : ''
    obj(
      id.page,
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${A4.w} ${A4.h}] /Resources << /XObject << /Im0 ${id.image} 0 R >> >> /Contents ${id.content} 0 R${annots} >>`,
    )
    open(id.image)
    push(
      `<< /Type /XObject /Subtype /Image /Width ${p.width} /Height ${p.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>\nstream\n`,
    )
    push(p.jpeg)
    push('\nendstream\nendobj\n')
    const draw = `q ${A4.w} 0 0 ${A4.h} 0 0 cm /Im0 Do Q`
    obj(id.content, `<< /Length ${draw.length} >>\nstream\n${draw}\nendstream`)
    links.forEach((l, i) => {
      const x1 = l.x * A4.w
      const y2 = A4.h * (1 - l.y)
      const rect = [x1, y2 - l.h * A4.h, x1 + l.w * A4.w, y2].map(num).join(' ')
      obj(id.links[i], `<< /Type /Annot /Subtype /Link /Rect [${rect}] /Border [0 0 0] /A << /S /URI /URI ${pdfUri(l.url)} >> >>`)
    })
  })

  // таблица, где какой объект лежит: каждая строка ровно 20 байт
  const xref = length
  let table = `xref\n0 ${next}\n0000000000 65535 f \n`
  for (let id = 1; id < next; id++) table += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`
  push(table)
  push(`trailer\n<< /Size ${next} /Root ${catalog} 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`)
  return new Blob(chunks, { type: 'application/pdf' })
}
