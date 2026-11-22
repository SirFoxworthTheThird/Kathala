/*
  Research and reference material (issue #700, docs/records/research-plan.md):
  the writer's sources, kept with what they inform. A file (an image or a
  PDF, stored in `blobs`), a web link, or a clipping of pasted text with where
  it came from, each with a title and a note.
*/

export type ResearchKind = 'file' | 'link' | 'clip'

/** What a research item can be attached to. */
export type ResearchTarget = 'scene' | 'place' | 'character' | 'item'

export interface ResearchLink {
  kind: ResearchTarget
  id: string
}

export interface ResearchItem {
  id: string
  /** In a series, the series' id: sources inform the world, as lore does (D-4). */
  worldId: string
  kind: ResearchKind
  title: string
  note: string
  /** A link's address. Nothing is fetched from it. */
  url?: string
  /** A clipping's words. */
  text?: string
  /** Where a clipping came from: a book, a page, an address. */
  source?: string
  /** A file's bytes, in `blobs` (never in this record). */
  blobId?: string
  mimeType?: string
  /** A file's size in bytes, as added. */
  size?: number
  /** The original file name, for saving it again. */
  fileName?: string
  /** What it informs (D-5). */
  attachedTo: ResearchLink[]
  /** Attached to the world as a whole: not the same as attached to nothing. */
  toWorld: boolean
  /** Its place in the Research list, and on a mood board (D-1). */
  order: number
  createdAt: number
  updatedAt: number
  /** Journal version; read as `?? 1`. */
  version?: number
}
