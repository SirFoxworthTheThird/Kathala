import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import { journalCreate, journalUpdate, journalDelete, journalGroup } from './useOperations'
import type { ItemPlacement, ItemSnapshot } from '@/types'
import type { ItemPlan } from '@/lib/sceneHeader'
import { generateId } from '@/lib/id'
import { upsertItemSnapshot } from './useItemSnapshots'
import { stateBefore, STORY_TABLES } from './useStory'
import { OUT_OF_HANDS_CONDITIONS } from '@/lib/itemCondition'
import { custodyStatedAt, sayCustody, sayShare, sharesOf, unsayCustody } from './useCustody'

export function useItemPlacement(itemId: string | null, eventId: string | null) {
  return useLiveQuery(
    () =>
      itemId && eventId
        ? db.itemPlacements.where('[itemId+eventId]').equals([itemId, eventId]).first()
        : undefined,
    [itemId, eventId]
  )
}

export function useLocationItemPlacements(locationMarkerId: string | null, eventId: string | null) {
  return useLiveQuery(
    () =>
      locationMarkerId && eventId
        ? db.itemPlacements
            .where('locationMarkerId').equals(locationMarkerId)
            .filter((p) => p.eventId === eventId)
            .toArray()
        : [],
    [locationMarkerId, eventId],
    []
  )
}

export function useEventItemPlacements(eventId: string | null) {
  return useLiveQuery(
    () =>
      eventId
        ? db.itemPlacements.where('eventId').equals(eventId).toArray()
        : [],
    [eventId],
    []
  )
}

/** @deprecated use useEventItemPlacements */
export const useChapterItemPlacements = useEventItemPlacements

export function useWorldItemPlacements(worldId: string | null) {
  return useLiveQuery(
    () =>
      worldId
        ? db.itemPlacements.where('worldId').equals(worldId).toArray()
        : [],
    [worldId],
    []
  )
}

/**
 * Put an item down at a place at a scene: the placement, and the custody
 * statement that it lies there from this scene — so it is in nobody's hands
 * from here, whoever had it, without writing a state for them (Part B1). It
 * used to write one for whoever held it, carrying the rest of their last
 * state, so that their copy of the item stopped; a copy no longer says
 * anything, and there is nothing to stop.
 */
export async function placeItemAtLocation(
  worldId: string,
  itemId: string,
  eventId: string,
  locationMarkerId: string,
  notes = '',
): Promise<void> {
  await db.transaction(
    'rw',
    [db.itemPlacements, db.itemCustody, db.items, ...STORY_TABLES, db.operations, db.tombstones],
    async () => {
      const existing = await db.itemPlacements
        .where('[itemId+eventId]').equals([itemId, eventId]).first()
      const now = Date.now()
      if (existing) {
        await journalUpdate('itemPlacement', db.itemPlacements, existing.id, { locationMarkerId, notes, updatedAt: now })
      } else {
        const placement: ItemPlacement = {
          id: generateId(),
          worldId,
          itemId,
          eventId,
          locationMarkerId,
          notes,
          createdAt: now,
          updatedAt: now,
        }
        await journalCreate('itemPlacement', db.itemPlacements, placement)
      }
      await sayCustody(worldId, itemId, eventId, { holderId: null, placeId: locationMarkerId })
    },
  )
}

/** Remove an item's location placement, and the statement that it lay there from this scene. */
export async function removeItemPlacement(itemId: string, eventId: string): Promise<void> {
  const existing = await db.itemPlacements.where('[itemId+eventId]').equals([itemId, eventId]).first()
  // The statement that it was put down here goes too — and only that one: a hand-off here is another statement, and stays.
  const said = await custodyStatedAt(itemId, eventId)
  if (said && said.holderId === null && said.placeId !== null) await unsayCustody(itemId, eventId)
  if (!existing) return
  await journalDelete('itemPlacement', db.itemPlacements, existing.id, async () => {
    await db.itemPlacements.delete(existing.id)
  })
}

