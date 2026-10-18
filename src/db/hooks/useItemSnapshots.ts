import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import { journalCreate, journalUpdate } from './useOperations'
import type { ItemSnapshot } from '@/types'
import { generateId } from '@/lib/id'
import { computeSortKey } from '@/lib/sortKey'
import { lastKnownOne, lastKnownRecords, type CarryRule, type Story } from '@/lib/stateEngine'
import { stateBefore, useStory } from './useStory'

/**
 * How an item's condition carries: across eras, as a thing's does, unless the
 * writer keeps it in its era (`Item.staysInEra`), when it carries as a
 * person's state does.
 */
export const itemRule = (staysInEra: boolean | undefined): CarryRule => (staysInEra ? 'person' : 'thing')

/** Pure single-item resolution — exported for testing. */
export function resolveItemSnapshot(
  all: ItemSnapshot[],
  activeEventId: string | null,
  story: Story,
  staysInEra?: boolean,
): ItemSnapshot | undefined {
  return lastKnownOne(all, activeEventId, story, itemRule(staysInEra))?.record
}

/** Every item's condition at the cursor, each by its own rule (`itemRule`). */
export function resolveItemSnapshots(
  all: ItemSnapshot[],
  activeEventId: string | null,
  story: Story,
  keptInEra: ReadonlySet<string>,
): ItemSnapshot[] {
  const kept = all.filter((s) => keptInEra.has(s.itemId))
  const carried = all.filter((s) => !keptInEra.has(s.itemId))
  return [
    ...lastKnownRecords(carried, activeEventId, story, itemRule(false), (s) => s.itemId),
    ...lastKnownRecords(kept, activeEventId, story, itemRule(true), (s) => s.itemId),
  ]
}

/**
 * All snapshots for a single item — every condition it was recorded in, for
 * its page's Whereabouts. The chain reads only the scenes it is given, which
 * the reading gate already narrows, so this needs no gate of its own.
 */
export function useItemAllSnapshots(itemId: string | null) {
  return useLiveQuery(
    () =>
      itemId ? db.itemSnapshots.where('itemId').equals(itemId).toArray() : [],
    [itemId],
    []
  )
}

/** Returns the last-known item snapshot at or before the active event. */
export function useItemSnapshot(
  itemId: string | null,
  worldId: string | null,
  activeEventId: string | null
): ItemSnapshot | undefined {
  const all = useItemAllSnapshots(itemId)
  const story = useStory(worldId)
  const staysInEra = useLiveQuery(async () => (itemId ? !!(await db.items.get(itemId))?.staysInEra : false), [itemId], false)
  return useMemo(
    () => (!itemId ? undefined : resolveItemSnapshot(all, activeEventId, story, staysInEra)),
    [itemId, activeEventId, all, story, staysInEra]
  )
}

/**
 * The best-known snapshot per item at the active moment — the item twin of
 * `useBestSnapshots` and `useBestRelationshipSnapshots`, and the same
 * carry-forward rule.
 *
 * Added for the Items roster (**IT-2**), which needs every item's condition at
 * once. Resolving per item would mean one live query per card, and the roster
 * routinely shows dozens.
 */
export function useBestItemSnapshots(
  worldId: string | null,
  activeEventId: string | null,
): ItemSnapshot[] {
  const all = useLiveQuery(
    () => (worldId ? db.itemSnapshots.where('worldId').equals(worldId).toArray() : []),
    [worldId],
    [],
  )
  const story = useStory(worldId)
  const kept = useLiveQuery(
    async () => (worldId ? (await db.items.where('worldId').equals(worldId).toArray()).filter((i) => i.staysInEra).map((i) => i.id) : []),
    [worldId],
    [] as string[],
  )
  return useMemo(
    () => resolveItemSnapshots(all, activeEventId, story, new Set(kept)),
    [all, activeEventId, story, kept],
  )
}

export function useEventItemSnapshots(eventId: string | null) {
  return useLiveQuery(
    () =>
      eventId
        ? db.itemSnapshots.where('eventId').equals(eventId).toArray()
        : [],
    [eventId],
    []
  )
}

/** @deprecated use useEventItemSnapshots */
export const useChapterItemSnapshots = useEventItemSnapshots

function itemSnapContentEqual(
  a: Omit<ItemSnapshot, 'id' | 'sortKey' | 'createdAt' | 'updatedAt'>,
  b: ItemSnapshot
): boolean {
  return a.condition === b.condition && a.notes === b.notes
}

export async function upsertItemSnapshot(
  data: Omit<ItemSnapshot, 'id' | 'sortKey' | 'createdAt' | 'updatedAt'>
): Promise<ItemSnapshot> {
  const now = Date.now()
  const sortKey = await computeSortKey(data.eventId)

  const existing = await db.itemSnapshots
    .where('[itemId+eventId]')
    .equals([data.itemId, data.eventId])
    .first()

  if (existing) {
    await journalUpdate('itemSnapshot', db.itemSnapshots, existing.id, { ...data, sortKey, updatedAt: now })
    return (await db.itemSnapshots.get(existing.id))!
  }

  // Dedup: skip write if state matches the last-known snapshot
  const allForItem = await db.itemSnapshots
    .where('itemId').equals(data.itemId)
    .toArray()
  const prevBest = await stateBefore(allForItem, data.eventId, data.worldId)

  if (prevBest && itemSnapContentEqual(data, prevBest)) {
    return prevBest
  }

  const snap: ItemSnapshot = { id: generateId(), ...data, sortKey, createdAt: now, updatedAt: now }
  return journalCreate('itemSnapshot', db.itemSnapshots, snap)
}
