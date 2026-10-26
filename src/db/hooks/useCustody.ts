import { db } from '@/db/database'
import { journalCreate, journalDelete, journalUpdate } from './useOperations'
import { loadStory } from './useStory'
import { computeSortKey } from '@/lib/sortKey'
import { custodyAt, custodyId, deriveWorldCustody, sharedHoldersAt, type Custody } from '@/lib/custody'
import type { ItemCustody } from '@/types'

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
