import Dexie, { type Table, type EntityTable } from 'dexie'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import { generateId } from '@/lib/id'
import { getDeviceId } from '@/lib/deviceId'
import {
  coalesceOperations,
  invertOperation,
  makeOperation,
  makeTombstone,
  prunableOperations,
  shouldCoalesce,
  undoableBatch,
  redoableBatch,
} from '@/lib/operations'
import { ENTITY_TABLE } from '@/lib/entityTables'
import type { Operation, OperationEntity, OperationType, Tombstone } from '@/types/operation'

/**
 * The Dexie side of the operation journal (#115).
 *
 * The single rule this file exists to enforce: a record and the operation
 * describing its change are written in one transaction, so the journal can
 * never disagree with the store. Everything is local — no network work happens
 * here, and none is required for a mutation to be considered committed.
 */

/** Tables a journalled write touches, beyond the entity's own table. */
const JOURNAL_TABLES = (): Table[] => [db.operations, db.tombstones]

/** Rows of a table belonging to one world, by primary key. */
async function rowsByWorld(t: Table, worldId: string): Promise<Map<string, unknown>> {
  const out = new Map<string, unknown>()
  let rows: unknown[]
  try {
    rows = await t.where('worldId').equals(worldId).toArray()
  } catch {
    // Not every table indexes worldId; fall back to the whole table rather
    // than losing the cascade.
    rows = await t.toArray()
  }
  for (const row of rows) {
    const id = (row as { id?: string }).id
    if (id) out.set(id, row)
  }
  return out
}

/**
 * Capture the rows a cascading delete is about to remove.
 *
 * Done by diffing the tables the caller declared it would touch, rather than by
 * asking each of the fifteen delete paths to report its own cascade. A path
 * that forgot to report would produce an undo that silently drops records,
 * which is exactly the kind of partial history this journal exists to avoid.
 */
async function captureCascade(
  tables: Table[],
  worldId: string,
  primaryTable: string,
  entityId: string,
  apply: () => Promise<unknown>,
): Promise<{ result: unknown; cascade: Record<string, unknown[]> }> {
  const before = new Map<string, Map<string, unknown>>()
  for (const t of tables) before.set(t.name, await rowsByWorld(t, worldId))

  const result = await apply()

  const cascade: Record<string, unknown[]> = {}
  for (const t of tables) {
    const prior = before.get(t.name)
    if (!prior || prior.size === 0) continue
    const stillThere = await rowsByWorld(t, worldId)
    const gone: unknown[] = []
    for (const [id, row] of prior) {
      if (stillThere.has(id)) continue
      // The record itself is already stored on the operation's payload.
      if (t.name === primaryTable && id === entityId) continue
      gone.push(row)
    }
    if (gone.length > 0) cascade[t.name] = gone
  }
  return { result, cascade }
}

/**
 * Next sequence number for a world. Monotonic and gap-tolerant: we only need a
 * deterministic replay order, not a dense range.
 */
async function nextSeq(worldId: string): Promise<number> {
  return ((await latestOperation(worldId))?.seq ?? 0) + 1
}

/** The most recent operation for a world — the only candidate for coalescing. */
async function latestOperation(worldId: string): Promise<Operation | undefined> {
  return db.operations
    .where('[worldId+seq]')
    .between([worldId, Dexie.minKey], [worldId, Dexie.maxKey])
    .last()
}

export interface JournalledWrite<T> {
  worldId: string
  entityType: OperationEntity
  entityId: string
  type: OperationType
  /** Create: the whole record. Update: changed fields only. Delete: prior record. */
  payload: Record<string, unknown>
  /** Runs inside the transaction, after the operation is staged. */
  apply: () => Promise<T>
  /** The record's version before this write (missing → 1). */
  baseVersion?: number
  /** The record as it was, so undo can restore the fields this write changes. */
  previous?: Record<string, unknown>
  /**
   * Fold into the preceding operation when it's the same act continuing — for
   * debounced editors, where one paragraph would otherwise become dozens of
   * undo steps. Opt-in: a discrete action like dragging a marker twice is two
   * acts, and should stay two.
   */
  coalesce?: boolean
}

