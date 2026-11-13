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

export async function saveBookDraft(worldId: string, name: string, now = Date.now(), extra: Pick<BookDraftRecord, 'sentAs' | 'sentBack' | 'editors' | 'titleCount' | 'wentAs' | 'editorChanges'> & { book?: DraftBook } = {}): Promise<BookDraftRecord> {
  const book = extra.book ?? await currentBook(worldId)
  const record: BookDraftRecord = {
    id: generateId(),
    worldId,
    name: name.trim() || `Draft of ${new Date(now).toLocaleDateString()}`,
    createdAt: now,
    words: draftWords(book),
    scenes: draftScenes(book),
    data: await gzip(new TextEncoder().encode(JSON.stringify(book))),
    ...(extra.sentAs ? { sentAs: extra.sentAs } : {}),
    ...(extra.sentBack ? { sentBack: extra.sentBack } : {}),
    ...(extra.editors?.length ? { editors: extra.editors } : {}),
    ...(extra.titleCount ? { titleCount: extra.titleCount } : {}),
    ...(extra.wentAs ? { wentAs: extra.wentAs } : {}),
    ...(extra.editorChanges ? { editorChanges: extra.editorChanges } : {}),
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

/**
 * The name of the draft saved as a Word file goes to an editor: when, to the
 * minute, and the file. Every one was "Sent for editing (the-book.docx)", and
 * two exports of a morning were told apart by nothing a writer could see
 * (writer run 2026-11-09, W-H; round-trip-plan.md, T2.3).
 */
export function sentDraftName(fileName: string, now = Date.now(), taken: ReadonlySet<string> = new Set(), as = 'Sent for editing'): string {
  const when = new Date(now).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  const name = `${as}, ${when} (${fileName})`
  /*
    Two sent in one minute are told apart: the loop's writer exported twice at
    06:47 and had two drafts named alike, with no way to tell which file came
    from which (round-trip-plan-2.md, T7.6; writer run 2026-11-10, R2-5).
  */
  if (!taken.has(name)) return name
  let n = 2
  while (taken.has(`${name} (${n})`)) n++
  return `${name} (${n})`
}

/** `sentDraftName`, told apart from the world's drafts already saved. */
export async function freshSentDraftName(worldId: string, fileName: string, now = Date.now(), as?: string): Promise<string> {
  const taken = new Set((await db.bookDrafts.where('worldId').equals(worldId).toArray()).map((d) => d.name))
  return sentDraftName(fileName, now, taken, as)
}

/** The book as the last editor's file sent it back (T5.1, D-4), which a marked export goes back against; undefined while it loads, null for none. */
/**
 * The book as it went to the editor whose file a sent-back draft is: the draft
 * that file was made from (round-trip-plan-3.md, T10.1). One brought back
 * before that was kept says nothing of it, and is taken to be the last book
 * sent before it came back.
 */
export async function wentDraftOf(sentBack: BookDraftRecord): Promise<BookDraftRecord | null> {
  if (sentBack.wentAs) return (await db.bookDrafts.get(sentBack.wentAs)) ?? null
  const sent = (await db.bookDrafts.where('worldId').equals(sentBack.worldId).toArray()).filter((d) => d.sentAs && d.createdAt <= sentBack.createdAt)
  return sent.sort((a, b) => b.createdAt - a.createdAt)[0] ?? null
}

export function useLatestSentBack(worldId: string | null): BookDraftRecord | null | undefined {
  return useLiveQuery(async () => {
    if (!worldId) return null
    const all = (await db.bookDrafts.where('worldId').equals(worldId).toArray()).filter((d) => d.sentBack)
    return all.sort((a, b) => b.createdAt - a.createdAt)[0] ?? null
  }, [worldId])
}
