import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import { useGate } from './ReadingGateContext'
import { journalCreate, journalUpdate, journalDelete, journalGroup } from './useOperations'
import { updateEvent } from './useTimeline'
import { MOTIF_COLORS, nextColor } from '@/lib/tagColors'
import type { Motif } from '@/types'
import { generateId } from '@/lib/id'

export function useMotifs(worldId: string | null) {
  const gate = useGate()
  const all = useLiveQuery(
    () => (worldId ? db.motifs.where('worldId').equals(worldId).sortBy('createdAt') : []),
    [worldId],
    [] as Motif[]
  )
  // Named for where the subplot goes rather than where it starts, so it waits
  // for the first event that advances it.
  return useMemo(() => gate.filter(all), [all, gate])
}

export function useMotif(id: string | null) {
  return useLiveQuery(() => (id ? db.motifs.get(id) : undefined), [id])
}

export async function createMotif(
  data: Pick<Motif, 'worldId' | 'name' | 'color'> & Partial<Pick<Motif, 'description'>>
): Promise<Motif> {
  const now = Date.now()
  const motif: Motif = { description: '', ...data, id: generateId(), createdAt: now, updatedAt: now }
  await journalCreate('motif', db.motifs, motif)
  return motif
}

export async function updateMotif(id: string, data: Partial<Omit<Motif, 'id' | 'createdAt'>>) {
  await journalUpdate('motif', db.motifs, id, { ...data, updatedAt: Date.now() })
}

/** Deletes a motif and removes it from every event's motifIds. */
export async function deleteMotif(id: string) {
  await journalDelete('motif', db.motifs, id, async () => {
    await db.motifs.delete(id)
    await db.events.filter((e) => (e.motifIds ?? []).includes(id)).modify((e) => {
      e.motifIds = (e.motifIds ?? []).filter((m) => m !== id)
    })
  }, [db.events])
}

/** A motif made from a scene's own field, and tagged on that scene, in one undo step: see `createThreadForScene`. */
export async function createMotifForScene(eventId: string, name: string): Promise<Motif | null> {
  const event = await db.events.get(eventId)
  if (!event) return null
  return journalGroup(async () => {
    const made = await db.motifs.where('worldId').equals(event.worldId).count()
    const motif = await createMotif({ worldId: event.worldId, name, color: nextColor(MOTIF_COLORS, made) })
    await updateEvent(eventId, { motifIds: [...new Set([...(event.motifIds ?? []), motif.id])] })
    return motif
  }, { label: `New motif “${name}”` })
}
