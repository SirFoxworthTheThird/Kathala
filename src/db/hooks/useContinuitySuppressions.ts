import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import { generateId } from '@/lib/id'
import type { ContinuitySuppression } from '@/types'

export function useContinuitySuppressions(worldId: string | null): {
  suppressedIds: Set<string>
  suppressedNotes: Record<string, string>
} {
  const rows = useLiveQuery(
    () => worldId ? db.continuitySuppressions.where('worldId').equals(worldId).toArray() : [],
    [worldId],
    [] as ContinuitySuppression[]
  )
  const suppressedIds = useMemo(() => new Set(rows.map((r) => r.issueId)), [rows])
  const suppressedNotes = useMemo(
    () => Object.fromEntries(rows.filter((r) => r.note).map((r) => [r.issueId, r.note])),
    [rows]
  )
  return { suppressedIds, suppressedNotes }
}

export async function toggleContinuitySuppression(worldId: string, issueId: string): Promise<void> {
  const existing = await db.continuitySuppressions
    .where('[worldId+issueId]').equals([worldId, issueId]).first()
  if (existing) {
    await db.continuitySuppressions.delete(existing.id)
  } else {
    await db.continuitySuppressions.add({ id: generateId(), worldId, issueId, note: '' })
  }
}

export async function setContinuitySuppressionNote(worldId: string, issueId: string, note: string): Promise<void> {
  const existing = await db.continuitySuppressions
    .where('[worldId+issueId]').equals([worldId, issueId]).first()
  if (existing) {
    await db.continuitySuppressions.update(existing.id, { note })
  } else {
    // Create with note in a single write (suppress + note at once)
    await db.continuitySuppressions.add({ id: generateId(), worldId, issueId, note })
  }
}
