/**
 * Which moment opening a chapter should put you in.
 *
 * The whole app answers "what is true at this exact moment?", and the moment is
 * the time cursor. Opening a chapter to draft it used to leave the cursor on
 * *All chapters*, so every per-moment tool stayed dark: the Writer's Brief
 * opened empty, still asking for an event, while the chapter was on screen. The
 * writer had to go and find the bottom bar and set by hand the thing they had
 * just navigated to.
 *
 * Pure, so the rule can be stated once and tested without a router or a store.
 */

export interface CursorCandidate {
  id: string
  sortOrder: number
}

/**
 * The event to move the cursor to, or null to leave it where it is.
 *
 * Leaving it alone matters as much as moving it: a writer who has set the
 * cursor to a particular scene and then opened that scene's chapter has already
 * said where they want to be, and yanking them to the top of the chapter would
 * undo it.
 */
export function cursorForChapter(
  events: readonly CursorCandidate[],
  currentEventId: string | null,
): string | null {
  if (events.length === 0) return null
  if (currentEventId !== null && events.some((e) => e.id === currentEventId)) return null

  // The chapter's opening moment: first by sortOrder, ties broken by id so the
  // answer does not depend on the order the query happened to return.
  return [...events].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id))[0].id
}
