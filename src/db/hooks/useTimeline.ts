import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import { useGate } from './ReadingGateContext'
import { sortKeysByEvent } from '@/lib/spoilers'
import { journalCreate, journalUpdate, journalDelete, journalGroup } from './useOperations'
import type { Timeline, Chapter, WorldEvent, EventStatus } from '@/types'
import { generateId } from '@/lib/id'
import {
  recomputeSnapshotSortKeysForEvent,
  recomputeSnapshotSortKeysForChapter,
} from '@/lib/sortKey'
import { reorderInsert, sortOrderDiff } from '@/lib/corkboard'

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
    dayOffset: 0,
    ...data,
    createdAt: Date.now(),
  }
  return journalCreate('timeline', db.timelines, timeline)
}

export async function updateTimeline(id: string, data: Partial<Omit<Timeline, 'id' | 'createdAt'>>) {
  await journalUpdate('timeline', db.timelines, id, data)
}

export async function deleteTimeline(id: string) {
  await journalDelete('timeline', db.timelines, id, async () => {
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
      await db.mapRegionSnapshots.where('eventId').equals(ev.id).delete()
      await db.sceneTexts.where('eventId').equals(ev.id).delete()
    }
    await db.timelineRelationships
      .filter((r) => r.sourceTimelineId === id || r.targetTimelineId === id)
      .delete()
    await db.crossTimelineArtifacts
      .filter((a) => a.originTimelineId === id || a.encounterTimelineId === id)
      .delete()
  }, [
    db.chapters, db.events,
    db.characterSnapshots, db.itemPlacements, db.locationSnapshots,
    db.itemSnapshots, db.characterMovements, db.relationshipSnapshots,
    db.mapRegionSnapshots, db.timelineRelationships, db.crossTimelineArtifacts,
    db.sceneTexts,
  ])
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
    wordGoal: null,
    ...data,
    createdAt: now,
    updatedAt: now,
  }
  return journalCreate('chapter', db.chapters, chapter)
}

export async function updateChapter(
  id: string,
  data: Partial<Omit<Chapter, 'id' | 'createdAt'>>,
  options: { coalesce?: boolean } = {},
) {
  await journalUpdate('chapter', db.chapters, id, { ...data, updatedAt: Date.now() }, [], options)
  // If chapter number changed, recompute sortKeys for all events in this chapter
  if (data.number !== undefined) {
    await recomputeSnapshotSortKeysForChapter(id)
  }
}

export async function deleteChapter(id: string) {
  await journalDelete('chapter', db.chapters, id, async () => {
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
      await db.mapRegionSnapshots.where('eventId').equals(ev.id).delete()
      await db.sceneTexts.where('eventId').equals(ev.id).delete()
    }
  }, [
    db.events, db.characterSnapshots,
    db.itemPlacements, db.locationSnapshots, db.itemSnapshots,
    db.characterMovements, db.relationshipSnapshots, db.mapRegionSnapshots,
    db.sceneTexts,
  ])
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

/**
 * Every event in the world, ungated.
 *
 * The time cursor needs this: it has to know what comes next in order to step
 * there, and gating its own list would strand the reader at the moment they had
 * reached. Anything that *displays* events should use `useWorldEvents`.
 */
export function useAllWorldEvents(worldId: string | null) {
  return useLiveQuery(
    () => (worldId ? db.events.where('worldId').equals(worldId).toArray() : []),
    [worldId],
    []
  )
}

/**
 * Events up to the reader's position.
 *
 * An event title is an authored summary of what happens in it — "Nicolas
 * Flamel" or "The Mirror of Erised" as a heading gives away the thing itself,
 * so in reading mode the list stops at the cursor.
 */
export function useWorldEvents(worldId: string | null) {
  const gate = useGate()
  const all = useAllWorldEvents(worldId)
  const chapters = useWorldChapters(worldId)
  return useMemo(() => {
    if (!gate.active || gate.cursor === null) return all
    const keys = sortKeysByEvent(all, new Map(chapters.map((c) => [c.id, c.number])))
    const cursor = gate.cursor
    // An event we cannot place has no position to compare, so it stays — the
    // same choice `isRevealed` makes for an entity that never appears.
    return all.filter((e) => (keys.get(e.id) ?? -Infinity) <= cursor)
  }, [gate.active, gate.cursor, all, chapters])
}

