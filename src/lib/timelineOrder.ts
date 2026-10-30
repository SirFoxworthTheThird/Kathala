import type { Timeline } from '@/types'

type Ordered = Pick<Timeline, 'id' | 'createdAt' | 'position'>

/**
 * The order of a world's timelines: where the writer put them, then — for a
 * record with no position, from an older file — by creation. The one order
 * every list of timelines uses, so the tabs, the binder, the merged book and
 * the export never disagree about which comes first.
 */
export function compareTimelines(a: Ordered, b: Ordered): number {
  const pa = a.position ?? Number.POSITIVE_INFINITY
  const pb = b.position ?? Number.POSITIVE_INFINITY
  if (pa !== pb) return pa < pb ? -1 : 1
  return a.createdAt - b.createdAt || a.id.localeCompare(b.id)
}

export function inTimelineOrder<T extends Ordered>(timelines: readonly T[]): T[] {
  return [...timelines].sort(compareTimelines)
}

/** The ids in the order they take after moving `id` to index `to` (clamped). */
export function movedOrder<T extends Ordered>(timelines: readonly T[], id: string, to: number): string[] {
  const ids = inTimelineOrder(timelines).map((t) => t.id)
  const from = ids.indexOf(id)
  if (from < 0) return ids
  ids.splice(from, 1)
  ids.splice(Math.max(0, Math.min(to, ids.length)), 0, id)
  return ids
}

type BookChapter = { id: string; number: number; timelineId: string }

/**
 * The book's chapters in reading order: by number, and where two timelines
 * share a number, in the timelines' order — the order the Page and Read lay
 * them out on *All timelines*.
 */
export function inBookChapterOrder<C extends BookChapter>(chapters: readonly C[], timelines: readonly Ordered[]): C[] {
  const rank = new Map(inTimelineOrder(timelines).map((t, i) => [t.id, i]))
  const of = (id: string) => rank.get(id) ?? rank.size
  return [...chapters].sort((a, b) => a.number - b.number || of(a.timelineId) - of(b.timelineId) || a.id.localeCompare(b.id))
}
