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
    // Cascade markers, then their own child records
    const markerIds = (await db.locationMarkers.where('mapLayerId').equals(id).toArray()).map((m) => m.id)
    await db.locationMarkers.where('mapLayerId').equals(id).delete()
    for (const markerId of markerIds) {
      await db.locationSnapshots.where('locationMarkerId').equals(markerId).delete()
      await db.characterSnapshots
        .filter((s) => s.currentLocationMarkerId === markerId)
        .modify({ currentLocationMarkerId: null })
    }
    // Cascade map-layer-owned objects
    const regionIds = (await db.mapRegions.where('mapLayerId').equals(id).toArray()).map((r) => r.id)
    await db.mapRoutes.where('mapLayerId').equals(id).delete()
    await db.mapRegions.where('mapLayerId').equals(id).delete()
    for (const regionId of regionIds) {
      await db.mapRegionSnapshots.where('regionId').equals(regionId).delete()
    }
    await db.mapAnnotations.where('mapLayerId').equals(id).delete()
    await db.mapLayers.delete(id)
  })
}
