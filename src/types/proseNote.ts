import type { NoteAnchor } from '@/lib/noteAnchor'

/*
  A note on the prose (editorial-plan.md, R1): a query, a cut, a fact to check,
  praise, or anything else said about a passage — by the writer, an editor, a
  beta reader, or one of the app's own checks. Pinned to its words, not to a
  position (`noteAnchor.ts`), so it follows them through edits; a note whose
  words have been rewritten is kept, unplaced, with the quote it was made on.

  Resolving a note keeps it: resolved notes are the record of the review.
*/

export type NoteKind = 'note' | 'query' | 'cut' | 'check' | 'praise'

/** How a beta reader felt about a passage (editorial-plan.md, R7). */
export type Reaction = 'lost' | 'slow' | 'loved' | 'unconvinced' | 'where'

export type NoteAuthorKind = 'me' | 'editor' | 'reader' | 'check'

export interface NoteAuthor {
  kind: NoteAuthorKind
  /** Who: an editor's or a reader's name. The writer's own notes have none. */
  name?: string
}

export interface NoteReply {
  id: string
  author: NoteAuthor
  body: string
  createdAt: number
  /**
   * The edited file that brought it in, by the id that bringing it in gave its
   * changes (`EditSuggestion.importId`). So the replies from one file can be
   * shown together, each marked (round-trip-plan-3.md, T9.5): six of the
   * second loop's seven sat in threads the editor had resolved, which Notes
   * hides, and nothing said they had come.
   */
  broughtIn?: string
}

export interface ProseNote extends NoteAnchor {
  id: string
  worldId: string
  kind: NoteKind
  author: NoteAuthor
  body: string
  status: 'open' | 'resolved'
  replies: NoteReply[]
  createdAt: number
  updatedAt: number
  resolvedAt?: number
  /** The edited file that resolved it, where one did (T9.5); none once it is reopened or resolved by hand. */
  resolvedIn?: string
  /** A beta reader's reaction, where the note is one (R7). */
  reaction?: Reaction
  /**
   * The words it was made on, where it has since been moved onto them as
   * they now read (round-trip-plan.md, T6). Set once, the first time it
   * moves. An editor's "Three? We only ever meet two" came to quote the
   * writer's fix, "the two tallyclerks", once answered (writer run
   * 2026-11-09, R2-D): what was asked about was lost from the record.
   */
  madeOn?: string
  /**
   * Where it is on a line outside every scene: the book's title page, or a
   * chapter's heading. An editor comments on those too, and the comment was
   * listed in Changes to read and dismiss, with no way to answer it and no way
   * back to the editor (round-trip-plan-3.md, T9.4, D-9; the second loop's
   * editor sent 39 comments and got 38 back). `quote` is the line as the file
   * had it. `eventId` is the first scene after it there: for a heading, a scene
   * of its chapter, which says which chapter; for the title page, the book's
   * first. It is never placed on the prose, whatever the prose says.
   */
  outside?: 'title page' | 'heading'
  /** Journal version; read as `?? 1`. */
  version?: number
}
