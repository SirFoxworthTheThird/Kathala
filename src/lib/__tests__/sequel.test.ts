import { describe, it, expect } from 'vitest'
import { planSequel, type SequelSource, type SequelSelection } from '@/lib/sequel'
import type {
  World, Character, Item, Faction, FactionMembership, Relationship, RelationshipSnapshot,
  CharacterSnapshot, MapLayer, LocationMarker, Chapter, WorldEvent, LoreCategory, LorePage,
} from '@/types'

const NOW = 1_700_000_000_000

function world(): World {
  return { id: 'w1', name: 'Book One', description: 'A saga.', coverImageId: null, theme: 'fantasy', continuityStaleThreshold: 5, createdAt: 0, updatedAt: 0 }
}
function char(id: string, name: string, isAlive = true, portrait: string | null = null): Character {
  return { id, worldId: 'w1', name, aliases: [], description: `${name} desc`, portraitImageId: portrait, tags: [], isAlive, color: null, createdAt: 0, updatedAt: 0 }
}
function item(id: string, name: string, image: string | null = null): Item {
  return { id, worldId: 'w1', name, description: '', iconType: 'weapon', imageId: image, tags: [] }
}
function chapter(id: string, number: number, title: string, synopsis = ''): Chapter {
  return { id, worldId: 'w1', timelineId: 't1', number, title, synopsis, notes: '', wordGoal: null, createdAt: 0, updatedAt: 0 }
}
function event(id: string, chapterId: string, sortOrder: number, title: string): WorldEvent {
  return {
    id, worldId: 'w1', chapterId, timelineId: 't1', title, description: `${title} happens`,
    locationMarkerId: null, involvedCharacterIds: [], mentionedCharacterIds: [], threadIds: [], involvedItemIds: [], tags: [], sortOrder,
    travelDays: null, inWorldTime: null, tension: null, structureBeat: null, status: 'draft', povCharacterId: null, isFlashback: false, createdAt: 0, updatedAt: 0,
  }
}
function snap(characterId: string, eventId: string, over: Partial<CharacterSnapshot> = {}): CharacterSnapshot {
  return {
    id: `${characterId}-${eventId}`, worldId: 'w1', characterId, eventId, isAlive: true,
    currentLocationMarkerId: null, currentMapLayerId: null, inventoryItemIds: [], inventoryNotes: '',
    statusNotes: '', travelModeId: null, createdAt: 0, updatedAt: 0, ...over,
  }
}

function emptySource(over: Partial<SequelSource> = {}): SequelSource {
  return {
    world: world(), characters: [], items: [], factions: [], factionMemberships: [], factionRelationships: [],
    relationships: [], relationshipSnapshots: [], characterSnapshots: [], mapLayers: [], locationMarkers: [],
    mapRoutes: [], mapRegions: [], mapAnnotations: [], loreCategories: [], lorePages: [], travelModes: [],
    chapters: [], events: [], ...over,
  }
}

const NONE: SequelSelection = { characterIds: [], itemIds: [], factionIds: [], mapLayerIds: [] }

