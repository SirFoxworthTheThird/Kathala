/**
 * A named draft of the book, as saved (editorial-plan.md, R3): the book's
 * prose and structure (`DraftBook`, `src/lib/bookDraft.ts`), gzipped JSON.
 * Kept on this device, like the journal: a backup carries drafts only when
 * asked to.
 */
export interface BookDraftRecord {
  id: string
  worldId: string
  name: string
  createdAt: number
  /** The book's size when it was saved, for the list: read without opening the draft. */
  words: number
  scenes: number
  /** `DraftBook` as gzipped JSON. */
  data: Uint8Array
  /**
   * The Word file for an editor made from it, by its name (round-trip-plan.md,
   * T2.3): edits made in that file with tracking off are found against this
   * draft when it comes back, so deleting it is asked about.
   */
  sentAs?: string
}
