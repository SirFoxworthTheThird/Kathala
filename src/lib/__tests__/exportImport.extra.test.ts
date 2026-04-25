import 'fake-indexeddb/auto'
import { describe, it, expect } from 'vitest'
import { importWorld, type WorldExportFile } from '@/lib/exportImport'
import { db } from '@/db/database'

// ── helpers ───────────────────────────────────────────────────────────────────

function makeExport(overrides: Partial<WorldExportFile> = {}): WorldExportFile {
  return {
    version: 2,
    exportedAt: Date.now(),
    world: { id: 'world-extra', name: 'Extra World', description: '', coverImageId: null, theme: null, createdAt: 1000, updatedAt: 1000 },
    mapLayers: [],
    locationMarkers: [],
    characters: [],
    items: [],
    characterSnapshots: [],
    characterMovements: [],
    itemPlacements: [],
    locationSnapshots: [],
    itemSnapshots: [],
    relationships: [],
    relationshipSnapshots: [],
    timelines: [],
    chapters: [],
    events: [],
    blobs: [],
    travelModes: [],
    timelineRelationships: [],
    crossTimelineArtifacts: [],
    mapRoutes: [],
    mapRegions: [],
    mapRegionSnapshots: [],
    mapAnnotations: [],
    loreCategories: [],
    lorePages: [],
    factions: [],
    factionMemberships: [],
    factionRelationships: [],
    ...overrides,
  }
}

function makeFile(data: unknown): File {
  return new File([JSON.stringify(data)], 'export.pwk', { type: 'application/json' })
}

// ── normalizeImport backfill paths ────────────────────────────────────────────