/**
 * The group an in-flight user act belongs to, if any.
 *
 * Module-scoped rather than threaded through every call site because the acts
 * that need it (reordering two events) invoke unrelated entity helpers that
 * have no reason to know about grouping. Set only for the duration of
 * `journalGroup`'s callback.
 */
let currentGroupId: string | null = null

/**
 * Deletions that happened, announced so the UI can offer to take them back.
 *
 * An event rather than a direct store call so the data layer stays free of UI
 * imports, and so the offer is made in one place instead of at each of the
 * nineteen delete sites, where a new one would sooner or later be added
 * without it.
 */
export interface DeletionNotice {
  worldId: string
  /** How many records the act deleted — a bulk delete is one notice, not many. */
  count: number
  entityType: OperationEntity
  payload: Record<string, unknown>
}

type DeletionListener = (notice: DeletionNotice) => void
const deletionListeners = new Set<DeletionListener>()

export function onDeletion(listener: DeletionListener): () => void {
  deletionListeners.add(listener)
  return () => deletionListeners.delete(listener)
}

function announceDeletion(notice: DeletionNotice) {
  for (const listener of deletionListeners) listener(notice)
}

/** Deletions seen while a group is open, held back so the group reports once. */
let groupDeletions: DeletionNotice[] = []

/**
 * Run several journalled writes as one user act, so undo takes back all of them
 * or none — and so a bulk delete offers one undo rather than one per record.
 * Nesting reuses the outer group.
 */
export async function journalGroup<T>(fn: () => Promise<T>): Promise<T> {
  if (currentGroupId) return fn()
  currentGroupId = generateId()
  groupDeletions = []
  try {
    return await fn()
  } finally {
    const deletions = groupDeletions
    currentGroupId = null
    groupDeletions = []
    if (deletions.length > 0) {
      announceDeletion({ ...deletions[0], count: deletions.length })
    }
  }
}

/**
 * Record an operation and apply the matching change atomically.
 *
 * Callers pass `apply` rather than the write itself so an entity's existing
 * cascade logic (deleting a character also clears its snapshots, relationships
 * and goals) stays where it lives, instead of being reimplemented here.
 */
export async function withJournal<T>(
  tables: Table[],
  write: JournalledWrite<T>,
): Promise<T> {
  const deviceId = getDeviceId()
  const groupId = currentGroupId
  return db.transaction('rw', [...tables, ...JOURNAL_TABLES()], async () => {
    const baseVersion = write.baseVersion ?? 1
    const now = Date.now()

    // A continuing edit extends the operation already in the journal instead of
    // adding another, so `seq` is not consumed and undo still restores to the
    // state from before the burst started.
    if (write.coalesce && !groupId) {
      const prev = await latestOperation(write.worldId)
      if (prev && shouldCoalesce(prev, { ...write, deviceId }, now)) {
        const merged = coalesceOperations(
          prev,
          makeOperation({
            id: prev.id,
            worldId: write.worldId,
            entityType: write.entityType,
            entityId: write.entityId,
            type: write.type,
            seq: prev.seq,
            deviceId,
            baseVersion,
            payload: write.payload,
            now,
          }),
        )
        await db.operations.put(merged)
        return write.apply()
      }
    }

    // The before-image undo restores to. Read here rather than trusted to the
    // caller: `withJournal` is invoked directly in places that predate undo,
    // and an update that quietly arrived without one would produce a journal
    // entry that looks undoable and silently isn't.
    let previous = write.previous
    if (write.type === 'update' && !previous) {
      const t = tableFor(write.entityType)
      if (t) previous = (await t.get(write.entityId)) as Record<string, unknown> | undefined
    }

    const seq = await nextSeq(write.worldId)
    const op = makeOperation({
      id: generateId(),
      worldId: write.worldId,
      entityType: write.entityType,
      entityId: write.entityId,
      type: write.type,
      seq,
      deviceId,
      baseVersion: write.type === 'create' ? 0 : baseVersion,
      payload: write.payload,
      previous,
      groupId: groupId ?? undefined,
      now,
    })
    await db.operations.add(op)
    if (write.type !== 'delete') return write.apply()

    await db.tombstones.add(
      makeTombstone({
        id: generateId(),
        worldId: write.worldId,
        entityType: write.entityType,
        entityId: write.entityId,
        version: baseVersion,
        deviceId,
      }),
    )
    const { result, cascade } = await captureCascade(
      tables,
      write.worldId,
      ENTITY_TABLE[write.entityType],
      write.entityId,
      write.apply,
    )
    if (Object.keys(cascade).length > 0) {
      await db.operations.update(op.id, { cascade })
    }
    const notice: DeletionNotice = {
      worldId: write.worldId,
      count: 1,
      entityType: write.entityType,
      payload: write.payload,
    }
    if (groupId) groupDeletions.push(notice)
    else announceDeletion(notice)
    return result as T
  })
}

