import type { WorldEvent, Chapter, Timeline } from '@/types'
import { computeInWorldDays } from './inWorldTime'

export interface CombinedRow {
  event: WorldEvent
  chapter: Chapter | undefined
  timeline: Timeline | undefined
  /** Derived in-world day (each timeline is clocked from its own day 0). */
  day: number
  /** A flashback with no explicit in-world time — show as "flashback", not a day. */
  pinnedFlashback: boolean
}

/**
 * Merge every timeline's events into one in-world-chronological sequence so the
 * real order of what happens across storylines is visible in one place.
 *
 * The per-timeline clock from {@link computeInWorldDays} is reused unchanged —
 * each timeline starts at day 0 — and events are then interleaved by that day.
 * Ties break by timeline creation order, then chapter number, then sortOrder,
 * so parallel storylines read stably rather than jumping around.
 *
 * Pure and dependency-free; the DOM/interaction lives in TimelineView.
 */
export function buildCombinedChronology(
  events: WorldEvent[],
  chapters: Chapter[],
  timelines: Timeline[],
): CombinedRow[] {
  const days = computeInWorldDays(events, chapters)
  const chapterById = new Map(chapters.map((c) => [c.id, c]))
  const timelineById = new Map(timelines.map((t) => [t.id, t]))
  const timelineOrder = new Map(
    [...timelines].sort((a, b) => a.createdAt - b.createdAt).map((t, i) => [t.id, i] as const),
  )

  return [...events]
    .sort((a, b) => {
      const da = days.get(a.id) ?? 0
      const dbb = days.get(b.id) ?? 0
      if (da !== dbb) return da - dbb
      const ta = timelineOrder.get(a.timelineId) ?? 0
      const tb = timelineOrder.get(b.timelineId) ?? 0
      if (ta !== tb) return ta - tb
      const ca = chapterById.get(a.chapterId)?.number ?? 0
      const cb = chapterById.get(b.chapterId)?.number ?? 0
      return ca !== cb ? ca - cb : a.sortOrder - b.sortOrder
    })
    .map((event) => ({
      event,
      chapter: chapterById.get(event.chapterId),
      timeline: timelineById.get(event.timelineId),
      day: days.get(event.id) ?? 0,
      pinnedFlashback: event.isFlashback && event.inWorldTime == null,
    }))
}
