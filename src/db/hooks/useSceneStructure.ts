import type { Table } from 'dexie'
import { db } from '@/db/database'
import { journalDelete, journalGroup, journalUpdate } from './useOperations'
import { captureSceneRevision } from './useManuscript'
import { createEventAt, deleteEvent } from './useTimeline'
import { compareByPosition } from '@/lib/fractionalOrder'
import { recomputeSnapshotSortKeysForEvent } from '@/lib/sortKey'
import { joinProse, mergeSceneFields, splitCarries, splitProse } from '@/lib/sceneStructure'
import { wordCount } from '@/lib/manuscript'
import { generateId } from '@/lib/id'
import type { WorldEvent } from '@/types'
import type { OperationEntity } from '@/types/operation'

/**
 * Splitting a scene in two and joining two into one, as single undoable acts.
 *
 * The rules — where the cut falls, what the halves carry, how two scenes'
 * fields combine — are `src/lib/sceneStructure.ts`. This is the writing, and
 * the thing that makes it hard: a scene is pointed at from a dozen tables, and
 * every pointer has to be accounted for, and put back by undo.
 */

type Row = { id: string; worldId: string; eventId: string } & Record<string, unknown>

/**
 * Records that belong to one scene and one thing in it — at most one per
 * pair, so a join has to decide which to keep when both scenes have one. The
 * later scene's wins: the joined scene ends where the later one ended, and a
 * state recorded at its end is the one that is true after it.
 */
const PER_SCENE: Array<{ entity: OperationEntity; table: () => Table<Row, string>; key: (r: Row) => string }> = [
  { entity: 'characterSnapshot', table: () => db.characterSnapshots as never, key: (r) => String(r.characterId) },
  { entity: 'itemPlacement', table: () => db.itemPlacements as never, key: (r) => String(r.itemId) },
  { entity: 'locationSnapshot', table: () => db.locationSnapshots as never, key: (r) => String(r.locationMarkerId) },
  { entity: 'itemSnapshot', table: () => db.itemSnapshots as never, key: (r) => String(r.itemId) },
  { entity: 'relationshipSnapshot', table: () => db.relationshipSnapshots as never, key: (r) => String(r.relationshipId) },
  { entity: 'mapRegionSnapshot', table: () => db.mapRegionSnapshots as never, key: (r) => String(r.regionId) },
  { entity: 'characterMovement', table: () => db.characterMovements as never, key: (r) => String(r.characterId) },
  { entity: 'knowledgeReveal', table: () => db.knowledgeReveals as never, key: (r) => `${String(r.factId)}|${String(r.characterId)}` },
]

/** Records that point at a scene — a goal's span, when a fact is learned — and are repointed, not merged. */
const POINTERS: Array<{ entity: OperationEntity; table: () => Table<Record<string, unknown> & { id: string; worldId: string }, string>; fields: string[] }> = [
  { entity: 'characterGoal', table: () => db.characterGoals as never, fields: ['startEventId', 'endEventId'] },
  { entity: 'factionMembership', table: () => db.factionMemberships as never, fields: ['startEventId', 'endEventId'] },
  { entity: 'knowledgeFact', table: () => db.knowledgeFacts as never, fields: ['readerLearnsAtEventId', 'originEventId'] },
  { entity: 'lorePage', table: () => db.lorePages as never, fields: ['visibleFromEventId'] },
  { entity: 'relationship', table: () => db.relationships as never, fields: ['startEventId'] },
  { entity: 'plotThread', table: () => db.plotThreads as never, fields: ['resolvedEventId'] },
]

async function inChapterOrder(chapterId: string): Promise<WorldEvent[]> {
  return (await db.events.where('chapterId').equals(chapterId).toArray()).sort(compareByPosition)
}

async function proseOf(eventId: string): Promise<string | null> {
  return (await db.sceneTexts.where('eventId').equals(eventId).first())?.text ?? null
}

/**
 * Write a scene's prose as part of a restructuring. Not `setSceneText`: moving
 * words between scenes is not writing them, so it logs no writing progress. The
 * outgoing text is kept in the scene's History, forced past the usual
 * coalescing, so the version from before the restructuring is always there.
 */
async function replaceProse(worldId: string, eventId: string, text: string | null): Promise<void> {
  const existing = await db.sceneTexts.where('eventId').equals(eventId).first()
  const now = Date.now()
  if (existing && existing.text !== (text ?? '')) {
    await captureSceneRevision(worldId, eventId, existing.text, existing.wordCount ?? 0, now, true)
  }
  if (!text || !text.trim()) {
    if (existing) await db.sceneTexts.delete(existing.id)
    return
  }
  if (existing) await db.sceneTexts.update(existing.id, { text, wordCount: wordCount(text), updatedAt: now })
  else await db.sceneTexts.add({ id: generateId(), worldId, eventId, text, wordCount: wordCount(text), createdAt: now, updatedAt: now })
}