// ── Convenience wrappers ─────────────────────────────────────────────────────

/** The shape every journalled record shares. */
export interface JournalledRecord {
  id: string
  worldId: string
  version?: number
}

/** Records predating the journal — and older `.pwk` imports — carry no version. */
export function versionOf(record: { version?: number } | undefined): number {
  return record?.version ?? 1
}

/**
 * The three wrappers below exist so an entity group joins the seam in one line
 * per operation instead of fifteen. Anything with cascade logic passes it as
 * `apply` on `journalDelete`; everything else needs nothing bespoke.
 */
export async function journalCreate<T extends JournalledRecord>(
  entityType: OperationEntity,
  table: EntityTable<T, 'id'>,
  record: T,
  extraTables: Table[] = [],
): Promise<T> {
  const t = table as unknown as Table<T, string>
  const withVersion = { ...record, version: 1 }
  return withJournal([t, ...extraTables], {
    worldId: record.worldId,
    entityType,
    entityId: record.id,
    type: 'create',
    payload: withVersion as unknown as Record<string, unknown>,
    apply: async () => {
      await t.add(withVersion)
      return withVersion
    },
  })
}

export async function journalUpdate<T extends JournalledRecord>(
  entityType: OperationEntity,
  table: EntityTable<T, 'id'>,
  id: string,
  data: Record<string, unknown>,
  extraTables: Table[] = [],
  options: { coalesce?: boolean } = {},
): Promise<void> {
  const t = table as unknown as Table<T, string>
  const existing = await t.get(id)
  if (!existing) return
  const base = versionOf(existing)
  const patch = { ...data, version: base + 1 }
  await withJournal([t, ...extraTables], {
    worldId: existing.worldId,
    entityType,
    entityId: id,
    type: 'update',
    baseVersion: base,
    payload: patch,
    previous: existing as unknown as Record<string, unknown>,
    coalesce: options.coalesce,
    apply: async () => { await t.update(id, patch as never) },
  })
}

/**
 * `apply` receives the record as it was, and is responsible for the delete plus
 * any cascade. The prior record is stored on the operation so the delete can be
 * inverted back into a create.
 */
export async function journalDelete<T extends JournalledRecord>(
  entityType: OperationEntity,
  table: EntityTable<T, 'id'>,
  id: string,
  apply: (record: T) => Promise<void>,
  extraTables: Table[] = [],
): Promise<void> {
  const t = table as unknown as Table<T, string>
  const existing = await t.get(id)
  if (!existing) return
  await withJournal([t, ...extraTables], {
    worldId: existing.worldId,
    entityType,
    entityId: id,
    type: 'delete',
    baseVersion: versionOf(existing),
    payload: existing as unknown as Record<string, unknown>,
    apply: () => apply(existing),
  })
}

