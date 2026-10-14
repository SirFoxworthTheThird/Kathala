import { useMemo } from 'react'
import { useWorld } from '@/db/hooks/useWorlds'
import { useTimelines, useWorldChapters, useWorldEvents } from '@/db/hooks/useTimeline'
import { computeInWorldDays } from '@/lib/inWorldTime'
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
