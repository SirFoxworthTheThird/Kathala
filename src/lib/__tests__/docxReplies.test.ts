import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { readEditedDocx } from '@/lib/docxRead'
import { readZip } from '@/lib/zip'

/*
  Word's own reply comments (round-trip-plan-2.md, T5.0): a file Microsoft Word
  16 saved, from the R package officer's tests (MIT; see the fixture's README).
  Before the export writes a reply, the shape it has to match, and the proof
  that the reader already takes Word's replies as Word means them.
*/
const file = () => new Uint8Array(readFileSync(path.join(__dirname, 'fixtures/docx/word-replies/word16-replies.docx')))

describe('Word’s own reply comments (round-trip-plan-2.md, T5.0)', () => {
  it('are read as replies under the comment they answer; a reply to a reply hangs under the thread’s first comment, as Word puts it', async () => {
    const doc = await readEditedDocx(file())
    expect(doc.comments).toHaveLength(16)
    const parent = Object.fromEntries(doc.comments.filter((c) => c.parentId).map((c) => [c.id, c.parentId]))
    expect(parent).toEqual({ 8: '7', 9: '7', 11: '10', 13: '12' })
    expect(doc.comments.find((c) => c.id === '7')?.text).toBe('A comment with replies.')
    expect(doc.comments.find((c) => c.id === '9')?.text).toBe('Reply to reply.')
    // And each with the date Word gave it (round-trip-plan-3.md, T9.3).
    expect(doc.comments.every((c) => /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(c.date ?? ''))).toBe(true)
    expect(doc.comments.find((c) => c.id === '0')?.date).toBe('2023-06-01T00:00:00Z')
  })

  it('in the shape the export must write: each reply its own range and reference; linked by the paragraph ids of commentsExtended; done marked on every one', async () => {
    const zip = await readZip(file())
    const text = (name: string) => new TextDecoder().decode(zip.get(name))
    const document = text('word/document.xml')
    const comments = text('word/comments.xml')
    const extended = text('word/commentsExtended.xml')
    const count = (s: string, re: RegExp) => (s.match(re) ?? []).length
    expect(count(comments, /<w:comment /g)).toBe(16)
    // Every comment, reply or not, has its own range and reference in the text.
    expect(count(document, /<w:commentRangeStart /g)).toBe(16)
    expect(count(document, /<w:commentReference /g)).toBe(16)
    // The link: a reply's last paragraph's w14:paraId, pointing at its parent's.
    expect(count(extended, /<w15:commentEx /g)).toBe(16)
    expect(count(extended, /w15:paraIdParent=/g)).toBe(4)
    expect(count(extended, /w15:done="0"/g)).toBe(16)
    expect(comments).toMatch(/<w:p [^>]*w14:paraId="22D76975"/)
    // The parts Word 2019 adds, which a reader does not need to thread them.
    expect([...zip.keys()].filter((n) => /comments|people/.test(n)).sort()).toEqual([
      'word/comments.xml', 'word/commentsExtended.xml', 'word/commentsExtensible.xml', 'word/commentsIds.xml', 'word/people.xml',
    ])
  })
})

/*
  A file marked as T5 will mark it (`npm run probe:marked`): the writer's
  tracked changes, the editor's comments with her replies, one thread
  resolved — and that file opened and saved by LibreOffice 24.2. LibreOffice
  renumbers the comments, putting each reply before the comment it answers,
  and writes no done flag for an open thread. The threads come through.
*/
describe('a marked file through LibreOffice (round-trip-plan-2.md, T5.0)', () => {
  const loop = (name: string) => new Uint8Array(readFileSync(path.join(__dirname, 'fixtures/docx/run-2026-11-10-loop', name)))
  const threads = async (name: string) => {
    const doc = await readEditedDocx(loop(name))
    return doc.comments.filter((c) => !c.parentId).map((c) => [c.author, c.text, doc.comments.filter((r) => r.parentId === c.id).map((r) => `${r.author}: ${r.text}`)]).sort()
  }

  it('reads the same threads, each reply under its comment, as made and as LibreOffice saved it', async () => {
    const made = await threads('marked-as-made.docx')
    expect(made).toEqual([
      ['Jonah Pryce', 'Lovely. Keep.', ['Nell Garrow: Thank you.']],
      ['Jonah Pryce', 'Which hour? Ch. 2 says it lifted at dawn.', ['Nell Garrow: Before dawn, both places now.']],
    ])
    expect(await threads('marked-through-libreoffice.docx')).toEqual(made)
    // LibreOffice's order: a reply first, then the comment it answers.
    const saved = await readEditedDocx(loop('marked-through-libreoffice.docx'))
    expect(saved.comments.map((c) => c.parentId ?? null)).toEqual(['1', null, '3', null])
  })
})