// ── Reads ────────────────────────────────────────────────────────────────────

export function useOperations(worldId: string | null, limit = 100) {
  return useLiveQuery(
    async () => {
      if (!worldId) return []
      const all = await db.operations.where('worldId').equals(worldId).reverse().sortBy('seq')
      return all.slice(0, limit)
    },
    [worldId, limit],
    [],
  )
}

export async function listOperations(worldId: string): Promise<Operation[]> {
  return db.operations.where('worldId').equals(worldId).sortBy('seq')
}

export async function operationsForEntity(
  entityType: OperationEntity,
  entityId: string,
): Promise<Operation[]> {
  const ops = await db.operations
    .where('[entityType+entityId]')
    .equals([entityType, entityId])
    .toArray()
  return ops.sort((a, b) => a.seq - b.seq)
}

/**
 * Highest journal seq for a world, or 0 for an empty journal. Folder sync uses
 * this to answer "do we have edits the folder hasn't seen?" without diffing the
 * whole store.
 */
export async function latestSeq(worldId: string): Promise<number> {
  const latest = await db.operations
    .where('[worldId+seq]')
    .between([worldId, Dexie.minKey], [worldId, Dexie.maxKey])
    .last()
  return latest?.seq ?? 0
}

export async function listTombstones(worldId: string): Promise<Tombstone[]> {
  return db.tombstones.where('worldId').equals(worldId).toArray()
}

export async function isDeleted(entityType: OperationEntity, entityId: string): Promise<boolean> {
  const hit = await db.tombstones
    .where('[entityType+entityId]')
    .equals([entityType, entityId])
    .first()
  return !!hit
}

// ── Undo ─────────────────────────────────────────────────────────────────────

/**
 * The act undo would take back next, or an empty array when there's nothing.
 *
 * Only journalled single-record edits are undoable. Bulk paths (AI generation,
 * chapter import, world import) reset the journal via `markJournalDiscontinuity`
 * precisely because they are one authorial act rather than hundreds, so undo is
 * empty straight after one — a deliberate limit, surfaced in the UI rather than
 * left to look like a bug.
 */
export async function pendingUndo(worldId: string): Promise<Operation[]> {
  return undoableBatch(await listOperations(worldId))
}

/**
 * Just the operation undo would take back next.
 *
 * The toolbar button needs only this — its label and disabled state — and it is
 * mounted for the whole session, so it re-runs on every write. Reading the
 * world's entire journal and sorting it in JS to look at one entry was enough
 * to slow ordinary editing measurably. Walking the `[worldId+seq]` index
 * backwards stops at the first candidate, which is almost always the first
 * record examined.
 */
export function useUndoHead(worldId: string | null) {
  return useLiveQuery(
    async () => {
      if (!worldId) return undefined
      return db.operations
        .where('[worldId+seq]')
        .between([worldId, Dexie.minKey], [worldId, Dexie.maxKey])
        .reverse()
        .filter((op) => !op.undoOf && !op.undoneBy)
        .first()
    },
    [worldId],
    undefined,
  )
}

export function useUndoStack(worldId: string | null, limit = 30) {
  return useLiveQuery(
    async () => {
      if (!worldId) return []
      const all = await db.operations.where('worldId').equals(worldId).toArray()
      return all
        .filter((op) => !op.undoOf && !op.undoneBy)
        .sort((a, b) => b.seq - a.seq)
        .slice(0, limit)
    },
    [worldId, limit],
    [],
  )
}

/** Dexie table for an entity group, or undefined if it isn't on the seam. */
function tableFor(entityType: OperationEntity): Table<Record<string, unknown>, string> | undefined {
  const name = ENTITY_TABLE[entityType]
  if (!name) return undefined
  return (db as unknown as Record<string, unknown>)[name] as Table<Record<string, unknown>, string> | undefined
}

