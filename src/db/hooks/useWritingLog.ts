import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import type { WritingLog } from '@/types'
import { generateId } from '@/lib/id'
import { localDayKey } from '@/lib/writingProgress'

/** All writing-log rows for a world (one per productive day), for the dashboard. */
export function useWritingLogs(worldId: string | null) {
  return useLiveQuery(
    () => (worldId ? db.writingLogs.where('worldId').equals(worldId).toArray() : []),
    [worldId],
    []
  )
}

/**
 * Add a net word delta to today's rollup for a world. Called whenever scene
 * prose is saved: `delta` is (new word count − old word count), so deletions
 * subtract. A no-op when delta is 0. Upserts the single (world × today) row.
 */
export async function logWritingProgress(worldId: string, delta: number, now = Date.now()): Promise<void> {
  if (!delta) return
  const date = localDayKey(now)
  const existing = await db.writingLogs.where('[worldId+date]').equals([worldId, date]).first()
  if (existing) {
    await db.writingLogs.update(existing.id, { words: existing.words + delta, updatedAt: now })
    return
  }
  const record: WritingLog = {
    id: generateId(),
    worldId,
    date,
    words: delta,
    createdAt: now,
    updatedAt: now,
  }
  await db.writingLogs.add(record)
}
