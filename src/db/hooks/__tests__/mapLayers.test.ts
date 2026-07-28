import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { db } from '@/db/database'
import { createMapLayer, deleteMapLayer, replaceMapLayerImage, addMapLevel, deleteMapLevel } from '@/db/hooks/useMapLayers'
import { createLocationMarker } from '@/db/hooks/useLocationMarkers'
import type { MapRegion, MapRoute } from '@/types'

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

  it('nulls currentLocationMarkerId on character snapshots whose marker is deleted', async () => {
    const root = await createMapLayer(makeLayerData({ name: 'Locations' }))
    const child = await createMapLayer(makeLayerData({ name: 'Grounds', parentMapId: root.id }))
    const onChild = await createLocationMarker({
      worldId: 'world-1', mapLayerId: child.id, name: 'Gate', description: '', x: 1, y: 1, iconType: 'landmark',
    })
    const onRoot = await createLocationMarker({
      worldId: 'world-1', mapLayerId: root.id, name: 'Castle', description: '', x: 2, y: 2, iconType: 'city',
    })
    const now = Date.now()
    await db.characterSnapshots.bulkAdd([
      { id: 'cs-1', worldId: 'world-1', characterId: 'c1', eventId: 'e1', isAlive: true,
        currentLocationMarkerId: onChild.id, currentMapLayerId: child.id, inventoryItemIds: [],
        inventoryNotes: '', statusNotes: '', travelModeId: null, createdAt: now, updatedAt: now },
      { id: 'cs-2', worldId: 'world-1', characterId: 'c2', eventId: 'e1', isAlive: true,
        currentLocationMarkerId: onRoot.id, currentMapLayerId: root.id, inventoryItemIds: [],
        inventoryNotes: '', statusNotes: '', travelModeId: null, createdAt: now, updatedAt: now },
    ])

    await deleteMapLayer(child.id)

    // The snapshot on the deleted marker is unlinked; the untouched one keeps its marker.
    expect((await db.characterSnapshots.get('cs-1'))!.currentLocationMarkerId).toBeNull()
    expect((await db.characterSnapshots.get('cs-2'))!.currentLocationMarkerId).toBe(onRoot.id)
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

async function addRoute(mapLayerId: string, waypoints: MapRoute['waypoints']): Promise<string> {
  const now = Date.now()
  const route: MapRoute = {
    id: `route-${Math.random().toString(36).slice(2)}`,
    worldId: 'world-1', mapLayerId, name: 'Road', routeType: 'road',
    waypoints, createdAt: now, updatedAt: now,
  }
  await db.mapRoutes.add(route)
  return route.id
}

describe('replaceMapLayerImage', () => {
  it('is a no-op for a non-existent layer', async () => {
    await expect(
      replaceMapLayerImage('ghost', { imageId: 'x', imageWidth: 10, imageHeight: 10 }),
    ).resolves.toBeUndefined()
  })

  it('adds the first image to a placeholder map and preserves its locations', async () => {
    const layer = await createMapLayer(makeLayerData({
      imageId: null,
      imageWidth: 1200,
      imageHeight: 800,
    }))
    const marker = await createLocationMarker({
      worldId: 'world-1', mapLayerId: layer.id, name: 'Court', description: '',
      x: 600, y: 400, iconType: 'building',
    })

    await replaceMapLayerImage(
      layer.id,
      { imageId: 'uploaded-map', imageWidth: 2400, imageHeight: 1600 },
      { rescale: true },
    )

    const updated = (await db.mapLayers.get(layer.id))!
    expect(updated.imageId).toBe('uploaded-map')
    expect(updated.imageWidth).toBe(2400)
    expect(updated.imageHeight).toBe(1600)
    expect((await db.locationMarkers.get(marker.id))!).toMatchObject({
      x: 1200,
      y: 800,
    })
  })

  it('swaps the image and rescales content proportionally', async () => {
    const layer = await createMapLayer(makeLayerData({ imageWidth: 1000, imageHeight: 800, scalePixelsPerUnit: 10, scaleUnit: 'km' }))
    const marker = await createLocationMarker({
      worldId: 'world-1', mapLayerId: layer.id, name: 'City', description: '', x: 500, y: 400, iconType: 'city',
    })
    const now = Date.now()
    await db.mapAnnotations.add({
      id: 'ann-1', worldId: 'world-1', mapLayerId: layer.id, x: 200, y: 100,
      text: 'Here', fontSize: 14, color: '#fff', createdAt: now, updatedAt: now,
    })
    const regionId = await addRegion({ mapLayerId: layer.id, vertices: [{ x: 100, y: 200 }, { x: 300, y: 200 }, { x: 300, y: 400 }] })
    const routeId = await addRoute(layer.id, [{ x: 0, y: 0 }, 'marker-follows', { x: 100, y: 400 }])

    // New image is 2× wide, 1.5× tall.
    await replaceMapLayerImage(layer.id, { imageId: 'img-2', imageWidth: 2000, imageHeight: 1200 })

    const updated = (await db.mapLayers.get(layer.id))!
    expect(updated.imageId).toBe('img-2')
    expect(updated.imageWidth).toBe(2000)
    expect(updated.imageHeight).toBe(1200)
    // Scale tracks the horizontal factor (×2).
    expect(updated.scalePixelsPerUnit).toBe(20)

    const sx = 2, sy = 1.5
    const m = (await db.locationMarkers.get(marker.id))!
    expect(m.x).toBe(500 * sx); expect(m.y).toBe(400 * sy)
    const ann = (await db.mapAnnotations.get('ann-1'))!
    expect(ann.x).toBe(200 * sx); expect(ann.y).toBe(100 * sy)
    const region = (await db.mapRegions.get(regionId))!
    expect(region.vertices).toEqual([{ x: 200, y: 300 }, { x: 600, y: 300 }, { x: 600, y: 600 }])
    const route = (await db.mapRoutes.get(routeId))!
    // Raw points scale; a marker-id waypoint is left as-is.
    expect(route.waypoints).toEqual([{ x: 0, y: 0 }, 'marker-follows', { x: 200, y: 600 }])
  })

  it('keeps coordinates unchanged when rescale is off', async () => {
    const layer = await createMapLayer(makeLayerData({ imageWidth: 1000, imageHeight: 1000, scalePixelsPerUnit: 10, scaleUnit: 'km' }))
    const marker = await createLocationMarker({
      worldId: 'world-1', mapLayerId: layer.id, name: 'City', description: '', x: 500, y: 400, iconType: 'city',
    })

    await replaceMapLayerImage(layer.id, { imageId: 'img-2', imageWidth: 2000, imageHeight: 2000 }, { rescale: false })

    const updated = (await db.mapLayers.get(layer.id))!
    expect(updated.imageId).toBe('img-2')
    expect(updated.imageWidth).toBe(2000)
    expect(updated.scalePixelsPerUnit).toBe(10) // untouched
    const m = (await db.locationMarkers.get(marker.id))!
    expect(m.x).toBe(500); expect(m.y).toBe(400)
  })

  it('does not rescale when the new image is the same size', async () => {
    const layer = await createMapLayer(makeLayerData({ imageWidth: 1000, imageHeight: 1000 }))
    const marker = await createLocationMarker({
      worldId: 'world-1', mapLayerId: layer.id, name: 'City', description: '', x: 500, y: 400, iconType: 'city',
    })

    await replaceMapLayerImage(layer.id, { imageId: 'img-2', imageWidth: 1000, imageHeight: 1000 })

    const m = (await db.locationMarkers.get(marker.id))!
    expect(m.x).toBe(500); expect(m.y).toBe(400)
    expect((await db.mapLayers.get(layer.id))!.imageId).toBe('img-2')
  })
})

describe('addMapLevel', () => {
  it('is a no-op for a missing base layer', async () => {
    expect(await addMapLevel('ghost', { imageId: 'x', imageWidth: 10, imageHeight: 10 }, 'Attic')).toBeNull()
  })

  it('turns a standalone map into a group and stacks a new floor above', async () => {
    const base = await createMapLayer(makeLayerData({ name: 'Hogwarts Castle', parentMapId: 'root' }))
    const newId = await addMapLevel(base.id, { imageId: 'floor2', imageWidth: 800, imageHeight: 600 }, 'First floor')
    expect(newId).toBeTruthy()

    const updatedBase = (await db.mapLayers.get(base.id))!
    const floor = (await db.mapLayers.get(newId!))!
    // Base became the ground floor of a new group.
    expect(updatedBase.levelGroupId).toBeTruthy()
    expect(updatedBase.levelIndex).toBe(0)
    expect(updatedBase.levelLabel).toBe('Ground floor')
    // New floor shares the group, parent and name; sits above; keeps its own image.
    expect(floor.levelGroupId).toBe(updatedBase.levelGroupId)
    expect(floor.levelIndex).toBe(1)
    expect(floor.levelLabel).toBe('First floor')
    expect(floor.parentMapId).toBe('root')
    expect(floor.name).toBe('Hogwarts Castle')
    expect(floor.imageId).toBe('floor2')
  })

  it('stacks further floors above the current top and defaults the label', async () => {
    const base = await createMapLayer(makeLayerData({ name: 'Castle' }))
    await addMapLevel(base.id, { imageId: 'f1', imageWidth: 10, imageHeight: 10 }, 'First')
    const thirdId = await addMapLevel(base.id, { imageId: 'f2', imageWidth: 10, imageHeight: 10 }, '')
    const third = (await db.mapLayers.get(thirdId!))!
    expect(third.levelIndex).toBe(2)
    expect(third.levelLabel).toBe('Level 2') // blank label falls back
    // Three floors now share the group.
    const members = (await db.mapLayers.toArray()).filter((l) => l.levelGroupId === third.levelGroupId)
    expect(members).toHaveLength(3)
  })

  it('each floor keeps its own locations (deleting a floor removes only its markers)', async () => {
    const base = await createMapLayer(makeLayerData({ name: 'Castle' }))
    const onGround = await createLocationMarker({
      worldId: 'world-1', mapLayerId: base.id, name: 'Hall', description: '', x: 1, y: 1, iconType: 'building',
    })
    const upId = await addMapLevel(base.id, { imageId: 'f1', imageWidth: 10, imageHeight: 10 }, 'First')
    const onFirst = await createLocationMarker({
      worldId: 'world-1', mapLayerId: upId!, name: 'Library', description: '', x: 2, y: 2, iconType: 'building',
    })

    await deleteMapLayer(upId!)

    // The first floor and its location are gone; the ground floor and its own are intact.
    expect(await db.mapLayers.get(upId!)).toBeUndefined()
    expect(await db.locationMarkers.get(onFirst.id)).toBeUndefined()
    expect(await db.mapLayers.get(base.id)).toBeDefined()
    expect(await db.locationMarkers.get(onGround.id)).toBeDefined()
  })
})

describe('deleteMapLevel', () => {
  it('re-points a building\'s drill-in link when the representative floor is deleted', async () => {
    const root = await createMapLayer(makeLayerData({ name: 'Grounds' }))
    const ground = await createMapLayer(makeLayerData({ name: 'Castle', parentMapId: root.id }))
    // A pin on the grounds that drills into the castle's ground floor.
    const pin = await createLocationMarker({
      worldId: 'world-1', mapLayerId: root.id, name: 'Castle', description: '', x: 1, y: 1,
      iconType: 'building', linkedMapLayerId: ground.id,
    })
    const upId = await addMapLevel(ground.id, { imageId: 'f1', imageWidth: 10, imageHeight: 10 }, 'First floor')

    // Delete the ground floor (the representative that the pin links to).
    await deleteMapLevel(ground.id)

    expect(await db.mapLayers.get(ground.id)).toBeUndefined()
    // The pin now drills into the surviving first floor — not left dangling.
    expect((await db.locationMarkers.get(pin.id))!.linkedMapLayerId).toBe(upId)
  })

  it('leaves links alone when a non-representative floor is deleted', async () => {
    const root = await createMapLayer(makeLayerData({ name: 'Grounds' }))
    const ground = await createMapLayer(makeLayerData({ name: 'Castle', parentMapId: root.id }))
    const pin = await createLocationMarker({
      worldId: 'world-1', mapLayerId: root.id, name: 'Castle', description: '', x: 1, y: 1,
      iconType: 'building', linkedMapLayerId: ground.id,
    })
    const upId = await addMapLevel(ground.id, { imageId: 'f1', imageWidth: 10, imageHeight: 10 }, 'First floor')

    await deleteMapLevel(upId!) // remove the upper floor

    expect(await db.mapLayers.get(upId!)).toBeUndefined()
    // Pin still points at the (unchanged) ground floor.
    expect((await db.locationMarkers.get(pin.id))!.linkedMapLayerId).toBe(ground.id)
  })

  it('deletes a standalone layer normally', async () => {
    const layer = await createMapLayer(makeLayerData())
    await deleteMapLevel(layer.id)
    expect(await db.mapLayers.get(layer.id)).toBeUndefined()
  })
})