/**
 * Take back the most recent act.
 *
 * The inverse is written as a new operation rather than by deleting the
 * original: the journal stays a complete account of what happened, which is the
 * whole point of having one. Both the original and its inverse are then marked
 * so neither shows up in the undo stack, so pressing undo repeatedly walks
 * backwards instead of toggling the same change on and off.
 *
 * Returns the operations undone, so the caller can describe what it did.
 */
export async function undoLast(worldId: string): Promise<Operation[]> {
  return reverseBatch(worldId, await pendingUndo(worldId), 'undo')
}

/** The act redo would put back, or empty when there is nothing. */
export async function pendingRedo(worldId: string): Promise<Operation[]> {
  if (!(await redoHead(worldId))) return []
  return redoableBatch(await listOperations(worldId))
}

/**
 * The undo a redo would put back, or undefined.
 *
 * Two steps, so the common case stays cheap: the head test rules out a redo
 * outright whenever the newest entry is ordinary work — nearly always — without
 * reading the journal at all. Only once something has been undone does it walk
 * the index back for the target.
 */
async function redoHead(worldId: string): Promise<Operation | undefined> {
  const head = await latestOperation(worldId)
  if (!head || (!head.undoOf && !head.redoOf)) return undefined
  return db.operations
    .where('[worldId+seq]')
    .between([worldId, Dexie.minKey], [worldId, Dexie.maxKey])
    .reverse()
    .filter((op) => !!op.undoOf && !op.redoneBy)
    .first()
}

/** The undo a redo would put back — for the toolbar button's label and state. */
export function useRedoHead(worldId: string | null) {
  return useLiveQuery(
    async () => (worldId ? redoHead(worldId) : undefined),
    [worldId],
    undefined,
  )
}

/**
 * Put back the act that was just undone.
 *
 * Redo is the same machinery as undo pointed at the undo itself: inverting an
 * inverse restores the original change. The result is marked `redoOf` rather
 * than `undoOf` so it lands back on the undo stack — Ctrl+Z after a redo should
 * take the change away again.
 */
export async function redoLast(worldId: string): Promise<Operation[]> {
  return reverseBatch(worldId, await pendingRedo(worldId), 'redo')
}

/**
 * Apply the inverse of every operation in `batch`, writing each inverse to the
 * journal rather than deleting what it reverses — the journal stays a complete
 * account of what happened, which is the whole point of having one.
 *
 * Shared by undo and redo because they are the same operation in opposite
 * directions; only the mark left behind differs.
 */
