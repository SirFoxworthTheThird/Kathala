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
import { compareByPosition, moveTo } from '@/lib/fractionalOrder'
import { planChapterInsert, planChapterMove } from '@/lib/chapterNumbering'

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
  data: Pick<Chapter, 'worldId' | 'timelineId' | 'number' | 'title' | 'synopsis'> & {
    /** Given when the caller already refers to the chapter by id — the Page view's heading for a new chapter. */
    id?: string
  }
): Promise<Chapter> {
  const now = Date.now()
  const chapter: Chapter = {
    notes: '',
    wordGoal: null,
    ...data,
    id: data.id ?? generateId(),
    createdAt: now,
    updatedAt: now,
  }
  return journalCreate('chapter', db.chapters, chapter)
}

/**
 * Create a chapter at the number the writer chose.
 *
 * A free number is simply taken. A taken one means *put it there*: the chapter
 * holding it moves up one, and so does each one after it until a gap — see
 * `planChapterInsert`. Nothing ever ends up sharing a number, because a chapter
 * number is a position, and two chapters in one position interleave their
 * scenes in the order state is read along.
 *
 * Every chapter that moves is renumbered through `updateChapter`, which rekeys
 * the snapshots in it. Highest first, so no two chapters hold a number at once
 * even between writes. And all of it is one journal group, so the undo that
 * takes the chapter away puts the others back too — rekeyed, since undo now
 * rekeys whatever it touches.
 */
export async function createChapterAt(
  data: Pick<Chapter, 'worldId' | 'timelineId' | 'number' | 'title' | 'synopsis'> & { id?: string },
): Promise<Chapter> {
  return journalGroup(async () => {
    const siblings = await db.chapters.where('timelineId').equals(data.timelineId).toArray()
    const shifts = planChapterInsert(siblings, data.number)
    for (const { id, to } of [...shifts].sort((a, b) => b.from - a.from)) {
      await updateChapter(id, { number: to })
    }
    return createChapter(data)
  })
}

/**
 * Move a chapter to another place in its timeline — `toIndex` in the new order,
 * 0-based.
 *
 * A chapter's number is its position, so moving it is renumbering: the
 * chapters take the timeline's existing numbers in their new order (see
 * `planChapterMove`), and every chapter whose number changes has its snapshots'
 * stored positions recomputed by `updateChapter`. One act, so one undo.
 * Returns whether anything moved.
 */
export async function moveChapterTo(chapterId: string, toIndex: number): Promise<boolean> {
  const chapter = await db.chapters.get(chapterId)
  if (!chapter) return false
  const siblings = await db.chapters.where('timelineId').equals(chapter.timelineId).toArray()
  const shifts = planChapterMove(siblings, chapterId, toIndex)
  if (shifts.length === 0) return false
  await journalGroup(async () => {
    for (const { id, to } of shifts) await updateChapter(id, { number: to })
  })
  return true
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
    /** Given when the caller already refers to the scene by id — the Page view's heading for a split. */
    id?: string
  }
): Promise<WorldEvent> {
  const now = Date.now()
  const event: WorldEvent = {
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
    id: data.id ?? generateId(),
    createdAt: now,
    updatedAt: now,
  }
  return journalCreate('event', db.events, event)
}

/**
 * Create a scene at `index` in a chapter — the binder's "a new scene on the line
 * below".
 *
 * Positioned the way `moveEventOnBoard` moves a scene: *between* its neighbours, so
 * the ordinary insert writes exactly one row, the new one, and nothing that
 * already existed is touched. Only when the gap between the two neighbours has
 * been halved down to nothing does the chapter get renumbered — and then its
 * snapshot sort keys with it, because a stored sortKey is computed from the
 * event's position and would otherwise go on claiming the old one.
 *
 * One journal group, so a mistaken Enter is one undo — including the
 * renumbering, when there was one.
 */