describe('planSequel', () => {
  it('creates a fresh world + Main Story timeline, carrying only selected characters', () => {
    const source = emptySource({ characters: [char('c1', 'Aria'), char('c2', 'Cael'), char('c3', 'Extra')] })
    const plan = planSequel(source, { ...NONE, characterIds: ['c1', 'c2'] }, { name: 'Book Two', now: NOW })

    expect(plan.world.id).not.toBe('w1')
    expect(plan.world.name).toBe('Book Two')
    expect(plan.world.theme).toBe('fantasy') // theme carries
    expect(plan.timelines).toHaveLength(1)
    expect(plan.characters.map((c) => c.name).sort()).toEqual(['Aria', 'Cael'])
    // ids are remapped, and scoped to the new world
    expect(plan.characters.every((c) => c.id !== 'c1' && c.worldId === plan.world.id)).toBe(true)
  })

  it('carries each character in with their ENDING alive status', () => {
    const source = emptySource({
      characters: [char('c1', 'Boromir', true)],
      chapters: [chapter('ch1', 1, 'A'), chapter('ch2', 2, 'B')],
      events: [event('e1', 'ch1', 0, 'start'), event('e2', 'ch2', 0, 'death')],
      characterSnapshots: [snap('c1', 'e1', { isAlive: true }), snap('c1', 'e2', { isAlive: false })],
    })
    const plan = planSequel(source, { ...NONE, characterIds: ['c1'] }, { name: 'B2', now: NOW })
    expect(plan.characters[0].isAlive).toBe(false)
  })

  it('continues relationships from their final snapshot state, between carried characters only', () => {
    const rel: Relationship = {
      id: 'r1', worldId: 'w1', characterAId: 'c1', characterBId: 'c2', label: 'strangers',
      strength: 'weak', sentiment: 'neutral', description: '', isBidirectional: true, startEventId: null, createdAt: 0, updatedAt: 0,
    }
    const relSnap: RelationshipSnapshot = {
      id: 'rs1', worldId: 'w1', relationshipId: 'r1', eventId: 'e2', label: 'sworn enemies',
      strength: 'bond', sentiment: 'negative', description: 'betrayal', isActive: true, createdAt: 0, updatedAt: 0,
    }
    const source = emptySource({
      characters: [char('c1', 'A'), char('c2', 'B'), char('c3', 'C')],
      relationships: [rel, { ...rel, id: 'r2', characterBId: 'c3' }], // r2 involves C (not carried)
      relationshipSnapshots: [relSnap],
      chapters: [chapter('ch1', 1, 'A')], events: [event('e2', 'ch1', 0, 'x')],
    })
    const plan = planSequel(source, { ...NONE, characterIds: ['c1', 'c2'] }, { name: 'B2', now: NOW })
    expect(plan.relationships).toHaveLength(1) // r2 dropped (C not carried)
    expect(plan.relationships[0]).toMatchObject({ label: 'sworn enemies', strength: 'bond', sentiment: 'negative' })
    expect(plan.relationships[0].startEventId).toBeNull()
  })

  it('carries factions with their carried members, dropping members that did not come over', () => {
    const faction: Faction = { id: 'f1', worldId: 'w1', name: 'The Order', description: '', color: '#fff', coverImageId: null, tags: [], createdAt: 0, updatedAt: 0 }
    const m = (id: string, cid: string): FactionMembership => ({ id, worldId: 'w1', factionId: 'f1', characterId: cid, role: 'Member', startEventId: 'e1', endEventId: null, notes: '', createdAt: 0, updatedAt: 0 })
    const source = emptySource({
      characters: [char('c1', 'A'), char('c2', 'B')],
      factions: [faction],
      factionMemberships: [m('m1', 'c1'), m('m2', 'c2')],
    })
    const plan = planSequel(source, { ...NONE, characterIds: ['c1'], factionIds: ['f1'] }, { name: 'B2', now: NOW })
    expect(plan.factions).toHaveLength(1)
    expect(plan.factionMemberships).toHaveLength(1) // only c1 carried
    expect(plan.factionMemberships[0].characterId).toBe(plan.characters[0].id)
    expect(plan.factionMemberships[0].startEventId).toBeNull() // old event refs cleared
  })

  it('carries a map: layer + markers, remapping ids and clearing links to dropped layers', () => {
    const layer: MapLayer = { id: 'l1', worldId: 'w1', parentMapId: null, name: 'World', description: '', imageId: 'blob-img', imageWidth: 100, imageHeight: 100, scalePixelsPerUnit: null, scaleUnit: null, levelGroupId: null, levelIndex: 0, levelLabel: '', createdAt: 0, updatedAt: 0 }
    const marker: LocationMarker = { id: 'mk1', worldId: 'w1', mapLayerId: 'l1', linkedMapLayerId: 'l2', name: 'City', description: '', x: 10, y: 20, imageId: null, iconType: 'city', tags: [], factionId: null, createdAt: 0, updatedAt: 0 }
    const source = emptySource({ mapLayers: [layer], locationMarkers: [marker] })
    const plan = planSequel(source, { ...NONE, mapLayerIds: ['l1'] }, { name: 'B2', now: NOW })
    expect(plan.mapLayers).toHaveLength(1)
    expect(plan.mapLayers[0].id).not.toBe('l1')
    expect(plan.locationMarkers).toHaveLength(1)
    expect(plan.locationMarkers[0].mapLayerId).toBe(plan.mapLayers[0].id)
    expect(plan.locationMarkers[0].linkedMapLayerId).toBeNull() // l2 not carried
    // the layer image blob is scheduled for copy
    expect(plan.blobCopies.some((b) => b.from === 'blob-img')).toBe(true)
  })

  it('turns book 1 chapters into a "Previously" lore category when asked', () => {
    const source = emptySource({
      loreCategories: [{ id: 'lc1', worldId: 'w1', name: 'Magic', color: null, sortOrder: 0 } as LoreCategory],
      lorePages: [{ id: 'lp1', worldId: 'w1', categoryId: 'lc1', title: 'Spells', body: 'How magic works', tags: [], coverImageId: null, linkedEntityIds: [], visibleFromEventId: null, createdAt: 0, updatedAt: 0 } as LorePage],
      chapters: [chapter('ch1', 1, 'The Call', 'A hero is summoned.'), chapter('ch2', 2, 'The Road')],
      events: [event('e1', 'ch1', 0, 'Summons')],
    })
    const plan = planSequel(source, NONE, { name: 'B2', convertStoryToLore: true, now: NOW })
    // world-building lore carried
    expect(plan.loreCategories.some((c) => c.name === 'Magic')).toBe(true)
    expect(plan.lorePages.some((p) => p.title === 'Spells')).toBe(true)
    // recap category + one page per chapter
    const recap = plan.loreCategories.find((c) => c.name.startsWith('Previously'))
    expect(recap).toBeDefined()
    const recapPages = plan.lorePages.filter((p) => p.categoryId === recap!.id)
    expect(recapPages.map((p) => p.title)).toEqual(['Ch. 1 — The Call', 'Ch. 2 — The Road'])
    expect(recapPages[0].body).toContain('A hero is summoned.')
    expect(recapPages[0].body).toContain('Summons')
  })

  it('seeds an opening chapter with each carried character at their ending state', () => {
    const layer: MapLayer = { id: 'l1', worldId: 'w1', parentMapId: null, name: 'World', description: '', imageId: 'img', imageWidth: 1, imageHeight: 1, scalePixelsPerUnit: null, scaleUnit: null, levelGroupId: null, levelIndex: 0, levelLabel: '', createdAt: 0, updatedAt: 0 }
    const marker: LocationMarker = { id: 'mk1', worldId: 'w1', mapLayerId: 'l1', linkedMapLayerId: null, name: 'Keep', description: '', x: 0, y: 0, imageId: null, iconType: 'city', tags: [], factionId: null, createdAt: 0, updatedAt: 0 }
    const source = emptySource({
      characters: [char('c1', 'Aria')],
      items: [item('i1', 'Sword')],
      mapLayers: [layer], locationMarkers: [marker],
      chapters: [chapter('ch1', 1, 'A')],
      events: [event('e1', 'ch1', 0, 'end')],
      characterSnapshots: [snap('c1', 'e1', { currentLocationMarkerId: 'mk1', currentMapLayerId: 'l1', inventoryItemIds: ['i1'], statusNotes: 'Weary but alive.' })],
    })
    const plan = planSequel(source, { characterIds: ['c1'], itemIds: ['i1'], factionIds: [], mapLayerIds: ['l1'] }, { name: 'B2', seedOpeningChapter: true, now: NOW })
    expect(plan.chapters).toHaveLength(1)
    expect(plan.events).toHaveLength(1)
    expect(plan.characterSnapshots).toHaveLength(1)
    const s = plan.characterSnapshots[0]
    expect(s.currentLocationMarkerId).toBe(plan.locationMarkers[0].id)
    expect(s.inventoryItemIds).toEqual([plan.items[0].id])
    expect(s.statusNotes).toBe('Weary but alive.')
  })

  it('produces no chapters/snapshots when opening seed is off', () => {
    const source = emptySource({ characters: [char('c1', 'A')] })
    const plan = planSequel(source, { ...NONE, characterIds: ['c1'] }, { name: 'B2', now: NOW })
    expect(plan.chapters).toHaveLength(0)
    expect(plan.characterSnapshots).toHaveLength(0)
  })
})
