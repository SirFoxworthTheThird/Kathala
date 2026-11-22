import type { CharacterSnapshot, CustomFieldKind, FieldValue, ItemSnapshot, LocationSnapshot, MapRegionSnapshot, RelationshipSnapshot } from '@/types'
import { lastBefore, lastKnown, lastKnownOne, type CarryRule, type Dated, type Story } from './stateEngine'
import { peopleAt, personAt, type PersonRecord } from './personState'
import { holdingsAt, recordsWithCustody, withHoldings, type CustodyStatement, type Holdings } from './custody'

/*
  What is true at a scene, for every kind of state the book holds — one
  resolver (next-plan.md, Part B3).

  `stateEngine` is the rule: a record says what was true at its scene, and
  what is true at the cursor is the last one at or before it, a person's in
  their era and a thing's carried across eras by in-world time. Each kind used
  to pick its own rule in its own hook file — five files, each a place for a
  kind to be read by the wrong one. Here they are picked once, and every
  screen's question — where is she, what does he hold, is the bridge still
  standing — reads through `stateAt` or the single-entity readers below it.
*/

/** How each kind of state carries between eras. An item's condition is a thing's, unless the writer keeps it in its era (`itemCarries`). */
export const CARRIES = {
  person: 'person',
  relationship: 'person',
  place: 'thing',
  region: 'thing',
} as const satisfies Record<string, CarryRule>

/** An item's condition carries as a thing's, or — kept in its era (`Item.staysInEra`) — as a person's state does. */
export const itemCarries = (staysInEra: boolean | undefined): CarryRule => (staysInEra ? 'person' : 'thing')

/**
 * A custom field's value over time carries as its entity's state does (issue
 * #699, D-4): a character's in its era, a place's across eras, an item's as
 * its condition does.
 */
export const fieldCarries = (kind: CustomFieldKind, staysInEra?: boolean): CarryRule =>
  kind === 'character' ? CARRIES.person : kind === 'place' ? CARRIES.place : itemCarries(staysInEra)

/** Custom fields' values over time, and what each carries by: its field's kind, and the items kept in their era. */
export interface FieldRows {
  rows: readonly FieldValue[]
  /** Each field's kind, by id. A row of a field not here is not read: its field is gone. */
  kindOf: ReadonlyMap<string, CustomFieldKind>
  keptInEra: ReadonlySet<string>
}

/** The records a moment is read from; a kind left out is not read. */
export interface WorldRecords {
  /** A person's records as stored: each says only what its scene says (Part B2). */
  people?: readonly PersonRecord[]
  /** Item custody (Part B1): with it, each person holds what custody says. */
  custody?: { rows: readonly CustodyStatement[]; collective: ReadonlySet<string> }
  items?: { records: readonly ItemSnapshot[]; keptInEra: ReadonlySet<string> }
  places?: readonly LocationSnapshot[]
  relationships?: readonly RelationshipSnapshot[]
  regions?: readonly MapRegionSnapshot[]
  /** Custom fields' values over time (issue #699). */
  fields?: FieldRows
}

/** Everything known at one scene: one entry per entity that has a record by then. */
export interface Moment {
  people: CharacterSnapshot[]
  /** Custody at the scene, both ways round; null without custody or a scene. */
  holdings: Holdings | null
  items: ItemSnapshot[]
  places: LocationSnapshot[]
  relationships: RelationshipSnapshot[]
  regions: MapRegionSnapshot[]
  /**
   * Custom fields' values over time: per field and entity, the row that holds
   * at the scene. One whose value is `null` was cleared there, and says none.
   */
  fields: FieldValue[]
}

function latest<T extends Dated>(records: readonly T[] | undefined, sceneId: string | null, story: Story, rule: CarryRule, entityOf: (r: T) => string): T[] {
  if (!records || records.length === 0) return []
  return [...lastKnown(records, sceneId, story, rule, entityOf).values()].map((k) => k.record)
}

/**
 * What is true at `sceneId`, for every kind given. With no scene, each entity
 * as its most recently updated record has it (`stateEngine`).
 *
 * People are read facet by facet (`peopleAt`); with custody, each holds what
 * custody says — at the scene, or with no scene at their own record's scene.
 */