/**
 * Who is in scene `eventId`, as anyone who is the same person: its cast, and
 * whoever one of them is revealed to be, or is revealed as. The Bellwoman's
 * bell, destroyed in a scene Lydia is in, is in the hands of somebody there.
 */
async function presentAt(worldId: string, eventId: string): Promise<Set<string>> {
  const cast = new Set((await db.events.get(eventId))?.involvedCharacterIds ?? [])
  for (const c of await db.characters.where('worldId').equals(worldId).toArray()) {
    const as = c.revealedAs?.characterId
    if (!as) continue
    if (cast.has(c.id)) cast.add(as)
    else if (cast.has(as)) cast.add(c.id)
  }
  return cast
}

/**
 * `^Ash Ledger:@Sabine Varro` in a scene's header: the item is Sabine's from
 * this scene — one custody statement, so nobody else has it from here and no
 * later scene has to be told (Part B1). A placement here goes: it was put
 * down here, and now it was given.
 */
export async function handItemTo(worldId: string, itemId: string, eventId: string, characterId: string): Promise<void> {
  await db.transaction(
    'rw',
    [db.itemPlacements, db.itemCustody, db.items, ...STORY_TABLES, db.operations, db.tombstones],
    async () => {
      await removeItemPlacement(itemId, eventId)
      await sayCustody(worldId, itemId, eventId, { holderId: characterId, placeId: null })
    },
  )
}

/**
 * A hand-off at this scene taken back: what this scene said of them goes, and
 * the item reads as it did before — with whoever had it. A hand-off here to
 * somebody else is that person's, and stays.
 */
export async function takeItemBack(itemId: string, eventId: string, characterId: string): Promise<void> {
  if ((await db.items.get(itemId))?.isCollective) await unsayCustody(itemId, eventId, characterId)
  else if ((await custodyStatedAt(itemId, eventId))?.holderId === characterId) await unsayCustody(itemId, eventId)
}

/**
 * Write what a header's Items line asks for (`planHeader`), as one undo step:
 * what is taken off it first, so an item moved from one person to another is
 * taken back and then given.
 */
export async function recordItemChanges(
  worldId: string,
  eventId: string,
  plan: Pick<ItemPlan, 'give' | 'put' | 'takeBack' | 'unput'> & Partial<Pick<ItemPlan, 'condition' | 'uncondition'>>,
): Promise<void> {
  const condition = plan.condition ?? []
  const uncondition = plan.uncondition ?? []
  if (!plan.give.length && !plan.put.length && !plan.takeBack.length && !plan.unput.length && !condition.length && !uncondition.length) return
  await journalGroup(async () => {
    for (const itemId of uncondition) await takeConditionBack(itemId, eventId)
    for (const { itemId, condition: c } of condition) await setItemConditionAt(worldId, itemId, eventId, c)
    for (const { itemId, characterId } of plan.takeBack) await takeItemBack(itemId, eventId, characterId)
    // A placement taken off: it reads as it did before it — back in the hands it left.
    for (const itemId of plan.unput) await removeItemPlacement(itemId, eventId)
    for (const { itemId, characterId } of plan.give) await handItemTo(worldId, itemId, eventId, characterId)
    for (const { itemId, placeId } of plan.put) await placeItemAtLocation(worldId, itemId, eventId, placeId)
  }, { label: 'Items at this scene' })
}

/** The item's state before scene `eventId`, in its era (`stateBefore`). */
async function itemStateBefore(worldId: string, itemId: string, eventId: string): Promise<ItemSnapshot | undefined> {
  return stateBefore(await db.itemSnapshots.where('itemId').equals(itemId).toArray(), eventId, worldId)
}

/**
 * Record an item's condition at a scene, as the Items line's `^Ash
 * Ledger:damaged` says: the state here takes it, or — with none here — one is
 * made, carrying the notes of the state before. The condition it already had
 * by then needs no state, and gets none.
 */
