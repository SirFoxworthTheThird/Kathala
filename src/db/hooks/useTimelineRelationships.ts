import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import type { TimelineRelationship, CrossTimelineArtifact } from '@/types'
import { generateId } from '@/lib/id'

// ─── Timeline Relationships ────────────────────────────────────────────────

export function useTimelineRelationships(worldId: string | null) {
  return useLiveQuery(
    () => (worldId ? db.timelineRelationships.where('worldId').equals(worldId).toArray() : []),
    [worldId],
    []
  )
}

export function useTimelineRelationship(id: string | null) {
  return useLiveQuery(() => (id ? db.timelineRelationships.get(id) : undefined), [id])
}

export async function createTimelineRelationship(
  data: Pick<
    TimelineRelationship,
    'worldId' | 'sourceTimelineId' | 'targetTimelineId' | 'type' | 'anchors' | 'syncPoints' | 'label' | 'description'
  >
): Promise<TimelineRelationship> {
  const now = Date.now()
  const relationship: TimelineRelationship = {
    id: generateId(),
    ...data,
    createdAt: now,
    updatedAt: now,
  }
  await db.timelineRelationships.add(relationship)
  return relationship
}

export async function updateTimelineRelationship(
  id: string,
  data: Partial<Omit<TimelineRelationship, 'id' | 'worldId' | 'createdAt'>>
) {
  await db.timelineRelationships.update(id, { ...data, updatedAt: Date.now() })
}

/** Deletes a relationship and all cross-timeline artifacts that reference it. */
export async function deleteTimelineRelationship(id: string) {
  const rel = await db.timelineRelationships.get(id)
  if (!rel) return
  await db.transaction('rw', [db.timelineRelationships, db.crossTimelineArtifacts], async () => {
    await db.timelineRelationships.delete(id)
    // Cascade: remove artifacts that belong to this relationship's timeline pair
    await db.crossTimelineArtifacts
      .where('originTimelineId').equals(rel.sourceTimelineId)
      .filter((a) => a.encounterTimelineId === rel.targetTimelineId)
      .delete()
    await db.crossTimelineArtifacts
      .where('originTimelineId').equals(rel.targetTimelineId)
      .filter((a) => a.encounterTimelineId === rel.sourceTimelineId)
      .delete()
  })
}

// ─── Cross-Timeline Artifacts ──────────────────────────────────────────────

export function useCrossTimelineArtifacts(worldId: string | null) {
  return useLiveQuery(
    () => (worldId ? db.crossTimelineArtifacts.where('worldId').equals(worldId).toArray() : []),
    [worldId],
    []
  )
}

export function useCrossTimelineArtifactsForItem(itemId: string | null) {
  return useLiveQuery(
    () => (itemId ? db.crossTimelineArtifacts.where('itemId').equals(itemId).toArray() : []),
    [itemId],
    []
  )
}

export async function createCrossTimelineArtifact(
  data: Pick<
    CrossTimelineArtifact,
    'worldId' | 'itemId' | 'originTimelineId' | 'encounterTimelineId' | 'encounterNotes'
  >
): Promise<CrossTimelineArtifact> {
  const now = Date.now()
  const artifact: CrossTimelineArtifact = {
    id: generateId(),
    ...data,
    createdAt: now,
    updatedAt: now,
  }
  await db.crossTimelineArtifacts.add(artifact)
  return artifact
}

export async function updateCrossTimelineArtifact(
  id: string,
  data: Partial<Omit<CrossTimelineArtifact, 'id' | 'worldId' | 'createdAt'>>
) {
  await db.crossTimelineArtifacts.update(id, { ...data, updatedAt: Date.now() })
}

export async function deleteCrossTimelineArtifact(id: string) {
  await db.crossTimelineArtifacts.delete(id)
}
