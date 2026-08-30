/**
 * How many plot-thread pills the timeline's filter strip shows before it stops
 * growing (TL-5).
 *
 * The strip wrapped without limit: nine threads already took two rows and a
 * band of vertical space above the chapters, and it grew with every thread the
 * writer added — so the screen got worse the more of it you used.
 */
export const THREAD_STRIP_LIMIT = 6

export interface ThreadStrip<T> {
  shown: T[]
  /** How many are folded away; 0 when everything is on screen. */
  hidden: number
}

/**
 * Which pills to draw. The selected thread is always among them, even when it
 * sits in the folded tail — a strip that filtered by something it did not show
 * would be worse than a long one. That makes the row at most one pill longer
 * than the limit, which is still bounded.
 */
export function threadStrip<T extends { id: string }>(
  threads: readonly T[],
  selectedId: string | null,
  expanded: boolean,
  limit: number = THREAD_STRIP_LIMIT,
): ThreadStrip<T> {
  if (expanded || threads.length <= limit) {
    return { shown: [...threads], hidden: 0 }
  }
  const shown = threads.filter((t, i) => i < limit || t.id === selectedId)
  return { shown, hidden: threads.length - shown.length }
}
