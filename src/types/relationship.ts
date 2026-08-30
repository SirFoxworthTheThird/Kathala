export type RelationshipStrength = 'weak' | 'moderate' | 'strong' | 'bond'
export type RelationshipSentiment = 'positive' | 'neutral' | 'negative' | 'complex'

export interface Relationship {
  id: string
  worldId: string
  characterAId: string
  characterBId: string
  label: string
  strength: RelationshipStrength
  sentiment: RelationshipSentiment
  description: string
  isBidirectional: boolean
  /** Event this relationship first appears in. Null = exists from the beginning. */
  startEventId: string | null
  createdAt: number
  updatedAt: number
  /** Operation-journal bookkeeping (#115); absent on pre-v52 records. */
  version?: number
}

export interface RelationshipSnapshot {
  id: string
  worldId: string
  relationshipId: string
  eventId: string
  /**
   * Globally comparable ordering key, written by `computeSortKey`:
   * `chapter.number + event.sortOrder / 1_000_000`.
   *
   * Not the `chapter.number × 10_000 + sortOrder` these comments used to claim
   * — that is the *separate* ordering the continuity checker derives in memory
   * (`eventOrder`), and it is never stored. The two are order-equivalent, so
   * nothing broke; a test seeded from the comment simply produced keys a
   * thousandfold too large and the screen quietly disagreed with it.
   */
  sortKey?: number
  label: string
  strength: RelationshipStrength
  sentiment: RelationshipSentiment
  description: string
  /** false = relationship has ended or not yet formed in this event */
  isActive: boolean
  createdAt: number
  updatedAt: number
  /** Operation-journal bookkeeping (#115); absent on pre-v52 records. */
  version?: number
}
