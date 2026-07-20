import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import type { SceneText } from '@/types'
import { generateId } from '@/lib/id'
import { wordCount } from '@/lib/manuscript'
import { logWritingProgress } from '@/db/hooks/useWritingLog'
import { createWorld } from '@/db/hooks/useWorlds'
import { createTimeline, createChapter, createEvent } from '@/db/hooks/useTimeline'
import type { ParsedManuscript } from '@/lib/manuscriptImport'

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
  const oldCount = existing?.wordCount ?? 0
  const newCount = text.trim() ? wordCount(text) : 0

  if (!text.trim()) {
    if (existing) await db.sceneTexts.delete(existing.id)
    await logWritingProgress(worldId, newCount - oldCount, now)
    return
  }

  if (existing) {
    await db.sceneTexts.update(existing.id, {
      text,
      wordCount: newCount,
      updatedAt: now,
    })
    await logWritingProgress(worldId, newCount - oldCount, now)
    return
  }

  const record: SceneText = {
    id: generateId(),
    worldId,
    eventId,
    text,
    wordCount: newCount,
    createdAt: now,
    updatedAt: now,
  }
  await db.sceneTexts.add(record)
  await logWritingProgress(worldId, newCount - oldCount, now)
}

/**
 * Create a fresh world from a parsed manuscript: one Main Timeline, a chapter
 * per parsed chapter (numbered in order), a scene event per parsed scene, and
 * the prose stored as that event's SceneText. Returns the new world's id.
 */
export async function createWorldFromManuscript(
  parsed: ParsedManuscript,
  worldName: string
): Promise<string> {
  const name = worldName.trim() || parsed.title?.trim() || 'Imported Manuscript'
  const world = await createWorld({ name, description: '' })
  const timeline = await createTimeline({
    worldId: world.id,
    name: 'Main Timeline',
    description: '',
    color: '#60a5fa',
  })

  let chapterNumber = 1
  for (const pc of parsed.chapters) {
    const chapter = await createChapter({
      worldId: world.id,
      timelineId: timeline.id,
      number: chapterNumber++,
      title: pc.title,
      synopsis: '',
    })

    let sortOrder = 0
    for (let i = 0; i < pc.scenes.length; i++) {
      const event = await createEvent({
        worldId: world.id,
        chapterId: chapter.id,
        timelineId: timeline.id,
        title: `Scene ${i + 1}`,
        description: '',
        locationMarkerId: null,
        involvedCharacterIds: [],
        involvedItemIds: [],
        tags: [],
        sortOrder: sortOrder++,
      })
      await setSceneText(world.id, event.id, pc.scenes[i].text)
    }
  }

  return world.id
}
