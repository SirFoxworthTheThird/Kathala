import type { BuiltManuscript, CompileOptions } from './manuscriptCompile'
import { zipStore, type ZipEntry } from './zip'

/**
 * Compile a built manuscript to a binary book file — Word (`.docx`) or EPUB —
 * as a ZIP container built in the browser with no dependency. Pure: returns the
 * archive bytes; the caller wraps them in a Blob to download.
 */

const enc = new TextEncoder()
const file = (name: string, text: string): ZipEntry => ({ name, data: enc.encode(text) })

function xml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** Split prose into paragraphs on blank lines. */
function paragraphs(text: string): string[] {
  return text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
}

export interface BookExportOptions extends CompileOptions {
  author?: string
}

/** Chapters that have prose to include, with their kept scenes. */
function includedChapters(m: BuiltManuscript, onlyWritten: boolean) {
  return m.chapters
    .map((ch) => ({ ch, scenes: onlyWritten ? ch.scenes.filter((s) => s.written) : ch.scenes }))
    .filter((b) => b.scenes.length > 0)
}

function chapterHeading(number: number, title: string): string {
  return `Ch. ${number} — ${title || 'Untitled'}`
}

// ── DOCX ──────────────────────────────────────────────────────────────────────

function docPara(text: string, o: { bold?: boolean; center?: boolean; sizeHalfPt?: number; pageBreakBefore?: boolean } = {}): string {
  const pPr: string[] = []
  if (o.pageBreakBefore) pPr.push('<w:pageBreakBefore/>')
  if (o.center) pPr.push('<w:jc w:val="center"/>')
  const rPr: string[] = []
  if (o.bold) rPr.push('<w:b/>')
  if (o.sizeHalfPt) rPr.push(`<w:sz w:val="${o.sizeHalfPt}"/>`)
  const pPrXml = pPr.length ? `<w:pPr>${pPr.join('')}</w:pPr>` : ''
  const rPrXml = rPr.length ? `<w:rPr>${rPr.join('')}</w:rPr>` : ''
  return `<w:p>${pPrXml}<w:r>${rPrXml}<w:t xml:space="preserve">${xml(text)}</w:t></w:r></w:p>`
}

