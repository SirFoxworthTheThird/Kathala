import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { compileDocx } from '@/lib/manuscriptExport'
import { readStoredZip } from '@/lib/zip'
import { readEditedDocx } from '@/lib/docxRead'
import { applyHunk, planImport, tryChange } from '@/lib/docxImport'
import { loneLineEnds, paragraphBlocks } from '@/lib/manuscriptParagraphs'
import type { BuiltManuscript } from '@/lib/manuscriptCompile'
import type { DraftBook } from '@/lib/bookDraft'

/*
  One Enter (round-trip-plan-3.md, T12.1, D-11). The second loop's writer typed
  "The lamp-room" on the Page with one Enter between its twelve paragraphs. The
  Page showed paragraphs; Read ran them into one; the Word file held one
  paragraph with eleven line breaks in it. D-11: a single Enter stays a line,
  and Word reads it as Read does.

  The scene as typed is the run's own, its blank lines taken back out to single
  line ends: the writer repaired it before sending, and the .pwk keeps the
  repair (docs/records/writer-run-2026-11-10-loop2.pwk).
*/

const LAMP = readFileSync(path.join(__dirname, 'fixtures/docx/run-2026-11-12-loop2/lamp-room-typed.txt'), 'utf8').trim()

const book = (text: string): BuiltManuscript => ({
  totalWords: 100, totalScenes: 1, writtenScenes: 1,
  chapters: [{
    id: 'c1', number: 1, title: 'The Lamp', synopsis: '', wordCount: 100, wordGoal: null, writtenScenes: 1,
    scenes: [{ eventId: 'e1', title: 'The lamp-room', text, wordCount: 100, written: true, status: 'draft' }],
  }],
})
const draft = (text: string): DraftBook => ({ version: 1, chapters: [{ id: 'c1', number: 1, title: 'The Lamp', timelineId: 't', scenes: [{ id: 'e1', title: 'The lamp-room', text }] }] })
const forEditing = { draftId: 'D', worldId: 'W', sceneIndex: () => 0 }
const documentXml = (bytes: Uint8Array) => new TextDecoder().decode(readStoredZip(bytes).get('word/document.xml'))
/** The body paragraphs with words in them, each as its text, `|` for a line break. */
const bodyParagraphs = (xml: string) => [...xml.matchAll(/<w:p>(.*?)<\/w:p>/g)]
  .map((m) => m[1].replace(/<w:br\/>/g, '|').replace(/<w:t[^>]*>([^<]*)<\/w:t>/g, '$1').replace(/<[^>]+>/g, ''))
  .filter((t) => t.includes('ladder') || t.includes('|'))

describe('a single Enter, in Word as in Read', () => {
  it('the run’s scene, typed with one Enter between its paragraphs, is one paragraph in Word with no line break in it, as Read has it', () => {
    expect(LAMP.split('\n')).toHaveLength(12)
    expect(LAMP).not.toContain('\n\n')
    const paras = bodyParagraphs(documentXml(compileDocx(book(LAMP))))
    expect(paras).toHaveLength(1)
    expect(paras[0]).not.toContain('|')
    // Read's paragraph, word for word: the lines joined with a space.
    const read = paragraphBlocks(LAMP)
    expect(read).toHaveLength(1)
    expect(paras[0].replace(/&quot;/g, '"').replace(/&amp;/g, '&')).toBe(read[0].text)
    expect(read[0].text).toContain('had not moved. He was sitting')
    expect(read[0].text).toContain('and he did not look round. "He knew I was up there," Tamsin said.')
  })

  it('spaces either side of a line end are one space; a blank line is still a paragraph', () => {
    expect(paragraphBlocks('She waited.  \n  Nobody came.\n\nMorning.')).toEqual([
      { text: 'She waited. Nobody came.', verse: false },
      { text: 'Morning.', verse: false },
    ])
  })

  it('verse keeps its lines, in Word as everywhere', () => {
    const xml = documentXml(compileDocx(book('The ladder was cold.\n\n  The tide goes out,\n  the tide comes in,\n  and nobody minds the ladder.')))
    const verse = [...xml.matchAll(/<w:p><w:pPr><w:pStyle w:val="Verse"\/><\/w:pPr>(.*?)<\/w:p>/g)].map((m) => m[1])
    expect(verse).toHaveLength(1)
    expect(verse[0].match(/<w:br\/>/g)).toHaveLength(2)
  })
})

