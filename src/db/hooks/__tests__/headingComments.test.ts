import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { db } from '@/db/database'
import { createTimeline, createChapter } from '@/db/hooks/useTimeline'
import { setSceneText } from '@/db/hooks/useManuscript'
import { currentBook, openBookDraft, saveBookDraft } from '@/db/hooks/useBookDrafts'
import { importEditedFile } from '@/db/hooks/useEditImport'
import { replyToProseNote, setProseNoteResolved } from '@/db/hooks/useProseNotes'
import { compileDocx, type BookExportOptions } from '@/lib/manuscriptExport'
import { markedPlan } from '@/lib/markedDocx'
import { readEditedDocx } from '@/lib/docxRead'
import { outsideScenes } from '@/lib/docxEdits'
import { placeNotes } from '@/lib/noteAnchor'
import { readZip, zipStore } from '@/lib/zip'

/*
  A comment on a chapter's heading, or on the title page, is a note
  (round-trip-plan-3.md, T9.4; D-9): answered and resolved like any other, and
  sent back on its line. Before, it was a row in Changes to read and dismiss,
  and the editor never heard of it again.
*/

const TITLE = 'The Salt Ledger'
const E1 = 'The ferry left at dawn.\n\nMira counted the crates twice.'
const E2 = 'The boy waited on the quay.\n\nHe had a ledger under his arm.'
const dec = new TextDecoder()
const enc = new TextEncoder()

beforeEach(async () => {
  await db.delete()
  await db.open()
})
afterAll(async () => { await db.delete() })

/** Two chapters of one scene each: e1 under "The Weighing House", e2 under "The Quay". */
async function theBook() {
  const now = Date.now()
  await db.worlds.add({ id: 'W1', name: TITLE, description: '', coverImageId: null, theme: null, continuityStaleThreshold: 5, calendar: null, pinsSetClock: true, createdAt: now, updatedAt: now })
  const timeline = await createTimeline({ worldId: 'W1', name: 'Main', description: '', color: '#888' })
  for (const [n, title, id, text] of [[1, 'The Weighing House', 'e1', E1], [2, 'The Quay', 'e2', E2]] as const) {
    const chapter = await createChapter({ worldId: 'W1', timelineId: timeline.id, number: n, title, synopsis: '' })
    await db.events.add({
      id, worldId: 'W1', chapterId: chapter.id, timelineId: timeline.id, title: id, description: '', sortOrder: 0,
      locationMarkerId: null, involvedCharacterIds: [], involvedItemIds: [], mentionedCharacterIds: [], tags: [],
      travelDays: null, inWorldTime: null, tension: null, structureBeat: null, threadIds: [], status: 'draft', povCharacterId: null, isFlashback: false,
      createdAt: now, updatedAt: now,
    } as never)
    await setSceneText('W1', id, text)
  }
}

/** The book as a file for an editor: plain the first time, marked against the draft the editor sent back after that. */
async function send(name: string, opts: Partial<BookExportOptions> = {}) {
  const sent = await saveBookDraft('W1', name, Date.now(), { sentAs: `${name}.docx` })
  const book = await currentBook('W1')
  const scenes = book.chapters.flatMap((c) => c.scenes)
  const against = (await db.bookDrafts.toArray()).find((d) => d.sentBack)
  const plan = against
    ? markedPlan({ sentBack: against, base: await openBookDraft(against), scenes: scenes.map((sc) => ({ eventId: sc.id, text: sc.text })), notes: await db.proseNotes.toArray(), author: 'Ruth Callan', now: Date.now() })
    : null
  return compileDocx({
    totalWords: 0, totalScenes: scenes.length, writtenScenes: scenes.length,
    chapters: book.chapters.map((c) => ({ id: c.id, number: c.number, title: c.title, synopsis: '', wordCount: 0, wordGoal: null, writtenScenes: c.scenes.length,
      scenes: c.scenes.map((sc) => ({ eventId: sc.id, title: sc.title, text: sc.text, wordCount: 0, written: true, status: 'draft' as const })) })),
  }, { title: TITLE, author: 'Ruth Callan', ...opts, forEditing: { draftId: sent.id, worldId: 'W1', sceneIndex: (id) => scenes.findIndex((sc) => sc.id === id), ...(plan ? { marked: plan.marked } : {}) } })
}

const run = (t: string) => `<w:r><w:t xml:space="preserve">${t}</w:t></w:r>`
const para = (style: string, text: string) => new RegExp(`(<w:p><w:pPr><w:pStyle w:val="${style}"/>(?:(?!</w:pPr>).)*</w:pPr>)(${run(text).replace(/[.*+?^$()|[\]\\]/g, '\\$&')})(</w:p>)`)

