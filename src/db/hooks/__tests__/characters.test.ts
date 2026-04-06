import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { db } from '@/db/database'
import { createCharacter, updateCharacter, deleteCharacter } from '@/db/hooks/useCharacters'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

afterAll(async () => {
  await db.delete()
})

// ── createCharacter ───────────────────────────────────────────────────────────

describe('createCharacter', () => {
  it('persists the character with correct defaults', async () => {
    const char = await createCharacter({ worldId: 'world-1', name: 'Aria', description: 'A hero' })
    expect(char.id).toBeTruthy()
    expect(char.name).toBe('Aria')
    expect(char.description).toBe('A hero')
    expect(char.worldId).toBe('world-1')
    expect(char.isAlive).toBe(true)
    expect(char.aliases).toEqual([])
    expect(char.tags).toEqual([])
    expect(char.portraitImageId).toBeNull()
    expect(char.createdAt).toBeGreaterThan(0)
    expect(char.updatedAt).toBe(char.createdAt)

    const stored = await db.characters.get(char.id)
    expect(stored).toBeDefined()
    expect(stored!.name).toBe('Aria')
  })

  it('generates unique ids per character', async () => {
    const a = await createCharacter({ worldId: 'w', name: 'A', description: '' })
    const b = await createCharacter({ worldId: 'w', name: 'B', description: '' })
    expect(a.id).not.toBe(b.id)
  })
})

// ── updateCharacter ───────────────────────────────────────────────────────────

describe('updateCharacter', () => {
  it('updates the given fields and bumps updatedAt', async () => {
    const char = await createCharacter({ worldId: 'w', name: 'Before', description: '' })
    await new Promise((r) => setTimeout(r, 5))

    await updateCharacter(char.id, { name: 'After', isAlive: false })

    const stored = await db.characters.get(char.id)
    expect(stored!.name).toBe('After')
    expect(stored!.isAlive).toBe(false)
    expect(stored!.updatedAt).toBeGreaterThan(char.updatedAt)
  })

  it('does not alter createdAt', async () => {
    const char = await createCharacter({ worldId: 'w', name: 'Hero', description: '' })
    await updateCharacter(char.id, { name: 'Changed' })
    const stored = await db.characters.get(char.id)
    expect(stored!.createdAt).toBe(char.createdAt)
  })

  it('can update the aliases and tags arrays', async () => {
    const char = await createCharacter({ worldId: 'w', name: 'X', description: '' })
    await updateCharacter(char.id, { aliases: ['The Shadow'], tags: ['villain'] })
    const stored = await db.characters.get(char.id)
    expect(stored!.aliases).toEqual(['The Shadow'])
    expect(stored!.tags).toEqual(['villain'])
  })
})

// ── deleteCharacter ───────────────────────────────────────────────────────────

describe('deleteCharacter', () => {
  it('removes the character record', async () => {
    const char = await createCharacter({ worldId: 'w', name: 'Doomed', description: '' })
    await deleteCharacter(char.id)
    expect(await db.characters.get(char.id)).toBeUndefined()
  })

  it('cascades to character snapshots', async () => {
    const char = await createCharacter({ worldId: 'w', name: 'C', description: '' })
    await db.characterSnapshots.add({
      id: 'snap-1', worldId: 'w', characterId: char.id, chapterId: 'ch-1',
      isAlive: true, currentLocationMarkerId: null, currentMapLayerId: null,
      inventoryItemIds: [], inventoryNotes: '', statusNotes: '', travelModeId: null,
      createdAt: Date.now(), updatedAt: Date.now(),
    })
    await deleteCharacter(char.id)
    expect(await db.characterSnapshots.where('characterId').equals(char.id).count()).toBe(0)
  })

  it('cascades to relationships where character is side A or B', async () => {
    const char = await createCharacter({ worldId: 'w', name: 'C', description: '' })
    await db.relationships.add({
      id: 'rel-a', worldId: 'w', characterAId: char.id, characterBId: 'other',
      label: 'Ally', strength: 'moderate', sentiment: 'positive',
      description: '', isBidirectional: true, startChapterId: null, createdAt: Date.now(), updatedAt: Date.now(),
    })
    await db.relationships.add({
      id: 'rel-b', worldId: 'w', characterAId: 'other', characterBId: char.id,
      label: 'Enemy', strength: 'strong', sentiment: 'negative',
      description: '', isBidirectional: false, startChapterId: null, createdAt: Date.now(), updatedAt: Date.now(),
    })
    await deleteCharacter(char.id)
    expect(await db.relationships.count()).toBe(0)
  })

  it('does not delete relationships between other characters', async () => {
    const char = await createCharacter({ worldId: 'w', name: 'C', description: '' })
    await db.relationships.add({
      id: 'rel-unrelated', worldId: 'w', characterAId: 'other-1', characterBId: 'other-2',
      label: 'Rival', strength: 'weak', sentiment: 'neutral',
      description: '', isBidirectional: false, startChapterId: null, createdAt: Date.now(), updatedAt: Date.now(),
    })
    await deleteCharacter(char.id)
    expect(await db.relationships.count()).toBe(1)
  })
})
