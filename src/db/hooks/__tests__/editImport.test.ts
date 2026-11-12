import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { db } from '@/db/database'
import { createTimeline, createChapter } from '@/db/hooks/useTimeline'
import { setSceneText } from '@/db/hooks/useManuscript'
import { currentBook, openBookDraft, saveBookDraft } from '@/db/hooks/useBookDrafts'
import { acceptScene, acceptSuggestion, changeCount, importEditedFile, rejectScene, rejectSuggestion } from '@/db/hooks/useEditImport'
import { gzip } from '@/lib/gzip'
import { compileDocx } from '@/lib/manuscriptExport'
import { replyToProseNote } from '@/db/hooks/useProseNotes'
import { redoLast, undoLast } from '@/db/hooks/useOperations'
import { replaceSceneTexts } from '@/db/hooks/useSceneStructure'

/** An editor's file brought in (editorial-plan.md, R4): suggestions and notes, a draft first, and the changes decided. */

const fixture = (name: string) => new Uint8Array(readFileSync(path.join(__dirname, '../../../lib/__tests__/fixtures/docx', name)))
const E1 = 'The ferry left at dawn.\n\nMira counted the crates twice, and _twice_ the number came out wrong.'
const E2 = 'The boy waited on the quay.\n\nHe had a ledger under his arm.'

beforeEach(async () => {
  await db.delete()
  await db.open()
})
afterAll(async () => { await db.delete() })

/** The book edited-libreoffice.docx was made from: world W1, scenes e1 and e2, and its draft DRAFT123, here. */
async function theBook({ withDraft = true } = {}) {
  const now = Date.now()
  await db.worlds.add({ id: 'W1', name: 'The Salt Ledger', description: '', coverImageId: null, theme: null, continuityStaleThreshold: 5, calendar: null, pinsSetClock: true, createdAt: now, updatedAt: now })
  const timeline = await createTimeline({ worldId: 'W1', name: 'Main', description: '', color: '#888' })
  const chapter = await createChapter({ worldId: 'W1', timelineId: timeline.id, number: 1, title: 'The Weighing House', synopsis: '' })
  for (const [id, title, order] of [['e1', 'Dawn', 0], ['e2', 'Quay', 1]] as const) {
    await db.events.add({
      id, worldId: 'W1', chapterId: chapter.id, timelineId: timeline.id, title, description: '', sortOrder: order,
      locationMarkerId: null, involvedCharacterIds: [], involvedItemIds: [], mentionedCharacterIds: [], tags: [],
      travelDays: null, inWorldTime: null, tension: null, structureBeat: null, threadIds: [], status: 'draft', povCharacterId: null, isFlashback: false,
      createdAt: now, updatedAt: now,
    } as never)
  }
  await setSceneText('W1', 'e1', E1)
  await setSceneText('W1', 'e2', E2)
  if (withDraft) {
    const book = await currentBook('W1')
    await db.bookDrafts.add({ id: 'DRAFT123', worldId: 'W1', name: 'Sent for editing', createdAt: now, words: 0, scenes: 2, data: await gzip(new TextEncoder().encode(JSON.stringify(book))) })
  }
}
const prose = async (id: string) => (await db.sceneTexts.where('eventId').equals(id).first())?.text

