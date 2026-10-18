import { useMemo } from 'react'
import { db } from '@/db/database'
import { lastBefore, storyOf, type Dated, type Story } from '@/lib/stateEngine'
import { useAllWorldEvents, useTimelines, useWorldChapters } from './useTimeline'
import { useWorld } from './useWorlds'

/**
 * The world's scenes placed in the book and in time, for `stateEngine`. Every
 * last-known-state lookup on a screen reads through this.
 *
 * Built from every scene, not the reader's gated list: a timeline's span is a
 * fact about the whole book, and a reader's era rule must not change as they
 * read. Nothing past the cursor is ever resolved, so the ungated list shows a
 * reader nothing they have not reached.
 */
export function useStory(worldId: string | null): Story {
  const events = useAllWorldEvents(worldId)
  const chapters = useWorldChapters(worldId)
  const timelines = useTimelines(worldId)
  const pinsSetClock = useWorld(worldId)?.pinsSetClock
  return useMemo(() => storyOf(events, chapters, timelines, { pinsSetClock }), [events, chapters, timelines, pinsSetClock])
}

/** The tables `loadStory` reads, for a transaction that calls it. */
export const STORY_TABLES = [db.events, db.chapters, db.timelines, db.worlds] as const

/**
 * `useStory`, for a write. Joins the caller's transaction where it covers
 * `STORY_TABLES` (`r?`), and returns Dexie's own promise: awaited inside a
 * transaction through layers of native async functions, the transaction was
 * lost, and the write after it failed as committed too early.
 */
export function loadStory(worldId: string): Promise<Story> {
  return db.transaction('r?', [...STORY_TABLES], async () => {
    const events = await db.events.where('worldId').equals(worldId).toArray()
    const chapters = await db.chapters.where('worldId').equals(worldId).toArray()
    const timelines = await db.timelines.where('worldId').equals(worldId).toArray()
    const world = await db.worlds.get(worldId)
    return storyOf(events, chapters, timelines, { pinsSetClock: world?.pinsSetClock })
  })
}

/**
 * For a write: the record of one entity before scene `eventId`, in this
 * scene's era, whatever kind of thing it is. A write starts from, or repeats,
 * what this era last said; a thing's state carried from another era is shown
 * as such, and recording the same condition here is a statement about this
 * era, not a repeat. Inside a transaction, the transaction must include
 * `STORY_TABLES`.
 */
export function stateBefore<T extends Dated>(records: readonly T[], eventId: string, worldId: string): Promise<T | undefined> {
  return loadStory(worldId).then((story) => lastBefore(records, eventId, story, 'person'))
}
