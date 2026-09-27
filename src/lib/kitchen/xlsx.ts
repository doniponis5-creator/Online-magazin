/**
 * Запись `.xlsx` своим кодом, без пакетов (решение §1 пакета мастера):
 * SpreadsheetML в zip «store» (без сжатия). Числа пишутся числами, текст —
 * строкой прямо в ячейке (inline string), первая строка листа — жирная
 * (заголовки колонок). Открывается в Excel, LibreOffice и Google Таблицах.
 */

export type XlsxCell = string | number | null
export type XlsxSheet = { name: string; rows: XlsxCell[][]; widths?: number[] }

/** Книга из листов → байты файла `.xlsx`. */
export function xlsx(sheets: XlsxSheet[]): Uint8Array {
  const list = sheets.length ? sheets : [{ name: 'Sheet1', rows: [] }]
  const names = sheetNames(list.map((s) => s.name))
  const n = list.length
  const range = (f: (i: number) => string) => Array.from({ length: n }, (_, i) => f(i + 1)).join('')
  const files: [string, string][] = [
    [
      '[Content_Types].xml',
      `${HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        range((i) => `<Override PartName="/xl/worksheets/sheet${i}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`) +
        '</Types>',
    ],
    [
      '_rels/.rels',
      `${HEAD}<Relationships xmlns="${REL_NS}">` +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
        '</Relationships>',
    ],
    [
      'xl/workbook.xml',
      `${HEAD}<workbook xmlns="${MAIN_NS}" xmlns:r="${R_NS}"><sheets>` +
        range((i) => `<sheet name="${esc(names[i - 1])}" sheetId="${i}" r:id="rId${i}"/>`) +
        '</sheets></workbook>',
    ],
    [
      'xl/_rels/workbook.xml.rels',
      `${HEAD}<Relationships xmlns="${REL_NS}">` +
        range((i) => `<Relationship Id="rId${i}" Type="${R_NS}/worksheet" Target="worksheets/sheet${i}.xml"/>`) +
        `<Relationship Id="rId${n + 1}" Type="${R_NS}/styles" Target="styles.xml"/>` +
        '</Relationships>',
    ],
    ['xl/styles.xml', STYLES],
    ...list.map((s, i): [string, string] => [`xl/worksheets/sheet${i + 1}.xml`, sheetXml(s)]),
  ]
  const enc = new TextEncoder()
  return zipStore(files.map(([name, body]) => ({ name, data: enc.encode(body) })))
}

/* ───────── SpreadsheetML ───────── */

const HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
const MAIN_NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
const R_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const REL_NS = 'http://schemas.openxmlformats.org/package/2006/relationships'

/** Стили: 0 — обычный, 1 — жирный (заголовки). */
const STYLES =
  `${HEAD}<styleSheet xmlns="${MAIN_NS}">` +
  '<fonts count="2"><font><sz val="11"/><name val="Calibri"/><family val="2"/></font><font><b/><sz val="11"/><name val="Calibri"/><family val="2"/></font></fonts>' +
  '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
  '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>' +
  '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
  '</styleSheet>'

/** Экранирование для XML; управляющие символы, которых XML не допускает, выбрасываются. */
function esc(s: string): string {
  return s
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f￾￿]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Буквы колонки: 0 → A, 25 → Z, 26 → AA. */
function col(i: number): string {
  let s = ''
  for (let k = i + 1; k > 0; k = Math.floor((k - 1) / 26)) s = String.fromCharCode(65 + ((k - 1) % 26)) + s
  return s
}

function sheetXml(sheet: XlsxSheet): string {
  const cols = (sheet.widths ?? [])
    .map((w, i) => (w > 0 && Number.isFinite(w) ? `<col min="${i + 1}" max="${i + 1}" width="${Math.round(w * 100) / 100}" customWidth="1"/>` : ''))
    .join('')
  const rows = sheet.rows
    .map((row, r) => {
      const style = r === 0 ? ' s="1"' : ''
      const body = row
        .map((v, c) => {
          const ref = `${col(c)}${r + 1}`
          if (typeof v === 'number') return Number.isFinite(v) ? `<c r="${ref}"${style}><v>${Object.is(v, -0) ? 0 : v}</v></c>` : ''
          if (typeof v === 'string' && v !== '') return `<c r="${ref}"${style} t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`
          return ''
        })
        .join('')
      return body ? `<row r="${r + 1}">${body}</row>` : ''
    })
    .join('')
  return `${HEAD}<worksheet xmlns="${MAIN_NS}" xmlns:r="${R_NS}">${cols ? `<cols>${cols}</cols>` : ''}<sheetData>${rows}</sheetData></worksheet>`
}

/** Имена листов по правилам Excel: без `[]:*?/\`, не длиннее 31, не пустые, без повторов. */
function sheetNames(raw: string[]): string[] {
  const used = new Set<string>()
  return raw.map((name, i) => {
    const base = name.replace(/[[\]:*?/\\]/g, ' ').replace(/^'+|'+$/g, '').trim().slice(0, 31) || `Sheet${i + 1}`
    let out = base
    for (let k = 2; used.has(out.toLowerCase()); k++) out = `${base.slice(0, 31 - String(k).length - 1)} ${k}`
    used.add(out.toLowerCase())
    return out
  })
}

/* ───────── zip «store» ───────── */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

/** CRC-32 (IEEE), как в zip. */
function crc32(data: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

/** Дата в zip — постоянная (1 января 2026): одинаковая книга даёт одинаковые байты. */
const DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1
const DOS_TIME = 0

function zipStore(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const enc = new TextEncoder()
  const parts = files.map((f) => ({ ...f, raw: enc.encode(f.name), crc: crc32(f.data) }))
  const localSize = parts.reduce((s, p) => s + 30 + p.raw.length + p.data.length, 0)
  const centralSize = parts.reduce((s, p) => s + 46 + p.raw.length, 0)
  const out = new Uint8Array(localSize + centralSize + 22)
  const dv = new DataView(out.buffer)
  let at = 0
  const u16 = (v: number) => {
    dv.setUint16(at, v, true)
    at += 2
  }
  const u32 = (v: number) => {
    dv.setUint32(at, v >>> 0, true)
    at += 4
  }
  const bytes = (b: Uint8Array) => {
    out.set(b, at)
    at += b.length
  }
  const offsets: number[] = []
  for (const p of parts) {
    offsets.push(at)
    u32(0x04034b50)
    u16(20) // версия для распаковки
    u16(0x0800) // имена в UTF-8
    u16(0) // store
    u16(DOS_TIME)
    u16(DOS_DATE)
    u32(p.crc)
    u32(p.data.length)
    u32(p.data.length)
    u16(p.raw.length)
    u16(0)
    bytes(p.raw)
    bytes(p.data)
  }
  const central = at
  parts.forEach((p, i) => {
    u32(0x02014b50)
    u16(20) // создано
    u16(20) // нужно для распаковки
    u16(0x0800)
    u16(0)
    u16(DOS_TIME)
    u16(DOS_DATE)
    u32(p.crc)
    u32(p.data.length)
    u32(p.data.length)
    u16(p.raw.length)
    u16(0) // extra
    u16(0) // комментарий
    u16(0) // диск
    u16(0) // внутренние атрибуты
    u32(0) // внешние атрибуты
    u32(offsets[i])
    bytes(p.raw)
  })
  const centralLen = at - central
  u32(0x06054b50)
  u16(0)
  u16(0)
  u16(parts.length)
  u16(parts.length)
  u32(centralLen)
  u32(central)
  u16(0)
  return out
}
