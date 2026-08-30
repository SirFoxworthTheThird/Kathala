import { computeSortKeySync } from '@/lib/sortKey'

export type EventStub = { id: string; chapterId: string; sortOrder: number }
export type ChapterStub = { id: string; number: number }

/** Minimum shape every snapshot must have to use the generic helpers. */
export type SnapBase = {
  eventId: string
  sortKey?: number | null
  updatedAt: number
}

/**
 * Returns the single best snapshot from `all` at or before `activeEventId`.
 * Prefers an exact match on the active event; otherwise the highest sortKey ≤ activeOrder.
 * Returns undefined when no suitable snapshot exists.
 */
export function resolveSnapshot<T extends SnapBase>(
  all: T[],
  activeEventId: string | null,
  allEvents: EventStub[],
  allChapters: ChapterStub[]
): T | undefined {
  if (!activeEventId || !all.length) return undefined

  const eventById = new Map(allEvents.map((e) => [e.id, e]))
  const chapNumById = new Map(allChapters.map((c) => [c.id, c.number]))
  const getOrder = (snap: T) => orderOf(snap, eventById, chapNumById)
  const activeOrder = computeSortKeySync(activeEventId, eventById, chapNumById)

  if (activeOrder === -1) {
    return all.find((s) => s.eventId === activeEventId)
  }

  let best: T | undefined
  let bestOrder = -1
  for (const snap of all) {
    const order = getOrder(snap)
    if (order === -1 || order > activeOrder) continue
    if (!best || order > bestOrder || (order === bestOrder && snap.eventId === activeEventId)) {
      best = snap
      bestOrder = order
    }
  }
  return best
}

/**
 * Where a snapshot sits in the story, on the same scale as the cursor it will
 * be compared against.
 *
 * This used to read the record's **stored** `sortKey` and compare it against a
 * **freshly computed** position for the cursor, which only holds while every
 * writer of a `sortKey` agrees with the current formula. The shipped library
 * does not: fourteen of the twenty `.pwk` files carry keys on the pre-v7 scale
 * (`chapter + sortOrder / 1_000`) while the code computes
 * `chapter + sortOrder / 1_000_000`, and the importer only rewrites them for
 * files declaring version < 7 — these declare 16 and 18.
 *
 * The two orderings are identical among themselves, so nothing looked wrong.
 * Compared against each other, `1.001 > 1.000001`, so a snapshot was ruled out
 * as "after the cursor" while the cursor sat on the very event it was authored
 * on. Measured on the Fellowship export: 396 of 533 character snapshots, which
 * is why so much of that world's state resolved to an earlier chapter's.
 *
 * Computing both sides removes the class of fault rather than the instance: it
 * cannot disagree with itself, whatever wrote the record or however the file
 * got here. The stored key is still what `HistoryTab` sorts by and what the
 * Dexie indexes carry; it is only unfit as a *comparand* for a computed one.
 */
function orderOf<T extends SnapBase>(
  snap: T,
  eventById: Map<string, { chapterId: string; sortOrder: number }>,
  chapNumById: Map<string, number>,
): number {
  const computed = computeSortKeySync(snap.eventId, eventById, chapNumById)
  // Fall back to the stored key only when the event is gone — an orphaned
  // snapshot has no position to compute, and the stored one is all there is.
  return computed === -1 ? snap.sortKey ?? -1 : computed
}

/**
 * Returns one best snapshot per entity (keyed by `getEntityId`) across all of `all`.
 * When `activeEventId` is null: returns the most recently updated snapshot per entity.
 * When `activeEventId` is set: for each entity, the snapshot with the highest
 * sortKey ≤ activeOrder (exact match on the active event takes priority).
 */
export function selectBestSnapshots<T extends SnapBase>(
  all: T[],
  activeEventId: string | null,
  allEvents: EventStub[],
  allChapters: ChapterStub[],
  getEntityId: (snap: T) => string
): T[] {
  if (!all.length) return all

  if (!activeEventId) {
    const byEntity = new Map<string, T>()
    for (const snap of all) {
      const eid = getEntityId(snap)
      const current = byEntity.get(eid)
      if (!current || snap.updatedAt > current.updatedAt) {
        byEntity.set(eid, snap)
      }
    }
    return Array.from(byEntity.values())
  }

  const eventById = new Map(allEvents.map((e) => [e.id, e]))
  const chapNumById = new Map(allChapters.map((c) => [c.id, c.number]))
  const getOrder = (snap: T) => orderOf(snap, eventById, chapNumById)
  const activeOrder = computeSortKeySync(activeEventId, eventById, chapNumById)

  if (activeOrder === -1) {
    return all.filter((s) => s.eventId === activeEventId)
  }

  const byEntity = new Map<string, T>()
  for (const snap of all) {
    const order = getOrder(snap)
    if (order === -1 || order > activeOrder) continue
    const eid = getEntityId(snap)
    const current = byEntity.get(eid)
    if (!current) {
      byEntity.set(eid, snap)
      continue
    }
    const currentOrder = getOrder(current)
    if (snap.eventId === activeEventId) {
      byEntity.set(eid, snap)
    } else if (current.eventId !== activeEventId && order > currentOrder) {
      byEntity.set(eid, snap)
    }
  }
  return Array.from(byEntity.values())
}
