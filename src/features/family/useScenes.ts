import { useMemo } from 'react'
import { useWorldChapters, useWorldEvents } from '@/db/hooks/useTimeline'

/** The book's scenes in reading order, each named *Ch. N — title*: for a link's starting scene. */
export function useScenes(bookId: string) {
  const events = useWorldEvents(bookId)
  const chapters = useWorldChapters(bookId)
  return useMemo(() => {
    const chapterById = new Map(chapters.map((c) => [c.id, c]))
    const number = (chapterId: string) => chapterById.get(chapterId)?.number ?? 0
    return {
      events: [...events].sort((a, b) => number(a.chapterId) - number(b.chapterId) || a.sortOrder - b.sortOrder),
      label: (ev: { chapterId: string; title: string }) => `Ch. ${chapterById.get(ev.chapterId)?.number ?? '?'} — ${ev.title || 'untitled'}`,
    }
  }, [events, chapters])
}
