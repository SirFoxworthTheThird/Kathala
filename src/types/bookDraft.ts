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
}
