import type { PlotThread, WorldEvent, Chapter } from '@/types'
import { computeTagCadence } from '@/lib/tagCadence'

/** How a single plot thread is paced across the story. */
export interface ThreadCadence {
  thread: PlotThread
  /** Events tagged with this thread. */
  eventCount: number
  /** Present-in-chapter flags, one per chapter in narrative order. */
  presenceByChapter: boolean[]
  firstChapterNumber: number | null
  lastChapterNumber: number | null
  /** Chapters between the thread's last beat and the end of the story. */
  trailingGap: number
  /** Longest interior run of chapters with no beat (a thread that goes quiet). */
  longestDormancy: number
}

export interface ThreadCadenceResult {
  rows: ThreadCadence[]
  chapterCount: number
}

/**
 * For each plot thread, derives where it's advanced across the chapters, how
 * long it's been dormant, and its longest interior gap — so dangling or
 * neglected subplots are visible. Rows are in order of first appearance
 * (unstarted threads last). Thin wrapper over the generic tag-cadence engine.
 */
export function computeThreadCadence({
  threads, events, chapters,
}: {
  threads: PlotThread[]
  events: WorldEvent[]
  chapters: Chapter[]
}): ThreadCadenceResult {
  const { rows, chapterCount } = computeTagCadence({
    entities: threads,
    events,
    chapters,
    tagIdsOf: (e) => e.threadIds ?? [],
  })
  return {
    rows: rows.map(({ entity, ...rest }) => ({ thread: entity, ...rest })),
    chapterCount,
  }
}

/** Whether an event advances the given thread. A null thread matches everything
 *  (the "All" filter), so callers can pass the active filter through directly. */
export function eventMatchesThread(event: WorldEvent, threadId: string | null): boolean {
  if (!threadId) return true
  return (event.threadIds ?? []).includes(threadId)
}

/** The chapters that contain at least one event advancing the given thread, in
 *  their original order. A null thread returns every chapter unchanged, so the
 *  timeline can hide chapters with no beat on the focused subplot. */
export function chaptersWithThread(
  chapters: Chapter[],
  events: WorldEvent[],
  threadId: string | null,
): Chapter[] {
  if (!threadId) return chapters
  const chapterIds = new Set(
    events.filter((e) => (e.threadIds ?? []).includes(threadId)).map((e) => e.chapterId),
  )
  return chapters.filter((c) => chapterIds.has(c.id))
}
