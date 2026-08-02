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
