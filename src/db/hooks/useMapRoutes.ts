import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import { useGate } from './ReadingGateContext'
import { journalCreate, journalUpdate, journalDelete } from './useOperations'
import { generateId } from '@/lib/id'
import type { MapRoute, RouteType } from '@/types'

export function useMapRoutes(mapLayerId: string | null) {
  const gate = useGate()
  const all = useLiveQuery(
    () => mapLayerId ? db.mapRoutes.where('mapLayerId').equals(mapLayerId).toArray() : [],
    [mapLayerId],
    []
  )
  // A route is drawn between markers, so it waits for them: "the road to X"
  // names X as surely as the marker does. Waypoints can also be bare
  // coordinates, which have nothing to reveal and nothing to wait for.
  return useMemo(
    () => all.filter((r) => gate.linksRevealed(r.waypoints.filter((w): w is string => typeof w === 'string'))),
    [all, gate],
  )
}

export async function createMapRoute(data: {
  worldId: string
  mapLayerId: string
  name: string
  routeType: RouteType
  waypoints: Array<string | { x: number; y: number }>
  color?: string
  notes?: string
}): Promise<MapRoute> {
  const now = Date.now()
  const route: MapRoute = { id: generateId(), ...data, createdAt: now, updatedAt: now }
  await journalCreate('mapRoute', db.mapRoutes, route)
  return route
}

export async function updateMapRoute(id: string, changes: Partial<Omit<MapRoute, 'id' | 'createdAt'>>) {
  await journalUpdate('mapRoute', db.mapRoutes, id, { ...changes, updatedAt: Date.now() })
}

export async function deleteMapRoute(id: string) {
  await journalDelete('mapRoute', db.mapRoutes, id, async () => {
    await db.mapRoutes.delete(id)
  })
}
