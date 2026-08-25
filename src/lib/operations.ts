import { ENTITY_LABEL } from '@/lib/entityTables'
import { recordName } from '@/lib/operationSubject'
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
export function describeInverse(op: Operation, subject?: string | null): string {
  const flipped: OperationType =
    op.type === 'create' ? 'delete' : op.type === 'delete' ? 'create' : 'update'
  return describeOperation({ ...op, type: flipped }, subject)
}

/** A short human description of an operation, for the history list and toasts. */
/**
 * Field names that do not survive being de-camelised into something a writer
 * would recognise. Everything else is handled by the rule below, so this list
 * stays short rather than becoming a second copy of the schema.
 */
const FIELD_LABEL: Record<string, string> = {
  povCharacterId: 'point of view',
  inWorldTime: 'date',
  isAlive: 'alive or dead',
  isFlashback: 'flashback',
  structureBeat: 'structure beat',
  travelDays: 'travel time',
  linkedMapLayerId: 'linked sub-map',
  scalePixelsPerUnit: 'scale',
  parentMapId: 'parent map',
  mentionedCharacterIds: 'mentioned characters',
}

/** A field name as a writer would say it. */
export function fieldLabel(field: string): string {
  const override = FIELD_LABEL[field]
  if (override) return override
  return field
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    // `imageId` is the image; `threadIds` are the threads. The id is how we
    // store the thing, not what the writer changed — and dropping the plural
    // with it would turn "threads" into "thread".
    .replace(/ ids$/, 's')
    .replace(/ id$/, '')
}

/**
 * What changed, in words, or `null` when the operation does not say.
 *
 * Journalled updates have recorded `changedFields` all along — `makeOperation`
 * fills it from the payload — and nothing ever read it. Recent Changes said
 * *"Edited scene"* for every edit alike, which an outside review filed as the
 * panel being too generic to act on. It was not missing data; it was unread
 * data.
 *
 * Long lists are cut off rather than wrapped: a row is one line, and the point
 * of the line is to tell one edit from the next, not to enumerate a form.
 */
