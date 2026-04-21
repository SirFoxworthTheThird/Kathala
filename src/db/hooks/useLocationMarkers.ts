import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import type { LocationMarker, LocationIconType } from '@/types'
import { generateId } from '@/lib/id'

export function useLocationMarkers(mapLayerId: string | null) {
  return useLiveQuery(
    () => (mapLayerId ? db.locationMarkers.where('mapLayerId').equals(mapLayerId).toArray() : []),
    [mapLayerId],
    []
  )
}

export function useLocationMarker(id: string | null) {
  return useLiveQuery(() => (id ? db.locationMarkers.get(id) : undefined), [id])
}

export function useAllLocationMarkers(worldId: string | null) {
  return useLiveQuery(
    () => (worldId ? db.locationMarkers.where('worldId').equals(worldId).toArray() : []),
    [worldId],
    []
  )
}

export async function createLocationMarker(data: {
  worldId: string
  mapLayerId: string
  name: string
  description: string
  x: number
  y: number
  iconType: LocationIconType
  linkedMapLayerId?: string | null
  tags?: string[]
}): Promise<LocationMarker> {
  const now = Date.now()
  const marker: LocationMarker = {
    id: generateId(),
    worldId: data.worldId,
    mapLayerId: data.mapLayerId,
    linkedMapLayerId: data.linkedMapLayerId ?? null,
    name: data.name,
    description: data.description,
    x: data.x,
    y: data.y,
    iconType: data.iconType,
    tags: data.tags ?? [],
    factionId: null,
    createdAt: now,
    updatedAt: now,
  }
  await db.locationMarkers.add(marker)
  return marker
}

export async function updateLocationMarker(id: string, data: Partial<Omit<LocationMarker, 'id' | 'createdAt'>>) {
  await db.locationMarkers.update(id, { ...data, updatedAt: Date.now() })
}

export async function deleteLocationMarker(id: string) {
  await db.locationMarkers.delete(id)
}
