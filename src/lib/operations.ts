import type { Operation, OperationEntity, OperationType, Tombstone } from '@/types/operation'

/**
 * Pure operation-journal logic. Everything here is a plain function over plain
 * data so it can be unit-tested without IndexedDB — the Dexie side lives in
 * `src/db/hooks/useOperations.ts`.
 */

export interface MakeOperationInput {
  id: string
  worldId: string
  entityType: OperationEntity
  entityId: string
  type: OperationType
  seq: number
  deviceId: string
  baseVersion: number
  payload: Record<string, unknown>
  now?: number
}

/** Fields that describe the record's identity or journal bookkeeping rather
 *  than its content — never counted as a user-visible change. */
const NON_CONTENT_FIELDS = new Set(['id', 'worldId', 'createdAt', 'updatedAt', 'version'])

export function contentFields(payload: Record<string, unknown>): string[] {
  return Object.keys(payload).filter((k) => !NON_CONTENT_FIELDS.has(k)).sort()
}

export function makeOperation(input: MakeOperationInput): Operation {
  return {
    id: input.id,
    worldId: input.worldId,
    entityType: input.entityType,
    entityId: input.entityId,
    type: input.type,
    seq: input.seq,
    deviceId: input.deviceId,
    baseVersion: input.baseVersion,
    payload: input.payload,
    changedFields: input.type === 'update' ? contentFields(input.payload) : [],
    createdAt: input.now ?? Date.now(),
  }
}

/**
 * Apply an operation to a record, returning the new state.
 *
 * Idempotent by construction: `create` on an existing record and `update` on a
 * record already at or past the operation's resulting version both return the
 * record unchanged, so replaying a journal — or retrying a half-finished sync —
 * cannot duplicate or double-apply a change. `delete` returns null.
 */
export function applyOperation<T extends { id: string; version: number }>(
  record: T | undefined,
  op: Operation,
): T | null {
  switch (op.type) {
    case 'create':
      // Already present: a replay, not a new record.
      if (record) return record
      return { ...(op.payload as unknown as T), version: 1 }

    case 'update': {
      if (!record) return null // update to something deleted or never seen
      // The op was built on baseVersion and produces baseVersion + 1. If the
      // record is already there, this operation has been applied.
      if (record.version > op.baseVersion) return record
      return { ...record, ...(op.payload as Partial<T>), version: op.baseVersion + 1 }
    }

    case 'delete':
      return null
  }
}

/**
 * Replay a journal over a starting state. Operations are sorted by `seq`, so
 * the result does not depend on the order they arrive in.
 */
export function replay<T extends { id: string; version: number }>(
  initial: T | undefined,
  ops: Operation[],
): T | null {
  const ordered = [...ops].sort((a, b) => a.seq - b.seq)
  let state: T | null = initial ?? null
  for (const op of ordered) {
    state = applyOperation(state ?? undefined, op)
  }
  return state
}

/**
 * The operation that undoes `op`, given the record as it was beforehand.
 *
 * This is the undo primitive: a create inverts to a delete, a delete to a
 * create, and an update to an update carrying the previous values of exactly
 * the fields it touched. Returns null when the inverse can't be known — an
 * update or delete with no `before` state.
 */
export function invertOperation(
  op: Operation,
  before: Record<string, unknown> | undefined,
  next: { id: string; seq: number; now?: number },
): Operation | null {
  const base: Omit<Operation, 'type' | 'payload' | 'changedFields' | 'id' | 'seq' | 'createdAt'> = {
    worldId: op.worldId,
    entityType: op.entityType,
    entityId: op.entityId,
    deviceId: op.deviceId,
    baseVersion: op.baseVersion + 1,
  }
  const shell = { id: next.id, seq: next.seq, createdAt: next.now ?? Date.now() }

  if (op.type === 'create') {
    return { ...base, ...shell, type: 'delete', payload: op.payload, changedFields: [] }
  }

  if (op.type === 'delete') {
    // The delete recorded the whole record, so the inverse re-creates it.
    return {
      ...base,
      ...shell,
      type: 'create',
      payload: op.payload,
      changedFields: [],
      baseVersion: 0,
    }
  }

  if (!before) return null
  const restored: Record<string, unknown> = {}
  for (const field of op.changedFields) restored[field] = before[field]
  return {
    ...base,
    ...shell,
    type: 'update',
    payload: restored,
    changedFields: [...op.changedFields].sort(),
  }
}

export function makeTombstone(input: {
  id: string
  worldId: string
  entityType: OperationEntity
  entityId: string
  version: number
  deviceId: string
  now?: number
}): Tombstone {
  return {
    id: input.id,
    worldId: input.worldId,
    entityType: input.entityType,
    entityId: input.entityId,
    version: input.version,
    deviceId: input.deviceId,
    deletedAt: input.now ?? Date.now(),
  }
}

/**
 * Journal entries safe to discard: everything below `keepFromSeq`, except the
 * newest operation per entity, which is retained so an entity's last-known
 * state stays explainable after pruning.
 */
export function prunableOperations(ops: Operation[], keepFromSeq: number): Operation[] {
  const newestByEntity = new Map<string, number>()
  for (const op of ops) {
    const key = `${op.entityType}:${op.entityId}`
    newestByEntity.set(key, Math.max(newestByEntity.get(key) ?? -1, op.seq))
  }
  return ops.filter((op) => {
    if (op.seq >= keepFromSeq) return false
    return newestByEntity.get(`${op.entityType}:${op.entityId}`) !== op.seq
  })
}
