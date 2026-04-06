import 'fake-indexeddb/auto'
import { describe, it, expect } from 'vitest'
import { importWorld, type WorldExportFile } from '@/lib/exportImport'
import { db } from '@/db/database'

// ── helpers ───────────────────────────────────────────────────────────────────

function makeExport(overrides: Partial<WorldExportFile> = {}): WorldExportFile {
  return {
    version: 1,
    exportedAt: Date.now(),
    world: { id: 'world-extra', name: 'Extra World', description: '', coverImageId: null, createdAt: 1000, updatedAt: 1000 },
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

  it('backfills startChapterId on relationships that lack it', async () => {
    await db.delete()
    await db.open()

    const data = makeExport({
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
    // normalizeImport should have backfilled startChapterId to null
    expect((stored as unknown as Record<string, unknown>).startChapterId).toBeNull()
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
        travelDays: null,
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
        travelDays: null,
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
        chapterId: 'ch-1',
        waypoints: ['loc-a', 'loc-b', 'loc-c'],
        createdAt: 1000,
        updatedAt: 1000,
      }],
    })
    await importWorld(makeFile(data))

    const stored = await db.characterMovements.get('mov-1')
    expect(stored).toBeDefined()
    expect(stored!.waypoints).toEqual(['loc-a', 'loc-b', 'loc-c'])
    expect(stored!.characterId).toBe('char-1')
    expect(stored!.chapterId).toBe('ch-1')
  })

  it('imports multiple movements for different characters and chapters', async () => {
    await db.delete()
    await db.open()

    const data = makeExport({
      characterMovements: [
        { id: 'mov-1', worldId: 'world-extra', characterId: 'char-1', chapterId: 'ch-1', waypoints: ['loc-a', 'loc-b'], createdAt: 1000, updatedAt: 1000 },
        { id: 'mov-2', worldId: 'world-extra', characterId: 'char-2', chapterId: 'ch-1', waypoints: ['loc-c'], createdAt: 1000, updatedAt: 1000 },
        { id: 'mov-3', worldId: 'world-extra', characterId: 'char-1', chapterId: 'ch-2', waypoints: ['loc-d', 'loc-e', 'loc-f'], createdAt: 1000, updatedAt: 1000 },
      ],
    })
    await importWorld(makeFile(data))

    const all = await db.characterMovements.where('worldId').equals('world-extra').toArray()
    expect(all).toHaveLength(3)

    const mov3 = await db.characterMovements.get('mov-3')
    expect(mov3!.waypoints).toEqual(['loc-d', 'loc-e', 'loc-f'])
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
        title: 'Chapter One', synopsis: '', notes: '', travelDays: null, createdAt: 1000, updatedAt: 1000,
      }],
      events: [{
        id: 'ev-1', worldId: 'world-extra', chapterId: 'ch-1', timelineId: 'tl-1',
        title: 'Battle Begins', description: '', locationMarkerId: null,
        involvedCharacterIds: [], involvedItemIds: [], tags: [], sortOrder: 0,
        createdAt: 1000, updatedAt: 1000,
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
