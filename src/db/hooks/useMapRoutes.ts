import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import { useGate } from './ReadingGateContext'
import { journalCreate, journalUpdate, journalDelete } from './useOperations'
import { generateId } from '@/lib/id'
import type { MapRoute, RouteType } from '@/types'
import { routeRevealed } from '@/lib/mapGating'

export function useMapRoutes(mapLayerId: string | null) {
  const gate = useGate()
  const all = useLiveQuery(
    () => mapLayerId ? db.mapRoutes.where('mapLayerId').equals(mapLayerId).toArray() : [],
    [mapLayerId],
    []
  )
  // Shared with the search palette, which reads this table directly — see
  // `mapGating`. These were two implementations and they disagreed.
  // Layer-revealed is `true` here: this hook is already scoped to a layer the
  // caller is looking at.
  return useMemo(
    () => all.filter((r) => routeRevealed(gate, r, () => true)),
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
