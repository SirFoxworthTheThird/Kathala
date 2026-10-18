/** A discrete piece of information or secret whose spread through the cast is
 *  tracked over time — "the king is dead", "Alice is the true heir". */
export interface KnowledgeFact {
  id: string
  worldId: string
  title: string
  description: string
  tags: string[]
  /** Event at which the *reader* learns this fact. null = derive it from POV
   *  (the reader learns it when a POV character who knows it holds the POV).
   *  Set explicitly to withhold from the reader or to reveal it early. */
  readerLearnsAtEventId: string | null
  /** Event at/after which this fact becomes true or knowable in-world (e.g. the
   *  event where the king actually dies). null = true from the start. Anyone
   *  who "knows" it before this is a continuity error. */
  originEventId: string | null
  /**
   * Words in the prose that would give the fact away before the reader is
   * meant to learn it — names, a nickname, an object — matched whole word and
   * case-insensitive by the early-reveal check (`computeKnowledgeLeaks`).
   * Absent or empty: the check has only the fact's tags and its exact title,
   * and says so (`uncheckedFacts`). Run 10's facts had none, and its leak
   * across eras went unreported.
   */
  spoilerWords?: string[]
  createdAt: number
  updatedAt: number
  /** Operation-journal bookkeeping (#115); absent on pre-v52 records. */
  version?: number
}

/** Records that a character learns a fact at a specific event (their
 *  "learned at" point). A character knows a fact at the cursor when a reveal
 *  exists whose event is at or before the cursor. No reveal = does not know. */
export interface KnowledgeReveal {
  id: string
  worldId: string
  factId: string
  characterId: string
  eventId: string
  note: string
  /**
   * Known before the book begins. Filed at the first scene, so every "known by
   * now" reads it as known from the start, but not drawn on that scene's header
   * as something learned there — and so not taken off by editing that header.
   * Absent on reveals made before this existed.
   */
  beforeStory?: boolean
  createdAt: number
  updatedAt: number
}
