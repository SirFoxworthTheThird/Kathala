import type { WorldEvent, Chapter } from '@/types'

/**
 * Generic "cadence" analysis: given a set of taggable entities (plot threads,
 * motifs, …) and the events tagged with them, derive where each entity recurs
 * across the chapters and where it goes quiet. Pure — nothing stored. Both the
 * plot-thread and motif trackers build on this.
 */

export interface TagCadenceRow<T> {
  entity: T
  /** Events tagged with this entity. */
  eventCount: number
  /** Present-in-chapter flags, one per chapter in narrative order. */
  presenceByChapter: boolean[]
  firstChapterNumber: number | null
  lastChapterNumber: number | null
  /** Chapters between the entity's last beat and the end of the story. */
  trailingGap: number
  /** Longest interior run of chapters with no beat (an entity that goes quiet). */
  longestDormancy: number
  /** That run's first and last chapters, by number; null where there is none. "Ch. 4–27" said the span, not the silence (UX-2-17). */
  quietFrom?: number | null
  quietTo?: number | null
  /**
   * The last scene this entity was tagged on, in narrative order.
   *
   * For a subplot that is the beat a writer marking it *resolved* would almost
   * always pick, so the offer can name the scene rather than asking for one.
   */
  lastEventId: string | null
}

export interface TagCadenceResult<T> {
  rows: TagCadenceRow<T>[]
  chapterCount: number
}

export function computeTagCadence<T extends { id: string; name: string }>({
  entities, events, chapters, tagIdsOf,
}: {
  entities: T[]
  events: WorldEvent[]
  chapters: Chapter[]
  /** Which entity ids a given event is tagged with. */
  tagIdsOf: (event: WorldEvent) => string[]
}): TagCadenceResult<T> {
  const sortedChapters = [...chapters].sort((a, b) => a.number - b.number)
  const eventsByChapter = new Map<string, WorldEvent[]>()
  for (const e of events) {
    const arr = eventsByChapter.get(e.chapterId)
    if (arr) arr.push(e)
    else eventsByChapter.set(e.chapterId, [e])
  }

  const rows: TagCadenceRow<T>[] = entities.map((entity) => {
    const eventCount = events.reduce((n, e) => n + (tagIdsOf(e).includes(entity.id) ? 1 : 0), 0)

    const presenceByChapter = sortedChapters.map((ch) =>
      (eventsByChapter.get(ch.id) ?? []).some((e) => tagIdsOf(e).includes(entity.id))
    )
    const firstIdx = presenceByChapter.indexOf(true)
    const lastIdx = presenceByChapter.lastIndexOf(true)

    // Within the last chapter that carries it, the last scene by sort order.
    const lastEventId = lastIdx >= 0
      ? [...(eventsByChapter.get(sortedChapters[lastIdx].id) ?? [])]
          .filter((e) => tagIdsOf(e).includes(entity.id))
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .at(-1)?.id ?? null
      : null

    let longestDormancy = 0
    let quietEnd = -1
    if (firstIdx !== -1) {
      let run = 0
      for (let i = firstIdx + 1; i < lastIdx; i++) {
        if (!presenceByChapter[i]) {
          run++
          // The first longest run: the earliest place the reader goes without it.
          if (run > longestDormancy) { longestDormancy = run; quietEnd = i }
        } else run = 0
      }
    }

    return {
      entity,
      eventCount,
      presenceByChapter,
      firstChapterNumber: firstIdx >= 0 ? sortedChapters[firstIdx].number : null,
      lastChapterNumber: lastIdx >= 0 ? sortedChapters[lastIdx].number : null,
      trailingGap: lastIdx === -1 ? sortedChapters.length : sortedChapters.length - 1 - lastIdx,
      longestDormancy,
      quietFrom: quietEnd >= 0 ? sortedChapters[quietEnd - longestDormancy + 1].number : null,
      quietTo: quietEnd >= 0 ? sortedChapters[quietEnd].number : null,
      lastEventId,
    }
  })

  // Narrative order: by first appearance; entities never advanced sort last.
  rows.sort((a, b) => {
    const fa = a.firstChapterNumber ?? Infinity
    const fb = b.firstChapterNumber ?? Infinity
    return fa - fb || a.entity.name.localeCompare(b.entity.name)
  })

  return { rows, chapterCount: sortedChapters.length }
}
