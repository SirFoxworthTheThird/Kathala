/**
 * Which moment of the frame story is in force at a point in the inner one
 * (MT-6).
 *
 * Sync points used to be read in exactly one place — the playback timer — and
 * only when it advanced onto a paired event. So a writer who paired nine
 * moments and then scrubbed between them by hand saw no effect at all: the
 * pairing worked, but only if you pressed play and waited for it.
 *
 * The finding also called this "one way only". That half is the design rather
 * than a fault: the outer cursor exists to draw the frame's cast as **ghost
 * pins** on the map beside the inner story's, which is a thing you want while
 * you are *in* the tale. It has no consumer in the other direction, so a
 * symmetrical sync would set a value nothing reads.
 */
export interface SyncPair {
  innerEventId: string
  outerEventId: string
}

/**
 * The outer event in force at `activeInnerEventId`: the pairing at that moment,
 * or the most recent one before it.
 *
 * Holding the last pairing rather than matching exactly is what a frame
 * narrative means — the teller is at that point in the telling until the story
 * reaches the next moment that moves them. Exact matching would have shown the
 * frame's cast on one scene and dropped them on the next, which is a flicker
 * rather than a frame.
 *
 * Null before the first pairing, so scrubbing back to the start of the tale
 * clears the ghosts rather than leaving them stranded at a moment the reader
 * has moved away from.
 */
export function outerEventAt(
  orderedInnerEventIds: readonly string[],
  syncPoints: readonly SyncPair[],
  activeInnerEventId: string | null,
): string | null {
  if (!activeInnerEventId) return null
  const at = orderedInnerEventIds.indexOf(activeInnerEventId)
  if (at === -1) return null

  const pairedOuter = new Map(syncPoints.map((s) => [s.innerEventId, s.outerEventId]))
  let inForce: string | null = null
  for (let i = 0; i <= at; i++) {
    const outer = pairedOuter.get(orderedInnerEventIds[i])
    if (outer) inForce = outer
  }
  return inForce
}
