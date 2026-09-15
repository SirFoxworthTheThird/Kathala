/**
 * The exact place in the book a reader was, so they come back to it.
 *
 * `readingPosition.ts` beside this answers a different question: `cursorForScene`
 * maintains the *cursor*, the scene you have read to, which is what should
 * reopen a book you put down last week. This is the trip a reader makes
 * constantly — tapping a name in the scene panel, reading who they are, coming
 * back — and the cursor is the wrong answer for it twice over. It is a
 * high-water mark, so someone who had scrolled back to chapter two returned to
 * chapter forty; and it names a scene rather than a place inside one, so a long
 * scene restarted from its first line.
 *
 * A spot is a scene and a distance into it, never a raw `scrollTop`. The whole
 * book is in the DOM at once and its height depends on the reader's type size,
 * so a stored pixel offset from the top of the book means something different
 * after they press **Larger text**. Anchoring to the scene absorbs that; only
 * the distance within one scene is approximate, and it is clamped to that scene.
 */

/** A place in the book: a scene, and how far into it. */
export interface SpotAt {
  eventId: string
  offset: number
}

export interface ReadingSpot extends SpotAt {
  /**
   * Where the cursor stood when this was taken.
   *
   * The cursor moving while the reader is away means they moved it on purpose —
   * **Read to here** on a distant chapter, the steppers in the top bar — and
   * that beats a spot from before. Comparing positions cannot tell the two
   * apart: a reader who scrolled back to chapter two leaves a spot behind a
   * cursor at chapter forty, and so does one who has just jumped to chapter
   * ninety. What separates them is whether the cursor changed since.
   *
   * Stamped when the reader leaves, never while they scroll. The cursor follows
   * the page by an observer that fires *after* the scroll, so a stamp taken
   * alongside `scrollTop` is one scene stale — and then every ordinary scroll
   * looked like a deliberate jump and threw the spot away.
   */
  cursorAt: string | null
}

export interface SceneExtent {
  id: string
  top: number
  height: number
}

/** Where the reader is, from the scroller's position and the measured scenes. */
export function spotFor(scrollTop: number, scenes: readonly SceneExtent[]): SpotAt | null {
  let current: SceneExtent | undefined
  for (const scene of scenes) {
    if (scene.top <= scrollTop) current = scene
    else break
  }
  current = current ?? scenes[0]
  if (!current) return null
  return { eventId: current.id, offset: Math.max(0, scrollTop - current.top) }
}

/**
 * Whether the saved spot still describes where the reader wants to be.
 *
 * False when the cursor has moved since — they said where they are by another
 * route, and that is a deliberate answer to the same question.
 */
export function spotStillApplies(spot: ReadingSpot | null, cursor: string | null): boolean {
  return spot !== null && spot.cursorAt === cursor
}

/** Where to scroll to put them back, or null if that scene is gone. */
export function scrollFor(spot: SpotAt | null, scenes: readonly SceneExtent[]): number | null {
  if (!spot) return null
  const scene = scenes.find((s) => s.id === spot.eventId)
  if (!scene) return null
  /*
    Clamped to the scene it belongs to. An offset measured at 26px type is too
    far into a scene set at 15px, and without this a reader who changed the type
    between visits would land in the *next* scene — past prose they had not
    read, which is the one direction this must not fail in.
  */
  const offset = Math.min(Math.max(0, spot.offset), Math.max(0, scene.height))
  return scene.top + offset
}

/** Parse a stored spot, tolerating anything that is not one. */
export function readSpot(raw: string | null): ReadingSpot | null {
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return null
    const { eventId, offset } = parsed as Partial<ReadingSpot>
    if (typeof eventId !== 'string' || !eventId) return null
    if (typeof offset !== 'number' || !Number.isFinite(offset)) return null
    const { cursorAt } = parsed as Partial<ReadingSpot>
    if (cursorAt !== null && typeof cursorAt !== 'string') return null
    return { eventId, offset, cursorAt }
  } catch {
    return null
  }
}
