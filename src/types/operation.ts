/**
 * The operation journal — the local-first foundation (see issue #115).
 *
 * Every journalled mutation writes two things in one IndexedDB transaction: the
 * record itself, and an `Operation` describing the change. The journal is what
 * makes the store replayable rather than just current, which is the
 * prerequisite for undo, for durable backup, and eventually for sync.
 *
 * Nothing here talks to a network. The journal is purely local; a world with no
 * cloud features simply accumulates operations that are pruned on a schedule.
 */

export type OperationType = 'create' | 'update' | 'delete'

/**
 * Entity groups that carry a journal — the things a writer creates, edits and
 * deletes directly, and would therefore expect to be able to undo.
 *
 * Per-event snapshot records are included: state changes at an event are as
 * much a writer's edit as anything else, and snapshots are only ever written by
 * a direct user action — the "inherit from the previous chapter" behaviour is
 * resolved at read time, so there is no bulk snapshot write to drown the
 * journal in.
 */
export type OperationEntity =
  | 'character'
  | 'characterGoal'
  | 'item'
  | 'location'
  | 'timeline'
  | 'chapter'
  | 'event'
  | 'relationship'
  | 'lorePage'
  | 'faction'
  | 'plotThread'
  | 'motif'
  | 'knowledgeFact'
  | 'characterSnapshot'
  | 'itemPlacement'
  | 'locationSnapshot'
  | 'itemSnapshot'
  | 'relationshipSnapshot'
  | 'mapRegionSnapshot'

export interface Operation {
  /** Stable, client-generated. Replaying the same id twice is a no-op. */
  id: string
  worldId: string
  entityType: OperationEntity
  entityId: string
  type: OperationType
  /**
   * Monotonic per world, assigned at write time. Gives a deterministic replay
   * order without depending on wall-clock timestamps, which can go backwards.
   */
  seq: number
  /** Which device produced this. Stable per browser profile. */
  deviceId: string
  /**
   * The record's `version` before this operation applied — 0 for a create.
   * Conflict *detection* is out of scope here (that's #118); this is recorded
   * now so the journal doesn't need a migration later.
   */
  baseVersion: number
  /**
   * For `create`, the whole record. For `update`, only the changed fields. For
   * `delete`, the record as it was, so the operation can be inverted.
   */
  payload: Record<string, unknown>
  /**
   * The fields an `update` touched. Kept separately from `payload` so a
   * field-level merge (#118) doesn't have to infer intent from key presence.
   */
  changedFields: string[]
  createdAt: number
}

/**
 * A deleted record's headstone. Unlike dropping the row, this lets a later
 * replay know the deletion happened rather than treating the absence as
 * "never existed" — which is what makes a stale device unable to resurrect it.
 */
export interface Tombstone {
  id: string
  worldId: string
  entityType: OperationEntity
  entityId: string
  /** Version the record held when deleted. */
  version: number
  deviceId: string
  deletedAt: number
}

/**
 * Fields every journalled record carries. `version` increments on each write,
 * so an operation can name the state it was based on.
 */
export interface Versioned {
  version: number
}
