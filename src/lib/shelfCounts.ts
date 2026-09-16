/**
 * What a world card on the shelf may say about what is inside it.
 *
 * A blind reader run found the card for *The Count of Monte Cristo* saying
 * "41 characters" while the reading progress line directly beneath it said
 * "Chapter 7 of 117" — at which point the reader had met ten. The cast size of
 * a book is exactly the kind of thing reading mode exists to withhold: a roster
 * that names fifty people tells you the story has fifty people in it, and a
 * count does the same job in fewer pixels.
 *
 * The chapter count stays. A book's length is on its spine, and the progress
 * line is already quoting it.
 *
 * This is a decision rather than a filter because the shelf cannot afford the
 * gate. `useWorldSummary` counts on an indexed `worldId` without materialising
 * rows, so twenty worlds cost forty index counts; computing each world's reveal
 * point means loading its events and snapshots, which is the full table read
 * that hook was written to avoid.
 */
export interface ShelfCounts {
  /** Chapters to show, or null to leave the count off. */
  chapters: number | null
  /** Cast size to show, or null to leave the count off. */
  characters: number | null
}

export function shelfCounts(
  { readingMode, chapters, characters }: { readingMode: boolean; chapters: number; characters: number },
): ShelfCounts {
  return {
    chapters: chapters > 0 ? chapters : null,
    characters: readingMode || characters === 0 ? null : characters,
  }
}

/** Whether a card has any count worth drawing a row for. */
export function hasShelfCounts(counts: ShelfCounts): boolean {
  return counts.chapters !== null || counts.characters !== null
}
