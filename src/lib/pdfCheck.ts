import { PDFDocument, PDFName, PDFDict, PDFArray, PDFRawStream, PDFRef, decodePDFRawStream, type PDFObject } from 'pdf-lib'

/*
  A PDF read back and checked (issue #701): what a print service checks before
  it takes an interior. That means the page size against the trim, every font
  embedded and none of Type 3, and each chapter opening on a right-hand page
  with no running head above it. Read from the file itself, not from the
  layout that made it, so the tests, the e2e and `npm run check:pdf` each see
  what a printer would. It reads the files this app writes: one text object a
  line, words in `TJ` arrays, fonts with a ToUnicode map.
*/

export interface PdfLine { x: number; y: number; text: string }
export interface PdfPage { width: number; height: number; lines: PdfLine[] }
export interface PdfFont { name: string; subtype: string; embedded: boolean }
export interface PdfReport { pages: PdfPage[]; fonts: PdfFont[]; title?: string; author?: string }

const dec = new TextDecoder()

function bytesOf(doc: PDFDocument, obj: PDFObject | undefined): Uint8Array | null {
  const s = obj instanceof PDFRef ? doc.context.lookup(obj) : obj
  return s instanceof PDFRawStream ? decodePDFRawStream(s).decode() : null
}

/** A font's glyph codes to text, from its ToUnicode map. */
function toUnicode(doc: PDFDocument, font: PDFDict): Map<number, string> {
  const map = new Map<number, string>()
  const raw = bytesOf(doc, font.get(PDFName.of('ToUnicode')))
  if (!raw) return map
  const cmap = dec.decode(raw)
  const hexText = (h: string) => { let t = ''; for (let i = 0; i < h.length; i += 4) t += String.fromCharCode(parseInt(h.slice(i, i + 4), 16)); return t }
  for (const block of cmap.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const m of block[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g)) map.set(parseInt(m[1], 16), hexText(m[2]))
  }
  for (const block of cmap.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    for (const m of block[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*(<[0-9a-fA-F]+>|\[[^\]]*\])/g)) {
      const lo = parseInt(m[1], 16), hi = parseInt(m[2], 16)
      if (m[3].startsWith('[')) [...m[3].matchAll(/<([0-9a-fA-F]+)>/g)].forEach((d, k) => map.set(lo + k, hexText(d[1])))
      else { const base = hexText(m[3].slice(1, -1)); for (let c = lo; c <= hi; c++) map.set(c, base.slice(0, -1) + String.fromCharCode(base.charCodeAt(base.length - 1) + c - lo)) }
    }
  }
  return map
}

/** A page's lines of text: each text object one line, a word space wherever `TJ` moves on by a tenth of an em or more. */
function pageLines(doc: PDFDocument, page: ReturnType<PDFDocument['getPage']>): PdfLine[] {
  const fontsDict = page.node.Resources()?.lookup(PDFName.of('Font'), PDFDict)
  const maps = new Map<string, Map<number, string>>()
  for (const [name, ref] of fontsDict?.entries() ?? []) maps.set(name.asString().slice(1), toUnicode(doc, doc.context.lookup(ref, PDFDict)))
  const contents = page.node.get(PDFName.of('Contents'))
  const parts = contents instanceof PDFArray ? contents.asArray() : contents ? [contents] : []
  const stream = parts.map((p) => { const b = bytesOf(doc, p); return b ? dec.decode(b) : '' }).join('\n')
  const lines: PdfLine[] = []
  for (const obj of stream.matchAll(/BT([\s\S]*?)ET/g)) {
    let x = 0, y = 0, text = '', map: Map<number, string> | undefined
    /*
      A font with a ToUnicode map has two-byte codes, as this app's do; one
      without, a simple font such as pdf-lib's standard ones, one byte a
      character, read as Latin-1.
    */
    const decode = (hex: string) => {
      if (!map?.size) { for (let i = 0; i < hex.length; i += 2) text += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16)); return }
      for (let i = 0; i < hex.length; i += 4) text += map.get(parseInt(hex.slice(i, i + 4), 16)) ?? '�'
    }
    // A line placed by `Td`, as this app's are, or by a text matrix, `Tm`, as pdf-lib's own `drawText` places them.
    for (const op of obj[1].matchAll(/(-?[\d.]+)\s+(-?[\d.]+)\s+(?:Td|Tm)|\/(\S+)\s+[\d.]+\s+Tf|\[([^\]]*)\]\s*TJ|<([0-9a-fA-F]*)>\s*Tj/g)) {
      if (op[1] !== undefined) { x = Number(op[1]); y = Number(op[2]) }
      else if (op[3] !== undefined) map = maps.get(op[3])
      else if (op[5] !== undefined) decode(op[5])
      else for (const t of op[4].matchAll(/<([0-9a-fA-F]*)>|(-?[\d.]+)/g)) {
        if (t[1] !== undefined) decode(t[1])
        else if (Number(t[2]) <= -100) text += ' '
      }
    }
    lines.push({ x, y, text })
  }
  return lines
}