export async function setItemConditionAt(worldId: string, itemId: string, eventId: string, condition: string): Promise<void> {
  const here = await db.itemSnapshots.where('[itemId+eventId]').equals([itemId, eventId]).first()
  const was = here?.condition ?? (await itemStateBefore(worldId, itemId, eventId))?.condition
  if (here) {
    if (here.condition !== condition) await journalUpdate('itemSnapshot', db.itemSnapshots, here.id, { condition, updatedAt: Date.now() })
  } else {
    // `upsertItemSnapshot` writes nothing for a state the same as the one before.
    const before = await itemStateBefore(worldId, itemId, eventId)
    await upsertItemSnapshot({ worldId, itemId, eventId, condition, notes: before?.notes ?? '' })
  }
  await handsFollow(worldId, itemId, eventId, was, condition)
}

/**
 * A thing destroyed here is in nobody's hands after this scene, as the dead
 * are nowhere: a custody statement that nobody has it from here, wherever its
 * holder is — the word is about the thing, and saying it writes nobody a state
 * (W5-7 was a holder elsewhere being given one). Going back on that (another
 * condition here, or the word taken off) gives it back to whoever had it.
 */
async function handsFollow(worldId: string, itemId: string, eventId: string, was: string | undefined, now: string | undefined): Promise<void> {
  /*
    A thing *lost* here is out of hands too (see `OUT_OF_HANDS_CONDITIONS`), and
    *found* is what happens to it next, in whoever's hands the line names: so
    found, it is not handed back to the one who lost it. Taking the word off is.
  */
  const gone = (c: string | undefined) => !!c && OUT_OF_HANDS_CONDITIONS.includes(c)
  if (gone(now) && !gone(was)) await custodyGone(worldId, itemId, eventId)
  else if (gone(was) && !gone(now) && !(was === 'lost' && now === 'found')) await custodyBack(itemId, eventId)
}

/**
 * Custody for a thing destroyed or lost at a scene: a statement that nobody
 * has it from here, where the scene said nothing else of it. Put down here, it
 * is where it was put. Collective: the share of each person in the scene who
 * had some — a supply is in many hands, and the scene speaks for the ones in it.
 */
async function custodyGone(worldId: string, itemId: string, eventId: string): Promise<void> {
  if ((await db.items.get(itemId))?.isCollective) {
    const present = await presentAt(worldId, eventId)
    for (const holder of await sharesOf(worldId, itemId, eventId)) if (present.has(holder)) await sayShare(worldId, itemId, eventId, holder, false)
    return
  }
  const said = await custodyStatedAt(itemId, eventId)
  if (said?.placeId) return
  await sayCustody(worldId, itemId, eventId, { holderId: null, placeId: null })
}

/** That taken back: the statements `custodyGone` made at the scene go, and it is in whoever's hands it was before. */
async function custodyBack(itemId: string, eventId: string): Promise<void> {
  if ((await db.items.get(itemId))?.isCollective) {
    for (const row of await db.itemCustody.where('[itemId+eventId]').equals([itemId, eventId]).toArray()) {
      if (row.holderId && row.has === false) await unsayCustody(itemId, eventId, row.holderId)
    }
    return
  }
  const said = await custodyStatedAt(itemId, eventId)
  if (said && said.holderId === null && said.placeId === null) await unsayCustody(itemId, eventId)
}

/**
 * A condition taken off the Items line: the state here goes back to the
 * condition before it. A state that said nothing else — its notes the ones it
 * carried on — goes altogether; one with notes of its own written here keeps
 * them.
 */
export async function takeConditionBack(itemId: string, eventId: string): Promise<void> {
  const here = await db.itemSnapshots.where('[itemId+eventId]').equals([itemId, eventId]).first()
  if (!here) return
  const before = await itemStateBefore(here.worldId, itemId, eventId)
  if (here.notes === (before?.notes ?? '')) {
    await journalDelete('itemSnapshot', db.itemSnapshots, here.id, async () => { await db.itemSnapshots.delete(here.id) })
  } else {
    await journalUpdate('itemSnapshot', db.itemSnapshots, here.id, { condition: before?.condition ?? '', updatedAt: Date.now() })
  }
  await handsFollow(here.worldId, itemId, eventId, here.condition, before?.condition)
}
