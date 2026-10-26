export interface CharacterNameChange {
  eventId: string
  name: string
}

export interface CharacterAliasFrom {
  alias: string
  eventId: string
}

export interface CharacterReveal {
  /** Who they turn out to be: the pair's head. */
  characterId: string
  /** The scene the reader learns it at. */
  eventId: string
}

export interface Character {
  id: string
  worldId: string
  name: string
  aliases: string[]
  /**
   * "From this scene, called …" — Gandalf the Grey, then the White; Strider,
   * then Aragorn. Before the first change in reading order, `name` applies, and
   * `name` is always what a writer sees. Absent on records that predate it.
   * The rules are `src/lib/characterNames.ts`.
   */
  nameChanges?: CharacterNameChange[]
  /**
   * When an alias becomes known — Elessar, in Lothlórien. An alias with no
   * entry is known from the start, as every alias was before this existed.
   */
  aliasesFrom?: CharacterAliasFrom[]
  /**
   * "Is revealed to be …, at …" — Hyde is Jekyll; the narrator is Tyler. The
   * two stay two records, since the book presents two people until the reveal
   * and each has a history of their own; this joins them from that scene on.
   * Held on the one revealed, never on both, so the two cannot disagree. The
   * rules are `src/lib/characterIdentity.ts`.
   */
  revealedAs?: CharacterReveal
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
  /**
   * Whether its condition stays in the era it was recorded in. A thing's state
   * carries into a later era by in-world time (`stateEngine`, rule 'thing') —
   * a ship's hull is still damaged three centuries on — but a crate of rations
   * or a uniform is not the same object by then, and a writer can say so.
   *
   * Absent means it carries: the run-10 plan's Decision 2, and the rule every
   * item followed before this field.
   */
  staysInEra?: boolean
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

/**
 * One statement about an item at a scene — who has it, where it was put — its
 * custody from here on (next-plan.md, Part B1; read by `src/lib/custody.ts`).
 *
 * Replaces reading custody off people's whole-state records, where one fact —
 * Anna has the ledger — was stored again at every scene she was recorded at,
 * and a later copy outvoted an earlier correction. A unique item has one
 * statement per scene. A collective item (`Item.isCollective`) has one per
 * person per scene, saying with `has` whether they have some from there.
 */
export interface ItemCustody {
  id: string
  worldId: string
  itemId: string
  eventId: string
  /** Who has it from here; null for nobody. */
  holderId: string | null
  /** Where it was put; with a holder, the place they had it. */
  placeId: string | null
  /** A collective item's: whether `holderId` has some from here. */
  has?: boolean
  /** Written by `computeSortKey`, as on the other per-scene records. */
  sortKey?: number
  createdAt: number
  updatedAt: number
  /** Operation-journal bookkeeping (#115). */
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
