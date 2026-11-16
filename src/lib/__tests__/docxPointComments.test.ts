import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { readEditedDocx, type DocParagraph } from '@/lib/docxRead'
import { docScenes, withChangesMade } from '@/lib/docxEdits'
import { planImport } from '@/lib/docxImport'
import { compileDocx } from '@/lib/manuscriptExport'
import { readZip, zipStore } from '@/lib/zip'
import type { BuiltManuscript } from '@/lib/manuscriptCompile'
import type { DraftBook } from '@/lib/bookDraft'

/*
  A comment with no range (round-trip-plan-3.md, T9.1).

  Word gives every comment a range of words. LibreOffice does not: a comment
  made with nothing selected is saved as a reference alone, and so is one it
  reads on no words. The reader placed a comment by its range, so such a
  comment was never read:
  - the threads the marked export puts at a scene's start, where their words
    were rewritten — 5 of the second loop's round 2 and 10 of round 3 never
    came back in, and a reply to one, or its resolving, would have been lost
    without a word (loop-2026-11-12.md, finding 3);
  - any comment an editor makes in LibreOffice without selecting.
*/

const F = path.join(__dirname, 'fixtures/docx/run-2026-11-12-loop2')
const bytes = (f: string) => new Uint8Array(readFileSync(path.join(F, f)))
const draft = (n: string) => (JSON.parse(readFileSync(path.join(F, `draft-${n}.json`), 'utf8')) as { book: DraftBook }).book
const marksOf = (p: DocParagraph) => p.pieces.map((x) => ('text' in x ? x.text.slice(0, 12) : `<${x.kind} ${x.id}>`))

describe('a comment LibreOffice saved with no range', () => {
  /*
    `libreoffice-point-comment.docx`: the run's first file, opened in LibreOffice
    24.2, a comment made with the cursor before "with his watch open" and nothing
    selected, saved as Word (`scripts/lo-comment.py … point`).
  */
  it('is in the file as a reference alone, and is read as a comment at that point', async () => {
    const zip = await readZip(bytes('libreoffice-point-comment.docx'))
    const xml = new TextDecoder().decode(zip.get('word/document.xml'))
    expect(xml.match(/<w:commentReference /g)).toHaveLength(1)
    expect(xml).not.toMatch(/<w:commentRangeStart |<w:commentRangeEnd /)

    const doc = await readEditedDocx(bytes('libreoffice-point-comment.docx'))
    expect(doc.comments.map((c) => [c.author, c.text])).toEqual([['Ines Marlowe', 'Nothing selected.']])
    const [scene] = docScenes(doc)
    expect(scene.comments).toHaveLength(1)
    // On no words, just before "with".
    expect(scene.comments[0].start).toBe(scene.comments[0].end)
    expect(scene.edited.slice(scene.comments[0].start, scene.comments[0].start + 19)).toBe('with his watch open')
  })

  it('comes in as a note on the word it stands before, with what is around it', async () => {
    const doc = await readEditedDocx(bytes('libreoffice-point-comment.docx'))
    const sent = draft('sent-1')
    const plan = planImport(doc, sent, sent)
    const comments = plan.scenes.flatMap((s) => s.comments)
    expect(comments.map((c) => [c.author, c.text, c.quote])).toEqual([['Ines Marlowe', 'Nothing selected.', 'with']])
    expect(comments[0].prefix.endsWith('at the top of it ')).toBe(true)
    expect(comments[0].suffix.startsWith(' his watch open in his palm')).toBe(true)
  })
})

describe('the second loop’s files, which held threads the reader did not see', () => {
  /** A file the editor returned, read as bringing it in reads it: the writer's changes made, planned against the draft it went out from. */
  const planned = async (file: string, went: string) => {
    const read = await readEditedDocx(bytes(file))
    const book = draft(went)
    const plan = planImport(read.markedBy ? withChangesMade(read, read.markedBy) : read, book, book)
    const threads = plan.scenes.flatMap((s) => s.comments)
    return { inFile: read.comments.length, threads: threads.length, replies: threads.reduce((n, c) => n + c.replies.length, 0), rewritten: threads.filter((c) => c.text.startsWith('On words since rewritten')).length }
  }

  it('round 2: 84 comments, and every one is read — 53 threads and 31 replies, where it was 48 and 29', async () => {
    expect(await planned('round2-from-editor.docx', 'marked-2')).toEqual({ inFile: 84, threads: 53, replies: 31, rewritten: 5 })
  })

  it('round 3: 102 comments — 59 threads and 43 replies, where it was 49 and 37', async () => {
    expect(await planned('round3-from-editor.docx', 'marked-3')).toEqual({ inFile: 102, threads: 59, replies: 43, rewritten: 10 })
  })

  it('round 1, where every comment had its range, is as it was: 38 in the scenes and the one on a heading', async () => {
    const read = await readEditedDocx(bytes('round1-from-editor.docx'))
    const book = draft('sent-1')
    const plan = planImport(read, book, book)
    expect(plan.scenes.flatMap((s) => s.comments)).toHaveLength(38)
    expect(plan.outside.flatMap((o) => o.comments ?? [])).toHaveLength(1)
  })
})

