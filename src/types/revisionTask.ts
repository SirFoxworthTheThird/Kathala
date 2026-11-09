/*
  A revision task (editorial-plan.md, R5): something a review asks to be done
  to the book, kept until it is done. Said in the writer's words, or split from
  an editor's letter; made from a note on the prose, or from what the
  continuity check or an AI audit found, keeping where it came from.

  Linked to what it is about — chapters, scenes, characters — so that a
  chapter's panel can list the work on it. Done tasks are kept: with the
  resolved notes, they are the record of the revision.
*/

export interface TaskLink {
  kind: 'chapter' | 'scene' | 'character'
  id: string
}

export type TaskSource =
  /** Split from an editor's letter; `letter` names it, as the writer pasted it in. */
  | { kind: 'letter'; letter: string }
  /** Made from a note on the prose, whose words it quotes. */
  | { kind: 'note'; noteId: string; quote: string }
  /** Made from a finding of the continuity check, or of an AI audit (`audit`). */
  | { kind: 'issue'; issueId: string; message: string; audit: boolean }

export interface RevisionTask {
  id: string
  worldId: string
  /** What to do. */
  text: string
  /** The heading it stood under in a letter, where it had one. */
  group?: string
  links: TaskLink[]
  source?: TaskSource
  done: boolean
  doneAt?: number
  /** Its place in the list: tasks are listed in the order they were made, a letter's in its own. */
  order: number
  createdAt: number
  updatedAt: number
  /** Journal version; read as `?? 1`. */
  version?: number
}
