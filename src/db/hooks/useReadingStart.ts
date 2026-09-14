import { db } from '@/db/database'
import { useAppStore } from '@/store'
import { seedReadingStart } from '@/lib/readingPosition'

/**
 * Open a newly arrived world at its first scene, if it is one a reader will
 * read. The decision lives in `src/lib/readingPosition.ts`; this supplies it
 * with Dexie and the store.
 *
 * Call it where a world *arrives* — a Library download, an imported `.pwk` —
 * and not where one is opened, for the reason given on `seedReadingStart`.
 */
export function startReadingAtOpening(worldId: string): Promise<string | null> {
  return seedReadingStart(worldId, {
    isReadingMode: async (id) => !!(await db.worlds.get(id))?.readingMode,
    load: async (id) => ({
      chapters: await db.chapters.where('worldId').equals(id).toArray(),
      events: await db.events.where('worldId').equals(id).toArray(),
    }),
    seed: (id, eventId) => useAppStore.getState().seedReadingPosition(id, eventId),
  })
}
