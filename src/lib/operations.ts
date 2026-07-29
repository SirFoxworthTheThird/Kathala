import { ENTITY_LABEL } from '@/lib/entityTables'
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
  /** Prior values of the changed fields — what undo restores to. */
  previous?: Record<string, unknown>
  groupId?: string
  undoOf?: string
  now?: number
}

/** Fields that describe the record's identity or journal bookkeeping rather
 *  than its content — never counted as a user-visible change. */
const NON_CONTENT_FIELDS = new Set(['id', 'worldId', 'createdAt', 'updatedAt', 'version'])

export function contentFields(payload: Record<string, unknown>): string[] {
  return Object.keys(payload).filter((k) => !NON_CONTENT_FIELDS.has(k)).sort()
}

export function makeOperation(input: MakeOperationInput): Operation {
  const changedFields = input.type === 'update' ? contentFields(input.payload) : []
  const op: Operation = {
    id: input.id,
    worldId: input.worldId,
    entityType: input.entityType,
    entityId: input.entityId,
    type: input.type,
    seq: input.seq,
    deviceId: input.deviceId,
    baseVersion: input.baseVersion,
    payload: input.payload,
    changedFields,
    createdAt: input.now ?? Date.now(),
  }
  // Only carry `previous` for updates — a create has nothing before it, and a
  // delete already stores the whole record in `payload`.
  if (input.type === 'update' && input.previous) {
    const prior: Record<string, unknown> = {}
    for (const field of changedFields) prior[field] = input.previous[field]
    op.previous = prior
  }
  if (input.groupId) op.groupId = input.groupId
  if (input.undoOf) op.undoOf = input.undoOf
  return op
}

/** How long a burst of edits to the same field stays one undo step. */
export const COALESCE_WINDOW_MS = 5_000

/**
 * Whether `next` continues the same act as `prev` and should fold into it.
 *
 * A debounced prose editor writes an operation every time the user pauses
 * typing, so a single paragraph becomes dozens of journal entries. Undoing one
 * of those steps back a fraction of a sentence — useless on its own, and it
 * fights the textarea's own undo, which the user already has. Folding a burst
 * into one entry makes undo mean "take back what I just wrote".
 *
 * Deliberately strict: same entity, same device, the same field set, both plain
 * updates, and inside the window. Anything else is a separate act.
 */
export function shouldCoalesce(
  prev: Operation | undefined,
  next: { entityType: OperationEntity; entityId: string; deviceId: string; type: OperationType; payload: Record<string, unknown> },
  now: number,
  windowMs = COALESCE_WINDOW_MS,
): boolean {
  if (!prev) return false
  if (prev.type !== 'update' || next.type !== 'update') return false
  if (prev.undoOf || prev.undoneBy) return false
  if (prev.groupId) return false
  if (prev.entityType !== next.entityType || prev.entityId !== next.entityId) return false
  if (prev.deviceId !== next.deviceId) return false
  if (now - prev.createdAt > windowMs) return false
  const fields = contentFields(next.payload)
  if (fields.length !== prev.changedFields.length) return false
  return fields.every((f, i) => prev.changedFields[i] === f)
}

/**
 * Fold a continuing edit into the operation it extends.
 *
 * Keeps the earlier operation's identity, `seq`, `baseVersion` and `previous` —
 * undo has to restore the state from before the *burst* began, not before its
 * last keystroke — while taking the newer values and timestamp.
 */
export function coalesceOperations(prev: Operation, next: Operation): Operation {
  return {
    ...prev,
    payload: { ...prev.payload, ...next.payload },
    createdAt: next.createdAt,
  }
}

/**
 * What *reversing* an operation would do, described from the user's side.
 *
 * Redo works by inverting an undo, so the entry it points at is the undo — for
 * a created character that reads "Deleted…", the opposite of what the button is
 * about to do. This flips the verb so the label matches the effect.
 */
export function describeInverse(op: Operation): string {
  const flipped: OperationType =
    op.type === 'create' ? 'delete' : op.type === 'delete' ? 'create' : 'update'
  return describeOperation({ ...op, type: flipped })
}

