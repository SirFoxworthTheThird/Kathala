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
}

export interface RelationshipSnapshot {
  id: string
  worldId: string
  relationshipId: string
  eventId: string
  /** Globally comparable ordering key: chapter.number × 10_000 + event.sortOrder */
  sortKey?: number
  label: string
  strength: RelationshipStrength
  sentiment: RelationshipSentiment
  description: string
  /** false = relationship has ended or not yet formed in this event */
  isActive: boolean
  createdAt: number
  updatedAt: number
}