describe('the reader, on the file’s own marks', () => {
  const one: BuiltManuscript = {
    totalWords: 0, totalScenes: 1, writtenScenes: 1,
    chapters: [{ id: 'c', number: 1, title: 'C', synopsis: '', wordCount: 0, wordGoal: null, writtenScenes: 1, scenes: [{ eventId: 'e', title: 'S', text: 'The fog came in.\n\nShe counted.', wordCount: 0, written: true, status: 'draft' }] }],
  }
  const run = (t: string) => `<w:r><w:t xml:space="preserve">${t}</w:t></w:r>`
  /** The book's file with one paragraph's run replaced (its first, unless said), and a comment each for the ids given. */
  const fileWith = async (first: string, ids: string[], of = 'The fog came in.') => {
    const zip = await readZip(compileDocx(one, { forEditing: { draftId: 'D', worldId: 'W', sceneIndex: () => 0 } }))
    const dec = new TextDecoder()
    const enc = new TextEncoder()
    const doc = dec.decode(zip.get('word/document.xml'))
    if (!doc.includes(run(of))) throw new Error('the paragraph is not written as one run')
    const parts = new Map(zip)
    parts.set('word/document.xml', enc.encode(doc.replace(run(of), first)))
    parts.set('word/comments.xml', enc.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:comments xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">${ids.map((id) => `<w:comment w:id="${id}" w:author="Ana Editor" w:initials="AE"><w:p>${run(`Comment ${id}.`)}</w:p></w:comment>`).join('')}</w:comments>`))
    parts.set('[Content_Types].xml', enc.encode(dec.decode(zip.get('[Content_Types].xml')).replace('</Types>', '<Override PartName="/word/comments.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml"/></Types>')))
    parts.set('word/_rels/document.xml.rels', enc.encode(dec.decode(zip.get('word/_rels/document.xml.rels')).replace('</Relationships>', '<Relationship Id="rIdComments" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments" Target="comments.xml"/></Relationships>')))
    return zipStore([...parts].map(([name, data]) => ({ name, data })))
  }
  const ref = (id: string) => `<w:r><w:commentReference w:id="${id}"/></w:r>`
  const firstProse = async (b: Uint8Array) => (await readEditedDocx(b)).paragraphs.find((p) => p.scene === 0)!

  it('a reference with no range is a comment at that point; one with its range is read by the range, and not twice', async () => {
    const bare = await firstProse(await fileWith(`${run('The fog ')}${ref('4')}${run('came in.')}`, ['4']))
    expect(marksOf(bare)).toEqual(['The fog ', '<commentStart 4>', '<commentEnd 4>', 'came in.'])
    const ranged = await firstProse(await fileWith(`${run('The ')}<w:commentRangeStart w:id="4"/>${run('fog')}<w:commentRangeEnd w:id="4"/>${ref('4')}${run(' came in.')}`, ['4']))
    expect(marksOf(ranged)).toEqual(['The ', '<commentStart 4>', 'fog', '<commentEnd 4>', ' came in.'])
  })

  it('two with no range in one paragraph each stand where they were made, beside one that has its range', async () => {
    const p = await firstProse(await fileWith(`${ref('1')}${run('The ')}<w:commentRangeStart w:id="2"/>${run('fog')}<w:commentRangeEnd w:id="2"/>${ref('2')}${run(' came ')}${ref('3')}${run('in.')}`, ['1', '2', '3']))
    expect(marksOf(p)).toEqual(['<commentStart 1>', '<commentEnd 1>', 'The ', '<commentStart 2>', 'fog', '<commentEnd 2>', ' came ', '<commentStart 3>', '<commentEnd 3>', 'in.'])
  })

  it('at the scene’s start it is on the first word, and after its last word, on that word: neither is dropped', async () => {
    const book: DraftBook = { version: 1, chapters: [{ id: 'c', number: 1, title: 'C', timelineId: 't', scenes: [{ id: 'e', title: 'S', text: 'The fog came in.\n\nShe counted.' }] }] }
    const quotes = async (first: string, ids: string[], of?: string) => planImport(await readEditedDocx(await fileWith(first, ids, of)), book, book).scenes.flatMap((s) => s.comments.map((c) => [c.text, c.quote]))
    expect(await quotes(`${ref('1')}${run('The fog came in.')}`, ['1'])).toEqual([['Comment 1.', 'The']])
    // At a paragraph's end with another after it, it is before that one's first word.
    expect(await quotes(`${run('The fog came in.')}${ref('2')}`, ['2'])).toEqual([['Comment 2.', 'She']])
    // After the scene's last word there is no word to stand before.
    expect(await quotes(`${run('She counted.')}${ref('3')}`, ['3'], 'She counted.')).toEqual([['Comment 3.', 'counted.']])
  })
})
