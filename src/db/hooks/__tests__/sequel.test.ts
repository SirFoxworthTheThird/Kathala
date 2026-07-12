import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '@/db/database'
import { createSequelWorld } from '@/db/hooks/useSequel'

const SRC = 'src-world'

beforeEach(async () => {
  await db.delete()
  await db.open()
  const t = 0
  await db.worlds.put({ id: SRC, name: 'Book One', description: 'saga', coverImageId: null, theme: 'scifi', continuityStaleThreshold: 5, createdAt: t, updatedAt: t })
  await db.characters.bulkPut([
    { id: 'c1', worldId: SRC, name: 'Aria', aliases: [], description: 'lead', portraitImageId: 'blob1', tags: [], isAlive: true, color: null, createdAt: t, updatedAt: t },
    { id: 'c2', worldId: SRC, name: 'Cael', aliases: [], description: 'rival', portraitImageId: null, tags: [], isAlive: true, color: null, createdAt: t, updatedAt: t },
  ])
  await db.blobs.put({ id: 'blob1', worldId: SRC, mimeType: 'image/png', data: new Blob(['portrait'], { type: 'image/png' }), createdAt: t })
  await db.timelines.put({ id: 'tl1', worldId: SRC, name: 'Main', description: '', color: '#000', createdAt: t })
  await db.chapters.put({ id: 'ch1', worldId: SRC, timelineId: 'tl1', number: 1, title: 'The End', synopsis: 'Finale.', notes: '', wordGoal: null, createdAt: t, updatedAt: t })
  await db.events.put({ id: 'e1', worldId: SRC, chapterId: 'ch1', timelineId: 'tl1', title: 'Last stand', description: 'They fight.', locationMarkerId: null, involvedCharacterIds: ['c1', 'c2'], mentionedCharacterIds: [], threadIds: [], involvedItemIds: [], tags: [], sortOrder: 0, travelDays: null, inWorldTime: null, tension: null, structureBeat: null, status: 'draft', povCharacterId: null, isFlashback: false, createdAt: t, updatedAt: t })
  await db.characterSnapshots.bulkPut([
    { id: 's1', worldId: SRC, characterId: 'c1', eventId: 'e1', isAlive: true, currentLocationMarkerId: null, currentMapLayerId: null, inventoryItemIds: [], inventoryNotes: '', statusNotes: 'Victorious.', travelModeId: null, createdAt: t, updatedAt: t },
    { id: 's2', worldId: SRC, characterId: 'c2', eventId: 'e1', isAlive: false, currentLocationMarkerId: null, currentMapLayerId: null, inventoryItemIds: [], inventoryNotes: '', statusNotes: 'Fallen.', travelModeId: null, createdAt: t, updatedAt: t },
  ])
  await db.relationships.put({ id: 'r1', worldId: SRC, characterAId: 'c1', characterBId: 'c2', label: 'allies', strength: 'moderate', sentiment: 'positive', description: '', isBidirectional: true, startEventId: null, createdAt: t, updatedAt: t })
  await db.relationshipSnapshots.put({ id: 'rs1', worldId: SRC, relationshipId: 'r1', eventId: 'e1', label: 'enemies', strength: 'bond', sentiment: 'negative', description: 'betrayed', isActive: true, createdAt: t, updatedAt: t })
})

describe('createSequelWorld', () => {
  it('forks selected entities into a new world and copies blobs', async () => {
    const newId = await createSequelWorld(
      SRC,
      { characterIds: ['c1', 'c2'], itemIds: [], factionIds: [], mapLayerIds: [] },
      { name: 'Book Two', seedOpeningChapter: true, convertStoryToLore: true },
    )

    expect(newId).not.toBe(SRC)
    const world = await db.worlds.get(newId)
    expect(world?.name).toBe('Book Two')
    expect(world?.theme).toBe('scifi')

    // Characters carried with a fresh id and their ending alive status.
    const chars = await db.characters.where('worldId').equals(newId).toArray()
    expect(chars.map((c) => c.name).sort()).toEqual(['Aria', 'Cael'])
    const cael = chars.find((c) => c.name === 'Cael')!
    expect(cael.isAlive).toBe(false) // died in book 1

    // Portrait blob was copied with the character's new portraitImageId.
    const aria = chars.find((c) => c.name === 'Aria')!
    expect(aria.portraitImageId).toBeTruthy()
    expect(aria.portraitImageId).not.toBe('blob1')
    const copied = await db.blobs.get(aria.portraitImageId!)
    expect(copied?.worldId).toBe(newId)
    expect(copied?.mimeType).toBe('image/png')
    expect(copied?.data).toBeTruthy()

    // Relationship continues from its final (betrayed) state.
    const rels = await db.relationships.where('worldId').equals(newId).toArray()
    expect(rels).toHaveLength(1)
    expect(rels[0]).toMatchObject({ label: 'enemies', sentiment: 'negative', strength: 'bond' })

    // "Previously" recap lore page exists for the book-1 chapter.
    const pages = await db.lorePages.where('worldId').equals(newId).toArray()
    expect(pages.some((p) => p.title === 'Ch. 1 — The End')).toBe(true)

    // Opening chapter seeded with a snapshot per carried character.
    const chapters = await db.chapters.where('worldId').equals(newId).toArray()
    expect(chapters).toHaveLength(1)
    const snaps = await db.characterSnapshots.where('worldId').equals(newId).toArray()
    expect(snaps).toHaveLength(2)
    expect(snaps.find((s) => s.characterId === aria.id)?.statusNotes).toBe('Victorious.')

    // The source world is untouched.
    expect(await db.characters.where('worldId').equals(SRC).count()).toBe(2)
  })
})
