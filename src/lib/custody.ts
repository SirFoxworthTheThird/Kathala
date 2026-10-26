import type { CharacterSnapshot, ItemPlacement } from '@/types'
import { lastKnown, lastKnownOne, type Dated, type Story } from './stateEngine'

/*
  Item custody as statements (next-plan.md, Part B1).

  Today who holds a thing is read off people's records: a `CharacterSnapshot`
  holds a person's whole inventory, and every write for them copies the rest of
  their last one. So one fact — Anna has the ledger — is stored again at every
  scene Anna is recorded at, and a later copy outvotes an earlier correction
  (W-3, W-8, run 7's stale holder). `staleCopies` patches that on the header
  path; the Current State panel still drifts.

  A custody statement says one thing about one item at one scene: who holds it,
  or where it lies, or that nothing is said of it any more. What holds at a
  scene is the item's last statement at or before it — one statement per item,
  so it cannot be in two pairs of hands, and nothing has to be copied forward.

  This module is the model and nothing else: no table, no writes. `deriveCustody`
  turns a world's existing records into statements, keeping only the changes,
  which is what the migration will do; `legacyCustodyAt` is how the app reads
  custody today, kept here so a probe can compare the two at every scene of
  every book (`scripts/custody-probe.ts`) and say, for each difference, why.
*/

/**
 * What a statement says of an item from its scene on: who has it, and where it
 * was put. Both null: in nobody's hands, and nowhere said. Both set: carried,
 * where a placement put it — the place a carrier had it, which is where it
 * stays when they let it go.
 */
export interface Custody {
  holder: string | null
  place: string | null
}

/**
 * One statement about one item at one scene.
 *
 * A collective item — lembas, a cloak the whole Fellowship wears
 * (`Item.isCollective`) — is many things under one name, and each person has
 * some or has none: its statements say so person by person, with `has`. A
 * unique item has one custody at a time, and no `has`.
 */
export interface CustodyStatement extends Custody, Dated {
  itemId: string
  eventId: string
  /** A collective item's: whether `holder` has some from here. */
  has?: boolean
}

const NOBODY: Custody = { holder: null, place: null }

export const sameCustody = (a: Custody, b: Custody) => a.holder === b.holder && a.place === b.place

/**
 * An item's custody at `sceneId`, from its statements.
 *
 * In the scene's era, the last statement at or before it — as a person's
 * state is read, since a holder is a person and does not carry between eras.
 * With none in this era, the last *placement* from an earlier era in in-world
 * time — as a thing's state is read, since a thing left somewhere is still
 * there centuries on — and `carriedFrom` says which. A holder from another era
 * is not carried: the person is not here to hold it.
 */
export function custodyAt(statements: readonly CustodyStatement[], sceneId: string, story: Story): { custody: Custody; carriedFrom: string | null; at: string | null } {
  const here = lastKnownOne(statements, sceneId, story, 'person')
  if (here) return { custody: { holder: here.record.holder, place: here.record.place }, carriedFrom: null, at: here.record.eventId }
  const placed = statements.filter((s) => s.place !== null)
  const carried = lastKnownOne(placed, sceneId, story, 'thing')
  if (carried?.carriedFrom) return { custody: { holder: null, place: carried.record.place }, carriedFrom: carried.carriedFrom, at: carried.record.eventId }
  return { custody: NOBODY, carriedFrom: null, at: null }
}

/**
 * Today's reading, for one scene, of every item at once: the last placement of
 * each (a thing's rule), and each person's last record (a person's rule). A
 * placement wins over an inventory, as `resolveItemWhereabouts` has it.
 */
export function legacyCustodyAt(
  placements: readonly ItemPlacement[],
  snapshots: readonly CharacterSnapshot[],
  sceneId: string,
  story: Story,
): { placeOf: Map<string, string>; holdersOf: Map<string, string[]>; inventoryOf: Map<string, string[]> } {
  const placeOf = new Map<string, string>()
  for (const [itemId, known] of lastKnown(placements, sceneId, story, 'thing', (p) => p.itemId)) placeOf.set(itemId, known.record.locationMarkerId)
  const holdersOf = new Map<string, string[]>()
  const inventoryOf = new Map<string, string[]>()
  for (const [characterId, known] of lastKnown(snapshots, sceneId, story, 'person', (s) => s.characterId)) {
    inventoryOf.set(characterId, known.record.inventoryItemIds)
    for (const itemId of known.record.inventoryItemIds) holdersOf.set(itemId, [...(holdersOf.get(itemId) ?? []), characterId])
  }
  return { placeOf, holdersOf, inventoryOf }
}