describe('importWorld — normalizeImport backfills', () => {
  it('defaults itemPlacements to [] when absent', async () => {
    await db.delete()
    await db.open()

    const { itemPlacements: _ip, ...without } = makeExport()
    const worldId = await importWorld(makeFile(without))
    expect(worldId).toBe('world-extra')

    const placements = await db.itemPlacements.where('worldId').equals('world-extra').toArray()
    expect(placements).toHaveLength(0)
  })

  it('defaults relationshipSnapshots to [] when absent', async () => {
    await db.delete()
    await db.open()

    const { relationshipSnapshots: _rs, ...without } = makeExport()
    const worldId = await importWorld(makeFile(without))
    expect(worldId).toBe('world-extra')
  })

  it('defaults locationSnapshots to [] when absent', async () => {
    await db.delete()
    await db.open()

    const { locationSnapshots: _ls, ...without } = makeExport()
    const worldId = await importWorld(makeFile(without))
    expect(worldId).toBe('world-extra')

    const snaps = await db.locationSnapshots.where('worldId').equals('world-extra').toArray()
    expect(snaps).toHaveLength(0)
  })

  it('defaults itemSnapshots to [] when absent', async () => {
    await db.delete()
    await db.open()

    const { itemSnapshots: _is, ...without } = makeExport()
    const worldId = await importWorld(makeFile(without))
    expect(worldId).toBe('world-extra')

    const snaps = await db.itemSnapshots.where('worldId').equals('world-extra').toArray()
    expect(snaps).toHaveLength(0)
  })

  it('backfills startEventId to null on v1 relationships that lack startChapterId', async () => {
    await db.delete()
    await db.open()

    const data = makeExport({
      version: 1,
      relationships: [{
        id: 'rel-old',
        worldId: 'world-extra',
        characterAId: 'c1',
        characterBId: 'c2',
        label: 'Old bond',
        strength: 'strong',
        sentiment: 'positive',
        description: '',
        isBidirectional: true,
        createdAt: 1000,
        updatedAt: 1000,
        // deliberately omit startChapterId — simulates pre-feature export
      } as never],
    })
    await importWorld(makeFile(data))

    const stored = await db.relationships.get('rel-old')
    expect(stored).toBeDefined()
    // v1 migration: startChapterId (absent) → startEventId: null
    expect((stored as unknown as Record<string, unknown>).startEventId).toBeNull()
  })

  it('backfills startEventId to null on v2 relationships that lack it', async () => {
    await db.delete()
    await db.open()

    const data = makeExport({
      relationships: [{
        id: 'rel-v2',
        worldId: 'world-extra',
        characterAId: 'c1',
        characterBId: 'c2',
        label: 'Bond',
        strength: 'strong',
        sentiment: 'positive',
        description: '',
        isBidirectional: true,
        createdAt: 1000,
        updatedAt: 1000,
        // deliberately omit startEventId — simulates early v2 export
      } as never],
    })
    await importWorld(makeFile(data))

    const stored = await db.relationships.get('rel-v2')
    expect(stored).toBeDefined()
    expect((stored as unknown as Record<string, unknown>).startEventId).toBeNull()
  })

  it('backfills scalePixelsPerUnit and scaleUnit on old map layers', async () => {
    await db.delete()
    await db.open()

    const data = makeExport({
      mapLayers: [{
        id: 'layer-old',
        worldId: 'world-extra',
        parentMapId: null,
        name: 'Old Layer',
        description: '',
        imageId: 'img-1',
        imageWidth: 800,
        imageHeight: 600,
        createdAt: 1000,
        updatedAt: 1000,
        // deliberately omit scalePixelsPerUnit and scaleUnit
      } as never],
    })
    await importWorld(makeFile(data))

    const stored = await db.mapLayers.get('layer-old')
    expect(stored).toBeDefined()
    expect((stored as unknown as Record<string, unknown>).scalePixelsPerUnit).toBeNull()
    expect((stored as unknown as Record<string, unknown>).scaleUnit).toBeNull()
  })

  it('backfills synopsis on chapters that lack it', async () => {
    await db.delete()
    await db.open()

    const data = makeExport({
      chapters: [{
        id: 'ch-old',
        worldId: 'world-extra',
        timelineId: 'tl-1',
        number: 1,
        title: 'Old Chapter',
        // deliberately omit synopsis — simulates pre-feature export
        createdAt: 1000,
        updatedAt: 1000,
      } as never],
    })
    await importWorld(makeFile(data))

    const stored = await db.chapters.get('ch-old')
    expect(stored).toBeDefined()
    expect(stored!.synopsis).toBe('')
  })

  it('backfills notes on chapters that lack it', async () => {
    await db.delete()
    await db.open()

    const data = makeExport({
      chapters: [{
        id: 'ch-notes',
        worldId: 'world-extra',
        timelineId: 'tl-1',
        number: 1,
        title: 'Old Chapter',
        synopsis: '',
        // deliberately omit notes — simulates pre-feature export
        createdAt: 1000,
        updatedAt: 1000,
      } as never],
    })
    await importWorld(makeFile(data))

    const stored = await db.chapters.get('ch-notes')
    expect(stored).toBeDefined()
    expect(stored!.notes).toBe('')
  })

  it('preserves existing notes when already set', async () => {
    await db.delete()
    await db.open()

    const data = makeExport({
      chapters: [{
        id: 'ch-withnotes',
        worldId: 'world-extra',
        timelineId: 'tl-1',
        number: 1,
        title: 'Chapter with Notes',
        synopsis: '',
        notes: 'Remember to foreshadow the betrayal here.',
        createdAt: 1000,
        updatedAt: 1000,
      }],
    })
    await importWorld(makeFile(data))

    const stored = await db.chapters.get('ch-withnotes')
    expect(stored!.notes).toBe('Remember to foreshadow the betrayal here.')
  })

  it('preserves existing synopsis when it is already set', async () => {
    await db.delete()
    await db.open()

    const data = makeExport({
      chapters: [{
        id: 'ch-new',
        worldId: 'world-extra',
        timelineId: 'tl-1',
        number: 1,
        title: 'New Chapter',
        synopsis: 'The hero sets off.',
        notes: '',
        createdAt: 1000,
        updatedAt: 1000,
      }],
    })
    await importWorld(makeFile(data))

    const stored = await db.chapters.get('ch-new')
    expect(stored!.synopsis).toBe('The hero sets off.')
  })

  it('rejects when itemPlacements is present but not an array', async () => {
    const bad = { ...makeExport(), itemPlacements: 'bad' }
    await expect(importWorld(makeFile(bad))).rejects.toThrow('itemPlacements is not an array')
  })

  it('rejects when relationshipSnapshots is present but not an array', async () => {
    const bad = { ...makeExport(), relationshipSnapshots: 'bad' }
    await expect(importWorld(makeFile(bad))).rejects.toThrow('relationshipSnapshots is not an array')
  })

  it('rejects when locationSnapshots is present but not an array', async () => {
    const bad = { ...makeExport(), locationSnapshots: 'bad' }
    await expect(importWorld(makeFile(bad))).rejects.toThrow('locationSnapshots is not an array')
  })

  it('rejects when itemSnapshots is present but not an array', async () => {
    const bad = { ...makeExport(), itemSnapshots: 'bad' }
    await expect(importWorld(makeFile(bad))).rejects.toThrow('itemSnapshots is not an array')
  })
})

