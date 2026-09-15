/**
 * Which of three things the Read screen is showing.
 *
 * *The Count of Monte Cristo* takes about 1.6 seconds to come out of IndexedDB,
 * and for that second and a half the screen had an empty page on it. Telling a
 * reader their book has no text at the one moment it is longest is the fault
 * this exists to prevent.
 *
 * The subtlety is the third state. `compiled` answers "has the manuscript been
 * built", which is false while the prose is still arriving; `worldHasProse`
 * asks the database, and is **undefined until it answers** — a live query that
 * re-subscribes returns undefined again, mid-flight, after having said true.
 *
 * So the empty state is keyed on knowing rather than on not-knowing: it needs a
 * definite `false`. An earlier version required `worldHasProse === true` to
 * show the loading state, which meant every undefined fell through to "No prose
 * yet". `readingOpening.spec.ts` recorded `waiting -> no-prose-yet -> prose` on
 * Monte Cristo — but only sometimes, which is why the decision is a function
 * with a test rather than an expression with a comment. The same branch was
 * once measured at one worker, found to commit in a single pass, and written
 * off as unreachable.
 */
export type OpeningState =
  /** The prose is on its way. Draw the shape it is about to fill. */
  | 'opening'
  /** There is no prose, and we know it. */
  | 'empty'
  /** The book is here. */
  | 'book'

export function openingState(args: {
  /** Whether the manuscript has been compiled — `writtenScenes > 0`. */
  compiled: boolean
  /** Whether the world holds prose: `undefined` until the query answers. */
  worldHasProse: boolean | undefined
}): OpeningState {
  if (args.compiled) return 'book'
  return args.worldHasProse === false ? 'empty' : 'opening'
}