export function compileDocx(m: BuiltManuscript, opts: BookExportOptions = {}): Uint8Array {
  const chapterTitles = opts.chapterTitles ?? true
  const onlyWritten = opts.onlyWritten ?? true
  const sep = opts.sceneSeparator ?? '* * *'
  const title = opts.title?.trim() || 'Manuscript'

  const blocks = includedChapters(m, onlyWritten)
  const body: string[] = []

  // Title page.
  body.push(docPara(title, { bold: true, center: true, sizeHalfPt: 56 }))
  if (opts.author?.trim()) body.push(docPara(opts.author.trim(), { center: true, sizeHalfPt: 28 }))

  blocks.forEach(({ ch, scenes }) => {
    if (chapterTitles) {
      body.push(docPara(chapterHeading(ch.number, ch.title), { bold: true, center: true, sizeHalfPt: 32, pageBreakBefore: true }))
    }
    scenes.forEach((s, i) => {
      if (i > 0) body.push(docPara(sep, { center: true }))
      const paras = s.written ? paragraphs(s.text) : ['[No prose yet]']
      for (const p of paras) body.push(docPara(p))
    })
  })

  const documentXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>` +
    body.join('') +
    `<w:sectPr/></w:body></w:document>`

  const contentTypes =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>` +
    `</Types>`

  const rels =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>` +
    `</Relationships>`

  return zipStore([
    file('[Content_Types].xml', contentTypes),
    file('_rels/.rels', rels),
    file('word/document.xml', documentXml),
  ])
}

// ── EPUB ──────────────────────────────────────────────────────────────────────

function uuid(): string {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  } catch { /* fall through */ }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

const EPUB_CSS =
  `body{font-family:Georgia,serif;line-height:1.6;margin:1em}` +
  `h1{text-align:center;margin:2em 0}h2{margin:2em 0 1em;font-size:1.3em}` +
  `p{margin:0 0 1em;text-indent:1.5em}p.first{text-indent:0}` +
  `hr.sep{border:0;margin:1.5em 0;text-align:center}hr.sep:after{content:"* * *"}`

function chapterXhtml(number: number, title: string, scenesHtml: string, showHeading: boolean): string {
  const head = showHeading ? `<h2>${xml(chapterHeading(number, title))}</h2>` : ''
  return `<?xml version="1.0" encoding="UTF-8"?>` +
    `<html xmlns="http://www.w3.org/1999/xhtml"><head><meta charset="utf-8"/>` +
    `<title>${xml(chapterHeading(number, title))}</title><link rel="stylesheet" type="text/css" href="style.css"/></head>` +
    `<body>${head}${scenesHtml}</body></html>`
}

export function compileEpub(m: BuiltManuscript, opts: BookExportOptions = {}): Uint8Array {
  const chapterTitles = opts.chapterTitles ?? true
  const onlyWritten = opts.onlyWritten ?? true
  const title = opts.title?.trim() || 'Manuscript'
  const author = opts.author?.trim() || 'Unknown'
  const bookId = `urn:uuid:${uuid()}`
  const modified = new Date().toISOString().replace(/\.\d+Z$/, 'Z')

  const blocks = includedChapters(m, onlyWritten)
  const chapterFiles = blocks.map(({ ch, scenes }, idx) => {
    const scenesHtml = scenes
      .map((s) => (s.written ? paragraphs(s.text) : ['[No prose yet]'])
        .map((p, i) => `<p${i === 0 ? ' class="first"' : ''}>${xml(p)}</p>`).join(''))
      .join('<hr class="sep"/>')
    return {
      id: `ch${idx + 1}`,
      href: `ch${idx + 1}.xhtml`,
      label: chapterHeading(ch.number, ch.title),
      content: chapterXhtml(ch.number, ch.title, scenesHtml, chapterTitles),
    }
  })

  const titleXhtml = `<?xml version="1.0" encoding="UTF-8"?>` +
    `<html xmlns="http://www.w3.org/1999/xhtml"><head><meta charset="utf-8"/><title>${xml(title)}</title>` +
    `<link rel="stylesheet" type="text/css" href="style.css"/></head>` +
    `<body><h1>${xml(title)}</h1><p style="text-align:center" class="first">${xml(author)}</p></body></html>`

  const navItems = chapterFiles.map((c) => `<li><a href="${c.href}">${xml(c.label)}</a></li>`).join('')
  const navXhtml = `<?xml version="1.0" encoding="UTF-8"?>` +
    `<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><meta charset="utf-8"/><title>Contents</title></head>` +
    `<body><nav epub:type="toc" id="toc"><h1>Contents</h1><ol>${navItems}</ol></nav></body></html>`

  const manifestItems = [
    `<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>`,
    `<item id="css" href="style.css" media-type="text/css"/>`,
    `<item id="title" href="title.xhtml" media-type="application/xhtml+xml"/>`,
    ...chapterFiles.map((c) => `<item id="${c.id}" href="${c.href}" media-type="application/xhtml+xml"/>`),
  ].join('')
  const spineItems = [`<itemref idref="title"/>`, ...chapterFiles.map((c) => `<itemref idref="${c.id}"/>`)].join('')

  const opf = `<?xml version="1.0" encoding="UTF-8"?>` +
    `<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid">` +
    `<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">` +
    `<dc:identifier id="bookid">${xml(bookId)}</dc:identifier>` +
    `<dc:title>${xml(title)}</dc:title><dc:creator>${xml(author)}</dc:creator><dc:language>en</dc:language>` +
    `<meta property="dcterms:modified">${modified}</meta></metadata>` +
    `<manifest>${manifestItems}</manifest><spine>${spineItems}</spine></package>`

  const container = `<?xml version="1.0" encoding="UTF-8"?>` +
    `<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">` +
    `<rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`

  // The mimetype entry MUST come first and be stored uncompressed.
  return zipStore([
    file('mimetype', 'application/epub+zip'),
    file('META-INF/container.xml', container),
    file('OEBPS/style.css', EPUB_CSS),
    file('OEBPS/content.opf', opf),
    file('OEBPS/nav.xhtml', navXhtml),
    file('OEBPS/title.xhtml', titleXhtml),
    ...chapterFiles.map((c) => file(`OEBPS/${c.href}`, c.content)),
  ])
}