/** A short human description of an operation, for the history list and toasts. */
export function describeOperation(op: Operation): string {
  const label = ENTITY_LABEL[op.entityType] ?? 'record'
  const name = typeof op.payload.name === 'string' && op.payload.name.trim()
    ? op.payload.name.trim()
    : typeof op.payload.title === 'string' && op.payload.title.trim()
      ? op.payload.title.trim()
      : null
  const verb = op.type === 'create' ? 'Added' : op.type === 'delete' ? 'Deleted' : 'Edited'
  return name ? `${verb} ${label} “${name}”` : `${verb} ${label}`
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
  next: { id: string; seq: number; now?: number; groupId?: string; as?: 'undo' | 'redo' },
): Operation | null {
  const base: Omit<Operation, 'type' | 'payload' | 'changedFields' | 'id' | 'seq' | 'createdAt'> = {
    worldId: op.worldId,
    entityType: op.entityType,
    entityId: op.entityId,
    deviceId: op.deviceId,
    baseVersion: op.baseVersion + 1,
    // An undo is marked so it never appears in the undo stack itself —
    // otherwise pressing undo twice would redo the first one. A redo is marked
    // differently *because* it should be undoable: it puts a change back with
    // nothing else accounting for it.
    ...(next.as === 'redo' ? { redoOf: op.id } : { undoOf: op.id }),
    ...(next.groupId ? { groupId: next.groupId } : {}),
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
      // Carry the cascade onto the restoring create. Redoing the delete means
      // inverting *this* operation, and without the list of what the original
      // delete swept up, the redo would remove the record and orphan the rest.
      ...(op.cascade ? { cascade: op.cascade } : {}),
    }
  }

  // The operation carries its own before-image; the explicit argument is a
  // fallback for callers that still have the record in hand.
  const prior = before ?? op.previous
  if (!prior) return null
  const restored: Record<string, unknown> = {}
  const overwritten: Record<string, unknown> = {}
  for (const field of op.changedFields) {
    restored[field] = prior[field]
    // What this inverse is about to overwrite — the values the original edit
    // put there. Without it the inverse has no before-image of its own, and
    // inverting it again (which is exactly what redo does) restores nothing.
    overwritten[field] = op.payload[field]
  }
  return {
    ...base,
    ...shell,
    type: 'update',
    payload: restored,
    previous: overwritten,
    changedFields: [...op.changedFields].sort(),
  }
}

/**
 * The operations an undo would take back: the newest act that hasn't already
 * been undone, and isn't itself an undo. Returns the whole group when the act
 * spanned several records, newest first.
 */
export function undoableBatch(ops: Operation[]): Operation[] {
  const candidates = ops
    .filter((op) => !op.undoOf && !op.undoneBy)
    .sort((a, b) => b.seq - a.seq)
  const head = candidates[0]
  if (!head) return []
  if (!head.groupId) return [head]
  return candidates.filter((op) => op.groupId === head.groupId)
}

/**
 * The operations a redo would put back, or empty when there is nothing.
 *
 * Redo survives only while nothing new has been done since the undo — the rule
 * every text editor follows. Make a fresh edit after undoing and the redo is
 * gone, because putting the change back would land it on a world that has since
 * moved on, producing a state the user never had.
 */
export function redoableBatch(ops: Operation[]): Operation[] {
  if (ops.length === 0) return []
  const ordered = [...ops].sort((a, b) => b.seq - a.seq)

  // Ordinary work at the head clears the redo history. The head may equally be
  // a *redo* — pressing redo twice has to keep working — so this test only
  // rules out new edits; it does not pick the target.
  const head = ordered[0]
  if (!head.undoOf && !head.redoOf) return []

  // The most recent undo not yet put back, which walks the undos in reverse:
  // the same last-in-first-out order the undo stack uses.
  const target = ordered.find((op) => op.undoOf && !op.redoneBy)
  if (!target) return []
  if (!target.groupId) return [target]
  return ordered.filter((op) => op.groupId === target.groupId)
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