describe('the file brought back', () => {
  it('unchanged: nothing to decide, though the scene has line ends where the file has spaces', async () => {
    const doc = await readEditedDocx(compileDocx(book(LAMP), { forEditing }))
    const [scene] = planImport(doc, draft(LAMP), draft(LAMP)).scenes
    expect(scene?.tracked ?? []).toEqual([])
    expect(scene?.untracked ?? []).toEqual([])
  })

  it('an edit across a joined line end is made in the scene, and the scene keeps its line ends', async () => {
    const sent = compileDocx(book(LAMP), { forEditing })
    // The editor's edit, made with tracking off, to words either side of the scene's first line end.
    const xml = documentXml(sent).replace('had not moved. He was sitting', 'had not moved at all. He was sitting')
    expect(xml).toContain('had not moved at all.')
    const files = readStoredZip(sent)
    files.set('word/document.xml', new TextEncoder().encode(xml))
    const { zipStore } = await import('@/lib/zip')
    const doc = await readEditedDocx(zipStore([...files].map(([name, data]) => ({ name, data }))))
    const [scene] = planImport(doc, draft(LAMP), draft(LAMP)).scenes
    expect(scene.untracked).toHaveLength(1)
    const tried = tryChange([{ ...scene.untracked[0], eventId: 'e1' }], () => LAMP)
    expect(tried.result).toBe('ok')
    const after = tried.result === 'ok' ? tried.after.get('e1')! : ''
    expect(after).toContain('had not moved at all.')
    expect(after.split('\n')).toHaveLength(12)
  })

  it('a change from the file finds its place across a line end the scene has and the file has as a space', () => {
    const prose = 'Mira left before dawn.\nThe road was hers now, and the town behind her.'
    const hunk = { before: 'road', after: 'lane', prefix: 'Mira left before dawn. The ', suffix: ' was hers now, and the town' }
    expect(applyHunk(prose, hunk)).toBe('Mira left before dawn.\nThe lane was hers now, and the town behind her.')
    // A line end either side of it: the words around it are the file's only with the line ends read as spaces.
    const lines = 'Mira left before dawn, and the\nroad\nwas hers now, and the town behind her.'
    const close = { before: 'road', after: 'lane', prefix: 'Mira left before dawn, and the ', suffix: ' was hers now, and the town' }
    expect(applyHunk(lines, close)).toBe('Mira left before dawn, and the\nlane\nwas hers now, and the town behind her.')
  })
})

describe('loneLineEnds: where the Page marks a single Enter', () => {
  it('each single line end inside a prose paragraph, and none between paragraphs, at a paragraph’s ends, or in verse', () => {
    const text = 'One.\nTwo.\n\nThree.\n\n  A line,\n  another.\n\nFour.\n'
    const at = loneLineEnds(text)
    expect(at.map((i) => text[i])).toEqual(['\n'])
    expect(at).toEqual([text.indexOf('\nTwo')])
    // The run's scene: its eleven, one before each paragraph after the first.
    expect(loneLineEnds(LAMP)).toHaveLength(11)
    expect(loneLineEnds('Alone.')).toEqual([])
    // Spaces around a line end, and a blank line of spaces between paragraphs.
    const spaced = 'One. \n Two.\n   \nThree.'
    expect(loneLineEnds(spaced)).toEqual([spaced.indexOf('\n')])
    // Prose that starts with a line end: its place counted from the start of the text, not of the paragraph's words.
    expect(loneLineEnds('\nOne.\nTwo.')).toEqual([5])
  })
})
