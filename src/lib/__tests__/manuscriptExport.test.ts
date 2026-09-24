import { describe, it, expect } from 'vitest'
import { compileDocx, compileEpub } from '@/lib/manuscriptExport'
import type { BuiltManuscript } from '@/lib/manuscriptCompile'

const dec = new TextDecoder('latin1')
const cover = { data: new Uint8Array([137, 80, 78, 71, 1, 2, 3]), mimeType: 'image/png' }

const manuscript: BuiltManuscript = {
  totalWords: 6, totalScenes: 3, writtenScenes: 2,
  chapters: [
    {
      id: 'c1', number: 1, title: 'The Gate', synopsis: '', wordCount: 4, wordGoal: null, writtenScenes: 2,
      scenes: [
        { eventId: 'e1', title: 'Arrival', text: 'The gate stood open.\n\nNo one waited.', wordCount: 6, written: true, status: 'draft' },
        { eventId: 'e2', title: 'Empty', text: '', wordCount: 0, written: false, status: 'draft' },
      ],
    },
    {
      id: 'c2', number: 2, title: 'The Road', synopsis: '', wordCount: 2, wordGoal: null, writtenScenes: 1,
      scenes: [{ eventId: 'e3', title: 'Onward', text: 'They walked north.', wordCount: 3, written: true, status: 'draft' }],
    },
  ],
}

describe('compileDocx', () => {
  it('produces a docx zip with the required OOXML parts and the prose', () => {
    const s = dec.decode(compileDocx(manuscript, { title: 'My Book', author: 'A. Writer' }))
    expect(s.startsWith('PK\x03\x04')).toBe(true)
    expect(s.includes('[Content_Types].xml')).toBe(true)
    expect(s.includes('word/document.xml')).toBe(true)
    // Title, chapter heading, and prose all made it in.
    expect(s.includes('My Book')).toBe(true)
    // (heading em-dash is multi-byte UTF-8, so match ASCII fragments under latin1 decode)
    expect(s.includes('Ch. 1 ')).toBe(true)
    expect(s.includes('The Gate')).toBe(true)
    expect(s.includes('The gate stood open.')).toBe(true)
    expect(s.includes('They walked north.')).toBe(true)
  })

  it('omits unwritten scenes by default and keeps them when asked', () => {
    const skip = dec.decode(compileDocx(manuscript))
    expect(skip.includes('[No prose yet]')).toBe(false)
    const keep = dec.decode(compileDocx(manuscript, { onlyWritten: false }))
    expect(keep.includes('[No prose yet]')).toBe(true)
  })

  it('embeds the world cover on the Word title page', () => {
    const s = dec.decode(compileDocx(manuscript, { cover }))
    expect(s.includes('word/media/cover.png')).toBe(true)
    expect(s.includes('relationships/image')).toBe(true)
    expect(s.includes('rIdCover')).toBe(true)
  })
})

describe('compileEpub', () => {
  it('produces an epub with mimetype first, container, opf, nav and a file per chapter', () => {
    const bytes = compileEpub(manuscript, { title: 'My Book', author: 'A. Writer' })
    const s = dec.decode(bytes)
    // EPUB requires the mimetype entry first.
    expect(s.indexOf('mimetype')).toBeLessThan(s.indexOf('META-INF/container.xml'))
    expect(s.includes('application/epub+zip')).toBe(true)
    expect(s.includes('OEBPS/content.opf')).toBe(true)
    expect(s.includes('nav.xhtml')).toBe(true)
    // One xhtml per included chapter (ch2 has prose → present).
    expect(s.includes('OEBPS/ch1.xhtml')).toBe(true)
    expect(s.includes('OEBPS/ch2.xhtml')).toBe(true)
    // Metadata + prose.
    expect(s.includes('<dc:title>My Book</dc:title>')).toBe(true)
    expect(s.includes('They walked north.')).toBe(true)
    expect(s.includes('dcterms:modified')).toBe(true)
  })

  it('embeds and declares the world cover in EPUB', () => {
    const s = dec.decode(compileEpub(manuscript, { title: 'My Book', cover }))
    expect(s.includes('OEBPS/cover.png')).toBe(true)
    expect(s.includes('properties="cover-image"')).toBe(true)
    expect(s.includes('<img src="cover.png" alt="My Book cover"')).toBe(true)
  })
})

/**
 * Gutenberg's `_italics_` reach Word and the e-reader.
 *
 * A reader who exports a Library book was getting the underscores on the page
 * of their e-reader too, which is the one place the app cannot come back and
 * fix afterwards.
 */