/** The editor's Word: a comment each on the lines given, in a file that had none. */
async function commented(bytes: Uint8Array, on: Array<{ style: string; line: string; id: string; text: string }>) {
  const zip = await readZip(bytes)
  let doc = dec.decode(zip.get('word/document.xml'))
  for (const c of on) {
    if (!para(c.style, c.line).test(doc)) throw new Error(`no ${c.style} line “${c.line}” in the file`)
    doc = doc.replace(para(c.style, c.line), `$1<w:commentRangeStart w:id="${c.id}"/>$2<w:commentRangeEnd w:id="${c.id}"/><w:r><w:commentReference w:id="${c.id}"/></w:r>$3`)
  }
  const parts = new Map(zip)
  parts.set('word/document.xml', enc.encode(doc))
  parts.set('word/comments.xml', enc.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:comments xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">${on.map((c) => `<w:comment w:id="${c.id}" w:author="Ana Editor" w:date="2026-11-11T09:00:00Z" w:initials="AE"><w:p>${run(c.text)}</w:p></w:comment>`).join('')}</w:comments>`))
  parts.set('[Content_Types].xml', enc.encode(dec.decode(zip.get('[Content_Types].xml')).replace('</Types>', '<Override PartName="/word/comments.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml"/></Types>')))
  parts.set('word/_rels/document.xml.rels', enc.encode(dec.decode(zip.get('word/_rels/document.xml.rels')).replace('</Relationships>', '<Relationship Id="rIdComments" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments" Target="comments.xml"/></Relationships>')))
  return zipStore([...parts].map(([name, data]) => ({ name, data })))
}

const HEADING = 'Ch. 2 — The Quay'
const ON_HEADING = { style: 'Heading1', line: HEADING, id: '94', text: 'House style: spell the chapter numbers out.' }
const ON_TITLE = { style: 'Title', line: TITLE, id: '95', text: 'Is this the final title?' }

/** Each comment in a file, by the line it is on: the lines outside the scenes, and the scenes by their number. */
async function threadsOf(bytes: Uint8Array) {
  const doc = await readEditedDocx(bytes)
  const said = (id: string) => {
    const root = doc.comments.find((c) => c.id === id)!
    return [root, ...doc.comments.filter((c) => c.parentId === id)].map((c) => `${c.author}: ${c.text}`)
  }
  const roots = (ids: string[]) => ids.filter((id) => !doc.comments.find((c) => c.id === id)!.parentId)
  return {
    outside: outsideScenes(doc).flatMap((o) => roots(o.commentIds).map((id) => ({ where: o.where, line: o.after, said: said(id), done: doc.comments.find((c) => c.id === id)!.done ?? false }))),
    // A heading is numbered with the scene before it, so it is told by its style.
    inScenes: doc.paragraphs.flatMap((p) => (p.scene === null || /^(Heading|Title|Byline|Contact)/.test(p.style) ? [] : roots(p.pieces.flatMap((x) => (x.kind === 'commentStart' ? [x.id] : []))).map((id) => ({ scene: p.scene, said: said(id) })))),
  }
}

describe('a comment on a chapter’s heading or the title page (round-trip-plan-3.md, T9.4)', () => {
  it('comes in as a note on that line, in the first scene after it, and as no row in Changes', async () => {
    await theBook()
    const result = await importEditedFile('W1', await commented(await send('first'), [ON_HEADING, ON_TITLE]), 'ledger-ana.docx')
    expect(result).toMatchObject({ suggestions: 0, notes: 2, outsideNotes: 2 })
    expect(await db.editSuggestions.count()).toBe(0)
    const notes = (await db.proseNotes.toArray()).map((n) => [n.outside, n.eventId, n.quote, n.body, n.author.name, n.createdAt === Date.parse('2026-11-11T09:00:00Z')])
    expect(notes).toEqual(expect.arrayContaining([
      ['heading', 'e2', HEADING, ON_HEADING.text, 'Ana Editor', true],
      ['title page', 'e1', TITLE, ON_TITLE.text, 'Ana Editor', true],
    ]))
    expect(notes).toHaveLength(2)
  })

  it('is never placed on the Page, though its scene says the same words', async () => {
    await theBook()
    await importEditedFile('W1', await commented(await send('first'), [ON_HEADING]), 'ledger-ana.docx')
    const [note] = await db.proseNotes.toArray()
    // The scene under that heading comes to say the heading's own words.
    const scenes = [{ eventId: 'e2', text: `${HEADING}\n\n${E2}` }]
    expect(placeNotes([note], scenes).get(note.id)).toBeNull()
    // A note on the same words that is on the prose is placed there: the scene does hold them.
    expect(placeNotes([{ ...note, id: 'x', outside: undefined }], scenes).get('x')).toMatchObject({ eventId: 'e2', from: 0 })
  })

  it('with no scene of the book after its line, it is a row in Changes to read, as before, and no note', async () => {
    await theBook()
    const file = await commented(await send('first'), [ON_HEADING])
    // The writer has since taken the second chapter's only scene out of the book.
    await db.events.delete('e2')
    const result = await importEditedFile('W1', file, 'ledger-ana.docx')
    expect(result).toMatchObject({ notes: 0, outsideNotes: 0 })
    expect(await db.proseNotes.count()).toBe(0)
    expect((await db.editSuggestions.toArray()).map((r) => [r.outside, r.before, r.comment?.text])).toEqual([['heading', HEADING, ON_HEADING.text]])
  })

  it('goes back on its line with the writer’s answer under it, resolved if it is; and coming back, it is the same note', async () => {
    await theBook()
    await importEditedFile('W1', await commented(await send('first'), [ON_HEADING, ON_TITLE]), 'ledger-ana.docx')
    const all = await db.proseNotes.toArray()
    const heading = all.find((n) => n.outside === 'heading')!
    const title = all.find((n) => n.outside === 'title page')!
    await replyToProseNote(heading.id, 'Done from chapter one on.')
    await setProseNoteResolved(heading.id, true)
    // The chapter is retitled in the meantime: the thread is on the heading, whatever it now says.
    const second = (await db.chapters.toArray()).find((c) => c.number === 2)!
    await db.chapters.update(second.id, { title: 'The Long Quay' })

    const marked = await send('marked')
    expect((await threadsOf(marked)).outside).toEqual([
      { where: 'title page', line: TITLE, said: [`Ana Editor: ${ON_TITLE.text}`], done: false },
      { where: 'heading', line: 'Ch. 2 — The Long Quay', said: [`Ana Editor: ${ON_HEADING.text}`, 'Ruth Callan: Done from chapter one on.'], done: true },
    ])
    // Neither is in a scene as well.
    expect((await threadsOf(marked)).inScenes).toEqual([])

    // Back untouched: the two notes, as they were.
    await importEditedFile('W1', marked, 'ledger-ana-2.docx')
    expect(await db.proseNotes.count()).toBe(2)
    expect((await db.proseNotes.get(heading.id))!.replies.map((r) => r.body)).toEqual(['Done from chapter one on.'])
    expect(await db.editSuggestions.count()).toBe(0)

    // Back with the editor's answer under the one on the title page: a reply to that note, and it is resolved.
    const zip = await readZip(marked)
    const comments = dec.decode(zip.get('word/comments.xml'))
    const ex = dec.decode(zip.get('word/commentsExtended.xml'))
    const root = new RegExp(`w:author="Ana Editor"[^>]*><w:p w14:paraId="([0-9A-F]{8})"[^>]*>${run(ON_TITLE.text).replace(/[.*+?^$()|[\]\\]/g, '\\$&')}`).exec(comments)![1]
    const parts = new Map(zip)
    parts.set('word/comments.xml', enc.encode(comments.replace('</w:comments>', `<w:comment w:id="70" w:author="Ana Editor" w:date="2026-11-12T08:00:00Z" w:initials="AE"><w:p w14:paraId="5A000001" w14:textId="77777777">${run('Good, keep it.')}</w:p></w:comment></w:comments>`)))
    parts.set('word/commentsExtended.xml', enc.encode(ex
      .replace(`<w15:commentEx w15:paraId="${root}" w15:done="0"/>`, `<w15:commentEx w15:paraId="${root}" w15:done="1"/>`)
      .replace('</w15:commentsEx>', `<w15:commentEx w15:paraId="5A000001" w15:paraIdParent="${root}" w15:done="1"/></w15:commentsEx>`)))
    parts.set('word/document.xml', enc.encode(dec.decode(zip.get('word/document.xml')).replace(para('Title', TITLE), `$1$2<w:r><w:commentReference w:id="70"/></w:r>$3`)))
    const result = await importEditedFile('W1', zipStore([...parts].map(([name, data]) => ({ name, data }))), 'ledger-ana-3.docx')
    expect(result).toMatchObject({ notes: 0, outsideNotes: 0 })
    expect(await db.proseNotes.count()).toBe(2)
    const answered = (await db.proseNotes.get(title.id))!
    expect(answered.replies.map((r) => [r.author.kind, r.body])).toEqual([['editor', 'Good, keep it.']])
    expect(answered.status).toBe('resolved')
    expect(answered.outside).toBe('title page')
  })

  it('in a file made without chapter headings, the heading’s thread is at its scene’s start, saying what it was on; back, it is the same note and the line no reply', async () => {
    await theBook()
    await importEditedFile('W1', await commented(await send('first'), [ON_HEADING]), 'ledger-ana.docx')
    const [note] = await db.proseNotes.toArray()
    // The scene comes to say the heading's own words: the thread is still on the heading, not on them.
    await setSceneText('W1', 'e2', `${E2}\n\nThe board over the door said ${HEADING}.`)
    const marked = await send('marked', { chapterTitles: false })
    const threads = await threadsOf(marked)
    expect(threads.outside).toEqual([])
    expect(threads.inScenes).toEqual([{ scene: 1, said: [`Ana Editor: ${ON_HEADING.text}`, `Ruth Callan: On the chapter’s heading: “${HEADING}”`] }])
    // At the scene's start, before its first word.
    const doc = dec.decode((await readZip(marked)).get('word/document.xml'))
    expect(doc).toMatch(/<w:commentRangeStart w:id="0"\/><w:commentRangeStart w:id="1"\/><w:commentRangeEnd w:id="0"\/>(?:(?!<w:t).)*<w:commentRangeEnd w:id="1"\/>(?:(?!<w:t).)*<w:t xml:space="preserve">The boy waited/)

    await importEditedFile('W1', marked, 'ledger-ana-2.docx')
    expect(await db.proseNotes.count()).toBe(1)
    const back = (await db.proseNotes.get(note.id))!
    expect(back.replies).toEqual([])
    expect(back.outside).toBe('heading')
  })

  /** A book of one scene sent marked, with threads on the title page: which line of the file each is on. */
  const titlePage = async (threads: Array<{ quote: string; text: string }>, opts: Partial<BookExportOptions> = {}, heading?: { quote: string }) => {
    const bytes = compileDocx({
      totalWords: 1200, totalScenes: 1, writtenScenes: 1,
      chapters: [{ id: 'c', number: 1, title: 'The Quay', synopsis: '', wordCount: 1200, wordGoal: null, writtenScenes: 1, scenes: [{ eventId: 'e', title: 'S', text: E2, wordCount: 1200, written: true, status: 'draft' }] }],
    }, { title: TITLE, author: 'Ruth Callan', ...opts, forEditing: { draftId: 'D2', worldId: 'W', sceneIndex: () => 0, marked: {
      author: 'Ruth Callan', date: '2026-11-12T09:00:00Z', base: () => E2, against: 'D1',
      threads: [
        ...threads.map((t) => ({ eventId: 'e', quote: t.quote, done: false, outside: 'title page' as const, comments: [{ author: 'Ana Editor', initials: 'AE', text: t.text }] })),
        ...(heading ? [{ eventId: 'e', quote: heading.quote, done: false, outside: 'heading' as const, comments: [{ author: 'Ana Editor', initials: 'AE', text: 'On the heading.' }] }] : []),
      ],
    } } })
    return (await threadsOf(bytes)).outside.map((o) => [o.line, o.said[0].replace('Ana Editor: ', '')])
  }
  const SUB = { submission: { name: 'Ruth Callan', legalName: 'R. M. Callan', contact: '4 Salt Lane\nruth@example.com', wordCount: 'about 1,200 words' } }

  it('a title page’s thread is on the line it was made on, where that line is still there; on the title where it is not', async () => {
    expect(await titlePage([
      { quote: 'Ruth Callan', text: 'Pen name?' },
      { quote: TITLE, text: 'Final title?' },
      { quote: 'The Salt Book', text: 'On the old title.' },
    ])).toEqual([[TITLE, 'Final title?'], [TITLE, 'On the old title.'], ['Ruth Callan', 'Pen name?']])
  })

  it('on a submission’s title page: the line of the name and the count whatever the count now is, a contact line, the byline', async () => {
    expect(await titlePage([
      { quote: 'R. M. Callan\tabout 1,100 words', text: 'Round the count.' },
      { quote: 'ruth@example.com', text: 'Agency address instead.' },
      { quote: 'by Ruth Callan', text: 'Byline as on the contract?' },
      { quote: '12 Gone Street', text: 'A line that is gone.' },
    ], SUB)).toEqual([
      ['R. M. Callan\tabout 1,200 words', 'Round the count.'],
      ['ruth@example.com', 'Agency address instead.'],
      [TITLE, 'A line that is gone.'],
      ['by Ruth Callan', 'Byline as on the contract?'],
    ])
  })

  it('each thread is in the file once, though two lines of the title page say the same words', async () => {
    // A book titled with its writer's name.
    expect(await titlePage([{ quote: 'Ruth Callan', text: 'Which is which?' }], { title: 'Ruth Callan' })).toEqual([['Ruth Callan', 'Which is which?']])
  })

  it('under a heading of a number over a title, a thread is on the line it was made on, and on the first where that is gone', async () => {
    const two = { chapterHeading: 'chapter-words-title' as const }
    expect(await titlePage([], two, { quote: 'The Quay' })).toEqual([['The Quay', 'On the heading.']])
    expect(await titlePage([], two, { quote: 'The Old Quay' })).toEqual([['Chapter One', 'On the heading.']])
  })
})
