export interface Character {
  id: string
  worldId: string
  name: string
  aliases: string[]
  description: string
  portraitImageId: string | null
  tags: string[]
  isAlive: boolean
  /** Optional hex color for arc-view row tinting and other visual cues */
  color: string | null
  /** Optional birth date on the world calendar, for computing age at an event. */
  birthDate?: import('./world').InWorldDate | null
  /**
   * Operation-journal bookkeeping (#115), incremented on every journalled
   * write. Optional because records created before v52 — and worlds imported
   * from older `.pwk` files — won't carry one; the journal reads a missing
   * version as 1.
   */
  version?: number
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
  /**
   * Whether this is a *kind* of thing rather than one particular object.
   *
   * Lembas, elven cloaks and barrow-blades are each one record but many
   * objects: six members of the Fellowship carry a cloak at once. Continuity
   * checks that treat an item's whereabouts as unique — "appears in multiple
   * places", "changes hands between characters in different places" — do not
   * apply to those, and firing anyway accounted for 71 of the 97 issues the
   * shipped Fellowship reported.
   *
   * Absent means a unique object, which is the safe default: it keeps the
   * checks on for every item that predates this field.
   */
  isCollective?: boolean
  /** Operation-journal bookkeeping (#115); absent on pre-v52 records. */
  version?: number
}

export interface ItemPlacement {
  id: string
  worldId: string
  itemId: string
  eventId: string
  locationMarkerId: string
  sortKey?: number
  notes: string
  createdAt: number
  updatedAt: number
  /** Operation-journal bookkeeping (#115); absent on pre-v52 records. */
  version?: number
}

export interface CharacterSnapshot {
  id: string
  worldId: string
  characterId: string
  eventId: string
  /** Globally comparable ordering key: chapter.number × 10_000 + event.sortOrder */
  sortKey?: number
  isAlive: boolean
  currentLocationMarkerId: string | null
  currentMapLayerId: string | null
  inventoryItemIds: string[]
  inventoryNotes: string
  statusNotes: string
  travelModeId: string | null
  createdAt: number
  updatedAt: number
  /** Operation-journal bookkeeping (#115); absent on pre-v52 records. */
  version?: number
}

export interface LocationSnapshot {
  id: string
  worldId: string
  locationMarkerId: string
  eventId: string
  /** Globally comparable ordering key: chapter.number × 10_000 + event.sortOrder */
  sortKey?: number
  status: string
  notes: string
  createdAt: number
  updatedAt: number
  /** Operation-journal bookkeeping (#115); absent on pre-v52 records. */
  version?: number
}

export interface ItemSnapshot {
  id: string
  worldId: string
  itemId: string
  eventId: string
  /** Globally comparable ordering key: chapter.number × 10_000 + event.sortOrder */
  sortKey?: number
  condition: string
  notes: string
  createdAt: number
  updatedAt: number
  /** Operation-journal bookkeeping (#115); absent on pre-v52 records. */
  version?: number
}
