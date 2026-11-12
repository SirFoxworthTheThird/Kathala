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
  /**
   * The book as an editor's file sent it back, every change in it taken, by
   * the file's name (round-trip-plan-2.md, T5.1, D-4): only the scenes the file
   * had. The writer's revision goes back to the editor marked against it, so
   * an edit she took shows as nothing and one she declined as her turning it
   * back.
   */
  sentBack?: string
  /** Whose changes the file held, for their threads to go back with the marked book (D-5). */
  editors?: string[]
  /** What that file's title page says of the book's length, where it has one: the marked book's count is a change against it (T8.4). */
  titleCount?: string
}
