export interface CharacterMovement {
  id: string
  worldId: string
  characterId: string
  eventId: string
  waypoints: string[]  // ordered locationMarkerIds
  travelModeId: string | null
  sortKey?: number
  notes: string
  createdAt: number
  updatedAt: number
}
