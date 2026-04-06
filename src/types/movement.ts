export interface CharacterMovement {
  id: string
  worldId: string
  characterId: string
  eventId: string
  waypoints: string[]  // ordered locationMarkerIds
  createdAt: number
  updatedAt: number
}