async function reverseBatch(
  worldId: string,
  batch: Operation[],
  as: 'undo' | 'redo',
): Promise<Operation[]> {
  if (batch.length === 0) return []

  const tables = new Set<Table>([db.operations, db.tombstones])
  for (const op of batch) {
    const t = tableFor(op.entityType)
    if (t) tables.add(t as unknown as Table)
    // Restoring a cascade writes tables the operation's own entity never
    // names, and Dexie needs every one declared up front.
    for (const name of Object.keys(op.cascade ?? {})) {
      const ct = (db as unknown as Record<string, unknown>)[name] as Table | undefined
      if (ct) tables.add(ct)
    }
  }

  const reversalGroupId = batch.length > 1 ? generateId() : undefined

  await db.transaction('rw', [...tables], async () => {
    let seq = (await latestOperation(worldId))?.seq ?? 0
    // Newest first: a group's later writes are reversed before earlier ones.
    for (const op of batch) {
      const inverse = invertOperation(op, op.previous, {
        id: generateId(),
        seq: ++seq,
        groupId: reversalGroupId,
        as,
      })
      if (!inverse) continue

      const t = tableFor(op.entityType)
      if (t) {
        if (inverse.type === 'delete') {
          await t.delete(op.entityId)
          // Redoing a delete has to sweep up what the original delete did, or
          // the record goes while its snapshots, goals and memberships are left
          // behind pointing at nothing.
          for (const [name, rows] of Object.entries(op.cascade ?? {})) {
            const ct = (db as unknown as Record<string, unknown>)[name] as
              | Table<Record<string, unknown>, string>
              | undefined
            if (!ct) continue
            await ct.bulkDelete((rows as { id: string }[]).map((r) => r.id))
          }
          // Undoing a create is still a deletion as far as the rest of the
          // world is concerned. Without a headstone, a device that already
          // received the record would treat it as merely absent on the next
          // merge and hand it straight back.
          await db.tombstones.add(
            makeTombstone({
              id: generateId(),
              worldId,
              entityType: op.entityType,
              entityId: op.entityId,
              version: op.baseVersion + 1,
              deviceId: getDeviceId(),
            }),
          )
        } else if (inverse.type === 'create') {
          await t.put(inverse.payload)
          // Everything the delete swept up alongside the record.
          for (const [name, rows] of Object.entries(op.cascade ?? {})) {
            const ct = (db as unknown as Record<string, unknown>)[name] as
              | Table<Record<string, unknown>, string>
              | undefined
            if (ct) await ct.bulkPut(rows as Record<string, unknown>[])
          }
          // Undoing a delete brings the record back, so its tombstone must go
          // or the next merge would remove it all over again.
          const stale = await db.tombstones
            .where('[entityType+entityId]')
            .equals([op.entityType, op.entityId])
            .toArray()
          if (stale.length > 0) await db.tombstones.bulkDelete(stale.map((s) => s.id))
        } else {
          const existing = await t.get(op.entityId)
          if (existing) {
            await t.update(op.entityId, {
              ...inverse.payload,
              version: versionOf(existing as { version?: number }) + 1,
              updatedAt: Date.now(),
            })
          }
        }
      }

      await db.operations.add(inverse)
      await db.operations.update(
        op.id,
        as === 'redo' ? { redoneBy: inverse.id } : { undoneBy: inverse.id },
      )
    }
  })

  return batch
}

// ── Maintenance ──────────────────────────────────────────────────────────────

/**
 * Trim the journal for a world, keeping the most recent `keep` operations plus
 * the newest entry per entity. Without this the journal grows without bound in
 * a world that never syncs, which is the common case today.
 */
export async function pruneJournal(worldId: string, keep = 500): Promise<number> {
  const all = await listOperations(worldId)
  if (all.length <= keep) return 0
  const keepFromSeq = all[all.length - keep].seq
  const doomed = prunableOperations(all, keepFromSeq)
  if (doomed.length === 0) return 0
  await db.operations.bulkDelete(doomed.map((o) => o.id))
  return doomed.length
}

/**
 * Declare that a world's store changed outside the journal, so the journal no
 * longer explains how it got here.
 *
 * Bulk paths — AI section generation, AI chapter import, world import, sequel
 * forking — write hundreds of records directly. Journalling each one would be
 * both noisy and wrong (they are one authorial act, not hundreds), and leaving
 * a partial journal behind would be worse than either: a journal that claims to
 * be a complete history but silently isn't. So those paths reset it. The cost
 * is losing undo history across a bulk import, which is the honest trade.
 */
export async function markJournalDiscontinuity(worldId: string): Promise<void> {
  // Operations only. Tombstones are *world state* — the fact that a record was
  // deleted — not device-local history, and they travel in `.pwk` so a merge on
  // another device removes what this one removed. Clearing them here would wipe
  // what an import had just written and bring deleted records back.
  await db.operations.where('worldId').equals(worldId).delete()
}

/** Drops a world's journal and tombstones — used by world deletion. */
export async function clearJournal(worldId: string): Promise<void> {
  await db.transaction('rw', [db.operations, db.tombstones], async () => {
    await db.operations.where('worldId').equals(worldId).delete()
    await db.tombstones.where('worldId').equals(worldId).delete()
  })
}
