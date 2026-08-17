/** The moments either side of the cursor, in reading order. */
export interface Neighbours<T> {
  prev: T | null
  next: T | null
}

/**
 * What "previous moment" and "next moment" mean at a given cursor.
 *
 * Written for the Writer's Brief (**WRUN-12**), which is a reference panel about
 * a moment and had no way to change that moment: its scene rows were inert
 * `<li>`s, and its whole-world picker showed only while there was *no* cursor.
 * So reading it across a chapter boundary meant closing it, stepping, and
 * opening it again — 17 interactions to read six scenes where 6 would do.
 *
 * Two edges, both deliberate:
 *
 * - With **no cursor** the reader is on "all chapters". Stepping forward from
 *   there lands on the first moment of the book, which is what the top bar's
 *   own control does; stepping back has nowhere to go.
 * - A cursor pointing at a moment that no longer exists — a scene deleted from
 *   another screen while the panel is open — has no neighbours rather than
 *   silently jumping to the start.
 *
 * `ordered` is expected in reading order, as `eventsInReadingOrder` returns.
 */
export function neighbouringMoments<T extends { id: string }>(
  ordered: readonly T[],
  activeEventId: string | null,
): Neighbours<T> {
  if (ordered.length === 0) return { prev: null, next: null }
  if (!activeEventId) return { prev: null, next: ordered[0] }

  const i = ordered.findIndex((e) => e.id === activeEventId)
  if (i === -1) return { prev: null, next: null }
  return {
    prev: i > 0 ? ordered[i - 1] : null,
    next: i < ordered.length - 1 ? ordered[i + 1] : null,
  }
}
