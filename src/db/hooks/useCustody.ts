import { useEffect, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import { journalCreate, journalDelete, journalUpdate } from './useOperations'
import { loadStory, useStory } from './useStory'
import { useItems } from './useItems'
import { computeSortKey } from '@/lib/sortKey'
import { custodyAt, custodyId, deriveWorldCustody, holdingsAt, inventoryAt, recordsWithCustody, sharedHoldersAt, type Custody, type Holdings } from '@/lib/custody'
export { withHoldings } from '@/lib/custody'
import type { CharacterSnapshot, ItemCustody } from '@/types'

const NO_ROWS: ItemCustody[] = []

/** Every custody statement in a world. */
export function useWorldCustody(worldId: string | null): ItemCustody[] {
  return useLiveQuery(() => (worldId ? db.itemCustody.where('worldId').equals(worldId).toArray() : NO_ROWS), [worldId], NO_ROWS)
}

/** Every item's custody at the cursor, both ways round (`holdingsAt`); null with no cursor. */
export function useHoldings(worldId: string | null, cursor: string | null): Holdings | null {
  const rows = useWorldCustody(worldId)
  const story = useStory(worldId)
  const items = useItems(worldId)
  return useMemo(() => {
    if (!cursor) return null
    const collective = new Set(items.filter((i) => i.isCollective).map((i) => i.id))
    return holdingsAt(rows, cursor, story, collective)
  }, [rows, story, items, cursor])
}

/*
  Writing item custody (next-plan.md, Part B1): each act that moves a thing
  says so once, as a statement at its scene — who has it from here, where it
  was put — and nothing is copied forward. Reading is `src/lib/custody.ts`.

  A statement is written as the act's intent, never inferred from a person's
  whole-state record: a record repeats their last one, so inferring from it
  would make every stale copy a statement again — the very thing custody is
  for not doing.

  One row per item and scene (and, for a collective item, per person there):
  the row's id is `custodyId`'s, so saying something again at a scene updates
  what was said there.
*/

async function isCollective(itemId: string): Promise<boolean> {
  return !!(await db.items.get(itemId))?.isCollective
}

/** Put the row for `id`, creating it or changing what it says. */
async function put(id: string, row: Omit<ItemCustody, 'id' | 'sortKey' | 'createdAt' | 'updatedAt' | 'version'>): Promise<void> {
  const now = Date.now()
  const existing = await db.itemCustody.get(id)
  if (existing) {
    const same = existing.holderId === row.holderId && existing.placeId === row.placeId && existing.has === row.has
    if (!same) await journalUpdate('itemCustody', db.itemCustody, id, { holderId: row.holderId, placeId: row.placeId, has: row.has, updatedAt: now })
    return
  }
  await journalCreate('itemCustody', db.itemCustody, {
    id, ...row, ...(row.has === undefined ? {} : { has: row.has }), sortKey: await computeSortKey(row.eventId), createdAt: now, updatedAt: now,
  })
}

async function remove(id: string): Promise<void> {
  if (!(await db.itemCustody.get(id))) return
  await journalDelete('itemCustody', db.itemCustody, id, async () => { await db.itemCustody.delete(id) })
}

/**
 * Say who has `itemId` from scene `eventId`, or where it was put: `holderId`
 * for a hand-off, `placeId` for a placement, both for a carrier at a place,
 * neither for out of everybody's hands. A collective item is said person by
 * person instead: a holder takes some (`sayShare`), and a placement is where a
 * supply lies.
 */
export async function sayCustody(worldId: string, itemId: string, eventId: string, custody: Custody): Promise<void> {
  if (await isCollective(itemId)) {
    if (custody.holderId) await sayShare(worldId, itemId, eventId, custody.holderId, true)
    if (custody.placeId) await put(custodyId(itemId, eventId), { worldId, itemId, eventId, holderId: null, placeId: custody.placeId })
    return
  }
  await put(custodyId(itemId, eventId), { worldId, itemId, eventId, holderId: custody.holderId, placeId: custody.placeId })
}

/** A collective item: whether `holderId` has some from scene `eventId`. */
export async function sayShare(worldId: string, itemId: string, eventId: string, holderId: string, has: boolean): Promise<void> {
  await put(custodyId(itemId, eventId, holderId), { worldId, itemId, eventId, holderId, placeId: null, has })
}

/**
 * Take back what was said of `itemId` at scene `eventId` — of `holderId`'s
 * share there, for a collective item — so it reads as it did before the scene
 * said anything. Nothing to take back is no change.
 */
export async function unsayCustody(itemId: string, eventId: string, holderId?: string): Promise<void> {
  if (holderId !== undefined && (await isCollective(itemId))) return remove(custodyId(itemId, eventId, holderId))
  await remove(custodyId(itemId, eventId))
}

/** What is said of a unique item at scene `eventId` itself, if anything. */
export async function custodyStatedAt(itemId: string, eventId: string): Promise<ItemCustody | undefined> {
  return db.itemCustody.get(custodyId(itemId, eventId))
}

/** A unique item's custody at scene `eventId`, as the statements read there. */
export async function custodyOf(worldId: string, itemId: string, eventId: string): Promise<Custody> {
  const [rows, story] = await Promise.all([db.itemCustody.where('itemId').equals(itemId).toArray(), loadStory(worldId)])
  return custodyAt(rows, eventId, story).custody
}

/** Who has some of a collective item at scene `eventId`. */
export async function sharesOf(worldId: string, itemId: string, eventId: string): Promise<string[]> {
  const [rows, story] = await Promise.all([db.itemCustody.where('itemId').equals(itemId).toArray(), loadStory(worldId)])
  return sharedHoldersAt(rows, eventId, story)
}

/** What `characterId` holds at scene `eventId`, as the statements read there: unique items in their hands, collective ones they have some of. */
export async function inventoryOf(worldId: string, characterId: string, eventId: string): Promise<string[]> {
  const [rows, story, items] = await Promise.all([db.itemCustody.where('worldId').equals(worldId).toArray(), loadStory(worldId), db.items.where('worldId').equals(worldId).toArray()])
  return inventoryAt(rows, characterId, eventId, story, new Set(items.filter((i) => i.isCollective).map((i) => i.id))).sort()
}

/**
 * `itemId` given to `characterId` at scene `eventId`, by an act on their state
 * there — the Current State panel, the map's character panel. A unique item
 * is theirs from here, and so nobody else's; a collective one, they have some.
 */
export async function giveTo(worldId: string, itemId: string, eventId: string, characterId: string): Promise<void> {
  await sayCustody(worldId, itemId, eventId, { holderId: characterId, placeId: null })
}

/**
 * `itemId` taken out of `characterId`'s hands at scene `eventId`. Given to them
 * at this very scene, that is taken back, and it reads as it did before; still
 * theirs after that — from an earlier scene — nobody has it from here. Not
 * theirs at all, nothing is said: taking out what somebody else has is not a
 * statement about it.
 */
export async function takeFrom(worldId: string, itemId: string, eventId: string, characterId: string): Promise<void> {
  if (await isCollective(itemId)) {
    const share = await db.itemCustody.get(custodyId(itemId, eventId, characterId))
    if (share?.has) await unsayCustody(itemId, eventId, characterId)
    if ((await sharesOf(worldId, itemId, eventId)).includes(characterId)) await sayShare(worldId, itemId, eventId, characterId, false)
    return
  }
  const said = await custodyStatedAt(itemId, eventId)
  if (said?.holderId === characterId) await unsayCustody(itemId, eventId)
  if ((await custodyOf(worldId, itemId, eventId)).holderId === characterId) await sayCustody(worldId, itemId, eventId, { holderId: null, placeId: null })
}

/**
 * A person's inventory as a writer set it at scene `eventId`: `before` what
 * they were shown holding, `after` what they saved. What was added is given to
 * them, what was taken out is taken from them — and what was shown and kept
 * says nothing, so saving an untouched list writes no custody at all.
 */
export async function sayInventory(worldId: string, characterId: string, eventId: string, before: readonly string[], after: readonly string[]): Promise<void> {
  for (const itemId of after) if (!before.includes(itemId)) await giveTo(worldId, itemId, eventId, characterId)
  for (const itemId of before) if (!after.includes(itemId)) await takeFrom(worldId, itemId, eventId, characterId)
}

/**
 * Custody at `sceneIds`, derived again from the records there, for a bulk
 * write that put whole-state records in place of acts — the chapter AI
 * import, which writes every character's state at every scene. What was said
 * at those scenes goes, and what the records there now say is said instead,
 * by `deriveWorldCustody`'s walk: a record repeating its last says nothing.
 *
 * Not journalled: the caller writes past the journal and resets it
 * (`markJournalDiscontinuity`), and these rows are part of that write.
 */
export async function rederiveCustodyAt(worldId: string, sceneIds: readonly string[]): Promise<void> {
  if (sceneIds.length === 0) return
  await db.transaction('rw', [db.itemCustody, db.worlds, db.events, db.chapters, db.timelines, db.items, db.characterSnapshots, db.itemPlacements], async () => {
    const [world, events, chapters, timelines, items, snapshots, placements] = await Promise.all([
      db.worlds.get(worldId),
      db.events.where('worldId').equals(worldId).toArray(),
      db.chapters.where('worldId').equals(worldId).toArray(),
      db.timelines.where('worldId').equals(worldId).toArray(),
      db.items.where('worldId').equals(worldId).toArray(),
      db.characterSnapshots.where('worldId').equals(worldId).toArray(),
      db.itemPlacements.where('worldId').equals(worldId).toArray(),
    ])
    const scenes = new Set(sceneIds)
    const { rows } = deriveWorldCustody({ worldId, pinsSetClock: world?.pinsSetClock, events, chapters, timelines, items, snapshots, placements, now: Date.now() })
    await db.itemCustody.where('eventId').anyOf([...scenes]).delete()
    await db.itemCustody.bulkPut(rows.filter((r) => scenes.has(r.eventId)))
  })
}

/**
 * A world whose records say who holds things but which has no custody
 * statements at all has them derived, as the v61 migration does for a world
 * already in the store when it upgrades. Every path the app writes through
 * says custody as it goes, and every import derives it; this is for records
 * that reached the store some other way — written straight into its tables,
 * as a test seeds them, or restored from somewhere that kept only the tables
 * it knew. Once a world has any statement it is left alone: from then on what
 * is said is what was said, and is not derived again.
 */
export function useCustodyBackfill(worldId: string | null): void {
  const needed = useLiveQuery(async () => {
    if (!worldId) return false
    if ((await db.itemCustody.where('worldId').equals(worldId).count()) > 0) return false
    const listing = await db.characterSnapshots.where('worldId').equals(worldId).filter((s) => (s.inventoryItemIds?.length ?? 0) > 0).count()
    return listing > 0 || (await db.itemPlacements.where('worldId').equals(worldId).count()) > 0
  }, [worldId], false)
  useEffect(() => {
    if (!needed || !worldId) return
    void (async () => {
      // Still none by the time it runs: two tabs, or a write that landed meanwhile, must not derive a second set.
      if ((await db.itemCustody.where('worldId').equals(worldId).count()) > 0) return
      await rederiveCustodyAt(worldId, (await db.events.where('worldId').equals(worldId).primaryKeys()) as string[])
    })()
  }, [needed, worldId])
}

/**
 * Records with each one's inventory as custody has it at the record's own
 * scene: what the person holds there, by the statements, rather than the copy
 * the record made of the one before it. For the screens that walk records
 * rather than resolve one moment — a person's history, the checker, a
 * chapter's diff — so that a stale copy reaches none of them.
 */
export function useRecordsWithCustody<T extends Pick<CharacterSnapshot, 'characterId' | 'eventId' | 'inventoryItemIds' | 'worldId'>>(records: T[]): T[] {
  const worldId = records[0]?.worldId ?? null
  const rows = useWorldCustody(worldId)
  const story = useStory(worldId)
  const items = useItems(worldId)
  return useMemo(() => {
    if (records.length === 0) return records
    const collective = new Set(items.filter((i) => i.isCollective).map((i) => i.id))
    return recordsWithCustody(records, rows, story, collective)
  }, [records, rows, story, items])
}

/**
 * `characterId` keeps `itemId` through scene `eventId`: a statement there that
 * they let go of it — nobody has it, or, collective, they have none — is taken
 * back. Anything else said there (a hand-off, a placement) is a statement
 * about somebody else, and stays.
 */
export async function keepHolding(itemId: string, eventId: string, characterId: string): Promise<void> {
  if (await isCollective(itemId)) {
    const share = await db.itemCustody.get(custodyId(itemId, eventId, characterId))
    if (share && share.has === false) await unsayCustody(itemId, eventId, characterId)
    return
  }
  const said = await custodyStatedAt(itemId, eventId)
  if (said && said.holderId === null && said.placeId === null) await unsayCustody(itemId, eventId)
}

/**
 * Seam for e2e specs: what each person holds at a scene, by the app's own
 * reading of custody — so a spec asserts what the screens read, not a copy of
 * the reader. Same flag as `__pwdb` in `database.ts`: present in dev and in a
 * build made with `VITE_E2E=1`, absent from a released bundle.
 */
export interface E2ECustodySeam {
  heldAt: (eventId: string) => Promise<Record<string, string[]>>
}

if (import.meta.env.DEV || import.meta.env.VITE_E2E) {
  ;(window as unknown as { __pwcustody?: E2ECustodySeam }).__pwcustody = {
    async heldAt(eventId: string) {
      const event = await db.events.get(eventId)
      if (!event) throw new Error(`No scene ${eventId}`)
      const [rows, story, items] = await Promise.all([
        db.itemCustody.where('worldId').equals(event.worldId).toArray(), loadStory(event.worldId), db.items.where('worldId').equals(event.worldId).toArray(),
      ])
      const { heldBy } = holdingsAt(rows, eventId, story, new Set(items.filter((i) => i.isCollective).map((i) => i.id)))
      return Object.fromEntries([...heldBy].map(([who, held]) => [who, [...held].sort()]))
    },
  }
}
