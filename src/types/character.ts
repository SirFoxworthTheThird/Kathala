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
  isAlive: boolean
  /**
   * This scene is where they came back.
   *
   * A revived character *is* alive, so this sits beside `isAlive` rather than
   * replacing it with a three-valued state — which would mean touching every
   * one of the sixty-odd places that ask whether somebody is alive, from the
   * map pins to the arc grid to the sequel builder, for a fact none of them
   * needs. Absent on every record written before it existed, and absent is
   * simply "no".
   *
   * It is the character's form of an item's `repaired` and a place's `rebuilt`:
   * the writer states what happened, and the continuity check has nothing to
   * report — rather than reporting it and being told to be quiet. A suppression
   * is keyed on a derived issue id, so moving the scene orphans it and the
   * warning comes back; this is on the record.
   */
  revived?: boolean
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
  condition: string
  notes: string
  createdAt: number
  updatedAt: number
  /** Operation-journal bookkeeping (#115); absent on pre-v52 records. */
  version?: number
}
