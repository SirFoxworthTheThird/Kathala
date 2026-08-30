import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import { useGate } from './ReadingGateContext'
import { journalCreate, journalUpdate, journalDelete } from './useOperations'
import type { Item } from '@/types'
import { generateId } from '@/lib/id'

export function useItems(worldId: string | null) {
  const gate = useGate()
  const all = useLiveQuery(
    () => (worldId ? db.items.where('worldId').equals(worldId).sortBy('name') : []),
    [worldId],
    []
  )
  return useMemo(() => gate.filter(all), [gate, all])
}

export function useItem(id: string | null) {
  return useLiveQuery(() => (id ? db.items.get(id) : undefined), [id])
}

export async function createItem(data: Pick<Item, 'worldId' | 'name' | 'description' | 'iconType' | 'tags'>): Promise<Item> {
  const item: Item = {
    id: generateId(),
    imageId: null,
    ...data,
  }
  return journalCreate('item', db.items, item)
}

export async function updateItem(id: string, data: Partial<Omit<Item, 'id'>>) {
  await journalUpdate('item', db.items, id, data)
}

/**
 * The confirmation says this "will permanently remove the item and all its
 * snapshots", and for a long time two of the places holding its id were left
 * alone: a character's inventory went on listing it, falling through to
 * `{item?.name ?? itemId}` and printing a raw nanoid on the Current State tab
 * and nothing at all in History, and a scene's `involvedItemIds` kept it, where
 * the continuity checker prints the same fallback into its findings.
 *
 * `deleteLocationMarker` has always nulled out the character snapshots naming
 * the marker it removes; this is the same cascade over an array field. Both are
 * `filter` scans because neither column is indexed, which is affordable for an
 * action a writer takes by hand and confirms.
 */
export async function deleteItem(id: string) {
  await journalDelete('item', db.items, id, async () => {
    await db.items.delete(id)
    await db.itemPlacements.where('itemId').equals(id).delete()
    await db.itemSnapshots.where('itemId').equals(id).delete()
    await db.characterSnapshots
      .filter((s) => s.inventoryItemIds.includes(id))
      .modify((s) => { s.inventoryItemIds = s.inventoryItemIds.filter((i) => i !== id) })
    await db.events
      .filter((e) => e.involvedItemIds.includes(id))
      .modify((e) => { e.involvedItemIds = e.involvedItemIds.filter((i) => i !== id) })
  }, [db.itemPlacements, db.itemSnapshots, db.characterSnapshots, db.events])
}
