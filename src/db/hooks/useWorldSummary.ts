import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../database'

export interface WorldSummary {
  chapters: number
  characters: number
}

/**
 * The two numbers a world card can show without opening the world (**SEL-3**).
 *
 * The card carried a name, an unlabelled date and a truncated description —
 * less than the Library card for the same world, which is the one you see once
 * rather than a hundred times.
 *
 * Counted rather than loaded: `count()` on an indexed `worldId` does not
 * materialise the rows, so a shelf of twenty worlds costs forty index counts
 * instead of forty full table reads.
 */
export function useWorldSummary(worldId: string | null): WorldSummary {
  return useLiveQuery(
    async () => {
      if (!worldId) return { chapters: 0, characters: 0 }
      const [chapters, characters] = await Promise.all([
        db.chapters.where('worldId').equals(worldId).count(),
        db.characters.where('worldId').equals(worldId).count(),
      ])
      return { chapters, characters }
    },
    [worldId],
    { chapters: 0, characters: 0 },
  )
}
