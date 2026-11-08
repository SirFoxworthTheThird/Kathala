import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import { generateId } from '@/lib/id'
import { draftOf, draftScenes, draftWords, type DraftBook } from '@/lib/bookDraft'
import { inBookChapterOrder } from '@/lib/timelineOrder'
import { gzip, gunzip } from '@/lib/gzip'
import { restoreSceneProse } from '@/db/hooks/useSceneRevisions'
import type { BookDraftRecord } from '@/types'

/*
  Named drafts of the book (editorial-plan.md, R3). Saved whole — the book's
  prose, scenes and chapters — and compared with the book as it is now, or
  with each other, by `compareDrafts`. Not journalled: a draft is a record of
  the book, not an edit to it, and saving or deleting one is not something to
  undo with the book's own Undo.
*/

/** A world's drafts, newest first. */
export function useBookDrafts(worldId: string | null): BookDraftRecord[] {
  return useLiveQuery(
    async () => (worldId ? (await db.bookDrafts.where('worldId').equals(worldId).sortBy('createdAt')).reverse() : []),
    [worldId],
    [] as BookDraftRecord[],
  )
}

/** The book as it is now, every timeline, in the book's order. */
export async function currentBook(worldId: string): Promise<DraftBook> {
  const [chapters, events, texts, timelines] = await Promise.all([
    db.chapters.where('worldId').equals(worldId).toArray(),
    db.events.where('worldId').equals(worldId).toArray(),
    db.sceneTexts.where('worldId').equals(worldId).toArray(),
    db.timelines.where('worldId').equals(worldId).toArray(),
  ])
  return draftOf(inBookChapterOrder(chapters, timelines), events, texts)
}

export async function saveBookDraft(worldId: string, name: string, now = Date.now()): Promise<BookDraftRecord> {
  const book = await currentBook(worldId)
  const record: BookDraftRecord = {
    id: generateId(),
    worldId,
    name: name.trim() || `Draft of ${new Date(now).toLocaleDateString()}`,
    createdAt: now,
    words: draftWords(book),
    scenes: draftScenes(book),
    data: await gzip(new TextEncoder().encode(JSON.stringify(book))),
  }
  await db.bookDrafts.add(record)
  return record
}

export async function openBookDraft(record: Pick<BookDraftRecord, 'data'>): Promise<DraftBook> {
  return JSON.parse(new TextDecoder().decode(await gunzip(record.data))) as DraftBook
}

export async function deleteBookDraft(id: string): Promise<void> {
  await db.bookDrafts.delete(id)
}

/**
 * A scene's prose put back as a draft had it. The scene must still be in the
 * book: a draft is not restored whole, which would bury every record written
 * since. Its prose now is kept in its History first.
 */
export async function restoreSceneFromDraft(worldId: string, eventId: string, text: string): Promise<boolean> {
  if (!(await db.events.get(eventId))) return false
  await restoreSceneProse(worldId, eventId, text)
  return true
}
