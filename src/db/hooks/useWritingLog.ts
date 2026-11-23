import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import type { WritingLog } from '@/types'
import { generateId } from '@/lib/id'
import { localDayKey } from '@/lib/writingProgress'
import { netChange, type WordChange } from '@/lib/wordChange'
import { counts } from '@/lib/sprints'

/** All writing-log rows for a world (one per productive day), for the dashboard. */
export function useWritingLogs(worldId: string | null) {
  return useLiveQuery(
    () => (worldId ? db.writingLogs.where('worldId').equals(worldId).toArray() : []),
    [worldId],
    []
  )
}

/**
 * Add a save's words to today's rollup for a world, and to the world's sprint
 * while it runs (issue #706, sprints-plan.md, D-5), in one transaction.
 *
 * `change` is the words added and cut (`wordChange`), or a net alone, as a
 * restructuring tells it (`netChange`, S8). A no-op when nothing was added or
 * cut. `eventIds` are the scenes saved, kept on the sprint.
 */
export async function logWritingProgress(
  worldId: string,
  change: WordChange | number,
  now = Date.now(),
  eventIds: readonly string[] = [],
): Promise<void> {
  const { added, cut } = typeof change === 'number' ? netChange(change) : change
  if (!added && !cut) return
  const net = added - cut
  const date = localDayKey(now)
  await db.transaction('rw', [db.writingLogs, db.sprints], async () => {
    const existing = await db.writingLogs.where('[worldId+date]').equals([worldId, date]).first()
    if (existing) {
      await db.writingLogs.update(existing.id, {
        words: existing.words + net,
        added: (existing.added ?? 0) + added,
        cut: (existing.cut ?? 0) + cut,
        updatedAt: now,
      })
    } else {
      const record: WritingLog = { id: generateId(), worldId, date, words: net, added, cut, createdAt: now, updatedAt: now }
      await db.writingLogs.add(record)
    }

    const sprint = (await db.sprints.where('worldId').equals(worldId).toArray()).find((s) => counts(s, now))
    if (sprint) {
      await db.sprints.update(sprint.id, {
        wordsAdded: sprint.wordsAdded + added,
        wordsCut: sprint.wordsCut + cut,
        eventIds: [...new Set([...sprint.eventIds, ...eventIds])],
        updatedAt: now,
      })
    }
  })
}
