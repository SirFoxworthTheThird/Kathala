import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import { useGate } from './ReadingGateContext'
import { journalCreate, journalUpdate, journalDelete } from './useOperations'
import type { LocationMarker, LocationIconType } from '@/types'
import { generateId } from '@/lib/id'

export function useLocationMarkers(mapLayerId: string | null) {
  const gate = useGate()
  const all = useLiveQuery(
    () => (mapLayerId ? db.locationMarkers.where('mapLayerId').equals(mapLayerId).toArray() : []),
    [mapLayerId],
    []
  )
  return useMemo(() => gate.filter(all), [gate, all])
}

export function useLocationMarker(id: string | null) {
  return useLiveQuery(() => (id ? db.locationMarkers.get(id) : undefined), [id])
}

export function useAllLocationMarkers(worldId: string | null) {
  const gate = useGate()
  const all = useLiveQuery(
    () => (worldId ? db.locationMarkers.where('worldId').equals(worldId).toArray() : []),
    [worldId],
    []
  )
  return useMemo(() => gate.filter(all), [gate, all])
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
  imageId?: string | null
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
    imageId: data.imageId ?? null,
    iconType: data.iconType,
    tags: data.tags ?? [],
    factionId: null,
    createdAt: now,
    updatedAt: now,
  }
  return journalCreate('location', db.locationMarkers, marker)
}

export async function updateLocationMarker(id: string, data: Partial<Omit<LocationMarker, 'id' | 'createdAt'>>) {
  await journalUpdate('location', db.locationMarkers, id, { ...data, updatedAt: Date.now() })
}

export async function deleteLocationMarker(id: string) {
  await journalDelete('location', db.locationMarkers, id, async () => {
    await db.locationMarkers.delete(id)
    await db.locationSnapshots.where('locationMarkerId').equals(id).delete()
    // Null out stale currentLocationMarkerId references (currentLocationMarkerId is unindexed — filter scan)
    await db.characterSnapshots
      .filter((s) => s.currentLocationMarkerId === id)
      .modify({ currentLocationMarkerId: null })
  }, [db.locationSnapshots, db.characterSnapshots])
}
