export type FactionStance = 'allied' | 'neutral' | 'hostile'

export interface FactionRelationship {
  id: string
  worldId: string
  factionAId: string
  factionBId: string
  stance: FactionStance
  notes: string
  createdAt: number
  updatedAt: number
}

export interface Faction {
  id: string
  worldId: string
  name: string
  description: string
  color: string
  coverImageId: string | null
  tags: string[]
  createdAt: number
  updatedAt: number
  /** Operation-journal bookkeeping (#115); absent on pre-v52 records. */
  version?: number
}

export interface FactionMembership {
  id: string
  worldId: string
  factionId: string
  characterId: string
  role: string | null
  startEventId: string | null
  endEventId: string | null
  /**
   * They belong to nothing after this, and that is the point.
   *
   * A membership that ends with no other faction taking over is reported as a
   * gap — correct, and on the shipped Monte Cristo it was 13 of the checker's
   * 50 findings with no way to answer any of them. Mercédès leaves the House of
   * Morcerf for a cottage and poverty; the finding is right that nothing
   * follows, and wrong that it is a loose end.
   *
   * So this says the departure is final, the way a subplot says where it lands
   * and a character says they came back. Not a flag that hides the note: it is
   * a fact about the character's allegiance, and the faction views read it.
   *
   * A death needs no such statement — the dead join nothing, and the check
   * skips them on its own.
   */
  leavesForGood?: boolean
  notes: string
  createdAt: number
  updatedAt: number
}