/** A scene where the records give an item to two people at once, and which the statements kept. */
export interface Ambiguity {
  itemId: string
  sceneId: string
  holders: string[]
  kept: string
}

/**
 * Statements for every item, from a world's records, keeping only the changes.
 *
 * - **A placement** is a statement: it lies there.
 * - **An item that enters a person's inventory** — listed in their record and
 *   not in their record before it, in their era — is a statement: they hold it.
 * - **An item that leaves its holder's inventory** — not listed in the record
 *   of the person the statements so far say holds it, where their record
 *   before did list it — is a statement that nobody holds it. It is where it
 *   was last put, if a placement said where they had it; otherwise nowhere is
 *   said. A person who stops listing something somebody else has since been
 *   given says nothing about it.
 *
 * A record that goes on listing what the one before it listed is a copy, and
 * says nothing: that is the whole difference from today, where the copy is
 * read as the fact, and outvotes an earlier correction or a placement.
 *
 * At one scene, a placement is read before an inventory, as today — unless it
 * puts the item where somebody whose record there lists it is: then it says
 * where they have it, not that it was put down. Some of the Library's books
 * record every carried thing so (all 53 placements in *A Princess of Mars*),
 * and read as put down, John Carter lost his revolvers at every scene he was
 * recorded carrying them. Two people taking the same item at one scene is
 * returned as an ambiguity, the first by id kept.
 *
 * A collective item's statements are each person's own: they took some, or
 * they have none left. Many can have some at once, and nothing is ambiguous.
 */
