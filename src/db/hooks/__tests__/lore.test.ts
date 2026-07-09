import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { db } from '@/db/database'
import {
  createLoreCategory, updateLoreCategory, deleteLoreCategory,
  createLorePage, updateLorePage, deleteLorePage,
} from '@/db/hooks/useLore'

const W = 'world-lore'

beforeEach(async () => {
  await db.delete()
  await db.open()
})
afterAll(async () => {
  await db.delete()
})

describe('lore categories CRUD', () => {
  it('assigns an incrementing sortOrder per world', async () => {
    const a = await createLoreCategory({ worldId: W, name: 'Geography', color: null })
    const b = await createLoreCategory({ worldId: W, name: 'Religion', color: '#0f0' })
    const c = await createLoreCategory({ worldId: 'other-world', name: 'Magic', color: null })
    expect(a.sortOrder).toBe(0)
    expect(b.sortOrder).toBe(1)
    // Independent per world.
    expect(c.sortOrder).toBe(0)
  })

  it('updates a category', async () => {
    const cat = await createLoreCategory({ worldId: W, name: 'Old', color: null })
    await updateLoreCategory(cat.id, { name: 'New', color: '#123456' })
    const stored = await db.loreCategories.get(cat.id)
    expect(stored!.name).toBe('New')
    expect(stored!.color).toBe('#123456')
  })

  it('deleting a category orphans its pages to uncategorised (not deleted)', async () => {
    const cat = await createLoreCategory({ worldId: W, name: 'Doomed', color: null })
    const page = await createLorePage({ worldId: W, categoryId: cat.id, title: 'A page' })

    await deleteLoreCategory(cat.id)

    expect(await db.loreCategories.get(cat.id)).toBeUndefined()
    const stored = await db.lorePages.get(page.id)
    expect(stored).toBeDefined()
    expect(stored!.categoryId).toBeNull()
  })
})

describe('lore pages CRUD', () => {
  it('creates a page with sensible defaults', async () => {
    const page = await createLorePage({ worldId: W, categoryId: null, title: 'The First Age' })
    const stored = await db.lorePages.get(page.id)
    expect(stored).toBeDefined()
    expect(stored!.title).toBe('The First Age')
    expect(stored!.body).toBe('')
    expect(stored!.tags).toEqual([])
    expect(stored!.linkedEntityIds).toEqual([])
    expect(stored!.visibleFromEventId).toBeNull()
  })

  it('updates a page body and links, bumping updatedAt', async () => {
    const page = await createLorePage({ worldId: W, categoryId: null, title: 'Draft' })
    await updateLorePage(page.id, { body: '# Heading', linkedEntityIds: ['char-1'] })
    const stored = await db.lorePages.get(page.id)
    expect(stored!.body).toBe('# Heading')
    expect(stored!.linkedEntityIds).toEqual(['char-1'])
    expect(stored!.updatedAt).toBeGreaterThanOrEqual(page.updatedAt)
  })

  it('deletes a page', async () => {
    const page = await createLorePage({ worldId: W, categoryId: null, title: 'Temp' })
    await deleteLorePage(page.id)
    expect(await db.lorePages.get(page.id)).toBeUndefined()
  })
})
