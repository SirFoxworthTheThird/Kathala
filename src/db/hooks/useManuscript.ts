import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import type { SceneText } from '@/types'
import { generateId } from '@/lib/id'
import { wordCount } from '@/lib/manuscript'
import { logWritingProgress } from '@/db/hooks/useWritingLog'
import { createWorld } from '@/db/hooks/useWorlds'

/** Keep at most this many past versions per scene; oldest are pruned. */
export const MAX_SCENE_REVISIONS = 20
/** Successive saves within this window collapse into one revision boundary. */
export const REVISION_COALESCE_MS = 2 * 60 * 1000

/**
 * Record `text` as a past version of a scene. Time-coalesced: within
 * `REVISION_COALESCE_MS` of the latest revision it's a no-op (so a burst of
 * autosaves yields one snapshot), unless `force` is set. Exact duplicates of the
 * latest revision are always skipped. Prunes to `MAX_SCENE_REVISIONS`.
 */
export async function captureSceneRevision(
  worldId: string,
  eventId: string,
  text: string,
  count: number,
  now = Date.now(),
  force = false,
): Promise<void> {
  if (!text.trim()) return
  const latest = await db.sceneRevisions
    .where('[eventId+createdAt]').between([eventId, 0], [eventId, Infinity]).last()

  if (latest) {
    if (latest.text === text) return // no change since last snapshot
    if (!force && now - latest.createdAt < REVISION_COALESCE_MS) return // same session
  }

  await db.sceneRevisions.add({ id: generateId(), worldId, eventId, text, wordCount: count, createdAt: now })

  const all = await db.sceneRevisions
    .where('[eventId+createdAt]').between([eventId, 0], [eventId, Infinity]).toArray()
  if (all.length > MAX_SCENE_REVISIONS) {
    const excess = all.slice(0, all.length - MAX_SCENE_REVISIONS) // ascending by createdAt
    await db.sceneRevisions.bulkDelete(excess.map((r) => r.id))
  }
}
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
  text: string,
  opts: { captureRevision?: boolean } = {}
): Promise<void> {
  const { captureRevision = true } = opts
  const existing = await db.sceneTexts.where('eventId').equals(eventId).first()
  const now = Date.now()
  const oldCount = existing?.wordCount ?? 0
  const newCount = text.trim() ? wordCount(text) : 0

  // Snapshot the outgoing prose before it's overwritten or cleared.
  if (captureRevision && existing && existing.text.trim() && existing.text !== text) {
    await captureSceneRevision(worldId, eventId, existing.text, existing.wordCount, now)
  }

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
