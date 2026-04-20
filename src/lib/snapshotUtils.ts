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
  const getOrder = (snap: T) =>
    snap.sortKey ?? computeSortKeySync(snap.eventId, eventById, chapNumById)
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
  const getOrder = (snap: T) =>
    snap.sortKey ?? computeSortKeySync(snap.eventId, eventById, chapNumById)
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