// ── relationshipPositions persisted in localStorage ───────────────────────────

describe('importWorld — relationshipPositions', () => {
  it('stores relationshipPositions in localStorage when present', async () => {
    await db.delete()
    await db.open()

    const positions = { 'rel-1': { x: 100, y: 200 }, 'rel-2': { x: 300, y: 400 } }
    const data = makeExport({ relationshipPositions: positions })
    await importWorld(makeFile(data))

    const stored = localStorage.getItem('wb-rel-pos-world-extra')
    expect(stored).not.toBeNull()
    expect(JSON.parse(stored!)).toEqual(positions)
  })

  it('does not write to localStorage when relationshipPositions is absent', async () => {
    await db.delete()
    await db.open()
    localStorage.removeItem('wb-rel-pos-world-extra')

    await importWorld(makeFile(makeExport()))
    expect(localStorage.getItem('wb-rel-pos-world-extra')).toBeNull()
  })
})

// ── characterMovements round-trip ─────────────────────────────────────────────

describe('importWorld — characterMovements', () => {
  it('imports characterMovements and preserves waypoints', async () => {
    await db.delete()
    await db.open()

    const data = makeExport({
      characterMovements: [{
        id: 'mov-1',
        worldId: 'world-extra',
        characterId: 'char-1',
        eventId: 'ev-1',
        waypoints: ['loc-a', 'loc-b', 'loc-c'],
        travelModeId: null,
        notes: '',
        createdAt: 1000,
        updatedAt: 1000,
      }],
    })
    await importWorld(makeFile(data))

    const stored = await db.characterMovements.get('mov-1')
    expect(stored).toBeDefined()
    expect(stored!.waypoints).toEqual(['loc-a', 'loc-b', 'loc-c'])
    expect(stored!.characterId).toBe('char-1')
    expect(stored!.eventId).toBe('ev-1')
  })

  it('imports multiple movements for different characters and events', async () => {
    await db.delete()
    await db.open()

    const data = makeExport({
      characterMovements: [
        { id: 'mov-1', worldId: 'world-extra', characterId: 'char-1', eventId: 'ev-1', waypoints: ['loc-a', 'loc-b'], travelModeId: null, notes: '', createdAt: 1000, updatedAt: 1000 },
        { id: 'mov-2', worldId: 'world-extra', characterId: 'char-2', eventId: 'ev-1', waypoints: ['loc-c'], travelModeId: null, notes: '', createdAt: 1000, updatedAt: 1000 },
        { id: 'mov-3', worldId: 'world-extra', characterId: 'char-1', eventId: 'ev-2', waypoints: ['loc-d', 'loc-e', 'loc-f'], travelModeId: null, notes: '', createdAt: 1000, updatedAt: 1000 },
      ],
    })
    await importWorld(makeFile(data))

    const all = await db.characterMovements.where('worldId').equals('world-extra').toArray()
    expect(all).toHaveLength(3)

    const mov3 = await db.characterMovements.get('mov-3')
    expect(mov3!.waypoints).toEqual(['loc-d', 'loc-e', 'loc-f'])
  })
})

