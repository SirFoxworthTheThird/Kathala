import type { WorldEvent, Chapter } from '@/types'
import type { BeatTemplate, StoryBeat } from '@/lib/storyBeats'

/**
 * Maps a world's events onto a chosen structure template's beats, so a writer
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
}

export interface BeatSheet {
  template: BeatTemplate
  slots: BeatSlot[]
  filled: number
  total: number
}

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
    return {
      beat,
      event,
      chapterNumber: event ? chapterNumberById.get(event.chapterId) ?? null : null,
      outOfOrder,
    }
  })

  return { template, slots, filled, total: template.beats.length }
}
