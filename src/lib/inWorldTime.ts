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

/**
 * The events whose date the clock *derived* rather than the writer *stated*.
 *
 * The calendar reads authoritative even where it mostly reflects missing data:
 * an event with no `travelDays` advances the clock by nothing, so a run of them
 * stacks on the day the previous event happened to land on, and a fresh world
 * shows every scene sitting on the first day of the year. HB-5 filed that as
 * "untimed events silently pile onto the first calendar day", and the word that
 * matters is *silently* — the stacking itself is correct behaviour for a story
 * whose scenes all happen at once.
 *
 * Deliberately narrower than "has no `travelDays`":
 *
 * - **A pinned `inWorldTime` is stated**, whatever else is missing.
 * - **The first event on a timeline is stated by being first.** `travelDays` is
 *   days since the *previous* event and there is no previous event, so it
 *   cannot say anything; the event starts the clock at the timeline's offset.
 * - **`travelDays: 0` is stated.** Zero is a writer saying "the same day", and
 *   the field distinguishes it from empty — `handleTravelDaysChange` stores
 *   `null` only for a cleared field.
 * - **A flashback with no pin is never stated.** It does not advance the clock
 *   and reports the surrounding day, which is precisely not its own date.
 *
 * Ordering matches `computeInWorldDays` exactly, and for the same reason: the
 * two would disagree about which event is first otherwise.
 */
export function provisionallyDatedEvents(
  events: WorldEvent[],
  chapters: Chapter[],
): Set<string> {
  const chapterNumberById = new Map(chapters.map((c) => [c.id, c.number]))

  const byTimeline = new Map<string, WorldEvent[]>()
  for (const ev of events) {
    const list = byTimeline.get(ev.timelineId)
    if (list) list.push(ev)
    else byTimeline.set(ev.timelineId, [ev])
  }

  const provisional = new Set<string>()
  for (const list of byTimeline.values()) {
    const ordered = [...list].sort((a, b) => {
      const byChapter = (chapterNumberById.get(a.chapterId) ?? 0) - (chapterNumberById.get(b.chapterId) ?? 0)
      return byChapter !== 0 ? byChapter : a.sortOrder - b.sortOrder
    })
    for (let i = 0; i < ordered.length; i++) {
      const ev = ordered[i]
      if (ev.inWorldTime != null) continue
      if (ev.isFlashback) { provisional.add(ev.id); continue }
      if (i === 0) continue
      if (ev.travelDays == null) provisional.add(ev.id)
    }
  }
  return provisional
}
