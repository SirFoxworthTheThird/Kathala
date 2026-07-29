import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import { journalCreate, journalUpdate, journalDelete } from './useOperations'
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
  await journalCreate('timelineRelationship', db.timelineRelationships, relationship)
  return relationship
}

export async function updateTimelineRelationship(
  id: string,
  data: Partial<Omit<TimelineRelationship, 'id' | 'worldId' | 'createdAt'>>
) {
  await journalUpdate('timelineRelationship', db.timelineRelationships, id, { ...data, updatedAt: Date.now() })
}

/** Deletes a relationship and all cross-timeline artifacts that reference it. */
export async function deleteTimelineRelationship(id: string) {
  await journalDelete('timelineRelationship', db.timelineRelationships, id, async (rel) => {
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
  }, [db.crossTimelineArtifacts])
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
  await journalCreate('crossTimelineArtifact', db.crossTimelineArtifacts, artifact)
  return artifact
}

export async function updateCrossTimelineArtifact(
  id: string,
  data: Partial<Omit<CrossTimelineArtifact, 'id' | 'worldId' | 'createdAt'>>
) {
  await journalUpdate('crossTimelineArtifact', db.crossTimelineArtifacts, id, { ...data, updatedAt: Date.now() })
}

export async function deleteCrossTimelineArtifact(id: string) {
  await journalDelete('crossTimelineArtifact', db.crossTimelineArtifacts, id, async () => {
    await db.crossTimelineArtifacts.delete(id)
  })
}