describe('bringing an edited file in', () => {
  it('saves a draft of the book first, then every change as a suggestion and the comment as the editor’s note; the prose is untouched', async () => {
    await theBook()
    const result = await importEditedFile('W1', fixture('edited-libreoffice.docx'), 'salt-ledger.docx')
    expect(result).toMatchObject({ suggestions: 3, notes: 1 })
    const rows = await db.editSuggestions.toArray()
    // Each says which draft the file was made from, for the Drafts list to mark it (round-trip-plan.md, T2.3).
    expect(new Set(rows.map((r) => r.fromDraft))).toEqual(new Set(['DRAFT123']))
    expect(rows.map((r) => [r.eventId, r.kind, r.before, r.after]).sort()).toEqual([
      ['e1', 'tracked', 'dawn.', 'dawn in the rain.'],
      ['e1', 'tracked', 'twice, and ', ''],
      ['e2', 'untracked', 'had', 'held'],
    ].sort())
    expect(rows.find((r) => r.kind === 'tracked')).toMatchObject({ author: 'Ana Editor', source: 'salt-ledger.docx' })
    const [note] = await db.proseNotes.toArray()
    expect(note).toMatchObject({ eventId: 'e2', quote: 'The boy waited on the quay', body: 'Which boy? Name him.', author: { kind: 'editor', name: 'Ana Editor' } })
    expect([await prose('e1'), await prose('e2')]).toEqual([E1, E2])
    // The draft saved first is the book as it was: the way back.
    const before = await db.bookDrafts.get(result.draftId)
    expect(before?.name).toBe('Before Ana Editor’s changes (salt-ledger.docx)')
    expect(await openBookDraft(before!)).toEqual(await currentBook('W1'))
  })

  it('keeps the book as the editor sent it back, every change taken, for the revision to go back marked against (round-trip-plan-2.md, T5.1, D-4)', async () => {
    await theBook()
    await importEditedFile('W1', fixture('edited-libreoffice.docx'), 'salt-ledger.docx')
    const sentBack = (await db.bookDrafts.toArray()).filter((d) => d.sentBack)
    expect(sentBack.map((d) => [d.name, d.sentBack])).toEqual([['As Ana Editor sent it back (salt-ledger.docx)', 'salt-ledger.docx']])
    // That file has no title page, so no count of its length is kept.
    expect('titleCount' in sentBack[0]).toBe(false)
    const book = await openBookDraft(sentBack[0])
    // Every change in the file taken, tracked and untracked alike; the book itself untouched.
    expect(book.chapters.flatMap((c) => c.scenes).map((s) => [s.id, s.text])).toEqual([
      ['e1', 'The ferry left at dawn in the rain.\n\nMira counted the crates _twice_ the number came out wrong.'],
      ['e2', 'The boy waited on the quay.\n\nHe held a ledger under his arm.'],
    ])
    expect([await prose('e1'), await prose('e2')]).toEqual([E1, E2])
  })

  it('keeps what the file’s title page says of the book’s length, for the marked revision’s count to be a change against it (round-trip-plan-3.md, T8.4)', async () => {
    await theBook()
    const book = await currentBook('W1')
    const scenes = book.chapters.flatMap((c) => c.scenes)
    // The book as it went out, a submission, saying its own length; brought back as it went.
    const bytes = compileDocx({
      totalWords: 0, totalScenes: scenes.length, writtenScenes: scenes.length,
      chapters: book.chapters.map((c) => ({ id: c.id, number: c.number, title: c.title, synopsis: '', wordCount: 0, wordGoal: null, writtenScenes: c.scenes.length,
        scenes: c.scenes.map((sc) => ({ eventId: sc.id, title: sc.title, text: sc.text, wordCount: 0, written: true, status: 'draft' as const })) })),
    }, { submission: { name: 'Ruth Callan', wordCount: 'about 3,000 words' }, forEditing: { draftId: 'DRAFT123', worldId: 'W1', sceneIndex: (id) => scenes.findIndex((sc) => sc.id === id) } })
    await importEditedFile('W1', bytes, 'salt-ledger.docx')
    const sentBack = (await db.bookDrafts.toArray()).filter((d) => d.sentBack)
    expect(sentBack.map((d) => d.titleCount)).toEqual(['about 3,000 words'])
  })

  it('accepting writes the change into the prose as it is now, its History keeping the old; rejecting drops it; a change whose words are gone is kept', async () => {
    await theBook()
    await importEditedFile('W1', fixture('edited-libreoffice.docx'), 'f.docx')
    const rows = await db.editSuggestions.toArray()
    const rain = rows.find((r) => r.after.includes('rain'))!
    const cut = rows.find((r) => r.before === 'twice, and ')!
    const held = rows.find((r) => r.kind === 'untracked')!
    // The writer has worked on e1 since the file went out.
    await setSceneText('W1', 'e1', 'Fog. ' + E1)
    expect(await acceptSuggestion(rain.id)).toBe('accepted')
    expect(await prose('e1')).toBe('Fog. The ferry left at dawn in the rain.\n\nMira counted the crates twice, and _twice_ the number came out wrong.')
    expect((await db.sceneRevisions.where('eventId').equals('e1').toArray()).map((r) => r.text)).toContain('Fog. ' + E1)
    await rejectSuggestion(cut.id)
    expect(await prose('e1')).toContain('twice, and _twice_')
    // e2's line rewritten since: the untracked edit has nothing to change, and waits.
    await setSceneText('W1', 'e2', 'The boy waited on the quay.\n\nA satchel hung from his shoulder.')
    expect(await acceptSuggestion(held.id)).toBe('gone')
    expect((await db.editSuggestions.toArray()).map((r) => r.id)).toEqual([held.id])
  })

  it('Undo straight after an Accept takes the Accept back, the change with it, and not an older Replace all (round-trip-plan-2.md, T7.4; R2-2)', async () => {
    await theBook()
    await importEditedFile('W1', fixture('edited-libreoffice.docx'), 'f.docx')
    // A Replace all in the other scene first: the last thing on Undo before the Accept.
    await replaceSceneTexts('W1', [{ eventId: 'e2', text: E2.replace('quay', 'pier') }], { label: 'Replace all' })
    const rain = (await db.editSuggestions.toArray()).find((r) => r.after.includes('rain'))!
    expect(await acceptSuggestion(rain.id)).toBe('accepted')
    expect(await prose('e1')).toContain('dawn in the rain.')
    expect(await db.editSuggestions.get(rain.id)).toBeUndefined()

    await undoLast('W1')
    expect(await prose('e1')).toBe(E1)
    expect(await db.editSuggestions.get(rain.id)).toMatchObject({ before: 'dawn.', after: 'dawn in the rain.' })
    // The Replace all is untouched: that was the older step.
    expect(await prose('e2')).toBe(E2.replace('quay', 'pier'))

    // And Redo makes it again, the change leaving the list.
    await redoLast('W1')
    expect(await prose('e1')).toContain('dawn in the rain.')
    expect(await db.editSuggestions.get(rain.id)).toBeUndefined()
  })

  it('Accept all on a scene is one step of Undo; a Reject is one too, and brings the change back', async () => {
    await theBook()
    await importEditedFile('W1', fixture('edited-libreoffice.docx'), 'f.docx')
    const all = (await db.editSuggestions.toArray()).length
    expect((await acceptScene('W1', 'e1')).accepted).toBe(2)
    await undoLast('W1')
    expect(await prose('e1')).toBe(E1)
    expect((await db.editSuggestions.toArray()).length).toBe(all)

    const held = (await db.editSuggestions.toArray()).find((r) => r.kind === 'untracked')!
    await rejectSuggestion(held.id)
    expect(await db.editSuggestions.get(held.id)).toBeUndefined()
    await undoLast('W1')
    expect(await db.editSuggestions.get(held.id)).toMatchObject({ before: 'had', after: 'held' })
    expect(await prose('e2')).toBe(E2)
  })

  it('a scene accepted whole takes its changes in order', async () => {
    await theBook()
    await importEditedFile('W1', fixture('edited-libreoffice.docx'), 'f.docx')
    expect(await acceptScene('W1', 'e1')).toEqual({ accepted: 2, kept: 0, refused: new Map() })
    expect(await prose('e1')).toBe('The ferry left at dawn in the rain.\n\nMira counted the crates _twice_ the number came out wrong.')
  })

  it('a change that would run two sentences together is refused and kept; one that does not is made (round-trip-plan.md, T1.1)', async () => {
    await theBook()
    await setSceneText('W1', 'e1', 'It was hard every time. At the edge of the marsh she stopped.')
    const base = { worldId: 'W1', eventId: 'e1', importId: 'I', source: 'f.docx', kind: 'tracked' as const, createdAt: 1 }
    // Two changes on one gap, as a split with its mark unread came in: the space taken out, and the break put in.
    await db.editSuggestions.bulkAdd([
      { ...base, id: 'space', order: 0, before: 'time. ', after: 'time.', prefix: 'It was hard every ', suffix: 'At the edge' },
      { ...base, id: 'split', order: 1, before: 'time. ', after: 'time.\n\n', prefix: 'It was hard every ', suffix: 'At the edge' },
    ])
    expect(await acceptSuggestion('space')).toBe('runs-together')
    expect(await prose('e1')).toBe('It was hard every time. At the edge of the marsh she stopped.')
    expect(await acceptSuggestion('split')).toBe('accepted')
    expect(await prose('e1')).toBe('It was hard every time.\n\nAt the edge of the marsh she stopped.')
    expect((await db.editSuggestions.toArray()).map((r) => r.id)).toEqual(['space'])
  })

  it('a scene accepted whole says which changes it could not make, and why', async () => {
    await theBook()
    await importEditedFile('W1', fixture('edited-libreoffice.docx'), 'f.docx')
    const held = (await db.editSuggestions.toArray()).find((r) => r.kind === 'untracked')!
    await setSceneText('W1', 'e2', 'Rewritten entirely.')
    const r = await acceptScene('W1', 'e2')
    expect(r).toEqual({ accepted: 0, kept: 1, refused: new Map([[held.id, 'gone']]) })
  })

  describe('a move (round-trip-plan.md, T1.2)', () => {
    const base = { worldId: 'W1', importId: 'I', source: 'f.docx', kind: 'tracked' as const, createdAt: 1 }
    /** "The gate shut." moved from the end of e1 to the start of e2. */
    async function moved() {
      await theBook()
      await setSceneText('W1', 'e1', 'Rain fell. The gate shut.')
      await setSceneText('W1', 'e2', 'She waited.')
      await db.editSuggestions.bulkAdd([
        { ...base, id: 'out', eventId: 'e1', order: 0, before: ' The gate shut.', after: '', prefix: 'Rain fell.', suffix: '', move: { id: 'M', part: 'from' } },
        { ...base, id: 'in', eventId: 'e2', order: 0, before: 'She', after: 'The gate shut. She', prefix: '', suffix: ' waited.', move: { id: 'M', part: 'to' } },
        { ...base, id: 'word', eventId: 'e2', order: 1, before: 'waited.', after: 'waited there.', prefix: 'She ', suffix: '' },
      ])
    }

    it('is one change, counted once', async () => {
      await moved()
      expect(changeCount(await db.editSuggestions.toArray())).toBe(2)
    })

    it('accepted from either half, both halves are made, in both scenes, and both go', async () => {
      await moved()
      expect(await acceptSuggestion('in')).toBe('accepted')
      expect([await prose('e1'), await prose('e2')]).toEqual(['Rain fell.', 'The gate shut. She waited.'])
      expect((await db.editSuggestions.toArray()).map((r) => r.id)).toEqual(['word'])
    })

    it('rejected from either half, both go and nothing is written', async () => {
      await moved()
      await rejectSuggestion('out')
      expect((await db.editSuggestions.toArray()).map((r) => r.id)).toEqual(['word'])
      expect([await prose('e1'), await prose('e2')]).toEqual(['Rain fell. The gate shut.', 'She waited.'])
    })

    it('where one half can no longer be made, neither is', async () => {
      await moved()
      await setSceneText('W1', 'e2', 'Rewritten entirely.')
      expect(await acceptSuggestion('out')).toBe('gone')
      expect(await prose('e1')).toBe('Rain fell. The gate shut.')
      expect(await db.editSuggestions.count()).toBe(3)
    })

    it('a scene accepted whole makes the move once; a scene rejected whole takes the half in the other scene too', async () => {
      await moved()
      expect(await acceptScene('W1', 'e2')).toEqual({ accepted: 2, kept: 0, refused: new Map() })
      expect([await prose('e1'), await prose('e2')]).toEqual(['Rain fell.', 'The gate shut. She waited there.'])
      await db.delete()
      await db.open()
      await moved()
      await rejectScene('W1', 'e1')
      expect((await db.editSuggestions.toArray()).map((r) => r.id)).toEqual(['word'])
    })
  })

  it('without the draft on this device, brings the tracked changes and not the untracked edit; a file from another book is refused', async () => {
    await theBook({ withDraft: false })
    const result = await importEditedFile('W1', fixture('edited-libreoffice.docx'), 'f.docx')
    expect(result.plan.fromDraft).toBe(false)
    expect((await db.editSuggestions.toArray()).map((r) => r.kind)).toEqual(['tracked', 'tracked'])
    await db.worlds.add({ id: 'W2', name: 'Other', description: '', coverImageId: null, theme: null, continuityStaleThreshold: 5, createdAt: 0, updatedAt: 0 })
    await expect(importEditedFile('W2', fixture('edited-libreoffice.docx'), 'f.docx')).rejects.toThrow('another book')
  })
})

