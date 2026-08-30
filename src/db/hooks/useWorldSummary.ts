import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../database'
import { lastOperationAt } from './useOperations'

export interface WorldSummary {
  chapters: number
  characters: number
  /**
   * When the journal last recorded a change in this world, or null when it has
   * nothing to say — a fresh world, an import that reset it, or records
   * predating v52. `worldActivity` turns that into the line the card shows.
   */
  lastOperationAt: number | null
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
 *
 * The third read is one *row* rather than a count, and is held to the same
 * standard — see `lastOperationAt`, which is a seek rather than a scan of a
 * table that grows with every edit ever made. It is shared with `listWorlds`
 * so the date a card prints and the order the cards are in cannot disagree.
 */
export function useWorldSummary(worldId: string | null): WorldSummary {
  return useLiveQuery(
    async () => {
      if (!worldId) return EMPTY
      const [chapters, characters, newest] = await Promise.all([
        db.chapters.where('worldId').equals(worldId).count(),
        db.characters.where('worldId').equals(worldId).count(),
        lastOperationAt(worldId),
      ])
      return { chapters, characters, lastOperationAt: newest }
    },
    [worldId],
    EMPTY,
  )
}

const EMPTY: WorldSummary = { chapters: 0, characters: 0, lastOperationAt: null }
