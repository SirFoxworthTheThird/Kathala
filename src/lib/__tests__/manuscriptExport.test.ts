import { describe, it, expect } from 'vitest'
import { compileDocx, compileEpub } from '@/lib/manuscriptExport'
import type { BuiltManuscript } from '@/lib/manuscriptCompile'

const dec = new TextDecoder('latin1')

const manuscript: BuiltManuscript = {
  totalWords: 6, totalScenes: 3, writtenScenes: 2,
  chapters: [
    {
      id: 'c1', number: 1, title: 'The Gate', synopsis: '', wordCount: 4, wordGoal: null, writtenScenes: 2,
      scenes: [
        { eventId: 'e1', title: 'Arrival', text: 'The gate stood open.\n\nNo one waited.', wordCount: 6, written: true },
        { eventId: 'e2', title: 'Empty', text: '', wordCount: 0, written: false },
      ],
    },
    {
      id: 'c2', number: 2, title: 'The Road', synopsis: '', wordCount: 2, wordGoal: null, writtenScenes: 1,
      scenes: [{ eventId: 'e3', title: 'Onward', text: 'They walked north.', wordCount: 3, written: true }],
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
})
