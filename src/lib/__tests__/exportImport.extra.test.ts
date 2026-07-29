import 'fake-indexeddb/auto'
import { describe, it, expect } from 'vitest'
import { importWorld, importWorldFromJson, serializeWorldForSync, type WorldExportFile } from '@/lib/exportImport'
import { createWorld, deleteWorld } from '@/db/hooks/useWorlds'
import { createCharacter, updateCharacter, deleteCharacter } from '@/db/hooks/useCharacters'
import { applyWorldImport } from '@/lib/exportImport'
import { addCharactersToWorld } from '@/lib/sectionImport'
import { db } from '@/db/database'

// ── helpers ───────────────────────────────────────────────────────────────────

function makeExport(overrides: Partial<WorldExportFile> = {}): WorldExportFile {
  return {
    version: 2,
    exportedAt: Date.now(),
    world: { id: 'world-extra', name: 'Extra World', description: '', coverImageId: null, theme: null, continuityStaleThreshold: 5, createdAt: 1000, updatedAt: 1000 },
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
        wordGoal: null,
        createdAt: 1000,
        updatedAt: 1000,
      }],
    })
    await importWorld(makeFile(data))

    const stored = await db.chapters.get('ch-withnotes')
    expect(stored!.notes).toBe('Remember to foreshadow the betrayal here.')
  })

  it('backfills wordGoal to null on chapters that lack it (pre-goals export)', async () => {
    await db.delete()
    await db.open()

    const data = makeExport({
      version: 16 as never, // pre-wordGoal export
      chapters: [{
        id: 'ch-nogoal',
        worldId: 'world-extra',
        timelineId: 'tl-1',
        number: 1,
        title: 'Old Chapter',
        synopsis: '',
        notes: '',
        // deliberately omit wordGoal — simulates a pre-goals export
        createdAt: 1000,
        updatedAt: 1000,
      } as never],
    })
    await importWorld(makeFile(data))

    const stored = await db.chapters.get('ch-nogoal')
    expect(stored).toBeDefined()
    expect((stored as unknown as Record<string, unknown>).wordGoal).toBeNull()
  })

  it('preserves an explicit wordGoal through export/import', async () => {
    await db.delete()
    await db.open()

    const data = makeExport({
      chapters: [{
        id: 'ch-goal',
        worldId: 'world-extra',
        timelineId: 'tl-1',
        number: 1,
        title: 'Chapter with a goal',
        synopsis: '',
        notes: '',
        wordGoal: 2500,
        createdAt: 1000,
        updatedAt: 1000,
      }],
    })
    await importWorld(makeFile(data))

    const stored = await db.chapters.get('ch-goal')
    expect(stored!.wordGoal).toBe(2500)
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
        wordGoal: null,
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
        mentionedCharacterIds: [], threadIds: [],
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
        mentionedCharacterIds: [], threadIds: [],
        involvedItemIds: [],
        tags: [],
        sortOrder: 0,
        travelDays: 7,
        inWorldTime: null,
        tension: null,
        structureBeat: null,
        status: 'draft' as const,
        povCharacterId: null,
        isFlashback: false,
        createdAt: 1000,
        updatedAt: 1000,
      }],
    })
    await importWorld(makeFile(data))

    const stored = await db.events.get('ev-days')
    expect(stored!.travelDays).toBe(7)
  })

  it('backfills tension to null on events from a pre-pacing export', async () => {
    await db.delete()
    await db.open()

    const data = makeExport({
      version: 11 as never, // pre-tension export
      events: [{
        id: 'ev-no-tension',
        worldId: 'world-extra',
        chapterId: 'ch-1',
        timelineId: 'tl-1',
        title: 'Pre-pacing Event',
        description: '',
        locationMarkerId: null,
        involvedCharacterIds: [],
        mentionedCharacterIds: [], threadIds: [],
        involvedItemIds: [],
        tags: [],
        sortOrder: 0,
        travelDays: null,
        inWorldTime: null,
        // deliberately omit tension — simulates a v11 export
        status: 'draft' as const,
        povCharacterId: null,
        isFlashback: false,
        createdAt: 1000,
        updatedAt: 1000,
      } as never],
    })
    await importWorld(makeFile(data))

    const stored = await db.events.get('ev-no-tension')
    expect(stored).toBeDefined()
    expect((stored as unknown as Record<string, unknown>).tension).toBeNull()
  })

  it('preserves an explicit tension rating through export/import', async () => {
    await db.delete()
    await db.open()

    const data = makeExport({
      events: [{
        id: 'ev-rated',
        worldId: 'world-extra',
        chapterId: 'ch-1',
        timelineId: 'tl-1',
        title: 'Climax',
        description: '',
        locationMarkerId: null,
        involvedCharacterIds: [],
        mentionedCharacterIds: [], threadIds: [],
        involvedItemIds: [],
        tags: [],
        sortOrder: 0,
        travelDays: null,
        inWorldTime: null,
        tension: 5,
        structureBeat: null,
        status: 'draft' as const,
        povCharacterId: null,
        isFlashback: false,
        createdAt: 1000,
        updatedAt: 1000,
      }],
    })
    await importWorld(makeFile(data))

    const stored = await db.events.get('ev-rated')
    expect(stored!.tension).toBe(5)
  })

  it('backfills structureBeat to null on events from a pre-beats export', async () => {
    await db.delete()
    await db.open()

    const data = makeExport({
      version: 12 as never, // pre-structureBeat export
      events: [{
        id: 'ev-no-beat',
        worldId: 'world-extra',
        chapterId: 'ch-1',
        timelineId: 'tl-1',
        title: 'Pre-beats Event',
        description: '',
        locationMarkerId: null,
        involvedCharacterIds: [],
        mentionedCharacterIds: [], threadIds: [],
        involvedItemIds: [],
        tags: [],
        sortOrder: 0,
        travelDays: null,
        inWorldTime: null,
        tension: null,
        // deliberately omit structureBeat — simulates a v12 export
        status: 'draft' as const,
        povCharacterId: null,
        isFlashback: false,
        createdAt: 1000,
        updatedAt: 1000,
      } as never],
    })
    await importWorld(makeFile(data))

    const stored = await db.events.get('ev-no-beat')
    expect(stored).toBeDefined()
    expect((stored as unknown as Record<string, unknown>).structureBeat).toBeNull()
  })

  it('preserves an explicit structureBeat through export/import', async () => {
    await db.delete()
    await db.open()

    const data = makeExport({
      events: [{
        id: 'ev-midpoint',
        worldId: 'world-extra',
        chapterId: 'ch-1',
        timelineId: 'tl-1',
        title: 'The Reversal',
        description: '',
        locationMarkerId: null,
        involvedCharacterIds: [],
        mentionedCharacterIds: [], threadIds: [],
        involvedItemIds: [],
        tags: [],
        sortOrder: 0,
        travelDays: null,
        inWorldTime: null,
        tension: 4,
        structureBeat: 'midpoint',
        status: 'draft' as const,
        povCharacterId: null,
        isFlashback: false,
        createdAt: 1000,
        updatedAt: 1000,
      }],
    })
    await importWorld(makeFile(data))

    const stored = await db.events.get('ev-midpoint')
    expect(stored!.structureBeat).toBe('midpoint')
  })

  it('round-trips scene texts through export/import', async () => {
    await db.delete()
    await db.open()

    const data = makeExport({
      sceneTexts: [
        { id: 'st-1', worldId: 'world-extra', eventId: 'ev-1', text: 'The storm broke at dawn.', wordCount: 5, createdAt: 1000, updatedAt: 1000 },
      ],
    })
    await importWorld(makeFile(data))

    const stored = await db.sceneTexts.get('st-1')
    expect(stored).toBeDefined()
    expect(stored!.text).toBe('The storm broke at dawn.')
    expect(stored!.wordCount).toBe(5)
    expect(stored!.eventId).toBe('ev-1')
  })

  it('defaults sceneTexts to [] on older exports that lack them', async () => {
    await db.delete()
    await db.open()

    // Base makeExport (v2) carries no sceneTexts — simulates a pre-feature file.
    await importWorld(makeFile(makeExport()))
    expect(await db.sceneTexts.count()).toBe(0)
  })

  it('rejects when sceneTexts is present but not an array', async () => {
    const bad = { ...makeExport(), sceneTexts: 'bad' }
    await expect(importWorld(makeFile(bad))).rejects.toThrow('sceneTexts is not an array')
  })

  it('backfills mentionedCharacterIds to [] on a pre-mentions export', async () => {
    await db.delete()
    await db.open()

    const data = makeExport({
      version: 14 as never, // pre-mentions export
      events: [{
        id: 'ev-no-mentions',
        worldId: 'world-extra',
        chapterId: 'ch-1',
        timelineId: 'tl-1',
        title: 'Pre-mentions Event',
        description: '',
        locationMarkerId: null,
        involvedCharacterIds: ['c1'],
        // deliberately omit mentionedCharacterIds — simulates a v14 export
        involvedItemIds: [],
        tags: [],
        sortOrder: 0,
        travelDays: null,
        inWorldTime: null,
        tension: null,
        structureBeat: null,
        status: 'draft' as const,
        povCharacterId: null,
        isFlashback: false,
        createdAt: 1000,
        updatedAt: 1000,
      } as never],
    })
    await importWorld(makeFile(data))

    const stored = await db.events.get('ev-no-mentions')
    expect(stored).toBeDefined()
    expect((stored as unknown as Record<string, unknown>).mentionedCharacterIds).toEqual([])
  })

  it('preserves explicit mentionedCharacterIds through export/import', async () => {
    await db.delete()
    await db.open()

    const data = makeExport({
      events: [{
        id: 'ev-mentions',
        worldId: 'world-extra',
        chapterId: 'ch-1',
        timelineId: 'tl-1',
        title: 'Council',
        description: '',
        locationMarkerId: null,
        involvedCharacterIds: ['c1'],
        mentionedCharacterIds: ['c2', 'c3'],
        threadIds: [],
        involvedItemIds: [],
        tags: [],
        sortOrder: 0,
        travelDays: null,
        inWorldTime: null,
        tension: null,
        structureBeat: null,
        status: 'draft' as const,
        povCharacterId: null,
        isFlashback: false,
        createdAt: 1000,
        updatedAt: 1000,
      }],
    })
    await importWorld(makeFile(data))

    const stored = await db.events.get('ev-mentions')
    expect(stored!.mentionedCharacterIds).toEqual(['c2', 'c3'])
  })

  it('round-trips plotThreads and the threadIds tagged on events', async () => {
    await db.delete()
    await db.open()

    const data = makeExport({
      plotThreads: [
        { id: 'th-1', worldId: 'world-extra', name: 'The Missing Heir', color: '#c084fc', description: 'Who inherits?', createdAt: 1000, updatedAt: 1000 },
        { id: 'th-2', worldId: 'world-extra', name: 'The Siege', color: '#f87171', description: '', createdAt: 1000, updatedAt: 1000 },
      ],
      events: [{
        id: 'ev-threaded',
        worldId: 'world-extra',
        chapterId: 'ch-1',
        timelineId: 'tl-1',
        title: 'Council',
        description: '',
        locationMarkerId: null,
        involvedCharacterIds: [],
        mentionedCharacterIds: [],
        threadIds: ['th-1', 'th-2'],
        involvedItemIds: [],
        tags: [],
        sortOrder: 0,
        travelDays: null,
        inWorldTime: null,
        tension: null,
        structureBeat: null,
        status: 'draft' as const,
        povCharacterId: null,
        isFlashback: false,
        createdAt: 1000,
        updatedAt: 1000,
      }],
    })
    await importWorld(makeFile(data))

    const threads = await db.plotThreads.where('worldId').equals('world-extra').toArray()
    expect(threads.map((t) => t.id).sort()).toEqual(['th-1', 'th-2'])
    expect(threads.find((t) => t.id === 'th-1')?.name).toBe('The Missing Heir')

    const stored = await db.events.get('ev-threaded')
    expect(stored!.threadIds).toEqual(['th-1', 'th-2'])
  })

  it('defaults plotThreads to [] and backfills threadIds on a pre-threads export', async () => {
    await db.delete()
    await db.open()

    const { plotThreads: _pt, ...without } = makeExport({
      version: 15 as never, // pre-threads export
      events: [{
        id: 'ev-no-threads',
        worldId: 'world-extra',
        chapterId: 'ch-1',
        timelineId: 'tl-1',
        title: 'Pre-threads Event',
        description: '',
        locationMarkerId: null,
        involvedCharacterIds: [],
        mentionedCharacterIds: [],
        // deliberately omit threadIds — simulates a pre-threads export
        involvedItemIds: [],
        tags: [],
        sortOrder: 0,
        travelDays: null,
        inWorldTime: null,
        tension: null,
        structureBeat: null,
        status: 'draft' as const,
        povCharacterId: null,
        isFlashback: false,
        createdAt: 1000,
        updatedAt: 1000,
      } as never],
    })
    await importWorld(makeFile(without))

    expect(await db.plotThreads.where('worldId').equals('world-extra').count()).toBe(0)
    const stored = await db.events.get('ev-no-threads')
    expect((stored as unknown as Record<string, unknown>).threadIds).toEqual([])
  })

  it('rejects a plotThreads value that is not an array', async () => {
    await db.delete()
    await db.open()

    const bad = { ...makeExport(), plotThreads: 'nope' }
    await expect(importWorld(makeFile(bad))).rejects.toThrow('plotThreads is not an array')
  })

  it('backfills inWorldTime to null on events that lack it (older export)', async () => {
    await db.delete()
    await db.open()

    const data = makeExport({
      version: 7 as never, // pre-inWorldTime export
      events: [{
        id: 'ev-old-time',
        worldId: 'world-extra',
        chapterId: 'ch-1',
        timelineId: 'tl-1',
        title: 'Pre-chronology Event',
        description: '',
        locationMarkerId: null,
        involvedCharacterIds: [],
        mentionedCharacterIds: [], threadIds: [],
        involvedItemIds: [],
        tags: [],
        sortOrder: 0,
        travelDays: null,
        // deliberately omit inWorldTime — simulates a v7 export
        status: 'draft' as const,
        povCharacterId: null,
        isFlashback: false,
        createdAt: 1000,
        updatedAt: 1000,
      } as never],
    })
    await importWorld(makeFile(data))

    const stored = await db.events.get('ev-old-time')
    expect(stored).toBeDefined()
    expect((stored as unknown as Record<string, unknown>).inWorldTime).toBeNull()
  })

  it('preserves an explicit inWorldTime through export/import', async () => {
    await db.delete()
    await db.open()

    const data = makeExport({
      events: [{
        id: 'ev-flashback',
        worldId: 'world-extra',
        chapterId: 'ch-1',
        timelineId: 'tl-1',
        title: 'Flashback',
        description: '',
        locationMarkerId: null,
        involvedCharacterIds: [],
        mentionedCharacterIds: [], threadIds: [],
        involvedItemIds: [],
        tags: [],
        sortOrder: 0,
        travelDays: null,
        inWorldTime: 3,
        tension: null,
        structureBeat: null,
        status: 'draft' as const,
        povCharacterId: null,
        isFlashback: true,
        createdAt: 1000,
        updatedAt: 1000,
      }],
    })
    await importWorld(makeFile(data))

    const stored = await db.events.get('ev-flashback')
    expect(stored!.inWorldTime).toBe(3)
  })

  it('round-trips knowledge facts and reveals through export/import', async () => {
    await db.delete()
    await db.open()

    const data = makeExport({
      knowledgeFacts: [
        { id: 'kf-1', worldId: 'world-extra', title: 'The king is dead', description: 'Only the council knows.', tags: [], readerLearnsAtEventId: 'ev-1', originEventId: 'ev-1', createdAt: 1000, updatedAt: 1000 },
      ],
      knowledgeReveals: [
        { id: 'kr-1', worldId: 'world-extra', factId: 'kf-1', characterId: 'char-x', eventId: 'ev-1', note: 'overheard', createdAt: 1000, updatedAt: 1000 },
      ],
    })
    await importWorld(makeFile(data))

    expect((await db.knowledgeFacts.get('kf-1'))?.title).toBe('The king is dead')
    expect((await db.knowledgeFacts.get('kf-1'))?.readerLearnsAtEventId).toBe('ev-1')
    expect((await db.knowledgeReveals.get('kr-1'))?.factId).toBe('kf-1')
  })

  it('backfills readerLearnsAtEventId to null on facts from a pre-reader-clock export', async () => {
    await db.delete()
    await db.open()

    const data = makeExport({
      version: 9 as never, // knowledge existed, reader-clock did not
      knowledgeFacts: [
        // deliberately omit readerLearnsAtEventId — simulates a v9 export
        { id: 'kf-old', worldId: 'world-extra', title: 'A secret', description: '', tags: [], createdAt: 1000, updatedAt: 1000 } as never,
      ],
    })
    await importWorld(makeFile(data))

    const stored = await db.knowledgeFacts.get('kf-old')
    expect(stored).toBeDefined()
    expect(stored!.readerLearnsAtEventId).toBeNull()
  })

  it('round-trips character goals through export/import', async () => {
    await db.delete()
    await db.open()

    const data = makeExport({
      characterGoals: [
        { id: 'cg-1', worldId: 'world-extra', characterId: 'char-1', type: 'want', text: 'Reclaim the throne', startEventId: 'ev-1', endEventId: null, createdAt: 1000, updatedAt: 1000 },
        { id: 'cg-2', worldId: 'world-extra', characterId: 'char-1', type: 'fear', text: 'Becoming his father', startEventId: null, endEventId: 'ev-1', createdAt: 1001, updatedAt: 1001 },
      ],
    })
    await importWorld(makeFile(data))

    const want = await db.characterGoals.get('cg-1')
    expect(want?.text).toBe('Reclaim the throne')
    expect(want?.type).toBe('want')
    expect(want?.startEventId).toBe('ev-1')
    expect(want?.endEventId).toBeNull()
    expect((await db.characterGoals.get('cg-2'))?.endEventId).toBe('ev-1')
  })

  it('backfills characterGoals to empty on exports made before the feature', async () => {
    await db.delete()
    await db.open()

    await importWorld(makeFile(makeExport()))

    expect(await db.characterGoals.count()).toBe(0)
  })

  it('backfills knowledge arrays to empty on older exports that lack them', async () => {
    await db.delete()
    await db.open()

    // Base makeExport (v2) carries no knowledge arrays — simulates a pre-feature file.
    await importWorld(makeFile(makeExport()))

    expect(await db.knowledgeFacts.count()).toBe(0)
    expect(await db.knowledgeReveals.count()).toBe(0)
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
      chapters: [{ id: 'ch-1', worldId: 'world-extra', timelineId: 'tl-1', number: 1, title: 'Ch1', synopsis: '', notes: '', wordGoal: null, createdAt: 1000, updatedAt: 1000 }],
      events: [
        { id: 'ev-b', worldId: 'world-extra', chapterId: 'ch-1', timelineId: 'tl-1', title: 'B', description: '', locationMarkerId: null, involvedCharacterIds: [], mentionedCharacterIds: [], threadIds: [], involvedItemIds: [], tags: [], sortOrder: 10, travelDays: null, inWorldTime: null, tension: null, structureBeat: null, status: 'draft' as const, povCharacterId: null, isFlashback: false, createdAt: 1000, updatedAt: 1000 },
        { id: 'ev-a', worldId: 'world-extra', chapterId: 'ch-1', timelineId: 'tl-1', title: 'A', description: '', locationMarkerId: null, involvedCharacterIds: [], mentionedCharacterIds: [], threadIds: [], involvedItemIds: [], tags: [], sortOrder: 0, travelDays: null, inWorldTime: null, tension: null, structureBeat: null, status: 'draft' as const, povCharacterId: null, isFlashback: false, createdAt: 1000, updatedAt: 1000 },
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
      chapters: [{ id: 'ch-noev', worldId: 'world-extra', timelineId: 'tl-1', number: 1, title: 'Ch No Ev', synopsis: '', notes: '', wordGoal: null, createdAt: 1000, updatedAt: 1000 }],
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
      chapters: [{ id: 'ch-rel', worldId: 'world-extra', timelineId: 'tl-1', number: 1, title: 'Ch', synopsis: '', notes: '', wordGoal: null, createdAt: 1000, updatedAt: 1000 }],
      events: [{ id: 'ev-rel', worldId: 'world-extra', chapterId: 'ch-rel', timelineId: 'tl-1', title: 'Ev', description: '', locationMarkerId: null, involvedCharacterIds: [], mentionedCharacterIds: [], threadIds: [], involvedItemIds: [], tags: [], sortOrder: 0, travelDays: null, inWorldTime: null, tension: null, structureBeat: null, status: 'draft' as const, povCharacterId: null, isFlashback: false, createdAt: 1000, updatedAt: 1000 }],
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
        title: 'Chapter One', synopsis: '', notes: '', wordGoal: null, createdAt: 1000, updatedAt: 1000,
      }],
      events: [{
        id: 'ev-1', worldId: 'world-extra', chapterId: 'ch-1', timelineId: 'tl-1',
        title: 'Battle Begins', description: '', locationMarkerId: null,
        involvedCharacterIds: [], mentionedCharacterIds: [], threadIds: [], involvedItemIds: [], tags: [], sortOrder: 0,
        travelDays: null, inWorldTime: null, tension: null, structureBeat: null, status: 'draft' as const, povCharacterId: null, isFlashback: false, createdAt: 1000, updatedAt: 1000,
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

describe('operation journal fields (#115)', () => {
  it('backfills a character version when importing a file that predates it', async () => {
    const world = await createWorld({ name: 'Old Export', description: '' })
    const char = await createCharacter({ worldId: world.id, name: 'Vela', description: '' })
    const exported = await serializeWorldForSync(world.id)

    // Strip version to mimic a .pwk written before v52.
    const parsed = JSON.parse(exported) as { characters: Array<Record<string, unknown>> }
    for (const c of parsed.characters) delete c.version

    await deleteWorld(world.id)
    const importedId = await importWorldFromJson(JSON.stringify(parsed))
    const restored = await db.characters.where('worldId').equals(importedId).first()
    expect(restored?.name).toBe('Vela')
    expect(restored?.version).toBe(1)
    expect(restored?.id).toBe(char.id)
  })

  it('carries deletions but not the operation journal', async () => {
    const world = await createWorld({ name: 'Journalled', description: '' })
    const char = await createCharacter({ worldId: world.id, name: 'Vela', description: '' })
    await updateCharacter(char.id, { name: 'Vela Reyn' })
    expect(await db.operations.where('worldId').equals(world.id).count()).toBeGreaterThan(0)

    const parsed = JSON.parse(await serializeWorldForSync(world.id)) as Record<string, unknown>
    // Operations are device-local history and stay out of a portable file…
    expect(parsed.operations).toBeUndefined()
    // …but tombstones are world state: without them a merge on another device
    // resurrects whatever this one deleted.
    expect(Array.isArray(parsed.tombstones)).toBe(true)
  })
})

describe('deletions survive a merge (#116 follow-up)', () => {
  it('does not resurrect a record the other device deleted', async () => {
    const world = await createWorld({ name: 'Two Devices', description: '' })
    const keeper = await createCharacter({ worldId: world.id, name: 'Keeper', description: '' })
    const doomed = await createCharacter({ worldId: world.id, name: 'Doomed', description: '' })

    // Device B's file still has both — it was written before the deletion.
    const fileFromB = await serializeWorldForSync(world.id)

    // Device A deletes one, then merges B's older file.
    await deleteCharacter(doomed.id)
    await applyWorldImport(JSON.parse(fileFromB), 'merge')

    const names = (await db.characters.where('worldId').equals(world.id).toArray())
      .map((c) => c.name).sort()
    expect(names).toEqual(['Keeper'])
    expect(keeper.id).toBeTruthy()
  })

  it('carries the deletion onward so the far side removes it too', async () => {
    const world = await createWorld({ name: 'Onward', description: '' })
    await createCharacter({ worldId: world.id, name: 'Keeper', description: '' })
    const doomed = await createCharacter({ worldId: world.id, name: 'Doomed', description: '' })
    await deleteCharacter(doomed.id)

    // The deletion has to reach the other device, so it must be in the file.
    const parsed = JSON.parse(await serializeWorldForSync(world.id)) as {
      tombstones?: Array<{ entityId: string; entityType: string }>
    }
    expect(parsed.tombstones?.some((t) => t.entityId === doomed.id && t.entityType === 'character'))
      .toBe(true)
  })

  it('keeps a record the other device deleted but this one edited afterwards', async () => {
    const world = await createWorld({ name: 'Contested', description: '' })
    const c = await createCharacter({ worldId: world.id, name: 'Contested', description: '' })
    await deleteCharacter(c.id)
    const fileWithDeletion = await serializeWorldForSync(world.id)

    // The other device still had it and kept working on it after the deletion.
    const revived = { ...c, name: 'Still Wanted', updatedAt: Date.now() + 60_000, version: 5 }
    await db.characters.put(revived)

    await applyWorldImport(JSON.parse(fileWithDeletion), 'merge')
    const after = await db.characters.get(c.id)
    // Deleting someone's later work is worse than keeping something they removed.
    expect(after?.name).toBe('Still Wanted')
    // …and the stale headstone is gone, so it isn't deleted on the next merge.
    expect(await db.tombstones.where('entityId').equals(c.id).count()).toBe(0)
  })

  it('a bulk import no longer wipes the record of deletions', async () => {
    const world = await createWorld({ name: 'Discontinuity', description: '' })
    const doomed = await createCharacter({ worldId: world.id, name: 'Doomed', description: '' })
    await deleteCharacter(doomed.id)
    expect(await db.tombstones.where('worldId').equals(world.id).count()).toBe(1)

    // markJournalDiscontinuity resets the journal, but a tombstone is world
    // state — clearing it would bring the record back on the next merge.
    await addCharactersToWorld(world.id, [{ name: 'Imported' }] as never)
    expect(await db.operations.where('worldId').equals(world.id).count()).toBe(0)
    expect(await db.tombstones.where('worldId').equals(world.id).count()).toBe(1)
  })
})
