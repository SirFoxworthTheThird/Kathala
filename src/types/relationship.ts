export type RelationshipStrength = 'weak' | 'moderate' | 'strong' | 'bond'
export type RelationshipSentiment = 'positive' | 'neutral' | 'negative' | 'complex'

/** How a parent is one (issue #702, D-1): by birth, by adoption, or by marrying the child's parent. */
export type ParentKind = 'birth' | 'adoptive' | 'step'
/** What a partnership is (D-4). It can change over time: a relationship state's `partner`. */
export type PartnerKind = 'married' | 'partnered' | 'betrothed'

/**
 * Kinship (issue #702, D-4): what makes a relationship family. A parent link
 * names its parent, so the direction holds whichever way round the
 * relationship was written. `own` marks a relationship made by the family tree
 * for this kinship alone, so taking the kinship away takes the relationship too.
 */
export type Kinship =
  | { kind: 'parent'; parentId: string; parent: ParentKind; /** Birth order among the parent's children (D-3). */ order?: number; own?: boolean }
  | { kind: 'partner'; partner: PartnerKind; own?: boolean }

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
  /** Family (issue #702). Absent: not kinship. */
  kinship?: Kinship
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
  /** A partnership's kind from this scene (issue #702): betrothed, then married. Absent: as before. */
  partner?: PartnerKind
  createdAt: number
  updatedAt: number
  /** Operation-journal bookkeeping (#115); absent on pre-v52 records. */
  version?: number
}