export async function createEventAt(
  chapterId: string,
  index: number,
  title: string,
  /** Anything else the new scene starts with — a split carries its cast and setting over. */
  fields: Partial<Pick<WorldEvent,
    'id' | 'locationMarkerId' | 'involvedCharacterIds' | 'involvedItemIds' | 'tags' | 'status'
    | 'povCharacterId' | 'isFlashback' | 'threadIds' | 'motifIds'>> = {},
): Promise<WorldEvent | undefined> {
  const chapter = await db.chapters.get(chapterId)
  if (!chapter) return undefined
  return journalGroup(async () => {
    const siblings = await db.events.where('chapterId').equals(chapterId).toArray()
    // A stand-in for the scene that does not exist yet: `moveTo` answers "where
    // does this go", and asking it about a newcomer is the same question.
    const NEWCOMER = '\u0000newcomer'
    const writes = moveTo(
      [...siblings.map(({ id, sortOrder }) => ({ id, sortOrder })), { id: NEWCOMER, sortOrder: 0 }],
      NEWCOMER,
      index,
    )
    const position = writes.find((w) => w.id === NEWCOMER)!.sortOrder
    const current = new Map(siblings.map((e) => [e.id, e.sortOrder]))
    const renumbered = writes.filter((w) => w.id !== NEWCOMER && current.get(w.id) !== w.sortOrder)
    for (const { id, sortOrder } of renumbered) {
      await journalUpdate('event', db.events, id, { sortOrder, updatedAt: Date.now() })
    }
    const created = await createEvent({
      worldId: chapter.worldId,
      chapterId,
      timelineId: chapter.timelineId,
      title,
      description: '',
      locationMarkerId: null,
      involvedCharacterIds: [],
      involvedItemIds: [],
      tags: [],
      ...fields,
      sortOrder: position,
    })
    if (renumbered.length > 0) await recomputeSnapshotSortKeysForChapter(chapterId)
    return created
  })
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
 * Move a scene to a position: into `toChapterId` at `toIndex` — the binder's
 * drag and the scene steppers. Handles the within-chapter reorder too. (Named
 * for the Corkboard, the board it was written for and has outlived.)
 *
 * The moved card takes a position *between* its new neighbours rather than the
 * column being renumbered, so an ordinary move writes one row. That is what
 * lets two devices reorder at once: separate moves touch separate rows, and a
 * merge has nothing to choose between. Only an exhausted gap renumbers, and
 * only the column it happens in.
 *
 * The source column needs nothing at all — removing a card from between two
 * positions leaves the rest still in order.
 */
/**
 * One step earlier or later: past its neighbour within the chapter, or — from
 * the first or last place — to the end of the chapter before or the start of
 * the chapter after, in the same timeline. Returns whether it moved; the first
 * scene of the book has nowhere earlier to go.
 *
 * The one mover behind the ↑ ↓ on a scene card and Alt+↑ ↓ in the binder, so
 * the two cannot disagree about what a step is.
 */
export async function moveSceneStep(eventId: string, dir: 'up' | 'down'): Promise<boolean> {
  const moved = await db.events.get(eventId)
  if (!moved) return false
  const siblings = (await db.events.where('chapterId').equals(moved.chapterId).toArray()).sort(compareByPosition)
  const idx = siblings.findIndex((e) => e.id === eventId)
  const atEdge = dir === 'up' ? idx === 0 : idx === siblings.length - 1
  if (atEdge) {
    const chapters = (await db.chapters.where('timelineId').equals(moved.timelineId).toArray())
      .sort((a, b) => a.number - b.number || a.id.localeCompare(b.id))
    const at = chapters.findIndex((c) => c.id === moved.chapterId)
    const neighbour = chapters[dir === 'up' ? at - 1 : at + 1]
    if (!neighbour) return false
    // `moveTo` clamps, so past the end simply means "last".
    await moveEventOnBoard(eventId, neighbour.id, dir === 'up' ? Number.MAX_SAFE_INTEGER : 0)
    return true
  }
  /*
    Within the chapter, by the board's own mover rather than by swapping the two
    sortOrders: a swap of two equal values — older data can hold ties — writes
    twice and changes nothing, while `moveTo` places it and renumbers the run.
  */
  await moveEventOnBoard(eventId, moved.chapterId, dir === 'up' ? idx - 1 : idx + 1)
  return true
}

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

  /*
    One act, so one undo. A move into another chapter writes two operations —
    the chapter, then the position — and ungrouped they took two Ctrl+Zs to put
    back: the first restored the position and left the scene in the wrong
    chapter.
  */
  await journalGroup(() => db.transaction('rw', [db.events, db.operations, db.tombstones], async () => {
    // Target column: current order (moved card excluded when arriving from
    // elsewhere), then insert the moved card at the requested index.
    const targetEvents = (await db.events.where('chapterId').equals(toChapterId).toArray())
      .filter((e) => e.id !== eventId)
      .sort(compareByPosition)
    const writes = moveTo([...targetEvents, { id: eventId, sortOrder: moved.sortOrder }], eventId, toIndex)

    // The moved card changes chapter/timeline (a no-op update when it doesn't).
    if (crossesChapter) {
      await journalUpdate('event', db.events, eventId, {
        chapterId: toChapterId,
        timelineId: targetChapter.timelineId,
        updatedAt: Date.now(),
      })
    }

    // Usually a single row: the card that moved.
    for (const { id, sortOrder } of writes) {
      await journalUpdate('event', db.events, id, { sortOrder, updatedAt: Date.now() })
    }

  }))

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
