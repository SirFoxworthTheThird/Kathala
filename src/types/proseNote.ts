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
  /** A beta reader's reaction, where the note is one (R7). */
  reaction?: Reaction
  /** Journal version; read as `?? 1`. */
  version?: number
}
