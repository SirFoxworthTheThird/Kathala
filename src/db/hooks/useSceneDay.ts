import { useMemo } from 'react'
import { useWorld } from '@/db/hooks/useWorlds'
import { useTimelines, useWorldChapters, useWorldEvents } from '@/db/hooks/useTimeline'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import { computeInWorldDays } from '@/lib/inWorldTime'
import { sceneTimeOf, type SceneTime } from '@/lib/sceneTime'
import type { WorldCalendar } from '@/types'

/**
 * A scene's day on the in-world clock, and the world's calendar: what a pin's
 * date picker starts from. The day is the derived one when the scene has no pin.
 * And the scene's timeline's start day, which a pin is counted from.
 */
export function useSceneDay(worldId: string, eventId: string): { calendar: WorldCalendar | null; day: number | undefined; offset: number } {
  const world = useWorld(worldId)
  const events = useWorldEvents(worldId)
  const chapters = useWorldChapters(worldId)
  const timelines = useTimelines(worldId)
  const day = useMemo(
    () => computeInWorldDays(events, chapters, timelines, { pinsSetClock: world?.pinsSetClock }).get(eventId),
    [events, chapters, timelines, world?.pinsSetClock, eventId],
  )
  const timelineId = events?.find((e) => e.id === eventId)?.timelineId
  const offset = timelines?.find((t) => t.id === timelineId)?.dayOffset ?? 0
  return { calendar: world?.calendar ?? null, day, offset }
}

/**
 * A scene's time and where it sits, from the store, for reading its `When:`
 * line (`planWhen`): read fresh, as the rest of a header's apply reads, since a
 * line left straight after another was applied must see that one's writes.
 */
export async function loadSceneTime(eventId: string): Promise<SceneTime | undefined> {
  const event = await db.events.get(eventId)
  if (!event) return undefined
  const [events, chapters, timeline, world] = await Promise.all([
    db.events.where('timelineId').equals(event.timelineId).toArray(),
    db.chapters.where('timelineId').equals(event.timelineId).toArray(),
    db.timelines.get(event.timelineId),
    db.worlds.get(event.worldId),
  ])
  return sceneTimeOf(event, { events, chapters, timeline, calendar: world?.calendar ?? null, rules: { pinsSetClock: world?.pinsSetClock } })
}

/** What a scene's `When:` line is drawn with: the book's calendar, and its timeline's start. */
export function useWhenDrawing(worldId: string, timelineId: string): { calendar: WorldCalendar | null; offset: number } {
  const world = useWorld(worldId)
  const timeline = useLiveQuery(() => db.timelines.get(timelineId), [timelineId])
  return { calendar: world?.calendar ?? null, offset: timeline?.dayOffset ?? 0 }
}
