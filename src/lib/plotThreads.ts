import type { PlotThread, WorldEvent, Chapter } from '@/types'

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
 * (unstarted threads last). Pure — nothing stored.
 */
export function computeThreadCadence({
  threads, events, chapters,
}: {
  threads: PlotThread[]
  events: WorldEvent[]
  chapters: Chapter[]
}): ThreadCadenceResult {
  const sortedChapters = [...chapters].sort((a, b) => a.number - b.number)
  const eventsByChapter = new Map<string, WorldEvent[]>()
  for (const e of events) {
    const arr = eventsByChapter.get(e.chapterId)
    if (arr) arr.push(e)
    else eventsByChapter.set(e.chapterId, [e])
  }

  const rows: ThreadCadence[] = threads.map((thread) => {
    const eventCount = events.reduce((n, e) => n + ((e.threadIds ?? []).includes(thread.id) ? 1 : 0), 0)

    const presenceByChapter = sortedChapters.map((ch) =>
      (eventsByChapter.get(ch.id) ?? []).some((e) => (e.threadIds ?? []).includes(thread.id))
    )
    const firstIdx = presenceByChapter.indexOf(true)
    const lastIdx = presenceByChapter.lastIndexOf(true)

    let longestDormancy = 0
    if (firstIdx !== -1) {
      let run = 0
      for (let i = firstIdx + 1; i < lastIdx; i++) {
        if (!presenceByChapter[i]) { run++; longestDormancy = Math.max(longestDormancy, run) }
        else run = 0
      }
    }

    return {
      thread,
      eventCount,
      presenceByChapter,
      firstChapterNumber: firstIdx >= 0 ? sortedChapters[firstIdx].number : null,
      lastChapterNumber: lastIdx >= 0 ? sortedChapters[lastIdx].number : null,
      trailingGap: lastIdx === -1 ? sortedChapters.length : sortedChapters.length - 1 - lastIdx,
      longestDormancy,
    }
  })

  // Narrative order: by first appearance; threads never advanced sort last.
  rows.sort((a, b) => {
    const fa = a.firstChapterNumber ?? Infinity
    const fb = b.firstChapterNumber ?? Infinity
    return fa - fb || a.thread.name.localeCompare(b.thread.name)
  })

  return { rows, chapterCount: sortedChapters.length }
}
