import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { db } from '@/db/database'
import { createWorld } from '@/db/hooks/useWorlds'
import { createMapLayer, addMapLevel } from '@/db/hooks/useMapLayers'
import { createLocationMarker } from '@/db/hooks/useLocationMarkers'
import { collectWorldData, importWorldFromJson } from '@/lib/exportImport'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

afterAll(async () => {
  await db.delete()
})

function makeLayerData(worldId: string, overrides = {}) {
  return {
    worldId, parentMapId: null, name: 'Castle', description: '',
    imageId: 'img', imageWidth: 100, imageHeight: 100,
    scalePixelsPerUnit: null, scaleUnit: null,
    ...overrides,
  }
}

describe('export/import — map levels', () => {
  it('collectWorldData carries the level fields', async () => {
    const world = await createWorld({ name: 'W', description: '' })
    const base = await createMapLayer(makeLayerData(world.id))
    await addMapLevel(base.id, { imageId: 'f1', imageWidth: 100, imageHeight: 100 }, 'First floor')

    const data = await collectWorldData(world.id)
    const floors = data.mapLayers.filter((l) => l.levelGroupId)
    expect(floors).toHaveLength(2)
    // Both fields are present on the exported records.
    expect(floors.every((l) => typeof l.levelGroupId === 'string')).toBe(true)
    expect(floors.map((l) => l.levelLabel).sort()).toEqual(['First floor', 'Ground floor'])
  })

  it('survives a full export → import round-trip, group and per-floor locations intact', async () => {
    const world = await createWorld({ name: 'Hogwarts', description: '' })
    const base = await createMapLayer(makeLayerData(world.id, { name: 'Hogwarts Castle' }))
    const upId = await addMapLevel(base.id, { imageId: 'f1', imageWidth: 100, imageHeight: 100 }, 'First floor')
    await createLocationMarker({ worldId: world.id, mapLayerId: base.id, name: 'Great Hall', description: '', x: 1, y: 1, iconType: 'building' })
    await createLocationMarker({ worldId: world.id, mapLayerId: upId!, name: 'Library', description: '', x: 2, y: 2, iconType: 'building' })

    // Export, wipe, re-import.
    const collected = await collectWorldData(world.id)
    const json = JSON.stringify({ version: 2, exportedAt: Date.now(), ...collected, blobs: [] })
    await db.delete(); await db.open()
    await importWorldFromJson(json)

    const layers = await db.mapLayers.toArray()
    const group = layers.filter((l) => l.levelGroupId)
    expect(group).toHaveLength(2)
    expect(new Set(group.map((l) => l.levelGroupId)).size).toBe(1) // still one group
    const ground = group.find((l) => l.levelIndex === 0)!
    const first = group.find((l) => l.levelIndex === 1)!
    expect(ground.levelLabel).toBe('Ground floor')
    expect(first.levelLabel).toBe('First floor')
    // Each floor still owns its own location.
    const markers = await db.locationMarkers.toArray()
    expect(markers.find((m) => m.name === 'Great Hall')!.mapLayerId).toBe(ground.id)
    expect(markers.find((m) => m.name === 'Library')!.mapLayerId).toBe(first.id)
  })

  it('backfills level fields on a legacy export that predates them', async () => {
    // A v2 file whose map layer has no level fields at all.
    const legacyLayer = {
      id: 'l1', worldId: 'w-legacy', parentMapId: null, name: 'Old Map', description: '',
      imageId: 'img', imageWidth: 100, imageHeight: 100, scalePixelsPerUnit: null, scaleUnit: null,
      createdAt: 1, updatedAt: 1,
    }
    const file = {
      version: 2, exportedAt: Date.now(),
      world: { id: 'w-legacy', name: 'Legacy', description: '', coverImageId: null, theme: null, continuityStaleThreshold: 5, createdAt: 1, updatedAt: 1 },
      mapLayers: [legacyLayer],
      locationMarkers: [], characters: [], items: [], characterSnapshots: [], characterMovements: [],
      itemPlacements: [], locationSnapshots: [], itemSnapshots: [], relationships: [], relationshipSnapshots: [],
      timelines: [], chapters: [], events: [], blobs: [], travelModes: [], timelineRelationships: [],
      crossTimelineArtifacts: [], mapRoutes: [], mapRegions: [], mapRegionSnapshots: [], mapAnnotations: [],
      loreCategories: [], lorePages: [], factions: [], factionMemberships: [], factionRelationships: [],
    }
    await importWorldFromJson(JSON.stringify(file))

    const stored = (await db.mapLayers.get('l1'))!
    expect(stored.levelGroupId).toBeNull()
    expect(stored.levelIndex).toBe(0)
    expect(stored.levelLabel).toBe('')
  })
})