export function useEvent(id: string | null) {
  return useLiveQuery(() => (id ? db.events.get(id) : undefined), [id])
}

/** Creates an event. In the delta/last-known model, no snapshot inheritance is needed —
 *  state is resolved by looking back to the most recent prior snapshot at read time. */
export async function createEvent(
  data: Omit<WorldEvent, 'id' | 'createdAt' | 'updatedAt' | 'travelDays' | 'inWorldTime' | 'tension' | 'structureBeat' | 'status' | 'povCharacterId' | 'isFlashback' | 'mentionedCharacterIds' | 'threadIds'> & {
    travelDays?: number | null
    inWorldTime?: number | null
    tension?: number | null
    structureBeat?: string | null
    status?: EventStatus
    povCharacterId?: string | null
    isFlashback?: boolean
    mentionedCharacterIds?: string[]
    threadIds?: string[]
  }
): Promise<WorldEvent> {
  const now = Date.now()
  const event: WorldEvent = {
    id: generateId(),
    travelDays: null,
    inWorldTime: null,
    tension: null,
    structureBeat: null,
    status: 'draft',
    povCharacterId: null,
    isFlashback: false,
    mentionedCharacterIds: [],
    threadIds: [],
    motifIds: [],
    ...data,
    createdAt: now,
    updatedAt: now,
  }
  return journalCreate('event', db.events, event)
}

export async function updateEvent(id: string, data: Partial<Omit<WorldEvent, 'id' | 'createdAt'>>) {
  await journalUpdate('event', db.events, id, { ...data, updatedAt: Date.now() })
  // If sortOrder changed, recompute sortKeys on all snapshots for this event
  if (data.sortOrder !== undefined) {
    await recomputeSnapshotSortKeysForEvent(id)
  }
}

export async function deleteEvent(id: string) {
  await journalDelete('event', db.events, id, async () => {
    await db.events.delete(id)
    // Goals scoped to this event lose that bound rather than dangling.
    await db.characterGoals.where('startEventId').equals(id).modify({ startEventId: null })
    await db.characterGoals.where('endEventId').equals(id).modify({ endEventId: null })
    await db.characterSnapshots.where('eventId').equals(id).delete()
    await db.itemPlacements.where('eventId').equals(id).delete()
    await db.locationSnapshots.where('eventId').equals(id).delete()
    await db.itemSnapshots.where('eventId').equals(id).delete()
    await db.characterMovements.where('eventId').equals(id).delete()
    await db.relationshipSnapshots.where('eventId').equals(id).delete()
    await db.mapRegionSnapshots.where('eventId').equals(id).delete()
    await db.sceneTexts.where('eventId').equals(id).delete()
    await db.sceneRevisions.where('eventId').equals(id).delete()
  }, [
    db.characterSnapshots, db.itemPlacements,
    db.locationSnapshots, db.itemSnapshots, db.characterMovements,
    db.relationshipSnapshots, db.mapRegionSnapshots, db.sceneTexts, db.sceneRevisions,
    db.characterGoals,
  ])
}

export async function bulkDeleteEvents(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  // One journalled delete per event rather than a single wholesale sweep: the
  // journal has to account for every record that left the store, and a bulk
  // path that skipped it would make the journal quietly disagree with reality.
  // Grouped so the selection comes back in one undo, not one per event.
  await journalGroup(async () => {
    for (const id of ids) await deleteEvent(id)
  })
}

