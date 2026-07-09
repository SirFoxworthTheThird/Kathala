import type { WorldEvent, Chapter } from '@/types'

/**
 * Derives an absolute in-world "day" for each event from the existing
 * `travelDays` field (days of travel *before* an event) accumulated along
 * narrative order.
 *
 * The clock is computed per timeline — each timeline starts at day 0 and
 * advances by every non-flashback event's `travelDays`. Flashbacks are
 * retrospective, so they never advance the clock; they report the surrounding
 * day but callers should present them as flashbacks rather than a real date.
 *
 * Pure and dependency-free so it stays cheap to call and easy to test. No data
 * is stored — this only surfaces chronology already implicit in `travelDays`.
 */
export function computeInWorldDays(
  events: WorldEvent[],
  chapters: Chapter[],
): Map<string, number> {
  const chapterNumberById = new Map(chapters.map((c) => [c.id, c.number]))

  // Group by timeline — each timeline keeps its own clock.
  const byTimeline = new Map<string, WorldEvent[]>()
  for (const ev of events) {
    const list = byTimeline.get(ev.timelineId)
    if (list) list.push(ev)
    else byTimeline.set(ev.timelineId, [ev])
  }

  const dayByEvent = new Map<string, number>()
  for (const list of byTimeline.values()) {
    const ordered = [...list].sort((a, b) => {
      const byChapter = (chapterNumberById.get(a.chapterId) ?? 0) - (chapterNumberById.get(b.chapterId) ?? 0)
      return byChapter !== 0 ? byChapter : a.sortOrder - b.sortOrder
    })
    let day = 0
    for (const ev of ordered) {
      // An explicit in-world time pins the event (e.g. a flashback to its true
      // date) and does not disturb the running derived clock.
      if (ev.inWorldTime != null) {
        dayByEvent.set(ev.id, ev.inWorldTime)
        continue
      }
      if (!ev.isFlashback) day += ev.travelDays ?? 0
      dayByEvent.set(ev.id, day)
    }
  }
  return dayByEvent
}