export function stateAt(world: WorldRecords, sceneId: string | null, story: Story): Moment {
  const custody = world.custody
  const holdings = custody && sceneId ? holdingsAt(custody.rows, sceneId, story, custody.collective) : null
  let people = world.people && world.people.length > 0 ? peopleAt(world.people, sceneId, story) : []
  if (custody) people = holdings ? withHoldings(people, holdings) : recordsWithCustody(people, custody.rows, story, custody.collective)
  const items = world.items
    ? [
        ...latest(world.items.records.filter((s) => !world.items!.keptInEra.has(s.itemId)), sceneId, story, itemCarries(false), (s) => s.itemId),
        ...latest(world.items.records.filter((s) => world.items!.keptInEra.has(s.itemId)), sceneId, story, itemCarries(true), (s) => s.itemId),
      ]
    : []
  return {
    people,
    holdings,
    items,
    places: latest(world.places, sceneId, story, CARRIES.place, (s) => s.locationMarkerId),
    relationships: latest(world.relationships, sceneId, story, CARRIES.relationship, (s) => s.relationshipId),
    regions: latest(world.regions, sceneId, story, CARRIES.region, (s) => s.regionId),
    fields: world.fields ? fieldsAt(world.fields, sceneId, story) : [],
  }
}

const fieldEntity = (r: FieldValue) => `${r.defId}|${r.entityId}`

/** Custom fields' values over time at `sceneId`: each field and entity's last row by then, by its entity's rule. */
export function fieldsAt(fields: FieldRows, sceneId: string | null, story: Story): FieldValue[] {
  const byRule: Record<CarryRule, FieldValue[]> = { person: [], thing: [] }
  for (const r of fields.rows) {
    const kind = fields.kindOf.get(r.defId)
    if (kind) byRule[fieldCarries(kind, fields.keptInEra.has(r.entityId))].push(r)
  }
  return [
    ...latest(byRule.person, sceneId, story, 'person', fieldEntity),
    ...latest(byRule.thing, sceneId, story, 'thing', fieldEntity),
  ]
}

/** One entity's value of one field at `sceneId`, from its rows; undefined where none is said by then. */
export function fieldValueAtScene(rows: readonly FieldValue[], sceneId: string | null, story: Story, rule: CarryRule): FieldValue | undefined {
  return lastKnownOne(rows, sceneId, story, rule)?.record
}

/** One person's state at `sceneId`, from their records, facet by facet; undefined with none by then. */
export function personAtScene(records: readonly PersonRecord[], sceneId: string | null, story: Story): CharacterSnapshot | undefined {
  return personAt(records, sceneId, story)
}

/** One item's condition at `sceneId`, from its records, by its own rule (`itemCarries`). */
export function itemAtScene(records: readonly ItemSnapshot[], sceneId: string | null, story: Story, staysInEra?: boolean): ItemSnapshot | undefined {
  return lastKnownOne(records, sceneId, story, itemCarries(staysInEra))?.record
}

/** One place's state at `sceneId`, from its records. */
export function placeAtScene(records: readonly LocationSnapshot[], sceneId: string | null, story: Story): LocationSnapshot | undefined {
  return lastKnownOne(records, sceneId, story, CARRIES.place)?.record
}

/**
 * One person's record at `sceneId` — the last at or before it, whichever
 * facets it says. For what a record is to the scenes after it (a withdrawal's
 * fallback), not what they read: that is `personAtScene`.
 */
export function personRecordAt<T extends Dated>(records: readonly T[], sceneId: string | null, story: Story): T | undefined {
  return lastKnownOne(records, sceneId, story, CARRIES.person)?.record
}

/**
 * For a write: one entity's record before scene `sceneId`, not counting one at
 * it, in this scene's era, whatever kind of thing it is. A write starts from,
 * or repeats, what this era last said; a thing's state carried from another
 * era is shown as such, and recording the same condition here is a statement
 * about this era, not a repeat.
 */
export function recordBefore<T extends Dated>(records: readonly T[], sceneId: string, story: Story): T | undefined {
  return lastBefore(records, sceneId, story, 'person')
}
