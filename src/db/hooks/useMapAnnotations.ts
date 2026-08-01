import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import { journalCreate, journalUpdate, journalDelete } from './useOperations'
import { generateId } from '@/lib/id'
import type { MapAnnotation } from '@/types'

export function useMapAnnotations(mapLayerId: string | null) {
  return useLiveQuery(
    () => mapLayerId ? db.mapAnnotations.where('mapLayerId').equals(mapLayerId).toArray() : [],
    [mapLayerId],
    []
  )
}

export async function createMapAnnotation(data: {
  worldId: string
  mapLayerId: string
  x: number
  y: number
  text: string
  fontSize?: number
  color?: string
}): Promise<MapAnnotation> {
  const now = Date.now()
  const annotation: MapAnnotation = {
    id: generateId(),
    fontSize: 14,
    color: '#ffffff',
    ...data,
    createdAt: now,
    updatedAt: now,
  }
  await journalCreate('mapAnnotation', db.mapAnnotations, annotation)
  return annotation
}

export async function updateMapAnnotation(id: string, changes: Partial<Omit<MapAnnotation, 'id' | 'createdAt'>>) {
  await journalUpdate('mapAnnotation', db.mapAnnotations, id, { ...changes, updatedAt: Date.now() })
}

export async function deleteMapAnnotation(id: string) {
  await journalDelete('mapAnnotation', db.mapAnnotations, id, async () => {
    await db.mapAnnotations.delete(id)
  })
}
