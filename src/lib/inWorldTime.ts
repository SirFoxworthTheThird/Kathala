import type { WorldEvent, Chapter, Timeline } from '@/types'

/**
 * Derives an absolute in-world "day" for each event from the existing
 * `travelDays` field (days of travel *before* an event) accumulated along
 * narrative order.
 *
 * The clock is computed per timeline — each timeline starts at its `dayOffset`
 * (0 unless `timelines` is provided) and advances by every non-flashback
 * event's `travelDays`. Flashbacks are retrospective, so they never advance the
 * clock; they report the surrounding day but callers should present them as
 * flashbacks rather than a real date. An explicit `inWorldTime` pin is a day on
 * the timeline's own clock, so the offset applies to it too.
 *
 * Pass `timelines` wherever absolute days are displayed or merged across
 * timelines (chronological merges, the calendar, day labels). Consumers that
 * only take day *differences* within one timeline can omit it — a constant
 * offset cancels out.
 *
 * Pure and dependency-free so it stays cheap to call and easy to test. No data
 * is stored — this only surfaces chronology already implicit in `travelDays`.
 */
export function computeInWorldDays(
  events: WorldEvent[],
  chapters: Chapter[],
  timelines?: Array<Pick<Timeline, 'id' | 'dayOffset'>>,
): Map<string, number> {
  const chapterNumberById = new Map(chapters.map((c) => [c.id, c.number]))
  const offsetByTimeline = new Map((timelines ?? []).map((t) => [t.id, t.dayOffset ?? 0]))

  // Group by timeline — each timeline keeps its own clock.
  const byTimeline = new Map<string, WorldEvent[]>()
  for (const ev of events) {
    const list = byTimeline.get(ev.timelineId)
    if (list) list.push(ev)
    else byTimeline.set(ev.timelineId, [ev])
  }

  const dayByEvent = new Map<string, number>()
  for (const [timelineId, list] of byTimeline) {
    const ordered = [...list].sort((a, b) => {
      const byChapter = (chapterNumberById.get(a.chapterId) ?? 0) - (chapterNumberById.get(b.chapterId) ?? 0)
      return byChapter !== 0 ? byChapter : a.sortOrder - b.sortOrder
    })
    const offset = offsetByTimeline.get(timelineId) ?? 0
    let day = offset
    for (const ev of ordered) {
      // An explicit in-world time pins the event (e.g. a flashback to its true
      // date) on this timeline's own clock, and does not disturb the running
      // derived clock.
      if (ev.inWorldTime != null) {
        dayByEvent.set(ev.id, offset + ev.inWorldTime)
        continue
      }
      if (!ev.isFlashback) day += ev.travelDays ?? 0
      dayByEvent.set(ev.id, day)
    }
  }
  return dayByEvent
}
