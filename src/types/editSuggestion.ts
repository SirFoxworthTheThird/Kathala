/**
 * A change an editor made, brought in from their Word file and waiting for the
 * writer to accept or reject it (editorial-plan.md, R4). Kept until decided,
 * the page closing included; accepted, it is written into the scene's prose
 * (and its History), and rejected, it goes. Kept on this device.
 */
export interface EditSuggestion {
  id: string
  worldId: string
  /** The scene it is for; null for a passage of the file no scene matched, until the writer places it. */
  eventId: string | null
  /** Which import it came in with, and the file's name. */
  importId: string
  source: string
  /** A passage of the file that no scene matched: its suggestions share it, and its text. */
  passage?: { id: string; text: string }
  /** Made with tracking on, or off (found against the draft the file was made from). */
  kind: 'tracked' | 'untracked'
  before: string
  after: string
  prefix: string
  suffix: string
  author?: string
  /** Its order within its scene, as the file has it. */
  order: number
  createdAt: number
}
