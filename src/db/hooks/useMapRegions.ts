import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import { generateId } from '@/lib/id'
import type { MapRegion, MapRegionSnapshot, MapRegionStatus } from '@/types'
import { selectBestSnapshots } from '@/lib/snapshotUtils'
import { useWorldEvents, useWorldChapters } from './useTimeline'

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
  const region: MapRegion = { id: generateId(), linkedMapLayerId: null, ...data, createdAt: now, updatedAt: now }
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

/**
 * Returns the best region snapshot per region at or before `activeEventId`,
 * using the same inherited-state pattern as character/location snapshots.
 */
export function useBestRegionSnapshots(worldId: string | null, activeEventId: string | null) {
  const allSnaps = useLiveQuery(
    () => worldId ? db.mapRegionSnapshots.where('worldId').equals(worldId).toArray() : [],
    [worldId],
    []
  )
  const allEvents = useWorldEvents(worldId)
  const allChapters = useWorldChapters(worldId)

  return useMemo(
    () => selectBestSnapshots(allSnaps, activeEventId, allEvents, allChapters, (s) => s.regionId),
    [allSnaps, activeEventId, allEvents, allChapters]
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
