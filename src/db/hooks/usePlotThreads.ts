import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import { useGate } from './ReadingGateContext'
import { journalCreate, journalUpdate, journalDelete } from './useOperations'
import type { PlotThread } from '@/types'
import { generateId } from '@/lib/id'

export function usePlotThreads(worldId: string | null) {
  const gate = useGate()
  const all = useLiveQuery(
    () => (worldId ? db.plotThreads.where('worldId').equals(worldId).sortBy('createdAt') : []),
    [worldId],
    [] as PlotThread[]
  )
  // Named for where the subplot goes rather than where it starts, so it waits
  // for the first event that advances it.
  return useMemo(() => gate.filter(all), [all, gate])
}

export function usePlotThread(id: string | null) {
  return useLiveQuery(() => (id ? db.plotThreads.get(id) : undefined), [id])
}

export async function createPlotThread(
  data: Pick<PlotThread, 'worldId' | 'name' | 'color'> & Partial<Pick<PlotThread, 'description'>>
): Promise<PlotThread> {
  const now = Date.now()
  const thread: PlotThread = { description: '', ...data, id: generateId(), createdAt: now, updatedAt: now }
  return journalCreate('plotThread', db.plotThreads, thread)
}

export async function updatePlotThread(id: string, data: Partial<Omit<PlotThread, 'id' | 'createdAt'>>) {
  await journalUpdate('plotThread', db.plotThreads, id, { ...data, updatedAt: Date.now() })
}

/** Deletes a thread and removes it from every event's threadIds. */
export async function deletePlotThread(id: string) {
  await journalDelete('plotThread', db.plotThreads, id, async () => {
    await db.plotThreads.delete(id)
    await db.events.filter((e) => (e.threadIds ?? []).includes(id)).modify((e) => {
      e.threadIds = e.threadIds.filter((t) => t !== id)
    })
  }, [db.events])
}