/**
 * Split a scene at `at` — an offset into its prose — into itself and a new
 * scene straight after it titled `title`. The new scene carries the room and
 * who is in it (`splitCarries`); its prose is everything after the cut. Nothing
 * recorded at the scene moves: its states stay on the first half, and the
 * second half reads them back as the last known. One undo takes it all back,
 * prose included. Returns the new scene.
 */
export async function splitScene(eventId: string, at: number, title: string): Promise<WorldEvent | undefined> {
  const scene = await db.events.get(eventId)
  if (!scene) return undefined
  const before = await proseOf(eventId)
  const { head, tail } = splitProse(before ?? '', at)
  const index = (await inChapterOrder(scene.chapterId)).findIndex((e) => e.id === eventId) + 1

  const created = await journalGroup(async () => {
    const made = await createEventAt(scene.chapterId, index, title, splitCarries(scene))
    if (!made) return undefined
    // The prose, on an operation of the act, so undo and redo move it too.
    await journalUpdate('event', db.events, eventId, { updatedAt: Date.now() }, [], {
      prose: [
        { eventId, before, after: head || null },
        { eventId: made.id, before: null, after: tail || null },
      ],
    })
    return made
  })
  if (!created) return undefined
  await replaceProse(scene.worldId, eventId, head)
  await replaceProse(scene.worldId, created.id, tail)
  return created
}

/** The scene after `eventId` in its chapter, if there is one to join. */
export async function nextInChapter(eventId: string): Promise<WorldEvent | undefined> {
  const scene = await db.events.get(eventId)
  if (!scene) return undefined
  const order = await inChapterOrder(scene.chapterId)
  return order[order.findIndex((e) => e.id === eventId) + 1]
}

/**
 * Join the next scene in the chapter onto this one, and remove it.
 *
 * - The prose is this scene's, a paragraph break, then the next one's.
 * - The fields combine by `mergeSceneFields`.
 * - Everything recorded at the next scene moves here; where both recorded
 *   something about the same character, item or place, the next scene's is
 *   kept (see `PER_SCENE`).
 * - Everything that pointed at the next scene points here.
 *
 * One undo takes it all back: the scene returns with its prose, its records
 * and everything pointing at it. Returns whether there was a scene to join.
 */
export async function joinWithNext(eventId: string): Promise<boolean> {
  const first = await db.events.get(eventId)
  const second = await nextInChapter(eventId)
  if (!first || !second) return false
  const firstProse = await proseOf(first.id)
  const joined = joinProse(firstProse, await proseOf(second.id))

  await journalGroup(async () => {
    await journalUpdate('event', db.events, first.id, { ...mergeSceneFields(first, second), updatedAt: Date.now() }, [], {
      prose: [{ eventId: first.id, before: firstProse, after: joined || null }],
    })

    for (const { entity, table, key } of PER_SCENE) {
      const t = table()
      const here = await t.where('eventId').equals(first.id).toArray()
      for (const row of await t.where('eventId').equals(second.id).toArray()) {
        const clash = here.find((h) => key(h) === key(row))
        if (clash) await journalDelete(entity, t as never, clash.id, async () => { await t.delete(clash.id) })
        await journalUpdate(entity, t as never, row.id, { eventId: first.id, updatedAt: Date.now() })
      }
    }

    for (const { entity, table, fields } of POINTERS) {
      const t = table()
      for (const row of await t.where('worldId').equals(first.worldId).toArray()) {
        const moved: Record<string, unknown> = {}
        for (const f of fields) if (row[f] === second.id) moved[f] = first.id
        if (Object.keys(moved).length > 0) await journalUpdate(entity, t as never, row.id, { ...moved, updatedAt: Date.now() })
      }
    }

    // A frame narrative's sync points name scenes inside a list on the record.
    for (const rel of await db.timelineRelationships.where('worldId').equals(first.worldId).toArray()) {
      if (!rel.syncPoints.some((p) => p.innerEventId === second.id || p.outerEventId === second.id)) continue
      const syncPoints = rel.syncPoints.map((p) => ({
        innerEventId: p.innerEventId === second.id ? first.id : p.innerEventId,
        outerEventId: p.outerEventId === second.id ? first.id : p.outerEventId,
      }))
      await journalUpdate('timelineRelationship', db.timelineRelationships, rel.id, { syncPoints, updatedAt: Date.now() })
    }

    // Nothing is left pointing at it but its own prose and history, which go with it.
    await deleteEvent(second.id)
  })

  await recomputeSnapshotSortKeysForEvent(first.id)
  await replaceProse(first.worldId, first.id, joined)
  return true
}
