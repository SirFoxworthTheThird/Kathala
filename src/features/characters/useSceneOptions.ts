import { useWorldEvents, useWorldChapters } from '@/db/hooks/useTimeline'

/**
 * The world's scenes in reading order, and a label for each — for a scene
 * picker: a goal's span on the Goals tab, a name change on the Overview.
 */
export function useSceneOptions(worldId: string) {
  const events = useWorldEvents(worldId)
  const chapters = useWorldChapters(worldId)
  const chapterById = new Map(chapters.map((c) => [c.id, c]))
  const ordered = [...events].sort((a, b) => {
    const ca = chapterById.get(a.chapterId)?.number ?? 0
    const cb = chapterById.get(b.chapterId)?.number ?? 0
    return ca !== cb ? ca - cb : a.sortOrder - b.sortOrder
  })
  return {
    events: ordered,
    chapters,
    label: (ev: { id: string; chapterId: string; title: string }) =>
      `Ch. ${chapterById.get(ev.chapterId)?.number ?? '?'} — ${ev.title || 'untitled'}`,
  }
}

export type SceneOptions = ReturnType<typeof useSceneOptions>