/*
  A file the writer sent back marked, coming back from the editor with the
  editor's changes beside the writer's (round-trip-plan-2.md, T5.3).
*/
describe('a marked file coming back (round-trip-plan-2.md, T5.3)', () => {
  /** Round one in, the writer's revision, and the book sent back marked: the file as it went, and the note its thread is. */
  async function sentMarked() {
    await theBook()
    await importEditedFile('W1', fixture('edited-libreoffice.docx'), 'salt-ledger.docx')
    const against = (await db.bookDrafts.toArray()).find((d) => d.sentBack)!
    // The writer takes Ana's changes to e1, declines "held", changes a word, and answers the comment.
    await acceptScene('W1', 'e1')
    for (const r of await db.editSuggestions.toArray()) await rejectSuggestion(r.id)
    await setSceneText('W1', 'e1', 'The ferry left at dawn in the rain.\n\nMira counted the boxes _twice_ the number came out wrong.')
    const [note] = await db.proseNotes.toArray()
    await replyToProseNote(note.id, 'Tom, the harbourmaster’s boy.')
    // Sent marked: the draft it went from, and the file.
    const sent = await saveBookDraft('W1', 'Sent marked', Date.now(), { sentAs: 'salt-ledger-2.docx' })
    const book = await currentBook('W1')
    const base = new Map((await openBookDraft(against)).chapters.flatMap((c) => c.scenes).map((s) => [s.id, s.text]))
    const scenes = book.chapters.flatMap((c) => c.scenes)
    const fresh = (await db.proseNotes.get(note.id))!
    const bytes = compileDocx({
      totalWords: 0, totalScenes: scenes.length, writtenScenes: scenes.length,
      chapters: book.chapters.map((c) => ({ id: c.id, number: c.number, title: c.title, synopsis: '', wordCount: 0, wordGoal: null, writtenScenes: c.scenes.length,
        scenes: c.scenes.map((s) => ({ eventId: s.id, title: s.title, text: s.text, wordCount: 0, written: true, status: 'draft' as const })) })),
    }, { forEditing: { draftId: sent.id, worldId: 'W1', sceneIndex: (id) => scenes.findIndex((s) => s.id === id), marked: {
      author: 'Ruth Callan', date: '2026-11-10T09:00:00Z', base: (id) => base.get(id) ?? null, against: against.id,
      threads: [{ eventId: fresh.eventId, quote: fresh.quote, done: false, comments: [
        { author: 'Ana Editor', initials: 'AE', text: fresh.body },
        ...fresh.replies.map((r) => ({ author: r.author.kind === 'editor' ? 'Ana Editor' : 'Ruth Callan', initials: 'RC', text: r.body })),
      ] }],
    } } })
    return { bytes, note: fresh }
  }

  /** The file, as the editor's Word saves it after the editor's work in it. */
  async function returned(bytes: Uint8Array, change: (doc: string) => string, comments: (xml: string, ex: string) => [string, string]) {
    const { readZip, zipStore } = await import('@/lib/zip')
    const zip = await readZip(bytes)
    const dec = new TextDecoder()
    const enc = new TextEncoder()
    const [c, e] = comments(dec.decode(zip.get('word/comments.xml')), dec.decode(zip.get('word/commentsExtended.xml')))
    const parts = new Map(zip)
    parts.set('word/document.xml', enc.encode(change(dec.decode(zip.get('word/document.xml')))))
    parts.set('word/comments.xml', enc.encode(c))
    parts.set('word/commentsExtended.xml', enc.encode(e))
    return zipStore([...parts].map(([name, data]) => ({ name, data })))
  }

  it('brought back untouched: no change, no new note, the thread as it was', async () => {
    const { bytes, note } = await sentMarked()
    const before = await db.proseNotes.count()
    const result = await importEditedFile('W1', bytes, 'salt-ledger-2.docx')
    expect(result.suggestions).toBe(0)
    expect(await db.editSuggestions.count()).toBe(0)
    expect(await db.proseNotes.count()).toBe(before)
    expect((await db.proseNotes.get(note.id))!.replies.map((r) => r.body)).toEqual(['Tom, the harbourmaster’s boy.'])
  })

  it('one of the writer’s turned back, one left, the editor’s own change, reply and resolution: each comes in as what it is', async () => {
    const { bytes, note } = await sentMarked()
    const file = await returned(bytes, (doc) => {
      // The writer's "crates → boxes" turned back: the insertion gone, the deletion plain text again.
      const ins = /<w:ins [^>]*w:author="Ruth Callan"[^>]*><w:r><w:t xml:space="preserve">boxes<\/w:t><\/w:r><\/w:ins>/
      const del = /<w:del [^>]*w:author="Ruth Callan"[^>]*><w:r><w:delText xml:space="preserve">crates<\/w:delText><\/w:r><\/w:del>/
      expect(doc).toMatch(ins)
      expect(doc).toMatch(del)
      let out = doc.replace(ins, '').replace(del, '<w:r><w:t xml:space="preserve">crates</w:t></w:r>')
      // The editor's own change, tracked: "left" → "slipped out".
      out = out.replace('<w:t xml:space="preserve">The ferry left at dawn in the rain.</w:t>', '<w:t xml:space="preserve">The ferry </w:t></w:r><w:del w:id="9001" w:author="Ana Editor" w:date="2026-11-11T09:00:00Z"><w:r><w:delText xml:space="preserve">left</w:delText></w:r></w:del><w:ins w:id="9002" w:author="Ana Editor" w:date="2026-11-11T09:00:00Z"><w:r><w:t xml:space="preserve">slipped out</w:t></w:r></w:ins><w:r><w:t xml:space="preserve"> at dawn in the rain.</w:t>')
      expect(out).toContain('slipped out')
      return out
    }, (comments, ex) => {
      // The editor's reply under the thread, and the thread resolved.
      const root = /<w15:commentEx w15:paraId="([0-9A-F]{8})" w15:done="0"\/>/.exec(ex)![1]
      return [
        comments.replace('</w:comments>', `<w:comment w:id="50" w:author="Ana Editor" w:date="2026-11-11T09:00:00Z" w:initials="AE"><w:p w14:paraId="5A000001" w14:textId="77777777"><w:r><w:t xml:space="preserve">Good. Use his name in chapter 2.</w:t></w:r></w:p></w:comment></w:comments>`),
        ex.replace(`w15:paraId="${root}" w15:done="0"`, `w15:paraId="${root}" w15:done="1"`).replace('</w15:commentsEx>', `<w15:commentEx w15:paraId="5A000001" w15:paraIdParent="${root}" w15:done="1"/></w15:commentsEx>`),
      ]
    })
    await importEditedFile('W1', file, 'salt-ledger-2-back.docx')
    const rows = await db.editSuggestions.toArray()
    expect(rows.map((r) => [r.eventId, r.kind, r.before.trim(), r.after.trim(), r.turnedBack ?? false, r.author ?? null]).sort()).toEqual([
      ['e1', 'tracked', 'left', 'slipped out', false, 'Ana Editor'],
      ['e1', 'untracked', 'boxes', 'crates', true, 'Ana Editor'],
    ])
    // Nothing for the writer's change left alone — "held" declined, "had" kept; and no second note for the thread.
    expect(await db.proseNotes.count()).toBe(1)
    const thread = (await db.proseNotes.get(note.id))!
    expect(thread.replies.map((r) => [r.author.kind, r.body])).toEqual([['me', 'Tom, the harbourmaster’s boy.'], ['editor', 'Good. Use his name in chapter 2.']])
    expect(thread.status).toBe('resolved')
    // Accepting the turned-back change takes the editor's words again.
    const back = rows.find((r) => r.turnedBack)!
    expect(await acceptSuggestion(back.id)).toBe('accepted')
    expect(await prose('e1')).toBe('The ferry left at dawn in the rain.\n\nMira counted the crates _twice_ the number came out wrong.')
  })
})