export function describeChangedFields(fields: readonly string[]): string | null {
  const labels = fields.map(fieldLabel)
  if (labels.length === 0) return null
  if (labels.length === 1) return labels[0]
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`
  return `${labels[0]}, ${labels[1]} and ${labels.length - 2} more`
}

export function describeOperation(op: Operation, subject?: string | null): string {
  const label = ENTITY_LABEL[op.entityType] ?? 'record'
  // The payload first: for a create and a delete it holds the whole record, so
  // it names the thing without a read. `subject` is what the store says the
  // record is called now, and is the only source an ordinary update has — an
  // update stores just the fields it touched, and a scene's cast edit carries
  // no title at all.
  const name = recordName(op.payload) ?? (subject?.trim() || null)
  const verb = op.type === 'create' ? 'Added' : op.type === 'delete' ? 'Deleted' : 'Edited'
  const opening = name ? `${verb} ${label} “${name}”` : `${verb} ${label}`
  // No test on `op.type` here: `makeOperation` records `changedFields` only for
  // an update, so a create and a delete already arrive with none — a guard
  // would be dead code reading like the rule. The fallback is for operations
  // written before the field existed, which are still in people's browsers.
  const detail = describeChangedFields(op.changedFields ?? [])
  return detail ? `${opening} — ${detail}` : opening
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
 * Pruning the journal.
 *
 * The journal grows on every edit and nothing ever needed it to stop, because
 * nothing called this. In a world that never syncs — the common case — it grows
 * for the life of the world, and a failed IndexedDB write in a local-first app
 * with no backend is lost work.
 *
 * Two caps rather than one. A count alone is not a bound on size: an ordinary
 * rename is a few hundred bytes, while deleting a character with forty
 * per-chapter snapshots stores all forty rows in a single entry. Five hundred
 * entries can therefore be kilobytes or megabytes.
 */
export const JOURNAL_MAX_OPERATIONS = 500
export const JOURNAL_MAX_BYTES = 2 * 1024 * 1024
/**
 * Kept whatever the byte cap says, so a run of very large entries can never
 * leave the writer unable to undo what they just did.
 */
export const JOURNAL_MIN_OPERATIONS = 20

/**
 * The point past which even an unacknowledged entry is dropped.
 *
 * Retaining what a peer has not seen is right up to a point, and that point
 * has to exist: a device that stopped syncing months ago would otherwise grow
 * this journal for ever on every other device. Beyond the ceiling the prune
 * proceeds and reports a gap, and the caller declares a discontinuity so the
 * absent peer resynchronises in full instead of trusting a history with a hole
 * in it. Generous enough that an ordinary offline stretch never reaches it.
 */
export const JOURNAL_HARD_MAX_OPERATIONS = 5_000
export const JOURNAL_HARD_MAX_BYTES = 16 * 1024 * 1024

/** Roughly what an operation costs to store. Stable enough to bound growth. */
export function operationSize(op: Operation): number {
  return JSON.stringify(op).length
}

export interface PruneLimits {
  maxOperations?: number
  maxBytes?: number
  minOperations?: number
  /**
   * The oldest sequence another device has yet to see.
   *
   * The caps exist to stop the journal growing without bound, which is the
   * right instinct while the journal is only local undo history. Once it is
   * also what a sync sends, an entry discarded before a peer has taken it is a
   * change that peer will never learn about — silent divergence, discovered
   * weeks later when two copies disagree and neither can say why.
   *
   * Entries from here on are therefore kept past the caps, up to the hard
   * ceiling below. There is no caller yet; the point is that pruning is already
   * safe when there is one.
   */
  retainFromSeq?: number
  hardMaxOperations?: number
  hardMaxBytes?: number
}

export interface PrunePlan {
  /** Oldest first. */
  discard: Operation[]
  keptCount: number
  keptBytes: number
  /**
   * True when the caps forced entries out that a peer had not acknowledged.
   *
   * Better to say so than to let the journal grow for ever behind a device
   * that stopped syncing months ago. The caller's answer is the one the app
   * already uses for a journal it cannot vouch for: declare a discontinuity,
   * so the peer resynchronises in full rather than trusting a history with a
   * hole in it.
   */
  syncGap: boolean
}

/**
 * Which entries to discard to bring a journal back inside its caps.
 *
 * Walks newest-first and keeps until a cap is hit; everything older goes. There
 * is deliberately no per-entity retention: that rule existed to keep every
 * entity's last change explainable, which belonged to a replay-from-zero story
 * the app never adopted — nothing replays the journal, the store is the source
 * of truth for current state. Retaining one entry per entity would also make
 * the byte cap unenforceable, since a large world has thousands of entities.
 */
export function planJournalPrune(ops: Operation[], limits: PruneLimits = {}): PrunePlan {
  const maxOperations = limits.maxOperations ?? JOURNAL_MAX_OPERATIONS
  const maxBytes = limits.maxBytes ?? JOURNAL_MAX_BYTES
  const minOperations = Math.min(limits.minOperations ?? JOURNAL_MIN_OPERATIONS, maxOperations)

  const retainFromSeq = limits.retainFromSeq
  const hardMaxOperations = limits.hardMaxOperations ?? JOURNAL_HARD_MAX_OPERATIONS
  const hardMaxBytes = limits.hardMaxBytes ?? JOURNAL_HARD_MAX_BYTES

  const newestFirst = [...ops].sort((a, b) => b.seq - a.seq)
  let keptCount = 0
  let keptBytes = 0
  const cut = newestFirst.findIndex((op) => {
    const size = operationSize(op)
    // Unacknowledged entries are kept past the soft caps, but not past the
    // hard ceiling — otherwise one silent peer grows this for ever. Walking
    // newest-first means everything before the watermark is also newer than
    // it, so this never resurrects an older entry that was already past.
    const withinCeiling = keptCount < hardMaxOperations && keptBytes + size <= hardMaxBytes
    const unacknowledged = retainFromSeq !== undefined && op.seq >= retainFromSeq && withinCeiling
    const wouldExceed =
      keptCount >= maxOperations || (keptCount >= minOperations && keptBytes + size > maxBytes)
    if (wouldExceed && !unacknowledged) return true
    keptCount += 1
    keptBytes += size
    return false
  })

  if (cut === -1) return { discard: [], keptCount, keptBytes, syncGap: false }
  const discard = newestFirst.slice(cut).reverse()
  return {
    discard,
    keptCount,
    keptBytes,
    syncGap: retainFromSeq !== undefined && discard.some((op) => op.seq >= retainFromSeq),
  }
}
