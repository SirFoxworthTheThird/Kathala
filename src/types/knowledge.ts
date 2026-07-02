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
  createdAt: number
  updatedAt: number
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
  createdAt: number
  updatedAt: number
}
