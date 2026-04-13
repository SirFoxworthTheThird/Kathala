import { db } from '@/db/database'

/** Globally comparable event order: chapter.number × 10_000 + event.sortOrder. */
export type SortKey = number

/**
 * Compute the sortKey for a given eventId by looking up the event and its chapter.
 * Returns 0 if the event or chapter cannot be found.
 */
export async function computeSortKey(eventId: string): Promise<SortKey> {
  const event = await db.events.get(eventId)
  if (!event) return 0
  const chapter = await db.chapters.get(event.chapterId)
  if (!chapter) return event.sortOrder
  return chapter.number * 10_000 + event.sortOrder
}

/**
 * Synchronously compute a sortKey given pre-loaded lookup maps.
 * Returns -1 if the event or chapter is not found in the maps.
 */
export function computeSortKeySync(
  eventId: string,
  eventById: Map<string, { chapterId: string; sortOrder: number }>,
  chapterNumberById: Map<string, number>
): SortKey {
  const ev = eventById.get(eventId)
  if (!ev) return -1
  const chapNum = chapterNumberById.get(ev.chapterId)
  if (chapNum === undefined) return -1
  return chapNum * 10_000 + ev.sortOrder
}

/**
 * Recompute and write sortKey on every snapshot record attached to a given eventId.
 * Call this after updating an event's sortOrder.
 */
export async function recomputeSnapshotSortKeysForEvent(eventId: string): Promise<void> {
  const sortKey = await computeSortKey(eventId)
  await Promise.all([
    db.characterSnapshots.where('eventId').equals(eventId).modify({ sortKey }),
    db.locationSnapshots.where('eventId').equals(eventId).modify({ sortKey }),
    db.itemSnapshots.where('eventId').equals(eventId).modify({ sortKey }),
    db.relationshipSnapshots.where('eventId').equals(eventId).modify({ sortKey }),
  ])
}

/**
 * Recompute sortKeys for all events in a chapter.
 * Call this after renumbering a chapter.
 */
export async function recomputeSnapshotSortKeysForChapter(chapterId: string): Promise<void> {
  const events = await db.events.where('chapterId').equals(chapterId).toArray()
  await Promise.all(events.map((ev) => recomputeSnapshotSortKeysForEvent(ev.id)))
}
