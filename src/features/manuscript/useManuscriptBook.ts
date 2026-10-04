import { useMemo } from 'react'
import { useAllWorldEvents, useChapters, useTimelineEvents, useWorldChapters } from '@/db/hooks/useTimeline'
import { ALL_TIMELINES } from '@/lib/readersBook'
import { useSceneTextsByEvent } from '@/db/hooks/useManuscript'
import { buildManuscript } from '@/lib/manuscriptCompile'
import { splitParagraphs as paragraphs } from '@/lib/manuscriptParagraphs'
import { emphasisSpans, type ProseSpan } from '@/lib/proseEmphasis'

/**
 * A book's chapters and scenes: one timeline's, or — given `ALL_TIMELINES` —
 * every timeline's, chapters in number order: the reader's book, which is one
 * book however many timelines it has (see `readersBook.ts`).
 *
 * Ungated, like `useTimelineEvents`: what is shown of it is the caller's to stop.
 */
export function useBookScope(worldId: string | null, timelineId: string | null) {
  const whole = timelineId === ALL_TIMELINES
  const oneChapters = useChapters(whole ? null : timelineId)
  const oneEvents = useTimelineEvents(whole ? null : timelineId)
  const allChapters = useWorldChapters(whole ? worldId : null)
  const allEvents = useAllWorldEvents(whole ? worldId : null)
  const chapters = useMemo(
    () => (whole ? [...allChapters].sort((a, b) => a.number - b.number) : oneChapters),
    [whole, allChapters, oneChapters],
  )
  return { chapters, events: whole ? allEvents : oneEvents }
}

/**
 * One timeline's book — or every timeline's, as `useBookScope` — compiled for reading: the manuscript, its prose already
 * split into paragraphs, and the lookups the reading page needs — for the
 * Timeline's Read layout, and for export on Page and Read.
 */
export function useManuscriptBook(worldId: string | null, timelineId: string | null) {
  const { chapters, events } = useBookScope(worldId, timelineId)
  const sceneByEvent = useSceneTextsByEvent(worldId)

  const manuscript = useMemo(
    () => buildManuscript({ chapters, events, sceneTextByEvent: sceneByEvent }),
    [chapters, events, sceneByEvent]
  )

  /*
    The book's paragraphs, already split and with their emphasis read.

    Gutenberg writes italics as `_like this_` and every book in the Library
    does, so this runs over the whole text. On *The Count of Monte Cristo* —
    2,613,043 characters, 14,416 paragraphs — the split alone is 2.7ms and the
    split with emphasis is 43.1ms, measured over three passes. That is once per
    load either way; what this memo buys is that a reader pressing **Larger
    text** does not pay it again, since `manuscript` does not change when the
    type does.
  */
  const proseByScene = useMemo(() => {
    const out = new Map<string, ProseSpan[][]>()
    for (const ch of manuscript.chapters) {
      for (const s of ch.scenes) {
        if (s.written) out.set(s.eventId, paragraphs(s.text).map(emphasisSpans))
      }
    }
    return out
  }, [manuscript])

  const chapterNumberById = useMemo(() => new Map(chapters.map((c) => [c.id, c.number])), [chapters])
  const eventById = useMemo(
    () => new Map(events.map((e) => [e.id, { chapterId: e.chapterId, sortOrder: e.sortOrder }])),
    [events],
  )
  return { chapters, events, manuscript, proseByScene, eventById, chapterNumberById }
}

export type ManuscriptBookData = ReturnType<typeof useManuscriptBook>
