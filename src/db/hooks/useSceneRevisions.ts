import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import type { SceneRevision } from '@/types'
import { setSceneText, captureSceneRevision } from '@/db/hooks/useManuscript'

export { MAX_SCENE_REVISIONS, REVISION_COALESCE_MS, captureSceneRevision } from '@/db/hooks/useManuscript'

/** Past versions of a scene, newest first (or empty while loading / none). */
export function useSceneRevisions(eventId: string | null) {
  return useLiveQuery(
    () => (eventId
      ? db.sceneRevisions.where('[eventId+createdAt]').between([eventId, 0], [eventId, Infinity]).reverse().toArray()
      : []),
    [eventId],
    [] as SceneRevision[]
  )
}

/**
 * Restore a scene to a past version. Non-destructive: the current prose is
 * force-captured as a revision first, so the restore itself can be undone.
 */
export async function restoreSceneRevision(revisionId: string): Promise<void> {
  const rev = await db.sceneRevisions.get(revisionId)
  if (!rev) return
  const current = await db.sceneTexts.where('eventId').equals(rev.eventId).first()
  if (current && current.text.trim() && current.text !== rev.text) {
    await captureSceneRevision(rev.worldId, rev.eventId, current.text, current.wordCount, Date.now(), true)
  }
  // Write the restored text without letting setSceneText capture again.
  await setSceneText(rev.worldId, rev.eventId, rev.text, { captureRevision: false })
}

/** Remove a single past version. */
export async function deleteSceneRevision(id: string): Promise<void> {
  await db.sceneRevisions.delete(id)
}
