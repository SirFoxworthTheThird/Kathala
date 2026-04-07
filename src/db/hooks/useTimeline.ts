import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import type { Timeline, Chapter, WorldEvent } from '@/types'
import { generateId } from '@/lib/id'

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

/** Creates an event and inherits snapshot state from the previous event.
 *  Looks for a prior event in the same chapter (by sortOrder), then falls back
 *  to the last event of the previous chapter in the same timeline. */
export async function createEvent(data: Omit<WorldEvent, 'id' | 'createdAt' | 'updatedAt' | 'travelDays'> & { travelDays?: number | null }): Promise<WorldEvent> {
  const now = Date.now()
  const event: WorldEvent = {
    id: generateId(),
    travelDays: null,
    ...data,
    createdAt: now,
    updatedAt: now,
  }

  await db.transaction('rw', [
    db.events, db.chapters, db.characterSnapshots, db.itemPlacements,
    db.locationSnapshots, db.itemSnapshots,
  ], async () => {
    await db.events.add(event)

    // Find the previous event to inherit state from
    let prevEventId: string | null = null

    // 1. Look for a prior event in the same chapter
    const siblingsInChapter = await db.events
      .where('chapterId').equals(data.chapterId)
      .filter((e) => e.sortOrder < data.sortOrder && e.id !== event.id)
      .sortBy('sortOrder')

    if (siblingsInChapter.length > 0) {
      prevEventId = siblingsInChapter[siblingsInChapter.length - 1].id
    } else {
      // 2. Fall back to the last event of the previous chapter in the same timeline
      const chapter = await db.chapters.get(data.chapterId)
      if (chapter) {
        const prevChapters = await db.chapters
          .where('timelineId').equals(data.timelineId)
          .filter((c) => c.number < chapter.number)
          .sortBy('number')
        const prevChapter = prevChapters[prevChapters.length - 1]
        if (prevChapter) {
          const prevChapterEvents = await db.events
            .where('chapterId').equals(prevChapter.id)
            .sortBy('sortOrder')
          if (prevChapterEvents.length > 0) {
            prevEventId = prevChapterEvents[prevChapterEvents.length - 1].id
          }
        }
      }
    }

    if (!prevEventId) return

    // Copy snapshots from the previous event
    const [prevSnapshots, prevPlacements, prevLocSnaps, prevItemSnaps] = await Promise.all([
      db.characterSnapshots.where('eventId').equals(prevEventId).toArray(),
      db.itemPlacements.where('eventId').equals(prevEventId).toArray(),
      db.locationSnapshots.where('eventId').equals(prevEventId).toArray(),
      db.itemSnapshots.where('eventId').equals(prevEventId).toArray(),
    ])

    if (prevSnapshots.length > 0) {
      await db.characterSnapshots.bulkAdd(
        prevSnapshots.map((s) => ({ ...s, id: generateId(), eventId: event.id, createdAt: now, updatedAt: now }))
      )
    }
    if (prevPlacements.length > 0) {
      await db.itemPlacements.bulkAdd(
        prevPlacements.map((p) => ({ ...p, id: generateId(), eventId: event.id, createdAt: now, updatedAt: now }))
      )
    }
    if (prevLocSnaps.length > 0) {
      await db.locationSnapshots.bulkAdd(
        prevLocSnaps.map((s) => ({ ...s, id: generateId(), eventId: event.id, createdAt: now, updatedAt: now }))
      )
    }
    if (prevItemSnaps.length > 0) {
      await db.itemSnapshots.bulkAdd(
        prevItemSnaps.map((s) => ({ ...s, id: generateId(), eventId: event.id, createdAt: now, updatedAt: now }))
      )
    }
  })

  return event
}

export async function updateEvent(id: string, data: Partial<Omit<WorldEvent, 'id' | 'createdAt'>>) {
  await db.events.update(id, { ...data, updatedAt: Date.now() })
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
