import { PDFDocument, PDFArray, PDFNumber, PDFOperator, PDFName, beginText, endText, moveText, setFontAndSize, type PDFFont, type PDFPage } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import type { BuiltManuscript, CompileOptions } from '@/lib/manuscriptCompile'
import type { SubmissionOptions } from '@/lib/manuscriptExport'
import {
  bookContent, layoutBook, layoutPrint, layoutSubmission, pageSpec, TRIM_SIZES,
  type BackSection, type FontKey, type FrontMatter, type LaidPage, type Layout, type LayoutFonts, type LayoutStats, type PaperSize, type PlacedLine,
} from '@/lib/pdfLayout'

/*
  The PDF export (issue #701): the layout `pdfLayout.ts` makes, written with
  pdf-lib and the bundled fonts (docs/records/pdf-export-measure.md, D-2, D-3).
  This module, pdf-lib and the fonts are loaded only when a PDF is made: the
  Export dialog imports it on demand.
*/

/** The fonts' bytes, each set: the book's (EB Garamond), and the submission's in Times' or Courier's metrics. */
async function fontBytes(set: 'book' | 'times' | 'courier'): Promise<{ roman: Uint8Array; italic: Uint8Array; fallback: Uint8Array }> {
  const [roman, italic, fallback] = await Promise.all(
    set === 'book'
      ? [import('@/assets/fonts/pdf/EBGaramond-Regular.ttf?inline'), import('@/assets/fonts/pdf/EBGaramond-Italic.ttf?inline'), import('@/assets/fonts/pdf/DejaVuSans.ttf?inline')]
      : set === 'times'
        ? [import('@/assets/fonts/pdf/LiberationSerif-Regular.ttf?inline'), import('@/assets/fonts/pdf/LiberationSerif-Italic.ttf?inline'), import('@/assets/fonts/pdf/DejaVuSans.ttf?inline')]
        : [import('@/assets/fonts/pdf/LiberationMono-Regular.ttf?inline'), import('@/assets/fonts/pdf/LiberationMono-Italic.ttf?inline'), import('@/assets/fonts/pdf/DejaVuSans.ttf?inline')],
  )
  return { roman: bytesOf(roman.default), italic: bytesOf(italic.default), fallback: bytesOf(fallback.default) }
}

