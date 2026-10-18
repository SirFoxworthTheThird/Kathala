import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import { generateId } from '@/lib/id'
import type { AuditFinding } from '@/types'

/** What the last AI audit of a world found, as kept when its reply was pasted back. */
export function useAuditFindings(worldId: string | null): AuditFinding[] {
  return useLiveQuery(
    () => (worldId ? db.auditFindings.where('worldId').equals(worldId).sortBy('createdAt') : []),
    [worldId],
    [] as AuditFinding[],
  )
}

/**
 * Keep a new audit's findings in place of the last one's: an audit is a
 * reading of the book as it stood, and a second reading supersedes the first
 * rather than piling up beside it. One transaction, so the checker never sees
 * the old findings gone and the new ones not yet there.
 */
export async function keepAuditFindings(
  worldId: string,
  findings: ReadonlyArray<Omit<AuditFinding, 'id' | 'worldId' | 'createdAt'>>,
): Promise<void> {
  const now = Date.now()
  await db.transaction('rw', db.auditFindings, async () => {
    await db.auditFindings.where('worldId').equals(worldId).delete()
    await db.auditFindings.bulkAdd(findings.map((f, i) => ({ ...f, id: generateId(), worldId, createdAt: now + i })))
  })
}
