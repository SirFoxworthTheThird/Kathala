import type { Chapter, PlotThread, WorldEvent } from '@/types'
import { computeThreadCadence } from '@/lib/plotThreads'

/** How long a thread may go quiet mid-story before it's worth flagging. */
export const DORMANCY_CHAPTERS = 3
/** How many chapters may pass after a thread's last beat before it reads as dangling. */
export const TRAILING_CHAPTERS = 3

export interface ThreadIssue {
  threadId: string
  threadName: string
  kind: 'dangling' | 'dormant' | 'unstarted'
  message: string
  detail: string
  /** Chapter the reader should be sent to, when there is a meaningful one. */
  chapterNumber: number | null
}

/**
 * Turns plot-thread cadence into continuity findings: subplots that are raised
 * and never resolved, that go quiet for a long stretch mid-story, or that exist
 * but were never tagged onto a scene.
 *
 * Pure — the Continuity Checker maps these onto its Issue shape (adding
 * navigation), and the dashboard keeps showing the same cadence visually.
 */
export function computeThreadIssues({
  threads, events, chapters,
  dormancyChapters = DORMANCY_CHAPTERS,
  trailingChapters = TRAILING_CHAPTERS,
}: {
  threads: PlotThread[]
  events: WorldEvent[]
  chapters: Chapter[]
  dormancyChapters?: number
  trailingChapters?: number
}): ThreadIssue[] {
  if (threads.length === 0 || chapters.length === 0) return []

  const { rows } = computeThreadCadence({ threads, events, chapters })
  const issues: ThreadIssue[] = []

  for (const row of rows) {
    const name = row.thread.name

    if (row.eventCount === 0) {
      issues.push({
        threadId: row.thread.id,
        threadName: name,
        kind: 'unstarted',
        message: `Plot thread "${name}" has no scenes`,
        detail: 'This thread exists but no scene advances it yet — tag the scenes that carry it, or delete the thread.',
        chapterNumber: null,
      })
      continue
    }

    if (row.trailingGap >= trailingChapters) {
      issues.push({
        threadId: row.thread.id,
        threadName: name,
        kind: 'dangling',
        message: `Plot thread "${name}" is left dangling`,
        detail: `Last advanced in Ch. ${row.lastChapterNumber}, then quiet for the final ${row.trailingGap} chapter${row.trailingGap === 1 ? '' : 's'} — resolve it or carry it into a later scene.`,
        chapterNumber: row.lastChapterNumber,
      })
    }

    if (row.longestDormancy >= dormancyChapters) {
      issues.push({
        threadId: row.thread.id,
        threadName: name,
        kind: 'dormant',
        message: `Plot thread "${name}" goes quiet mid-story`,
        detail: `A run of ${row.longestDormancy} chapters between Ch. ${row.firstChapterNumber} and Ch. ${row.lastChapterNumber} has no beat on this thread — readers may lose the thread.`,
        chapterNumber: row.firstChapterNumber,
      })
    }
  }

  return issues
}
