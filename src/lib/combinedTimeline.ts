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

/** How a combined sequence is ordered:
 *  - 'chrono'   — by in-world day (each timeline clocked from its own day 0).
 *  - 'chapter'  — narrative/reading order: timeline creation, then chapter number. */
export type CombinedOrder = 'chrono' | 'chapter'

/**
 * Merge every timeline's events into one sequence so the real order across
 * storylines is visible in one place.
 *
 * The per-timeline clock from {@link computeInWorldDays} is reused unchanged —
 * each timeline starts at day 0. In 'chrono' order events interleave by that
 * day; in 'chapter' order they follow timeline-then-chapter narrative order.
 * Both break remaining ties by timeline creation order, chapter number, then
 * sortOrder, so parallel storylines read stably rather than jumping around.
 *
 * Pure and dependency-free; the DOM/interaction lives in the views.
 */
export function buildCombinedSequence(
  events: WorldEvent[],
  chapters: Chapter[],
  timelines: Timeline[],
  order: CombinedOrder,
): CombinedRow[] {
  const days = computeInWorldDays(events, chapters)
  const chapterById = new Map(chapters.map((c) => [c.id, c]))
  const timelineById = new Map(timelines.map((t) => [t.id, t]))
  const timelineOrder = new Map(
    [...timelines].sort((a, b) => a.createdAt - b.createdAt).map((t, i) => [t.id, i] as const),
  )

  return [...events]
    .sort((a, b) => {
      if (order === 'chrono') {
        const da = days.get(a.id) ?? 0
        const dbb = days.get(b.id) ?? 0
        if (da !== dbb) return da - dbb
      }
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

/** Chronological merge — the default combined view. Kept as a named helper
 *  because the TimelineView and its tests use it directly. */
export function buildCombinedChronology(
  events: WorldEvent[],
  chapters: Chapter[],
  timelines: Timeline[],
): CombinedRow[] {
  return buildCombinedSequence(events, chapters, timelines, 'chrono')
}

/** A run of consecutive events from one chapter within a combined sequence. In
 *  chapter order each chapter yields one run; in chrono order a chapter can
 *  recur when its scenes are braided with another timeline's — which is exactly
 *  the interleaving the bottom bar should show. */
export interface ChapterRun {
  key: string
  chapter: Chapter | undefined
  timeline: Timeline | undefined
  events: WorldEvent[]
}

/** Groups an ordered combined sequence into consecutive same-chapter runs. */
export function groupChapterRuns(rows: CombinedRow[]): ChapterRun[] {
  const runs: ChapterRun[] = []
  for (const row of rows) {
    const last = runs[runs.length - 1]
    if (last && last.events[0].chapterId === row.event.chapterId) {
      last.events.push(row.event)
    } else {
      runs.push({
        key: `${row.event.chapterId}#${runs.length}`,
        chapter: row.chapter,
        timeline: row.timeline,
        events: [row.event],
      })
    }
  }
  return runs
}
