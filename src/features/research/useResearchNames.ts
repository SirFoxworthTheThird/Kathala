import { useMemo } from 'react'
import { useCharacters } from '@/db/hooks/useCharacters'
import { useItems } from '@/db/hooks/useItems'
import { useAllLocationMarkers } from '@/db/hooks/useLocationMarkers'
import { useWorldChapters, useWorldEvents } from '@/db/hooks/useTimeline'
import type { ResearchLink, ResearchTarget } from '@/types'

export interface ResearchTargetOption extends ResearchLink {
  label: string
}

/**
 * What research can be attached to in a book, each named as a writer reads it:
 * scenes by chapter and title, then places, characters and items. A scene of
 * another book of the series is not here, so its attachment is not shown here
 * (research-plan.md, D-4).
 */
export function useResearchTargets(bookId: string | null | undefined) {
  const events = useWorldEvents(bookId ?? null)
  const chapters = useWorldChapters(bookId ?? null)
  const characters = useCharacters(bookId ?? null)
  const items = useItems(bookId ?? null)
  const places = useAllLocationMarkers(bookId ?? null)
  return useMemo(() => {
    const number = new Map(chapters.map((c) => [c.id, c.number]))
    const scenes = [...events]
      .sort((a, b) => (number.get(a.chapterId) ?? 0) - (number.get(b.chapterId) ?? 0) || a.sortOrder - b.sortOrder)
      .map((e) => ({ kind: 'scene' as const, id: e.id, label: `Ch. ${number.get(e.chapterId) ?? '?'} — ${e.title || 'untitled'}` }))
    const named = <K extends ResearchTarget>(kind: K, rows: ReadonlyArray<{ id: string; name: string }>) =>
      [...rows].sort((a, b) => a.name.localeCompare(b.name)).map((r) => ({ kind, id: r.id, label: r.name }))
    const all: ResearchTargetOption[] = [...scenes, ...named('place', places), ...named('character', characters), ...named('item', items)]
    const byKey = new Map(all.map((o) => [`${o.kind}:${o.id}`, o.label]))
    return {
      all,
      /** A target's name here, or undefined where this book has no such record. */
      label: (l: ResearchLink) => byKey.get(`${l.kind}:${l.id}`),
    }
  }, [events, chapters, characters, items, places])
}

export const TARGET_WORDS: Record<ResearchTarget, string> = {
  scene: 'Scene',
  place: 'Place',
  character: 'Character',
  item: 'Item',
}
