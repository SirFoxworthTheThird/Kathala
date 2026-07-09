import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import type { SceneText } from '@/types'
import { generateId } from '@/lib/id'
import { wordCount } from '@/lib/manuscript'

/** The scene prose for a single event (or undefined while loading / none yet). */
export function useSceneText(eventId: string | null) {
  return useLiveQuery(
    () => (eventId ? db.sceneTexts.where('eventId').equals(eventId).first() : undefined),
    [eventId]
  )
}

/** All scene texts in a world — used for aggregate views (totals, pacing). */
export function useWorldSceneTexts(worldId: string | null) {
  return useLiveQuery(
    () => (worldId ? db.sceneTexts.where('worldId').equals(worldId).toArray() : []),
    [worldId],
    []
  )
}

/** All scene texts for a timeline's events, keyed by eventId for quick lookup. */
export function useSceneTextsByEvent(worldId: string | null) {
  const texts = useWorldSceneTexts(worldId)
  return new Map(texts.map((t) => [t.eventId, t]))
}

/**
 * Create or update the prose for an event's scene. One SceneText per event —
 * looks up any existing record and overwrites it, recomputing the word count.
 * Passing empty prose deletes the record so blank scenes leave no residue.
 */
export async function setSceneText(
  worldId: string,
  eventId: string,
  text: string
): Promise<void> {
  const existing = await db.sceneTexts.where('eventId').equals(eventId).first()
  const now = Date.now()

  if (!text.trim()) {
    if (existing) await db.sceneTexts.delete(existing.id)
    return
  }

  if (existing) {
    await db.sceneTexts.update(existing.id, {
      text,
      wordCount: wordCount(text),
      updatedAt: now,
    })
    return
  }

  const record: SceneText = {
    id: generateId(),
    worldId,
    eventId,
    text,
    wordCount: wordCount(text),
    createdAt: now,
    updatedAt: now,
  }
  await db.sceneTexts.add(record)
}
