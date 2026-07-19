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

  it('counts a sub-map whose parent map is gone, plus its descendants', async () => {
    const root = await createMapLayer(makeLayerData({ name: 'Locations' }))
    const child = await createMapLayer(makeLayerData({ name: 'Grounds', parentMapId: root.id }))
    const grandchild = await createMapLayer(makeLayerData({ name: 'Greenhouses', parentMapId: child.id }))

    // Simulate a legacy delete that removed the parent but stranded its subtree.
    await db.mapLayers.delete(child.id)

    const report = await scanOrphans('world-1')
    // grandchild is now orphaned (its parent `child` is gone).
    expect(report.mapLayers).toBe(1)
    expect(totalOrphans(report)).toBe(1)
    // sanity: the grandchild is the stranded one.
    expect(await db.mapLayers.get(grandchild.id)).toBeDefined()
  })
})

describe('purgeOrphans — map layers', () => {
  it('deletes orphaned sub-maps and everything nested under them, keeping healthy layers', async () => {
    const root = await createMapLayer(makeLayerData({ name: 'Locations' }))
    const healthy = await createMapLayer(makeLayerData({ name: 'Hogsmeade', parentMapId: root.id }))
    const stranded = await createMapLayer(makeLayerData({ name: 'Grounds', parentMapId: 'deleted-parent' }))
    const strandedChild = await createMapLayer(makeLayerData({ name: 'Greenhouses', parentMapId: stranded.id }))

    // A marker living on the stranded sub-map, and a marker on a healthy map
    // that links to the stranded one.
    const markerOnStranded = await createLocationMarker({
      worldId: 'world-1', mapLayerId: stranded.id, name: 'Gate', description: '', x: 1, y: 1, iconType: 'landmark',
    })
    const linkingMarker = await createLocationMarker({
      worldId: 'world-1', mapLayerId: root.id, name: 'Door', description: '', x: 2, y: 2,
      iconType: 'building', linkedMapLayerId: stranded.id,
    })

    await purgeOrphans('world-1')

    // Orphan branch removed.
    expect(await db.mapLayers.get(stranded.id)).toBeUndefined()
    expect(await db.mapLayers.get(strandedChild.id)).toBeUndefined()
    expect(await db.locationMarkers.get(markerOnStranded.id)).toBeUndefined()
    // Healthy layers untouched, dangling link cleared.
    expect(await db.mapLayers.get(root.id)).toBeDefined()
    expect(await db.mapLayers.get(healthy.id)).toBeDefined()
    expect((await db.locationMarkers.get(linkingMarker.id))!.linkedMapLayerId).toBeNull()

    // A fresh scan is now clean.
    const report = await scanOrphans('world-1')
    expect(report.mapLayers).toBe(0)
  })
})