export function deriveCustody(args: {
  itemIds: readonly string[]
  /** Collective items (`Item.isCollective`): each person's share said on its own, as `has`. */
  collective?: ReadonlySet<string>
  placements: readonly ItemPlacement[]
  snapshots: readonly CharacterSnapshot[]
  /** Every scene of the world, in book order. */
  scenes: readonly string[]
  story: Story
}): { statements: CustodyStatement[]; ambiguities: Ambiguity[] } {
  const { itemIds, placements, snapshots, scenes, story } = args
  const collective = args.collective ?? new Set<string>()
  const known = new Set(itemIds)
  const byItem = new Map<string, CustodyStatement[]>(itemIds.map((id) => [id, []]))
  const ambiguities: Ambiguity[] = []
  const placedAt = new Map<string, ItemPlacement[]>()
  for (const p of placements) placedAt.set(p.eventId, [...(placedAt.get(p.eventId) ?? []), p])
  const recordsAt = new Map<string, CharacterSnapshot[]>()
  for (const r of snapshots) recordsAt.set(r.eventId, [...(recordsAt.get(r.eventId) ?? []), r])
  const own = new Map<string, CharacterSnapshot[]>()
  for (const r of snapshots) own.set(r.characterId, [...(own.get(r.characterId) ?? []), r])

  for (const sceneId of scenes) {
    const placedHere = new Map<string, string>()
    for (const p of placedAt.get(sceneId) ?? []) if (known.has(p.itemId)) placedHere.set(p.itemId, p.locationMarkerId)
    const entered = new Map<string, string[]>()
    const left = new Map<string, string[]>()
    // Who lists each item here, and where they are: a placement at a carrier's own place is where they have it.
    const carriedAt = new Map<string, Array<{ holder: string; at: string | null }>>()
    for (const record of [...(recordsAt.get(sceneId) ?? [])].sort((a, b) => a.characterId.localeCompare(b.characterId))) {
      for (const itemId of record.inventoryItemIds) carriedAt.set(itemId, [...(carriedAt.get(itemId) ?? []), { holder: record.characterId, at: record.currentLocationMarkerId }])
      const before = lastBefore(own.get(record.characterId) ?? [], sceneId, story)
      const had = new Set(before?.inventoryItemIds ?? [])
      const has = new Set(record.inventoryItemIds)
      for (const itemId of has) if (!had.has(itemId) && known.has(itemId)) entered.set(itemId, [...(entered.get(itemId) ?? []), record.characterId])
      for (const itemId of had) if (!has.has(itemId) && known.has(itemId)) left.set(itemId, [...(left.get(itemId) ?? []), record.characterId])
    }
    for (const itemId of new Set([...placedHere.keys(), ...entered.keys(), ...left.keys()])) {
      const statements = byItem.get(itemId)!
      if (collective.has(itemId)) {
        // Each person's share on its own: who takes some, who has none left, and where a supply is put.
        const place = placedHere.get(itemId)
        if (place !== undefined && !carriedAt.get(itemId)?.some((c) => c.at === place)) statements.push({ itemId, eventId: sceneId, holder: null, place })
        for (const holder of entered.get(itemId) ?? []) statements.push({ itemId, eventId: sceneId, holder, place: null, has: true })
        for (const holder of left.get(itemId) ?? []) statements.push({ itemId, eventId: sceneId, holder, place: null, has: false })
        continue
      }
      let say: Custody | null = null
      const place = placedHere.get(itemId)
      const takers = entered.get(itemId) ?? []
      /*
        Of those carrying it at the placed spot, whoever took it here — a
        hand-off, both of them recorded there — then whoever held it already.
        By name order, the giver kept it: Ino kept her veil at the scene she
        gave it to Odysseus.
      */
      const holderBefore = custodyAt(statements, sceneId, story).custody.holder
      const there = place === undefined ? [] : (carriedAt.get(itemId) ?? []).filter((c) => c.at === place)
      const carrier = there.find((c) => takers.includes(c.holder)) ?? there.find((c) => c.holder === holderBefore) ?? there[0]
      if (carrier) say = { holder: carrier.holder, place: place ?? null }
      else if (place !== undefined) say = { holder: null, place }
      else if (takers.length) {
        say = { holder: takers[0], place: null }
        if (takers.length > 1) ambiguities.push({ itemId, sceneId, holders: takers, kept: takers[0] })
      } else {
        // Let go, it stays where it was last put, if a placement said so: nobody else has said where it went.
        const now = custodyAt(statements, sceneId, story).custody
        if (now.holder && left.get(itemId)!.includes(now.holder)) say = { holder: null, place: now.place }
      }
      if (say && !sameCustody(custodyAt(statements, sceneId, story).custody, say)) statements.push({ itemId, eventId: sceneId, ...say })
    }
  }
  return { statements: [...byItem.values()].flat(), ambiguities }
}

/** A person's record before scene `sceneId`, in its era: what a record there is compared with. */
function lastBefore(records: readonly CharacterSnapshot[], sceneId: string, story: Story): CharacterSnapshot | undefined {
  return lastKnownOne(records.filter((r) => r.eventId !== sceneId), sceneId, story, 'person')?.record
}

/** Who has some of a collective item at `sceneId`: each person by their own last statement, in the scene's era. */
export function sharedHoldersAt(statements: readonly CustodyStatement[], sceneId: string, story: Story): string[] {
  const own = statements.filter((s) => s.holder !== null && s.has !== undefined)
  return [...lastKnown(own, sceneId, story, 'person', (s) => s.holder!)].filter(([, k]) => k.record.has).map(([holder]) => holder)
}

/** What a person holds at a scene, by the statements: every unique item in their hands, and every collective one they have some of. */
export function inventoryAt(statements: readonly CustodyStatement[], characterId: string, sceneId: string, story: Story, collective: ReadonlySet<string> = new Set()): string[] {
  const byItem = new Map<string, CustodyStatement[]>()
  for (const s of statements) byItem.set(s.itemId, [...(byItem.get(s.itemId) ?? []), s])
  return [...byItem].filter(([itemId, own]) => (collective.has(itemId)
    ? sharedHoldersAt(own, sceneId, story).includes(characterId)
    : custodyAt(own, sceneId, story).custody.holder === characterId)).map(([itemId]) => itemId)
}
