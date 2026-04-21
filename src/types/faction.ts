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
}

export interface FactionMembership {
  id: string
  worldId: string
  factionId: string
  characterId: string
  role: string | null
  startEventId: string | null
  endEventId: string | null
  notes: string
  createdAt: number
  updatedAt: number
}
