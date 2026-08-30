/**
 * Splitting the world selector into the two things it actually holds.
 *
 * A book pulled from the library and a draft being written share a card but
 * little else. They are created at unrelated times, so a single list ordered by
 * creation date interleaves them arbitrarily — and since the library ships ten
 * worlds against a writer's one or two, the writer's own work ends up buried in
 * other people's books.
 *
 * `readingMode` is the signal, because it is the one that already exists and it
 * is what the reader set. A downloaded book whose reading mode is turned off
 * has become something the writer edits, and moves shelf accordingly; that is
 * the honest reading of the flag rather than a special case around it.
 */

export interface ShelvedWorld {
  readingMode?: boolean
}

export interface Shelves<T> {
  /** Worlds being written. Leads, because this is a writing tool. */
  drafts: T[]
  /** Worlds being read. */
  reading: T[]
}

export function partitionWorlds<T extends ShelvedWorld>(worlds: readonly T[]): Shelves<T> {
  const drafts: T[] = []
  const reading: T[] = []
  for (const world of worlds) {
    // Relative order within each shelf is whatever the caller supplied, so the
    // existing sort keeps meaning what it meant.
    ;(world.readingMode ? reading : drafts).push(world)
  }
  return { drafts, reading }
}

/**
 * Which shelf leads.
 *
 * Drafts lead by default, and the reason is in this file's own header: this is
 * a writing tool. But a reader coming back the next evening on a 390px phone
 * met the whole of the author's chrome first — the strapline, five ways to
 * start a world, then any demo worlds — and their book began **916px down an
 * 844px viewport**. They scrolled past everything they were not doing to reach
 * the one thing they were.
 *
 * The screen cannot know which person opened it, but it can know something
 * nearly as good: whether a book on the reading shelf has somebody's place kept
 * in it. `eventByWorld` holds that, it is per world, and it survives a cold
 * start — so a reader who is part-way through a book gets their shelf first,
 * and everyone who has not started one keeps the writing tool they opened.
 *
 * A reading world with no position is not a book in progress: it is one that
 * was downloaded and never opened, or one whose reader asked to see the whole
 * book, which is not a place. Neither should demote a novelist's own drafts.
 */
export function readingLeads(
  reading: readonly { id: string }[],
  positionByWorld: Readonly<Record<string, string | null>>,
): boolean {
  return reading.some((w) => !!positionByWorld[w.id])
}
