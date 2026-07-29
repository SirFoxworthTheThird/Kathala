import type { OperationEntity, Tombstone } from '@/types/operation'

/**
 * Making a deletion survive a merge.
 *
 * `mergeTable` unions records by id, so a record the other device deleted looks
 * simply "local-only" to whoever merges — and comes back. An hour of cutting
 * scenes silently un-cuts itself. Tombstones are the record that the deletion
 * happened rather than the absence being inferred, so merge has to consult them.
 *
 * Pure functions over plain data; the wiring lives in `exportImport.ts`.
 */

/** Which export array each journalled entity group lives in. */
export const TOMBSTONE_TABLE: Record<OperationEntity, string> = {
  character: 'characters',
  characterGoal: 'characterGoals',
  item: 'items',
  location: 'locationMarkers',
  timeline: 'timelines',
  chapter: 'chapters',
  event: 'events',
  relationship: 'relationships',
  lorePage: 'lorePages',
  faction: 'factions',
  plotThread: 'plotThreads',
  motif: 'motifs',
  knowledgeFact: 'knowledgeFacts',
  characterSnapshot: 'characterSnapshots',
  itemPlacement: 'itemPlacements',
  locationSnapshot: 'locationSnapshots',
  itemSnapshot: 'itemSnapshots',
  relationshipSnapshot: 'relationshipSnapshots',
  mapRegionSnapshot: 'mapRegionSnapshots',
}

export interface RecordLike {
  id: string
  updatedAt?: number
}

export interface ApplyResult<T> {
  kept: T[]
  /** Ids removed because the other device deleted them. */
  removed: string[]
  /**
   * Ids a tombstone named but which were edited *after* the deletion, so the
   * record was kept. A genuine delete-versus-edit conflict.
   */
  revived: string[]
}

/**
 * Drop records the incoming tombstones say were deleted.
 *
 * A record edited *after* the other device deleted it is kept, not dropped.
 * Both choices lose something, but keeping is recoverable — the user can delete
 * again — whereas silently discarding work someone did after the fact is not.
 */
export function applyTombstones<T extends RecordLike>(
  records: T[],
  tombstones: Tombstone[],
  table: string,
): ApplyResult<T> {
  const byId = new Map<string, Tombstone>()
  for (const t of tombstones) {
    if (TOMBSTONE_TABLE[t.entityType] !== table) continue
    const existing = byId.get(t.entityId)
    if (!existing || t.deletedAt > existing.deletedAt) byId.set(t.entityId, t)
  }
  if (byId.size === 0) return { kept: records, removed: [], revived: [] }

  const kept: T[] = []
  const removed: string[] = []
  const revived: string[] = []
  for (const record of records) {
    const stone = byId.get(record.id)
    if (!stone) { kept.push(record); continue }
    if ((record.updatedAt ?? 0) > stone.deletedAt) {
      revived.push(record.id)
      kept.push(record)
    } else {
      removed.push(record.id)
    }
  }
  return { kept, removed, revived }
}

/**
 * Union two tombstone sets, one entry per deleted entity, keeping the latest
 * deletion. Both devices' deletions must survive the merge — otherwise the next
 * push carries only half the story and the resurrection happens on the far side.
 */
export function mergeTombstoneSets(local: Tombstone[], incoming: Tombstone[]): Tombstone[] {
  const byEntity = new Map<string, Tombstone>()
  for (const t of [...local, ...incoming]) {
    const key = `${t.entityType}:${t.entityId}`
    const existing = byEntity.get(key)
    if (!existing || t.deletedAt > existing.deletedAt) byEntity.set(key, t)
  }
  return [...byEntity.values()]
}

/**
 * Tombstones for entities that exist again — a record was re-created with the
 * same id after being deleted, so the headstone is stale and would delete the
 * new record on the next merge.
 */
export function pruneStaleTombstones(
  tombstones: Tombstone[],
  liveIds: ReadonlySet<string>,
): Tombstone[] {
  return tombstones.filter((t) => !liveIds.has(t.entityId))
}
