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