// ── travelModes round-trip ────────────────────────────────────────────────────

describe('importWorld — travelModes', () => {
  it('imports travel modes and preserves all fields', async () => {
    await db.delete()
    await db.open()

    const data = makeExport({
      travelModes: [{
        id: 'tm-1',
        worldId: 'world-extra',
        name: 'Walking',
        speedPerDay: 30,
        createdAt: 1000,
        updatedAt: 1000,
      }],
    })
    await importWorld(makeFile(data))

    const stored = await db.travelModes.get('tm-1')
    expect(stored).toBeDefined()
    expect(stored!.name).toBe('Walking')
    expect(stored!.speedPerDay).toBe(30)
    expect(stored!.worldId).toBe('world-extra')
  })

  it('defaults travelModes to [] when absent from export', async () => {
    await db.delete()
    await db.open()

    const { travelModes: _tm, ...without } = makeExport()
    await importWorld(makeFile(without))

    const modes = await db.travelModes.where('worldId').equals('world-extra').toArray()
    expect(modes).toHaveLength(0)
  })

  it('rejects when travelModes is present but not an array', async () => {
    const bad = { ...makeExport(), travelModes: 'bad' }
    await expect(importWorld(makeFile(bad))).rejects.toThrow('travelModes is not an array')
  })

  it('backfills travelDays to null on events that lack it', async () => {
    await db.delete()
    await db.open()

    const data = makeExport({
      events: [{
        id: 'ev-travel',
        worldId: 'world-extra',
        chapterId: 'ch-1',
        timelineId: 'tl-1',
        title: 'Old Event',
        description: '',
        locationMarkerId: null,
        involvedCharacterIds: [],
        involvedItemIds: [],
        tags: [],
        sortOrder: 0,
        // deliberately omit travelDays — simulates pre-feature export
        createdAt: 1000,
        updatedAt: 1000,
      } as never],
    })
    await importWorld(makeFile(data))

    const stored = await db.events.get('ev-travel')
    expect(stored).toBeDefined()
    expect((stored as unknown as Record<string, unknown>).travelDays).toBeNull()
  })

  it('preserves travelDays when already set on an event', async () => {
    await db.delete()
    await db.open()

    const data = makeExport({
      events: [{
        id: 'ev-days',
        worldId: 'world-extra',
        chapterId: 'ch-1',
        timelineId: 'tl-1',
        title: 'Journey Event',
        description: '',
        locationMarkerId: null,
        involvedCharacterIds: [],
        involvedItemIds: [],
        tags: [],
        sortOrder: 0,
        travelDays: 7,
        createdAt: 1000,
        updatedAt: 1000,
      }],
    })
    await importWorld(makeFile(data))

    const stored = await db.events.get('ev-days')
    expect(stored!.travelDays).toBe(7)
  })

  it('backfills travelModeId to null on snapshots that lack it', async () => {
    await db.delete()
    await db.open()

    const data = makeExport({
      characterSnapshots: [{
        id: 'snap-1',
        worldId: 'world-extra',
        characterId: 'char-1',
        eventId: 'ev-1',
        isAlive: true,
        currentLocationMarkerId: null,
        currentMapLayerId: null,
        inventoryItemIds: [],
        inventoryNotes: '',
        statusNotes: '',
        // deliberately omit travelModeId — simulates pre-feature export
        createdAt: 1000,
        updatedAt: 1000,
      } as never],
    })
    await importWorld(makeFile(data))

    const stored = await db.characterSnapshots.get('snap-1')
    expect(stored).toBeDefined()
    expect((stored as unknown as Record<string, unknown>).travelModeId).toBeNull()
  })

  it('preserves travelModeId when already set', async () => {
    await db.delete()
    await db.open()

    const data = makeExport({
      travelModes: [{
        id: 'tm-horse',
        worldId: 'world-extra',
        name: 'Horse',
        speedPerDay: 60,
        createdAt: 1000,
        updatedAt: 1000,
      }],
      characterSnapshots: [{
        id: 'snap-2',
        worldId: 'world-extra',
        characterId: 'char-2',
        eventId: 'ev-2',
        isAlive: true,
        currentLocationMarkerId: null,
        currentMapLayerId: null,
        inventoryItemIds: [],
        inventoryNotes: '',
        statusNotes: '',
        travelModeId: 'tm-horse',
        createdAt: 1000,
        updatedAt: 1000,
      }],
    })
    await importWorld(makeFile(data))

    const stored = await db.characterSnapshots.get('snap-2')
    expect(stored!.travelModeId).toBe('tm-horse')
  })
})

