import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import type { TravelMode } from '@/types'
import { generateId } from '@/lib/id'

export function useTravelModes(worldId: string | null) {
  return useLiveQuery(
    () => worldId ? db.travelModes.where('worldId').equals(worldId).sortBy('name') : [],
    [worldId],
    []
  )
}

export async function createTravelMode(data: Pick<TravelMode, 'worldId' | 'name' | 'speedPerDay'>): Promise<TravelMode> {
  const now = Date.now()
  const mode: TravelMode = {
    id: generateId(),
    ...data,
    createdAt: now,
    updatedAt: now,
  }
  await db.travelModes.add(mode)
  return mode
}

export async function updateTravelMode(id: string, data: Partial<Pick<TravelMode, 'name' | 'speedPerDay'>>) {
  await db.travelModes.update(id, { ...data, updatedAt: Date.now() })
}

export async function deleteTravelMode(id: string) {
  await db.transaction('rw', [db.travelModes, db.characterSnapshots], async () => {
    await db.travelModes.delete(id)
    // Clear the reference from any snapshots that used this mode
    await db.characterSnapshots
      .filter((s) => s.travelModeId === id)
      .modify({ travelModeId: null })
  })
}
