import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { db } from '@/db/database'
import { scanOrphans, purgeOrphans, totalOrphans } from '@/db/hooks/useDbHealth'
import { createMapLayer } from '@/db/hooks/useMapLayers'
import { createLocationMarker } from '@/db/hooks/useLocationMarkers'

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
    imageWidth: 100,
    imageHeight: 100,
    scalePixelsPerUnit: null,
    scaleUnit: null,
    ...overrides,
  }
}

describe('scanOrphans — map layers', () => {
  it('reports zero for a healthy world', async () => {
    const root = await createMapLayer(makeLayerData({ name: 'Locations' }))
    await createMapLayer(makeLayerData({ name: 'Grounds', parentMapId: root.id }))
    const report = await scanOrphans('world-1')
    expect(report.mapLayers).toBe(0)
    expect(totalOrphans(report)).toBe(0)
  })

  it('counts an unreachable sub-map whose parent map is gone, plus its descendants', async () => {
    const root = await createMapLayer(makeLayerData({ name: 'Locations' }))
    const child = await createMapLayer(makeLayerData({ name: 'Grounds', parentMapId: root.id }))
    const grandchild = await createMapLayer(makeLayerData({ name: 'Greenhouses', parentMapId: child.id }))

    // Simulate a legacy delete that removed the parent but stranded its subtree,
    // with nothing linking to it (truly unreachable).
    await db.mapLayers.delete(child.id)

    const report = await scanOrphans('world-1')
    // grandchild is now orphaned (its parent `child` is gone and nothing links it).
    expect(report.mapLayers).toBe(1)
    expect(totalOrphans(report)).toBe(1)
    expect(await db.mapLayers.get(grandchild.id)).toBeDefined()
  })

  it('does NOT count a dangling-parent sub-map that a marker still links to', async () => {
    const root = await createMapLayer(makeLayerData({ name: 'Locations' }))
    const linked = await createMapLayer(makeLayerData({ name: 'Grounds', parentMapId: 'deleted-parent' }))
    await createMapLayer(makeLayerData({ name: 'Greenhouses', parentMapId: linked.id }))
    // A surviving marker opens the sub-map, so it is reachable and in use.
    await createLocationMarker({
      worldId: 'world-1', mapLayerId: root.id, name: 'Door', description: '', x: 1, y: 1,
      iconType: 'building', linkedMapLayerId: linked.id,
    })

    const report = await scanOrphans('world-1')
    expect(report.mapLayers).toBe(0)
  })
})

describe('purgeOrphans — map layers', () => {
  it('deletes only unreachable sub-maps, keeping linked and healthy layers', async () => {
    const root = await createMapLayer(makeLayerData({ name: 'Locations' }))
    const healthy = await createMapLayer(makeLayerData({ name: 'Hogsmeade', parentMapId: root.id }))
    // Reachable via a marker link despite a dangling parent — must be KEPT.
    const linked = await createMapLayer(makeLayerData({ name: 'Grounds', parentMapId: 'deleted-parent' }))
    const linkedChild = await createMapLayer(makeLayerData({ name: 'Greenhouses', parentMapId: linked.id }))
    const markerOnLinked = await createLocationMarker({
      worldId: 'world-1', mapLayerId: linked.id, name: 'Gate', description: '', x: 1, y: 1, iconType: 'landmark',
    })
    const linkingMarker = await createLocationMarker({
      worldId: 'world-1', mapLayerId: root.id, name: 'Door', description: '', x: 2, y: 2,
      iconType: 'building', linkedMapLayerId: linked.id,
    })
    // Truly unreachable (dangling parent, nothing links to it) — must be PURGED.
    const junk = await createMapLayer(makeLayerData({ name: 'Junk', parentMapId: 'long-gone' }))
    const markerOnJunk = await createLocationMarker({
      worldId: 'world-1', mapLayerId: junk.id, name: 'Nowhere', description: '', x: 3, y: 3, iconType: 'landmark',
    })

    await purgeOrphans('world-1')

    // Unreachable junk removed with its markers.
    expect(await db.mapLayers.get(junk.id)).toBeUndefined()
    expect(await db.locationMarkers.get(markerOnJunk.id)).toBeUndefined()
    // Linked sub-map and its contents preserved.
    expect(await db.mapLayers.get(linked.id)).toBeDefined()
    expect(await db.mapLayers.get(linkedChild.id)).toBeDefined()
    expect(await db.locationMarkers.get(markerOnLinked.id)).toBeDefined()
    expect((await db.locationMarkers.get(linkingMarker.id))!.linkedMapLayerId).toBe(linked.id)
    // Healthy layers untouched.
    expect(await db.mapLayers.get(root.id)).toBeDefined()
    expect(await db.mapLayers.get(healthy.id)).toBeDefined()

    // A fresh scan is now clean.
    const report = await scanOrphans('world-1')
    expect(report.mapLayers).toBe(0)
  })
})