// ── v1 → v2 migration ────────────────────────────────────────────────────────

describe('importWorld — v1 → v2 migration', () => {
  it('remaps snapshot chapterId to eventId using first event in that chapter', async () => {
    await db.delete()
    await db.open()

    const data = makeExport({
      version: 1,
      chapters: [{ id: 'ch-1', worldId: 'world-extra', timelineId: 'tl-1', number: 1, title: 'Ch1', synopsis: '', notes: '', createdAt: 1000, updatedAt: 1000 }],
      events: [
        { id: 'ev-b', worldId: 'world-extra', chapterId: 'ch-1', timelineId: 'tl-1', title: 'B', description: '', locationMarkerId: null, involvedCharacterIds: [], involvedItemIds: [], tags: [], sortOrder: 10, travelDays: null, createdAt: 1000, updatedAt: 1000 },
        { id: 'ev-a', worldId: 'world-extra', chapterId: 'ch-1', timelineId: 'tl-1', title: 'A', description: '', locationMarkerId: null, involvedCharacterIds: [], involvedItemIds: [], tags: [], sortOrder: 0, travelDays: null, createdAt: 1000, updatedAt: 1000 },
      ],
      characterSnapshots: [{
        id: 'snap-v1',
        worldId: 'world-extra',
        characterId: 'char-1',
        chapterId: 'ch-1', // v1 format
        isAlive: true,
        currentLocationMarkerId: null,
        currentMapLayerId: null,
        inventoryItemIds: [],
        inventoryNotes: '',
        statusNotes: '',
        travelModeId: null,
        createdAt: 1000,
        updatedAt: 1000,
      } as never],
    })
    await importWorld(makeFile(data))

    const stored = await db.characterSnapshots.get('snap-v1')
    expect(stored).toBeDefined()
    // should be mapped to first event (sortOrder 0 = ev-a)
    expect(stored!.eventId).toBe('ev-a')
    expect((stored as unknown as Record<string, unknown>).chapterId).toBeUndefined()
  })

  it('creates synthetic event for v1 chapters with no events', async () => {
    await db.delete()
    await db.open()

    const data = makeExport({
      version: 1,
      chapters: [{ id: 'ch-noev', worldId: 'world-extra', timelineId: 'tl-1', number: 1, title: 'Ch No Ev', synopsis: '', notes: '', createdAt: 1000, updatedAt: 1000 }],
      events: [], // no events for this chapter
      characterSnapshots: [{
        id: 'snap-noev',
        worldId: 'world-extra',
        characterId: 'char-1',
        chapterId: 'ch-noev',
        isAlive: true,
        currentLocationMarkerId: null,
        currentMapLayerId: null,
        inventoryItemIds: [],
        inventoryNotes: '',
        statusNotes: '',
        travelModeId: null,
        createdAt: 1000,
        updatedAt: 1000,
      } as never],
    })
    await importWorld(makeFile(data))

    // A synthetic event should have been created for ch-noev
    const events = await db.events.where('worldId').equals('world-extra').toArray()
    expect(events).toHaveLength(1)
    expect(events[0].chapterId).toBe('ch-noev')

    // The snapshot should be keyed to that synthetic event
    const stored = await db.characterSnapshots.get('snap-noev')
    expect(stored!.eventId).toBe(events[0].id)
  })

  it('remaps startChapterId to startEventId on v1 relationships', async () => {
    await db.delete()
    await db.open()

    const data = makeExport({
      version: 1,
      chapters: [{ id: 'ch-rel', worldId: 'world-extra', timelineId: 'tl-1', number: 1, title: 'Ch', synopsis: '', notes: '', createdAt: 1000, updatedAt: 1000 }],
      events: [{ id: 'ev-rel', worldId: 'world-extra', chapterId: 'ch-rel', timelineId: 'tl-1', title: 'Ev', description: '', locationMarkerId: null, involvedCharacterIds: [], involvedItemIds: [], tags: [], sortOrder: 0, travelDays: null, createdAt: 1000, updatedAt: 1000 }],
      relationships: [{
        id: 'rel-v1',
        worldId: 'world-extra',
        characterAId: 'c1',
        characterBId: 'c2',
        label: 'Friends',
        strength: 'strong',
        sentiment: 'positive',
        description: '',
        isBidirectional: true,
        startChapterId: 'ch-rel', // v1 format
        createdAt: 1000,
        updatedAt: 1000,
      } as never],
    })
    await importWorld(makeFile(data))

    const stored = await db.relationships.get('rel-v1')
    expect(stored).toBeDefined()
    expect((stored as unknown as Record<string, unknown>).startEventId).toBe('ev-rel')
    expect((stored as unknown as Record<string, unknown>).startChapterId).toBeUndefined()
  })

  it('sets startEventId to null when v1 startChapterId was null', async () => {
    await db.delete()
    await db.open()

    const data = makeExport({
      version: 1,
      relationships: [{
        id: 'rel-null',
        worldId: 'world-extra',
        characterAId: 'c1',
        characterBId: 'c2',
        label: 'Neutral',
        strength: 'weak',
        sentiment: 'neutral',
        description: '',
        isBidirectional: false,
        startChapterId: null,
        createdAt: 1000,
        updatedAt: 1000,
      } as never],
    })
    await importWorld(makeFile(data))

    const stored = await db.relationships.get('rel-null')
    expect((stored as unknown as Record<string, unknown>).startEventId).toBeNull()
  })
})