export async function bulkMoveEvents(ids: string[], targetChapterId: string): Promise<void> {
  if (ids.length === 0) return
  const targetChapter = await db.chapters.get(targetChapterId)
  if (!targetChapter) return
  // Find highest existing sortOrder in target chapter to append after
  const existingEvents = await db.events.where('chapterId').equals(targetChapterId).toArray()
  const maxSortOrder = existingEvents.reduce((max, e) => Math.max(max, e.sortOrder), -1)
  // Journalled one at a time rather than in a single sweep, so the journal
  // accounts for every row that changed.
  for (let i = 0; i < ids.length; i++) {
    await journalUpdate('event', db.events, ids[i], {
      chapterId: targetChapterId,
      timelineId: targetChapter.timelineId,
      sortOrder: maxSortOrder + 1 + i,
      updatedAt: Date.now(),
    })
  }
  // Recompute sortKeys for moved events
  for (const id of ids) {
    await recomputeSnapshotSortKeysForEvent(id)
  }
}

/**
 * Move an event to a position on the corkboard: into `toChapterId` at
 * `toIndex`, renumbering that chapter's cards (and the source chapter's, when
 * the move crosses chapters). Handles the within-chapter reorder too. Only the
 * rows whose sortOrder actually changes are written.
 */
export async function moveEventOnBoard(
  eventId: string,
  toChapterId: string,
  toIndex: number,
): Promise<void> {
  const [moved, targetChapter] = await Promise.all([
    db.events.get(eventId),
    db.chapters.get(toChapterId),
  ])
  if (!moved || !targetChapter) return

  const fromChapterId = moved.chapterId
  const crossesChapter = fromChapterId !== toChapterId

  await db.transaction('rw', [db.events, db.operations, db.tombstones], async () => {
    // Target column: current order (moved card excluded when arriving from
    // elsewhere), then insert the moved card at the requested index.
    const targetEvents = (await db.events.where('chapterId').equals(toChapterId).toArray())
      .filter((e) => e.id !== eventId)
      .sort((a, b) => a.sortOrder - b.sortOrder)
    const targetIds = reorderInsert(targetEvents.map((e) => e.id), eventId, toIndex)

    // The moved card changes chapter/timeline (a no-op update when it doesn't).
    if (crossesChapter) {
      await journalUpdate('event', db.events, eventId, {
        chapterId: toChapterId,
        timelineId: targetChapter.timelineId,
        updatedAt: Date.now(),
      })
    }

    // Renumber the target column, writing only what changed. The moved card's
    // baseline sortOrder is unknown in the new column, so force-write it.
    const targetCurrent = new Map(targetEvents.map((e) => [e.id, e.sortOrder]))
    for (const { id, sortOrder } of sortOrderDiff(targetIds, targetCurrent)) {
      await journalUpdate('event', db.events, id, { sortOrder, updatedAt: Date.now() })
    }

    // Close the gap left in the source column.
    if (crossesChapter) {
      const sourceEvents = (await db.events.where('chapterId').equals(fromChapterId).toArray())
        .sort((a, b) => a.sortOrder - b.sortOrder)
      const sourceCurrent = new Map(sourceEvents.map((e) => [e.id, e.sortOrder]))
      for (const { id, sortOrder } of sortOrderDiff(sourceEvents.map((e) => e.id), sourceCurrent)) {
        await journalUpdate('event', db.events, id, { sortOrder, updatedAt: Date.now() })
      }
    }
  })

  // Renumbering shifts snapshot sortKeys for every card whose sortOrder moved,
  // and a cross-chapter move changes the moved card's chapter number too.
  await recomputeSnapshotSortKeysForChapter(toChapterId)
  if (crossesChapter) await recomputeSnapshotSortKeysForChapter(fromChapterId)
}

export async function bulkAddTag(ids: string[], tag: string): Promise<void> {
  if (ids.length === 0 || !tag.trim()) return
  const trimmed = tag.trim()
  await db.transaction('rw', [db.events, db.operations, db.tombstones], async () => {
    for (const id of ids) {
      const ev = await db.events.get(id)
      if (!ev) continue
      if (!ev.tags.includes(trimmed)) {
        await journalUpdate('event', db.events, id, { tags: [...ev.tags, trimmed], updatedAt: Date.now() })
      }
    }
  })
}
