import type { WorldEvent, Chapter } from '@/types'
import type { BeatTemplate, StoryBeat } from '@/lib/storyBeats'

/**
 * Maps a world's scenes onto a chosen structure template's beats, so a writer
 * can see which beats are filled, which are missing, and whether the filled ones
 * fall in narrative order. Pure — nothing stored.
 */

export interface BeatSlot {
  beat: StoryBeat
  /** The event tagged with this beat (earliest, if several), or null when missing. */
  event: WorldEvent | null
  chapterNumber: number | null
  /** Filled, but its event comes earlier than a preceding filled beat's event. */
  outOfOrder: boolean
  /**
   * Where the beat sits along the book, 0–1, measured in chapters rather than
   * in list position — so two beats that both landed in the last chapter get
   * the same fraction instead of looking evenly spread.
   */
  narrativeFraction: number | null
}

/** One act's extent, in chapters, read off the beats actually placed. */
export interface ActSpan {
  act: 1 | 2 | 3
  /** Null when the act has no chapters of its own (the next act starts in the same one). */
  startChapter: number | null
  endChapter: number | null
  chapterCount: number
  /** Share of the book's chapters, 0–1. */
  share: number
}

export interface StructureProportion {
  chapterCount: number
  /** Null until the acts can be measured; `reason` says what is in the way. */
  spans: ActSpan[] | null
  reason: 'ok' | 'no-chapters' | 'unplaced' | 'out-of-order'
}

export interface BeatSheet {
  template: BeatTemplate
  slots: BeatSlot[]
  filled: number
  total: number
  proportion: StructureProportion
}

/**
 * The shape a three-act story conventionally takes: a quarter of its length in
 * Act 1, half in Act 2, a quarter in Act 3. Save the Cat and the Hero's Journey
 * both land near it too. Drawn as a reference on the board — it is a convention,
 * not a rule, so nothing warns when a book departs from it.
 */
export const CONVENTIONAL_ACT_SHARE: readonly [number, number, number] = [0.25, 0.5, 0.25]

/** Narrative position of an event: chapter number, then sort order within it. */
function narrativePos(ev: WorldEvent, chapterNumberById: Map<string, number>): number {
  return (chapterNumberById.get(ev.chapterId) ?? 0) * 1_000_000 + ev.sortOrder
}

export function buildBeatSheet({
  template, events, chapters,
}: {
  template: BeatTemplate
  events: WorldEvent[]
  chapters: Chapter[]
}): BeatSheet {
  const chapterNumberById = new Map(chapters.map((c) => [c.id, c.number]))

  // For each beat id, the earliest-in-narrative event carrying it.
  const eventByBeat = new Map<string, WorldEvent>()
  for (const ev of events) {
    const id = ev.structureBeat
    if (!id) continue
    const existing = eventByBeat.get(id)
    if (!existing || narrativePos(ev, chapterNumberById) < narrativePos(existing, chapterNumberById)) {
      eventByBeat.set(id, ev)
    }
  }

  // Chapter numbers can be sparse (1, 2, 5…), so measure position by rank in the
  // sorted list rather than by the number itself.
  const orderedNumbers = [...new Set(chapters.map((c) => c.number))].sort((a, b) => a - b)
  const rankByNumber = new Map(orderedNumbers.map((n, i) => [n, i] as const))
  const chapterCount = orderedNumbers.length

  let filled = 0
  let maxPosSoFar = -Infinity
  const slots: BeatSlot[] = template.beats.map((beat) => {
    const event = eventByBeat.get(beat.id) ?? null
    let outOfOrder = false
    if (event) {
      filled++
      const pos = narrativePos(event, chapterNumberById)
      if (pos < maxPosSoFar) outOfOrder = true
      else maxPosSoFar = pos
    }
    const chapterNumber = event ? chapterNumberById.get(event.chapterId) ?? null : null
    const rank = chapterNumber === null ? undefined : rankByNumber.get(chapterNumber)
    return {
      beat,
      event,
      chapterNumber,
      outOfOrder,
      // Centre of the chapter's slice, so the first and last chapters sit inside
      // the track rather than on its edges.
      narrativeFraction: rank === undefined || chapterCount === 0 ? null : (rank + 0.5) / chapterCount,
    }
  })

  return {
    template,
    slots,
    filled,
    total: template.beats.length,
    proportion: measureActs(slots, rankByNumber, chapterCount),
  }
}

/**
 * Divides the book's chapters between the three acts. An act's start is the
 * chapter of the first beat placed in it, so the division is read off the
 * writer's own tagging — nothing is assumed about where Act 2 ought to begin.
 */
function measureActs(
  slots: BeatSlot[],
  rankByNumber: Map<number, number>,
  chapterCount: number,
): StructureProportion {
  if (chapterCount === 0) return { chapterCount, spans: null, reason: 'no-chapters' }

  // Rank of the first placed beat belonging to each act.
  const startRank = new Map<number, number>()
  for (const slot of slots) {
    if (slot.chapterNumber === null) continue
    const rank = rankByNumber.get(slot.chapterNumber)
    if (rank === undefined) continue
    const existing = startRank.get(slot.beat.act)
    if (existing === undefined || rank < existing) startRank.set(slot.beat.act, rank)
  }

  const start2 = startRank.get(2)
  const start3 = startRank.get(3)
  if (start2 === undefined || start3 === undefined) {
    return { chapterCount, spans: null, reason: 'unplaced' }
  }
  // Act 3 opening before Act 2 leaves no coherent division to draw. The board
  // already flags the offending beat as out of order.
  if (start3 < start2) return { chapterCount, spans: null, reason: 'out-of-order' }

  const bounds: [1 | 2 | 3, number, number][] = [
    [1, 0, start2 - 1],
    [2, start2, start3 - 1],
    [3, start3, chapterCount - 1],
  ]
  const ranks = [...rankByNumber.entries()].sort((a, b) => a[1] - b[1]).map(([number]) => number)

  const spans: ActSpan[] = bounds.map(([act, from, to]) => {
    const count = Math.max(0, to - from + 1)
    return {
      act,
      startChapter: count === 0 ? null : ranks[from],
      endChapter: count === 0 ? null : ranks[to],
      chapterCount: count,
      share: count / chapterCount,
    }
  })

  return { chapterCount, spans, reason: 'ok' }
}