// ── full round-trip with all optional arrays populated ────────────────────────

describe('importWorld — full optional arrays', () => {
  it('imports relationships, timelines, chapters, and events correctly', async () => {
    await db.delete()
    await db.open()

    const data = makeExport({
      timelines: [{
        id: 'tl-1', worldId: 'world-extra', name: 'Main', description: '', color: '#f00', createdAt: 1000,
      }],
      chapters: [{
        id: 'ch-1', worldId: 'world-extra', timelineId: 'tl-1', number: 1,
        title: 'Chapter One', synopsis: '', notes: '', createdAt: 1000, updatedAt: 1000,
      }],
      events: [{
        id: 'ev-1', worldId: 'world-extra', chapterId: 'ch-1', timelineId: 'tl-1',
        title: 'Battle Begins', description: '', locationMarkerId: null,
        involvedCharacterIds: [], involvedItemIds: [], tags: [], sortOrder: 0,
        travelDays: null, createdAt: 1000, updatedAt: 1000,
      }],
    })

    await importWorld(makeFile(data))

    const tl = await db.timelines.get('tl-1')
    expect(tl!.name).toBe('Main')

    const ch = await db.chapters.get('ch-1')
    expect(ch!.title).toBe('Chapter One')

    const ev = await db.events.get('ev-1')
    expect(ev!.title).toBe('Battle Begins')
  })
})