/** A font bundled inline: a data URL, as Vite gives it. */
function bytesOf(dataUrl: string): Uint8Array {
  const b64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

/*
  pdf-lib lays each string out with fontkit before it encodes it, and that
  chooses the glyphs drawn: ligatures among them, "fi" as one glyph. The width
  measured here is laid out with the same features, the font's own, so it is
  the width drawn. In the measure, ligatures left a gap after every "fi"
  (D-2), but only where each word was drawn alone with pdf-lib's own
  `drawText`, which spaces by kerned positions. Drawn a line at a time, by
  advances, they set as they should and read back as the letters they join.
*/
const FEATURES = {}

interface FontkitFont {
  unitsPerEm: number
  hasGlyphForCodePoint(cp: number): boolean
  layout(text: string, features?: Record<string, boolean>): { glyphs: Array<{ advanceWidth: number }> }
}

/** The faces, for the layout: widths, and which face draws each character. */
export interface Faces extends LayoutFonts {
  /** Characters no bundled face has, each drawn as the fallback's replacement mark. */
  missing: number
}

export function facesOf(fonts: Record<FontKey, FontkitFont>): Faces {
  const cache = new Map<string, number>()
  const faces: Faces = {
    missing: 0,
    width(text, font, size) {
      const key = font + '\u0000' + text
      let em = cache.get(key)
      if (em === undefined) {
        const f = fonts[font]
        em = f.layout(text, FEATURES).glyphs.reduce((n, g) => n + g.advanceWidth, 0) / f.unitsPerEm
        cache.set(key, em)
      }
      return em * size
    },
    split(text, style) {
      const out: Array<{ text: string; font: FontKey }> = []
      for (const ch of text) {
        const cp = ch.codePointAt(0)!
        let font: FontKey = style
        let drawn = ch
        if (!fonts[style].hasGlyphForCodePoint(cp)) {
          font = 'fallback'
          if (!fonts.fallback.hasGlyphForCodePoint(cp)) { drawn = '�'; faces.missing++ }
        }
        const last = out[out.length - 1]
        if (last && last.font === font) last.text += drawn
        else out.push({ text: drawn, font })
      }
      return out
    },
  }
  return faces
}

export type PdfLayoutKind = 'reading' | 'print' | 'submission'

export interface PdfOptions extends CompileOptions {
  kind: PdfLayoutKind
  author?: string
  /** Reading copy: the paper. */
  paper?: PaperSize
  /** Print interior: the trim, by id (`TRIM_SIZES`). */
  trim?: string
  front?: FrontMatter
  back?: BackSection[]
  /** Submission: the writer, as the Word file's submission takes them. */
  submission?: SubmissionOptions
}

export interface MadePdf extends LayoutStats {
  data: Uint8Array
  pages: number
  /** Characters no bundled font has, drawn as a replacement mark. */
  missing: number
  /** How long it took, laid out and written, in milliseconds. */
  ms: number
}

/*
  Seam for e2e specs: what the last PDF came to, which the file cannot say (its
  widows and orphans, its time). Same flag as `__pwdb` in `database.ts`: present
  in dev and in a build made with `VITE_E2E=1`, absent from a released bundle.
*/
export interface E2EPdfSeam { last: Omit<MadePdf, 'data'> | null }

/** The book as a PDF: laid out, then written, every font embedded. */
export async function makePdf(m: BuiltManuscript, o: PdfOptions): Promise<MadePdf> {
  const started = performance.now()
  const set = o.kind === 'submission' ? (o.submission?.font === 'courier' ? 'courier' : 'times') : 'book'
  const bytes = await fontBytes(set)
  const fk = fontkit as unknown as { create(b: Uint8Array): FontkitFont }
  const faces = facesOf({ roman: fk.create(bytes.roman), italic: fk.create(bytes.italic), fallback: fk.create(bytes.fallback) })

  const title = o.title?.trim() || 'Manuscript'
  const author = (o.kind === 'submission' ? o.submission?.name : o.author)?.trim() || ''
  const book = bookContent(m, { ...o, title, author, submission: o.kind === 'submission', front: o.kind === 'print' ? o.front : undefined, back: o.kind === 'print' ? o.back : undefined })
  const layout: Layout = o.kind === 'print'
    ? layoutPrint(book, { title, author, trim: TRIM_SIZES.find((t) => t.id === o.trim) ?? TRIM_SIZES[3], sceneSeparator: o.sceneSeparator }, faces)
    : o.kind === 'submission'
      ? layoutSubmission(book, o.submission ?? { name: author }, pageSpec('submission', { title, author, submission: o.submission }), faces)
      : layoutBook(book, pageSpec('reading', { title, author, paper: o.paper, sceneSeparator: o.sceneSeparator }), faces)

  const data = await writePdf(layout, bytes, { title, author })
  const made: MadePdf = {
    data, pages: layout.pages.length, missing: faces.missing, ms: Math.round(performance.now() - started),
    loose: layout.loose, widows: layout.widows, orphans: layout.orphans, stranded: layout.stranded,
  }
  if (import.meta.env.DEV || import.meta.env.VITE_E2E) {
    const { data: _data, ...said } = made
    void _data
    ;(globalThis as unknown as { __pwpdf?: E2EPdfSeam }).__pwpdf = { last: said }
  }
  return made
}

/** The pages, written: one text object a line, its words spaced by `TJ` adjustments (D-2). */
export async function writePdf(layout: Layout, bytes: Record<FontKey, Uint8Array>, meta: { title: string; author: string }): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)
  // Only the faces the pages use: a book with no italic, or nothing the fallback draws, carries no font it does not show.
  const used = new Set<FontKey>(layout.pages.flatMap((p) => furniture(p).flatMap((l) => l.pieces.map((q) => q.font))))
  const embedded = {} as Record<FontKey, PDFFont>
  for (const k of used) embedded[k] = await doc.embedFont(bytes[k], { subset: true, features: FEATURES })
  doc.setTitle(meta.title)
  if (meta.author) doc.setAuthor(meta.author)
  doc.setCreator('Kathala')
  doc.setProducer('Kathala')

  // Each word's glyphs encoded once: a book repeats its words.
  const encoded = new Map<string, ReturnType<PDFFont['encodeText']>>()
  const encode = (text: string, font: FontKey) => {
    const key = font + '\u0000' + text
    let e = encoded.get(key)
    if (!e) { e = embedded[font].encodeText(text); encoded.set(key, e) }
    return e
  }

  for (const p of layout.pages) {
    const page = doc.addPage([layout.spec.width, layout.spec.height])
    const names = {} as Record<FontKey, PDFName>
    for (const k of used) names[k] = page.node.newFontDictionary(embedded[k].name, embedded[k].ref)
    for (const line of furniture(p)) drawLine(page, line, names, encode, doc)
  }
  return doc.save()
}

/** A page's lines, with its running head and number. */
function furniture(p: LaidPage): PlacedLine[] {
  return [...p.lines, ...(p.head ? [p.head] : []), ...(p.folio ? [p.folio] : [])]
}

function drawLine(page: PDFPage, line: PlacedLine, names: Record<FontKey, PDFName>, encode: (t: string, f: FontKey) => ReturnType<PDFFont['encodeText']>, doc: PDFDocument) {
  if (!line.pieces.length) return
  const ops: PDFOperator[] = [beginText(), moveText(line.x, line.y)]
  let font: FontKey | null = null
  let arr: PDFArray | null = null
  const flush = () => { if (arr) ops.push(PDFOperator.of('TJ' as never, [arr])) }
  for (const [i, piece] of line.pieces.entries()) {
    if (piece.font !== font) {
      flush()
      arr = PDFArray.withContext(doc.context)
      ops.push(setFontAndSize(names[piece.font], line.size))
      font = piece.font
    }
    // A word space: the line's own width of one, as a move along the line in thousandths of the size.
    if (i > 0 && piece.space) arr!.push(PDFNumber.of(-(line.gap / line.size) * 1000))
    arr!.push(encode(piece.text, piece.font))
  }
  flush()
  ops.push(endText())
  page.pushOperators(...ops)
}
