import { useMemo } from 'react'
import { db } from '@/db/database'
import { storyOf, type Story } from '@/lib/stateEngine'
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

/** `useStory`, for a write: read inside the caller's transaction where there is one. */
export async function loadStory(worldId: string): Promise<Story> {
  const [events, chapters, timelines, world] = await Promise.all([
    db.events.where('worldId').equals(worldId).toArray(),
    db.chapters.where('worldId').equals(worldId).toArray(),
    db.timelines.where('worldId').equals(worldId).toArray(),
    db.worlds.get(worldId),
  ])
  return storyOf(events, chapters, timelines, { pinsSetClock: world?.pinsSetClock })
}
