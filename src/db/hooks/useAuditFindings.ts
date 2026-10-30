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
 * rather than piling up beside it. A chapter's audit (`chapter`, its scenes)
 * supersedes only what was found in that chapter: the findings about others
 * stand. One transaction, so the checker never sees the old findings gone and
 * the new ones not yet there.
 */
export async function keepAuditFindings(
  worldId: string,
  findings: ReadonlyArray<Omit<AuditFinding, 'id' | 'worldId' | 'createdAt'>>,
  chapter?: ReadonlySet<string>,
): Promise<void> {
  const now = Date.now()
  await db.transaction('rw', db.auditFindings, async () => {
    const old = db.auditFindings.where('worldId').equals(worldId)
    if (chapter) await old.filter((f) => f.quotes.some((q) => chapter.has(q.eventId))).delete()
    else await old.delete()
    await db.auditFindings.bulkAdd(findings.map((f, i) => ({ ...f, id: generateId(), worldId, createdAt: now + i })))
  })
}