describe('underscored emphasis in the binary formats', () => {
  const italic: BuiltManuscript = {
    totalWords: 5, totalScenes: 2, writtenScenes: 2,
    chapters: [{
      id: 'c1', number: 1, title: 'The Gate', synopsis: '', wordCount: 5, wordGoal: null, writtenScenes: 2,
      scenes: [
        { eventId: 'e1', title: 'One', text: 'She read the _Times_ & wept.', wordCount: 6, written: true, status: 'draft' },
        { eventId: 'e2', title: 'Two', text: 'Nothing emphatic here.', wordCount: 3, written: true, status: 'draft' },
      ],
    }],
  }

  it('becomes an italic run in Word, and the underscores are gone', () => {
    const xml = dec.decode(compileDocx(italic, { title: 'Book' }))
    expect(xml).toContain('<w:i/>')
    expect(xml).toContain('<w:t xml:space="preserve">Times</w:t>')
    expect(xml).not.toContain('_Times_')
    expect(xml).toContain('&amp;')
  })

  it('leaves Word\'s own text unitalicised, including the scene separator', () => {
    /*
      The absence beside the presence. `* * *` is emitted by this file, not by
      the author, and a parser let loose on everything would be reaching into
      the app's own furniture. Two scenes above, so a separator is emitted.

      The title and author carry underscores here because that is the only input
      that tells the two apart: with a plain title, parsing everything and
      parsing only the prose produce identical documents, and the `emphasis`
      flag would be a claim no test could check. A writer may well call their
      book *The _Times_ Chronicle*, and the title page should say so.
    */
    const xml = dec.decode(compileDocx(italic, { title: 'The _Times_ Chronicle', author: 'A. _Writer_' }))
    expect(xml, 'the title is printed as typed').toContain('The _Times_ Chronicle')
    expect(xml, 'and so is the author').toContain('A. _Writer_')
    // The separator's own <w:p>, not a fixed window back — a 200-character
    // slice reached into the previous paragraph, which is italic and rightly so.
    const at = xml.indexOf('* * *')
    const sep = xml.slice(xml.lastIndexOf('<w:p>', at), at)
    expect(sep, 'the separator paragraph carries no italic run').not.toContain('<w:i/>')
    // And exactly one italic run in the whole document — the one in the prose.
    expect(xml.split('<w:i/>').length - 1).toBe(1)
  })

  it('becomes <em> in EPUB', () => {
    const zip = dec.decode(compileEpub(italic, { title: 'Book' }))
    expect(zip).toContain('<em>Times</em>')
    expect(zip).not.toContain('_Times_')
    expect(zip).toContain('&amp;')
  })
})

/**
 * DOCX and EPUB compile separately from markdown, so the status threshold has
 * to be proven on *their* path too. `includedChapters` used to hold its own
 * copy of the filter; it now calls the shared `scenesForExport`, and this is
 * what stops that wiring being dropped.
 */
describe('exporting only the scenes that are ready', () => {
  const m = {
    chapters: [{
      id: 'c1', number: 1, title: 'One', synopsis: '', wordCount: 4, wordGoal: null, writtenScenes: 2,
      scenes: [
        { eventId: 'e1', title: 'Done', text: 'Polished prose.', wordCount: 2, written: true, status: 'final' },
        { eventId: 'e2', title: 'Rough', text: 'Unready prose.', wordCount: 2, written: true, status: 'draft' },
      ],
    }],
    totalWords: 4, totalScenes: 2, writtenScenes: 2,
  } as never

  const text = (bytes: Uint8Array) => new TextDecoder().decode(bytes)

  it('leaves the unready scene out of a DOCX', () => {
    const out = text(compileDocx(m, { minStatus: 'final' }))
    expect(out).toContain('Polished prose.')
    expect(out).not.toContain('Unready prose.')
  })

  it('and keeps it when no stage is asked for', () => {
    // The pair, on the same document — otherwise "not present" could be true
    // because the DOCX writer never carried the text at all.
    const out = text(compileDocx(m, {}))
    expect(out).toContain('Polished prose.')
    expect(out).toContain('Unready prose.')
  })

  it('leaves the unready scene out of an EPUB too', () => {
    const out = text(compileEpub(m, { minStatus: 'final' }))
    expect(out).toContain('Polished prose.')
    expect(out).not.toContain('Unready prose.')
  })
})
