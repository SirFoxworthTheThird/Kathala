export interface Character {
  id: string
  worldId: string
  name: string
  aliases: string[]
  description: string
  portraitImageId: string | null
  tags: string[]
  isAlive: boolean
  createdAt: number
  updatedAt: number
}

export interface Item {
  id: string
  worldId: string
  name: string
  description: string
  iconType: string
  imageId: string | null
  tags: string[]
}

export interface ItemPlacement {
  id: string
  worldId: string
  itemId: string
  eventId: string
  locationMarkerId: string
  notes: string
  createdAt: number
  updatedAt: number
}

export interface CharacterSnapshot {
  id: string
  worldId: string
  characterId: string
  eventId: string
  isAlive: boolean
  currentLocationMarkerId: string | null
  currentMapLayerId: string | null
  inventoryItemIds: string[]
  inventoryNotes: string
  statusNotes: string
  travelModeId: string | null
  createdAt: number
  updatedAt: number
}

export interface LocationSnapshot {
  id: string
  worldId: string
  locationMarkerId: string
  eventId: string
  status: string
  notes: string
  createdAt: number
  updatedAt: number
}

export interface ItemSnapshot {
  id: string
  worldId: string
  itemId: string
  eventId: string
  condition: string
  notes: string
  createdAt: number
  updatedAt: number
}