/** Every font the file uses, and whether its program is in it. */
function fontsOf(doc: PDFDocument): PdfFont[] {
  const out: PdfFont[] = []
  for (const [, obj] of doc.context.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFDict) || obj.get(PDFName.of('Type')) !== PDFName.of('Font')) continue
    const subtype = String(obj.get(PDFName.of('Subtype')) ?? '').replace(/^\//, '')
    // A composite font's program is in its descendant, which is listed in its own right.
    if (subtype === 'Type0') continue
    const desc = obj.lookupMaybe(PDFName.of('FontDescriptor'), PDFDict)
    const embedded = !!desc && ['FontFile', 'FontFile2', 'FontFile3'].some((k) => desc.get(PDFName.of(k)) !== undefined)
    out.push({ name: String(obj.get(PDFName.of('BaseFont')) ?? '').replace(/^\//, ''), subtype, embedded })
  }
  return out
}

export async function readPdf(bytes: Uint8Array): Promise<PdfReport> {
  const doc = await PDFDocument.load(bytes)
  return {
    pages: doc.getPages().map((p) => ({ width: p.getWidth(), height: p.getHeight(), lines: pageLines(doc, p) })),
    fonts: fontsOf(doc),
    title: doc.getTitle(),
    author: doc.getAuthor(),
  }
}

export interface PrintCheck {
  /** The trim, in points. */
  width: number
  height: number
  /** The chapter headings' first lines, in order, as set. */
  headings: string[]
  /** How far a page may be from the trim: a hundredth of an inch. */
  tolerance?: number
}

/** What a print service would refuse, or a reader notice, in an interior: an empty list if nothing. */
export function printProblems(r: PdfReport, c: PrintCheck): string[] {
  const out: string[] = []
  const tol = c.tolerance ?? 0.72
  r.pages.forEach((p, i) => {
    if (Math.abs(p.width - c.width) > tol || Math.abs(p.height - c.height) > tol) out.push(`page ${i + 1} is ${p.width.toFixed(2)} × ${p.height.toFixed(2)} pt, not the trim`)
  })
  for (const f of r.fonts) {
    if (f.subtype === 'Type3') out.push(`${f.name} is a Type 3 font`)
    else if (!f.embedded) out.push(`${f.name} is not embedded`)
  }
  let from = 0
  for (const h of c.headings) {
    const at = r.pages.findIndex((p, i) => i >= from && p.lines.some((l) => l.text === h))
    if (at < 0) { out.push(`"${h}" is not on any page`); continue }
    from = at + 1
    const page = r.pages[at]
    if ((at + 1) % 2 === 0) out.push(`"${h}" opens on page ${at + 1}, a left-hand page`)
    const y = page.lines.find((l) => l.text === h)!.y
    if (page.lines.some((l) => l.y > y + 1)) out.push(`page ${at + 1}, which "${h}" opens, has a line above its heading`)
  }
  return out
}
