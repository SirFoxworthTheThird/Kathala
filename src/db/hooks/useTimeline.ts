import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import type { Timeline, Chapter, WorldEvent, EventStatus } from '@/types'
import { generateId } from '@/lib/id'
import {
  recomputeSnapshotSortKeysForEvent,
  recomputeSnapshotSortKeysForChapter,
} from '@/lib/sortKey'

// ─── Timelines ─────────────────────────────────────────────────────────────

export function useTimelines(worldId: string | null) {
  return useLiveQuery(
    () => (worldId ? db.timelines.where('worldId').equals(worldId).toArray() : []),
    [worldId],
    []
  )
}

export function useTimeline(id: string | null) {
  return useLiveQuery(() => (id ? db.timelines.get(id) : undefined), [id])
}

export async function createTimeline(data: Pick<Timeline, 'worldId' | 'name' | 'description' | 'color'>): Promise<Timeline> {
  const timeline: Timeline = {
    id: generateId(),
    ...data,
    createdAt: Date.now(),
  }
  await db.timelines.add(timeline)
  return timeline
}

export async function updateTimeline(id: string, data: Partial<Omit<Timeline, 'id' | 'createdAt'>>) {
  await db.timelines.update(id, data)
}

export async function deleteTimeline(id: string) {
  await db.transaction('rw', [
    db.timelines, db.chapters, db.events,
    db.characterSnapshots, db.itemPlacements, db.locationSnapshots,
    db.itemSnapshots, db.characterMovements, db.relationshipSnapshots,
  ], async () => {
    const events = await db.events.where('timelineId').equals(id).toArray()
    await db.timelines.delete(id)
    await db.chapters.where('timelineId').equals(id).delete()
    await db.events.where('timelineId').equals(id).delete()
    for (const ev of events) {
      await db.characterSnapshots.where('eventId').equals(ev.id).delete()
      await db.itemPlacements.where('eventId').equals(ev.id).delete()
      await db.locationSnapshots.where('eventId').equals(ev.id).delete()
      await db.itemSnapshots.where('eventId').equals(ev.id).delete()
      await db.characterMovements.where('eventId').equals(ev.id).delete()
      await db.relationshipSnapshots.where('eventId').equals(ev.id).delete()
    }
  })
}

// ─── Chapters ──────────────────────────────────────────────────────────────

export function useChapters(timelineId: string | null) {
  return useLiveQuery(
    () =>
      timelineId
        ? db.chapters.where('timelineId').equals(timelineId).sortBy('number')
        : [],
    [timelineId],
    []
  )
}

export function useWorldChapters(worldId: string | null) {
  return useLiveQuery(
    () => (worldId ? db.chapters.where('worldId').equals(worldId).toArray() : []),
    [worldId],
    []
  )
}

export function useChapter(id: string | null) {
  return useLiveQuery(() => (id ? db.chapters.get(id) : undefined), [id])
}

/** Creates a chapter (folder only — no snapshot inheritance; that lives in createEvent). */
export async function createChapter(
  data: Pick<Chapter, 'worldId' | 'timelineId' | 'number' | 'title' | 'synopsis'>
): Promise<Chapter> {
  const now = Date.now()
  const chapter: Chapter = {
    id: generateId(),
    notes: '',
    ...data,
    createdAt: now,
    updatedAt: now,
  }
  await db.chapters.add(chapter)
  return chapter
}

export async function updateChapter(id: string, data: Partial<Omit<Chapter, 'id' | 'createdAt'>>) {
  await db.chapters.update(id, { ...data, updatedAt: Date.now() })
  // If chapter number changed, recompute sortKeys for all events in this chapter
  if (data.number !== undefined) {
    await recomputeSnapshotSortKeysForChapter(id)
  }
}

export async function deleteChapter(id: string) {
  await db.transaction('rw', [
    db.chapters, db.events, db.characterSnapshots,
    db.itemPlacements, db.locationSnapshots, db.itemSnapshots,
    db.characterMovements, db.relationshipSnapshots,
  ], async () => {
    const events = await db.events.where('chapterId').equals(id).toArray()
    await db.chapters.delete(id)
    await db.events.where('chapterId').equals(id).delete()
    for (const ev of events) {
      await db.characterSnapshots.where('eventId').equals(ev.id).delete()
      await db.itemPlacements.where('eventId').equals(ev.id).delete()
      await db.locationSnapshots.where('eventId').equals(ev.id).delete()
      await db.itemSnapshots.where('eventId').equals(ev.id).delete()
      await db.characterMovements.where('eventId').equals(ev.id).delete()
      await db.relationshipSnapshots.where('eventId').equals(ev.id).delete()
    }
  })
}

// ─── Events ────────────────────────────────────────────────────────────────

