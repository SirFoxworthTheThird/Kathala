import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import type { Motif } from '@/types'
import { generateId } from '@/lib/id'

export function useMotifs(worldId: string | null) {
  return useLiveQuery(
    () => (worldId ? db.motifs.where('worldId').equals(worldId).sortBy('createdAt') : []),
    [worldId],
    [] as Motif[]
  )
}

export function useMotif(id: string | null) {
  return useLiveQuery(() => (id ? db.motifs.get(id) : undefined), [id])
}

export async function createMotif(
  data: Pick<Motif, 'worldId' | 'name' | 'color'> & Partial<Pick<Motif, 'description'>>
): Promise<Motif> {
  const now = Date.now()
  const motif: Motif = { description: '', ...data, id: generateId(), createdAt: now, updatedAt: now }
  await db.motifs.add(motif)
  return motif
}

export async function updateMotif(id: string, data: Partial<Omit<Motif, 'id' | 'createdAt'>>) {
  await db.motifs.update(id, { ...data, updatedAt: Date.now() })
}

/** Deletes a motif and removes it from every event's motifIds. */
export async function deleteMotif(id: string) {
  await db.transaction('rw', [db.motifs, db.events], async () => {
    await db.motifs.delete(id)
    await db.events.filter((e) => (e.motifIds ?? []).includes(id)).modify((e) => {
      e.motifIds = (e.motifIds ?? []).filter((m) => m !== id)
    })
  })
}
