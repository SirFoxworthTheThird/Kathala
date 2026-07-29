import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import { journalCreate, journalUpdate, journalDelete } from './useOperations'
import type { Item } from '@/types'
import { generateId } from '@/lib/id'

export function useItems(worldId: string | null) {
  return useLiveQuery(
    () => (worldId ? db.items.where('worldId').equals(worldId).sortBy('name') : []),
    [worldId],
    []
  )
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

export async function deleteItem(id: string) {
  await journalDelete('item', db.items, id, async () => {
    await db.items.delete(id)
    await db.itemPlacements.where('itemId').equals(id).delete()
    await db.itemSnapshots.where('itemId').equals(id).delete()
  }, [db.itemPlacements, db.itemSnapshots])
}
