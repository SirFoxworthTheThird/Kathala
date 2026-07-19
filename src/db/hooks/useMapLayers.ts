import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import type { MapLayer } from '@/types'
import { generateId } from '@/lib/id'

export function useMapLayers(worldId: string | null) {
  return useLiveQuery(
    () => (worldId ? db.mapLayers.where('worldId').equals(worldId).toArray() : []),
    [worldId],
    []
  )
}

export function useMapLayer(id: string | null) {
  return useLiveQuery(() => (id ? db.mapLayers.get(id) : undefined), [id])
}

export function useRootMapLayers(worldId: string | null) {
  return useLiveQuery(
    () =>
      worldId
        ? db.mapLayers
            .where('worldId')
            .equals(worldId)
            .filter((m) => m.parentMapId === null)
            .toArray()
        : [],
    [worldId],
    []
  )
}

export function useChildMapLayers(parentMapId: string | null) {
  return useLiveQuery(
    () =>
      parentMapId
        ? db.mapLayers.where('parentMapId').equals(parentMapId).toArray()
        : [],
    [parentMapId],
    []
  )
}

export async function createMapLayer(
  data: Pick<MapLayer, 'worldId' | 'parentMapId' | 'name' | 'description' | 'imageId' | 'imageWidth' | 'imageHeight' | 'scalePixelsPerUnit' | 'scaleUnit'>
): Promise<MapLayer> {
  const now = Date.now()
  const layer: MapLayer = {
    id: generateId(),
    ...data,
    createdAt: now,
    updatedAt: now,
  }
  await db.mapLayers.add(layer)
  return layer
}

export async function updateMapLayer(id: string, data: Partial<Omit<MapLayer, 'id' | 'createdAt'>>) {
  await db.mapLayers.update(id, { ...data, updatedAt: Date.now() })
}

export async function deleteMapLayer(id: string) {
  await db.transaction('rw', [
    db.mapLayers, db.locationMarkers, db.locationSnapshots, db.characterSnapshots,
    db.mapRoutes, db.mapRegions, db.mapRegionSnapshots, db.mapAnnotations,
  ], async () => {
    const layer = await db.mapLayers.get(id)
    if (!layer) return

    // Collect this layer plus every sub-map nested under it, at any depth, so
    // deleting a map also removes the maps it contains (matching the "and its N
    // sub-map(s)" confirmation) instead of orphaning them — orphaned layers
    // would keep showing up as linkable sub-maps in the location panel.
    const worldLayers = await db.mapLayers.where('worldId').equals(layer.worldId).toArray()
    const childrenByParent = new Map<string, string[]>()
    for (const l of worldLayers) {
      if (l.parentMapId) {
        const arr = childrenByParent.get(l.parentMapId) ?? []
        arr.push(l.id)
        childrenByParent.set(l.parentMapId, arr)
      }
    }
    const layerIds: string[] = []
    const stack = [id]
    while (stack.length) {
      const cur = stack.pop()!
      layerIds.push(cur)
      for (const child of childrenByParent.get(cur) ?? []) stack.push(child)
    }
    const layerIdSet = new Set(layerIds)

    // Cascade markers on all deleted layers, then their own child records.
    const markerIds = (await db.locationMarkers.where('mapLayerId').anyOf(layerIds).toArray()).map((m) => m.id)
    await db.locationMarkers.where('mapLayerId').anyOf(layerIds).delete()
    for (const markerId of markerIds) {
      await db.locationSnapshots.where('locationMarkerId').equals(markerId).delete()
      await db.characterSnapshots
        .filter((s) => s.currentLocationMarkerId === markerId)
        .modify({ currentLocationMarkerId: null })
    }
    // Cascade map-layer-owned objects.
    const regionIds = (await db.mapRegions.where('mapLayerId').anyOf(layerIds).toArray()).map((r) => r.id)
    await db.mapRoutes.where('mapLayerId').anyOf(layerIds).delete()
    await db.mapRegions.where('mapLayerId').anyOf(layerIds).delete()
    for (const regionId of regionIds) {
      await db.mapRegionSnapshots.where('regionId').equals(regionId).delete()
    }
    await db.mapAnnotations.where('mapLayerId').anyOf(layerIds).delete()

    // Drop dangling links from surviving markers/regions that pointed at any of
    // the deleted layers, so they no longer offer a broken sub-map link.
    await db.locationMarkers
      .filter((m) => m.linkedMapLayerId !== null && layerIdSet.has(m.linkedMapLayerId))
      .modify({ linkedMapLayerId: null })
    await db.mapRegions
      .filter((r) => r.linkedMapLayerId !== null && layerIdSet.has(r.linkedMapLayerId))
      .modify({ linkedMapLayerId: null })

    await db.mapLayers.bulkDelete(layerIds)
  })
}
