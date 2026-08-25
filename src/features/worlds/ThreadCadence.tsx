import { useMemo } from 'react'
import type { Chapter, WorldEvent } from '@/types'
import { usePlotThreads, createPlotThread, deletePlotThread, updatePlotThread } from '@/db/hooks/usePlotThreads'
import { computeTagCadence, type TagCadenceRow } from '@/lib/tagCadence'
import type { PlotThread } from '@/types'
import { CadenceManager } from './CadenceManager'

const THREAD_COLORS = ['#f59e0b', '#ef4444', '#8b5cf6', '#10b981', '#3b82f6', '#ec4899', '#14b8a6', '#f97316']

/**
 * Plot-thread cadence: each subplot's beats across the chapters, so dangling or
 * long-dormant threads stand out. Threads are created and removed here; events
 * are tagged with them on the event card.
 */
export function ThreadCadence({ worldId, chapters, events }: {
  worldId: string
  chapters: Chapter[]
  events: WorldEvent[]
}) {
  const threads = usePlotThreads(worldId)

  const { rows, chapterCount } = useMemo(
    () => computeTagCadence({ entities: threads, events, chapters, tagIdsOf: (e) => e.threadIds ?? [] }),
    [threads, events, chapters]
  )

  function warningFor(r: TagCadenceRow<PlotThread>): string | null {
    if (r.eventCount === 0) return 'no scenes tagged yet'
    if (r.trailingGap >= 3) return `dangling — last advanced Ch. ${r.lastChapterNumber}, quiet ${r.trailingGap} chapters`
    if (r.longestDormancy >= 3) return `goes quiet for ${r.longestDormancy} chapters mid-story`
    return null
  }

  /*
    A subplot the writer has said lands somewhere. Shown here as well as in the
    continuity checker so it can be taken back from the same place it is seen —
    a statement about the book should be as easy to change as it was to make,
    and "reopen" is the only way back once the warning it answered is gone.
  */
  function settledFor(r: TagCadenceRow<PlotThread>) {
    const at = r.entity.resolvedEventId
    if (!at) return null
    const ev = events.find((e) => e.id === at)
    const ch = ev ? chapters.find((c) => c.id === ev.chapterId) : undefined
    return {
      label: ch ? `resolves Ch. ${ch.number}` : 'resolved',
      onClear: () => updatePlotThread(r.entity.id, { resolvedEventId: null }),
    }
  }

  return (
    <CadenceManager
      rows={rows}
      chapterCount={chapterCount}
      noun="thread"
      placeholder="Thread name (e.g. The Rebellion)…"
      onCreate={async (name) => { await createPlotThread({ worldId, name, color: THREAD_COLORS[threads.length % THREAD_COLORS.length] }) }}
      onDelete={deletePlotThread}
      warningFor={warningFor}
      settledFor={settledFor}
      field="threadIds"
      chapters={chapters}
      events={events}
    />
  )
}
