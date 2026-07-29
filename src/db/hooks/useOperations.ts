import Dexie, { type Table, type EntityTable } from 'dexie'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import { generateId } from '@/lib/id'
import { getDeviceId } from '@/lib/deviceId'
import { makeOperation, makeTombstone, prunableOperations } from '@/lib/operations'
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

/**
 * Next sequence number for a world. Monotonic and gap-tolerant: we only need a
 * deterministic replay order, not a dense range.
 */
async function nextSeq(worldId: string): Promise<number> {
  const latest = await db.operations
    .where('[worldId+seq]')
    .between([worldId, Dexie.minKey], [worldId, Dexie.maxKey])
    .last()
  return (latest?.seq ?? 0) + 1
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
  return db.transaction('rw', [...tables, ...JOURNAL_TABLES()], async () => {
    const seq = await nextSeq(write.worldId)
    const baseVersion = write.baseVersion ?? 1
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
    })
    await db.operations.add(op)
    if (write.type === 'delete') {
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
    }
    return write.apply()
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
