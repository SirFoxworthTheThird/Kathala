import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import { useGate } from './ReadingGateContext'
import { journalCreate, journalUpdate, journalDelete } from './useOperations'
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
  const gate = useGate()
  const all = useLiveQuery(
    () => worldId ? db.lorePages.where('worldId').equals(worldId).reverse().sortBy('updatedAt') : [],
    [worldId], []
  )
  // A page waits for its own reveal point if it has one, and otherwise for the
  // entities it is about. A page titled after someone the reader has not met
  // gives them away by sitting in the index.
  return useMemo(
    () => all.filter((p) => gate.hasReached(p.visibleFromEventId) && gate.linksRevealed(p.linkedEntityIds)),
    [all, gate],
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
  await journalCreate('lorePage', db.lorePages, page)
  return page
}

export function useLorePagesForEntity(worldId: string | null, entityId: string | null) {
  const gate = useGate()
  const all = useLiveQuery(
    () => worldId && entityId
      ? db.lorePages.where('worldId').equals(worldId)
          .filter((p) => (p.linkedEntityIds ?? []).includes(entityId))
          .toArray()
      : [],
    [worldId, entityId],
    []
  )
  // Same rule as the index — a page reached sideways, from the character or
  // item it is about, must not reveal what the index would have withheld.
  return useMemo(
    () => all.filter((p) => gate.hasReached(p.visibleFromEventId) && gate.linksRevealed(p.linkedEntityIds)),
    [all, gate],
  )
}

export async function updateLorePage(
  id: string,
  data: Partial<Omit<LorePage, 'id' | 'createdAt'>>,
  options: { coalesce?: boolean } = {},
) {
  await journalUpdate('lorePage', db.lorePages, id, { ...data, updatedAt: Date.now() }, [], options)
}

export async function deleteLorePage(id: string) {
  await journalDelete('lorePage', db.lorePages, id, async () => { await db.lorePages.delete(id) })
}