export function useEvents(chapterId: string | null) {
  return useLiveQuery(
    () =>
      chapterId
        ? db.events.where('chapterId').equals(chapterId).sortBy('sortOrder')
        : [],
    [chapterId],
    []
  )
}

export function useTimelineEvents(timelineId: string | null) {
  return useLiveQuery(
    () =>
      timelineId
        ? db.events.where('timelineId').equals(timelineId).toArray()
        : [],
    [timelineId],
    []
  )
}

export function useWorldEvents(worldId: string | null) {
  return useLiveQuery(
    () => (worldId ? db.events.where('worldId').equals(worldId).toArray() : []),
    [worldId],
    []
  )
}

export function useEvent(id: string | null) {
  return useLiveQuery(() => (id ? db.events.get(id) : undefined), [id])
}

/** Creates an event. In the delta/last-known model, no snapshot inheritance is needed —
 *  state is resolved by looking back to the most recent prior snapshot at read time. */
export async function createEvent(
  data: Omit<WorldEvent, 'id' | 'createdAt' | 'updatedAt' | 'travelDays' | 'status' | 'povCharacterId'> & {
    travelDays?: number | null
    status?: EventStatus
    povCharacterId?: string | null
  }
): Promise<WorldEvent> {
  const now = Date.now()
  const event: WorldEvent = {
    id: generateId(),
    travelDays: null,
    status: 'draft',
    povCharacterId: null,
    ...data,
    createdAt: now,
    updatedAt: now,
  }
  await db.events.add(event)
  return event
}

export async function updateEvent(id: string, data: Partial<Omit<WorldEvent, 'id' | 'createdAt'>>) {
  await db.events.update(id, { ...data, updatedAt: Date.now() })
  // If sortOrder changed, recompute sortKeys on all snapshots for this event
  if (data.sortOrder !== undefined) {
    await recomputeSnapshotSortKeysForEvent(id)
  }
}

export async function deleteEvent(id: string) {
  await db.transaction('rw', [
    db.events, db.characterSnapshots, db.itemPlacements,
    db.locationSnapshots, db.itemSnapshots, db.characterMovements,
    db.relationshipSnapshots,
  ], async () => {
    await db.events.delete(id)
    await db.characterSnapshots.where('eventId').equals(id).delete()
    await db.itemPlacements.where('eventId').equals(id).delete()
    await db.locationSnapshots.where('eventId').equals(id).delete()
    await db.itemSnapshots.where('eventId').equals(id).delete()
    await db.characterMovements.where('eventId').equals(id).delete()
    await db.relationshipSnapshots.where('eventId').equals(id).delete()
  })
}

export async function bulkDeleteEvents(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  await db.transaction('rw', [
    db.events, db.characterSnapshots, db.itemPlacements,
    db.locationSnapshots, db.itemSnapshots, db.characterMovements,
    db.relationshipSnapshots,
  ], async () => {
    for (const id of ids) {
      await db.events.delete(id)
      await db.characterSnapshots.where('eventId').equals(id).delete()
      await db.itemPlacements.where('eventId').equals(id).delete()
      await db.locationSnapshots.where('eventId').equals(id).delete()
      await db.itemSnapshots.where('eventId').equals(id).delete()
      await db.characterMovements.where('eventId').equals(id).delete()
      await db.relationshipSnapshots.where('eventId').equals(id).delete()
    }
  })
}

export async function bulkMoveEvents(ids: string[], targetChapterId: string): Promise<void> {
  if (ids.length === 0) return
  const targetChapter = await db.chapters.get(targetChapterId)
  if (!targetChapter) return
  // Find highest existing sortOrder in target chapter to append after
  const existingEvents = await db.events.where('chapterId').equals(targetChapterId).toArray()
  const maxSortOrder = existingEvents.reduce((max, e) => Math.max(max, e.sortOrder), -1)
  await db.transaction('rw', [db.events], async () => {
    for (let i = 0; i < ids.length; i++) {
      await db.events.update(ids[i], {
        chapterId: targetChapterId,
        timelineId: targetChapter.timelineId,
        sortOrder: maxSortOrder + 1 + i,
        updatedAt: Date.now(),
      })
    }
  })
  // Recompute sortKeys for moved events
  for (const id of ids) {
    await recomputeSnapshotSortKeysForEvent(id)
  }
}

export async function bulkAddTag(ids: string[], tag: string): Promise<void> {
  if (ids.length === 0 || !tag.trim()) return
  const trimmed = tag.trim()
  await db.transaction('rw', [db.events], async () => {
    for (const id of ids) {
      const ev = await db.events.get(id)
      if (!ev) continue
      if (!ev.tags.includes(trimmed)) {
        await db.events.update(id, { tags: [...ev.tags, trimmed], updatedAt: Date.now() })
      }
    }
  })
}
