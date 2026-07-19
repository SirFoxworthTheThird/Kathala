import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { db } from '@/db/database'
import { createMapLayer, deleteMapLayer } from '@/db/hooks/useMapLayers'
import { createLocationMarker } from '@/db/hooks/useLocationMarkers'
import type { MapRegion } from '@/types'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

afterAll(async () => {
  await db.delete()
})

function makeLayerData(overrides: Partial<Parameters<typeof createMapLayer>[0]> = {}) {
  return {
    worldId: 'world-1',
    parentMapId: null,
    name: 'Layer',
    description: '',
    imageId: 'img-1',
    imageWidth: 1000,
    imageHeight: 1000,
    scalePixelsPerUnit: null,
    scaleUnit: null,
    ...overrides,
  }
}

async function addRegion(overrides: Partial<MapRegion> = {}): Promise<string> {
  const now = Date.now()
  const region: MapRegion = {
    id: `region-${Math.random().toString(36).slice(2)}`,
    worldId: 'world-1',
    mapLayerId: 'layer-x',
    name: 'Region',
    vertices: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }],
    fillColor: '#fff',
    opacity: 0.3,
    linkedMapLayerId: null,
    factionId: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
  await db.mapRegions.add(region)
  return region.id
}

describe('deleteMapLayer', () => {
  it('is a no-op for a non-existent id', async () => {
    await expect(deleteMapLayer('ghost')).resolves.toBeUndefined()
  })

  it('deletes the layer and every sub-map nested under it, at any depth', async () => {
    const root = await createMapLayer(makeLayerData({ name: 'Locations' }))
    const child = await createMapLayer(makeLayerData({ name: 'Hogwarts Grounds', parentMapId: root.id }))
    const grandchild = await createMapLayer(makeLayerData({ name: 'Greenhouses', parentMapId: child.id }))
    const sibling = await createMapLayer(makeLayerData({ name: 'Hogsmeade', parentMapId: root.id }))

    await deleteMapLayer(child.id)

    // The whole nested branch is gone — not orphaned.
    expect(await db.mapLayers.get(child.id)).toBeUndefined()
    expect(await db.mapLayers.get(grandchild.id)).toBeUndefined()
    // Unrelated layers survive.
    expect(await db.mapLayers.get(root.id)).toBeDefined()
    expect(await db.mapLayers.get(sibling.id)).toBeDefined()
  })

  it('cascades markers on the deleted layer and its descendants', async () => {
    const root = await createMapLayer(makeLayerData({ name: 'Locations' }))
    const child = await createMapLayer(makeLayerData({ name: 'Grounds', parentMapId: root.id }))
    const grandchild = await createMapLayer(makeLayerData({ name: 'Greenhouses', parentMapId: child.id }))

    const onChild = await createLocationMarker({
      worldId: 'world-1', mapLayerId: child.id, name: 'Gate', description: '', x: 1, y: 1, iconType: 'landmark',
    })
    const onGrandchild = await createLocationMarker({
      worldId: 'world-1', mapLayerId: grandchild.id, name: 'Herb', description: '', x: 2, y: 2, iconType: 'landmark',
    })
    const onRoot = await createLocationMarker({
      worldId: 'world-1', mapLayerId: root.id, name: 'Castle', description: '', x: 3, y: 3, iconType: 'city',
    })

    await deleteMapLayer(child.id)

    expect(await db.locationMarkers.get(onChild.id)).toBeUndefined()
    expect(await db.locationMarkers.get(onGrandchild.id)).toBeUndefined()
    expect(await db.locationMarkers.get(onRoot.id)).toBeDefined()
  })

  it('clears dangling sub-map links on surviving markers and regions', async () => {
    const root = await createMapLayer(makeLayerData({ name: 'Locations' }))
    const child = await createMapLayer(makeLayerData({ name: 'Grounds', parentMapId: root.id }))
    const grandchild = await createMapLayer(makeLayerData({ name: 'Greenhouses', parentMapId: child.id }))

    // A marker and a region on the root that link into the branch being deleted.
    const linkingMarker = await createLocationMarker({
      worldId: 'world-1', mapLayerId: root.id, name: 'Door', description: '', x: 1, y: 1,
      iconType: 'building', linkedMapLayerId: child.id,
    })
    const linkingRegionId = await addRegion({ mapLayerId: root.id, linkedMapLayerId: grandchild.id })
    // A marker linking somewhere unrelated should be untouched.
    const keepMarker = await createLocationMarker({
      worldId: 'world-1', mapLayerId: root.id, name: 'Keep', description: '', x: 5, y: 5,
      iconType: 'building', linkedMapLayerId: root.id,
    })

    await deleteMapLayer(child.id)

    expect((await db.locationMarkers.get(linkingMarker.id))!.linkedMapLayerId).toBeNull()
    expect((await db.mapRegions.get(linkingRegionId))!.linkedMapLayerId).toBeNull()
    expect((await db.locationMarkers.get(keepMarker.id))!.linkedMapLayerId).toBe(root.id)
  })
})
