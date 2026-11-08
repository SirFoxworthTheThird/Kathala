import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { db } from '@/db/database'
import { createTimeline, createChapter } from '@/db/hooks/useTimeline'
import { setSceneText } from '@/db/hooks/useManuscript'
import { currentBook, openBookDraft } from '@/db/hooks/useBookDrafts'
import { acceptScene, acceptSuggestion, importEditedFile, rejectSuggestion } from '@/db/hooks/useEditImport'
import { gzip } from '@/lib/gzip'

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

  it('accepting writes the change into the prose as it is now, its History keeping the old; rejecting drops it; a change whose words are gone is kept', async () => {
    await theBook()
    await importEditedFile('W1', fixture('edited-libreoffice.docx'), 'f.docx')
    const rows = await db.editSuggestions.toArray()
    const rain = rows.find((r) => r.after.includes('rain'))!
    const cut = rows.find((r) => r.before === 'twice, and ')!
    const held = rows.find((r) => r.kind === 'untracked')!
    // The writer has worked on e1 since the file went out.
    await setSceneText('W1', 'e1', 'Fog. ' + E1)
    expect(await acceptSuggestion(rain.id)).toBe(true)
    expect(await prose('e1')).toBe('Fog. The ferry left at dawn in the rain.\n\nMira counted the crates twice, and _twice_ the number came out wrong.')
    expect((await db.sceneRevisions.where('eventId').equals('e1').toArray()).map((r) => r.text)).toContain('Fog. ' + E1)
    await rejectSuggestion(cut.id)
    expect(await prose('e1')).toContain('twice, and _twice_')
    // e2's line rewritten since: the untracked edit has nothing to change, and waits.
    await setSceneText('W1', 'e2', 'The boy waited on the quay.\n\nA satchel hung from his shoulder.')
    expect(await acceptSuggestion(held.id)).toBe(false)
    expect((await db.editSuggestions.toArray()).map((r) => r.id)).toEqual([held.id])
  })

  it('a scene accepted whole takes its changes in order', async () => {
    await theBook()
    await importEditedFile('W1', fixture('edited-libreoffice.docx'), 'f.docx')
    expect(await acceptScene('W1', 'e1')).toEqual({ accepted: 2, kept: 0 })
    expect(await prose('e1')).toBe('The ferry left at dawn in the rain.\n\nMira counted the crates _twice_ the number came out wrong.')
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
