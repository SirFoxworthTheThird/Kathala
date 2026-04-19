import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import { generateId } from '@/lib/id'
import type { MapRegion, MapRegionSnapshot, MapRegionStatus } from '@/types'

export function useMapRegions(mapLayerId: string | null) {
  return useLiveQuery(
    () => mapLayerId ? db.mapRegions.where('mapLayerId').equals(mapLayerId).toArray() : [],
    [mapLayerId],
    []
  )
}

export async function createMapRegion(data: {
  worldId: string
  mapLayerId: string
  name: string
  vertices: Array<{ x: number; y: number }>
  fillColor: string
  opacity: number
  notes?: string
}): Promise<MapRegion> {
  const now = Date.now()
  const region: MapRegion = { id: generateId(), ...data, createdAt: now, updatedAt: now }
  await db.mapRegions.add(region)
  return region
}

export async function updateMapRegion(id: string, changes: Partial<Omit<MapRegion, 'id' | 'createdAt'>>) {
  await db.mapRegions.update(id, { ...changes, updatedAt: Date.now() })
}

export async function deleteMapRegion(id: string) {
  await db.mapRegions.delete(id)
  await db.mapRegionSnapshots.where('regionId').equals(id).delete()
}

// ── Region snapshots ─────────────────────────────────────────────────────────

export function useMapRegionSnapshot(regionId: string | null, eventId: string | null) {
  return useLiveQuery(
    () =>
      regionId && eventId
        ? db.mapRegionSnapshots.where('[regionId+eventId]').equals([regionId, eventId]).first()
        : undefined,
    [regionId, eventId]
  )
}

export function useEventRegionSnapshots(eventId: string | null) {
  return useLiveQuery(
    () => eventId ? db.mapRegionSnapshots.where('eventId').equals(eventId).toArray() : [],
    [eventId],
    []
  )
}

export async function upsertMapRegionSnapshot(data: {
  worldId: string
  regionId: string
  eventId: string
  status: MapRegionStatus
  notes?: string
}): Promise<void> {
  const existing = await db.mapRegionSnapshots
    .where('[regionId+eventId]')
    .equals([data.regionId, data.eventId])
    .first()
  if (existing) {
    await db.mapRegionSnapshots.update(existing.id, { status: data.status, notes: data.notes, updatedAt: Date.now() })
  } else {
    const snap: MapRegionSnapshot = {
      id: generateId(),
      worldId: data.worldId,
      regionId: data.regionId,
      eventId: data.eventId,
      status: data.status,
      notes: data.notes,
      updatedAt: Date.now(),
    }
    await db.mapRegionSnapshots.add(snap)
  }
}
