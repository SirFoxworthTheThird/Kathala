import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import type { LoreCategory, LorePage } from '@/types'
import { generateId } from '@/lib/id'

// ── Categories ────────────────────────────────────────────────────────────────

export function useLoreCategories(worldId: string | null) {
  return useLiveQuery(
    () => worldId ? db.loreCategories.where('worldId').equals(worldId).sortBy('sortOrder') : [],
    [worldId], []
  )
}

export async function createLoreCategory(data: Pick<LoreCategory, 'worldId' | 'name' | 'color'>): Promise<LoreCategory> {
  const existing = await db.loreCategories.where('worldId').equals(data.worldId).count()
  const cat: LoreCategory = {
    id: generateId(),
    sortOrder: existing,
    ...data,
  }
  await db.loreCategories.add(cat)
  return cat
}

export async function updateLoreCategory(id: string, data: Partial<Omit<LoreCategory, 'id'>>) {
  await db.loreCategories.update(id, data)
}

export async function deleteLoreCategory(id: string) {
  // Move orphaned pages to uncategorised
  await db.lorePages.where('categoryId').equals(id).modify({ categoryId: null })
  await db.loreCategories.delete(id)
}

// ── Pages ─────────────────────────────────────────────────────────────────────

export function useLorePages(worldId: string | null) {
  return useLiveQuery(
    () => worldId ? db.lorePages.where('worldId').equals(worldId).reverse().sortBy('updatedAt') : [],
    [worldId], []
  )
}

export function useLorePage(id: string | null) {
  return useLiveQuery(() => (id ? db.lorePages.get(id) : undefined), [id])
}

export async function createLorePage(data: Pick<LorePage, 'worldId' | 'categoryId' | 'title'>): Promise<LorePage> {
  const now = Date.now()
  const page: LorePage = {
    id: generateId(),
    body: '',
    tags: [],
    coverImageId: null,
    linkedEntityIds: [],
    visibleFromEventId: null,
    createdAt: now,
    updatedAt: now,
    ...data,
  }
  await db.lorePages.add(page)
  return page
}

export function useLorePagesForEntity(worldId: string | null, entityId: string | null) {
  return useLiveQuery(
    () => worldId && entityId
      ? db.lorePages.where('worldId').equals(worldId)
          .filter((p) => (p.linkedEntityIds ?? []).includes(entityId))
          .toArray()
      : [],
    [worldId, entityId],
    []
  )
}

export async function updateLorePage(id: string, data: Partial<Omit<LorePage, 'id' | 'createdAt'>>) {
  await db.lorePages.update(id, { ...data, updatedAt: Date.now() })
}

export async function deleteLorePage(id: string) {
  await db.lorePages.delete(id)
}
